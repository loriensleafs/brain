---
type: requirement
id: REQ-001
title: Session state schema with orchestrator workflow tracking
status: accepted
priority: P0
category: functional
epic: EPIC-ADR-016-implementation
related:
  - ADR-016
created: 2026-01-18
updated: 2026-01-19
date_completed: 2026-01-19
validation_date: 2026-01-19
author: spec-generator
tags:
  - session-state
  - orchestrator
  - workflow-tracking
---

# REQ-001: Session State Schema with Orchestrator Workflow Tracking

## Requirement Statement

WHEN orchestrator delegates work to a specialist agent
THE SYSTEM SHALL capture agent invocation metadata including agent type, timing, input context, output artifacts, and handoff metadata in the session state
SO THAT orchestrator workflow history persists across conversation compactions and MCP server restarts.

## Context

The current session protocol lacks visibility into orchestrator workflow execution. When orchestrator routes tasks to specialist agents (analyst, architect, planner, etc.), the routing decisions, agent outputs, and handoff context are lost during conversation compactions. This prevents:

1. Cross-session continuity for long-running features
2. Retrospective analysis of agent effectiveness
3. Recovery of brain specialist agent context after compaction
4. Audit trails for decision-making workflows

ADR-016 introduces a comprehensive session state schema that tracks the full orchestrator workflow, including agent routing history, decisions, verdicts, and pending handoffs.

## Acceptance Criteria

- [ ] SessionState interface includes orchestratorWorkflow field
- [ ] OrchestratorWorkflow interface tracks activeAgent, workflowPhase, agentHistory, decisions, verdicts, pendingHandoffs
- [ ] AgentInvocation interface captures agent, startedAt, completedAt, status, input, output, handoffFrom, handoffTo, handoffReason
- [ ] Decision interface records type, description, rationale, decidedBy, approvedBy, rejectedBy, timestamp
- [ ] Verdict interface captures agent, decision, confidence, reasoning, conditions, blockers, timestamp
- [ ] Handoff interface preserves fromAgent, toAgent, reason, context, artifacts, preservedContext
- [ ] AgentType union includes all 16 agent types (orchestrator, analyst, architect, planner, implementer, critic, qa, security, devops, retrospective, memory, skillbook, independent-thinker, high-level-advisor, explainer, task-generator, pr-comment-responder)
- [ ] Schema validates via TypeScript compilation without errors
- [ ] Session state with orchestrator workflow serializes to JSON correctly
- [ ] Session state with orchestrator workflow deserializes from JSON correctly
- [ ] Compaction history tracked when agentHistory exceeds 10 entries

## Rationale

Tracking orchestrator workflow in session state provides:

1. **Persistence across compactions** - Agent context survives conversation resets
2. **Audit trail** - Full history of agent routing decisions
3. **Retrospective analysis** - Identify bottlenecks and optimize workflows
4. **Context recovery** - Brain specialists can resume work after interruptions
5. **Decision tracking** - Architectural and technical decisions preserved
6. **Verdict aggregation** - Specialist approvals/rejections recorded

The schema design balances completeness (all context preserved) with performance (compaction strategy for large histories).

## Dependencies

- TypeScript 5.0+ for interface definitions
- Brain MCP for note persistence (see REQ-005)
- JSON serialization support for complex nested objects

## Related Artifacts

- ADR-016: Automatic Session Protocol Enforcement via Inngest Workflows
- REQ-005: Brain note persistence model
- DESIGN-001: Session state architecture
