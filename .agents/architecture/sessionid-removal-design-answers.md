# SessionId Removal Design - Answers to Critical Questions

**Date**: 2026-01-19
**Status**: Complete Design Specification
**Author**: Architect Agent

---

## Executive Summary

This document provides concrete answers to all 7 critical questions raised during critic review of the sessionId removal design. The design consolidates multiple ephemeral sessions into a single persistent session per project, eliminating the need for session lifecycle management while maintaining backward compatibility through adapter patterns.

---

## Question 1: Agent Context Notes Path Format

### Current Implementation

```typescript
// brain-persistence.ts:401
const notePath = `session-${sessionId}-agent-${agent}`;
```

**Example**: `session-abc123-agent-orchestrator`

### Proposed Format

```typescript
const notePath = `sessions/agent-${agent}`;
```

**Examples**:

- `sessions/agent-orchestrator`
- `sessions/agent-planner`
- `sessions/agent-implementer`

### Rationale

| Decision | Reason |
|----------|--------|
| Remove `session-{sessionId}` prefix | Single session per project eliminates need for session-scoped namespacing |
| Keep `sessions/` directory prefix | Maintains organizational structure for session-related notes |
| Use hyphenated format | Consistency with existing Brain note naming conventions |

### Implementation Changes

**File**: `src/services/session/brain-persistence.ts`

```typescript
// Lines 394-401 (saveAgentContext)
async saveAgentContext(
  agent: AgentType,
  invocation: AgentInvocation
): Promise<void> {
  const client = await this.getClient();

  const notePath = `sessions/agent-${agent}`;  // CHANGED: removed sessionId

  logger.debug(
    { agent, notePath },  // CHANGED: removed sessionId from log
    "Saving agent context to Brain note"
  );

  await client.callTool({
    name: "write_note",
    arguments: {
      path: notePath,
      content: JSON.stringify(invocation, null, 2),
      project: this.projectPath,
    },
  });

  logger.info({ agent }, "Agent context saved to Brain note");  // CHANGED
}

// Lines 428-434 (loadAgentContext)
async loadAgentContext(
  agent: AgentType
): Promise<AgentInvocation | null> {
  const client = await this.getClient();

  const notePath = `sessions/agent-${agent}`;  // CHANGED: removed sessionId

  try {
    const result = (await client.callTool({
      name: "read_note",
      arguments: {
        identifier: notePath,
        project: this.projectPath,
      },
    })) as ReadNoteResult;

    const textContent = result.content?.find((c) => c.type === "text")?.text;
    if (!textContent) {
      return null;
    }

    return JSON.parse(textContent) as AgentInvocation;
  } catch {
    logger.debug({ agent }, "Agent context not found");  // CHANGED
    return null;
  }
}
```

### Migration Strategy

Agent context notes will be migrated during the consolidation phase:

```typescript
// Pseudo-code for migration
async function migrateAgentContext(sessionId: string): Promise<void> {
  const agents: AgentType[] = ['orchestrator', 'planner', 'implementer', /* ... */];

  for (const agent of agents) {
    const oldPath = `session-${sessionId}-agent-${agent}`;
    const newPath = `sessions/agent-${agent}`;

    const content = await readNote(oldPath);
    if (content) {
      // Most recent session wins (last write wins strategy)
      await writeNote(newPath, content);
      await deleteNote(oldPath);  // Cleanup old note
    }
  }
}
```

---

## Question 2: Version Conflict Resolution

### Selected Strategy: Last-Write-Wins (LWW)

**Decision**: Use last-write-wins conflict resolution with atomic Brain note updates.

### Rationale

| Factor | Analysis |
|--------|----------|
| **Concurrency likelihood** | LOW - Single user, single Claude Code session typical |
| **Conflict cost** | MEDIUM - Lost updates acceptable in agent context |
| **Complexity** | LOW - No retry logic or merge algorithms needed |
| **User experience** | HIGH - No blocking or error prompts |
| **Brain MCP semantics** | `write_note` is atomic per-note |

### Implementation

Brain MCP's `write_note` tool provides atomic updates at the note level. The last write operation to complete will be the visible state.

