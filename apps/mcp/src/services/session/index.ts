/**
 * Session State Service
 *
 * Unified session and mode management. Consolidates:
 * - Session lifecycle (init, cleanup, orphan detection)
 * - Session state (mode, task, feature)
 * - In-memory state storage
 * - File cache sync for hooks
 *
 * State is stored in-memory with file cache at ~/.local/state/brain/session.json
 * for hooks to read without MCP access.
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { logger } from "../../utils/internal/logger";

// ============================================================================
// Types and Constants
// ============================================================================

/**
 * Available workflow modes.
 *
 * Modes control what tools are allowed:
 * - analysis: Read-only exploration. Blocks Edit, Write, Bash.
 * - planning: Design phase. Blocks Edit, Write. Allows read-only Bash.
 * - coding: Full access. All tools allowed.
 * - disabled: Mode enforcement disabled. All tools allowed.
 */
export type WorkflowMode = "analysis" | "planning" | "coding" | "disabled";

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
 * Entry in the mode history array.
 * Tracks each mode transition with timestamp.
 */
export interface ModeHistoryEntry {
  /** The mode that was set */
  mode: WorkflowMode;
  /** ISO timestamp when mode was set */
  timestamp: string;
}

/**
 * Session state structure for persistent context.
 *
 * Contains critical information that must survive context compaction:
 * - Current workflow mode (analysis/planning/coding/disabled)
 * - History of mode transitions
 * - Active feature being worked on
 * - Active task within the feature
 */
export interface SessionState {
  /** Unique identifier for this session */
  sessionId: string;
  /** Current workflow mode */
  currentMode: WorkflowMode;
  /** History of mode changes for context reconstruction */
  modeHistory: ModeHistoryEntry[];
  /** Currently active feature (slug/path) */
  activeFeature?: string;
  /** Currently active task within the feature */
  activeTask?: string;
  /** ISO timestamp of last state update */
  updatedAt: string;
}

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

/**
 * Session metadata stored in meta.json for orphan detection.
 */
interface SessionMeta {
  pid: number;
  startedAt: string;
  lastActivity: string;
}

// ============================================================================
// State Storage
// ============================================================================

// In-memory session state storage
const sessionStore = new Map<string, SessionState>();

// Current session ID (set by session lifecycle management)
let currentSessionId: string | null = null;

// ============================================================================
// Path Helpers (XDG-compliant)
// ============================================================================

/**
 * Get the base state directory for Brain.
 *
 * Uses XDG_STATE_HOME if set, otherwise defaults to ~/.local/state/brain
 */
export function getStateDir(): string {
  const xdgState =
    process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state");
  return path.join(xdgState, "brain");
}

/**
 * Get the sessions directory.
 *
 * All session state is stored under this directory, namespaced by session ID.
 */
export function getSessionsDir(): string {
  return path.join(getStateDir(), "sessions");
}

/**
 * Get the path for a specific session's directory.
 *
 * @param sessionId - UUID of the session
 */
export function getSessionPath(sessionId: string): string {
  return path.join(getSessionsDir(), sessionId);
}

/**
 * Get the path to the session cache file for hooks.
 * This is a well-known location that hooks can read without session ID.
 */
function getSessionCachePath(): string {
  return path.join(getStateDir(), "session.json");
}

// ============================================================================
// File Cache Sync
// ============================================================================

/**
 * Sync session state to file cache for hooks.
 * Hooks cannot access MCP tools, so they read this file.
 */
function syncToFileCache(state: SessionState): void {
  try {
    const cachePath = getSessionCachePath();
    const cacheDir = path.dirname(cachePath);

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Write simplified state for hooks
    const hookState = {
      mode: state.currentMode,
      task: state.activeTask,
      feature: state.activeFeature,
      sessionId: state.sessionId,
      updatedAt: state.updatedAt,
    };

    fs.writeFileSync(cachePath, JSON.stringify(hookState, null, 2));
    logger.debug({ path: cachePath }, "Session state synced to file cache");
  } catch (error) {
    logger.warn({ error }, "Failed to sync session state to file cache");
  }
}

// ============================================================================
// Session Lifecycle Management
// ============================================================================

/**
 * Initialize a new session for this process.
 *
 * Creates a session directory with meta.json containing PID for orphan detection.
 * Sets BRAIN_SESSION_ID env var for hooks to read.
 *
 * @returns The session ID (UUID)
 */
export function initSession(): string {
  if (!currentSessionId) {
    currentSessionId = crypto.randomUUID();

    // Create session directory
    const sessionDir = getSessionPath(currentSessionId);
    fs.mkdirSync(sessionDir, { recursive: true });

    // Write meta.json with PID for orphan detection
    const meta: SessionMeta = {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };
    const metaPath = path.join(sessionDir, "meta.json");
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    // Set env var for hooks to read
    process.env.BRAIN_SESSION_ID = currentSessionId;

    // Initialize session state
    const state = createDefaultSessionState(currentSessionId);
    sessionStore.set(currentSessionId, state);
    syncToFileCache(state);

    logger.info({ sessionId: currentSessionId }, "Session initialized");
  }
  return currentSessionId;
}

/**
 * Get the current session ID.
 *
 * @returns Session ID or null if not initialized
 */
export function getSessionId(): string | null {
  return currentSessionId;
}

/**
 * Alias for getSessionId for backward compatibility.
 */
