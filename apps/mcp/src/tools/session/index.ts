/**
 * session tool implementation
 *
 * Unified session management with get/set/create/pause/resume/complete operations.
 * Supports both workflow mode management (get/set) and session lifecycle (create/pause/resume/complete).
 *
 * @see FEATURE-001: Session Management
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  AutoPauseFailedError,
  completeSession,
  createSession,
  getRecentModeHistory,
  getSession,
  InvalidStatusTransitionError,
  MODE_DESCRIPTIONS,
  pauseSession,
  queryActiveSession,
  queryOpenSessions,
  resumeSession,
  SessionNotFoundError,
  setSession,
} from "../../services/session";
import { SessionArgsSchema } from "./schema";

/**
 * Error codes for session operations.
 */
type SessionErrorCode = "SESSION_NOT_FOUND" | "INVALID_STATUS_TRANSITION" | "AUTO_PAUSE_FAILED";

/**
 * Create error response for session operations.
 */
function createErrorResponse(code: SessionErrorCode, message: string): CallToolResult {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ success: false, error: code, message }, null, 2),
      },
    ],
    isError: true,
  };
}

/**
 * Map service errors to error responses.
 */
function handleServiceError(error: unknown): CallToolResult {
  if (error instanceof SessionNotFoundError) {
    return createErrorResponse("SESSION_NOT_FOUND", error.message);
  }
  if (error instanceof InvalidStatusTransitionError) {
    return createErrorResponse("INVALID_STATUS_TRANSITION", error.message);
  }
  if (error instanceof AutoPauseFailedError) {
    return createErrorResponse("AUTO_PAUSE_FAILED", error.message);
  }
  // Rethrow unexpected errors
  throw error;
}

/**
 * Handle 'create' operation - creates a new session with auto-pause.
 */
async function handleCreate(topic: string | undefined): Promise<CallToolResult> {
  if (!topic) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Topic is required for create operation.",
        },
      ],
      isError: true,
    };
  }

  try {
    const result = await createSession(topic);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return handleServiceError(error);
  }
}

/**
 * Handle 'pause' operation - pauses an active session.
 */
async function handlePause(sessionId: string | undefined): Promise<CallToolResult> {
  if (!sessionId) {
    return {
      content: [
        {
          type: "text" as const,
          text: "sessionId is required for pause operation.",
        },
      ],
      isError: true,
    };
  }

  try {
    const result = await pauseSession(sessionId);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return handleServiceError(error);
  }
}

/**
 * Handle 'resume' operation - resumes a paused session with auto-pause.
 */
async function handleResume(sessionId: string | undefined): Promise<CallToolResult> {
  if (!sessionId) {
    return {
      content: [
        {
          type: "text" as const,
          text: "sessionId is required for resume operation.",
        },
      ],
      isError: true,
    };
  }

  try {
    const result = await resumeSession(sessionId);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return handleServiceError(error);
  }
}

/**
 * Handle 'complete' operation - completes an active session.
 */
async function handleComplete(sessionId: string | undefined): Promise<CallToolResult> {
  if (!sessionId) {
    return {
      content: [
        {
          type: "text" as const,
          text: "sessionId is required for complete operation.",
        },
      ],
      isError: true,
    };
  }

  try {
    const result = await completeSession(sessionId);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return handleServiceError(error);
  }
}

/**
 * Handle legacy 'set' operation - updates workflow mode, task, or feature.
 */
async function handleSet(args: {
  mode?: "analysis" | "planning" | "coding" | "disabled";
  task?: string;
  feature?: string;
}): Promise<CallToolResult> {
  // Build updates from provided args
  const updates: { mode?: typeof args.mode; task?: string; feature?: string } = {};

  if (args.mode !== undefined) {
    updates.mode = args.mode;
  }
  if (args.task !== undefined) {
    updates.task = args.task;
  }
  if (args.feature !== undefined) {
    updates.feature = args.feature;
  }

  // Check if any updates provided
  if (Object.keys(updates).length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: "No updates provided. Specify mode, task, or feature to update.",
        },
      ],
      isError: true,
    };
  }

  const state = await setSession(updates);

  if (!state) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Failed to update session state.",
        },
      ],
      isError: true,
    };
  }

  // Build response message
  const parts: string[] = [];

  if (updates.mode) {
    parts.push(`Mode set to "${state.currentMode}"`);
    parts.push(MODE_DESCRIPTIONS[state.currentMode]);
  }
  if (updates.task !== undefined) {
    parts.push(updates.task ? `Task: ${state.activeTask}` : "Task cleared");
  }
  if (updates.feature !== undefined) {
    parts.push(updates.feature ? `Feature: ${state.activeFeature}` : "Feature cleared");
  }

  return {
    content: [
      {
        type: "text" as const,
        text: parts.join("\n"),
      },
    ],
  };
}

/**
 * Handle legacy 'get' operation for backward compatibility.
 * Returns workflow mode state, not session lifecycle state.
 */
async function handleLegacyGet(): Promise<CallToolResult> {
  const state = await getSession();

  if (!state) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Session not initialized. No active session found.",
        },
      ],
      isError: true,
    };
  }

  const recentHistory = getRecentModeHistory(state, 5);

  const response = {
    mode: state.currentMode,
    modeDescription: MODE_DESCRIPTIONS[state.currentMode],
    task: state.activeTask,
    feature: state.activeFeature,
    updatedAt: state.updatedAt,
    recentModeHistory: recentHistory,
    // Include session lifecycle state
    openSessions: await queryOpenSessions(),
    activeSession: await queryActiveSession(),
  };

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function handler(rawArgs: Record<string, unknown>): Promise<CallToolResult> {
  // Validate and parse input
  const args = SessionArgsSchema.parse(rawArgs);

  switch (args.operation) {
    case "get":
      return handleLegacyGet();

    case "set":
      return handleSet({
        mode: args.mode,
        task: args.task,
        feature: args.feature,
      });

    case "create":
      return handleCreate((args as { topic?: string }).topic);

    case "pause":
      return handlePause((args as { sessionId?: string }).sessionId);

    case "resume":
      return handleResume((args as { sessionId?: string }).sessionId);

    case "complete":
      return handleComplete((args as { sessionId?: string }).sessionId);

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = args.operation;
      return {
        content: [
          {
            type: "text" as const,
            text: `Unknown operation: ${_exhaustive}`,
          },
        ],
        isError: true,
      };
    }
  }
}

export { toolDefinition } from "./schema";