```typescript
// No changes needed - Brain MCP handles atomicity
async saveSession(session: SessionState): Promise<void> {
  const client = await this.getClient();
  const notePath = "sessions/session";  // Single note path

  // Atomic write - Brain MCP guarantees last write wins
  await client.callTool({
    name: "write_note",
    arguments: {
      path: notePath,
      content: JSON.stringify(session, null, 2),
      project: this.projectPath,
    },
  });

  logger.info({ version: session.version }, "Session saved (LWW)");
}
```

### Conflict Detection (Optional Enhancement)

Version field remains in `SessionState` for optional conflict detection:

```typescript
interface SessionState {
  version: number;  // Increment on each update
  currentMode: WorkflowMode;
  // ... other fields
}

async saveSession(session: SessionState): Promise<void> {
  // Load current version before write
  const current = await this.loadSession();

  if (current && current.version > session.version) {
    logger.warn(
      {
        currentVersion: current.version,
        attemptedVersion: session.version
      },
      "Version conflict detected - proceeding with LWW"
    );
  }

  // Increment version and write (last write wins)
  session.version++;
  await client.callTool({
    name: "write_note",
    arguments: {
      path: "sessions/session",
      content: JSON.stringify(session, null, 2),
      project: this.projectPath,
    },
  });
}
```

### Alternatives Considered and Rejected

| Strategy | Rejected Because |
|----------|------------------|
| **Fail-fast** | Blocks user workflow with errors in benign race conditions |
| **Retry with exponential backoff** | Adds complexity for unlikely scenario |
| **CRDT merge** | Massive overkill for single-user tool |
| **Optimistic locking** | Requires transaction support not provided by Brain MCP |

---

## Question 3: Migration Consolidation Strategy

### Decision: Most Recent Session Wins

When multiple historic sessions exist, the migration process selects the most recent session based on `updatedAt` timestamp.

### Consolidation Algorithm

```typescript
interface SessionCandidate {
  sessionId: string;
  state: SessionState;
  updatedAt: string;
}

async function consolidateHistoricSessions(): Promise<SessionState> {
  const candidates: SessionCandidate[] = [];

  // Step 1: Discover all historic sessions
  const sessionNotes = await listNotes({ pattern: "sessions/session-*" });

  for (const note of sessionNotes) {
    const sessionId = extractSessionId(note.path);  // Parse from path
    const state = await loadSession(sessionId);

    if (state && !state.deleted) {
      candidates.push({
        sessionId,
        state,
        updatedAt: state.updatedAt,
      });
    }
  }

  // Step 2: Sort by updatedAt (most recent first)
  candidates.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  // Step 3: Select winner (most recent)
  if (candidates.length === 0) {
    // No sessions exist - create fresh default
    return createDefaultSessionState();
  }

  const winner = candidates[0];
  logger.info(
    {
      sessionId: winner.sessionId,
      totalCandidates: candidates.length,
      updatedAt: winner.updatedAt
    },
    "Selected most recent session as consolidated session"
  );

  // Step 4: Remove sessionId field (no longer needed)
  const consolidated: SessionState = {
    ...winner.state,
    sessionId: undefined,  // Remove session ID
    version: winner.state.version + 1,  // Increment version
    updatedAt: new Date().toISOString(),  // Update timestamp
  };

  // Step 5: Write to new location
  await saveSession(consolidated);  // Writes to "sessions/session"

  // Step 6: Archive old sessions (cleanup)
  for (const candidate of candidates) {
    const oldPath = `sessions/session-${candidate.sessionId}`;
    await deleteNote(oldPath);
  }

  return consolidated;
}
```

### Migration Trigger

Consolidation runs automatically on first access after upgrade:

```typescript
async function getSession(): Promise<SessionState | null> {
  // Try new path first
  let state = await persistence.loadSession();

  if (!state) {
    // Check if migration needed
    const hasOldSessions = await hasHistoricSessions();

    if (hasOldSessions) {
      logger.info("Historic sessions detected - running consolidation");
      state = await consolidateHistoricSessions();
    } else {
      // No sessions exist - initialize fresh
      state = createDefaultSessionState();
      await persistence.saveSession(state);
    }
  }

  return state;
}
```

### Edge Cases

| Case | Handling |
|------|----------|
| All sessions have identical timestamps | Use lexicographic sort on sessionId as tiebreaker |
| Corrupted session data | Skip corrupted session, log warning, continue to next |
| No historic sessions | Create fresh default session state |
| Current session pointer exists | Prefer session referenced by pointer if valid |

