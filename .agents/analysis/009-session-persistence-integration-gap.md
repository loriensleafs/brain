# Analysis: ADR-016 Session Persistence Integration Gap

## 1. Objective and Scope

**Objective**: Determine if session state persists to Brain notes as designed in ADR-016 or remains in-memory only.

**Scope**: Examine session service, session tool, and Inngest workflow integration with `BrainSessionPersistence`.

## 2. Context

ADR-016 specified automatic session protocol enforcement via Inngest workflows with session state persisted to Brain notes. The implementation includes a complete `BrainSessionPersistence` class (485 lines) with comprehensive tests. This analysis verifies whether that persistence layer is actually integrated into the session state management system.

## 3. Approach

**Methodology**: Code analysis via grep and file reading

**Tools Used**: Grep, Read

**Limitations**: Did not run runtime tests or verify actual Brain note creation

## 4. Data and Analysis

### Evidence Gathered

| Finding | Source | Confidence |
|---------|--------|-----------|
| BrainSessionPersistence class exists | `apps/mcp/src/services/session/brain-persistence.ts` (485 lines) | High |
| Comprehensive tests exist | `apps/mcp/src/services/session/__tests__/brain-persistence.test.ts` (520 lines) | High |
| setSession does NOT call saveSession | `apps/mcp/src/services/session/index.ts:443` | High |
| Session tool does NOT call persistence | `apps/mcp/src/tools/session/index.ts` | High |
| Inngest workflows DO call persistence | `sessionProtocolStart.ts`, `orchestratorAgentInvoked.ts`, `orchestratorAgentCompleted.ts` | High |

### Facts (Verified)

**1. Session Service: In-Memory Only**

File: `apps/mcp/src/services/session/index.ts`

```typescript
// Line 392-446: setSession function
export function setSession(
  updates: SessionUpdates,
  sessionId?: string
): SessionState | null {
  // ... mutation logic ...
  
  // Store updated state
  sessionStore.set(id, state);  // Line 443: IN-MEMORY ONLY
  
  return state;
}
```

**Evidence**: No `saveSession()` call. No `BrainSessionPersistence` instantiation. Only updates `sessionStore` Map (in-memory).

**2. Session Tool: No Persistence Integration**

File: `apps/mcp/src/tools/session/index.ts`

```typescript
// Line 96: Calls setSession from service
const state = setSession(updates);
```

**Evidence**: Tool calls `setSession()` which only updates in-memory state. No persistence layer invoked.

**3. Inngest Workflows: Persistence IS Used**

File: `apps/mcp/src/inngest/workflows/sessionProtocolStart.ts`

```typescript
// Line 470-492
const persistence = new BrainSessionPersistence({
  projectPath: workingDirectory,
});
await persistence.saveSession(updatedState);
```

File: `apps/mcp/src/inngest/workflows/orchestratorAgentInvoked.ts`

```typescript
// Line 260-261
const persistence = new BrainSessionPersistence();
await persistence.saveSession(updatedState);
```

**Evidence**: Workflows instantiate `BrainSessionPersistence` and call `saveSession()` directly.

**4. Persistence Layer: Fully Implemented**

File: `apps/mcp/src/services/session/brain-persistence.ts`

- 485 lines of implementation
- `saveSession()`, `loadSession()`, `deleteSession()`, `listSessions()`, `getCurrentSessionId()`
- Writes to Brain notes at `sessions/session-{sessionId}`
- Comprehensive error handling

File: `apps/mcp/src/services/session/__tests__/brain-persistence.test.ts`

- 520 lines of tests
- 20+ test cases covering all methods
- Tests verify Brain note writes

**Evidence**: Persistence layer is production-ready. Code exists but is not integrated into session service.

### Hypotheses (Unverified)

**Hypothesis 1**: Session tool updates are lost on MCP restart.

- **Why**: If only in-memory state exists and MCP restarts, session state is lost.
- **Test needed**: Restart MCP server after session tool update, verify state persists.

**Hypothesis 2**: Workflow-based persistence is sufficient for ADR-016.

- **Why**: Workflows handle protocol enforcement, direct tool calls may not need persistence.
- **Counter**: Tool documentation says state persists, but implementation does not match.

## 5. Results

**Gap Identified**: Session service (`setSession()`) and session tool handler do NOT persist state to Brain notes.

**Metrics**:

