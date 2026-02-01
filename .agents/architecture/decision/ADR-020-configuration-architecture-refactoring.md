---
status: accepted
date: 2026-01-31
decision-makers: [architect, planner]
consulted: [analyst, implementer, memory, security]
informed: [orchestrator, all agents]
adr_review_date: 2026-01-31
consensus: 5 ACCEPT + 1 DISAGREE-AND-COMMIT
---

# ADR-020: Brain Configuration Architecture Refactoring

## Context and Problem Statement

Brain wraps basic-memory but leaks implementation details through its configuration architecture. Users encounter two config files in `~/.basic-memory/` without understanding which to edit. The `default_notes_path` global setting mixes with project-specific data. The unused `~/.brain/projects.json` represents abandoned design intent.

Additionally, the terminology "notes" reflects basic-memory's domain language rather than Brain's user-facing concept of "memories."

The `.agents/` directory pattern creates scattered configuration and session data that should consolidate into Brain's memory system for semantic searchability and cross-session context.

How should Brain structure its configuration to hide basic-memory internals while providing a clean, XDG-compliant user experience?

## Decision Drivers

- **Abstraction integrity**: Users should never know basic-memory exists
- **XDG compliance**: Configuration belongs in standard OS locations
- **Terminology alignment**: "Memories" reflects Brain's domain, not "notes"
- **Separation of concerns**: Global defaults vs project-specific config
- **Memory consolidation**: All agent artifacts must be searchable via Brain memory
- **Future flexibility**: Brain can change backends without user impact
- **Indexing guarantee**: All memories must be indexed by basic-memory for semantic search

## Considered Options

### Option A: Translation Layer with XDG Location

Brain owns its config in `~/.config/brain/config.json` and translates to basic-memory's `~/.basic-memory/config.json` internally.

**Config Flow**:

```text
User edits Brain config
        |
        v
~/.config/brain/config.json (Brain-owned)
        |
        v
Translation layer transforms
        |
        v
~/.basic-memory/config.json (Brain-managed, user-hidden)
        |
        v
basic-memory reads its config
```

### Option B: Direct Delegation to basic-memory

Brain passes through all config operations to basic-memory, abandoning its own config format.

**Config Flow**:

```text
User edits basic-memory config directly
        |
        v
~/.basic-memory/config.json (user-visible)
        |
        v
basic-memory reads its config
```

### Option C: Dual Config with Manual Sync

Keep both configs but require users to manually keep them synchronized.

**Config Flow**:

```text
User edits both files manually
        |
        +-> ~/.config/brain/config.json (Brain settings)
        |
        +-> ~/.basic-memory/config.json (basic-memory settings)
```

### Option D: Single Merged Config in basic-memory Location

Combine all config into `~/.basic-memory/brain-config.json` (current state, with improvements).

## Decision Outcome

Chosen option: **Option A (Translation Layer with XDG Location)**, because it provides clean abstraction while maintaining basic-memory compatibility.

### Architecture Overview

```text
+-------------------------------------------------------------+
|                     User Interaction                        |
|  brain config set default-memories-location ~/my-memories   |
|  brain projects create --name foo --code-path ~/Dev/foo     |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|              ~/.config/brain/config.json                    |
|  (Brain-owned, user-editable, XDG-compliant)                |
|  {                                                          |
|    "defaults": { "memories_location": "~/memories" },       |
|    "projects": { "foo": { "code_path": "...", ... } }       |
|  }                                                          |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                   Translation Layer                         |
|  (Automatic, transparent, one-way sync: Brain -> basic-mem) |
|                                                             |
|  memories_location  ->  (no basic-memory equivalent)        |
|  memories_path      ->  projects.{name}                     |
|  memories_mode      ->  (Brain-only concept)                |
|  sync.enabled       ->  sync_changes                        |
|  sync.delay_ms      ->  sync_delay                          |
|  logging.level      ->  log_level                           |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|             ~/.basic-memory/config.json                     |
|  (Brain-managed, user-hidden, basic-memory reads this)      |
|  {                                                          |
|    "projects": { "foo": "/expanded/path/to/memories" },     |
|    "sync_delay": 500,                                       |
|    "log_level": "info"                                      |
|  }                                                          |
+-------------------------------------------------------------+
```

