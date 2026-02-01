/**
 * Inngest event type definitions for Brain MCP server.
 *
 * All events are typed for compile-time safety.
 * Event names follow the pattern: "domain/action.verb"
 *
 * Session Protocol Events (ADR-016):
 * - session/protocol.start: Triggered at session start for protocol enforcement
 * - session/protocol.end: Triggered at session end for cleanup validation
 * - session/state.update: Updates session state (mode, feature, task)
 * - session/state.query: Retrieves current session state
 * - session/mode.changed: Emitted when workflow mode changes
 *
 * Orchestrator Events (ADR-016):
 * - orchestrator/agent.invoked: Agent routing events
 * - orchestrator/agent.completed: Agent completion events
 */

import type { AgentType, WorkflowMode } from "../services/session";

// ============================================================================
// Session Protocol Events (ADR-016)
// ============================================================================

/**
 * Session protocol start event.
 * Triggered at session start to enforce protocol requirements.
 *
 * @see ADR-016: Automatic Session Protocol Enforcement
 */
export type SessionProtocolStartEvent = {
  name: "session/protocol.start";
  data: {
    /** Working directory for this session */
    workingDirectory: string;
    /** ISO timestamp when session started */
    timestamp: string;
  };
};

/**
 * Session protocol end event.
 * Triggered at session end to validate protocol completion.
 *
 * @see ADR-016: Automatic Session Protocol Enforcement
 */
export type SessionProtocolEndEvent = {
  name: "session/protocol.end";
  data: {
    /** ISO timestamp when session end was triggered */
    timestamp: string;
  };
};

// ============================================================================
// Orchestrator Events (ADR-016)
// ============================================================================

/**
 * Agent invocation output structure.
 * Matches the AgentInvocationOutput interface from session types.
 */
export interface AgentInvocationOutputData {
  /** Artifact paths created or modified by the agent */
  artifacts: string[];
  /** Summary of work performed */
  summary: string;
  /** Recommendations for next steps */
  recommendations: string[];
  /** Blockers preventing completion */
  blockers: string[];
}

/**
 * Orchestrator agent invoked event.
 * Triggered when orchestrator routes to a specialist agent.
 *
 * @see ADR-016: Automatic Session Protocol Enforcement
 */
export type OrchestratorAgentInvokedEvent = {
  name: "orchestrator/agent.invoked";
  data: {
    /** Agent type that was invoked */
    agent: AgentType;
    /** Prompt or instruction given to the agent */
    prompt: string;
    /** Additional context passed to the agent */
    context: Record<string, unknown>;
    /** Agent that handed off (null if orchestrator-initiated) */
    handoffFrom: AgentType | null;
    /** ISO timestamp when agent was invoked */
    timestamp: string;
  };
};

/**
 * Orchestrator agent completed event.
 * Triggered when a specialist agent completes execution.
 *
 * @see ADR-016: Automatic Session Protocol Enforcement
 */
export type OrchestratorAgentCompletedEvent = {
  name: "orchestrator/agent.completed";
  data: {
    /** Agent type that completed */
    agent: AgentType;
    /** Output from the agent execution */
    output: AgentInvocationOutputData;
    /** Next agent to hand off to (null if returning to orchestrator) */
    handoffTo: AgentType | null;
    /** Reason for handoff or completion */
    handoffReason: string;
    /** ISO timestamp when agent completed */
    timestamp: string;
  };
};

// ============================================================================
// Feature Completion Events
// ============================================================================

/**
 * Feature completion requested event.
 * Triggered when a feature is marked as complete and needs validation.
 */
export type FeatureCompletionRequestedEvent = {
  name: "feature/completion.requested";
  data: {
    /** Unique identifier for the feature being validated */
    featureId: string;
    /** Additional context for the validation workflow */
    context: Record<string, unknown>;
  };
};

/**
 * Approval requested event.
 * Triggered when a workflow requires human approval to proceed.
 */
export type ApprovalRequestedEvent = {
  name: "approval/requested";
  data: {
    /** Unique identifier for this approval request */
    approvalId: string;
    /** Type of approval being requested */
    approvalType: string;
    /** Human-readable description of what needs approval */
    description: string;
    /** Additional context for the approval decision */
    context: Record<string, unknown>;
  };
};

/**
 * Approval granted event.
 * Sent when a human approves a pending approval request.
 */
export type ApprovalGrantedEvent = {
  name: "approval/granted";
  data: {
    /** Unique identifier matching the approval request */
    approvalId: string;
    /** Identifier of the user who granted approval */
    approvedBy: string;
    /** Optional comment from the approver */
    comment?: string;
  };
};

/**
 * Approval denied event.
 * Sent when a human denies a pending approval request.
 */
export type ApprovalDeniedEvent = {
  name: "approval/denied";
  data: {
    /** Unique identifier matching the approval request */
    approvalId: string;
    /** Identifier of the user who denied approval */
    deniedBy: string;
    /** Reason for denial */
    reason: string;
  };
};

/**
 * Session state update event.
 * Triggered when session state changes (mode, feature, task).
 */
export type SessionStateUpdateEvent = {
  name: "session/state.update";
  data: {
    /** Type of update being applied */
    updateType: "mode" | "feature" | "task" | "init";
    /** New mode value (for mode updates) */
    mode?: WorkflowMode;
    /** New feature value (for feature updates) */
    feature?: string;
    /** New task value (for task updates) */
    task?: string;
  };
};

/**
 * Session state query event.
 * Triggered to retrieve current session state.
 */
export type SessionStateQueryEvent = {
  name: "session/state.query";
  data: Record<string, never>;
};

/**
 * Session mode changed event.
 * Emitted when a session's workflow mode changes.
 * Downstream workflows can subscribe to react to mode transitions.
 */
export type SessionModeChangedEvent = {
  name: "session/mode.changed";
  data: {
    /** Previous workflow mode */
    previousMode: WorkflowMode;
    /** New workflow mode */
    newMode: WorkflowMode;
    /** ISO timestamp of the mode change */
    changedAt: string;
    /** Active feature at time of change (if any) */
    activeFeature?: string;
    /** Active task at time of change (if any) */
    activeTask?: string;
  };
};

// ============================================================================
// Event Type Union
// ============================================================================

/**
 * Union of all Inngest events for type safety.
 * Add new event types here as they are defined.
 *
 * Events grouped by domain:
 * - session/*: Session lifecycle and protocol events
 * - orchestrator/*: Agent routing and coordination events
 * - feature/*: Feature completion workflow events
 * - approval/*: Human-in-the-loop approval events
 */
export type InngestEvents = {
  // Session Protocol Events (ADR-016)
  "session/protocol.start": SessionProtocolStartEvent;
  "session/protocol.end": SessionProtocolEndEvent;
  "session/state.update": SessionStateUpdateEvent;
  "session/state.query": SessionStateQueryEvent;
  "session/mode.changed": SessionModeChangedEvent;

  // Orchestrator Events (ADR-016)
  "orchestrator/agent.invoked": OrchestratorAgentInvokedEvent;
  "orchestrator/agent.completed": OrchestratorAgentCompletedEvent;

  // Feature Completion Events
  "feature/completion.requested": FeatureCompletionRequestedEvent;

  // Approval Events (HITL)
  "approval/requested": ApprovalRequestedEvent;
  "approval/granted": ApprovalGrantedEvent;
  "approval/denied": ApprovalDeniedEvent;
};