---

## Question 4: getCurrentSessionId() Export Surface

### Decision: Remove Export Entirely

**Rationale**: The function becomes meaningless in a single-session model. Code that needs session context should use `getSession()` instead.

### Current Export

```typescript
// src/services/session/index.ts:179-181
export function getCurrentSessionId(): string | null {
  return currentSessionId;
}
```

### Proposed Change

```typescript
// REMOVE: export function getCurrentSessionId()
// Internal implementation detail only

// REPLACE WITH: getSession() as the public API
export async function getSession(): Promise<SessionState | null> {
  return await getPersistence().loadSession();
}
```

### Migration for Existing Callers

**Search for references**:

```bash
grep -r "getCurrentSessionId" src/
```

**Identified callers**:

1. `src/tools/session/index.ts:17` - Used for display in get operation
2. `src/services/session/index.ts:171` - Internal alias
3. `src/inngest/workflows/sessionState.ts` - Workflow context

**Migration strategy per caller**:

| Caller | Current Code | Migrated Code |
|--------|--------------|---------------|
| `tools/session/index.ts` | `const sessionId = getCurrentSessionId();` | `const state = await getSession(); // sessionId no longer needed` |
| `inngest/workflows/sessionState.ts` | `const id = getCurrentSessionId();` | `const state = await getSession(); // Use state.version for correlation` |
| Internal alias | `export function getCurrentSessionId()` | Remove - no longer needed |

### Backward Compatibility Adapter (Optional)

If gradual migration is needed:

```typescript
/**
 * @deprecated Session IDs removed in single-session model.
 * Use getSession() to retrieve session state directly.
 * Returns constant sentinel for compatibility.
 */
export function getCurrentSessionId(): string {
  logger.warn("getCurrentSessionId() is deprecated - use getSession() instead");
  return "default-session";  // Constant sentinel value
}
```

**Note**: This adapter is NOT recommended for final design. Clean break preferred.

---

## Question 5: Storage Path Confirmation

### Confirmed Path: `sessions/session`

**Full Brain note path**: `sessions/session`

### Path Structure

```
Brain notes (project-scoped):
├── sessions/
│   ├── session                    # Main session state (NEW)
│   ├── agent-orchestrator         # Agent context (NEW format)
│   ├── agent-planner              # Agent context (NEW format)
│   └── agent-implementer          # Agent context (NEW format)
│
└── [legacy after migration]
    ├── sessions/session-{uuid1}   # To be deleted
    ├── sessions/session-{uuid2}   # To be deleted
    ├── sessions/current-session   # To be deleted
    ├── session-{uuid1}-agent-*    # To be deleted
    └── session-{uuid2}-agent-*    # To be deleted
```

### Implementation Constants

```typescript
// src/services/session/brain-persistence.ts

/**
 * Brain note path for single session state.
 * Replaces session-{sessionId} pattern.
 */
const SESSION_PATH = "sessions/session";

/**
 * Brain note path prefix for agent context.
 * Format: sessions/agent-{agentType}
 */
const AGENT_CONTEXT_PREFIX = "sessions/agent-";

// REMOVE: SESSION_PATH_PREFIX = "sessions/session-"
// REMOVE: CURRENT_SESSION_PATH = "sessions/current-session"
```

### Read/Write Operations

```typescript
// Save session (single location)
async saveSession(session: SessionState): Promise<void> {
  await client.callTool({
    name: "write_note",
    arguments: {
      path: SESSION_PATH,  // "sessions/session"
      content: JSON.stringify(session, null, 2),
      project: this.projectPath,
    },
  });
}

// Load session (single location)
async loadSession(): Promise<SessionState | null> {
  const result = await client.callTool({
    name: "read_note",
    arguments: {
      identifier: SESSION_PATH,  // "sessions/session"
      project: this.projectPath,
    },
  });

  // Parse and return
  return JSON.parse(textContent) as SessionState;
}
```

### Project Scoping

All notes are scoped to the project via the `project` parameter:

```typescript
await client.callTool({
  name: "write_note",
  arguments: {
    path: "sessions/session",
    content: sessionData,
    project: "/path/to/project",  // Project boundary
  },
});
```

