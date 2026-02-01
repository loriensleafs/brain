---
status: accepted
date: 2026-01-31
revision: 2026-01-31 (Round 2 P0 fixes + file-watching)
decision-makers: [architect, planner]
consulted: [analyst, implementer, memory, security, critic]
informed: [orchestrator, all agents]
adr_review_rounds: 2
round_1_consensus: 5 ACCEPT + 1 DISAGREE-AND-COMMIT
round_2_consensus: 5 ACCEPT + 1 DISAGREE-AND-COMMIT
final_consensus: approved
total_issues_resolved: 47 (20 P0, 12 P1, 15 P2)
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
  },

  "watcher": {
    "enabled": true,
    "debounce_ms": 2000
  }
}
```

### Schema Definitions

| Field                           | Type    | Required | Description                                   |
| ------------------------------- | ------- | -------- | --------------------------------------------- |
| `defaults.memories_location`    | string  | Yes      | Base path for DEFAULT mode memories           |
| `defaults.memories_mode`        | enum    | No       | Default mode for new projects (DEFAULT)       |
| `projects.<name>.code_path`     | string  | Yes      | Absolute path to project source               |
| `projects.<name>.memories_path` | string  | No       | Computed or explicit memories path            |
| `projects.<name>.memories_mode` | enum    | No       | DEFAULT, CODE, or CUSTOM                      |
| `sync.enabled`                  | boolean | No       | Enable file sync (default: true)              |
| `sync.delay_ms`                 | number  | No       | Sync delay in milliseconds (default: 500)     |
| `logging.level`                 | enum    | No       | trace, debug, info, warn, error               |
| `watcher.enabled`               | boolean | No       | Enable config file watching (default: true)   |
| `watcher.debounce_ms`           | number  | No       | Debounce delay in milliseconds (default: 2000)|

### Schema Validation

All config files MUST validate against schemas before acceptance. Use [Zod](https://zod.dev/) for TypeScript validation (consistent with existing Brain codebase: 14 files, 47+ occurrences).

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

| File                                       | Purpose                                     |
| ------------------------------------------ | ------------------------------------------- |
| `apps/mcp/src/config/brain-config.ts`      | Brain config read/write                     |
| `apps/mcp/src/config/translation-layer.ts` | Brain to basic-memory translation           |
| `apps/mcp/src/config/migration.ts`         | Migration logic                             |
| `apps/mcp/src/config/migration-transaction.ts` | Transactional migration with rollback (P0-1) |
| `apps/mcp/src/config/migration-verify.ts`  | Indexing verification                       |
| `apps/mcp/src/config/path-validator.ts`    | Path traversal and security validation      |
| `apps/mcp/src/config/schema.ts`            | Zod schema for config validation            |
| `apps/mcp/src/config/watcher.ts`           | ConfigFileWatcher class (manual edit detection) |
| `apps/mcp/src/config/diff.ts`              | detectConfigDiff function                   |
| `apps/mcp/src/config/rollback.ts`          | ConfigRollbackManager class with initialization (P0-4) |
| `apps/mcp/src/config/lock.ts`              | Global and project locking (P0-1, P0-2)     |
| `apps/mcp/src/config/copy-manifest.ts`     | CopyManifest for partial copy tracking (P0-5) |
| `apps/mcp/src/config/integrity.ts`         | Checksum verification for partial write (P0-3) |
| `apps/mcp/src/tools/config/update-project.ts` | MCP tool implementation                  |
| `apps/mcp/src/tools/config/update-global.ts` | MCP tool implementation                   |
| `apps/tui/cmd/config.go`                   | `brain config` command family               |
| `apps/tui/cmd/migrate.go`                  | Migration commands                          |

## Test Strategy

### Coverage Requirements

Per ADR-017 template, minimum 80% code coverage for new modules.

| Module              | Unit Tests | Integration Tests | Coverage Target |
| ------------------- | ---------- | ----------------- | --------------- |
| brain-config.ts     | Yes        | Yes               | 90%             |
| translation-layer.ts| Yes        | Yes               | 90%             |
| migration.ts        | Yes        | Yes               | 85%             |
| path-validator.ts   | Yes        | No                | 95%             |
| watcher.ts          | Yes        | Yes               | 90%             |
| diff.ts             | Yes        | No                | 95%             |
| rollback.ts         | Yes        | Yes               | 90%             |
| TUI config commands | Yes        | Yes               | 80%             |

### Test Categories

**Unit tests**:

- Config parsing (valid/invalid JSON)
- Schema validation (missing fields, invalid types)
- Path validation (traversal attempts, system paths)
- Translation field mapping
- Atomic write (temp file, rename)
- Config diff detection (changed fields, migration required)
- Rollback manager (snapshot, revert)

**Integration tests**:

- End-to-end config set/get
- Migration dry-run
- Migration execution
- basic-memory sync verification
- Indexing verification for migrated content
- File watcher debouncing (rapid edits)
- File watcher migration trigger
- File watcher rollback on failure

**Security tests**:

- Path traversal rejection
- Permission enforcement
- Null byte rejection
- System path rejection

**File watcher tests**:

- Detect config file change
- Debounce multiple rapid edits
- Validate before migration
- Revert on invalid JSON
- Revert on schema violation
- Revert on migration failure
- Handle config file deletion
- Handle concurrent edit during migration
- Disable watcher via config

**P0 Fix tests** (Round 2):

- TOCTOU: Verify lock held throughout load-validate-migrate-commit cycle
- Multi-project: Global lock acquired before project locks on default_memories_location change
- Multi-project: Project locks acquired in sorted alphabetical order (deadlock prevention)
- Multi-project: All projects rolled back if any project fails
- Partial write: Checksum verification detects incomplete file write
- Partial write: Processing skipped when file unstable
- lastKnownGood: Baseline established on MCP server startup
- lastKnownGood: Rollback works even before first migration
- CopyManifest: Manifest persisted before copy starts
- CopyManifest: Partial rollback removes only copied files
- CopyManifest: Incomplete migration recovered on startup
- Queue behavior: Edit during migration queued and processed after
- Queue behavior: Multiple queued edits collapsed to single processing

### Test Data

Located in `apps/mcp/src/config/__tests__/fixtures/`:

```text
fixtures/
+-- valid-config.json
+-- invalid-schema.json
+-- old-format-config.json
+-- traversal-paths.json
+-- watcher-test-configs/
    +-- before-mode-change.json
    +-- after-mode-change.json
    +-- invalid-syntax.json
    +-- invalid-path.json
