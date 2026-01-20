---
type: task
id: TASK-003
title: Implement Brain note persistence for session state
status: complete
priority: P0
complexity: M
estimate: 5h
related:
  - DESIGN-001
  - REQ-005
blocked_by:
  - TASK-001
  - TASK-002
blocks:
  - TASK-004
  - TASK-005
assignee: implementer
created: 2026-01-18
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - brain-mcp
  - persistence
  - session-state
---

# TASK-003: Implement Brain Note Persistence for Session State

## Design Context

- DESIGN-001: Session state architecture (Component 2: Brain Note Persistence)

## Objective

Implement BrainSessionPersistence class to persist session state to Brain MCP notes, replacing the file cache approach.

## Scope

**In Scope**:

- BrainSessionPersistence class with saveSession, loadSession, getCurrentSession methods
- saveAgentContext method for brain specialist agents
- Brain note paths: `sessions/session-{sessionId}`, `sessions/current-session`
- Brain note category: "sessions"
- Integration with signing functions (TASK-002)

**Out of Scope**:

- File cache code removal (TASK-008)
- MCP startup initialization (TASK-005)
- Optimistic locking (TASK-004)

## Acceptance Criteria

- [ ] File created at `apps/mcp/src/services/session/brain-persistence.ts`
- [ ] BrainSessionPersistence class implemented with constructor accepting BrainMCPClient
- [ ] saveSession method writes signed state to `sessions/session-{sessionId}`
- [ ] saveSession updates current session pointer at `sessions/current-session`
- [ ] loadSession reads state from `sessions/session-{sessionId}`
- [ ] loadSession verifies signature via verifySessionState
- [ ] loadSession returns null if session not found
- [ ] loadSession throws error if signature invalid
- [ ] getCurrentSession reads pointer then loads session
- [ ] getCurrentSession returns null if no current session
- [ ] saveAgentContext writes invocation to `session-{sessionId}-agent-{agent}`
- [ ] Agent context notes have category "session-agents"
- [ ] All methods use process.cwd() for project path
- [ ] Class exported

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/src/services/session/brain-persistence.ts` | Create | Brain note persistence implementation |

## Implementation Notes

Follow DESIGN-001 Component 2 implementation. Key points:

1. **saveSession**:
   - Sign state using signSessionState
   - Write to `sessions/session-{sessionId}` with category "sessions"
   - Update pointer at `sessions/current-session`

2. **loadSession**:
   - Read note via brainMCP.readNote
   - Parse JSON
   - Verify signature
   - Return SessionState or null

3. **getCurrentSession**:
   - Read pointer note
   - Extract sessionId
   - Call loadSession

4. **saveAgentContext**:
   - Write invocation JSON to `session-{sessionId}-agent-{agent}`
   - Use category "session-agents"

Example structure:

```typescript
export class BrainSessionPersistence {
  constructor(private brainMCP: BrainMCPClient) {}

  async saveSession(session: SessionState): Promise<void> {
    const signed = signSessionState(session);
    await this.brainMCP.writeNote({
      title: `sessions/session-${session.sessionId}`,
      content: JSON.stringify(signed, null, 2),
      category: "sessions",
      project: process.cwd(),
    });
    // ... update pointer
  }

  // ... other methods
}
```

## Testing Requirements

- [ ] Unit test: saveSession writes to correct Brain note path
- [ ] Unit test: saveSession updates current session pointer
- [ ] Unit test: loadSession reads and verifies signature
- [ ] Unit test: loadSession throws error on invalid signature
- [ ] Unit test: loadSession returns null for missing session
- [ ] Unit test: getCurrentSession loads active session
- [ ] Unit test: saveAgentContext writes to correct path with category
- [ ] Integration test: Save then load session (round-trip)