**Result**: Each project has its own `sessions/session` note with no cross-project contamination.

---

## Question 6: Test Coverage Requirements

### Test Categories

| Category | Type | Count | Purpose |
|----------|------|-------|---------|
| Unit | Internal logic | 12 | Validate individual functions |
| Integration | Brain MCP interaction | 8 | Verify persistence layer |
| Migration | Upgrade scenarios | 6 | Ensure smooth migration |
| E2E | Full workflow | 4 | Validate end-to-end behavior |
| **Total** | | **30** | Comprehensive coverage |

### Unit Tests (12 tests)

**File**: `src/services/session/__tests__/session.test.ts`

```typescript
describe('Session Service - Single Session Model', () => {
  describe('getSession', () => {
    it('loads session from Brain note at sessions/session', async () => {
      // Verify path and parsing
    });

    it('returns null when session note does not exist', async () => {
      // Verify null handling
    });

    it('creates default session if none exists', async () => {
      // Verify initialization
    });
  });

  describe('setSession', () => {
    it('updates session state and increments version', async () => {
      // Verify version increment
    });

    it('preserves mode history across updates', async () => {
      // Verify immutability
    });

    it('handles concurrent writes with last-write-wins', async () => {
      // Verify LWW behavior
    });
  });

  describe('Lifecycle Management', () => {
    it('initSession no longer creates UUID-based directories', async () => {
      // Verify no filesystem session dirs
    });

    it('cleanupSession removes session note from Brain', async () => {
      // Verify cleanup
    });

    it('cleanupOrphanSessions is now a no-op', async () => {
      // Verify orphan cleanup removed
    });
  });

  describe('Backward Compatibility', () => {
    it('getCurrentSessionId is removed from exports', () => {
      // Verify export removal
    });

    it('getSessionId returns null (deprecated)', () => {
      // Verify deprecation
    });

    it('initSession returns constant sentinel value', () => {
      // Verify return value change
    });
  });
});
```

### Integration Tests (8 tests)

**File**: `src/services/session/__tests__/brain-persistence.test.ts`

```typescript
describe('BrainSessionPersistence - Single Session', () => {
  describe('saveSession', () => {
    it('writes to sessions/session path', async () => {
      // Verify write_note call with correct path
    });

    it('does not write to current-session pointer', async () => {
      // Verify pointer removal
    });
  });

  describe('loadSession', () => {
    it('reads from sessions/session path', async () => {
      // Verify read_note call
    });

    it('handles missing session gracefully', async () => {
      // Verify null return
    });
  });

  describe('Agent Context', () => {
    it('saves agent context without sessionId in path', async () => {
      // Verify sessions/agent-{agent} path
    });

    it('loads agent context from new path format', async () => {
      // Verify read from sessions/agent-{agent}
    });

    it('overwrites previous agent context on save', async () => {
      // Verify single location per agent
    });
  });

  describe('Error Handling', () => {
    it('throws BrainUnavailableError when Brain MCP down', async () => {
      // Verify error propagation
    });
  });
});
```

### Migration Tests (6 tests)

**File**: `src/services/session/__tests__/migration.test.ts`

```typescript
describe('Session Migration - Multi to Single', () => {
  describe('consolidateHistoricSessions', () => {
    it('selects most recent session from 5 candidates', async () => {
      // Setup 5 sessions with different timestamps
      // Verify most recent wins
    });

    it('handles identical timestamps with sessionId tiebreaker', async () => {
      // Verify deterministic selection
    });

    it('skips corrupted sessions during consolidation', async () => {
      // Verify error tolerance
    });

    it('removes sessionId field from consolidated state', async () => {
      // Verify field removal
    });

    it('archives old session notes after consolidation', async () => {
      // Verify cleanup
    });

    it('migrates agent context to new path format', async () => {
      // Verify agent context migration
    });
  });
});
```

### E2E Tests (4 tests)

**File**: `src/services/session/__tests__/e2e.test.ts`

```typescript
describe('Session E2E - Single Session Workflow', () => {
  it('completes full workflow: init → update → mode change → cleanup', async () => {
    // Full lifecycle validation
  });

  it('survives Brain MCP disconnect and reconnect', async () => {
    // Resilience testing
  });

  it('handles rapid successive updates without corruption', async () => {
    // Stress test
  });

  it('migrates existing multi-session project on first access', async () => {
    // Migration integration
  });
});
```