```

## Config Change Protocol (Live Reconfiguration)

### Problem Statement

ADR-020 addresses one-time migration from old config format to new format. However, users will perform ongoing configuration changes that require memory migration:

- Switching a project from DEFAULT to CODE mode (or vice versa)
- Changing the global `default_memories_location`
- Moving memories to a custom path

These operations MUST be transactional (all-or-nothing) with rollback on failure.

### Scope

Config changes that trigger memory migration:

| Config Change | Affected Scope | Migration Required |
|--------------|----------------|-------------------|
| `memories_mode` change per project | Single project | Yes |
| `memories_path` explicit change | Single project | Yes |
| `default_memories_location` change | All projects using DEFAULT mode | Yes |

### Example Scenarios

```bash
# Scenario 1: User switches project from DEFAULT to CODE mode
brain projects myproject --memories-path CODE
# Migration: ~/memories/myproject/* → ~/Dev/myproject/docs/

# Scenario 2: User switches project from CODE to DEFAULT mode
brain projects myproject --memories-path DEFAULT
# Migration: ~/Dev/myproject/docs/* → ~/memories/myproject/

# Scenario 3: User sets explicit custom path
brain projects myproject --memories-path ~/Dropbox/memories/myproject
# Migration: (current location)/* → ~/Dropbox/memories/myproject/

# Scenario 4: User changes global default location
brain config set default-memories-location ~/Dropbox/memories
# Migration: ALL projects using DEFAULT mode migrated to new base
```

### Transactional Requirements

All config change operations MUST be atomic (all-or-nothing).

**Transaction phases**:

```text
1. VALIDATE
   - Source path exists and is readable
   - Target path is writable (or can be created)
   - Sufficient disk space at target
   - No path traversal or security violations

2. PREPARE
   - Create target directory structure
   - Calculate file manifest (source → target mapping)
   - Take snapshot of current basic-memory index state

3. EXECUTE
   - Copy all memory files to target location
   - DO NOT delete source files yet

4. REINDEX
   - Update basic-memory project config to new path
   - Trigger basic-memory reindex
   - Wait for index completion

5. VERIFY
   - For each migrated memory:
     - Search by title (must return result)
     - Read content (must match source)
   - Verification MUST pass for ALL memories

6. COMMIT (on success)
   - Delete source files
   - Update Brain config atomically
   - Log success

6. ROLLBACK (on failure)
   - Delete target files (if any)
   - Restore basic-memory index to snapshot
   - Keep source files intact
   - Log failure with reason
```

### Rollback Specification

Rollback MUST restore system to pre-operation state.

**Rollback triggers**:

| Failure Point | Rollback Action |
|--------------|-----------------|
| Validation failure | No changes made, return error |
| Copy failure | Delete partial target, keep source |
| Reindex failure | Delete target, restore index config |
| Verification failure | Delete target, restore index config, keep source |
| Any unexpected error | Full rollback to snapshot state |

**Rollback implementation**:

```typescript
interface MigrationSnapshot {
  brainConfig: BrainConfig;
  basicMemoryConfig: BasicMemoryConfig;
  sourceFiles: Map<string, string>; // path → checksum
}

async function rollback(snapshot: MigrationSnapshot, targetPath: string): Promise<void> {
  // 1. Remove target directory (if created)
  if (await pathExists(targetPath)) {
    await rmdir(targetPath, { recursive: true });
  }

  // 2. Restore basic-memory config
  await writeBasicMemoryConfig(snapshot.basicMemoryConfig);

  // 3. Trigger reindex to restore index state
  await basicMemory.reindex();

  // 4. Verify source files unchanged
  for (const [path, checksum] of snapshot.sourceFiles) {
    const currentChecksum = await computeChecksum(path);
    if (currentChecksum !== checksum) {
      throw new Error(`Source file modified during rollback: ${path}`);
    }
  }
}
```

### Verification Protocol

After migration, ALL memories MUST be verified via semantic search.

**Verification steps**:

```typescript
async function verifyMigration(
  migratedMemories: MigratedMemory[],
  project: string
): Promise<VerificationResult> {
  const failures: VerificationFailure[] = [];

  for (const memory of migratedMemories) {
    // 1. Search for memory by title
    const searchResults = await brain.search(memory.title, {
      project,
      limit: 1,
    });

    if (searchResults.length === 0) {
      failures.push({
        memory: memory.title,
        reason: 'Not found in search index',
      });
      continue;
    }

    // 2. Read memory content
    const content = await brain.readNote(memory.title, { project });

    // 3. Verify content integrity
    const contentHash = computeHash(content);
    if (contentHash !== memory.expectedHash) {
      failures.push({
        memory: memory.title,
        reason: 'Content mismatch after migration',
      });
    }
  }

  return {
    success: failures.length === 0,
    totalMemories: migratedMemories.length,
    verified: migratedMemories.length - failures.length,
    failures,
  };
}
```

### CLI and MCP Tool Parity

The Brain MCP server handles ALL migration logic. CLI delegates to MCP tools.

**Architecture**:

```text
User runs: brain projects myproject --memories-path CODE
            |
            v
TUI (apps/tui) parses command
            |
            v
TUI calls MCP tool: mcp__plugin_brain_brain__update_project_config
            |
            v
MCP server (apps/mcp) executes:
  - Validate paths
  - Execute migration transaction
  - Update basic-memory config
  - Verify indexing
  - Rollback on failure
            |
            v
MCP server returns result to TUI
            |
            v
TUI displays success/failure to user
```

**MCP Tool Definition**:

```typescript
// New MCP tool for config updates that may require migration
interface UpdateProjectConfigTool {
  name: 'update_project_config';
  parameters: {
    project: string;
    memories_path?: 'DEFAULT' | 'CODE' | string; // mode or explicit path
    memories_mode?: 'DEFAULT' | 'CODE' | 'CUSTOM';
    dry_run?: boolean; // Preview changes without executing
  };
  returns: {
    success: boolean;
    migration_performed: boolean;
    files_migrated?: number;
    source_path?: string;
    target_path?: string;
    verification_result?: VerificationResult;
    error?: string;
  };
}

// MCP tool for global config changes
interface UpdateGlobalConfigTool {
  name: 'update_global_config';
  parameters: {
    default_memories_location?: string;
    dry_run?: boolean;
  };
  returns: {
    success: boolean;
    projects_affected?: string[];
    migrations_performed?: number;
    total_files_migrated?: number;
    error?: string;
  };
}
```

### Dry-Run Mode

All migration operations MUST support dry-run mode for preview.

**Dry-run behavior**:

```bash
brain projects myproject --memories-path CODE --dry-run
```

**Output**:

```text
[DRY RUN] Config change would perform the following:

Source: ~/memories/myproject
Target: ~/Dev/myproject/docs

Files to migrate:
  - session-2026-01-15-01-topic.md (12.4 KB)
  - ADR-001-architecture.md (8.2 KB)
  - analysis-001-research.md (5.1 KB)
  ... (47 more files)

