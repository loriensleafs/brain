---
type: task
id: TASK-013
title: Implement orchestrator-agent-routing workflow
status: complete
priority: P0
complexity: L
estimate: 7h
related:
  - DESIGN-001
blocked_by:
  - TASK-010
blocks: []
assignee: implementer
created: 2026-01-18
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - inngest
  - workflows
  - orchestrator
  - agent-tracking
---

# TASK-013: Implement Orchestrator Agent Routing Workflow

## Design Context

- DESIGN-001: Session State Architecture (Component 1: Orchestrator Workflow)
- ADR-016 Milestone 2.4: Orchestrator Workflow Tracking

## Objective

Implement Inngest workflows that track orchestrator agent routing decisions. Two workflows handle agent invocations and completions, maintaining full agent history with input/output context in session state.

## Scope

**In Scope**:

- Agent invocation workflow (triggered by `orchestrator/agent.invoke` event)
- Agent completion workflow (triggered by `orchestrator/agent.complete` event)
- AgentInvocation record creation and update
- Brain specialist context preservation (separate Brain notes)
- Session state updates with workflow tracking
- History compaction when threshold exceeded (>10 invocations)

**Out of Scope**:

- Orchestrator instrumentation (emitting events from orchestrator agent)
- Session protocol workflows (TASK-011, TASK-012)
- Hook integration

## Acceptance Criteria

- [ ] Agent invocation workflow creates AgentInvocation record in session state
- [ ] Agent completion workflow updates AgentInvocation with output
- [ ] Brain specialist context (analyst, architect) saved to separate Brain note
- [ ] Full agent history preserved in `orchestratorWorkflow.agentHistory`
- [ ] Compaction triggered when history length > 10
- [ ] Compaction stores full history in Brain note, keeps last 3 in session state
- [ ] Decisions and verdicts never compacted (always preserved)
- [ ] Workflow emits `session/state.update` events

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/src/workflows/orchestrator-agent-routing.ts` | Create | Agent invocation workflow |
| `apps/mcp/src/workflows/agent-completion-handler.ts` | Create | Agent completion workflow |
| `apps/mcp/src/workflows/steps/create-agent-invocation.ts` | Create | AgentInvocation creation step |
| `apps/mcp/src/workflows/steps/update-agent-invocation.ts` | Create | AgentInvocation update step |
| `apps/mcp/src/workflows/steps/save-agent-context.ts` | Create | Brain specialist context save |
| `apps/mcp/src/workflows/steps/check-compaction.ts` | Create | Compaction threshold check |

## Implementation Notes

### Workflow 1: Agent Invocation Tracking

```typescript
// apps/mcp/src/workflows/orchestrator-agent-routing.ts
import { inngest } from "./inngest-client";
import { OrchestratorAgentInvokeEvent } from "../events/session";
import { createAgentInvocation } from "./steps/create-agent-invocation";

