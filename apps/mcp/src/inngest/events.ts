/**
 * Inngest event type definitions for Brain MCP server.
 *
 * All events are typed for compile-time safety.
 * Event names follow the pattern: "domain/action.verb"
 */

import type { WorkflowMode } from "../services/session";

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
    /** Session ID to update */
    sessionId: string;
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
  data: {
    /** Session ID to query */
    sessionId: string;
  };
};

/**
 * Session mode changed event.
 * Emitted when a session's workflow mode changes.
 * Downstream workflows can subscribe to react to mode transitions.
 */
export type SessionModeChangedEvent = {
  name: "session/mode.changed";
  data: {
    /** Session ID that changed modes */
    sessionId: string;
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

/**
 * Union of all Inngest events for type safety.
 * Add new event types here as they are defined.
 */
export type InngestEvents = {
  "feature/completion.requested": FeatureCompletionRequestedEvent;
  "approval/requested": ApprovalRequestedEvent;
  "approval/granted": ApprovalGrantedEvent;
  "approval/denied": ApprovalDeniedEvent;
  "session/state.update": SessionStateUpdateEvent;
  "session/state.query": SessionStateQueryEvent;
  "session/mode.changed": SessionModeChangedEvent;
};