Total: 50 files, 342.7 KB

basic-memory index: Would be updated to new path
Verification: Would verify all 50 memories are searchable

To execute, run without --dry-run flag.
```

### Progress Reporting

Long migrations MUST report progress.

**Progress events**:

```typescript
interface MigrationProgress {
  phase: 'validate' | 'prepare' | 'copy' | 'reindex' | 'verify' | 'commit';
  current: number;
  total: number;
  currentFile?: string;
  bytesTransferred?: number;
  bytesTotal?: number;
}

// MCP tool streams progress via Server-Sent Events or polling
// TUI displays progress bar
```

**CLI progress display**:

```text
Migrating memories for project 'myproject'...

[VALIDATE] Checking paths... done
[PREPARE]  Creating target directory... done
[COPY]     Copying files: 47/50 (94%) - analysis-001-research.md
[REINDEX]  Updating basic-memory index... done
[VERIFY]   Verifying search: 48/50 (96%)
[COMMIT]   Cleaning up source... done

Migration complete: 50 files migrated successfully.
```

### Error Handling

| Error | User Message | Recovery |
|-------|-------------|----------|
| Source not found | `Error: Source path does not exist: {path}` | None needed |
| Target not writable | `Error: Cannot write to target: {path}` | Check permissions |
| Disk full | `Error: Insufficient space at target (need {X} MB)` | Free space or choose different target |
| Index failure | `Error: basic-memory failed to index new location` | Rollback automatic |
| Verification failure | `Error: {N} memories failed verification (see details)` | Rollback automatic |
| Partial copy | `Error: Copy interrupted, rolling back...` | Rollback automatic |

### Test Scenarios

| Scenario | Input | Expected Output |
|----------|-------|-----------------|
| DEFAULT → CODE | `--memories-path CODE` | Files move to `{code_path}/docs`, index updated |
| CODE → DEFAULT | `--memories-path DEFAULT` | Files move to `{memories_location}/{project}`, index updated |
| CODE → custom | `--memories-path /custom` | Files move to `/custom`, index updated |
| Global default change | `config set default-memories-location /new` | All DEFAULT-mode projects migrated |
| Dry run | `--dry-run` | Report shown, no changes made |
| Verification failure | Corrupt index | Rollback to source, error reported |
| Disk full | Target disk full | Rollback, error with space needed |
| Permission denied | Target not writable | Error before migration starts |
| Concurrent access | Two migrations same project | Lock prevents second, error returned |

### Implementation Location

All migration logic resides in MCP server:

| File | Purpose |
|------|---------|
| `apps/mcp/src/config/migration.ts` | Core migration logic (existing file, extend) |
| `apps/mcp/src/config/migration-transaction.ts` | Transaction and rollback logic (new) |
| `apps/mcp/src/config/migration-verify.ts` | Verification logic (new) |
| `apps/mcp/src/tools/config/update-project.ts` | MCP tool implementation (new) |
| `apps/mcp/src/tools/config/update-global.ts` | MCP tool implementation (new) |
| `apps/tui/cmd/projects.go` | CLI wrapper (update existing) |
| `apps/tui/cmd/config.go` | CLI wrapper (update existing) |

### Concurrency Control

Migrations MUST be serialized per project to prevent conflicts.

**Locking strategy**:

```typescript
// Lock file per project: ~/.config/brain/locks/{project}.lock
async function acquireMigrationLock(project: string): Promise<LockHandle> {
  const lockPath = join(configDir, 'locks', `${project}.lock`);
  const handle = await tryAcquireLock(lockPath, { timeout: 30000 });

  if (!handle) {
    throw new Error(`Migration already in progress for project: ${project}`);
  }

  return handle;
}
```

## Config File Watching (Manual Edit Detection)

### Problem Statement

Users may manually edit `~/.config/brain/config.json` outside of Brain CLI/MCP tools. For example:

```bash
# User opens config in editor
vim ~/.config/brain/config.json

# Changes: "memories_mode": "DEFAULT" -> "CODE" for project "myproject"
# Saves and closes
```

Without file watching, this manual edit would:

1. Create config/filesystem mismatch (memories in wrong location)
2. Break semantic search (basic-memory points to old path)
3. Require manual intervention to resync

Brain MCP MUST detect manual config edits and execute the same migration logic as CLI/MCP tools.

### Requirements

| Requirement | Priority | Description |
|-------------|----------|-------------|
| File watcher on config | MUST | Monitor `~/.config/brain/config.json` for changes |
| Config diff detection | MUST | Compare old vs new config to identify what changed |
| Transactional migration | MUST | Same rollback/verify logic as CLI/MCP tools |
| Validation before execution | MUST | Reject invalid JSON or schema violations |
| User notification | MUST | Log detected changes and migration results |
| Debouncing | SHOULD | Wait N seconds after last edit before processing |
| Opt-in/opt-out | SHOULD | Allow users to disable file watching |

### Design Decisions

**Q1: Should file watcher be always-on or opt-in?**

**Decision**: Always-on by default, opt-out via config setting.

**Rationale**: Users expect config changes to take effect immediately. Requiring explicit sync creates confusion. Power users who want manual control can disable via:

```json
{
  "watcher": {
    "enabled": false
  }
}
```

**Q2: How to handle multiple rapid edits?**

**Decision**: Debounce with 2-second delay after last change.

**Rationale**: Text editors often trigger multiple save events. Debouncing prevents unnecessary migration churn. 2 seconds balances responsiveness with stability.

**Q3: What if migration fails (invalid path)?**

**Decision**: Revert config file to last-known-good state.

**Rationale**: Config file represents intent. If intent cannot be executed, preserve working state. User sees error in logs with instructions.

**Q4: How to handle concurrent edits during migration?**

**Decision**: Lock config file during migration. Queue subsequent edits.

**Rationale**: Same locking strategy as CLI migrations prevents race conditions.

### Architecture

```text
~/.config/brain/config.json
            |
            v (file system event)
+-----------------------------+
|     ConfigFileWatcher       |
|  (chokidar/fs.watch)        |
+-----------------------------+
            |
            v (debounced, 2s)
+-----------------------------+
|     ConfigDiffDetector      |
|  - Compare old vs new       |
|  - Identify changed fields  |
|  - Classify change types    |
+-----------------------------+
            |
            v (if migration needed)
+-----------------------------+
|     ConfigValidator         |
|  - JSON syntax check        |
|  - Schema validation        |
|  - Path traversal check     |
+-----------------------------+
            |
            v (if valid)
+-----------------------------+
|     MigrationTransaction    |
|  - Same logic as CLI        |
|  - Rollback on failure      |
|  - Verify indexing          |
+-----------------------------+
            |
            v
