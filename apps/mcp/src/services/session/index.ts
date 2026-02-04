/**
 * Session State Service
 *
 * Unified session and mode management. Consolidates:
 * - Session state (mode, task, feature)
 * - Session lifecycle (create, pause, resume, complete)
 * - Brain note persistence (single source of truth)
 *
 * State is persisted to Brain notes via BrainSessionPersistence.
 * No in-memory caching - Brain notes are the source of truth.
 * Uses fixed path: sessions/session (one session per project).
 *
 * Session notes are stored in sessions/ folder with frontmatter:
 * ```yaml
 * ---
 * title: SESSION-YYYY-MM-DD_NN-topic
 * type: session
 * status: IN_PROGRESS | PAUSED | COMPLETE
 * date: YYYY-MM-DD
 * tags: [session]
 * ---
 * ```
 *
 * @see brain-persistence.ts for persistence layer
 * @see FEATURE-001: Session Management
 */

import { getBasicMemoryClient } from "../../proxy/client";
import { logger } from "../../utils/internal/logger";
import { getSearchService } from "../search";
import { type BrainSessionPersistence, getDefaultPersistence } from "./brain-persistence";
import type {
  ActiveSession,
  CreateSessionResult,
  ExtendedSessionState,
  ModeHistoryEntry,
  OpenSession,
  SessionState,
  SessionStatus,
  SessionStatusChangeResult,
  WorkflowMode,
} from "./types";
import { createDefaultSessionState, isSessionStatus } from "./types";

// Re-export types from types.ts
export type {
  WorkflowMode,
  ModeHistoryEntry,
  SessionStatus,
  OpenSession,
  ActiveSession,
  ExtendedSessionState,
  CreateSessionResult,
  SessionStatusChangeResult,
};
export { isSessionStatus, SESSION_STATUS_VALUES } from "./types";

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when auto-pause fails during session create or resume.
 * Indicates a concurrent modification or lock condition.
 * No partial state changes occur when this error is thrown.
 */
export class AutoPauseFailedError extends Error {
  constructor(
    message: string,
    public readonly sessionId: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "AutoPauseFailedError";
  }
}

/**
 * Error thrown when a session is not found.
 */
export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = "SessionNotFoundError";
  }
}

/**
 * Error thrown when an invalid status transition is attempted.
 */
export class InvalidStatusTransitionError extends Error {
  constructor(sessionId: string, fromStatus: SessionStatus | "UNKNOWN", toStatus: SessionStatus) {
    super(`Invalid status transition for ${sessionId}: ${fromStatus} -> ${toStatus}`);
    this.name = "InvalidStatusTransitionError";
  }
}

// ============================================================================
// Types and Constants
// ============================================================================

/**
 * Session notes folder in Brain memory.
 */
