/**
 * Orchestrator Agent Invoked Workflow
 *
 * Handles "orchestrator/agent.invoked" events to track agent delegation.
 * Records agent invocation in session state agentHistory.
 *
 * Captures:
 * - Agent type
 * - Input context
 * - Workflow phase
 * - Timestamp
 * - Handoff information
 *
 * Triggered by "orchestrator/agent.invoked" event.
 * Emits "session/state.update" event after recording.
 *
 * @see ADR-016: Automatic Session Protocol Enforcement
 * @see TASK-013: Orchestrator Agent Routing Workflow
 */

import { BrainSessionPersistence } from "../../services/session";
import {
  type AgentInvocation,
  createEmptyWorkflow,
  type OrchestratorWorkflow,
  type SessionState,
} from "../../services/session/types";
import { logger } from "../../utils/internal/logger";
import { inngest } from "../client";
import { createNonRetriableError, WorkflowErrorType } from "../errors";

// ============================================================================
// Types
// ============================================================================

/**
 * Result type for agent invocation recording.
 */
export interface AgentInvokedResult {
  success: boolean;
  agent: string;
  invocationIndex: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate event data for agent invocation.
 *
 * @param data - Event data to validate
 * @throws NonRetriableError if data is invalid
 */
function validateEventData(data: { agent?: string; prompt?: string }): void {
  if (!data.agent || typeof data.agent !== "string") {
    throw createNonRetriableError(
      WorkflowErrorType.VALIDATION_ERROR,
      "Event data must include a valid agent string",
      { context: { providedData: data } },
    );
  }

  if (typeof data.prompt !== "string") {
    throw createNonRetriableError(
      WorkflowErrorType.VALIDATION_ERROR,
      "Event data must include a prompt string",
      { context: { providedData: data } },
    );
  }
}

/**
 * Create a new agent invocation record.
 *
 * @param agent - Agent type being invoked
 * @param prompt - Prompt or instruction for the agent
 * @param context - Additional context passed to the agent
 * @param handoffFrom - Agent that handed off (null if orchestrator-initiated)
 * @param timestamp - ISO timestamp of invocation
 * @returns AgentInvocation record
 */
function createAgentInvocation(
  agent: string,
  prompt: string,
  context: Record<string, unknown>,
  handoffFrom: string | null,
  timestamp: string,
): AgentInvocation {
  return {
    agent: agent as AgentInvocation["agent"],
    startedAt: timestamp,
    completedAt: null,
    status: "in_progress",
    input: {
      prompt,
      context,
      artifacts: [],
    },
    output: null,
    handoffFrom: handoffFrom as AgentInvocation["handoffFrom"],
    handoffTo: null,
    handoffReason: "",
  };
}

/**
 * Ensure session state has an orchestrator workflow initialized.
 *
 * @param state - Current session state
 * @returns Session state with orchestrator workflow
 */
function ensureOrchestratorWorkflow(state: SessionState): SessionState {
  if (state.orchestratorWorkflow) {
    return state;
  }

  return {
    ...state,
    orchestratorWorkflow: createEmptyWorkflow(),
  };
}

/**
 * Add agent invocation to workflow history.
 *
 * @param workflow - Current orchestrator workflow
 * @param invocation - Agent invocation to add
 * @returns Updated workflow with new invocation
 */
function addInvocationToHistory(
  workflow: OrchestratorWorkflow,
  invocation: AgentInvocation,
): OrchestratorWorkflow {
  return {
    ...workflow,
    activeAgent: invocation.agent,
    agentHistory: [...workflow.agentHistory, invocation],
    lastAgentChange: invocation.startedAt,
  };
}

// ============================================================================
// Workflow Definition
// ============================================================================

/**
 * Orchestrator Agent Invoked Workflow.
 *
 * Triggered by "orchestrator/agent.invoked" event.
 * Records agent invocation in sessionState.orchestratorWorkflow.agentHistory.
 * Emits "session/state.update" event after recording.
 *
 * Step IDs for Inngest memoization:
 * - "validate-input": Input validation
 * - "load-session": Load current session state
 * - "record-invocation": Add invocation to agent history
 * - "save-session": Persist updated session state
 * - "emit-state-update": Emit state update event
 */
export const orchestratorAgentInvokedWorkflow = inngest.createFunction(
  {
    id: "orchestrator-agent-invoked",
    name: "Orchestrator Agent Invoked",
    retries: 3,
  },
  { event: "orchestrator/agent.invoked" },
  async ({ event, step }): Promise<AgentInvokedResult> => {
    const { agent, prompt, context, handoffFrom, timestamp } = event.data;

    // Step 0: Validate input data
    await step.run("validate-input", async (): Promise<void> => {
      validateEventData(event.data);
      logger.info({ agent, handoffFrom }, "Orchestrator agent invocation workflow initiated");
    });

    // Step 1: Load current session state
    const currentState = await step.run("load-session", async (): Promise<SessionState> => {
      const persistence = new BrainSessionPersistence();
      const state = await persistence.loadSession();

      if (!state) {
        throw createNonRetriableError(WorkflowErrorType.VALIDATION_ERROR, "Session not found", {
          context: {},
        });
      }

      return state;
    });

    // Step 2: Record invocation in agent history
    const { updatedState, invocationIndex } = await step.run(
      "record-invocation",
      async (): Promise<{
        updatedState: SessionState;
        invocationIndex: number;
      }> => {
        // Ensure orchestrator workflow exists
        const stateWithWorkflow = ensureOrchestratorWorkflow(currentState);

        // Create invocation record
        const invocation = createAgentInvocation(agent, prompt, context, handoffFrom, timestamp);

        // Add to history
        const currentWorkflow = stateWithWorkflow.orchestratorWorkflow;
        if (!currentWorkflow) {
          throw new Error("No orchestrator workflow found in session state");
        }
        const updatedWorkflow = addInvocationToHistory(currentWorkflow, invocation);

        const newState: SessionState = {
          ...stateWithWorkflow,
          orchestratorWorkflow: updatedWorkflow,
          updatedAt: new Date().toISOString(),
          version: stateWithWorkflow.version + 1,
        };

        const index = updatedWorkflow.agentHistory.length - 1;

        logger.debug(
          {
            agent,
            invocationIndex: index,
            historyLength: updatedWorkflow.agentHistory.length,
          },
          "Agent invocation recorded",
        );

        return { updatedState: newState, invocationIndex: index };
      },
    );

    // Step 3: Persist updated session state
    await step.run("save-session", async (): Promise<void> => {
      const persistence = new BrainSessionPersistence();
      await persistence.saveSession(updatedState);

      logger.info({ version: updatedState.version }, "Session state saved with agent invocation");
    });

    // Step 4: Emit state update event for downstream workflows
    await step.sendEvent("emit-state-update", {
      name: "session/state.update",
      data: {
        updateType: "task" as const,
        task: `${agent}:${invocationIndex}`,
      },
    });

    logger.info(
      {
        agent,
        invocationIndex,
        historyLength: updatedState.orchestratorWorkflow?.agentHistory.length,
      },
      "Orchestrator agent invocation workflow completed",
    );

    return {
      success: true,
      agent,
      invocationIndex,
    };
  },
);
