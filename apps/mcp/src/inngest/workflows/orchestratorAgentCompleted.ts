/**
 * Orchestrator Agent Completed Workflow
 *
 * Handles "orchestrator/agent.completed" events to track agent completion.
 * Updates agent invocation with output and completion time.
 *
 * Captures:
 * - Status (completed/failed)
 * - Output artifacts
 * - Verdicts
 * - Blockers
 * - Handoff information
 *
 * Compaction Logic (ADR-016 Resolution 1):
 * - Trigger: When agentHistory exceeds 10 invocations
 * - Keep last 3 invocations in state
 * - Move rest to history note: sessions/session-{sessionId}-history-{timestamp}
 * - Preserve all decisions and verdicts (never compact these)
 *
 * Triggered by "orchestrator/agent.completed" event.
 * Emits "session/state.update" event after recording.
 *
 * @see ADR-016: Automatic Session Protocol Enforcement
 * @see TASK-013: Orchestrator Agent Routing Workflow
 */

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { getBasicMemoryClient } from "../../proxy/client";
import { BrainSessionPersistence } from "../../services/session";
import type {
  AgentInvocation,
  CompactionEntry,
  OrchestratorWorkflow,
  SessionState,
} from "../../services/session/types";
import { logger } from "../../utils/internal/logger";
import { inngest } from "../client";
import { createNonRetriableError, WorkflowErrorType } from "../errors";
import type { AgentInvocationOutputData } from "../events";

// ============================================================================
// Constants
// ============================================================================

/**
 * Threshold for triggering compaction.
 * When agentHistory exceeds this, compaction is triggered.
 */
const COMPACTION_THRESHOLD = 10;

/**
 * Number of recent invocations to keep after compaction.
 */
const INVOCATIONS_TO_KEEP = 3;

// ============================================================================
// Types
// ============================================================================

/**
 * Result type for agent completion recording.
 */
export interface AgentCompletedResult {
  success: boolean;
  sessionId: string;
  agent: string;
  compacted: boolean;
  compactionNotePath?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate event data for agent completion.
 *
 * @param data - Event data to validate
 * @throws NonRetriableError if data is invalid
 */
function validateEventData(data: {
  sessionId?: string;
  agent?: string;
  output?: AgentInvocationOutputData;
}): void {
  if (!data.sessionId || typeof data.sessionId !== "string") {
    throw createNonRetriableError(
      WorkflowErrorType.VALIDATION_ERROR,
      "Event data must include a valid sessionId string",
      { context: { providedData: data } },
    );
  }

  if (!data.agent || typeof data.agent !== "string") {
    throw createNonRetriableError(
      WorkflowErrorType.VALIDATION_ERROR,
      "Event data must include a valid agent string",
      { context: { providedData: data } },
    );
  }

  if (!data.output || typeof data.output !== "object") {
    throw createNonRetriableError(
      WorkflowErrorType.VALIDATION_ERROR,
      "Event data must include an output object",
      { context: { providedData: data } },
    );
  }
}

/**
 * Find the most recent in-progress invocation for an agent.
 *
 * @param history - Agent invocation history
 * @param agent - Agent type to find
 * @returns Index of the invocation or -1 if not found
 */
function findInProgressInvocation(history: AgentInvocation[], agent: string): number {
  // Search from the end to find the most recent in-progress invocation
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].agent === agent && history[i].status === "in_progress") {
      return i;
    }
  }
  return -1;
}

/**
 * Update an agent invocation with completion data.
 *
 * @param invocation - Original invocation
 * @param output - Output from the agent
 * @param handoffTo - Agent to hand off to (null if returning to orchestrator)
 * @param handoffReason - Reason for handoff
 * @param timestamp - Completion timestamp
 * @returns Updated invocation
 */
