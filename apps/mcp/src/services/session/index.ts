/**
 * Session State Service
 *
 * Unified session and mode management. Consolidates:
 * - Session state (mode, task, feature)
 * - Brain note persistence (single source of truth)
 *
 * State is persisted to Brain notes via BrainSessionPersistence.
 * No in-memory caching - Brain notes are the source of truth.
 * Uses fixed path: sessions/session (one session per project).
 *
 * @see brain-persistence.ts for persistence layer
 */

import { logger } from "../../utils/internal/logger";
import { BrainSessionPersistence, getDefaultPersistence } from "./brain-persistence";
import type { SessionState, ModeHistoryEntry, WorkflowMode } from "./types";
import { createDefaultSessionState } from "./types";

// Re-export types from types.ts
export type { WorkflowMode, ModeHistoryEntry };

// ============================================================================
// Types and Constants
// ============================================================================

/**
 * Mode descriptions for user display.
 */
export const MODE_DESCRIPTIONS: Record<WorkflowMode, string> = {
  analysis: "Read-only exploration. Blocks Edit, Write, Bash.",
  planning: "Design phase. Blocks Edit, Write. Allows Bash for research.",
  coding: "Full access. All tools allowed.",
  disabled: "Mode enforcement disabled. All tools allowed.",
};

/**
 * Default mode when no mode has been set.
 * Analysis is the safest default (read-only).
 */
export const DEFAULT_MODE: WorkflowMode = "analysis";

/**
 * Updates that can be applied to session state.
 */
export interface SessionUpdates {
  /** New workflow mode */
  mode?: WorkflowMode;
  /** New active task */
  task?: string;
  /** New active feature */
  feature?: string;
}

// ============================================================================
// State Storage
// ============================================================================

// Persistence layer singleton (lazy initialized)
let persistence: BrainSessionPersistence | null = null;

/**
 * Get or create the persistence layer singleton.
 * @returns BrainSessionPersistence instance
 */
function getPersistence(): BrainSessionPersistence {
  if (!persistence) {
    persistence = getDefaultPersistence();
  }
  return persistence;
}

// ============================================================================
// Session State Management
// ============================================================================

// Re-export createDefaultSessionState from types.ts
export { createDefaultSessionState };

/**
 * Get session state from Brain notes.
 *
 * @returns Session state or null if session not found
 */
export async function getSession(): Promise<SessionState | null> {
  let state = await getPersistence().loadSession();

  // Initialize if not exists
  if (!state) {
    state = createDefaultSessionState();
    await getPersistence().saveSession(state);
  }

  return state;
}

/**
 * Update session state with provided updates and persist to Brain notes.
 *
 * @param updates - Partial updates to apply
 * @returns Updated session state or null on error
 */
export async function setSession(
  updates: SessionUpdates
): Promise<SessionState | null> {
  // Get or create current state from Brain notes
  let state = await getPersistence().loadSession();
  if (!state) {
    state = createDefaultSessionState();
  }

  const now = new Date().toISOString();

  // Apply mode update
  if (updates.mode !== undefined && updates.mode !== state.currentMode) {
    state = {
      ...state,
      currentMode: updates.mode,
      modeHistory: [...state.modeHistory, { mode: updates.mode, timestamp: now }],
      updatedAt: now,
    };
    logger.info({ mode: updates.mode }, "Session mode updated");
  }

  // Apply task update
  if (updates.task !== undefined) {
    state = {
      ...state,
      activeTask: updates.task || undefined,
      updatedAt: now,
    };
  }

  // Apply feature update
  if (updates.feature !== undefined) {
    state = {
      ...state,
      activeFeature: updates.feature || undefined,
      // Clear task when feature changes
      activeTask: updates.task ?? undefined,
      updatedAt: now,
    };
  }

  // Persist updated state to Brain notes
  await getPersistence().saveSession(state);

  return state;
}

// ============================================================================
// Immutable State Helpers
// ============================================================================

/**
 * Create a new session state with updated mode.
 * Immutable update - returns new object.
 *
 * @param state - Current session state
 * @param newMode - Mode to transition to
 * @returns Updated SessionState with mode change recorded in history
 */
export function withModeChange(
  state: SessionState,
  newMode: WorkflowMode
): SessionState {
  const now = new Date().toISOString();
  return {
    ...state,
    currentMode: newMode,
    modeHistory: [...state.modeHistory, { mode: newMode, timestamp: now }],
    updatedAt: now,
  };
}

/**
 * Create a new session state with updated feature.
 * Immutable update - returns new object.
 *
 * @param state - Current session state
 * @param feature - Feature slug/path or undefined to clear
 * @returns Updated SessionState with new active feature
 */
export function withFeatureChange(
  state: SessionState,
  feature: string | undefined
): SessionState {
  return {
    ...state,
    activeFeature: feature,
    activeTask: undefined, // Clear task when feature changes
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create a new session state with updated task.
 * Immutable update - returns new object.
 *
 * @param state - Current session state
 * @param task - Task identifier or undefined to clear
 * @returns Updated SessionState with new active task
 */
export function withTaskChange(
  state: SessionState,
  task: string | undefined
): SessionState {
  return {
    ...state,
    activeTask: task,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize session state to JSON string.
 * Used for storage and transmission.
 *
 * @param state - Session state to serialize
 * @returns JSON string representation
 */
export function serializeSessionState(state: SessionState): string {
  return JSON.stringify(state);
}

/**
 * Deserialize session state from JSON string.
 * Used for retrieval from storage.
 *
 * @param json - JSON string to parse
 * @returns Parsed SessionState or null if invalid
 */
export function deserializeSessionState(json: string): SessionState | null {
  try {
    const parsed = JSON.parse(json) as SessionState;
    // Basic validation
    if (
      typeof parsed.currentMode !== "string" ||
      !Array.isArray(parsed.modeHistory)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Get the most recent mode history entries.
 * Useful for reconstructing recent context.
 *
 * @param state - Session state
 * @param count - Number of entries to return (default 5)
 * @returns Array of recent mode history entries
 */
export function getRecentModeHistory(
  state: SessionState,
  count: number = 5
): ModeHistoryEntry[] {
  return state.modeHistory.slice(-count);
}

// ============================================================================
// Re-exports
// ============================================================================

// Re-export brain persistence layer
export {
  BrainSessionPersistence,
  BrainUnavailableError,
  SessionNotFoundError,
  getDefaultPersistence,
  resetDefaultPersistence,
  type BrainPersistenceOptions,
} from "./brain-persistence";

// Re-export types from types.ts
export type {
  SessionState,
  OrchestratorWorkflow,
  AgentInvocation,
  AgentType,
  WorkflowPhase,
  InvocationStatus,
  Decision,
  DecisionType,
  Verdict,
  VerdictDecision,
  Handoff,
  CompactionEntry,
  AgentInvocationInput,
  AgentInvocationOutput,
} from "./types";

export {
  createEmptyWorkflow,
  isAgentType,
  isWorkflowMode,
  isSessionState,
  parseSessionState,
  safeParseSessionState,
  validateSessionState,
  getSessionStateErrors,
} from "./types";