+-----------------------------+
|     NotificationLogger      |
|  - Log to state file        |
|  - Console output (if tty)  |
+-----------------------------+
```

### Change Detection Matrix

| Config Field | Change Detection | Migration Required |
|--------------|------------------|-------------------|
| `projects.<n>.memories_mode` | Value changed | Yes |
| `projects.<n>.memories_path` | Value changed | Yes |
| `projects.<n>.code_path` | Value changed | No (metadata only) |
| `defaults.memories_location` | Value changed | Yes (all DEFAULT-mode projects) |
| `sync.enabled` | Value changed | No (runtime setting) |
| `sync.delay_ms` | Value changed | No (runtime setting) |
| `logging.level` | Value changed | No (runtime setting) |
| `watcher.enabled` | Value changed | No (watcher restart) |
| New project added | Project key added | No (created on first use) |
| Project removed | Project key removed | No (orphan cleanup separate) |

### Validation Pipeline

Manual edits MUST pass validation before migration executes.

**Step 1: JSON Syntax**

```typescript
function validateJsonSyntax(content: string): ValidationResult {
  try {
    JSON.parse(content);
    return { valid: true };
  } catch (e) {
    return {
      valid: false,
      error: `Invalid JSON: ${e.message}`,
      action: 'REVERT',
    };
  }
}
```

**Step 2: Schema Validation**

```typescript
import { z } from "zod";

const brainConfigSchema = z.object({
  version: z.literal("1.0"),
  defaults: z.object({
    memories_location: z.string(),
  }),
  projects: z.record(z.object({
    code_path: z.string(),
    memories_mode: z.enum(["DEFAULT", "CODE", "CUSTOM"]).optional(),
    memories_path: z.string().optional(),
  })),
  sync: z.object({
    delay_ms: z.number().optional(),
  }).optional(),
  logging: z.object({
    level: z.enum(["trace", "debug", "info", "warn", "error"]).optional(),
  }).optional(),
  watcher: z.object({
    enabled: z.boolean().optional(),
    debounce_ms: z.number().optional(),
  }).optional(),
});

async function validateSchema(config: unknown): Promise<ValidationResult> {
  const result = brainConfigSchema.safeParse(config);

  if (!result.success) {
    return {
      valid: false,
      error: `Schema violation: ${result.error.format()._errors.join(", ")}`,
      action: 'REVERT',
    };
  }

  return { valid: true };
}
```

**Step 3: Path Validation**

```typescript
async function validatePaths(config: BrainConfig): Promise<ValidationResult> {
  for (const [project, settings] of Object.entries(config.projects)) {
    // Reuse existing path validator from translation layer
    const pathResult = validatePath(settings.memories_path);
    if (!pathResult.valid) {
      return {
        valid: false,
        error: `Invalid path for project ${project}: ${pathResult.error}`,
        action: 'REVERT',
      };
    }
  }

  return { valid: true };
}
```

### Rollback Strategy

On validation or migration failure, revert config file to last-known-good state.

```typescript
interface ConfigSnapshot {
  content: string;
  checksum: string;
  timestamp: Date;
}

class ConfigRollbackManager {
  private lastKnownGood: ConfigSnapshot | null = null;

  /**
   * Initialize lastKnownGood on MCP server startup.
   * MUST be called during server initialization, NOT on first migration.
   * This ensures we always have a baseline for rollback.
   */
  async initialize(): Promise<void> {
    const configPath = getConfigPath();
    if (await pathExists(configPath)) {
      const content = await readFile(configPath, 'utf-8');
      // Validate before accepting as baseline
      try {
        const parsed = JSON.parse(content);
        await validateSchema(parsed);
        this.lastKnownGood = {
          content,
          checksum: computeChecksum(content),
          timestamp: new Date(),
        };
        logger.info('Config rollback manager initialized with current config');
      } catch (error) {
        // Invalid config at startup - create default
        const defaultConfig = createDefaultConfig();
        const defaultContent = JSON.stringify(defaultConfig, null, 2);
        await writeFileAtomic(configPath, defaultContent);
        this.lastKnownGood = {
          content: defaultContent,
          checksum: computeChecksum(defaultContent),
          timestamp: new Date(),
        };
        logger.warn({ error }, 'Invalid config at startup, created default');
      }
    } else {
      // No config exists - create default
      const defaultConfig = createDefaultConfig();
      const defaultContent = JSON.stringify(defaultConfig, null, 2);
      await ensureDir(dirname(configPath));
      await writeFileAtomic(configPath, defaultContent);
      this.lastKnownGood = {
        content: defaultContent,
        checksum: computeChecksum(defaultContent),
        timestamp: new Date(),
      };
      logger.info('Created default config, rollback manager initialized');
    }
  }

  // Called after successful migration
  markAsGood(content: string): void {
    this.lastKnownGood = {
      content,
      checksum: computeChecksum(content),
      timestamp: new Date(),
    };
  }

  // Called on failure
  async revert(): Promise<void> {
    if (!this.lastKnownGood) {
      throw new Error('No last-known-good config available');
    }

    await writeFileAtomic(CONFIG_PATH, this.lastKnownGood.content);
    logger.warn({
      reverted_to: this.lastKnownGood.timestamp,
    }, 'Config reverted to last-known-good state');
  }

  hasBaseline(): boolean {
    return this.lastKnownGood !== null;
  }
}
```

### Implementation

**File watcher** (TypeScript, MCP server):

```typescript
import { watch } from 'chokidar';

class ConfigFileWatcher {
  private watcher: FSWatcher | null = null;
  private debounceTimer: Timer | null = null;
  private readonly DEBOUNCE_MS = 2000;
  private lastConfig: BrainConfig | null = null;