function completeInvocation(
  invocation: AgentInvocation,
  output: AgentInvocationOutputData,
  handoffTo: string | null,
  handoffReason: string,
  timestamp: string,
): AgentInvocation {
  const hasBlockers = output.blockers && output.blockers.length > 0;

  return {
    ...invocation,
    completedAt: timestamp,
    status: hasBlockers ? "blocked" : "completed",
    output: {
      artifacts: output.artifacts,
      summary: output.summary,
      recommendations: output.recommendations,
      blockers: output.blockers,
    },
    handoffTo: handoffTo as AgentInvocation["handoffTo"],
    handoffReason,
  };
}

/**
 * Check if compaction is needed based on history length.
 *
 * @param workflow - Current orchestrator workflow
 * @returns True if compaction should be triggered
 */
function needsCompaction(workflow: OrchestratorWorkflow): boolean {
  return workflow.agentHistory.length > COMPACTION_THRESHOLD;
}

/**
 * Generate compaction note content.
 *
 * @param invocations - Invocations to archive
 * @param sessionId - Session ID
 * @param timestamp - Compaction timestamp
 * @returns Markdown content for the history note
 */
function generateCompactionNoteContent(
  invocations: AgentInvocation[],
  sessionId: string,
  timestamp: string,
): string {
  const header = `# Agent History Archive

**Session ID**: ${sessionId}
**Archived At**: ${timestamp}
**Invocation Count**: ${invocations.length}

## Invocations

`;

  const invocationEntries = invocations
    .map((inv, index) => {
      return `### ${index + 1}. ${inv.agent}

- **Started**: ${inv.startedAt}
- **Completed**: ${inv.completedAt ?? "N/A"}
- **Status**: ${inv.status}
- **Handoff From**: ${inv.handoffFrom ?? "orchestrator"}
- **Handoff To**: ${inv.handoffTo ?? "orchestrator"}
- **Handoff Reason**: ${inv.handoffReason || "N/A"}

#### Input

- **Prompt**: ${inv.input.prompt}
- **Artifacts**: ${inv.input.artifacts.length > 0 ? inv.input.artifacts.join(", ") : "None"}

#### Output

${
  inv.output
    ? `- **Summary**: ${inv.output.summary}
- **Artifacts**: ${inv.output.artifacts.length > 0 ? inv.output.artifacts.join(", ") : "None"}
- **Recommendations**: ${inv.output.recommendations.length > 0 ? inv.output.recommendations.join(", ") : "None"}
- **Blockers**: ${inv.output.blockers.length > 0 ? inv.output.blockers.join(", ") : "None"}`
    : "Not completed"
}
`;
    })
    .join("\n---\n\n");

  return header + invocationEntries;
}

/**
 * Perform compaction on the agent history.
 *
 * @param workflow - Current orchestrator workflow
 * @param sessionId - Session ID
 * @param client - Brain MCP client
 * @param projectPath - Project path for Brain notes
 * @returns Updated workflow with compacted history
 */
async function compactAgentHistory(
  workflow: OrchestratorWorkflow,
  sessionId: string,
  client: Client,
  projectPath: string,
): Promise<{ workflow: OrchestratorWorkflow; notePath: string }> {
  const timestamp = new Date().toISOString();
  const historyLength = workflow.agentHistory.length;

  // Calculate how many to archive
  const toArchive = historyLength - INVOCATIONS_TO_KEEP;

  // Split history: archive older invocations, keep recent ones
  const archiveInvocations = workflow.agentHistory.slice(0, toArchive);
  const keepInvocations = workflow.agentHistory.slice(toArchive);

  // Generate note path and content
  const notePath = `sessions/session-${sessionId}-history-${timestamp.replace(/[:.]/g, "-")}`;
  const noteContent = generateCompactionNoteContent(archiveInvocations, sessionId, timestamp);

  // Write to Brain note
  await client.callTool({
    name: "write_note",
    arguments: {
      path: notePath,
      content: noteContent,
      project: projectPath,
    },
  });

  logger.info(
    {
      sessionId,
      notePath,
      archivedCount: archiveInvocations.length,
      keptCount: keepInvocations.length,
    },
    "Agent history compacted to Brain note",
  );

  // Create compaction entry
  const compactionEntry: CompactionEntry = {
    notePath,
    compactedAt: timestamp,
    count: archiveInvocations.length,
  };

  // Return updated workflow
  const updatedWorkflow: OrchestratorWorkflow = {
    ...workflow,
    agentHistory: keepInvocations,
    compactionHistory: [...workflow.compactionHistory, compactionEntry],
  };

  return { workflow: updatedWorkflow, notePath };
}