export function getCurrentSessionId(): string | null {
  return currentSessionId;
}

/**
 * Update session last activity timestamp.
 *
 * Call this periodically to mark session as active.
 */
export function updateSessionActivity(): void {
  if (!currentSessionId) return;

  try {
    const metaPath = path.join(getSessionPath(currentSessionId), "meta.json");
    if (fs.existsSync(metaPath)) {
      const meta: SessionMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      meta.lastActivity = new Date().toISOString();
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    }
  } catch (error) {
    logger.warn({ error }, "Failed to update session activity");
  }
}

/**
 * Clean up the current session.
 *
 * Removes the session directory and all its contents.
 * Called on graceful shutdown.
 */
export async function cleanupSession(): Promise<void> {
  if (currentSessionId) {
    const sessionDir = getSessionPath(currentSessionId);
    try {
      await fs.promises.rm(sessionDir, { recursive: true, force: true });
      logger.info({ sessionId: currentSessionId }, "Session cleaned up");
    } catch (error) {
      logger.warn({ sessionId: currentSessionId, error }, "Failed to cleanup session");
    }
    sessionStore.delete(currentSessionId);
    currentSessionId = null;
    delete process.env.BRAIN_SESSION_ID;
  }
}

/**
 * Clean up orphan sessions from crashed processes.
 *
 * Scans all session directories and removes any where the PID
 * is no longer alive. Called on startup before creating new session.
 */
export async function cleanupOrphanSessions(): Promise<void> {
  const sessionsDir = getSessionsDir();

  // Skip if sessions directory doesn't exist yet
  if (!fs.existsSync(sessionsDir)) {
    return;
  }

  try {
    const sessions = await fs.promises.readdir(sessionsDir);

    for (const sid of sessions) {
      const sessionDir = path.join(sessionsDir, sid);
      const metaPath = path.join(sessionDir, "meta.json");

      try {
        // Read session metadata
        const metaContent = await fs.promises.readFile(metaPath, "utf-8");
        const meta: SessionMeta = JSON.parse(metaContent);

        // Check if owning process is still alive
        if (!isProcessAlive(meta.pid)) {
          await fs.promises.rm(sessionDir, { recursive: true, force: true });
          logger.info(
            { sessionId: sid, pid: meta.pid },
            "Cleaned up orphan session"
          );
        }
      } catch {
        // Corrupted or unreadable session, remove it
        await fs.promises.rm(sessionDir, { recursive: true, force: true });
        logger.info({ sessionId: sid }, "Removed corrupted session");
      }
    }
  } catch (error) {
    // Non-fatal: log and continue
    logger.warn({ error }, "Error during orphan session cleanup");
  }
}

/**
 * Check if a process is still alive.
 *
 * Uses signal 0 which doesn't actually send a signal but checks
 * if the process exists and we have permission to signal it.
 *
 * @param pid - Process ID to check
 * @returns true if process is alive
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear the current session ID.
 * Called by session lifecycle management during cleanup.
 */
export function clearCurrentSessionId(): void {
  if (currentSessionId) {
    sessionStore.delete(currentSessionId);
    currentSessionId = null;
  }
}

// ============================================================================
// Session State Management
// ============================================================================

/**
 * Create default session state for a new session.
 *
 * @param sessionId - Unique session identifier
 * @returns Default SessionState with analysis mode
 */
export function createDefaultSessionState(sessionId: string): SessionState {
  const now = new Date().toISOString();
  return {
    sessionId,
    currentMode: DEFAULT_MODE,
    modeHistory: [{ mode: DEFAULT_MODE, timestamp: now }],
    activeFeature: undefined,
    activeTask: undefined,
    updatedAt: now,
  };
}

/**
 * Set the current session ID.
 * Called by session lifecycle management during init.
 *
 * @param sessionId - The session ID to set as current
 */
export function setCurrentSessionId(sessionId: string): void {
  currentSessionId = sessionId;

  // Initialize session state if not exists
  if (!sessionStore.has(sessionId)) {
    const state = createDefaultSessionState(sessionId);
    sessionStore.set(sessionId, state);
    syncToFileCache(state);
  }
}

/**
 * Get session state.
 *
 * @param sessionId - Optional session ID. Uses current session if not provided.
 * @returns Session state or null if session not found
 */
export function getSession(sessionId?: string): SessionState | null {
  const id = sessionId ?? currentSessionId;

  if (!id) {
    logger.warn("No session ID provided and no current session");
    return null;
  }

  let state = sessionStore.get(id);

  // Initialize if not exists
  if (!state) {
    state = createDefaultSessionState(id);
    sessionStore.set(id, state);
    syncToFileCache(state);
  }

  return state;
}

/**
 * Update session state with provided updates.
 *
 * @param updates - Partial updates to apply
 * @param sessionId - Optional session ID. Uses current session if not provided.
 * @returns Updated session state or null if session not found
 */
export function setSession(
  updates: SessionUpdates,
  sessionId?: string
): SessionState | null {
  const id = sessionId ?? currentSessionId;

  if (!id) {
    logger.warn("No session ID provided and no current session");
    return null;
  }

  // Get or create current state
  let state = sessionStore.get(id);
  if (!state) {
    state = createDefaultSessionState(id);
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

  // Store updated state
  sessionStore.set(id, state);
  syncToFileCache(state);

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
      typeof parsed.sessionId !== "string" ||
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
