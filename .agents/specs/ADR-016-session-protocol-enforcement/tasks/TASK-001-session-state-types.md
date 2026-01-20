---
type: task
id: TASK-001
title: Implement session state TypeScript interfaces
status: complete
priority: P0
complexity: S
estimate: 3h
related:
  - DESIGN-001
  - REQ-001
blocked_by: []
blocks:
  - TASK-002
  - TASK-003
assignee: implementer
created: 2026-01-18
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - typescript
  - interfaces
  - session-state
---

# TASK-001: Implement Session State TypeScript Interfaces

## Design Context

- DESIGN-001: Session state architecture with Brain note persistence

## Objective

Create TypeScript type definitions for session state, orchestrator workflow, and related interfaces to enable compile-time type safety and IDE autocomplete.

## Scope

**In Scope**:

- SessionState interface with all fields from DESIGN-001
- OrchestratorWorkflow interface with agent tracking
- AgentInvocation interface for routing metadata
- Decision, Verdict, Handoff interfaces
- CompactionEntry interface
- AgentType union type (16 agent types)
- WorkflowMode type
- SignedSessionState interface extending SessionState

**Out of Scope**:

- Implementation logic (signing, persistence, locking)
- Unit tests (separate task)
- Brain MCP integration

## Acceptance Criteria

- [ ] File created at `apps/mcp/src/services/session/types.ts`
- [ ] SessionState interface includes: sessionId, currentMode, modeHistory, protocolStartComplete, protocolEndComplete, protocolStartEvidence, protocolEndEvidence, orchestratorWorkflow, activeFeature, activeTask, version, createdAt, updatedAt
- [ ] OrchestratorWorkflow interface includes: activeAgent, workflowPhase, agentHistory, decisions, verdicts, pendingHandoffs, compactionHistory, startedAt, lastAgentChange
- [ ] AgentInvocation interface includes: agent, startedAt, completedAt, status, input, output, handoffFrom, handoffTo, handoffReason
- [ ] Decision interface includes: id, type, description, rationale, decidedBy, approvedBy, rejectedBy, timestamp
- [ ] Verdict interface includes: agent, decision, confidence, reasoning, conditions, blockers, timestamp
- [ ] Handoff interface includes: fromAgent, toAgent, reason, context, artifacts, preservedContext, createdAt
- [ ] CompactionEntry interface includes: notePath, compactedAt, count
- [ ] AgentType union includes all 16 agent types
- [ ] WorkflowMode type includes: "analysis", "planning", "coding", "disabled"
- [ ] SignedSessionState extends SessionState with _signature field
- [ ] File compiles without TypeScript errors
- [ ] All interfaces exported

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/src/services/session/types.ts` | Create | TypeScript type definitions |

## Implementation Notes

Follow the interface definitions in DESIGN-001 Component 1 exactly. Use TypeScript 5.0+ syntax (interface, type, union types).

Example structure:

```typescript
export interface SessionState {
  sessionId: string;
  // ... other fields
  version: number;
}

export interface OrchestratorWorkflow {
  activeAgent: AgentType | null;
  // ... other fields
}

export type AgentType =
  | "orchestrator"
  | "analyst"
  // ... other agents
```

## Testing Requirements

- [ ] TypeScript compilation succeeds (`tsc --noEmit`)
- [ ] IDE autocomplete works for all interfaces
- [ ] No TypeScript lint errors
