/**
 * Feature Completion Workflow
 *
 * Orchestrates parallel agent validation when a feature is marked complete.
 * Runs 4 agents in parallel: QA, Analyst, Architect, and Roadmap.
 *
 * Each agent returns a verdict (PASS/WARN/FAIL/etc.) and optional details.
 * The workflow aggregates all verdicts and returns the combined result.
 *
 * Error Handling:
 * - Validation errors (invalid featureId) throw NonRetriableError immediately
 * - Agent failures are caught and logged with proper error types
 * - Retriable errors are allowed to propagate for Inngest retry
 */

import { NonRetriableError } from "inngest";
import { inngest } from "../client";
import { logger } from "../../utils/internal/logger";
import {
  runQaAgent,
  runAnalystAgent,
  runArchitectAgent,
  runRoadmapAgent,
  type AgentVerdict,
  type Verdict,
} from "../agents";
import { mergeVerdicts, type FinalVerdict } from "./verdicts";
import {
  createNonRetriableError,
  WorkflowErrorType,
} from "../errors";
/**
 * Task status for validation.
 */
interface Task {
  name?: string;
  status?: string;
  completed?: boolean;
}

/**
 * Validate that no IN_PROGRESS tasks are incomplete.
 * Pure TypeScript implementation (no WASM dependency).
 *
 * @param tasks - Array of task status objects
 * @returns Validation result with checks for each incomplete task
 */
function checkTasks(tasks: Task[]): {
  valid: boolean;
  checks: Array<{ name: string; passed: boolean; message: string }>;
  remediation?: string;
} {
  const checks: Array<{ name: string; passed: boolean; message: string }> = [];

  for (const task of tasks) {
    const isInProgress = task.status === "IN_PROGRESS";
    const isIncomplete = !task.completed;

    if (isInProgress && isIncomplete) {
      checks.push({
        name: `task-${task.name || "unnamed"}`,
        passed: false,
        message: `Task "${task.name || "unnamed"}" is IN_PROGRESS but not complete`,
      });
    }
  }

  const allPassed = checks.length === 0 || checks.every((c) => c.passed);
  return {
    valid: allPassed,
    checks: checks.length > 0 ? checks : [{ name: "tasks-check", passed: true, message: "All tasks valid" }],
    remediation: allPassed ? undefined : "Complete all IN_PROGRESS tasks before proceeding",
  };
}

/**
 * Workflow result structure.
 */
export interface FeatureCompletionResult {
  featureId: string;
  verdicts: {
    qa: AgentVerdict;
    analyst: AgentVerdict;
    architect: AgentVerdict;
    roadmap: AgentVerdict;
  };
  /** Aggregated final verdict with detailed metadata */
  finalVerdict: FinalVerdict;
  /** Shorthand for finalVerdict.verdict */
  overallVerdict: Verdict;
}

/**
 * Error result when workflow fails.
 */
export interface FeatureCompletionError {
  featureId: string;
  error: string;
  errorType: string;
  isRetriable: boolean;
}

// Verdict aggregation logic moved to ./verdicts.ts
// See mergeVerdicts() for the implementation

/**
 * Validate workflow event data.
 *
 * @param data - Event data to validate
 * @throws NonRetriableError if data is invalid
 */
function validateEventData(data: { featureId?: string; context?: unknown }): void {
  if (!data.featureId || typeof data.featureId !== "string") {
    throw createNonRetriableError(
      WorkflowErrorType.VALIDATION_ERROR,
      "Event data must include a valid featureId string",
      { context: { providedData: data } }
    );
  }

  if (data.featureId.trim().length === 0) {
    throw createNonRetriableError(
      WorkflowErrorType.VALIDATION_ERROR,
      "featureId cannot be empty or whitespace",
      { context: { providedData: data } }
    );
  }

  if (data.context !== undefined && typeof data.context !== "object") {
    throw createNonRetriableError(
      WorkflowErrorType.VALIDATION_ERROR,
      "context must be an object if provided",
      { context: { providedData: data, contextType: typeof data.context } }
    );
  }
}

