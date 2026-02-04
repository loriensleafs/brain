/**
 * Session State Type Definitions
 *
 * TypeScript interfaces for extended session state with orchestrator workflow tracking.
 * Implements DESIGN-001 Component 1: Session State Schema.
 *
 * Key features:
 * - SessionState with orchestrator workflow tracking
 * - Session lifecycle types (OpenSession, ActiveSession)
 * - Session status enum for lifecycle states
 * - Optimistic locking via version field
 * - AJV-based runtime validation via @brain/validation
 *
 * @see DESIGN-001: Session State Architecture with Brain Note Persistence
 * @see FEATURE-001: Session Management
 */

// Re-export all types and validators from @brain/validation
export {
  type AgentInvocation,
  type AgentInvocationInput,
  type AgentInvocationOutput,
  // Types
  type AgentType,
  type CompactionEntry,
  type Decision,
  type DecisionType,
  getSessionStateErrors,
  type Handoff,
  type InvocationStatus,
  // Type guards
  isAgentType,
  isSessionState,
  isWorkflowMode,
  type ModeHistoryEntry,
  type OrchestratorWorkflow,
  parseSessionState,
  type SessionState,
  safeParseSessionState,
  type Verdict,
  type VerdictDecision,
  // Validators
  validateSessionState,
  type WorkflowMode,
  type WorkflowPhase,
} from "@brain/validation";

// ============================================================================
// Session Lifecycle Types
// ============================================================================

/**
 * Session lifecycle status values.
 * Follows the state machine: IN_PROGRESS <-> PAUSED -> COMPLETE
 */
export type SessionStatus = "IN_PROGRESS" | "PAUSED" | "COMPLETE";

/**
 * Valid session status values for runtime checking.
 */
export const SESSION_STATUS_VALUES: readonly SessionStatus[] = [
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETE",
] as const;

/**
 * Type guard to check if a value is a valid SessionStatus.
 *
 * @param value - Value to check
 * @returns True if value is a valid SessionStatus
 */
export function isSessionStatus(value: unknown): value is SessionStatus {
  return typeof value === "string" && SESSION_STATUS_VALUES.includes(value as SessionStatus);
}

/**
 * Represents an open session (status: IN_PROGRESS or PAUSED).
 * Used for listing sessions that can be resumed or are currently active.
 */
export interface OpenSession {
  /** Session identifier (e.g., "SESSION-2026-02-04_01-feature-xyz") */
  sessionId: string;
  /** Session lifecycle status */
  status: "IN_PROGRESS" | "PAUSED";
  /** Session date in YYYY-MM-DD format */
  date: string;
  /** Git branch associated with the session (if available) */
  branch?: string;
  /** Session topic extracted from title */
  topic?: string;
  /** Full permalink to the session note */
  permalink: string;
}

/**
 * Represents the currently active session (status: IN_PROGRESS).
 * Only ONE session can be active at a time.
 */
export interface ActiveSession {
  /** Session identifier */
  sessionId: string;
  /** Always IN_PROGRESS for active session */
  status: "IN_PROGRESS";
  /** Full path to the session note */
  path: string;
  /** Current workflow mode */
  mode?: string;
  /** Active task description */
  task?: string;
  /** Git branch associated with the session */
  branch?: string;
  /** Session date in YYYY-MM-DD format */
  date: string;
  /** Session topic */
  topic?: string;
  /** Validation status */
  isValid: boolean;
  /** Validation check results */
  checks: Array<{ name: string; passed: boolean }>;
}

/**
 * Extended session state with computed open and active sessions.
 * openSessions and activeSession are NEVER persisted - computed just-in-time.
 */
export interface ExtendedSessionState {
  /** Base session state from Brain notes */
  sessionState: import("@brain/validation").SessionState | null;
  /** Open sessions computed from session notes (never persisted) */
  openSessions: OpenSession[];
  /** Active session computed from session notes (never persisted) */
  activeSession: ActiveSession | null;
}

/**
 * Result of a session creation operation.
 */
export interface CreateSessionResult {
  /** Whether the operation succeeded */
  success: true;
  /** The new session's identifier */
  sessionId: string;
  /** Path to the session note */
  path: string;
  /** ID of auto-paused session, if any */
  autoPaused: string | null;
}

/**
 * Result of a session status change operation.
 */
export interface SessionStatusChangeResult {
  /** Whether the operation succeeded */
  success: true;
  /** Session identifier */
  sessionId: string;
  /** Previous status before the change */
  previousStatus: SessionStatus;
  /** New status after the change */
  newStatus: SessionStatus;
}

// ============================================================================
// Factory Functions
// ============================================================================

import type { OrchestratorWorkflow, SessionState } from "@brain/validation";

/**
 * Create a new empty orchestrator workflow.
 *
 * @returns Default OrchestratorWorkflow with empty collections
 */
export function createEmptyWorkflow(): OrchestratorWorkflow {
  const now = new Date().toISOString();
  return {
    activeAgent: null,
    workflowPhase: "planning",
    agentHistory: [],
    decisions: [],
    verdicts: [],
    pendingHandoffs: [],
    compactionHistory: [],
    startedAt: now,
    lastAgentChange: now,
  };
}

/**
 * Create a default session state for a new session.
 *
 * @returns Default SessionState with analysis mode and version 1
 */
export function createDefaultSessionState(): SessionState {
  const now = new Date().toISOString();
  return {
    currentMode: "analysis",
    modeHistory: [{ mode: "analysis", timestamp: now }],
    protocolStartComplete: false,
    protocolEndComplete: false,
    protocolStartEvidence: {},
    protocolEndEvidence: {},
    orchestratorWorkflow: null,
    activeFeature: undefined,
    activeTask: undefined,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}