// ============================================================================
// Workflow Definition
// ============================================================================

/**
 * Orchestrator Agent Completed Workflow.
 *
 * Triggered by "orchestrator/agent.completed" event.
 * Updates agent invocation with output and completion time.
 * Triggers compaction if agentHistory exceeds threshold.
 * Emits "session/state.update" event after recording.
 *
 * Step IDs for Inngest memoization:
 * - "validate-input": Input validation
 * - "load-session": Load current session state
 * - "complete-invocation": Update invocation with output
 * - "check-compaction": Check if compaction is needed
 * - "compact-history": Compact agent history if needed
 * - "save-session": Persist updated session state
 * - "emit-state-update": Emit state update event
 */
export const orchestratorAgentCompletedWorkflow = inngest.createFunction(
  {
    id: "orchestrator-agent-completed",
    name: "Orchestrator Agent Completed",
    retries: 3,
  },
  { event: "orchestrator/agent.completed" },
  async ({ event, step }): Promise<AgentCompletedResult> => {
    const { sessionId, agent, output, handoffTo, handoffReason, timestamp } = event.data;

    // Step 0: Validate input data
    await step.run("validate-input", async (): Promise<void> => {
      validateEventData(event.data);
      logger.info(
        { sessionId, agent, handoffTo },
        "Orchestrator agent completion workflow initiated",
      );
    });

    // Step 1: Load current session state
    const currentState = await step.run("load-session", async (): Promise<SessionState> => {
      const persistence = new BrainSessionPersistence();
      const state = await persistence.loadSession();

      if (!state) {
        throw createNonRetriableError(WorkflowErrorType.VALIDATION_ERROR, "Session not found", {
          context: { sessionId },
        });
      }

      if (!state.orchestratorWorkflow) {
        throw createNonRetriableError(
          WorkflowErrorType.VALIDATION_ERROR,
          "Session has no orchestrator workflow",
          { context: { sessionId } },
        );
      }

      return state;
    });

    // Step 2: Update invocation with completion data
    const stateWithCompletion = await step.run(
      "complete-invocation",
      async (): Promise<SessionState> => {
        const workflow = currentState.orchestratorWorkflow;
        if (!workflow) {
          throw new Error("No orchestrator workflow found in session state");
        }

        // Find the in-progress invocation for this agent
        const invocationIndex = findInProgressInvocation(workflow.agentHistory, agent);

        if (invocationIndex === -1) {
          logger.warn(
            { sessionId, agent },
            "No in-progress invocation found for agent - creating completion record",
          );
          // This can happen if the invocation event was missed
          // We still record the completion
        }

        // Update the invocation
        const updatedHistory = [...workflow.agentHistory];

        if (invocationIndex >= 0) {
          updatedHistory[invocationIndex] = completeInvocation(
            workflow.agentHistory[invocationIndex],
            output,
            handoffTo,
            handoffReason,
            timestamp,
          );
        }

        const updatedWorkflow: OrchestratorWorkflow = {
          ...workflow,
          activeAgent: handoffTo as OrchestratorWorkflow["activeAgent"],
          agentHistory: updatedHistory,
          lastAgentChange: timestamp,
        };

        return {
          ...currentState,
          orchestratorWorkflow: updatedWorkflow,
          updatedAt: new Date().toISOString(),
          version: currentState.version + 1,
        };
      },
    );

    // Step 3: Check if compaction is needed
    const shouldCompact = await step.run("check-compaction", async (): Promise<boolean> => {
      const workflow = stateWithCompletion.orchestratorWorkflow;
      if (!workflow) {
        return false;
      }
      const result = needsCompaction(workflow);

      logger.debug(
        {
          sessionId,
          historyLength: workflow.agentHistory.length,
          threshold: COMPACTION_THRESHOLD,
          needsCompaction: result,
        },
        "Compaction check completed",
      );

      return result;
    });

    // Step 4: Compact history if needed
    let finalState = stateWithCompletion;
    let compactionNotePath: string | undefined;

    if (shouldCompact) {
      const compactionResult = await step.run(
        "compact-history",
        async (): Promise<{ state: SessionState; notePath: string }> => {
          let client: Client;
          try {
            client = await getBasicMemoryClient();
          } catch (error) {
            logger.warn({ error }, "Brain MCP unavailable - skipping compaction");
            // Return current state without compaction
            return { state: stateWithCompletion, notePath: "" };
          }

          const currentWorkflow = stateWithCompletion.orchestratorWorkflow;
          if (!currentWorkflow) {
            return { state: stateWithCompletion, notePath: "" };
          }

          const { workflow, notePath } = await compactAgentHistory(
            currentWorkflow,
            sessionId,
            client,
            process.cwd(),
          );

          const newState: SessionState = {
            ...stateWithCompletion,
            orchestratorWorkflow: workflow,
            updatedAt: new Date().toISOString(),
            version: stateWithCompletion.version + 1,
          };

          return { state: newState, notePath };
        },
      );

      finalState = compactionResult.state;
      compactionNotePath = compactionResult.notePath || undefined;
    }

    // Step 5: Persist updated session state
    await step.run("save-session", async (): Promise<void> => {
      const persistence = new BrainSessionPersistence();
      await persistence.saveSession(finalState);

      logger.info(
        {
          sessionId,
          version: finalState.version,
          historyLength: finalState.orchestratorWorkflow?.agentHistory.length,
        },
        "Session state saved with agent completion",
      );
    });

    // Step 6: Emit state update event for downstream workflows
    await step.sendEvent("emit-state-update", {
      name: "session/state.update",
      data: {
        sessionId,
        updateType: "task" as const,
        task: handoffTo ? `${handoffTo}:pending` : undefined,
      },
    });

    logger.info(
      {
        sessionId,
        agent,
        handoffTo,
        compacted: shouldCompact,
        compactionNotePath,
        historyLength: finalState.orchestratorWorkflow?.agentHistory.length,
      },
      "Orchestrator agent completion workflow completed",
    );

    return {
      success: true,
      sessionId,
      agent,
      compacted: shouldCompact && !!compactionNotePath,
      compactionNotePath,
    };
  },
);

/**
 * Get compaction history for the current session.
 *
 * @returns Array of compaction entries or empty array
 */
export async function getCompactionHistory(): Promise<CompactionEntry[]> {
  const persistence = new BrainSessionPersistence();
  const state = await persistence.loadSession();

  if (!state?.orchestratorWorkflow) {
    return [];
  }

  return state.orchestratorWorkflow.compactionHistory;
}

/**
 * Get total agent invocation count including compacted history.
 *
 * @returns Total count of all invocations
 */
export async function getTotalInvocationCount(): Promise<number> {
  const persistence = new BrainSessionPersistence();
  const state = await persistence.loadSession();

  if (!state?.orchestratorWorkflow) {
    return 0;
  }

  const workflow = state.orchestratorWorkflow;
  const currentCount = workflow.agentHistory.length;
  const compactedCount = workflow.compactionHistory.reduce((sum, entry) => sum + entry.count, 0);

  return currentCount + compactedCount;
}