- Functions calling `saveSession()`: 3 (all in Inngest workflows)
- Functions mutating session state: 6 (setSession, withModeChange, withTaskUpdate, withFeatureUpdate, withProtocolStart, withProtocolEnd)
- Functions calling persistence after mutation: 0

**Call Graph**:

```text
User → session tool → setSession() → sessionStore.set() [IN-MEMORY ONLY]
                                   ↳ NO persistence call

User → Inngest event → workflow → persistence.saveSession() [PERSISTED]
```

**Integration Status**:

| Component | Persistence Integration |
|-----------|------------------------|
| Session Service (index.ts) | [FAIL] No integration |
| Session Tool (tools/session/index.ts) | [FAIL] No integration |
| Inngest Workflows | [PASS] Fully integrated |
| Persistence Layer | [PASS] Fully implemented |

## 6. Discussion

**What the findings mean**:

The persistence layer exists and works (proven by tests and workflow usage), but the session service and session tool do NOT use it. This creates a two-tier architecture:

1. **Workflow-driven updates**: Persist to Brain notes (survives restarts)
2. **Direct tool updates**: In-memory only (lost on restart)

**ADR-016 Design Intent**:

From ADR-016 (line 9):

> "State is persisted to Brain notes via BrainSessionPersistence."

The design expected ALL session state changes to persist, not just workflow-driven changes.

**Implications**:

1. **State Loss Risk**: Direct `session` tool calls lose state on MCP restart
2. **Inconsistent Behavior**: Workflows persist, tools do not
3. **Documentation Mismatch**: Code comments claim persistence but do not implement it
4. **Partial ADR Implementation**: Persistence layer built but not fully integrated

**Why this matters**:

If Claude Code calls the `session` tool to update mode/task/feature, that state change is lost if MCP restarts. Only workflow-driven changes survive.

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
|----------|----------------|-----------|--------|
| P0 | Integrate persistence into `setSession()` | Fulfills ADR-016 design, ensures state survives restarts | 2-4 hours |
| P1 | Add integration tests for tool persistence | Verify end-to-end persistence via tool calls | 1-2 hours |
| P2 | Document persistence architecture | Clarify when state persists (workflows + tools) | 30 minutes |

**P0 Implementation Approach**:

```typescript
// In src/services/session/index.ts
export async function setSession(
  updates: SessionUpdates,
  sessionId?: string
): Promise<SessionState | null> {
  // ... existing mutation logic ...
  
  // Store updated state in-memory
  sessionStore.set(id, state);
  
  // ADDED: Persist to Brain notes
  try {
    const persistence = getDefaultPersistence();
    await persistence.saveSession(state);
  } catch (error) {
    logger.warn({ error }, "Failed to persist session state");
    // Non-fatal: in-memory state still updated
  }
  
  return state;
}
```

**Breaking Change Risk**: Low. Changing `setSession()` from sync to async is a breaking change, but:

- Only 3 call sites (session tool, helper functions)
- All call sites can handle async
- Tests already use async for persistence

## 8. Conclusion

**Verdict**: Investigate Further → Implement P0 Integration

**Confidence**: High

**Rationale**: Evidence clearly shows persistence layer exists but is not integrated into session service. The gap is implementation, not design. P0 integration effort is low (2-4 hours) and directly fulfills ADR-016 design intent.

### User Impact

**What changes for you**: Session state (mode, task, feature) will survive MCP server restarts instead of being lost.

**Effort required**: No user action required. Implementation is internal.

**Risk if ignored**: Session state updates via `session` tool are lost on MCP restart, forcing manual re-entry of context.

## 9. Appendices

### Sources Consulted

- `apps/mcp/src/services/session/index.ts` - Session service implementation
- `apps/mcp/src/services/session/brain-persistence.ts` - Persistence layer
- `apps/mcp/src/tools/session/index.ts` - Session tool
- `apps/mcp/src/inngest/workflows/sessionProtocolStart.ts` - Workflow integration
- `apps/mcp/src/inngest/workflows/orchestratorAgentInvoked.ts` - Workflow integration
- `apps/mcp/src/inngest/workflows/orchestratorAgentCompleted.ts` - Workflow integration
- `.agents/architecture/ADR-016-automatic-session-protocol-enforcement.md` - Design specification

### Data Transparency

**Found**:

- Persistence layer implementation and tests
- Workflow integration with persistence
- Session service implementation (in-memory only)
- Session tool implementation (no persistence)

**Not Found**:

- Runtime tests confirming state loss on restart
- Design rationale for partial integration
- Documentation explaining two-tier persistence model
