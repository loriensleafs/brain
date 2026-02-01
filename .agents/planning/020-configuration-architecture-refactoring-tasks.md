# Implementation Task Breakdown: ADR-020 Configuration Architecture Refactoring

**ADR Reference**: .agents/architecture/decision/ADR-020-configuration-architecture-refactoring.md
**Created**: 2026-01-31
**Updated**: 2026-01-31 (Round 2 additions - file-watching, CopyManifest, global lock)
**Status**: Ready for Implementation

## Overview

This task breakdown implements ADR-020, which refactors Brain's configuration architecture to hide basic-memory implementation details, adopt XDG-compliant paths, align terminology with "memories" (not "notes"), and migrate all .agents/ content into Brain's searchable memory system.

**Round 2 Additions**:
- File-watching capability (watcher.ts, diff.ts, rollback.ts)
- Config change protocol (live reconfiguration)
- CopyManifest for partial copy tracking
- Global lock for multi-project operations
- Checksum verification for config integrity
- Bun runtime (not Node.js)

### Critical Path Priority

- **P0**: Translation layer, .agents/ migration, agent/skill updates, file-watching (blocks all other features)
- **P1**: CLI config commands (user-facing, but can follow P0)

---

## P0: Translation Layer Implementation

### TASK-020-01: Create Brain Config Schema and Validator

**Priority**: P0
**Estimated Effort**: 2-3 hours
**Dependencies**: None
**Category**: TypeScript (MCP)
**Runtime**: Bun

**Description**:
Create TypeScript schema definitions and validation for Brain's config format at `~/.config/brain/config.json` using Zod.

**Deliverables**:
- [ ] `apps/mcp/src/config/schema.ts` - Zod schema definitions and TypeScript types
- [ ] `apps/mcp/src/config/validator.ts` - Zod-based validation logic

**Technology Note**: Uses Zod (already in dependencies at v3.25.0, used across 14 Brain files). No learning curve, consistent with existing codebase patterns.

**Schema Definition**:
```typescript
import { z } from "zod";

const MemoriesModeSchema = z.enum(["DEFAULT", "CODE", "CUSTOM"]);
const LogLevelSchema = z.enum(["trace", "debug", "info", "warn", "error"]);

const ProjectConfigSchema = z.object({
  code_path: z.string(),
  memories_path: z.string().optional(),
  memories_mode: MemoriesModeSchema.optional(),
});

const BrainConfigSchema = z.object({
  $schema: z.string(),
  version: z.literal("2.0.0"),
  defaults: z.object({
    memories_location: z.string(),
    memories_mode: MemoriesModeSchema,
  }),
  projects: z.record(z.string(), ProjectConfigSchema),
  sync: z.object({
    enabled: z.boolean(),
    delay_ms: z.number(),
  }),
  logging: z.object({
    level: LogLevelSchema,
  }),
});

type BrainConfig = z.infer<typeof BrainConfigSchema>;
```

**Acceptance Criteria**:
- [ ] Zod schema validates all required fields
- [ ] Type inference via `z.infer<typeof BrainConfigSchema>` works correctly
- [ ] Validator using `safeParse()` rejects invalid configs (missing fields, wrong types)
- [ ] Validator accepts valid configs
- [ ] Unit tests: 95% coverage
  - Valid config passes validation
  - Missing required fields rejected with typed errors
  - Invalid enum values rejected (memories_mode, logging.level)
  - Invalid path formats rejected

**Test Cases**:
- Valid config with all fields
- Missing `version` field (FAIL)
- Invalid `memories_mode` value (FAIL)
- Invalid `logging.level` value (FAIL)
- Empty `projects` object (PASS)

---

### TASK-020-02: Implement Path Validation Utilities

**Priority**: P0
**Estimated Effort**: 2-3 hours
**Dependencies**: None
**Category**: TypeScript (MCP)
**Runtime**: Bun

**Description**:
Create security-focused path validation utilities to prevent directory traversal, null bytes, and system path access.

**Deliverables**:
- [ ] `apps/mcp/src/config/path-validator.ts` - Path validation functions

**Validation Rules**:
1. Reject paths containing `..` (directory traversal)
2. Reject absolute paths to system directories (`/etc`, `/usr`, `/var`, `C:\Windows`)
3. Reject paths with null bytes (`\0`)
4. Expand `~` to user home directory
5. Normalize paths (resolve `.` and symlinks)
6. Reject paths outside user-accessible directories

**Acceptance Criteria**:
- [ ] `validatePath(path: string): ValidationResult` function
- [ ] `normalizePath(path: string): string` function
- [ ] `expandTilde(path: string): string` function
- [ ] Unit tests: 95% coverage
  - Valid paths pass (`~/memories`, `/Users/peter/memories`)
  - Directory traversal rejected (`~/memories/../etc`)
  - System paths rejected (`/etc/passwd`, `C:\Windows`)
  - Null bytes rejected (`~/memories\0/bad`)
  - Tilde expansion works (`~` -> `/Users/peter`)

**Test Cases**:
- `~/memories` → Valid
- `/Users/peter/memories` → Valid
- `../etc/passwd` → Invalid (traversal)
- `/etc/passwd` → Invalid (system path)
- `C:\Windows` → Invalid (system path)
- `~/memories\0` → Invalid (null byte)
- `.` → Valid (resolves to CWD)

---

### TASK-020-03: Create BrainConfig Read/Write Module

**Priority**: P0
**Estimated Effort**: 4-5 hours
**Dependencies**: TASK-020-01, TASK-020-02
**Category**: TypeScript (MCP)
**Runtime**: Bun

**Description**:
Implement atomic config read/write operations for `~/.config/brain/config.json` with file locking, temp files, and error handling.

**Deliverables**:
- [ ] `apps/mcp/src/config/brain-config.ts` - Config CRUD operations

**Functions**:
```typescript
function loadBrainConfig(): BrainConfig;
function saveBrainConfig(config: BrainConfig): void;
function getBrainConfigPath(): string;
function initBrainConfig(): void; // Create with defaults if missing
```

**Atomicity Requirements**:
1. Write to `config.json.tmp`
2. Validate JSON structure via schema
3. Atomic rename: `rename(config.json.tmp, config.json)`
4. On failure: remove temp file, throw error

**File Permissions**:
- `~/.config/brain/` → 0700
- `~/.config/brain/config.json` → 0600

**Acceptance Criteria**:
- [ ] `loadBrainConfig()` reads from `~/.config/brain/config.json`
- [ ] `saveBrainConfig()` uses atomic write (temp + rename)
- [ ] Missing config returns defaults (not error)
- [ ] Invalid JSON throws error with details
- [ ] Schema validation failures throw error
- [ ] File permissions set correctly (0700 dir, 0600 file)
- [ ] Unit tests: 90% coverage
  - Load existing config
  - Load missing config (returns defaults)
  - Save new config
  - Save overwrites existing
  - Invalid JSON rejected
  - Schema validation failures rejected
  - Atomic write verified (temp file cleaned up)

