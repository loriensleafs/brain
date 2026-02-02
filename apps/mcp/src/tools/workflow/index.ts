/**
 * Workflow MCP tools implementation.
 *
 * Provides handlers for listing, triggering, and monitoring Inngest workflows.
 * All operations are LOCAL-ONLY via the Inngest dev server.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getInngestDevServerUrl, inngest, isInngestAvailable } from "../../inngest/client";
import { logger } from "../../utils/internal/logger";
import {
  GetWorkflowArgsSchema,
  ListWorkflowsArgsSchema,
  SendWorkflowEventArgsSchema,
} from "./schema";

// Re-export tool definitions
export {
  getWorkflowToolDefinition,
  listWorkflowsToolDefinition,
  sendWorkflowEventToolDefinition,
} from "./schema";

// ============================================================================
// Types
// ============================================================================

/**
 * Workflow run status.
 */
export type WorkflowStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "UNKNOWN";

/**
 * Workflow information from list_workflows.
 */
export interface WorkflowInfo {
  id: string;
  name: string;
  triggers: Array<{
    event?: string;
    cron?: string;
  }>;
}

/**
 * Workflow run details from get_workflow.
 */
export interface WorkflowRun {
  id: string;
  functionId: string;
  status: WorkflowStatus;
  startedAt?: string;
  endedAt?: string;
  output?: unknown;
  steps?: Array<{
    id: string;
    name: string;
    status: WorkflowStatus;
    output?: unknown;
  }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the Inngest dev server URL.
 */
const getDevServerUrl = () => getInngestDevServerUrl();

/**
 * Helper to create a CallToolResult from data.
 */
function toCallToolResult(data: unknown, isError = false): CallToolResult {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
    isError,
  };
}

/**
 * Check if Inngest is available, return error result if not.
 */
function checkAvailability(): { available: true } | { available: false; error: string } {
  if (!isInngestAvailable()) {
    return {
      available: false,
      error: "Inngest dev server unavailable. Start with: npx inngest-cli@latest dev",
    };
  }
  return { available: true };
}

/**
 * Normalize Inngest status to our WorkflowStatus type.
 */
function normalizeStatus(status?: string): WorkflowStatus {
  if (!status) return "UNKNOWN";

  const normalized = status.toUpperCase();
  switch (normalized) {
    case "PENDING":
    case "QUEUED":
      return "PENDING";
    case "RUNNING":
    case "IN_PROGRESS":
      return "RUNNING";
    case "COMPLETED":
    case "SUCCEEDED":
    case "SUCCESS":
      return "COMPLETED";
    case "FAILED":
    case "ERROR":
      return "FAILED";
    case "CANCELLED":
    case "CANCELED":
      return "CANCELLED";
    default:
      return "UNKNOWN";
  }
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * List all registered workflow functions.
 */
async function listWorkflows(): Promise<{
  success: boolean;
  workflows?: WorkflowInfo[];
  error?: string;
}> {
  const availability = checkAvailability();
  if (!availability.available) {
    return { success: false, error: availability.error };
  }

  try {
    const response = await fetch(`${getDevServerUrl()}/v1/functions`);

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to list workflows: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as {
      functions?: Array<{
        id: string;
        name: string;
        triggers: Array<{ event?: string; cron?: string }>;
      }>;
    };

    const workflows: WorkflowInfo[] = (data.functions || []).map((fn) => ({
      id: fn.id,
      name: fn.name,
      triggers: fn.triggers || [],
    }));

    logger.debug({ count: workflows.length }, "Listed workflows");
    return { success: true, workflows };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, "Failed to list workflows");
    return { success: false, error: message };
  }
}

/**
 * Send a single event to trigger a workflow.
 */
async function sendWorkflowEvent(
  eventName: string,
  data?: Record<string, unknown>,
): Promise<{ success: boolean; ids?: string[]; error?: string }> {
  const availability = checkAvailability();
  if (!availability.available) {
    return { success: false, error: availability.error };
  }

  try {
    const result = await inngest.send({
      name: eventName,
      data: data || {},
    });

    logger.info({ eventName, ids: result.ids }, "Sent workflow event");
    return { success: true, ids: result.ids };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ eventName, error: message }, "Failed to send workflow event");
    return { success: false, error: message };
  }
}

/**
 * Get full workflow run details including steps.
 */
async function getWorkflow(runId: string): Promise<{
  success: boolean;
  run?: WorkflowRun;
  error?: string;
}> {
  const availability = checkAvailability();
  if (!availability.available) {
    return { success: false, error: availability.error };
  }

  try {
    // Fetch run details
    const runResponse = await fetch(`${getDevServerUrl()}/v1/runs/${runId}`);

    if (!runResponse.ok) {
      if (runResponse.status === 404) {
        return { success: false, error: `Run not found: ${runId}` };
      }
      return {
        success: false,
        error: `Failed to get run: ${runResponse.status} ${runResponse.statusText}`,
      };
    }

    const runData = (await runResponse.json()) as {
      id: string;
      function_id?: string;
      status?: string;
      started_at?: string;
      ended_at?: string;
      output?: unknown;
    };

    // Fetch steps
    let steps: WorkflowRun["steps"] = [];
    try {
      const stepsResponse = await fetch(`${getDevServerUrl()}/v1/runs/${runId}/actions`);
      if (stepsResponse.ok) {
        const stepsData = (await stepsResponse.json()) as Array<{
          id: string;
          name: string;
          status?: string;
          output?: unknown;
        }>;
        steps = stepsData.map((step) => ({
          id: step.id,
          name: step.name,
          status: normalizeStatus(step.status),
          output: step.output,
        }));
      }
    } catch {
      // Steps endpoint may not be available, continue without
      logger.debug({ runId }, "Could not fetch steps");
    }

    const run: WorkflowRun = {
      id: runData.id,
      functionId: runData.function_id || "",
      status: normalizeStatus(runData.status),
      startedAt: runData.started_at,
      endedAt: runData.ended_at,
      output: runData.output,
      steps,
    };

    logger.debug({ runId, status: run.status, stepCount: steps.length }, "Got workflow details");
    return { success: true, run };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ runId, error: message }, "Failed to get workflow");
    return { success: false, error: message };
  }
}

// ============================================================================
// MCP Handlers
// ============================================================================

/**
 * MCP handler for list_workflows.
 */
export async function listWorkflowsHandler(
  rawArgs: Record<string, unknown>,
): Promise<CallToolResult> {
  // Validate input (empty object expected)
  ListWorkflowsArgsSchema.parse(rawArgs);
  const result = await listWorkflows();
  return toCallToolResult(result, !result.success);
}

/**
 * MCP handler for send_workflow_event.
 */
export async function sendWorkflowEventHandler(
  rawArgs: Record<string, unknown>,
): Promise<CallToolResult> {
  const args = SendWorkflowEventArgsSchema.parse(rawArgs);
  const result = await sendWorkflowEvent(args.event_name, args.data);
  return toCallToolResult(result, !result.success);
}

/**
 * MCP handler for get_workflow.
 */
export async function getWorkflowHandler(
  rawArgs: Record<string, unknown>,
): Promise<CallToolResult> {
  const args = GetWorkflowArgsSchema.parse(rawArgs);
  const result = await getWorkflow(args.run_id);
  return toCallToolResult(result, !result.success);
}
