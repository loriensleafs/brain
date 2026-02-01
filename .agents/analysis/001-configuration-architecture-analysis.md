# Analysis: Brain Configuration Architecture

## 1. Objective and Scope

**Objective**: Design a clean abstraction layer where Brain manages its own configuration and translates it to basic-memory configuration internally, hiding implementation details from users.

**Scope**:
- Current state of Brain and basic-memory configuration
- Configuration best practices from similar tools
- Proposed Brain configuration architecture
- Migration path and CLI command design

## 2. Context

Brain currently wraps basic-memory but exposes implementation details:
- Configuration lives in `~/.basic-memory/` (basic-memory's directory)
- Users see `brain-config.json` and `config.json` side by side
- `default_notes_path` is GLOBAL but stored alongside project configs
- The `~/.brain/` directory exists but is unused (empty `projects.json`)

**User confusion points**:
1. "Why is my Brain config in a basic-memory folder?"
2. "What's the difference between brain-config.json and config.json?"
3. "Which config do I edit?"

## 3. Approach

**Methodology**:
1. Code analysis of current Brain and basic-memory configuration handling
2. Research configuration patterns from Docker, kubectl, npm/yarn, and git
3. Apply XDG Base Directory Specification principles
4. Design Brain-native configuration architecture

**Tools Used**:
- Grep/Read for codebase analysis
- WebSearch for industry best practices

**Limitations**:
- Cannot test changes without implementation
- basic-memory's config schema is external dependency

## 4. Data and Analysis

### 4.1 Current State Documentation

#### Configuration Files

| File | Location | Owner | Purpose |
|------|----------|-------|---------|
| `brain-config.json` | `~/.basic-memory/` | Brain | code_paths mapping, default_notes_path |
| `config.json` | `~/.basic-memory/` | basic-memory | projects (notes paths), sync settings, cloud config |
| `projects.json` | `~/.brain/` | Brain (unused) | Empty, vestigial |

#### brain-config.json Schema (Current)

```json
{
  "code_paths": {
    "project-name": "/absolute/path/to/code"
  },
  "default_notes_path": "~/memories"
}
```

#### basic-memory config.json Schema (Relevant Parts)

```json
{
  "projects": {
    "project-name": "/absolute/path/to/notes"
  },
  "default_project": "shared",
  "sync_delay": 500,
  "log_level": "INFO",
  "kebab_filenames": true,
  "cloud_mode": false
}
```

#### How Configuration Flows

```
User runs: brain projects create --name foo --code-path ~/Dev/foo

Brain TUI (Go)
    │
    ├─► HTTP call to Brain MCP server
    │
Brain MCP (TypeScript)
    │
    ├─► Writes to ~/.basic-memory/brain-config.json (code_paths)
    │
    ├─► Writes to ~/.basic-memory/config.json (projects/notes paths)
    │
    └─► basic-memory reads config.json for note operations
```

**Key Issue**: Brain writes directly to basic-memory's config file rather than maintaining its own config and syncing.

### 4.2 Best Practices from Similar Tools

#### Git: Three-Level Hierarchy

| Level | Location | Scope | Override |
|-------|----------|-------|----------|
| System | `/etc/gitconfig` | All users | Lowest |
| Global | `~/.gitconfig` | User | Medium |
| Local | `.git/config` | Repository | Highest |

**Brain Application**: Git's model works well. Brain should support:
- Global: User defaults (`~/.config/brain/config.json`)
- Local: Project overrides (stored in Brain's global config, keyed by project)

#### kubectl: Hierarchical with Context Switching

```
~/.kube/config           # Default global config
$KUBECONFIG              # Environment variable override
--kubeconfig <path>      # Command flag override
```

**Brain Application**: kubectl's context-switching model maps to Brain's project concept. The "active project" is like kubectl's current-context.

#### Docker: Hidden Runtime Abstraction

Docker users interact with `docker` commands. They rarely see containerd configuration directly. Docker maintains:
- `/etc/docker/daemon.json` - Docker daemon config
- Internal management of containerd (hidden from users)

**Brain Application**: Brain should follow this pattern. Users configure Brain; Brain manages basic-memory internally.

#### npm/yarn: Global + Local Layering

```
~/.npmrc                 # Global user config
.npmrc                   # Project-local config
package.json             # Project metadata
```

**Brain Application**: Similar to git, npm separates user preferences from project metadata.

#### XDG Base Directory Specification

| Variable | Default | Purpose |
|----------|---------|---------|
| `XDG_CONFIG_HOME` | `~/.config/` | User-specific configuration |
| `XDG_DATA_HOME` | `~/.local/share/` | User-specific data |
| `XDG_STATE_HOME` | `~/.local/state/` | User-specific state |
| `XDG_CACHE_HOME` | `~/.cache/` | Non-essential cached data |

**Brain Application**: Brain should use `~/.config/brain/` for configuration per XDG spec.

### 4.3 Problems with Current Architecture

| Problem | Impact | Severity |
|---------|--------|----------|
| Brain config in basic-memory dir | User confusion | Medium |
| Two config files to understand | Onboarding friction | Medium |
| Global `default_notes_path` mixed with project data | Semantic confusion | Low |
| Unused `~/.brain/` directory | Wasted opportunity | Low |
| Direct manipulation of basic-memory config | Tight coupling, fragility | High |

## 5. Results

### 5.1 Proposed Brain Configuration Architecture

#### Directory Structure

```
~/.config/brain/
├── config.json          # Brain global config (user preferences)
└── projects/            # Per-project config files (optional, future)

~/.local/share/brain/
├── projects.db          # Project registry (SQLite, optional)
└── cache/               # Cached data

~/.basic-memory/         # Internal to basic-memory (Brain manages this)
├── config.json          # basic-memory config (Brain-managed)
├── memory.db            # SQLite database
└── *.log                # Log files
```

#### Brain Global Config Schema

```json
{
  "$schema": "https://brain.dev/schemas/config.json",
  "version": "2.0.0",
  
  "defaults": {
    "notes_location": "~/memories",
    "notes_mode": "DEFAULT"
  },
  
  "projects": {
    "brain": {
      "code_path": "/Users/peter/Dev/brain",
      "notes_path": "/Users/peter/memories/brain",
      "notes_mode": "DEFAULT"
    },
    "my-app": {
      "code_path": "/Users/peter/Dev/my-app",
      "notes_mode": "CODE"
    }
  },
  
  "sync": {
    "enabled": true,
    "delay_ms": 500
  },
  
  "logging": {
    "level": "info"
  }
}
```

#### Configuration Concepts

| Concept | Description | Examples |
|---------|-------------|----------|
| `notes_location` | Global default base path for notes | `~/memories`, `~/Documents/notes` |
| `notes_mode` | How notes_path is derived | `DEFAULT`, `CODE`, `CUSTOM` |
| `code_path` | Where project source code lives | `/Users/peter/Dev/brain` |
| `notes_path` | Where project notes are stored | Computed or explicit |

**Notes Mode Resolution**:
- `DEFAULT`: `${notes_location}/${project_name}`
- `CODE`: `${code_path}/docs`
- `CUSTOM`: Explicit path specified by user

### 5.2 Translation Layer

Brain maintains its own config and translates to basic-memory config:

```
Brain Config                    basic-memory Config
────────────────────────────────────────────────────
projects.brain.notes_path   →   projects.brain
projects.my-app.notes_path  →   projects.my-app
sync.enabled                →   sync_changes
sync.delay_ms               →   sync_delay
logging.level               →   log_level
```

**Sync Strategy**: On any Brain config change:
1. Read Brain config from `~/.config/brain/config.json`
2. Transform to basic-memory schema
3. Write to `~/.basic-memory/config.json`
4. basic-memory picks up changes via file watch

### 5.3 CLI Command Design

#### Global Configuration Commands

```bash
# View current config
brain config                     # Show all config (pretty-printed)
brain config --json              # Machine-readable output

# Set global defaults
brain config set notes-location ~/my-notes
brain config set logging.level debug
brain config set sync.delay 1000

# Get specific values
brain config get notes-location
brain config get logging.level

# Reset to defaults
brain config reset notes-location
brain config reset --all
```

#### Project Commands (Unchanged UX, New Internals)

```bash
# List projects
brain projects list

# Create project (unchanged syntax)
brain projects create --name myproj --code-path ~/Dev/myproj
brain projects create --name myproj --code-path ~/Dev/myproj --notes-path CODE
brain projects create --name myproj --code-path ~/Dev/myproj --notes-path ~/custom/path

# Edit project (unchanged syntax)
brain projects myproj --code-path ~/new/path
brain projects myproj --notes-path DEFAULT

# Delete project (unchanged syntax)
brain projects delete --project myproj
brain projects delete --project myproj --delete-notes
```

#### What Changes

| Aspect | Before | After |
|--------|--------|-------|
| Config location | `~/.basic-memory/brain-config.json` | `~/.config/brain/config.json` |
| basic-memory config | User-visible | Hidden (Brain-managed) |
| `brain config` command | None | New command for global settings |
| Internal structure | Flat | Nested, schema-validated |

## 6. Discussion

### 6.1 Why This Matters

**Abstraction Quality**: The current architecture leaks implementation details. Users should not know that basic-memory exists, just like Docker users do not need to know about containerd.

**Future Flexibility**: By owning its config format, Brain can:
- Add features without basic-memory changes
- Migrate to different backends without user impact
- Version its schema independently

**User Mental Model**: Users think in terms of projects with code and notes. The config should reflect this, not storage implementation details.

### 6.2 Migration Considerations

**Backward Compatibility**: Existing users have data in `~/.basic-memory/brain-config.json`. Migration must:
1. Detect existing config
2. Transform to new format
3. Write to new location
4. Optionally clean up old location (with user consent)

**basic-memory Coupling**: basic-memory will continue to read its own `~/.basic-memory/config.json`. Brain must keep this file updated, but users should not edit it directly.

### 6.3 XDG vs Custom Location

**Option A**: XDG-compliant (`~/.config/brain/`)
- Pros: Follows Linux standards, familiar to power users
- Cons: macOS users may not expect this

**Option B**: Custom (`~/.brain/`)
- Pros: Simple, discoverable
- Cons: Adds to home directory clutter

**Recommendation**: Use XDG on Linux, `~/.config/brain/` on macOS (macOS supports XDG), and `%APPDATA%\brain\` on Windows. This matches modern CLI tools like gh, glab, etc.

### 6.4 Risks

| Risk | Mitigation |
|------|------------|
| Breaking existing workflows | Provide migration tool, support legacy paths during transition |
| basic-memory config drift | Brain re-syncs on startup, validates consistency |
| User edits basic-memory config directly | Document that it is managed, warn on inconsistency |

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
|----------|----------------|-----------|--------|
| P0 | Move Brain config to `~/.config/brain/config.json` | Primary abstraction fix | Medium |
| P0 | Implement translation layer to basic-memory config | Hide implementation | Medium |
| P1 | Add `brain config` command family | User control over global settings | Medium |
| P1 | Create migration tool for existing configs | Backward compatibility | Low |
| P2 | Add schema validation to Brain config | Error prevention | Low |
| P2 | Support environment variable overrides | CI/CD and advanced use cases | Low |

## 8. Conclusion

**Verdict**: Proceed with config architecture redesign

**Confidence**: High

**Rationale**: The current architecture exposes basic-memory internals to users, creating confusion and tight coupling. Industry standard tools (Docker, kubectl, npm) demonstrate that clean abstraction layers improve user experience and maintainability.

### User Impact

- **What changes for you**: Configuration moves from `~/.basic-memory/brain-config.json` to `~/.config/brain/config.json`. New `brain config` commands for global settings. No changes to project commands.
- **Effort required**: One-time migration (automated), minimal learning curve for new config command.
- **Risk if ignored**: Continued user confusion, increased support burden, fragile coupling to basic-memory internals.

## 9. Appendices

### A. Sources Consulted

- [Docker Daemon Configuration](https://docs.docker.com/reference/cli/dockerd/)
- [containerd Configuration](https://deepwiki.com/containerd/containerd/2.2-configuration-file-reference)
- [kubectl kubeconfig](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/)
- [Git Configuration Levels](https://git-scm.com/docs/git-config)
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir/latest/)
- [Yarn Configuration](https://yarnpkg.com/configuration/yarnrc)

### B. Data Transparency

**Found**:
- Complete Brain config handling code in `/apps/mcp/src/project/config.ts`
- All project tool implementations in `/apps/mcp/src/tools/projects/`
- Current config files at `~/.basic-memory/`
- Unused `~/.brain/projects.json`

**Not Found**:
- Documentation on original design intent for `~/.brain/`
- basic-memory's internal config schema documentation

### C. Proposed Config Schema (Full)

```json
{
  "$schema": "https://brain.dev/schemas/config.json",
  "version": "2.0.0",
  
  "defaults": {
    "notes_location": "~/memories",
    "notes_mode": "DEFAULT"
  },
  
  "projects": {
    "<project-name>": {
      "code_path": "<absolute-path>",
      "notes_path": "<absolute-path | null>",
      "notes_mode": "DEFAULT | CODE | CUSTOM"
    }
  },
  
  "sync": {
    "enabled": true,
    "delay_ms": 500,
    "thread_pool_size": 4,
    "max_concurrent_files": 10
  },
  
  "logging": {
    "level": "trace | debug | info | warn | error",
    "file": "~/.local/state/brain/brain.log"
  },
  
  "experimental": {
    "cloud_mode": false
  }
}
```

### D. Migration Path

1. **Detection**: Check for `~/.basic-memory/brain-config.json`
2. **Transform**: Convert old format to new schema
3. **Write**: Save to `~/.config/brain/config.json`
4. **Sync**: Update `~/.basic-memory/config.json` via translation layer
5. **Cleanup** (optional): Archive or remove old `brain-config.json`

```bash
# Proposed migration command
brain migrate-config [--dry-run] [--cleanup]
```