**Test Cases**:
- Load missing config → defaults returned
- Load valid config → parsed config
- Load invalid JSON → error with parse details
- Save config → atomic write, correct permissions
- Save fails mid-write → temp file cleaned up

---

### TASK-020-04: Implement Translation Layer

**Priority**: P0
**Estimated Effort**: 4-5 hours
**Dependencies**: TASK-020-03
**Category**: TypeScript (MCP)
**Runtime**: Bun

**Description**:
Create one-way translation from Brain config to basic-memory config with field mapping and error handling.

**Deliverables**:
- [ ] `apps/mcp/src/config/translation-layer.ts` - Translation logic

**Functions**:
```typescript
function translateBrainToBasicMemory(brainConfig: BrainConfig): BasicMemoryConfig;
function syncToBasicMemory(brainConfig: BrainConfig): void;
```

**Field Mapping**:
| Brain Field | basic-memory Field | Transform |
|-------------|-------------------|-----------|
| `defaults.memories_location` | (none) | Brain-only |
| `projects.<n>.memories_path` | `projects.<n>` | Path only |
| `projects.<n>.code_path` | (none) | Brain-only |
| `projects.<n>.memories_mode` | (none) | Resolved before sync |
| `sync.enabled` | `sync_changes` | Direct map |
| `sync.delay_ms` | `sync_delay` | Direct map |
| `logging.level` | `log_level` | Direct map |

**Memories Mode Resolution**:
- `DEFAULT`: `${memories_location}/${project_name}`
- `CODE`: `${code_path}/docs`
- `CUSTOM`: Explicit `memories_path` value

**Acceptance Criteria**:
- [ ] Translation maps all fields correctly
- [ ] Mode resolution works for DEFAULT, CODE, CUSTOM
- [ ] basic-memory config written atomically
- [ ] Sync failures logged but don't block Brain config update
- [ ] Unit tests: 90% coverage
  - DEFAULT mode resolves correctly
  - CODE mode resolves correctly
  - CUSTOM mode uses explicit path
  - Field mapping verified
  - Sync success updates basic-memory config
  - Sync failure logs warning but continues

**Test Cases**:
- DEFAULT mode: `~/memories` + `brain` → `~/memories/brain`
- CODE mode: `/Users/peter/Dev/brain` → `/Users/peter/Dev/brain/docs`
- CUSTOM mode: `~/custom/path` → `~/custom/path`
- Sync enabled: `true` → `sync_changes: true`
- Sync delay: `500` → `sync_delay: 500`

---

### TASK-020-05: Update Hardcoded `~/memories` References

**Priority**: P0
**Estimated Effort**: 2 hours
**Dependencies**: TASK-020-03
**Category**: TypeScript (MCP)
**Runtime**: Bun

**Description**:
Replace 7 hardcoded `~/memories` fallback instances with config reads.

**Files to Update**:
| File | Line | Current | Action |
|------|------|---------|--------|
| `apps/mcp/src/project/config.ts` | 43 | `"~/memories"` | Read from Brain config |
| `apps/mcp/src/project/config.ts` | 50 | `"~/memories"` | Read from Brain config |
| `apps/mcp/src/tools/projects/create/index.ts` | 30 | `"~/memories"` | Read from Brain config |
| `apps/mcp/src/tools/projects/create/index.ts` | 35 | `"~/memories"` | Read from Brain config |
| `apps/mcp/src/tools/projects/edit/index.ts` | 345 | `"~/memories"` | Read from Brain config |
| `apps/mcp/src/tools/projects/edit/index.ts` | 350 | `"~/memories"` | Read from Brain config |

**Acceptance Criteria**:
- [ ] All 6 instances replaced with config reads
- [ ] Test files keep hardcoded values (fixture data)
- [ ] Default value from config: `defaults.memories_location`
- [ ] Unit tests updated to inject config
- [ ] Integration tests verify config reading

**Test Cases**:
- Config has `memories_location: "~/custom"` → uses `~/custom`
- Config missing → fallback to `~/memories`

---

### TASK-020-06: Rename Terminology (notes → memories)

**Priority**: P0
**Estimated Effort**: 3-4 hours
**Dependencies**: TASK-020-03, TASK-020-05
**Category**: TypeScript (MCP)
**Runtime**: Bun

**Description**:
Rename all `notes_path`, `default_notes_path`, and related terminology to `memories_*` across TypeScript codebase.

**Files to Update**:
| File | Changes |
|------|---------|
| `apps/mcp/src/project/config.ts` | `default_notes_path` → `default_memories_location` |
| `apps/mcp/src/tools/projects/create/schema.ts` | `notes_path` → `memories_path` |
| `apps/mcp/src/tools/projects/create/index.ts` | `getDefaultNotesPath()` → `getDefaultMemoriesLocation()` |
| `apps/mcp/src/tools/projects/edit/schema.ts` | `notes_path` → `memories_path` |
| `apps/mcp/src/tools/projects/edit/index.ts` | All `notes_path` references |
| Test files (`*.test.ts`) | All `notes_path` references |

**Acceptance Criteria**:
- [ ] All TypeScript files updated
- [ ] Schema definitions updated
- [ ] Function names updated
- [ ] Variable names updated
- [ ] Test files updated
- [ ] All tests pass after rename
- [ ] No grep hits for `notes_path` in TypeScript (except comments)

**Verification Command**:
```bash
grep -r "notes_path" apps/mcp/src --include="*.ts" | grep -v "// Legacy:"
```

**Test Cases**:
- Grep returns zero results (excluding legacy comments)
- All unit tests pass
- All integration tests pass

---

### TASK-020-07: Add Translation Layer Unit Tests

**Priority**: P0
**Estimated Effort**: 3 hours
**Dependencies**: TASK-020-04, TASK-020-06
**Category**: TypeScript (MCP)
**Runtime**: Bun

**Description**:
Comprehensive unit tests for translation layer covering all field mappings, mode resolution, and error cases.

**Test File**:
- [ ] `apps/mcp/src/config/__tests__/translation-layer.test.ts`

**Test Coverage** (target: 90%):
- [ ] DEFAULT mode resolution
- [ ] CODE mode resolution
- [ ] CUSTOM mode resolution
- [ ] Field mapping (all fields)
- [ ] Missing projects (empty object)
- [ ] Sync enabled/disabled
- [ ] Sync delay values
- [ ] Logging levels
- [ ] basic-memory write success
- [ ] basic-memory write failure (logged, continues)
- [ ] Path expansion (tilde)
- [ ] Path normalization

**Acceptance Criteria**:
- [ ] All test cases pass
- [ ] Code coverage: 90%+
- [ ] Edge cases covered (empty projects, missing fields)