  async start(): Promise<void> {
    const configPath = getConfigPath(); // ~/.config/brain/config.json

    // Load initial config as baseline
    this.lastConfig = await loadConfig();

    this.watcher = watch(configPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000, // Increased from 500ms per Round 2 review
        pollInterval: 100,
      },
    });

    this.watcher.on('change', () => this.handleChange());
    this.watcher.on('error', (error) => this.handleError(error));

    logger.info({ path: configPath }, 'Config file watcher started');
  }

  private handleChange(): void {
    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new debounce timer
    this.debounceTimer = setTimeout(
      () => this.processChange(),
      this.DEBOUNCE_MS
    );
  }

  private async processChange(): Promise<void> {
    try {
      const newConfig = await loadConfig();
      const diff = detectConfigDiff(this.lastConfig, newConfig);

      if (diff.requiresMigration) {
        logger.info({
          changes: diff.changes,
        }, 'Config change detected, executing migration');

        await executeMigrationFromDiff(diff, this.lastConfig, newConfig);
        this.lastConfig = newConfig;

        logger.info('Config change migration complete');
      } else if (diff.hasChanges) {
        // Non-migration changes (logging level, sync settings)
        this.lastConfig = newConfig;
        logger.debug({ changes: diff.changes }, 'Config updated (no migration needed)');
      }
    } catch (error) {
      logger.error({ error }, 'Config change processing failed, reverting');
      await this.rollback();
    }
  }

  private async rollback(): Promise<void> {
    if (this.lastConfig) {
      await writeConfigAtomic(this.lastConfig);
      logger.warn('Config reverted to previous state');
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
```

**Diff detection**:

```typescript
interface ConfigDiff {
  hasChanges: boolean;
  requiresMigration: boolean;
  changes: ConfigChange[];
}

interface ConfigChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  migrationRequired: boolean;
  affectedProjects: string[];
}

function detectConfigDiff(
  oldConfig: BrainConfig | null,
  newConfig: BrainConfig
): ConfigDiff {
  const changes: ConfigChange[] = [];

  if (!oldConfig) {
    return { hasChanges: true, requiresMigration: false, changes: [] };
  }

  // Check global defaults
  if (oldConfig.defaults.memories_location !== newConfig.defaults.memories_location) {
    const affectedProjects = Object.entries(newConfig.projects)
      .filter(([_, p]) => p.memories_mode === 'DEFAULT' || !p.memories_mode)
      .map(([name]) => name);

    changes.push({
      field: 'defaults.memories_location',
      oldValue: oldConfig.defaults.memories_location,
      newValue: newConfig.defaults.memories_location,
      migrationRequired: affectedProjects.length > 0,
      affectedProjects,
    });
  }

  // Check per-project settings
  for (const [project, newSettings] of Object.entries(newConfig.projects)) {
    const oldSettings = oldConfig.projects[project];

    if (!oldSettings) continue; // New project, no migration

    if (oldSettings.memories_mode !== newSettings.memories_mode) {
      changes.push({
        field: `projects.${project}.memories_mode`,
        oldValue: oldSettings.memories_mode,
        newValue: newSettings.memories_mode,
        migrationRequired: true,
        affectedProjects: [project],
      });
    }

    if (oldSettings.memories_path !== newSettings.memories_path) {
      changes.push({
        field: `projects.${project}.memories_path`,
        oldValue: oldSettings.memories_path,
        newValue: newSettings.memories_path,
        migrationRequired: true,
        affectedProjects: [project],
      });
    }
  }

  return {
    hasChanges: changes.length > 0,
    requiresMigration: changes.some(c => c.migrationRequired),
    changes,
  };
}
```

### Logging and Notification

Config change events logged to `~/.local/state/brain/config-changes.log`.

**Log format**:

```text
2026-01-31T14:30:00.000Z [INFO] Config change detected
  Source: file_watcher
  Changes:
    - projects.myproject.memories_mode: DEFAULT -> CODE
  Migration: STARTED
  Affected: 47 files in ~/memories/myproject

2026-01-31T14:30:05.000Z [INFO] Migration complete
  Source: ~/memories/myproject
  Target: ~/Dev/myproject/docs
  Files: 47
  Verification: PASS

2026-01-31T14:30:05.000Z [INFO] Config change applied successfully
```

**Error log example**:

```text
2026-01-31T14:30:00.000Z [ERROR] Config change validation failed
  Error: Invalid JSON at line 15: Unexpected token
  Action: REVERT
  Reverted to: 2026-01-31T14:25:00.000Z
```

### Edge Cases

| Edge Case | Handling |
|-----------|----------|
| **Concurrent edit during migration** | Lock file prevents. Edit queued until migration completes. |
| **Invalid JSON (syntax error)** | Validation rejects. Config reverted. Error logged. |
| **Invalid schema** | Validation rejects. Config reverted. Error logged. |
| **Multiple changes in one edit** | All changes processed in single transaction. All-or-nothing. |
| **Config file deleted** | Watcher detects. Creates default config. Logs warning. |
| **Config file corrupted** | JSON parse fails. Reverts to last-known-good. Logs error. |
| **Watcher disabled in config** | Watcher stops itself. Logs info. Requires restart to re-enable. |
| **Disk full during migration** | Transaction rollback. Source preserved. Error logged. |
| **Permission denied on target** | Validation fails. Config reverted. Error logged. |

### Integration with Existing Systems

**Reuse from Config Change Protocol**:

- `MigrationTransaction` class (same rollback logic)
- `verifyMigration()` function (same verification)
- Path validation (same security checks)
- Atomic file writes (same temp-file-then-rename)

**basic-memory compatibility**:

basic-memory already watches notes directories for changes. Config watching uses similar pattern:

- chokidar for cross-platform file watching
- Debouncing to handle editor save patterns
- Validation before processing

### Test Scenarios

| Scenario | Input | Expected Output |
|----------|-------|-----------------|
| Valid mode change | Edit memories_mode in config | Migration executes, files moved |
| Invalid JSON | Syntax error in config | Config reverted, error logged |
| Invalid path | Path traversal attempt | Config reverted, error logged |
| Rapid edits | 5 saves in 1 second | Single migration after debounce |
| Concurrent migration | Edit during CLI migration | Edit queued, processed after |
| Watcher disabled | Set watcher.enabled=false | Watcher stops, logs info |
| Config deleted | rm config.json | Default config created, warning logged |

### Implementation Location

| File | Purpose |
|------|---------|
| `apps/mcp/src/config/watcher.ts` | ConfigFileWatcher class (new) |
| `apps/mcp/src/config/diff.ts` | detectConfigDiff function (new) |
| `apps/mcp/src/config/rollback.ts` | ConfigRollbackManager class (new) |
| `apps/mcp/src/config/migration-transaction.ts` | Extend for watcher integration |
| `apps/mcp/src/index.ts` | Start watcher on MCP server init |

### Configuration Schema Extension

Add watcher settings to Brain config schema:

```json
{
  "watcher": {
    "enabled": true,
    "debounce_ms": 2000
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `watcher.enabled` | boolean | true | Enable config file watching |
| `watcher.debounce_ms` | number | 2000 | Milliseconds to wait after last edit |

## Round 2 P0 Fixes (Security and Critical Issues)

This section addresses all P0 blocking issues identified during Round 2 review.

### P0-1: TOCTOU Vulnerability Fix (Security - High)

**Issue**: Time-of-check to time-of-use race condition. Validation happens before lock acquisition, allowing config modification between validation and migration.

**Fix**: Extend lock scope to cover validation-through-migration atomically. Lock acquisition MUST happen before `loadConfig()`, and release MUST happen after migration completion.

**Implementation**:

```typescript
/**
 * TOCTOU-safe config change processor.
 * Lock wraps the ENTIRE operation: load -> validate -> migrate -> commit.
 */
async function processChangeAtomic(project: string): Promise<ProcessResult> {
  const lock = await acquireMigrationLock(project);

  try {
    // CRITICAL: All operations inside lock scope
    // 1. Load config AFTER acquiring lock
    const newConfig = await loadConfig();

    // 2. Validate AFTER load, still inside lock
    const validation = await validateConfig(newConfig);
    if (!validation.valid) {
      return { success: false, error: validation.error, action: 'REVERT' };
    }

    // 3. Compute diff
    const diff = detectConfigDiff(this.lastConfig, newConfig);
    if (!diff.requiresMigration) {
      this.lastConfig = newConfig;
      return { success: true, migrationPerformed: false };
    }

    // 4. Execute migration (still inside lock)
    const migrationResult = await executeMigrationFromDiff(diff, this.lastConfig, newConfig);

    // 5. Verify (still inside lock)
    const verifyResult = await verifyMigration(migrationResult.migratedMemories, project);
    if (!verifyResult.success) {
      await rollback(migrationResult.snapshot, migrationResult.targetPath);
      return { success: false, error: 'Verification failed', failures: verifyResult.failures };
    }

    // 6. Commit (still inside lock)
    await commitMigration(migrationResult);
    this.lastConfig = newConfig;
    rollbackManager.markAsGood(JSON.stringify(newConfig, null, 2));

    return { success: true, migrationPerformed: true, filesCount: migrationResult.fileCount };

  } finally {
    // Release lock only after all operations complete
    await lock.release();
  }
}
```

**Lock Scope Diagram**:

```text
[Lock Acquire] ─────────────────────────────────────────────────────┐
      │                                                              │
      ├─> loadConfig()                                               │
      │                                                              │
      ├─> validateConfig()                                           │
      │     ├─> JSON syntax check                                    │
      │     ├─> Schema validation                                    │
      │     └─> Path validation                                      │
      │                                                              │
      ├─> detectConfigDiff()                                         │
      │                                                              │
      ├─> executeMigration()                                         │
      │     ├─> Copy files                                           │
      │     ├─> Update basic-memory config                           │
      │     └─> Trigger reindex                                      │
      │                                                              │
      ├─> verifyMigration()                                          │
      │                                                              │
      ├─> commitMigration() OR rollback()                            │
      │                                                              │
[Lock Release] ─────────────────────────────────────────────────────┘
```

### P0-2: Multi-Project Race Condition Fix (Security - High)

**Issue**: When `default_memories_location` changes, ALL projects using DEFAULT mode must migrate. Without global locking, concurrent project migrations can corrupt state.

**Fix**: Implement two-level lock hierarchy. Global lock MUST be acquired before any project-level locks when `default_memories_location` changes.

**Lock Hierarchy**:

```text
Global Lock (default_memories_location changes)
    │
    ├── Project Lock: project-a
    ├── Project Lock: project-b
    └── Project Lock: project-c
```

**Implementation**:

```typescript
const GLOBAL_LOCK_PATH = join(configDir, 'locks', 'global.lock');
const PROJECT_LOCK_PATH = (project: string) => join(configDir, 'locks', `${project}.lock`);

interface LockHandle {
  release(): Promise<void>;
}

/**
 * Acquire global lock for operations affecting multiple projects.
 * MUST be acquired before any project locks when default_memories_location changes.
 */
async function acquireGlobalLock(timeout: number = 60000): Promise<LockHandle> {
  await ensureDir(dirname(GLOBAL_LOCK_PATH));
  const handle = await tryAcquireLock(GLOBAL_LOCK_PATH, { timeout });

  if (!handle) {
    throw new Error('Global migration already in progress. Wait and retry.');
  }

  return handle;
}

/**
 * Acquire project-level lock.
 * If caller holds global lock, project locks are acquired in sequence.
 */
async function acquireProjectLock(project: string, timeout: number = 30000): Promise<LockHandle> {
  const lockPath = PROJECT_LOCK_PATH(project);
  await ensureDir(dirname(lockPath));
  const handle = await tryAcquireLock(lockPath, { timeout });

  if (!handle) {
    throw new Error(`Migration already in progress for project: ${project}`);
  }

  return handle;
}

/**
 * Process global config change affecting multiple projects.
 */
async function processGlobalConfigChange(
  oldConfig: BrainConfig,
  newConfig: BrainConfig
): Promise<GlobalMigrationResult> {
  // 1. Acquire global lock FIRST
  const globalLock = await acquireGlobalLock();

  try {
    // 2. Identify affected projects
    const affectedProjects = Object.entries(newConfig.projects)
      .filter(([_, p]) => p.memories_mode === 'DEFAULT' || !p.memories_mode)
      .map(([name]) => name);

    logger.info({ projects: affectedProjects }, 'Global config change affects projects');

    // 3. Acquire all project locks (sequential, deterministic order)
    const projectLocks: Array<{ project: string; lock: LockHandle }> = [];
    const sortedProjects = [...affectedProjects].sort(); // Deterministic order prevents deadlock

    for (const project of sortedProjects) {
      const projectLock = await acquireProjectLock(project);
      projectLocks.push({ project, lock: projectLock });
    }

    try {
      // 4. Execute all migrations under global + project locks
      const results: ProjectMigrationResult[] = [];

      for (const project of sortedProjects) {
        const result = await migrateProjectMemories(
          project,
          oldConfig.defaults.memories_location,
          newConfig.defaults.memories_location
        );
        results.push(result);

        // If any project fails, rollback ALL and abort
        if (!result.success) {
          logger.error({ project, error: result.error }, 'Project migration failed, rolling back all');
          await rollbackGlobalMigration(results);
          throw new Error(`Global migration failed at project ${project}: ${result.error}`);
        }
      }

      // 5. All succeeded - commit
      return {
        success: true,
        projectsAffected: affectedProjects,
        totalFilesMigrated: results.reduce((sum, r) => sum + (r.filesMigrated || 0), 0),
      };

    } finally {
      // Release project locks in reverse order
      for (const { lock } of projectLocks.reverse()) {
        await lock.release();
      }
    }

  } finally {
    // Release global lock last
    await globalLock.release();
  }
}
```

**Deadlock Prevention**: Project locks are always acquired in sorted alphabetical order to prevent ABBA deadlock.

### P0-3: Partial Write Race Fix (Critic)

**Issue**: Editor may trigger change event before file write completes. Reading partially-written file corrupts state.

**Fix**: Three-layer defense:
1. Increase `awaitWriteFinish.stabilityThreshold` to 1000ms (already applied above)
2. Add checksum verification after read
3. Skip processing if integrity check fails

**Implementation**:

```typescript
interface ConfigWithChecksum {
  config: BrainConfig;
  checksum: string;
  raw: string;
}

/**
 * Load config with integrity verification.
 * Returns null if file is still being written or corrupted.
 */
async function loadConfigWithIntegrity(): Promise<ConfigWithChecksum | null> {
  const configPath = getConfigPath();

  // Read file content
  const content = await readFile(configPath, 'utf-8');

  // Compute checksum
  const checksum = computeChecksum(content);

  // Brief delay then re-read to verify file is stable
  await sleep(50);
  const contentVerify = await readFile(configPath, 'utf-8');
  const checksumVerify = computeChecksum(contentVerify);

  // If checksums differ, file is still being written
  if (checksum !== checksumVerify) {
    logger.debug('Config file still being written, skipping this change event');
    return null;
  }

  // Parse and validate
  try {
    const parsed = JSON.parse(content);
    return { config: parsed, checksum, raw: content };
  } catch (error) {
    logger.warn({ error }, 'Config file has invalid JSON, waiting for next stable write');
    return null;
  }
}

/**
 * Updated processChange to use integrity verification.
 */
private async processChange(): Promise<void> {
  // Load with integrity check
  const loaded = await loadConfigWithIntegrity();
  if (loaded === null) {
    // File not stable, debounce will trigger another check
    return;
  }

  // Verify checksum matches what we expect (detect mid-read corruption)
  const recheck = computeChecksum(await readFile(getConfigPath(), 'utf-8'));
  if (recheck !== loaded.checksum) {
    logger.debug('Config changed during processing, skipping');
    return;
  }

  // Proceed with validated config
  const diff = detectConfigDiff(this.lastConfig, loaded.config);
  // ... rest of processing
}
```

### P0-4: lastKnownGood Initialization Fix (Critic)

**Issue**: `lastKnownGood` was only set after first successful migration. If first operation fails, no baseline exists for rollback.

**Fix**: Initialize `lastKnownGood` on MCP server startup with current config as baseline.

**Implementation**: See updated `ConfigRollbackManager.initialize()` method above in the Rollback Strategy section.

**MCP Server Startup Integration**:

```typescript
// apps/mcp/src/index.ts
import { ConfigRollbackManager } from './config/rollback';
import { ConfigFileWatcher } from './config/watcher';

const rollbackManager = new ConfigRollbackManager();
const configWatcher = new ConfigFileWatcher(rollbackManager);

async function startMCPServer(): Promise<void> {
  // CRITICAL: Initialize rollback manager FIRST
  await rollbackManager.initialize();

  // Verify we have a baseline
  if (!rollbackManager.hasBaseline()) {
    throw new Error('Failed to initialize config rollback baseline');
  }

  // Start file watcher AFTER rollback manager is ready
  await configWatcher.start();

  // ... rest of MCP server initialization
}
```

### P0-5: Partial File Copy Tracking Fix (Critic)

**Issue**: If migration interrupts during file copy phase, some files are copied, some are not. No tracking exists to know which files completed.

**Fix**: Implement `CopyManifest` to track completed/pending files with checksums for integrity verification.

**Implementation**:

```typescript
interface CopyManifestEntry {
  sourcePath: string;
  targetPath: string;
  sourceChecksum: string;
  targetChecksum: string | null; // null if not yet copied
  status: 'pending' | 'copied' | 'verified' | 'failed';
  copiedAt: Date | null;
  error: string | null;
}

interface CopyManifest {
  migrationId: string;
  project: string;
  sourceRoot: string;
  targetRoot: string;
  startedAt: Date;
  entries: CopyManifestEntry[];
}

/**
 * Create manifest before starting copy.
 * Manifest is persisted to disk for crash recovery.
 */
async function createCopyManifest(
  project: string,
  sourceRoot: string,
  targetRoot: string,
  files: string[]
): Promise<CopyManifest> {
  const migrationId = `migration-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const entries: CopyManifestEntry[] = await Promise.all(
    files.map(async (file) => ({
      sourcePath: join(sourceRoot, file),
      targetPath: join(targetRoot, file),
      sourceChecksum: await computeFileChecksum(join(sourceRoot, file)),
      targetChecksum: null,
      status: 'pending' as const,
      copiedAt: null,
      error: null,
    }))
  );

  const manifest: CopyManifest = {
    migrationId,
    project,
    sourceRoot,
    targetRoot,
    startedAt: new Date(),
    entries,
  };

  // Persist manifest to disk for crash recovery
  const manifestPath = getManifestPath(migrationId);
  await writeFileAtomic(manifestPath, JSON.stringify(manifest, null, 2));

  return manifest;
}

/**
 * Update manifest entry after successful copy.
 */
async function markEntryCopied(
  manifest: CopyManifest,
  entry: CopyManifestEntry
): Promise<void> {
  entry.status = 'copied';
  entry.copiedAt = new Date();
  entry.targetChecksum = await computeFileChecksum(entry.targetPath);

  // Persist updated manifest
  await writeFileAtomic(getManifestPath(manifest.migrationId), JSON.stringify(manifest, null, 2));
}

/**
 * Verify copied file integrity.
 */
async function verifyEntry(entry: CopyManifestEntry): Promise<boolean> {
  if (entry.status !== 'copied') {
    return false;
  }

  const actualChecksum = await computeFileChecksum(entry.targetPath);
  if (actualChecksum !== entry.sourceChecksum) {
    entry.status = 'failed';
    entry.error = `Checksum mismatch: expected ${entry.sourceChecksum}, got ${actualChecksum}`;
    return false;
  }

  entry.status = 'verified';
  return true;
}

/**
 * Rollback partial copy using manifest.
 * Removes only files that were actually copied.
 */
async function rollbackPartialCopy(manifest: CopyManifest): Promise<RollbackResult> {
  const removedFiles: string[] = [];
  const errors: string[] = [];

  for (const entry of manifest.entries) {
    if (entry.status === 'copied' || entry.status === 'verified' || entry.status === 'failed') {
      // File was copied (or attempted) - remove it
      try {
        if (await pathExists(entry.targetPath)) {
          await rm(entry.targetPath);
          removedFiles.push(entry.targetPath);
        }
      } catch (error) {
        errors.push(`Failed to remove ${entry.targetPath}: ${error.message}`);
      }
    }
    // 'pending' entries were never copied - nothing to rollback
  }

  // Remove target directory if empty
  try {
    const targetContents = await readdir(manifest.targetRoot);
    if (targetContents.length === 0) {
      await rmdir(manifest.targetRoot);
    }
  } catch (error) {
    // Directory may not exist or not be empty - acceptable
  }

  // Remove manifest file
  await rm(getManifestPath(manifest.migrationId)).catch(() => {});

  return {
    success: errors.length === 0,
    removedFiles,
    errors,
  };
}

/**
 * Recover from interrupted migration on startup.
 * Checks for incomplete manifests and rolls back.
 */
async function recoverIncompleteMigrations(): Promise<void> {
  const manifestDir = getManifestDir();
  if (!await pathExists(manifestDir)) {
    return;
  }

  const files = await readdir(manifestDir);
  const manifestFiles = files.filter(f => f.startsWith('migration-') && f.endsWith('.json'));

  for (const file of manifestFiles) {
    const manifestPath = join(manifestDir, file);
    try {
      const content = await readFile(manifestPath, 'utf-8');
      const manifest: CopyManifest = JSON.parse(content);

      // Check if migration completed
      const allVerified = manifest.entries.every(e => e.status === 'verified');
      if (!allVerified) {
        logger.warn({ migrationId: manifest.migrationId }, 'Found incomplete migration, rolling back');
        await rollbackPartialCopy(manifest);
      } else {
        // Completed manifest - clean up
        await rm(manifestPath);
      }
    } catch (error) {
      logger.error({ file, error }, 'Failed to process manifest, removing');
      await rm(manifestPath).catch(() => {});
    }
  }
}
```

### P0-6: Effort Estimates Update (Analyst)

**Issue**: File-watching components lacked explicit time estimates.

**Updated Effort Estimates**:

| Component | Estimated Effort | Notes |
|-----------|-----------------|-------|
| `brain-config.ts` (read/write) | 4 hours | JSON parsing, schema validation |
| `translation-layer.ts` | 6 hours | Field mapping, one-way sync |
| `migration.ts` (initial) | 8 hours | Phase 1-5 migration logic |
| `migration-transaction.ts` | 8 hours | Transactional wrapper, rollback |
| `migration-verify.ts` | 4 hours | Indexing verification |
| `path-validator.ts` | 3 hours | Security validation |
| `schema.ts` | 2 hours | Zod schema definition (no learning curve, already used in Brain) |
| **watcher.ts** | 6 hours | chokidar setup, debouncing, event handling |
| **diff.ts** | 4 hours | Config comparison, change detection |
| **rollback.ts** | 6 hours | Snapshot management, revert logic, initialization |
| **lock.ts** | 4 hours | Global + project locking, deadlock prevention |
| **copy-manifest.ts** | 6 hours | Manifest tracking, checksums, recovery |
| TUI config commands | 8 hours | Go CLI implementation |
| TUI migrate commands | 6 hours | Go CLI wrapper |
| Unit tests | 16 hours | Per coverage targets |
| Integration tests | 12 hours | End-to-end scenarios |
| Security tests | 6 hours | Path traversal, permissions |
| Documentation | 4 hours | CLI help, migration guide |
| **Total** | **113 hours** | ~14 person-days |

### P0-7: Queue Behavior Documentation (Analyst)

**Issue**: Behavior undefined when edit detected during active migration.

**Queue Behavior Specification**:

When a config file change is detected during an active migration:

1. **Detection**: Watcher detects change event
2. **Queue**: Change is queued (not processed immediately)
3. **Wait**: System waits for current migration to complete
4. **Process**: After current migration releases lock, queued change triggers new migration cycle

**Implementation**:

```typescript
class ConfigFileWatcher {
  private pendingChange: boolean = false;
  private migrationInProgress: boolean = false;

  private handleChange(): void {
    if (this.migrationInProgress) {
      // Queue the change - will process after current migration
      this.pendingChange = true;
      logger.debug('Change detected during migration, queued for processing');
      return;
    }

    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new debounce timer
    this.debounceTimer = setTimeout(
      () => this.processChangeWithQueue(),
      this.DEBOUNCE_MS
    );
  }

  private async processChangeWithQueue(): Promise<void> {
    this.migrationInProgress = true;

    try {
      await this.processChangeAtomic();
    } finally {
      this.migrationInProgress = false;

      // Check if another change was queued during migration
      if (this.pendingChange) {
        this.pendingChange = false;
        logger.info('Processing queued config change');
        // Restart debounce for queued change
        this.debounceTimer = setTimeout(
          () => this.processChangeWithQueue(),
          this.DEBOUNCE_MS
        );
      }
    }
  }
}
```

**Queue Behavior Matrix**:

| Scenario | Action |
|----------|--------|
| Edit while idle | Debounce, then process |
| Edit during debounce | Reset debounce timer |
| Edit during migration | Queue, process after migration completes |
| Multiple edits during migration | Single queued change (latest config wins) |
| Edit during rollback | Queue, process after rollback completes |

### P0-8: Bun Runtime Requirements (Analyst)

**Issue**: Minimum Bun version and chokidar compatibility not documented.

**Runtime Requirements**:

| Dependency | Minimum Version | Recommended | Notes |
|------------|----------------|-------------|-------|
| **Bun** | 1.0.x | 1.1.x | Brain uses Bun runtime for performance and TypeScript support |
| **chokidar** | 4.x | 4.0.x | Bun-compatible via Node.js API compatibility layer |

**Compatibility Notes**:

1. **Bun 1.0.x**: Minimum for stable Node.js API compatibility and native TypeScript support
2. **Bun 1.1.x**: Recommended for improved performance and bug fixes
3. **chokidar 4.x**: Works with Bun through Node.js API compatibility. Bun implements fs.watch and related APIs that chokidar depends on.
4. **chokidar 5.x**: Not yet released. Will evaluate Bun compatibility when available.

**Package.json Requirements**:

```json
{
  "engines": {
    "bun": ">=1.0.0"
  },
  "dependencies": {
    "chokidar": "^4.0.0"
  }
}
```

**CI Matrix**:

```yaml
strategy:
  matrix:
    bun-version: [1.0.x, 1.1.x]
```

## Reversibility Assessment

- [x] **Rollback capability**: Config files can be reverted; migration includes full rollback on failure
- [x] **Vendor lock-in**: None (internal architecture change)
- [x] **Exit strategy**: N/A (internal tooling)
- [x] **Legacy impact**: One-time migration; .agents/ deprecated entirely
- [x] **Data migration**: Memories remain in same format, only location changes; live reconfig includes verification

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
- [Zod TypeScript Schema Validator](https://zod.dev/)
- [chokidar](https://github.com/paulmillr/chokidar) (cross-platform file watching)
- Analyst findings: Brain memory `analysis-001-configuration-architecture`
- Analysis-037: Embedding Catch-Up Requirements (file watching patterns)

### Review Schedule

Review at 14 days post-implementation:

- Migration completion rate
- Indexing verification pass rate
- User feedback on new CLI
- Translation layer reliability
- Agent update completion