### Coverage Targets

| Module | Target | Rationale |
|--------|--------|-----------|
| `session/index.ts` | 95% | Core service - critical path |
| `session/brain-persistence.ts` | 90% | Integration layer - error paths |
| `session/types.ts` | 100% | Type guards and schemas |
| `tools/session/index.ts` | 85% | Tool handler - user-facing |
| Overall | 92% | High confidence threshold |

### CI Integration

```yaml
# .github/workflows/test.yml
- name: Run session tests
  run: npm test -- src/services/session

- name: Coverage check
  run: npm run coverage -- --threshold=92
```

---

## Question 7: Backward Compatibility Strategy

### Migration Philosophy

**Clean Break with Safety Net**: Remove sessionId entirely, provide clear migration path, add deprecation warnings for transition period.

### API Changes

| Function | Current Signature | New Signature | Strategy |
|----------|------------------|---------------|----------|
| `initSession()` | `(): string` (returns UUID) | `(): void` | Return void, log warning if return value used |
| `getSessionId()` | `(): string \| null` | REMOVED | Delete export |
| `getCurrentSessionId()` | `(): string \| null` | REMOVED | Delete export |
| `setCurrentSessionId()` | `(id: string): Promise<void>` | REMOVED | Delete export |
| `getSession()` | `(id?: string): Promise<SessionState \| null>` | `(): Promise<SessionState \| null>` | Remove optional parameter |
| `setSession()` | `(updates, id?: string): Promise<SessionState \| null>` | `(updates): Promise<SessionState \| null>` | Remove optional parameter |
| `cleanupSession()` | `(): Promise<void>` | `(): Promise<void>` | No change (semantics simplified) |
| `cleanupOrphanSessions()` | `(): Promise<void>` | REMOVED or NO-OP | Delete or make no-op |

### Caller Migration

**Step 1: Identify all callers**

```bash
# Find all sessionId references
grep -r "sessionId" src/ --include="*.ts" | grep -v "__tests__" > sessionid-refs.txt
grep -r "getCurrentSessionId" src/ --include="*.ts" >> sessionid-refs.txt
grep -r "getSessionId" src/ --include="*.ts" >> sessionid-refs.txt
```

**Step 2: Categorize callers**

| Caller Type | Count | Migration Strategy |
|-------------|-------|-------------------|
| Tool handlers | 3 | Remove sessionId display from responses |
| Inngest workflows | 2 | Use version field for correlation instead |
| Logging statements | 15 | Remove sessionId from log context |
| Test files | 12 | Update to single-session model |

**Step 3: Automated migration**

```typescript
// scripts/migrate-sessionid-removal.ts

import * as fs from 'fs';
import * as path from 'path';

const replacements = [
  {
    pattern: /getCurrentSessionId\(\)/g,
    replacement: '/* sessionId removed */ null',
    warning: 'getCurrentSessionId() call found - manual review needed',
  },
  {
    pattern: /const sessionId = [^;]+;/g,
    replacement: '// sessionId removed',
    warning: 'sessionId variable declaration - review usage',
  },
  {
    pattern: /sessionId: state\.sessionId/g,
    replacement: '// sessionId: removed',
    warning: 'sessionId field access in response object',
  },
];

async function migrateFile(filePath: string): Promise<void> {
  let content = await fs.promises.readFile(filePath, 'utf-8');
  let modified = false;

  for (const { pattern, replacement, warning } of replacements) {
    if (pattern.test(content)) {
      console.warn(`${filePath}: ${warning}`);
      content = content.replace(pattern, replacement);
      modified = true;
    }
  }

  if (modified) {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    console.log(`Migrated: ${filePath}`);
  }
}

// Run migration
const srcFiles = glob.sync('src/**/*.ts');
for (const file of srcFiles) {
  await migrateFile(file);
}
```

### SessionState Schema Changes

```typescript
// Current
interface SessionState {
  sessionId: string;  // UUID identifying this session
  currentMode: WorkflowMode;
  // ...
}

// Proposed
interface SessionState {
  sessionId?: undefined;  // REMOVED - explicitly undefined for type safety
  currentMode: WorkflowMode;
  // ...
}

// Or simply remove the field entirely
interface SessionState {
  currentMode: WorkflowMode;
  // ...
}
```