---

## P0: File-Watching & Live Reconfiguration

### TASK-020-22: Implement Config File Watcher

**Priority**: P0
**Estimated Effort**: 6 hours
**Dependencies**: TASK-020-03, TASK-020-04
**Category**: TypeScript (MCP)
**Runtime**: Bun

**Description**:
Implement ConfigFileWatcher class using chokidar to detect manual edits to `~/.config/brain/config.json` and trigger live reconfiguration.

**Deliverables**:
- [ ] `apps/mcp/src/config/watcher.ts` - ConfigFileWatcher class

**Features**:
```typescript
class ConfigFileWatcher {
  private watcher: FSWatcher | null = null;
  private debounceTimer: Timer | null = null;
  private readonly DEBOUNCE_MS = 2000;
  private lastConfig: BrainConfig | null = null;

  start(): void;
  stop(): void;
  private handleChange(): void;
  private validateAndApply(newConfig: BrainConfig): Promise<void>;
}
```

**Behavior**:
1. Watch `~/.config/brain/config.json` for changes
2. Debounce events (2 seconds) to avoid editor chunked writes
3. Validate new config via schema validator
4. Detect config diff using `diff.ts`
5. If migration in progress: queue change for later
6. If valid: trigger reconfiguration
7. If invalid: log error, rollback to last known good

**Acceptance Criteria**:
- [ ] Watcher starts on MCP server init
- [ ] Debouncing handles editor chunked writes
- [ ] Schema validation prevents invalid configs
- [ ] Config diff detection works correctly
- [ ] Queued changes processed after migration completes
- [ ] Unit tests: 90% coverage
  - Start/stop watcher
  - Debouncing behavior
  - Valid config accepted
  - Invalid config rejected + rollback
  - Queue behavior during migration

**Test Cases**:
- Valid edit → reconfiguration triggered
- Invalid edit → rejected, last known good restored
- Edit during migration → queued, processed after
- Multiple rapid edits → debounced to single processing

---

### TASK-020-23: Implement Config Diff Detection

**Priority**: P0
**Estimated Effort**: 4 hours
**Dependencies**: TASK-020-03
**Category**: TypeScript (MCP)
**Runtime**: Bun

**Description**:
Implement config diff detection to identify which projects/fields changed between config versions.

**Deliverables**:
- [ ] `apps/mcp/src/config/diff.ts` - detectConfigDiff function

**Functions**:
```typescript
interface ConfigDiff {
  projectsAdded: string[];
  projectsRemoved: string[];
  projectsModified: string[];
  globalFieldsChanged: string[];
}

function detectConfigDiff(oldConfig: BrainConfig, newConfig: BrainConfig): ConfigDiff;
```

**Detection Logic**:
- Projects added: in new config but not old
- Projects removed: in old config but not new
- Projects modified: field changes (code_path, memories_path, memories_mode)
- Global fields changed: defaults, sync, logging

**Acceptance Criteria**:
- [ ] Detects added projects
- [ ] Detects removed projects
- [ ] Detects modified project fields
- [ ] Detects global field changes
- [ ] Returns empty diff for identical configs
- [ ] Unit tests: 95% coverage
  - Project additions
  - Project removals
  - Project modifications
  - Global field changes
  - Identical configs (no diff)

**Test Cases**:
- Add project → projectsAdded populated
- Remove project → projectsRemoved populated
- Change code_path → projectsModified populated
- Change logging.level → globalFieldsChanged populated
- Identical configs → all diff arrays empty

---

### TASK-020-24: Implement Config Rollback Manager

**Priority**: P0
**Estimated Effort**: 6 hours
**Dependencies**: TASK-020-03, TASK-020-04
**Category**: TypeScript (MCP)
**Runtime**: Bun

**Description**:
Implement ConfigRollbackManager to snapshot configs and rollback on migration failures or invalid edits.

**Deliverables**:
- [ ] `apps/mcp/src/config/rollback.ts` - ConfigRollbackManager class

**Features**:
```typescript
class ConfigRollbackManager {
  private lastKnownGood: BrainConfig | null = null;
  private rollbackHistory: RollbackSnapshot[] = [];

  async initialize(): Promise<void>; // Load lastKnownGood from disk
  snapshot(config: BrainConfig, reason: string): void;
  async rollback(target: 'lastKnownGood' | 'previous'): Promise<RollbackResult>;
  getLastKnownGood(): BrainConfig | null;
}
```

**Snapshot Strategy**:
- `lastKnownGood`: Baseline config established on MCP server startup
- `rollbackHistory`: Array of snapshots (max 10, FIFO)
- Snapshots stored in `~/.config/brain/rollback/` directory

**Rollback Triggers**:
- Migration failure (any phase)
- Invalid manual edit detected
- Indexing verification failure
- Partial write detected

**Acceptance Criteria**:
- [ ] Initialize loads lastKnownGood from disk
- [ ] Snapshot saves config to rollback directory
- [ ] Rollback restores config and syncs to basic-memory
- [ ] Rollback history limited to 10 snapshots (FIFO)
- [ ] Unit tests: 90% coverage
  - Initialize with missing baseline
  - Initialize with existing baseline
  - Snapshot creation
  - Rollback to lastKnownGood
  - Rollback to previous
  - FIFO eviction when >10 snapshots

**Test Cases**:
- Initialize → loads lastKnownGood from disk
- Snapshot → config persisted to rollback directory
- Rollback to lastKnownGood → baseline restored
- Rollback to previous → last snapshot restored
- 11th snapshot → oldest evicted (FIFO)

---

### TASK-020-25: Implement Global and Project Locking

**Priority**: P0
**Estimated Effort**: 4 hours
**Dependencies**: TASK-020-04
**Category**: TypeScript (MCP)
**Runtime**: Bun

**Description**:
Implement hierarchical locking (global lock + project locks) to prevent concurrent migrations and config changes.

**Deliverables**:
- [ ] `apps/mcp/src/config/lock.ts` - Locking utilities

**Functions**:
```typescript
class LockManager {
  async acquireGlobalLock(): Promise<boolean>;
  releaseGlobalLock(): void;
  async acquireProjectLock(project: string): Promise<boolean>;
  releaseProjectLock(project: string): void;
  isGlobalLocked(): boolean;
  isProjectLocked(project: string): boolean;
}
```

**Lock Hierarchy**:
- **Global lock**: Required for multi-project migrations, config schema changes
- **Project lock**: Required for single-project migrations
- **Rule**: Global lock blocks all project locks; project locks don't block each other

**Acceptance Criteria**:
- [ ] Global lock acquisition blocks project locks
- [ ] Project locks don't block each other
- [ ] Lock release works correctly
- [ ] Deadlock prevention (timeout after 30s)
- [ ] Unit tests: 90% coverage
  - Acquire/release global lock
  - Acquire/release project lock
  - Global lock blocks project locks
  - Project locks don't block each other
  - Timeout behavior

