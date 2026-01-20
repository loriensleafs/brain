---
type: task
id: TASK-005
title: Implement SessionService with workflow tracking
status: complete
priority: P0
complexity: L
estimate: 8h
related:
  - DESIGN-001
  - REQ-001
blocked_by:
  - TASK-003
  - TASK-004
blocks:
  - TASK-007
assignee: implementer
created: 2026-01-18
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - session-service
  - workflow-tracking
---

# TASK-005: Implement SessionService with Workflow Tracking

## Design Context

- DESIGN-001: Session state architecture (Component 5: Session Service)

## Objective

Implement SessionService class providing high-level API for session state management with orchestrator workflow tracking.

## Scope

**In Scope**:

- SessionService class with CRUD operations
- createSession method
- getSession method
- updateSession method (using optimistic locking)
- addAgentInvocation method
- addDecision method
- addVerdict method
- completeAgentInvocation method
- compactSessionHistory method
- In-memory cache (Map<sessionId, SessionState>)
- MCP initialization logic to load current session

**Out of Scope**:

- Inngest workflow integration (separate task)
- Brain CLI commands (TASK-006)
- Hook integration (TASK-006)

## Acceptance Criteria

- [ ] File created at `apps/mcp/src/services/session/index.ts`
- [ ] SessionService class implemented with in-memory cache
- [ ] createSession initializes new SessionState with version 0
- [ ] getSession reads from cache, falls back to Brain persistence
- [ ] updateSession uses updateSessionWithLocking for concurrency safety
- [ ] addAgentInvocation adds invocation to agentHistory
- [ ] addAgentInvocation updates activeAgent and lastAgentChange
- [ ] addDecision adds decision to orchestratorWorkflow.decisions
- [ ] addVerdict adds verdict to orchestratorWorkflow.verdicts
- [ ] completeAgentInvocation finds in-progress invocation and marks complete
- [ ] completeAgentInvocation sets status to "blocked" if blockers present
- [ ] compactSessionHistory triggers when agentHistory.length > 10
- [ ] compactSessionHistory keeps last 3 invocations
- [ ] compactSessionHistory stores full history in Brain note
- [ ] initializeMCP method loads current session into cache on startup
- [ ] Class exported

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/src/services/session/index.ts` | Create | SessionService implementation |

## Implementation Notes

Follow DESIGN-001 Component 5. Key methods:

1. **createSession**:
   - Generate sessionId (UUID)
   - Initialize SessionState with defaults
   - Set version to 0, protocolStartComplete to false
   - Save via BrainSessionPersistence

2. **updateSession**:
   - Call updateSessionWithLocking with updates
   - Update in-memory cache on success

3. **addAgentInvocation**:
   - Initialize orchestratorWorkflow if null
   - Push invocation to agentHistory
   - Update activeAgent and lastAgentChange
   - Check if compaction needed (length > 10)

4. **completeAgentInvocation**:
   - Find most recent in-progress invocation for agent
   - Set completedAt, status, output
   - Determine status based on blockers

5. **compactSessionHistory**:
   - Keep last 3 invocations
   - Store historical invocations in Brain note
   - Update compactionHistory array

Example structure:

```typescript
export class SessionService {
  private cache = new Map<string, SessionState>();
  private persistence: BrainSessionPersistence;

  constructor(brainMCP: BrainMCPClient) {
    this.persistence = new BrainSessionPersistence(brainMCP);
  }

  async createSession(sessionId: string): Promise<SessionState> {
    const session: SessionState = {
      sessionId,
      currentMode: "analysis",
      modeHistory: [],
      protocolStartComplete: false,
      protocolEndComplete: false,
      protocolStartEvidence: {},
      protocolEndEvidence: {},
      orchestratorWorkflow: null,
      version: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.persistence.saveSession(session);
    this.cache.set(sessionId, session);
    return session;
  }

  // ... other methods
}
```

## Testing Requirements

- [ ] Unit test: createSession initializes state correctly
- [ ] Unit test: getSession reads from cache
- [ ] Unit test: getSession falls back to Brain persistence
- [ ] Unit test: updateSession uses optimistic locking
- [ ] Unit test: addAgentInvocation updates workflow correctly
- [ ] Unit test: addDecision adds to decisions array
- [ ] Unit test: addVerdict adds to verdicts array
- [ ] Unit test: completeAgentInvocation finds and updates invocation
- [ ] Unit test: compactSessionHistory triggers at threshold
- [ ] Unit test: compactSessionHistory stores history in Brain note
- [ ] Integration test: Full workflow from create to compaction