**Validation**: Update Zod schema to reject `sessionId` field:

```typescript
export const SessionStateSchema = z.object({
  sessionId: z.undefined().optional(),  // Reject if present
  currentMode: WorkflowModeSchema,
  activeTask: z.string().optional(),
  activeFeature: z.string().optional(),
  modeHistory: z.array(ModeHistoryEntrySchema),
  version: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
```

### Deprecation Timeline

| Week | Milestone | Actions |
|------|-----------|---------|
| 0 | **Design approval** | Finalize answers, get critic approval |
| 1 | **Add deprecation warnings** | Log warnings for removed functions, mark as @deprecated |
| 2 | **Implement migration script** | Automated code migration, run on codebase |
| 3 | **Update tests** | Rewrite tests for single-session model |
| 4 | **Integration testing** | E2E testing with real Brain MCP |
| 5 | **Remove deprecated code** | Delete removed functions, clean up |
| 6 | **Documentation update** | Update README, API docs, changelog |

### Breaking Change Documentation

**CHANGELOG.md entry**:

```markdown
## [2.0.0] - 2026-XX-XX

### BREAKING CHANGES

- **Session management simplified to single session per project**
  - Removed: `getCurrentSessionId()`, `getSessionId()`, `setCurrentSessionId()`
  - Changed: `initSession()` now returns `void` instead of session ID
  - Changed: `getSession()` and `setSession()` no longer accept optional `sessionId` parameter
  - Migration: Run `npm run migrate:sessionid` to update calling code
  - Impact: Ephemeral session directories removed, Brain notes at `sessions/session` instead of `sessions/session-{uuid}`

### Added
- Automatic consolidation of historic multi-session projects on first access
- Last-write-wins conflict resolution for concurrent updates

### Removed
- Orphan session cleanup (no longer needed)
- Session lifecycle filesystem management
- UUID-based session directories in `~/.local/state/brain/sessions/`
```

---

## Revised Effort Estimate

Based on critic feedback and detailed design specifications:

| Phase | Original Estimate | Revised Estimate | Reason for Adjustment |
|-------|------------------|------------------|----------------------|
| **Design** | 4 hours | 6 hours | +2 hours for 7 questions and detailed specs |
| **Implementation** | 8 hours | 10 hours | +2 hours for migration consolidation logic |
| **Testing** | 4 hours | 8 hours | +4 hours for 30 tests instead of 15 |
| **Migration** | 2 hours | 4 hours | +2 hours for automated migration script |
| **Documentation** | - | 2 hours | +2 hours for comprehensive breaking changes doc |
| **Total** | 18 hours | **30 hours** | +67% for thoroughness |

### Breakdown by Task

| Task | Hours | Assignee |
|------|-------|----------|
| Answer 7 critical questions | 2 | Architect |
| Update brain-persistence.ts | 3 | Implementer |
| Update session/index.ts | 2 | Implementer |
| Remove getCurrentSessionId() references | 2 | Implementer |
| Implement consolidation algorithm | 3 | Implementer |
| Write 30 tests (unit, integration, migration, E2E) | 8 | QA + Implementer |
| Write migration automation script | 2 | Implementer |
| Update documentation | 2 | Explainer |
| Manual testing and validation | 3 | QA |
| Code review and refinement | 3 | Critic + Architect |
| **Total** | **30 hours** | |

---

## Version Conflict Resolution Algorithm (Detailed)

### Algorithm Specification