const SESSIONS_FOLDER = "sessions/";

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
export async function setSession(updates: SessionUpdates): Promise<SessionState | null> {
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
export function withModeChange(state: SessionState, newMode: WorkflowMode): SessionState {
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
export function withFeatureChange(state: SessionState, feature: string | undefined): SessionState {
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
export function withTaskChange(state: SessionState, task: string | undefined): SessionState {
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
    if (typeof parsed.currentMode !== "string" || !Array.isArray(parsed.modeHistory)) {
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
export function getRecentModeHistory(state: SessionState, count: number = 5): ModeHistoryEntry[] {
  return state.modeHistory.slice(-count);
}

// ============================================================================
// Session Lifecycle Management
// ============================================================================

/**
 * Response structure from read_note tool.
 */
interface ReadNoteResult {
  content?: Array<{ type: string; text?: string }>;
}

/**
 * Parse session status from note content.
 * Looks for status: field in frontmatter.
 * Treats missing status as COMPLETE for backward compatibility.
 *
 * @param content - Full note content including frontmatter
 * @returns Parsed session status
 */
function parseSessionStatusFromContent(content: string): SessionStatus {
  // Match status field in frontmatter (case-insensitive)
  const statusMatch = content.match(/^status:\s*(IN_PROGRESS|PAUSED|COMPLETE)\s*$/im);
  if (statusMatch && isSessionStatus(statusMatch[1])) {
    return statusMatch[1] as SessionStatus;
  }
  // Backward compatibility: missing status = COMPLETE
  return "COMPLETE";
}

/**
 * Extract branch from session note content.
 * Looks for patterns like "Branch: feature/xyz" or "**Branch:** main"
 */
function extractBranchFromContent(content?: string): string | undefined {
  if (!content) return undefined;

  // Match "## Branch" section header
  const sectionMatch = content.match(/##\s*Branch\s*\n+`?([a-zA-Z0-9_\-/]+)`?/i);
  if (sectionMatch) return sectionMatch[1];

  // Match "Branch:" or "**Branch:**" pattern
  const branchMatch = content.match(/\*?\*?Branch:\*?\*?\s*`?([a-zA-Z0-9_\-/]+)`?/i);
  if (branchMatch) return branchMatch[1];

  return undefined;
}

/**
 * Extract topic from session title.
 * Title format: SESSION-YYYY-MM-DD_NN-topic
 */
function extractTopicFromTitle(title: string): string | undefined {
  const match = title.match(/SESSION-\d{4}-\d{2}-\d{2}_\d{2}-(.+)$/);
  return match ? match[1] : undefined;
}

/**
 * Extract date from session title.
 * Title format: SESSION-YYYY-MM-DD_NN-topic
 */
function extractDateFromTitle(title: string): string {
  const match = title.match(/SESSION-(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

/**
 * Generate the next session number for today.
 * Queries existing sessions for today and returns the next available number.
 *
 * @param project - Project path
 * @returns Next session number (01, 02, etc.)
 */
async function getNextSessionNumber(project?: string): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const search = getSearchService();

  try {
    const response = await search.search(`SESSION-${today}`, {
      project,
      limit: 100,
      mode: "auto",
      folders: [SESSIONS_FOLDER],
    });

    // Find the highest session number for today
    let maxNumber = 0;
    for (const result of response.results) {
      const match = result.title?.match(/SESSION-\d{4}-\d{2}-\d{2}_(\d{2})/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    }

    return String(maxNumber + 1).padStart(2, "0");
  } catch (error) {
    logger.debug({ error }, "Failed to query existing sessions, starting at 01");
    return "01";
  }
}

/**
 * Query open sessions from Brain memory.
 * Returns sessions with status IN_PROGRESS or PAUSED.
 * Sessions without explicit status are treated as COMPLETE (backward compatible).
 *
 * @param project - Optional project path
 * @returns Array of open sessions
 */
export async function queryOpenSessions(project?: string): Promise<OpenSession[]> {
  const search = getSearchService();

  try {
    // Search for session notes
    const response = await search.search("session status", {
      project,
      limit: 100,
      mode: "auto",
      folders: [SESSIONS_FOLDER],
      fullContent: true,
    });

    const openSessions: OpenSession[] = [];

    for (const result of response.results) {
      if (!result.title || !result.permalink) continue;

      // Only include session notes (title starts with SESSION-)
      if (!result.title.startsWith("SESSION-")) continue;

      // Parse status from content
      const content = result.fullContent || result.snippet || "";
      const status = parseSessionStatusFromContent(content);

      // Only include IN_PROGRESS or PAUSED sessions
      if (status !== "IN_PROGRESS" && status !== "PAUSED") continue;

      const date = extractDateFromTitle(result.title);
      const branch = extractBranchFromContent(content);
      const topic = extractTopicFromTitle(result.title);

      openSessions.push({
        sessionId: result.title,
        status: status as "IN_PROGRESS" | "PAUSED",
        date,
        branch,
        topic,
        permalink: result.permalink,
      });
    }

    // Sort by date descending (most recent first)
    openSessions.sort((a, b) => b.date.localeCompare(a.date));

    return openSessions;
  } catch (error) {
    logger.error({ error }, "Failed to query open sessions");
    return [];
  }
}

/**
 * Get the currently active session (status: IN_PROGRESS).
 * Only ONE session can be active at a time.
 *
 * @param project - Optional project path
 * @returns Active session or null if none
 */
export async function queryActiveSession(project?: string): Promise<ActiveSession | null> {
  const openSessions = await queryOpenSessions(project);

  // Find the single IN_PROGRESS session
  const active = openSessions.find((s) => s.status === "IN_PROGRESS");
  if (!active) return null;

  return {
    sessionId: active.sessionId,
    status: "IN_PROGRESS",
    path: `${SESSIONS_FOLDER}${active.sessionId}`,
    mode: undefined, // Could be enriched from session state
    task: undefined,
    branch: active.branch,
    date: active.date,
    topic: active.topic,
    isValid: true,
    checks: [],
  };
}

/**
 * Get extended session state with computed open and active sessions.
 * openSessions and activeSession are NEVER persisted - computed just-in-time.
 *
 * @param project - Optional project path
 * @returns Extended session state with computed fields
 */
export async function getExtendedSession(project?: string): Promise<ExtendedSessionState> {
  const [sessionState, openSessions, activeSession] = await Promise.all([
    getSession(),
    queryOpenSessions(project),
    queryActiveSession(project),
  ]);

  return {
    sessionState,
    openSessions,
    activeSession,
  };
}

/**
 * Update session note status via Brain edit_note.
 *
 * @param sessionId - Session identifier (title)
 * @param newStatus - New status to set
 * @param project - Optional project path
 */
async function updateSessionNoteStatus(
  sessionId: string,
  newStatus: SessionStatus,
  project?: string,
): Promise<void> {
  const client = await getBasicMemoryClient();

  // Read current content to get current status
  const readResult = (await client.callTool({
    name: "read_note",
    arguments: {
      identifier: `${SESSIONS_FOLDER}${sessionId}`,
      project,
    },
  })) as ReadNoteResult;

  const textContent = readResult.content?.find((c) => c.type === "text")?.text;
  if (!textContent) {
    throw new SessionNotFoundError(sessionId);
  }

  // Find and replace status in frontmatter
  const statusPattern = /^status:\s*(IN_PROGRESS|PAUSED|COMPLETE)\s*$/im;
  let updatedContent: string;

  if (statusPattern.test(textContent)) {
    // Replace existing status
    updatedContent = textContent.replace(statusPattern, `status: ${newStatus}`);
  } else {
    // Add status after type field in frontmatter
    const typePattern = /^(type:\s*session\s*)$/im;
    if (typePattern.test(textContent)) {
      updatedContent = textContent.replace(typePattern, `$1\nstatus: ${newStatus}`);
    } else {
      // Fallback: add after first ---
      updatedContent = textContent.replace(/^(---\n)/, `$1status: ${newStatus}\n`);
    }
  }

  // Write updated content
  await client.callTool({
    name: "write_note",
    arguments: {
      title: sessionId,
      content: updatedContent.replace(/^---\n[\s\S]*?\n---\n/, ""), // Remove frontmatter, write_note adds it
      folder: SESSIONS_FOLDER.replace(/\/$/, ""),
      project,
    },
  });

  logger.info({ sessionId, newStatus }, "Session note status updated");
}

/**
 * Auto-pause the currently active session.
 * Called before createSession and resumeSession.
 *
 * @param project - Optional project path
 * @returns ID of paused session, or null if none was active
 * @throws AutoPauseFailedError if pause fails
 */
async function autoPauseActiveSession(project?: string): Promise<string | null> {
  const active = await queryActiveSession(project);
  if (!active) return null;

  try {
    await updateSessionNoteStatus(active.sessionId, "PAUSED", project);
    logger.info({ sessionId: active.sessionId }, "Auto-paused active session");
    return active.sessionId;
  } catch (error) {
    throw new AutoPauseFailedError(
      `Failed to auto-pause session ${active.sessionId}`,
      active.sessionId,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Create a new session note with status IN_PROGRESS.
 * Auto-pauses any existing IN_PROGRESS session before creating.
 *
 * @param topic - Session topic/description
 * @param project - Optional project path
 * @returns Result with session ID, path, and any auto-paused session
 * @throws AutoPauseFailedError if auto-pause fails
 */
export async function createSession(topic: string, project?: string): Promise<CreateSessionResult> {
  // Auto-pause any active session first (atomic - fails if this fails)
  const autoPaused = await autoPauseActiveSession(project);

  // Generate session ID
  const today = new Date().toISOString().split("T")[0];
  const sessionNumber = await getNextSessionNumber(project);
  const sanitizedTopic = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const sessionId = `SESSION-${today}_${sessionNumber}-${sanitizedTopic}`;

  // Create session note content
  const content = `# ${sessionId}

## Status

**IN_PROGRESS**

## Topic

${topic}

## Branch

\`main\`

## Checklist

- [ ] Session start protocol complete
- [ ] Work completed
- [ ] Session end protocol complete
`;

  // Write session note via Brain MCP
  const client = await getBasicMemoryClient();
  await client.callTool({
    name: "write_note",
    arguments: {
      title: sessionId,
      content,
      folder: SESSIONS_FOLDER.replace(/\/$/, ""),
      project,
    },
  });

  logger.info({ sessionId, topic, autoPaused }, "Session created");

  return {
    success: true,
    sessionId,
    path: `${SESSIONS_FOLDER}${sessionId}`,
    autoPaused,
  };
}

/**
 * Pause an active session.
 * Transitions status from IN_PROGRESS to PAUSED.
 *
 * @param sessionId - Session identifier to pause
 * @param project - Optional project path
 * @returns Result with status change details
 * @throws SessionNotFoundError if session not found
 * @throws InvalidStatusTransitionError if session is not IN_PROGRESS
 */
export async function pauseSession(
  sessionId: string,
  project?: string,
): Promise<SessionStatusChangeResult> {
  // Verify session exists and is IN_PROGRESS
  const openSessions = await queryOpenSessions(project);
  const session = openSessions.find((s) => s.sessionId === sessionId);

  if (!session) {
    throw new SessionNotFoundError(sessionId);
  }

  if (session.status !== "IN_PROGRESS") {
    throw new InvalidStatusTransitionError(sessionId, session.status, "PAUSED");
  }

  await updateSessionNoteStatus(sessionId, "PAUSED", project);

  return {
    success: true,
    sessionId,
    previousStatus: "IN_PROGRESS",
    newStatus: "PAUSED",
  };
}

/**
 * Resume a paused session.
 * Transitions status from PAUSED to IN_PROGRESS.
 * Auto-pauses any existing IN_PROGRESS session before resuming.
 *
 * @param sessionId - Session identifier to resume
 * @param project - Optional project path
 * @returns Result with status change details
 * @throws SessionNotFoundError if session not found
 * @throws InvalidStatusTransitionError if session is not PAUSED
 * @throws AutoPauseFailedError if auto-pause fails
 */
export async function resumeSession(
  sessionId: string,
  project?: string,
): Promise<SessionStatusChangeResult> {
  // Verify session exists and is PAUSED
  const openSessions = await queryOpenSessions(project);
  const session = openSessions.find((s) => s.sessionId === sessionId);

  if (!session) {
    throw new SessionNotFoundError(sessionId);
  }

  if (session.status !== "PAUSED") {
    throw new InvalidStatusTransitionError(sessionId, session.status, "IN_PROGRESS");
  }

  // Auto-pause any active session first (atomic - fails if this fails)
  await autoPauseActiveSession(project);

  await updateSessionNoteStatus(sessionId, "IN_PROGRESS", project);

  return {
    success: true,
    sessionId,
    previousStatus: "PAUSED",
    newStatus: "IN_PROGRESS",
  };
}

/**
 * Complete a session.
 * Transitions status from IN_PROGRESS to COMPLETE.
 * A completed session cannot be resumed.
 *
 * @param sessionId - Session identifier to complete
 * @param project - Optional project path
 * @returns Result with status change details
 * @throws SessionNotFoundError if session not found
 * @throws InvalidStatusTransitionError if session is not IN_PROGRESS
 */
export async function completeSession(
  sessionId: string,
  project?: string,
): Promise<SessionStatusChangeResult> {
  // Verify session exists and is IN_PROGRESS
  const openSessions = await queryOpenSessions(project);
  const session = openSessions.find((s) => s.sessionId === sessionId);

  if (!session) {
    throw new SessionNotFoundError(sessionId);
  }

  if (session.status !== "IN_PROGRESS") {
    throw new InvalidStatusTransitionError(sessionId, session.status, "COMPLETE");
  }

  await updateSessionNoteStatus(sessionId, "COMPLETE", project);

  return {
    success: true,
    sessionId,
    previousStatus: "IN_PROGRESS",
    newStatus: "COMPLETE",
  };
}

// ============================================================================
// Re-exports
// ============================================================================

// Re-export brain persistence layer (except SessionNotFoundError which we define locally)
export {
  type BrainPersistenceOptions,
  BrainSessionPersistence,
  BrainUnavailableError,
  getDefaultPersistence,
  resetDefaultPersistence,
} from "./brain-persistence";

// Re-export types from types.ts
export type {
  AgentInvocation,
  AgentInvocationInput,
  AgentInvocationOutput,
  AgentType,
  CompactionEntry,
  Decision,
  DecisionType,
  Handoff,
  InvocationStatus,
  OrchestratorWorkflow,
  SessionState,
  Verdict,
  VerdictDecision,
  WorkflowPhase,
} from "./types";

export {
  createEmptyWorkflow,
  getSessionStateErrors,
  isAgentType,
  isSessionState,
  isWorkflowMode,
  parseSessionState,
  safeParseSessionState,
  validateSessionState,
} from "./types";