### Terminology Changes

| Old Term             | New Term                    | Location                 |
| -------------------- | --------------------------- | ------------------------ |
| `notes_path`         | `memories_path`             | Config schema, CLI flags |
| `default_notes_path` | `default_memories_location` | Config schema            |
| `--notes-path`       | `--memories-path`           | CLI flags                |
| `notes_mode`         | `memories_mode`             | Config schema            |
| `notes_location`     | `memories_location`         | Config schema            |

### Consequences

Good:

- Users interact only with Brain config and CLI
- basic-memory becomes invisible implementation detail
- Terminology aligns with Brain's domain ("memories")
- XDG compliance improves cross-platform behavior
- Future backend changes require no user migration
- All agent artifacts become semantically searchable

Bad:

- Translation layer adds code complexity
- Two config files exist (one hidden, one visible)
- One-time migration effort required
- CLI help text requires updates

Neutral:

- basic-memory still reads its own config
- Existing `~/.basic-memory/brain-config.json` becomes obsolete
- `~/.brain/projects.json` can be removed (unused)

### Confirmation

Implementation verified by:

1. `brain config` commands read/write `~/.config/brain/config.json`
2. basic-memory operations work after Brain config changes
3. No user documentation references basic-memory directly
4. Migration tool converts existing configs without data loss
5. All migrated memories appear in `brain search` results (indexing verified)

## Pros and Cons of the Options

### Option A: Translation Layer with XDG Location

- Good, because it hides basic-memory completely from users
- Good, because XDG compliance follows platform conventions
- Good, because Brain controls its schema evolution
- Good, because terminology can be Brain-specific ("memories")
- Neutral, because translation layer requires maintenance
- Bad, because two config files exist (one hidden)

### Option B: Direct Delegation to basic-memory

- Good, because simpler architecture (one config file)
- Good, because no translation layer needed
- Bad, because exposes basic-memory to users (abstraction leak)
- Bad, because locks Brain to basic-memory's schema
- Bad, because cannot use Brain-specific terminology
- Bad, because config location violates XDG

### Option C: Dual Config with Manual Sync

- Good, because clear separation of concerns
- Bad, because user burden to keep configs synchronized
- Bad, because inevitable drift between files
- Bad, because support burden increases
- Bad, because exposes basic-memory to users

### Option D: Single Merged Config in basic-memory Location

- Good, because single config file
- Good, because minimal change from current state
- Bad, because config in wrong location (`~/.basic-memory/`)
- Bad, because exposes basic-memory directory to users
- Bad, because cannot use XDG-compliant paths

## Configuration Schema

### Brain Global Config (`~/.config/brain/config.json`)

```json
{
  "$schema": "https://brain.dev/schemas/config-v2.json",
  "version": "2.0.0",

  "defaults": {
    "memories_location": "~/memories",
    "memories_mode": "DEFAULT"
  },

  "projects": {
    "brain": {
      "code_path": "/Users/peter/Dev/brain",
      "memories_path": "/Users/peter/memories/brain",
      "memories_mode": "DEFAULT"
    },
    "my-app": {
      "code_path": "/Users/peter/Dev/my-app",
      "memories_mode": "CODE"
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

### Schema Definitions

| Field                           | Type    | Required | Description                               |
| ------------------------------- | ------- | -------- | ----------------------------------------- |
| `defaults.memories_location`    | string  | Yes      | Base path for DEFAULT mode memories       |
| `defaults.memories_mode`        | enum    | No       | Default mode for new projects (DEFAULT)   |
| `projects.<name>.code_path`     | string  | Yes      | Absolute path to project source           |
| `projects.<name>.memories_path` | string  | No       | Computed or explicit memories path        |
| `projects.<name>.memories_mode` | enum    | No       | DEFAULT, CODE, or CUSTOM                  |
| `sync.enabled`                  | boolean | No       | Enable file sync (default: true)          |
| `sync.delay_ms`                 | number  | No       | Sync delay in milliseconds (default: 500) |
| `logging.level`                 | enum    | No       | trace, debug, info, warn, error           |

### JSON Schema Validation

All config files MUST validate against JSON Schema before acceptance. Use [Ajv](https://ajv.js.org/) for TypeScript validation.

**Validation requirements**:

- Schema version enforcement (`version` field)
- Required field presence
- Enum value validation
- Path format validation (no path traversal)

### Memories Mode Resolution

| Mode    | Resolution                             | Example             |
| ------- | -------------------------------------- | ------------------- |
| DEFAULT | `${memories_location}/${project_name}` | `~/memories/brain`  |
| CODE    | `${code_path}/docs`                    | `~/Dev/brain/docs`  |
| CUSTOM  | Explicit `memories_path` value         | `/custom/path/here` |

## CLI Command Design

### Global Configuration Commands

```bash
# View configuration
brain config                              # Pretty-printed view
brain config --json                       # Machine-readable