```typescript
/**
 * Last-Write-Wins (LWW) conflict resolution for session updates.
 *
 * Assumptions:
 * - Brain MCP write_note is atomic per note
 * - Clock skew negligible (single machine)
 * - Conflict probability < 1% (single user, single session)
 *
 * Algorithm:
 * 1. Load current session state (read)
 * 2. Check version conflict (optional)
 * 3. Apply updates to loaded state
 * 4. Increment version
 * 5. Write updated state (last write wins)
 *
 * @param updates - Session updates to apply
 * @returns Updated session state
 */
async function setSessionWithLWW(updates: SessionUpdates): Promise<SessionState> {
  // Step 1: Load current state
  let state = await persistence.loadSession();

  if (!state) {
    // Initialize if missing
    state = createDefaultSessionState();
  }

  const originalVersion = state.version;

  // Step 2: Optional conflict detection (log only, don't fail)
  if (originalVersion !== state.version) {
    logger.warn(
      {
        originalVersion,
        currentVersion: state.version,
        updates,
      },
      "Version mismatch detected - proceeding with LWW"
    );
  }

  // Step 3: Apply updates (immutable)
  const now = new Date().toISOString();

  if (updates.mode !== undefined && updates.mode !== state.currentMode) {
    state = {
      ...state,
      currentMode: updates.mode,
      modeHistory: [...state.modeHistory, { mode: updates.mode, timestamp: now }],
    };
  }

  if (updates.task !== undefined) {
    state = { ...state, activeTask: updates.task || undefined };
  }

  if (updates.feature !== undefined) {
    state = { ...state, activeFeature: updates.feature || undefined };
  }

  // Step 4: Increment version and update timestamp
  state = {
    ...state,
    version: state.version + 1,
    updatedAt: now,
  };

  // Step 5: Write to Brain note (atomic, last write wins)
  await persistence.saveSession(state);

  logger.info(
    {
      version: state.version,
      mode: state.currentMode,
    },
    "Session updated with LWW"
  );

  return state;
}
```

### Conflict Scenarios

| Scenario | Behavior | Example |
|----------|----------|---------|
| **No conflict** | Normal update | Version 1 → 2 |
| **Concurrent writes** | Second write overwrites first | A writes v2, B writes v3 → v3 visible |
| **Clock skew** | Timestamp comparison unreliable | Use version number instead |
| **Corrupted version** | Reset to 0 | Parse error → version = 0, log warning |

### Monitoring

Add metrics to detect conflict frequency:

```typescript
// metrics.ts
export const sessionConflicts = new Counter({
  name: 'brain_session_conflicts_total',
  help: 'Total number of version conflicts detected',
  labelNames: ['resolution'],
});

// In setSessionWithLWW
if (originalVersion !== state.version) {
  sessionConflicts.inc({ resolution: 'lww' });
}
```

---

## Migration Script Pseudocode (Complete)

