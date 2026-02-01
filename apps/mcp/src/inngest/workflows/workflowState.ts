/**
 * Workflow State Tracking
 *
 * Tracks workflow run states for querying status.
 * Uses in-memory store backed by Inngest dev server API for run details.
 *
 * LOCAL ONLY - queries local Inngest dev server.
 */

import { logger } from "../../utils/internal/logger";
import { getInngestDevServerUrl } from "../client";

/**
 * Workflow run status values.
 */
export type WorkflowStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "unknown";

/**
 * Workflow state record.
 */
export interface WorkflowState {
  /** Unique run ID from Inngest */
  runId: string;
  /** Feature ID if this is a feature workflow */
  featureId?: string;
  /** Event name that triggered the workflow */
  eventName: string;
  /** Workflow function ID */
  functionId: string;
  /** Current status */
  status: WorkflowStatus;
  /** When the workflow was triggered */
  startedAt: string;
  /** When the workflow completed (if applicable) */
  completedAt?: string;
  /** Error message if failed */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * In-memory store for workflow states.
 * Maps runId -> WorkflowState
 */
const workflowStates = new Map<string, WorkflowState>();

/**
 * Index by featureId for feature workflow lookups.
 * Maps featureId -> runId[]
 */
const featureWorkflowIndex = new Map<string, string[]>();

/**
 * Register a workflow run for tracking.
 *
 * Called when a workflow is triggered to start tracking its state.
 *
 * @param runId - Inngest run ID
 * @param eventName - Event that triggered the workflow
 * @param functionId - Inngest function ID
 * @param featureId - Optional feature ID for feature workflows
 * @param metadata - Optional additional metadata
 */
export function registerWorkflowRun(
  runId: string,
  eventName: string,
  functionId: string,
  featureId?: string,
  metadata?: Record<string, unknown>,
): void {
  const state: WorkflowState = {
    runId,
    featureId,
    eventName,
    functionId,
    status: "pending",
    startedAt: new Date().toISOString(),
    metadata,
  };

  workflowStates.set(runId, state);

  // Index by featureId if provided
  if (featureId) {
    const runs = featureWorkflowIndex.get(featureId) || [];
    runs.push(runId);
    featureWorkflowIndex.set(featureId, runs);
  }

  logger.debug(
    { runId, eventName, functionId, featureId },
    "Registered workflow run for tracking",
  );
}

/**
 * Update workflow run status.
 *
 * @param runId - Inngest run ID
 * @param status - New status
 * @param error - Optional error message if failed
 */
export function updateWorkflowStatus(
  runId: string,
  status: WorkflowStatus,
  error?: string,
): void {
  const state = workflowStates.get(runId);
  if (!state) {
    logger.warn({ runId }, "Attempted to update unknown workflow run");
    return;
  }

  state.status = status;
  if (status === "completed" || status === "failed" || status === "cancelled") {
    state.completedAt = new Date().toISOString();
  }
  if (error) {
    state.error = error;
  }

  workflowStates.set(runId, state);
  logger.debug({ runId, status }, "Updated workflow status");
}

/**
 * Get workflow state by run ID.
 *
 * First checks local cache, then queries Inngest dev server for updates.
 *
 * @param runId - Inngest run ID
 * @returns Workflow state or undefined if not found
 */
export async function getWorkflowStateByRunId(
  runId: string,
): Promise<WorkflowState | undefined> {
  // Check local cache first
  let state = workflowStates.get(runId);

  // If we have a cached state that's not terminal, try to refresh from Inngest
  if (state && !isTerminalStatus(state.status)) {
    const freshState = await fetchRunStateFromInngest(runId);
    if (freshState) {
      state = { ...state, ...freshState };
      workflowStates.set(runId, state);
    }
  }

  return state;
}

/**
 * Get workflow states by feature ID.
 *
 * Returns all workflow runs associated with a feature.
 *
 * @param featureId - Feature ID
 * @returns Array of workflow states
 */
export async function getWorkflowStatesByFeatureId(
  featureId: string,
): Promise<WorkflowState[]> {
  const runIds = featureWorkflowIndex.get(featureId) || [];
  const states: WorkflowState[] = [];

  for (const runId of runIds) {
    const state = await getWorkflowStateByRunId(runId);
    if (state) {
      states.push(state);
    }
  }

  return states;
}

/**
 * Get all active (non-terminal) workflow runs.
 *
 * @returns Array of active workflow states
 */
export async function getActiveWorkflows(): Promise<WorkflowState[]> {
  const active: WorkflowState[] = [];

  for (const [runId, state] of workflowStates) {
    if (!isTerminalStatus(state.status)) {
      const freshState = await getWorkflowStateByRunId(runId);
      if (freshState && !isTerminalStatus(freshState.status)) {
        active.push(freshState);
      }
    }
  }

  return active;
}

/**
 * Get all tracked workflow runs.
 *
 * @returns Array of all workflow states
 */
export function getAllWorkflowStates(): WorkflowState[] {
  return Array.from(workflowStates.values());
}

/**
 * Clear workflow state for a run.
 *
 * @param runId - Run ID to clear
 * @returns True if state was cleared
 */
export function clearWorkflowState(runId: string): boolean {
  const state = workflowStates.get(runId);
  if (state?.featureId) {
    const runs = featureWorkflowIndex.get(state.featureId) || [];
    featureWorkflowIndex.set(
      state.featureId,
      runs.filter((id) => id !== runId),
    );
  }
  return workflowStates.delete(runId);
}

/**
 * Clear all workflow states.
 * Useful for testing or session cleanup.
 */
export function clearAllWorkflowStates(): void {
  workflowStates.clear();
  featureWorkflowIndex.clear();
  logger.info("Cleared all workflow states");
}

/**
 * Check if a status is terminal (workflow has completed).
 */
function isTerminalStatus(status: WorkflowStatus): boolean {
  return (
    status === "completed" || status === "failed" || status === "cancelled"
  );
}

/**
 * Fetch run state from Inngest dev server.
 *
 * Queries the local Inngest dev server API for run details.
 * Returns partial state with status updates.
 *
 * @param runId - Inngest run ID
 * @returns Partial workflow state or undefined if fetch fails
 */
async function fetchRunStateFromInngest(
  runId: string,
): Promise<Partial<WorkflowState> | undefined> {
  try {
    const baseUrl = getInngestDevServerUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    // Query the runs API for this specific run
    const response = await fetch(`${baseUrl}/v1/runs/${runId}`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        logger.debug({ runId }, "Run not found in Inngest dev server");
        return undefined;
      }
      logger.warn(
        { runId, status: response.status },
        "Failed to fetch run state from Inngest",
      );
      return undefined;
    }

    const data = await response.json();
    return mapInngestRunToState(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.debug(
      { runId, error: message },
      "Error fetching run state from Inngest",
    );
    return undefined;
  }
}

/**
 * Map Inngest run response to workflow state.
 *
 * @param run - Inngest run data
 * @returns Partial workflow state
 */
function mapInngestRunToState(
  run: Record<string, unknown>,
): Partial<WorkflowState> {
  const status = mapInngestStatus(run.status as string);
  const result: Partial<WorkflowState> = { status };

  if (run.ended_at) {
    result.completedAt = run.ended_at as string;
  }

  if (run.output && typeof run.output === "object") {
    const output = run.output as Record<string, unknown>;
    if (output.error) {
      result.error = String(output.error);
    }
  }

  return result;
}

/**
 * Map Inngest status string to WorkflowStatus.
 *
 * Inngest statuses: "Running", "Completed", "Failed", "Cancelled"
 *
 * @param inngestStatus - Status from Inngest API
 * @returns WorkflowStatus
 */
function mapInngestStatus(inngestStatus: string | undefined): WorkflowStatus {
  if (!inngestStatus) return "unknown";

  const normalized = inngestStatus.toLowerCase();
  switch (normalized) {
    case "running":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "queued":
    case "pending":
      return "pending";
    default:
      return "unknown";
  }
}