# Set global defaults
brain config set default-memories-location ~/my-memories
brain config set logging.level debug
brain config set sync.delay 1000

# Get specific values
brain config get default-memories-location
brain config get logging.level

# Reset to defaults
brain config reset default-memories-location
brain config reset --all
```

### Project Commands (Updated Flags)

```bash
# Create with new terminology
brain projects create --name myproj --code-path ~/Dev/myproj
brain projects create --name myproj --code-path ~/Dev/myproj --memories-path CODE
brain projects create --name myproj --code-path ~/Dev/myproj --memories-path ~/custom

# Edit with new terminology
brain projects myproj --code-path ~/new/path
brain projects myproj --memories-path DEFAULT

# Unchanged commands
brain projects list
brain projects delete --project myproj
brain projects delete --project myproj --delete-memories
```

### CLI Flag Mapping

| Old Flag         | New Flag                      | Notes                                         |
| ---------------- | ----------------------------- | --------------------------------------------- |
| `--notes-path`   | `--memories-path`             | Value options unchanged (DEFAULT, CODE, path) |
| `--delete-notes` | `--delete-memories`           | For delete command                            |
| N/A              | `--default-memories-location` | New global config command                     |

## File System Layout

### After Migration

```text
~/.config/brain/
+-- config.json          # Brain config (user-visible, XDG-compliant)

~/.basic-memory/         # basic-memory internals (user-hidden)
+-- config.json          # basic-memory config (Brain-managed, 0600 perms)
+-- memory.db            # SQLite database
+-- *.log                # Log files (0600 perms)

~/memories/              # Default memories location
+-- brain/               # Project: brain
+-- my-app/              # Project: my-app
+-- shared/              # Shared memories

# DEPRECATED - Remove entirely after migration
~/.basic-memory/brain-config.json  # Old Brain config
~/.brain/projects.json             # Unused
~/.brain/                          # Unused directory
.agents/                           # All content migrates to Brain memory
```

### File Permissions

| Path                            | Permission | Rationale                        |
| ------------------------------- | ---------- | -------------------------------- |
| `~/.config/brain/`              | 0700       | User config directory            |
| `~/.config/brain/config.json`   | 0600       | Contains project paths           |
| `~/.basic-memory/config.json`   | 0600       | Brain-managed, restrict access   |
| `~/.basic-memory/memory.db`     | 0600       | Database file                    |
| `~/.basic-memory/*.log`         | 0600       | May contain sensitive paths      |
| `~/memories/`                   | 0700       | User memories root               |
| `~/memories/*/`                 | 0700       | Per-project memory directories   |

## Translation Layer Specification

### Sync Direction

**One-way sync: Brain config -> basic-memory config**

The translation layer is NOT bidirectional. Changes flow only from Brain's config to basic-memory's config.

```text
~/.config/brain/config.json  --[translate]--> ~/.basic-memory/config.json
                              (one-way only)