```typescript
/**
 * Migration script to consolidate multi-session projects into single session.
 *
 * Run once per project after upgrade to single-session model.
 *
 * Steps:
 * 1. Discover all historic sessions
 * 2. Select most recent session
 * 3. Consolidate agent context
 * 4. Write to new path (sessions/session)
 * 5. Archive old sessions
 * 6. Cleanup current-session pointer
 *
 * Usage:
 *   npx ts-node scripts/migrate-to-single-session.ts /path/to/project
 */

import { BrainSessionPersistence } from '../src/services/session/brain-persistence';
import { SessionState, AgentType } from '../src/services/session/types';

interface SessionCandidate {
  sessionId: string;
  state: SessionState;
  updatedAt: Date;
}

async function migrateToSingleSession(projectPath: string): Promise<void> {
  console.log(`Migrating project: ${projectPath}`);

  const persistence = new BrainSessionPersistence({ projectPath });

  // Step 1: Discover historic sessions
  console.log('Step 1: Discovering historic sessions...');
  const candidates = await discoverHistoricSessions(persistence);

  if (candidates.length === 0) {
    console.log('No historic sessions found - creating default session');
    await persistence.saveSession(createDefaultSessionState());
    return;
  }

  console.log(`Found ${candidates.length} historic sessions`);

  // Step 2: Select winner (most recent)
  console.log('Step 2: Selecting most recent session...');
  const winner = selectWinner(candidates);
  console.log(`Selected session ${winner.sessionId} (updated: ${winner.updatedAt})`);

  // Step 3: Consolidate agent context
  console.log('Step 3: Consolidating agent context...');
  await consolidateAgentContext(persistence, candidates, winner);

  // Step 4: Write to new path
  console.log('Step 4: Writing consolidated session...');
  const consolidated = removeSessionId(winner.state);
  await persistence.saveSession(consolidated);

  // Step 5: Archive old sessions
  console.log('Step 5: Archiving old sessions...');
  await archiveOldSessions(persistence, candidates);

  // Step 6: Cleanup pointer
  console.log('Step 6: Cleaning up current-session pointer...');
  await cleanupPointer(persistence);

  console.log('Migration complete!');
}

async function discoverHistoricSessions(
  persistence: BrainSessionPersistence
): Promise<SessionCandidate[]> {
  const candidates: SessionCandidate[] = [];

  // List all notes matching sessions/session-* pattern
  const notes = await listNotes({
    pattern: 'sessions/session-*',
    project: persistence.projectPath,
  });

  for (const note of notes) {
    try {
      // Extract sessionId from path
      const match = note.path.match(/sessions\/session-(.+)/);
      if (!match) continue;

      const sessionId = match[1];

      // Load session state
      const state = await persistence.loadSession(sessionId);
      if (!state || state.deleted) continue;

      candidates.push({
        sessionId,
        state,
        updatedAt: new Date(state.updatedAt),
      });
    } catch (error) {
      console.warn(`Skipping corrupted session: ${note.path}`, error);
    }
  }

  return candidates;
}

function selectWinner(candidates: SessionCandidate[]): SessionCandidate {
  // Sort by updatedAt descending
  const sorted = candidates.sort((a, b) =>
    b.updatedAt.getTime() - a.updatedAt.getTime()
  );

  // Tiebreaker: lexicographic sort on sessionId
  if (sorted.length > 1 &&
      sorted[0].updatedAt.getTime() === sorted[1].updatedAt.getTime()) {
    sorted.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
  }

  return sorted[0];
}

async function consolidateAgentContext(
  persistence: BrainSessionPersistence,
  candidates: SessionCandidate[],
  winner: SessionCandidate
): Promise<void> {
  const agents: AgentType[] = [
    'orchestrator', 'planner', 'implementer', 'qa', 'analyst',
    'architect', 'critic', 'retrospective', 'memory', 'skillbook'
  ];

  for (const agent of agents) {
    // Load agent context from winner session
    const context = await persistence.loadAgentContext(winner.sessionId, agent);

    if (context) {
      // Write to new path format (sessions/agent-{agent})
      await persistence.saveAgentContext(agent, context);
      console.log(`  Migrated agent context: ${agent}`);
    }
  }

  // Cleanup old agent context notes
  for (const candidate of candidates) {
    for (const agent of agents) {
      const oldPath = `session-${candidate.sessionId}-agent-${agent}`;
      await deleteNote(oldPath);
    }
  }
}

function removeSessionId(state: SessionState): SessionState {
  const { sessionId, ...rest } = state;
  return {
    ...rest,
    version: state.version + 1,
    updatedAt: new Date().toISOString(),
  };
}

async function archiveOldSessions(
  persistence: BrainSessionPersistence,
  candidates: SessionCandidate[]
): Promise<void> {
  for (const candidate of candidates) {
    const oldPath = `sessions/session-${candidate.sessionId}`;
    await deleteNote(oldPath);
    console.log(`  Archived: ${oldPath}`);
  }
}

async function cleanupPointer(persistence: BrainSessionPersistence): Promise<void> {
  const pointerPath = 'sessions/current-session';
  await deleteNote(pointerPath);
  console.log(`  Removed: ${pointerPath}`);
}

// Helper: Delete note (writes tombstone)
async function deleteNote(path: string): Promise<void> {
  await writeNote(path, JSON.stringify({ deleted: true, deletedAt: new Date().toISOString() }));
}

// Run migration
const projectPath = process.argv[2] || process.cwd();
migrateToSingleSession(projectPath)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
```

---

## Summary

All 7 critical questions have been answered with concrete specifications:

| Question | Answer Summary |
|----------|----------------|
| 1. Agent context path | `sessions/agent-{agent}` (removed sessionId prefix) |
| 2. Version conflicts | Last-write-wins with optional version logging |
| 3. Migration consolidation | Most recent session wins, determined by `updatedAt` timestamp |
| 4. getCurrentSessionId() export | Remove entirely, replace with `getSession()` |
| 5. Storage path | `sessions/session` (confirmed) |
| 6. Test coverage | 30 tests (12 unit, 8 integration, 6 migration, 4 E2E) |
| 7. Backward compatibility | Clean break with automated migration script and deprecation warnings |

**Revised effort estimate**: 30 hours (was 18 hours)

**Next steps**:

1. Submit to critic for final approval
2. Begin implementation after approval
3. Execute in phases per deprecation timeline

---

**Status**: [COMPLETE] - Ready for critic review
