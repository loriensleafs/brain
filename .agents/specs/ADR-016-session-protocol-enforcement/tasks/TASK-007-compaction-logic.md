---
type: task
id: TASK-007
title: Implement session history compaction logic
status: complete
priority: P1
complexity: M
estimate: 5h
related:
  - DESIGN-001
  - REQ-001
blocked_by:
  - TASK-005
  - TASK-006
blocks: []
assignee: implementer
created: 2026-01-18
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - compaction
  - session-state
---

# TASK-007: Implement Session History Compaction Logic

## Design Context

- DESIGN-001: Session state architecture (Component 7: Session History Compaction)

## Objective

Implement compaction algorithm to prevent unbounded growth of agent history in session state.

## Scope

**In Scope**:

- compactSessionState function
- Threshold check (agentHistory.length > 10)
- Keep last 3 invocations logic
- Store historical invocations in Brain note
- CompactionEntry tracking
- Preserve all decisions and verdicts (no summarization)

**Out of Scope**:

- Automatic compaction triggers (handled in SessionService, TASK-005)
- Compaction retention policy (separate operational concern)
- Compaction rollback mechanism

## Acceptance Criteria

- [ ] File created at `apps/mcp/src/services/session/compaction.ts`
- [ ] compactSessionState function accepts SessionState
- [ ] Function throws error if agentHistory.length <= 10
- [ ] Function keeps last 3 invocations in session state
- [ ] Function stores historical invocations in Brain note at `sessions/session-{sessionId}-history-{timestamp}`
- [ ] Historical note contains: sessionId, compactedAt, fullHistory array
- [ ] Historical note has category "session-history"
- [ ] Function updates compactionHistory array with notePath, compactedAt, count
- [ ] Function preserves all decisions (never compacted)
- [ ] Function preserves all verdicts (never compacted)
- [ ] Function returns CompactionResult with compactedState and historyNote
- [ ] Function exported

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/src/services/session/compaction.ts` | Create | Compaction algorithm implementation |

## Implementation Notes

Follow DESIGN-001 Component 7. Key algorithm:

```
if agentHistory.length <= 10:
  throw error "Compaction not needed"

recentInvocations = agentHistory.slice(-3)
historicalInvocations = agentHistory.slice(0, -3)

historyNotePath = `sessions/session-{sessionId}-history-{timestamp}`
write Brain note with {sessionId, compactedAt, fullHistory: historicalInvocations}

compactedWorkflow = {
  ...workflow,
  agentHistory: recentInvocations,
  compactionHistory: [
    ...workflow.compactionHistory,
    {notePath, compactedAt, count: historicalInvocations.length}
  ]
}

return {compactedState, historyNote: historyNotePath}
```

Example structure:

```typescript
export async function compactSessionState(
  session: SessionState
): Promise<CompactionResult> {
  const workflow = session.orchestratorWorkflow;
  if (!workflow || workflow.agentHistory.length <= 10) {
    throw new Error("Compaction not needed");
  }

  const recentInvocations = workflow.agentHistory.slice(-3);
  const historicalInvocations = workflow.agentHistory.slice(0, -3);

  const historyNotePath = `sessions/session-${session.sessionId}-history-${Date.now()}`;
  await brainMCP.writeNote({
    title: historyNotePath,
    content: JSON.stringify({
      sessionId: session.sessionId,
      compactedAt: new Date().toISOString(),
      fullHistory: historicalInvocations,
    }, null, 2),
    category: "session-history",
  });

  const compactedWorkflow = {
    ...workflow,
    agentHistory: recentInvocations,
    compactionHistory: [
      ...(workflow.compactionHistory || []),
      {
        notePath: historyNotePath,
        compactedAt: new Date().toISOString(),
        count: historicalInvocations.length,
      },
    ],
  };

  return {
    compactedState: { ...session, orchestratorWorkflow: compactedWorkflow },
    historyNote: historyNotePath,
  };
}
```

## Testing Requirements

- [ ] Unit test: Compaction throws error when history <= 10
- [ ] Unit test: Compaction keeps last 3 invocations
- [ ] Unit test: Compaction stores historical invocations in Brain note
- [ ] Unit test: CompactionEntry added with correct metadata
- [ ] Unit test: Decisions preserved after compaction
- [ ] Unit test: Verdicts preserved after compaction
- [ ] Unit test: Multiple compactions append to compactionHistory
- [ ] Integration test: Compaction at 11, 22, 33 invocations