```

**Rationale**: basic-memory should never modify Brain's config. Brain is the authoritative source.

### Atomicity Requirements

Config operations MUST be atomic to prevent partial writes.

**Implementation**:

1. Write to temporary file: `config.json.tmp`
2. Validate JSON structure
3. Atomic rename: `rename(config.json.tmp, config.json)`
4. On failure: remove temporary file, return error

**File locking** (optional, for concurrent access):

- Use advisory file locks (`flock` on Unix, `LockFile` on Windows)
- Lock timeout: 5 seconds
- On timeout: fail operation with clear error

### Translation Field Mapping

| Brain Field                  | basic-memory Field     | Transform                |
| ---------------------------- | ---------------------- | ------------------------ |
| `defaults.memories_location` | (none)                 | Brain-only concept       |
| `projects.<n>.memories_path` | `projects.<n>`         | Path only                |
| `projects.<n>.code_path`     | (none)                 | Brain-only               |
| `projects.<n>.memories_mode` | (none)                 | Resolved before sync     |
| `sync.enabled`               | `sync_changes`         | Direct map               |
| `sync.delay_ms`              | `sync_delay`           | Direct map               |
| `logging.level`              | `log_level`            | Direct map               |

### Error Handling Matrix

| Error Condition              | Behavior                    | Recovery Action                |
| ---------------------------- | --------------------------- | ------------------------------ |
| Config file missing          | Create with defaults        | N/A                            |
| Invalid JSON                 | Reject operation            | Return parse error details     |
| Schema validation failure    | Reject operation            | Return validation errors       |
| Write permission denied      | Fail operation              | Return permission error        |
| Temp file write failure      | Fail operation              | Clean up temp file             |
| Atomic rename failure        | Fail operation              | Keep original, clean up temp   |
| Translation failure          | Fail operation              | Keep Brain config, log error   |
| basic-memory write failure   | Log warning, continue       | Brain config still updated     |
| Path traversal attempt       | Reject operation            | Log security warning           |
| Lock timeout                 | Fail operation              | Return timeout error           |

## Security Requirements

### Path Validation

All path inputs MUST be validated before use.

**Validation rules**:

1. Reject paths containing `..` (directory traversal)
2. Reject absolute paths to system directories (`/etc`, `/usr`, `/var`, `C:\Windows`)
3. Reject paths with null bytes
4. Expand `~` to user home directory
5. Normalize paths (resolve `.` and symlinks)
6. Reject paths outside user-accessible directories

**Implementation**:

```typescript
function validatePath(path: string): ValidationResult {
  // Reject traversal attempts
  if (path.includes('..')) {
    return { valid: false, error: 'Path traversal not allowed' };
  }

  // Reject null bytes
  if (path.includes('\0')) {
    return { valid: false, error: 'Invalid path characters' };
  }

  // Reject system paths
  const systemPaths = ['/etc', '/usr', '/var', '/bin', '/sbin', 'C:\\Windows', 'C:\\Program Files'];
  const normalized = normalizePath(path);
  for (const sys of systemPaths) {
    if (normalized.startsWith(sys)) {
      return { valid: false, error: 'System path not allowed' };
    }
  }

  return { valid: true };
}
```

### Permission Enforcement

- Config files: 0600 (owner read/write only)
- Config directories: 0700 (owner access only)
- Log rotation: preserve permissions on rotate

## Migration Plan

### Scope

Migration covers:

1. **Config files**: `~/.basic-memory/brain-config.json` to `~/.config/brain/config.json`
2. **Deprecated directories**: Remove `~/.brain/`
3. **`.agents/` content**: Migrate ALL content to Brain memory

### Phase 1: Detection and Analysis

```bash
brain migrate --dry-run
```

**Checks**:

1. Detect `~/.basic-memory/brain-config.json` (old Brain config)
2. Detect `~/.config/brain/config.json` (new location, may not exist)
3. Scan `.agents/` directories for content to migrate
4. Report migration plan with file counts

### Phase 2: Config Transformation

**Old Format** (`~/.basic-memory/brain-config.json`):

```json
{
  "code_paths": {
    "brain": "/Users/peter/Dev/brain"
  },
  "default_notes_path": "~/memories"
}
```

**New Format** (`~/.config/brain/config.json`):

```json
{
  "$schema": "https://brain.dev/schemas/config-v2.json",
  "version": "2.0.0",
  "defaults": {
    "memories_location": "~/memories",
    "memories_mode": "DEFAULT"
  },
  "projects": {
    "brain": {
      "code_path": "/Users/peter/Dev/brain",
      "memories_mode": "DEFAULT"
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

### Phase 3: .agents/ Content Migration

All `.agents/` content MUST migrate to Brain memory with proper categorization.

#### Content Category Mapping

| Source Directory       | Brain Memory Category | Memory Title Convention               |
| ---------------------- | --------------------- | ------------------------------------- |
| `.agents/sessions/`    | `sessions`            | `session-YYYY-MM-DD-NN-topic`         |
| `.agents/analysis/`    | `analysis`            | `analysis-NNN-topic`                  |
| `.agents/architecture/`| `architecture`        | `ADR-NNN-title`                       |
| `.agents/planning/`    | `planning`            | `plan-NNN-topic`                      |
| `.agents/critique/`    | `critique`            | `critique-NNN-topic`                  |
| `.agents/qa/`          | `qa`                  | `qa-NNN-topic`                        |
| `.agents/specs/`       | `specs`               | `spec-topic` or `REQ-NNN-title`       |
| `.agents/roadmap/`     | `roadmap`             | `roadmap-topic`                       |
| `.agents/retrospective/`| `retrospective`      | `retro-YYYY-MM-DD-topic`              |
| `.agents/skills/`      | `skills`              | `Skill-Category-NNN`                  |
| `.agents/governance/`  | `governance`          | `governance-topic`                    |

#### Migration Command

```bash
brain migrate-agents [--project <name>] [--dry-run]
```

**Behavior**:

1. Scan `.agents/` directory in project root
2. Categorize each file by source directory
3. Transform filename to memory title
4. Write to Brain memory via `brain write`
5. Verify indexing via `brain search` (must return result)
6. Remove source file after verification
7. Remove `.agents/` directory when empty

#### TUI/MCP Coordination

The TUI (`brain` CLI) delegates ALL config operations to the MCP server.

```text
brain config set X    -->  MCP tool: config_set(key, value)
brain migrate         -->  MCP tool: migrate_config()
brain migrate-agents  -->  MCP tool: migrate_agents(project)
```

**Rationale**: Single implementation point. TUI is a thin client.

### Phase 4: Execution

```bash
brain migrate [--cleanup]
```

**Steps**:

1. Create `~/.config/brain/` directory with 0700 permissions
2. Transform old config to new schema
3. Write `~/.config/brain/config.json` with 0600 permissions
4. Sync to `~/.basic-memory/config.json` via translation layer
5. Migrate `.agents/` content to Brain memory
6. Verify all memories are indexed
7. If `--cleanup`: remove deprecated files and directories

### Phase 5: Validation

**Post-migration checks**:

1. `brain config` reads from new location
2. `brain projects list` returns same projects
3. basic-memory operations work (search, read, write)
4. All migrated memories searchable via `brain search`
5. No orphaned files in deprecated locations

#### Indexing Verification

All migrated memories MUST be indexed by basic-memory.

**Verification command**:

```bash
brain migrate-agents --verify-only
```

**Verification logic**:

```typescript
async function verifyIndexing(memory: MigratedMemory): Promise<boolean> {
  // Search for the exact title
  const results = await brain.search(memory.title, { limit: 1 });

  if (results.length === 0) {
    console.error(`FAIL: Memory not indexed: ${memory.title}`);
    return false;
  }

  // Verify content match
  const note = await brain.readNote(memory.title);
  if (!note.content.includes(memory.content.substring(0, 100))) {
    console.error(`FAIL: Content mismatch: ${memory.title}`);
    return false;
  }

  console.log(`PASS: Indexed: ${memory.title}`);
  return true;
}
```

## Agent and Skill Updates

### Memory Agent Alignment

The memory agent MUST use Brain MCP tools exclusively.

**Current tools** (verify alignment):

| Tool                                  | Purpose                       |
| ------------------------------------- | ----------------------------- |
| `mcp__plugin_brain_brain__write_note` | Create/update memory          |
| `mcp__plugin_brain_brain__read_note`  | Read memory content           |
| `mcp__plugin_brain_brain__search`     | Semantic search               |
| `mcp__plugin_brain_brain__edit_note`  | Append/prepend/replace        |
| `mcp__plugin_brain_brain__build_context` | Initialize project context |

**Memory skill alignment**:

The memory skill (`.claude/skills/memory/`) MUST delegate to the memory agent or use Brain MCP tools directly. No file system operations on `.agents/` allowed.

### Required Agent Updates

All agents referencing `.agents/` paths MUST update to use Brain memory.

| Agent        | Current Pattern                    | New Pattern                          |
| ------------ | ---------------------------------- | ------------------------------------ |
| orchestrator | Read `.agents/HANDOFF.md`          | `brain.readNote("handoff")`          |
| planner      | Write `.agents/planning/*.md`      | `brain.writeNote(title, content, "planning")` |
| analyst      | Write `.agents/analysis/*.md`      | `brain.writeNote(title, content, "analysis")` |
| architect    | Write `.agents/architecture/*.md`  | `brain.writeNote(title, content, "architecture")` |
| qa           | Write `.agents/qa/*.md`            | `brain.writeNote(title, content, "qa")` |
| critic       | Write `.agents/critique/*.md`      | `brain.writeNote(title, content, "critique")` |
| retrospective| Write `.agents/retrospective/*.md` | `brain.writeNote(title, content, "retrospective")` |
| skillbook    | Write `.agents/skills/*.md`        | `brain.writeNote(title, content, "skills")` |

### Session Log Handling

Session logs migrate to Brain memory with special handling.

**Current**: `.agents/sessions/YYYY-MM-DD-session-NN-topic.md`
**New**: Brain memory with title `session-YYYY-MM-DD-NN-topic`

**Session protocol updates**:

1. Session start: `brain.writeNote("session-YYYY-MM-DD-NN-topic", initialContent, "sessions")`
2. Session updates: `brain.editNote("session-...", "append", updateContent)`
3. Session end: Final append with summary

### HANDOFF.md Replacement

The HANDOFF.md file becomes a Brain memory.

**Migration**:

```bash
brain write --title "handoff" --category "governance" < .agents/HANDOFF.md
```

**Access pattern**:

```typescript
// Read handoff
const handoff = await brain.readNote("handoff");

// Update handoff (read-only pattern: agents should not update directly)
// Only orchestrator or session-end workflow updates handoff
```

## Code Changes Required

### Files Requiring Terminology Updates

Based on codebase analysis, the following files contain `notes_path`, `default_notes_path`, or `notes` terminology:

| File                                           | Changes                                             |
| ---------------------------------------------- | --------------------------------------------------- |
| `apps/mcp/src/project/config.ts`               | `default_notes_path` to `default_memories_location` |
| `apps/mcp/src/tools/projects/create/schema.ts` | All `notes_path` references                         |
| `apps/mcp/src/tools/projects/create/index.ts`  | `getDefaultNotesPath()` rename                      |
| `apps/mcp/src/tools/projects/edit/schema.ts`   | All `notes_path` references                         |
| `apps/mcp/src/tools/projects/edit/index.ts`    | `getDefaultNotesPath()` rename                      |
| `apps/tui/cmd/projects.go`                     | CLI flag `--notes-path` to `--memories-path`        |
| Test files (`*.test.ts`)                       | All `notes_path` references                         |

### Hardcoded `~/memories` Locations (7 instances)

| Location                                         | Current        | Action            |
| ------------------------------------------------ | -------------- | ----------------- |
| `apps/mcp/src/project/config.ts:43`              | `"~/memories"` | Read from config  |
| `apps/mcp/src/project/config.ts:50`              | `"~/memories"` | Read from config  |
| `apps/mcp/src/tools/projects/create/index.ts:30` | `"~/memories"` | Read from config  |
| `apps/mcp/src/tools/projects/create/index.ts:35` | `"~/memories"` | Read from config  |
| `apps/mcp/src/tools/projects/edit/index.ts:345`  | `"~/memories"` | Read from config  |
| `apps/mcp/src/tools/projects/edit/index.ts:350`  | `"~/memories"` | Read from config  |
| Test files (multiple)                            | `"~/memories"` | Keep as test data |

### New Files Required

| File                                       | Purpose                                |
| ------------------------------------------ | -------------------------------------- |
| `apps/mcp/src/config/brain-config.ts`      | Brain config read/write                |
| `apps/mcp/src/config/translation-layer.ts` | Brain to basic-memory translation      |
| `apps/mcp/src/config/migration.ts`         | Migration logic                        |
| `apps/mcp/src/config/path-validator.ts`    | Path traversal and security validation |
| `apps/mcp/src/config/schema.json`          | JSON Schema for config validation      |
| `apps/tui/cmd/config.go`                   | `brain config` command family          |
| `apps/tui/cmd/migrate.go`                  | Migration commands                     |

## Test Strategy

### Coverage Requirements

Per ADR-017 template, minimum 80% code coverage for new modules.

| Module              | Unit Tests | Integration Tests | Coverage Target |
| ------------------- | ---------- | ----------------- | --------------- |
| brain-config.ts     | Yes        | Yes               | 90%             |
| translation-layer.ts| Yes        | Yes               | 90%             |
| migration.ts        | Yes        | Yes               | 85%             |
| path-validator.ts   | Yes        | No                | 95%             |
| TUI config commands | Yes        | Yes               | 80%             |

### Test Categories

**Unit tests**:

- Config parsing (valid/invalid JSON)
- Schema validation (missing fields, invalid types)
- Path validation (traversal attempts, system paths)
- Translation field mapping
- Atomic write (temp file, rename)

**Integration tests**:

- End-to-end config set/get
- Migration dry-run
- Migration execution
- basic-memory sync verification
- Indexing verification for migrated content

**Security tests**:

- Path traversal rejection
- Permission enforcement
- Null byte rejection
- System path rejection

### Test Data

Located in `apps/mcp/src/config/__tests__/fixtures/`:

```text
fixtures/
+-- valid-config.json
+-- invalid-schema.json
+-- old-format-config.json
+-- traversal-paths.json
```

## Reversibility Assessment

- [x] **Rollback capability**: Config files can be reverted; no data migration involved
- [x] **Vendor lock-in**: None (internal architecture change)
- [x] **Exit strategy**: N/A (internal tooling)
- [x] **Legacy impact**: One-time migration; .agents/ deprecated entirely
- [x] **Data migration**: Memories remain in same format, only location changes

## More Information

### Related Decisions

- ADR-007: Memory-First Architecture (established Brain as abstraction layer)
- ADR-017: Memory Tool Naming Strategy (naming conventions)
- ADR-019: Memory Operations Governance (agent access patterns)
- ADR-016: Session Protocol Enforcement (session logging patterns)

### Evidence

**Current state audit** (2026-01-31):

- Config in `~/.basic-memory/brain-config.json` (wrong location)
- 7 hardcoded `~/memories` fallbacks in code
- Unused `~/.brain/projects.json` (empty)
- User confusion documented in analysis
- `.agents/` directories contain 100+ files across multiple projects

### Sources

- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir/latest/)
- [Docker daemon configuration](https://docs.docker.com/reference/cli/dockerd/) (abstraction pattern)
- [kubectl kubeconfig](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/) (context switching)
- [Ajv JSON Schema Validator](https://ajv.js.org/)
- Analyst findings: Brain memory `analysis-001-configuration-architecture`

### Review Schedule

Review at 14 days post-implementation:

- Migration completion rate
- Indexing verification pass rate
- User feedback on new CLI
- Translation layer reliability
- Agent update completion