/**
 * Feature completion workflow.
 *
 * Triggered by "feature/completion.requested" event.
 * Runs 4 parallel agent steps to validate the feature completion.
 *
 * Step IDs are unique strings for Inngest memoization:
 * - "validate-input": Input validation
 * - "agent-qa": QA validation
 * - "agent-analyst": Analyst validation
 * - "agent-architect": Architecture validation
 * - "agent-roadmap": Roadmap alignment validation
 *
 * Error Handling:
 * - NonRetriableError: Stops workflow immediately, no retry
 * - Other errors: Propagated for Inngest retry handling
 */
export const featureCompletionWorkflow = inngest.createFunction(
  {
    id: "feature-completion",
    name: "Feature Completion Validation",
    retries: 3, // Allow retries for transient failures
  },
  { event: "feature/completion.requested" },
  async ({ event, step }) => {
    const { featureId, context = {} } = event.data;

    // Step 1: Validate input data
    // This is a separate step for memoization - validation only runs once
    await step.run("validate-input", async () => {
      validateEventData(event.data);
      logger.info(
        { featureId, hasContext: Object.keys(context).length > 0 },
        "Validated workflow input"
      );
    });

    // Step 2: Validate tasks before phase transition
    // Ensure no IN_PROGRESS tasks are incomplete before proceeding to agent validation
    await step.run("validate-tasks", async () => {
      const tasks: Task[] = (context as { tasks?: Task[] }).tasks ?? [];
      if (tasks.length > 0) {
        const taskResult = checkTasks(tasks);
        if (!taskResult.valid) {
          const incompleteTaskMessages = taskResult.checks
            .filter((c) => !c.passed)
            .map((c) => c.message)
            .join("; ");
          logger.error(
            {
              featureId,
              checks: incompleteTaskMessages,
              remediation: taskResult.remediation,
            },
            "Phase transition blocked: incomplete tasks"
          );
          throw createNonRetriableError(
            WorkflowErrorType.VALIDATION_ERROR,
            `Cannot proceed with feature completion: ${incompleteTaskMessages}`,
            { context: { remediation: taskResult.remediation } }
          );
        }
        logger.info({ featureId, taskCount: tasks.length }, "All tasks validated successfully");
      } else {
        logger.debug({ featureId }, "No tasks provided for validation");
      }
    });

    logger.info({ featureId, context }, "Starting feature completion workflow");

    try {
      // Run all 4 agent validations in parallel
      // Each step is memoized by its unique ID
      const [qa, analyst, architect, roadmap] = await Promise.all([
        step.run("agent-qa", async (): Promise<AgentVerdict> => {
          return runQaAgent(featureId, context);
        }),

        step.run("agent-analyst", async (): Promise<AgentVerdict> => {
          return runAnalystAgent(featureId, context);
        }),

        step.run("agent-architect", async (): Promise<AgentVerdict> => {
          return runArchitectAgent(featureId, context);
        }),

        step.run("agent-roadmap", async (): Promise<AgentVerdict> => {
          return runRoadmapAgent(featureId, context);
        }),
      ]);

      // Aggregate all agent verdicts into a final verdict
      const finalVerdict = mergeVerdicts([qa, analyst, architect, roadmap]);

      const result: FeatureCompletionResult = {
        featureId,
        verdicts: { qa, analyst, architect, roadmap },
        finalVerdict,
        overallVerdict: finalVerdict.verdict,
      };

      logger.info(
        {
          featureId,
          overallVerdict: finalVerdict.verdict,
          isBlocking: finalVerdict.isBlocking,
          reason: finalVerdict.reason,
        },
        "Feature completion workflow finished"
      );

      return result;
    } catch (error) {
      // Log error details for debugging
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isNonRetriable = error instanceof NonRetriableError;

      logger.error(
        {
          featureId,
          error: errorMessage,
          isNonRetriable,
          errorName: error instanceof Error ? error.name : "Unknown",
        },
        "Feature completion workflow failed"
      );

      // Re-throw to let Inngest handle retry logic
      // NonRetriableError will stop retries
      // Other errors will be retried based on retry config
      throw error;
    }
  }
);