export const orchestratorAgentRouting = inngest.createFunction(
  {
    id: "orchestrator-agent-routing",
    name: "Orchestrator Agent Routing",
    retries: 3,
  },
  { event: "orchestrator/agent.invoke" },
  async ({ event, step }) => {
    const { sessionId, agent, prompt, context } = event.data;

    // Step 1: Create AgentInvocation record
    const invocation = await step.run("create-agent-invocation", async () => {
      return await createAgentInvocation({
        sessionId,
        agent,
        prompt,
        context,
        timestamp: event.data.timestamp,
      });
    });

    // Step 2: Update session state with new invocation
    await step.run("update-session-state", async () => {
      const persistence = new BrainSessionPersistence(brainMCP);
      const session = await persistence.loadSession(sessionId);

      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Initialize orchestrator workflow if needed
      if (!session.orchestratorWorkflow) {
        session.orchestratorWorkflow = {
          activeAgent: agent,
          workflowPhase: "planning",
          agentHistory: [],
          decisions: [],
          verdicts: [],
          pendingHandoffs: [],
          compactionHistory: [],
          startedAt: new Date().toISOString(),
          lastAgentChange: new Date().toISOString(),
        };
      }

      // Add invocation to history
      session.orchestratorWorkflow.agentHistory.push(invocation);
      session.orchestratorWorkflow.activeAgent = agent;
      session.orchestratorWorkflow.lastAgentChange = new Date().toISOString();

      await updateSessionWithLocking(sessionId, {
        orchestratorWorkflow: session.orchestratorWorkflow,
      });

      return invocation;
    });

    // Step 3: Emit state update event
    await step.sendEvent("emit-state-update", {
      name: "session/state.update",
      data: {
        sessionId,
        updates: {
          activeAgent: agent,
          lastAgentChange: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      },
    });

    return { success: true, invocationId: invocation.startedAt };
  }
);
```

### Workflow 2: Agent Completion Tracking

```typescript
// apps/mcp/src/workflows/agent-completion-handler.ts
import { inngest } from "./inngest-client";
import { OrchestratorAgentCompleteEvent } from "../events/session";
import { updateAgentInvocation } from "./steps/update-agent-invocation";
import { saveAgentContext } from "./steps/save-agent-context";
import { checkCompaction } from "./steps/check-compaction";

export const agentCompletionHandler = inngest.createFunction(
  {
    id: "agent-completion-handler",
    name: "Agent Completion Handler",
    retries: 3,
  },
  { event: "orchestrator/agent.complete" },
  async ({ event, step }) => {
    const { sessionId, agent, output } = event.data;

    // Step 1: Update AgentInvocation with output
    await step.run("update-agent-invocation", async () => {
      return await updateAgentInvocation({
        sessionId,
        agent,
        output,
        status: "completed",
        timestamp: event.data.timestamp,
      });
    });

    // Step 2: Save Brain specialist context to separate Brain note
    await step.run("save-agent-context", async () => {
      const brainSpecialists = ["analyst", "architect"];

      if (brainSpecialists.includes(agent)) {
        await saveAgentContext({
          sessionId,
          agent,
          output,
        });
      }
    });

    // Step 3: Check if compaction needed
    const compactionNeeded = await step.run("check-compaction", async () => {
      return await checkCompaction(sessionId);
    });

    // Step 4: Trigger compaction if needed
    if (compactionNeeded) {
      await step.run("compact-session-history", async () => {
        const session = await new BrainSessionPersistence(brainMCP).loadSession(sessionId);

        if (!session) {
          throw new Error(`Session ${sessionId} not found`);
        }

        const compactionResult = await compactSessionState(session);

        await updateSessionWithLocking(sessionId, {
          orchestratorWorkflow: compactionResult.compactedState.orchestratorWorkflow,
        });

        return compactionResult.historyNote;
      });
    }

    // Step 5: Emit state update event
    await step.sendEvent("emit-state-update", {
      name: "session/state.update",
      data: {
        sessionId,
        updates: {
          agentCompleted: agent,
          compactionTriggered: compactionNeeded,
        },
        timestamp: new Date().toISOString(),
      },
    });

    return { success: true, agent, compactionNeeded };
  }
);
```

### Step Implementations

#### Create Agent Invocation

```typescript
// apps/mcp/src/workflows/steps/create-agent-invocation.ts
import { AgentInvocation, AgentType } from "../../services/session/types";

interface CreateInvocationParams {
  sessionId: string;
  agent: AgentType;
  prompt: string;
  context: Record<string, any>;
  timestamp: string;
}

export async function createAgentInvocation(
  params: CreateInvocationParams
): Promise<AgentInvocation> {
  const { agent, prompt, context, timestamp } = params;

  return {
    agent,
    startedAt: timestamp,
    completedAt: null,
    status: "in_progress",
    input: {
      prompt,
      context,
      artifacts: context.artifacts || [],
    },
    output: null,
    handoffFrom: context.handoffFrom || null,
    handoffTo: null,
    handoffReason: context.handoffReason || "",
  };
}
```

#### Update Agent Invocation

```typescript
// apps/mcp/src/workflows/steps/update-agent-invocation.ts
import { BrainSessionPersistence } from "../../services/session/brain-persistence";
import { AgentType } from "../../services/session/types";

interface UpdateInvocationParams {
  sessionId: string;
  agent: AgentType;
  output: any;
  status: "completed" | "failed" | "blocked";
  timestamp: string;
}

export async function updateAgentInvocation(
  params: UpdateInvocationParams
): Promise<void> {
  const { sessionId, agent, output, status, timestamp } = params;

  const persistence = new BrainSessionPersistence(brainMCP);
  const session = await persistence.loadSession(sessionId);

  if (!session || !session.orchestratorWorkflow) {
    throw new Error(`Session ${sessionId} or orchestrator workflow not found`);
  }

  // Find most recent invocation for this agent
  const history = session.orchestratorWorkflow.agentHistory;
  const invocation = history
    .filter((inv) => inv.agent === agent && inv.completedAt === null)
    .pop();

  if (!invocation) {
    throw new Error(`No in-progress invocation found for agent ${agent}`);
  }

  // Update invocation
  invocation.completedAt = timestamp;
  invocation.status = status;
  invocation.output = output;

  await updateSessionWithLocking(sessionId, {
    orchestratorWorkflow: session.orchestratorWorkflow,
  });
}
```

#### Save Agent Context

```typescript
// apps/mcp/src/workflows/steps/save-agent-context.ts
import { brainMCP } from "../inngest-client";
import { AgentType } from "../../services/session/types";

interface SaveContextParams {
  sessionId: string;
  agent: AgentType;
  output: any;
}

export async function saveAgentContext(params: SaveContextParams): Promise<void> {
  const { sessionId, agent, output } = params;

  // Save Brain specialist context to separate note
  await brainMCP.writeNote({
    title: `sessions/session-${sessionId}-agent-${agent}`,
    content: JSON.stringify(
      {
        agent,
        sessionId,
        output,
        savedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    category: "session-agents",
    project: process.cwd(),
  });
}
```

#### Check Compaction

```typescript
// apps/mcp/src/workflows/steps/check-compaction.ts
import { BrainSessionPersistence } from "../../services/session/brain-persistence";

export async function checkCompaction(sessionId: string): Promise<boolean> {
  const persistence = new BrainSessionPersistence(brainMCP);
  const session = await persistence.loadSession(sessionId);

  if (!session || !session.orchestratorWorkflow) {
    return false;
  }

  const historyLength = session.orchestratorWorkflow.agentHistory.length;
  return historyLength > 10;
}
```

### Compaction Logic (from DESIGN-001)

```typescript
// apps/mcp/src/services/session/compaction.ts
import { SessionState, CompactionResult } from "./types";
import { brainMCP } from "../workflows/inngest-client";

export async function compactSessionState(
  session: SessionState
): Promise<CompactionResult> {
  const workflow = session.orchestratorWorkflow;

  if (!workflow || workflow.agentHistory.length <= 10) {
    throw new Error("Compaction not needed");
  }

  // Keep last 3 invocations
  const recentInvocations = workflow.agentHistory.slice(-3);
  const historicalInvocations = workflow.agentHistory.slice(0, -3);

  // Store full history in Brain note
  const historyNotePath = `sessions/session-${session.sessionId}-history-${Date.now()}`;
  await brainMCP.writeNote({
    title: historyNotePath,
    content: JSON.stringify(
      {
        sessionId: session.sessionId,
        compactedAt: new Date().toISOString(),
        fullHistory: historicalInvocations,
      },
      null,
      2
    ),
    category: "session-history",
    project: process.cwd(),
  });

  // Update workflow with compacted history
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

### Unit Tests

- [ ] createAgentInvocation generates correct AgentInvocation structure
- [ ] updateAgentInvocation finds correct in-progress invocation
- [ ] saveAgentContext creates Brain note for Brain specialists only
- [ ] checkCompaction returns true when history > 10
- [ ] compactSessionState keeps last 3, stores rest in Brain note

### Integration Tests

- [ ] Agent invoke event → invocation added to session state
- [ ] Agent complete event → invocation updated with output
- [ ] Brain specialist completion → context saved to Brain note
- [ ] History exceeds 10 → compaction triggered automatically
- [ ] Compacted history → full history in Brain note, last 3 in session state
- [ ] Decisions and verdicts preserved after compaction

### Workflow Tests

- [ ] orchestratorAgentRouting workflow completes successfully
- [ ] agentCompletionHandler workflow completes successfully
- [ ] Concurrent invocations handled via optimistic locking
- [ ] Failed agent invocation sets status to "failed"
- [ ] Blocked agent invocation sets status to "blocked"

### Performance Tests

- [ ] Agent invocation workflow completes in <500ms (P95)
- [ ] Agent completion workflow completes in <1s (P95)
- [ ] Compaction completes in <2s (P95)

## Dependencies

**External**:

- Brain MCP operational (BLOCKING)

**Internal**:

- TASK-010: Inngest workflow setup
- TASK-001, TASK-003, TASK-007: Session state types, Brain persistence, compaction logic

## Blocked By

- TASK-010: Inngest workflow setup (must complete first)

## Blocks

None (can be implemented in parallel with TASK-011, TASK-012)

## Rollback Plan

If workflows fail in production:

1. Disable workflows via feature flag
2. Orchestrator continues without workflow tracking
3. Session state remains basic (no agent history)
4. Fix issues and re-deploy with gradual rollout

## References

- **ADR-016**: Automatic Session Protocol Enforcement
- **Milestone 2.4**: Orchestrator Workflow Tracking
- **DESIGN-001**: Component 1 (Orchestrator Workflow Schema)
- **DESIGN-001**: Component 7 (Session History Compaction)
- **Inngest Events API**: <https://inngest.com/docs/events>