**Test Cases**:
- Acquire global lock → project lock blocked
- Acquire project lock A → project lock B succeeds
- Global lock timeout → error after 30s
- Release lock → subsequent acquisition succeeds

---

### TASK-020-26: Implement Copy Manifest for Partial Copy Tracking

**Priority**: P0
**Estimated Effort**: 6 hours
**Dependencies**: TASK-020-04
**Category**: TypeScript (MCP)
**Runtime**: Bun

**Description**:
Implement CopyManifest to track file copy progress with checksums for integrity verification and partial rollback.

**Deliverables**:
- [ ] `apps/mcp/src/config/copy-manifest.ts` - Manifest tracking

**Interfaces**:
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
```

**Functions**:
```typescript
async function createCopyManifest(project: string, sourceRoot: string, targetRoot: string, files: string[]): Promise<CopyManifest>;
async function markEntryCopied(manifest: CopyManifest, entry: CopyManifestEntry): Promise<void>;
async function verifyEntry(entry: CopyManifestEntry): Promise<boolean>;
async function rollbackPartialCopy(manifest: CopyManifest): Promise<RollbackResult>;
async function recoverIncompleteMigrations(): Promise<void>;
```

**Manifest Lifecycle**:
1. **Before copy starts**: Create manifest with all source files and checksums
2. **After each file copied**: Mark entry as 'copied', compute target checksum
3. **After copy completes**: Verify all entries, mark as 'verified'
4. **On failure**: Rollback removes only copied files
5. **On MCP startup**: Detect incomplete manifests, trigger rollback

**Acceptance Criteria**:
- [ ] Manifest created before copy starts
- [ ] Entries updated after each file copied
- [ ] Checksum verification works
- [ ] Partial rollback removes only copied files
- [ ] Crash recovery detects incomplete manifests
- [ ] Unit tests: 90% coverage
  - Manifest creation
  - Entry updates
  - Checksum verification
  - Partial rollback
  - Crash recovery

**Test Cases**:
- Create manifest → all entries 'pending', source checksums computed
- Mark entry copied → status 'copied', target checksum computed
- Verify entry → checksums match
- Rollback partial copy → only copied files removed
- MCP startup → incomplete manifests detected and rolled back

---

### TASK-020-27: Implement Checksum Verification for Partial Writes

**Priority**: P0
**Estimated Effort**: 3 hours
**Dependencies**: TASK-020-03
**Category**: TypeScript (MCP)
**Runtime**: Bun

**Description**:
Implement checksum verification to detect partial file writes from editor crashes or interruptions.

**Deliverables**:
- [ ] `apps/mcp/src/config/integrity.ts` - Checksum utilities

**Functions**:
```typescript
async function computeFileChecksum(filePath: string): Promise<string>;
async function verifyFileIntegrity(filePath: string, expectedChecksum: string): Promise<boolean>;
async function detectPartialWrite(filePath: string, delayMs: number): Promise<boolean>;
```

**Partial Write Detection**:
1. Read file checksum at T=0
2. Wait `delayMs` (default 500ms)
3. Read file checksum at T=delayMs
4. If checksums differ: file still being written (partial write detected)
5. If checksums match: file stable

**Acceptance Criteria**:
- [ ] Checksum computation uses SHA-256
- [ ] Integrity verification compares checksums
- [ ] Partial write detection waits for file stability
- [ ] Unit tests: 95% coverage
  - Checksum computation
  - Integrity verification (match/mismatch)
  - Partial write detection (stable/unstable)

**Test Cases**:
- Compute checksum → SHA-256 hash returned
- Verify integrity (match) → true
- Verify integrity (mismatch) → false
- Partial write detection (stable file) → false
- Partial write detection (file being written) → true

---

## P0: .agents/ Content Migration

### TASK-020-08: Audit Existing .agents/ Content

**Priority**: P0
**Estimated Effort**: 2 hours
**Dependencies**: None
**Category**: Analysis

**Description**:
Scan and categorize all existing .agents/ content to determine migration scope and category mapping.

**Deliverables**:
- [ ] Migration inventory document (in session log)

**Inventory Fields**:
- File path
- Category (sessions, analysis, architecture, planning, etc.)
- File size
- Last modified date
- Proposed memory title
- Proposed memory category

**Acceptance Criteria**:
- [ ] All .agents/ files cataloged
- [ ] Category mapping verified against ADR-020
- [ ] File count reported per category
- [ ] Total migration size estimated

**Expected Categories**:
| Source Directory | Brain Memory Category | Estimated Count |
|-----------------|----------------------|-----------------|
| `.agents/sessions/` | `sessions` | 50+ |
| `.agents/analysis/` | `analysis` | 10+ |
| `.agents/architecture/` | `architecture` | 20+ |
| `.agents/planning/` | `planning` | 15+ |
| `.agents/critique/` | `critique` | 5+ |
| `.agents/qa/` | `qa` | 5+ |
| `.agents/specs/` | `specs` | 10+ |
| `.agents/retrospective/` | `retrospective` | 5+ |
| `.agents/skills/` | `skills` | 10+ |
| `.agents/governance/` | `governance` | 5+ |

---

### TASK-020-09: Implement Migration Script (TypeScript)

**Priority**: P0
**Estimated Effort**: 8 hours (updated from 5-6h)
**Dependencies**: TASK-020-08, TASK-020-24, TASK-020-25, TASK-020-26
**Category**: TypeScript (MCP)
**Runtime**: Bun

**Description**:
Create transactional migration logic in MCP server to migrate .agents/ content to Brain memory via basic-memory with rollback support.

**Deliverables**:
- [ ] `apps/mcp/src/tools/migrate/migrate-agents.ts` - Migration logic
- [ ] `apps/mcp/src/tools/migrate/schema.ts` - Tool schema
- [ ] `apps/mcp/src/config/migration-transaction.ts` - Transactional wrapper

**Functions**:
```typescript
async function migrateAgentsContent(project: string, dryRun: boolean): Promise<MigrationResult>;
function scanAgentsDirectory(agentsPath: string): AgentsFile[];
function categorizeFile(filePath: string): { category: string, title: string };
async function migrateFile(file: AgentsFile, manifest: CopyManifest): Promise<MigrationFileResult>;
async function verifyIndexing(title: string, content: string): Promise<boolean>;
```

**Category Mapping** (from ADR-020):
- `.agents/sessions/` → `sessions` category
- `.agents/analysis/` → `analysis` category
- `.agents/architecture/` → `architecture` category
- `.agents/planning/` → `planning` category
- `.agents/critique/` → `critique` category
- `.agents/qa/` → `qa` category
- `.agents/specs/` → `specs` category
- `.agents/roadmap/` → `roadmap` category
- `.agents/retrospective/` → `retrospective` category
- `.agents/skills/` → `skills` category
- `.agents/governance/` → `governance` category

**Title Transformation**:
- `.agents/sessions/2026-01-31-session-44-topic.md` → `session-2026-01-31-44-topic`
- `.agents/architecture/ADR-020-title.md` → `ADR-020-title`
- `.agents/planning/001-feature-plan.md` → `plan-001-feature`

**Migration Phases** (transactional):
1. **Acquire lock**: Project lock for single-project, global lock for multi-project
2. **Create manifest**: Track all files with source checksums
3. **Scan**: Read `.agents/` directory in project root
4. **Categorize**: Map each file to memory category
5. **Transform**: Convert filename to memory title
6. **Copy**: Write to Brain memory via `write_note` tool, update manifest
7. **Verify**: Indexing verification via `search` tool (must return result)
8. **Remove source**: If verification passes, remove source file
9. **Cleanup**: Remove `.agents/` directory when empty
10. **Release lock**: Always release, even on failure

**Rollback Triggers**:
- Lock acquisition fails
- Manifest creation fails
- Any file copy fails
- Indexing verification fails
- Partial write detected

**Acceptance Criteria**:
- [ ] Dry-run mode reports migration plan without executing
- [ ] Migration writes all files to Brain memory
- [ ] Category mapping correct for all directories
- [ ] Title transformation preserves identifiers
- [ ] Indexing verification succeeds for each file
- [ ] Source files removed only after verification
- [ ] `.agents/` directory removed when empty
- [ ] Rollback removes only copied files (CopyManifest)
- [ ] Lock released on success and failure
- [ ] Unit tests: 85% coverage
  - Scan directory
  - Categorize files
  - Title transformation
  - Dry-run mode
  - Migration success
  - Migration failure (rollback)
  - Indexing verification
  - Lock acquisition/release

**Test Cases**:
- Dry-run: report files, don't migrate
- Migrate session log: category=sessions, title transformed
- Migrate ADR: category=architecture, title preserved
- Indexing fails: rollback, source files kept
- Indexing passes: source files removed
- Partial copy: rollback removes only copied files

---

### TASK-020-10: Add Indexing Verification Logic

**Priority**: P0
**Estimated Effort**: 2 hours
**Dependencies**: TASK-020-09
**Category**: TypeScript (MCP)
**Runtime**: Bun

**Description**:
Implement indexing verification to ensure all migrated memories are searchable by basic-memory.

**Deliverables**:
- [ ] `apps/mcp/src/tools/migrate/verify-indexing.ts` - Verification logic

**Verification Steps**:
```typescript
async function verifyIndexing(memory: MigratedMemory): Promise<boolean> {
  // 1. Search for the exact title
  const results = await brain.search(memory.title, { limit: 1 });

  if (results.length === 0) {
    console.error(`FAIL: Memory not indexed: ${memory.title}`);
    return false;
  }

  // 2. Verify content match (first 100 chars)
  const note = await brain.readNote(memory.title);
  if (!note.content.includes(memory.content.substring(0, 100))) {
    console.error(`FAIL: Content mismatch: ${memory.title}`);
    return false;
  }

  console.log(`PASS: Indexed: ${memory.title}`);
  return true;
}
```

**Acceptance Criteria**:
- [ ] Verification searches for exact title
- [ ] Verification checks content match (first 100 chars)
- [ ] Verification returns boolean (pass/fail)
- [ ] Failures logged with details
- [ ] Successes logged with title
- [ ] Unit tests: 90% coverage
  - Indexed memory passes
  - Missing memory fails
  - Content mismatch fails

**Test Cases**:
- Memory indexed and content matches → PASS
- Memory not indexed → FAIL
- Memory indexed but content differs → FAIL

---

### TASK-020-11: Create Config Migration Logic

**Priority**: P0
**Estimated Effort**: 3 hours
**Dependencies**: TASK-020-03, TASK-020-04
**Category**: TypeScript (MCP)
**Runtime**: Bun

**Description**:
Implement config migration from old format (`~/.basic-memory/brain-config.json`) to new format (`~/.config/brain/config.json`).

**Deliverables**:
- [ ] `apps/mcp/src/config/migration.ts` - Config migration logic

**Functions**:
```typescript
async function migrateConfig(dryRun: boolean, cleanup: boolean): Promise<MigrationResult>;
function detectOldConfig(): boolean;
function transformOldConfig(oldConfig: OldBrainConfig): BrainConfig;
function removeDeprecatedFiles(cleanup: boolean): void;
```

**Old Format** (`.basic-memory/brain-config.json`):
```json
{
  "code_paths": {
    "brain": "/Users/peter/Dev/brain"
  },
  "default_notes_path": "~/memories"
}
```

**New Format** (`.config/brain/config.json`):
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

**Migration Steps**:
1. Detect `~/.basic-memory/brain-config.json` (old location)
2. Transform old config to new schema
3. Create `~/.config/brain/` directory with 0700 permissions
4. Write `~/.config/brain/config.json` with 0600 permissions
5. Sync to `~/.basic-memory/config.json` via translation layer
6. If `--cleanup`: remove deprecated files

**Deprecated Files to Remove**:
- `~/.basic-memory/brain-config.json`
- `~/.brain/projects.json`
- `~/.brain/` directory (if empty)

**Acceptance Criteria**:
- [ ] Detects old config location
- [ ] Transforms old format to new format
- [ ] Creates new config directory with correct permissions
- [ ] Writes new config with correct permissions
- [ ] Syncs to basic-memory config
- [ ] Cleanup removes deprecated files
- [ ] Unit tests: 85% coverage
  - Detect old config
  - Transform old to new
  - Missing old config (no-op)
  - Dry-run reports plan
  - Cleanup removes files

**Test Cases**:
- Old config exists → migrated to new location
- Old config missing → no-op
- Dry-run → report plan, no changes
- Cleanup flag → deprecated files removed

---

## P0: Agent and Skill Updates

### TASK-020-12: Update Memory Agent Instructions

**Priority**: P0
**Estimated Effort**: 2 hours
**Dependencies**: TASK-020-09
**Category**: Documentation

**Description**:
Update memory agent to use Brain MCP tools exclusively and remove all .agents/ file system references.

**Files to Update**:
- [ ] `src/claude/memory.md` (Claude Code agent)
- [ ] `src/vs-code-agents/memory.agent.md` (VS Code agent)
- [ ] `src/copilot-cli/memory.agent.md` (Copilot CLI agent)

**Changes**:
1. Remove `.agents/` path references
2. Add Brain MCP tool examples
3. Update memory delegation protocol
4. Add category-based storage examples

**Acceptance Criteria**:
- [ ] No `.agents/` path references in agent instructions
- [ ] Brain MCP tools documented
- [ ] Memory delegation protocol clear
- [ ] Category examples provided
- [ ] Session log pattern updated (Brain memory, not file system)

---

### TASK-020-13: Update Memory Skill

**Priority**: P0
**Estimated Effort**: 2 hours
**Dependencies**: TASK-020-09
**Category**: PowerShell/Documentation

**Description**:
Update memory skill to delegate to Brain memory system exclusively (no file system operations on .agents/).

**Files to Update**:
- [ ] `.claude/skills/memory/SKILL.md`
- [ ] `.claude/skills/memory/scripts/*.ps1` (if any file system operations exist)

**Changes**:
1. Replace file system operations with Brain MCP tool calls
2. Update skill examples to use memory categories
3. Remove `.agents/` path handling

**Acceptance Criteria**:
- [ ] No file system operations on `.agents/` directory
- [ ] Brain MCP tool delegation documented
- [ ] Examples use memory categories
- [ ] Skill execution works with Brain memory

---

### TASK-020-14: Update Agent Instructions (All Agents)

**Priority**: P0
**Estimated Effort**: 4-5 hours
**Dependencies**: TASK-020-12
**Category**: Documentation

**Description**:
Update all agent instructions to remove .agents/ path references and use Brain memory delegation patterns.

**Agents to Update**:
| Agent | File | Changes |
|-------|------|---------|
| orchestrator | `src/claude/orchestrator.md` | Remove `.agents/HANDOFF.md` refs, use `brain.readNote("handoff")` |
| planner | `src/claude/planner.md` | Remove `.agents/planning/` refs, use `brain.writeNote(title, content, "planning")` |
| analyst | `src/claude/analyst.md` | Remove `.agents/analysis/` refs, use `brain.writeNote(title, content, "analysis")` |
| architect | `src/claude/architect.md` | Remove `.agents/architecture/` refs, use `brain.writeNote(title, content, "architecture")` |
| qa | `src/claude/qa.md` | Remove `.agents/qa/` refs, use `brain.writeNote(title, content, "qa")` |
| critic | `src/claude/critic.md` | Remove `.agents/critique/` refs, use `brain.writeNote(title, content, "critique")` |
| retrospective | `src/claude/retrospective.md` | Remove `.agents/retrospective/` refs, use `brain.writeNote(title, content, "retrospective")` |
| skillbook | `src/claude/skillbook.md` | Remove `.agents/skills/` refs, use `brain.writeNote(title, content, "skills")` |

**Pattern Changes**:
- Old: `Write to .agents/planning/001-feature-plan.md`
- New: `brain.writeNote("plan-001-feature", content, "planning")`

- Old: `Read .agents/HANDOFF.md`
- New: `brain.readNote("handoff")`

**Acceptance Criteria**:
- [ ] All agent instructions updated (8 agents minimum)
- [ ] No `.agents/` path references in agent instructions
- [ ] Brain memory delegation patterns documented
- [ ] Category usage consistent across agents
- [ ] Session protocol updated (Brain memory for session logs)

---

### TASK-020-15: Update Session Protocol

**Priority**: P0
**Estimated Effort**: 2 hours
**Dependencies**: TASK-020-14
**Category**: Documentation

**Description**:
Update SESSION-PROTOCOL.md to reflect Brain memory usage for session logs and HANDOFF.md replacement.

**Files to Update**:
- [ ] `.agents/SESSION-PROTOCOL.md`
- [ ] `CLAUDE.md` (session protocol quick reference)

**Changes**:
1. Session log creation: `brain.writeNote("session-YYYY-MM-DD-NN-topic", initialContent, "sessions")`
2. Session updates: `brain.editNote("session-...", "append", updateContent)`
3. HANDOFF.md access: `brain.readNote("handoff")`
4. Remove `.agents/sessions/` path references

**Acceptance Criteria**:
- [ ] Session protocol updated for Brain memory
- [ ] HANDOFF.md replacement documented
- [ ] Session log patterns updated
- [ ] Quick reference in CLAUDE.md updated
- [ ] All file path references removed

---

## P1: CLI Config Commands

### TASK-020-16: Implement `brain config` Commands (Go)

**Priority**: P1
**Estimated Effort**: 8 hours (updated from 5-6h for config reconfiguration support)
**Dependencies**: TASK-020-03, TASK-020-04, TASK-020-22
**Category**: Go (TUI)

**Description**:
Implement `brain config` command family in Go CLI, delegating all operations to MCP server with live reconfiguration support.

**Deliverables**:
- [ ] `apps/tui/cmd/config.go` - Config command implementation

**Commands to Implement**:
```bash
brain config                                  # Pretty-printed view
brain config --json                           # Machine-readable JSON
brain config set default-memories-location ~/my-memories
brain config set logging.level debug
brain config set sync.delay 1000
brain config get default-memories-location
brain config get logging.level
brain config reset default-memories-location
brain config reset --all
```

**MCP Tool Delegation**:
- `brain config` → `config_get` tool (all fields)
- `brain config set <key> <value>` → `config_set` tool (triggers reconfiguration)
- `brain config get <key>` → `config_get` tool (specific field)
- `brain config reset <key>` → `config_reset` tool
- `brain config reset --all` → `config_reset` tool (all fields)

**Acceptance Criteria**:
- [ ] All commands implemented
- [ ] Delegation to MCP server works
- [ ] Pretty-printed output for `brain config`
- [ ] JSON output for `brain config --json`
- [ ] Set command validates key/value
- [ ] Get command returns single value
- [ ] Reset command restores defaults
- [ ] Live reconfiguration triggered on set/reset
- [ ] Integration tests: 80% coverage
  - Get all config
  - Get single field
  - Set field (triggers reconfiguration)
  - Reset field
  - Reset all

**Test Cases**:
- `brain config` → pretty-printed config
- `brain config --json` → JSON output
- `brain config set logging.level debug` → updated + reconfiguration
- `brain config get logging.level` → returns value
- `brain config reset logging.level` → restored to default

---

### TASK-020-17: Update `brain projects` CLI Flags

**Priority**: P1
**Estimated Effort**: 3 hours
**Dependencies**: TASK-020-06
**Category**: Go (TUI)

**Description**:
Rename CLI flags from `--notes-path` to `--memories-path` and `--delete-notes` to `--delete-memories`.

**Files to Update**:
- [ ] `apps/tui/cmd/projects.go`

**Flag Renames**:
| Old Flag | New Flag |
|----------|----------|
| `--notes-path` | `--memories-path` |
| `--delete-notes` | `--delete-memories` |

**Acceptance Criteria**:
- [ ] All flag references updated
- [ ] Help text updated
- [ ] Examples in help text use new flags
- [ ] Old flags deprecated (show warning)
- [ ] Integration tests updated
- [ ] All tests pass

**Test Cases**:
- `brain projects create --name X --code-path Y --memories-path Z` → works
- `brain projects delete --project X --delete-memories` → works
- `brain projects create --name X --code-path Y --notes-path Z` → warning + works (backward compat)

---

### TASK-020-18: Implement `brain migrate` Commands (Go)

**Priority**: P1
**Estimated Effort**: 6 hours (updated from 4h for rollback support)
**Dependencies**: TASK-020-11, TASK-020-24
**Category**: Go (TUI)

**Description**:
Implement migration commands in Go CLI, delegating to MCP server with rollback support.

**Deliverables**:
- [ ] `apps/tui/cmd/migrate.go` - Migration commands

**Commands to Implement**:
```bash
brain migrate [--dry-run] [--cleanup]
brain migrate-agents [--project <name>] [--dry-run]
brain migrate-agents --verify-only
brain rollback [--target lastKnownGood|previous]
```

**MCP Tool Delegation**:
- `brain migrate` → `migrate_config` tool
- `brain migrate-agents` → `migrate_agents_content` tool
- `brain migrate-agents --verify-only` → `verify_agents_indexing` tool
- `brain rollback` → `rollback_config` tool

**Acceptance Criteria**:
- [ ] All commands implemented
- [ ] Dry-run mode reports plan without execution
- [ ] Cleanup flag removes deprecated files
- [ ] Verify-only mode checks indexing
- [ ] Rollback command works with target selection
- [ ] Progress reporting during migration
- [ ] Integration tests: 80% coverage
  - Dry-run config migration
  - Config migration with cleanup
  - Dry-run agents migration
  - Agents migration with verification
  - Rollback to lastKnownGood
  - Rollback to previous

**Test Cases**:
- `brain migrate --dry-run` → report plan, no changes
- `brain migrate` → config migrated
- `brain migrate --cleanup` → deprecated files removed
- `brain migrate-agents --dry-run` → report files, no migration
- `brain migrate-agents` → files migrated, indexed, removed
- `brain rollback --target lastKnownGood` → baseline restored

---

## Supporting Tasks

### TASK-020-19: Create MCP Config Tools

**Priority**: P1
**Estimated Effort**: 4 hours (updated from 3h for reconfiguration triggers)
**Dependencies**: TASK-020-03, TASK-020-04, TASK-020-22
**Category**: TypeScript (MCP)
**Runtime**: Bun

**Description**:
Create MCP tools for config operations (get, set, reset) to support CLI delegation with reconfiguration triggers.

**Deliverables**:
- [ ] `apps/mcp/src/tools/config/get.ts`
- [ ] `apps/mcp/src/tools/config/set.ts`
- [ ] `apps/mcp/src/tools/config/reset.ts`
- [ ] `apps/mcp/src/tools/config/rollback.ts` (new)
- [ ] Schemas for each tool

**Tool Signatures**:
```typescript
config_get(key?: string): BrainConfig | unknown
config_set(key: string, value: unknown): void // triggers reconfiguration
config_reset(key?: string, all?: boolean): void
config_rollback(target: 'lastKnownGood' | 'previous'): RollbackResult
```

**Reconfiguration Triggers**:
- `config_set`: Triggers ConfigFileWatcher diff detection and migration
- `config_reset`: Triggers reconfiguration if field affects projects

**Acceptance Criteria**:
- [ ] All tools implemented
- [ ] Schemas defined
- [ ] Set/reset trigger reconfiguration when needed
- [ ] Rollback tool restores config and syncs to basic-memory
- [ ] Unit tests: 85% coverage
- [ ] Get returns full config or single field
- [ ] Set validates key/value and updates config
- [ ] Reset restores defaults
- [ ] Rollback works with target selection

---

### TASK-020-20: Add Integration Tests

**Priority**: P1
**Estimated Effort**: 6 hours (updated from 4h for file-watching tests)
**Dependencies**: TASK-020-16, TASK-020-17, TASK-020-18, TASK-020-22
**Category**: TypeScript (MCP) + Go (TUI)

**Description**:
End-to-end integration tests for config operations, migration, CLI commands, and file-watching.

**Test Files**:
- [ ] `apps/mcp/src/config/__tests__/integration.test.ts`
- [ ] `apps/tui/cmd/config_test.go`
- [ ] `apps/tui/cmd/migrate_test.go`

**Test Scenarios**:
1. Config set/get round-trip
2. Translation to basic-memory verified
3. Migration dry-run and execution
4. Agents migration with indexing verification
5. CLI commands delegate correctly to MCP
6. File watcher detects manual edits
7. Invalid manual edit triggers rollback
8. Reconfiguration migrates affected projects
9. Rollback restores lastKnownGood
10. CopyManifest tracks partial migrations

**Acceptance Criteria**:
- [ ] All integration tests pass
- [ ] Coverage: 80%+
- [ ] CI pipeline updated to run integration tests

---

### TASK-020-21: Update Documentation

**Priority**: P1
**Estimated Effort**: 4 hours (updated from 3h for file-watching docs)
**Dependencies**: TASK-020-18, TASK-020-22
**Category**: Documentation

**Description**:
Update all user-facing documentation to reflect new config architecture, CLI commands, and file-watching behavior.

**Files to Update**:
- [ ] `README.md` - Config location and migration
- [ ] `CLAUDE.md` - Session protocol and memory delegation
- [ ] `apps/tui/README.md` - CLI command updates
- [ ] `docs/config-protocol.md` (new) - File-watching and reconfiguration
- [ ] `docs/` - Architecture diagrams (if any)

**Acceptance Criteria**:
- [ ] All docs reference `~/.config/brain/config.json`
- [ ] Migration instructions documented
- [ ] New CLI commands documented
- [ ] Memory delegation patterns documented
- [ ] File-watching behavior documented
- [ ] Reconfiguration protocol explained
- [ ] Rollback commands documented
- [ ] No references to `.agents/` paths (except migration)

---

## Summary

### Task Count by Priority

- **P0 (Critical Path)**: 21 tasks (was 15)
  - Translation Layer: 7 tasks
  - File-Watching & Live Reconfiguration: 6 tasks (NEW)
  - .agents/ Migration: 4 tasks
  - Agent/Skill Updates: 4 tasks
- **P1 (User-Facing)**: 6 tasks
  - CLI Config Commands: 3 tasks
  - Supporting Tasks: 3 tasks

**Total Tasks**: 27 (was 21)

### Total Estimated Effort

- **P0**: 73 hours (was 48-56 hours)
  - Translation Layer: 21-23 hours
  - File-Watching: 29 hours (NEW)
  - .agents/ Migration: 12 hours
  - Agent/Skill Updates: 10-11 hours
- **P1**: 27 hours (was 22 hours)
  - CLI Config Commands: 17 hours
  - Supporting Tasks: 10 hours
- **Total**: 100 hours (~13 person-days) (was 70-78 hours)

**Note**: ADR-020 estimates 113 hours, but includes documentation/security testing not broken out as separate tasks here.

### Critical Path Sequence

```text
TASK-020-01 (Schema) → TASK-020-02 (Path Validation)
                     ↓
TASK-020-03 (BrainConfig Read/Write)
                     ↓
TASK-020-04 (Translation Layer)
                     ↓
        ┌────────────┴────────────┐
        ↓                         ↓
TASK-020-05 (Hardcoded Fallbacks) TASK-020-22 (ConfigFileWatcher)
        ↓                         ↓
TASK-020-06 (Terminology)   TASK-020-23 (Config Diff)
        ↓                         ↓
TASK-020-07 (Tests)         TASK-020-24 (Rollback Manager)
                                  ↓
                            TASK-020-25 (Locking)
                                  ↓
                            TASK-020-26 (CopyManifest)
                                  ↓
                            TASK-020-27 (Checksum Verification)
        ↓                         ↓
        └────────────┬────────────┘
                     ↓
TASK-020-11 (Config Migration)
                     ↓
TASK-020-08 (Audit) → TASK-020-09 (Migration Script) → TASK-020-10 (Indexing Verification)
                     ↓
TASK-020-12 (Memory Agent) → TASK-020-13 (Memory Skill) → TASK-020-14 (All Agents) → TASK-020-15 (Session Protocol)
                     ↓
TASK-020-16 (CLI Config) → TASK-020-17 (CLI Flags) → TASK-020-18 (CLI Migration)
                     ↓
TASK-020-19 (MCP Tools) → TASK-020-20 (Integration Tests) → TASK-020-21 (Documentation)
```

### Dependencies Graph

```text
P0 Tasks (Translation Layer):
├── TASK-020-01 → TASK-020-03 → TASK-020-04 → TASK-020-05 → TASK-020-06 → TASK-020-07
├── TASK-020-02 → TASK-020-03
└── TASK-020-03 → TASK-020-11

P0 Tasks (File-Watching):
├── TASK-020-03 → TASK-020-22 → TASK-020-23
├── TASK-020-04 → TASK-020-22
├── TASK-020-03 → TASK-020-24
├── TASK-020-04 → TASK-020-24
├── TASK-020-04 → TASK-020-25
├── TASK-020-04 → TASK-020-26
└── TASK-020-03 → TASK-020-27

P0 Tasks (.agents/ Migration):
├── TASK-020-08 → TASK-020-09 → TASK-020-10
├── TASK-020-09 → TASK-020-12
├── TASK-020-24 → TASK-020-09 (Rollback Manager)
├── TASK-020-25 → TASK-020-09 (Locking)
└── TASK-020-26 → TASK-020-09 (CopyManifest)

P0 Tasks (Agent Updates):
├── TASK-020-12 → TASK-020-13 → TASK-020-14 → TASK-020-15
└── TASK-020-09 → TASK-020-12

P1 Tasks (CLI):
├── TASK-020-03 → TASK-020-16
├── TASK-020-22 → TASK-020-16 (Reconfiguration support)
├── TASK-020-06 → TASK-020-17
├── TASK-020-11 → TASK-020-18
├── TASK-020-24 → TASK-020-18 (Rollback command)
├── TASK-020-03 → TASK-020-19
├── TASK-020-22 → TASK-020-19 (Reconfiguration triggers)
└── TASK-020-16 → TASK-020-20 → TASK-020-21
```

---

## New Tasks Summary (Round 2 Additions)

### File-Watching & Live Reconfiguration (6 tasks)

| Task ID | Title | Effort | Dependencies |
|---------|-------|--------|--------------|
| TASK-020-22 | Implement Config File Watcher | 6h | TASK-020-03, TASK-020-04 |
| TASK-020-23 | Implement Config Diff Detection | 4h | TASK-020-03 |
| TASK-020-24 | Implement Config Rollback Manager | 6h | TASK-020-03, TASK-020-04 |
| TASK-020-25 | Implement Global and Project Locking | 4h | TASK-020-04 |
| TASK-020-26 | Implement Copy Manifest for Partial Copy Tracking | 6h | TASK-020-04 |
| TASK-020-27 | Implement Checksum Verification for Partial Writes | 3h | TASK-020-03 |

**Total New Effort**: 29 hours

---

## Implementation Notes

### Testing Strategy

Each task includes acceptance criteria with specific test cases. Follow this testing hierarchy:

1. **Unit Tests** (per-task): 85-95% coverage for isolated logic
2. **Integration Tests** (TASK-020-20): End-to-end workflows
3. **Manual Verification**: Config migration, indexing verification, file-watching

### Rollback Plan

- Translation layer is one-way (Brain → basic-memory)
- Config migration can be reversed via `brain rollback --target lastKnownGood`
- .agents/ migration is transactional with CopyManifest tracking
- File-watching errors rollback to last known good config
- Recommend: Test with `--dry-run` first, then commit incrementally

### Security Considerations

- Path validation prevents traversal attacks (TASK-020-02)
- File permissions enforced (0700 dirs, 0600 files)
- Checksum verification prevents partial write exploitation (TASK-020-27)
- Global lock prevents race conditions (TASK-020-25)
- No user data in logs
- Indexing verification prevents silent data loss

### Performance Considerations

- Migration may take 5-10 minutes for 100+ files
- Indexing verification adds latency (1 search per file)
- Translation layer runs on every config write (keep fast)
- File locking prevents concurrent access issues
- Debouncing reduces unnecessary reconfiguration (2s delay)
- CopyManifest adds I/O overhead but ensures safety

### Runtime Notes

- **Bun**: All TypeScript code runs on Bun (not Node.js)
- File-watching uses chokidar (Bun-compatible)
- Checksums use Bun's native crypto APIs
- Lock files use Bun's file system APIs

---

## Acceptance Criteria (Overall)

The implementation is complete when:

- [ ] All P0 tasks completed and tested (21 tasks)
- [ ] All P1 tasks completed and tested (6 tasks)
- [ ] `brain config` commands work
- [ ] `brain config set` triggers live reconfiguration
- [ ] File-watching detects manual edits and triggers reconfiguration
- [ ] Invalid manual edits rollback to last known good config
- [ ] `brain migrate` successfully migrates old config
- [ ] `brain migrate-agents` migrates all .agents/ content with rollback safety
- [ ] `brain rollback` restores previous configurations
- [ ] All migrated memories searchable via `brain search`
- [ ] No `.agents/` path references in agent instructions
- [ ] Session protocol updated for Brain memory
- [ ] All tests pass (unit + integration)
- [ ] Documentation updated with file-watching protocol
- [ ] ADR-020 marked as implemented

---

## Related Documentation

- ADR-020: Configuration Architecture Refactoring (Round 2 - file-watching)
- ADR-007: Memory-First Architecture
- ADR-017: Memory Tool Naming Strategy
- ADR-019: Memory Operations Governance
- SESSION-PROTOCOL.md: Session logging patterns
