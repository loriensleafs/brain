/**
 * Inngest Service for Brain MCP server.
 *
 * Provides graceful degradation when Inngest dev server is unavailable.
 * Workflow features are disabled but core note operations continue.
 *
 * LOCAL-ONLY - all operations use the local Inngest dev server.
 */

import { inngest, checkInngestAvailability, isInngestAvailable } from "../../inngest/client";
import { featureCompletionWorkflow } from "../../inngest/workflows/featureCompletion";
import { hitlApprovalWorkflow } from "../../inngest/workflows/hitlApproval";
import {
  sessionStateWorkflow,
  sessionStateQueryWorkflow,
} from "../../inngest/workflows/sessionState";
import { logger } from "../../utils/internal/logger";

/**
 * All registered workflow functions.
 */
const WORKFLOW_FUNCTIONS = [
  featureCompletionWorkflow,
  hitlApprovalWorkflow,
  sessionStateWorkflow,
  sessionStateQueryWorkflow,
];

/**
 * Initialize the Inngest service.
 *
 * Checks if the local Inngest dev server is available.
 * If unavailable, workflow features are disabled but server continues.
 *
 * @returns Promise<boolean> - true if Inngest is available
 */
export async function initInngestService(): Promise<boolean> {
  logger.debug("Checking Inngest dev server availability...");
  const available = await checkInngestAvailability();

  if (!available) {
    logger.info(
      "Inngest dev server not available. Workflow features disabled. " +
        "Start with: npx inngest-cli@latest dev"
    );
  }

  return available;
}

/**
 * Check if workflow features are available.
 *
 * @returns boolean - true if Inngest is available and workflows can run
 */
export function isWorkflowAvailable(): boolean {
  return isInngestAvailable();
}

/**
 * Get the Inngest client for sending events.
 *
 * @returns The Inngest client instance
 */
export function getInngestClient() {
  return inngest;
}

/**
 * Get all registered workflow functions for the Inngest serve handler.
 *
 * @returns Array of workflow functions
 */
export function getWorkflowFunctions() {
  return WORKFLOW_FUNCTIONS;
}

/**
 * Send a workflow event if Inngest is available.
 *
 * @param event - The event to send
 * @returns Promise with send result or error if unavailable
 */
export async function sendWorkflowEvent(event: {
  name: string;
  data: Record<string, unknown>;
}): Promise<{ success: boolean; ids?: string[]; error?: string }> {
  if (!isInngestAvailable()) {
    return {
      success: false,
      error: "Inngest unavailable. Start dev server: npx inngest-cli@latest dev",
    };
  }

  try {
    const result = await inngest.send(event);
    logger.debug({ eventName: event.name, ids: result.ids }, "Sent workflow event");
    return { success: true, ids: result.ids };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ eventName: event.name, error: message }, "Failed to send workflow event");
    return { success: false, error: message };
  }
}
