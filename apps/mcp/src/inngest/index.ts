/**
 * Inngest exports for Brain MCP server.
 */

export {
  inngest,
  checkInngestAvailability,
  isInngestAvailable,
  getInngestDevServerUrl,
} from "./client";
export type {
  InngestEvents,
  // Session Protocol Events (ADR-016)
  SessionProtocolStartEvent,
  SessionProtocolEndEvent,
  SessionStateUpdateEvent,
  SessionStateQueryEvent,
  SessionModeChangedEvent,
  // Orchestrator Events (ADR-016)
  OrchestratorAgentInvokedEvent,
  OrchestratorAgentCompletedEvent,
  AgentInvocationOutputData,
  // Feature Completion Events
  FeatureCompletionRequestedEvent,
  // Approval Events (HITL)
  ApprovalRequestedEvent,
  ApprovalGrantedEvent,
  ApprovalDeniedEvent,
} from "./events";
export { featureCompletionWorkflow } from "./workflows/featureCompletion";
export {
  hitlApprovalWorkflow,
  type HitlApprovalResult,
  type ApprovalStatus,
} from "./workflows/hitlApproval";
export {
  sessionStateWorkflow,
  sessionStateQueryWorkflow,
  getSessionState,
  hasSessionState,
  getActiveSessionIds,
  clearSessionState,
} from "./workflows/sessionState";
export {
  sessionProtocolEndWorkflow,
  validateSessionProtocolEnd,
  type SessionProtocolEndResult,
  type StepResult,
} from "./workflows/sessionProtocolEnd";
export {
  sessionProtocolStartWorkflow,
  getSessionProtocolContext,
  isProtocolStartComplete,
  type ProtocolStartEvidence,
  type SessionProtocolContext,
  type SessionProtocolStartResult,
} from "./workflows/sessionProtocolStart";
export {
  orchestratorAgentInvokedWorkflow,
  type AgentInvokedResult,
} from "./workflows/orchestratorAgentInvoked";
export {
  orchestratorAgentCompletedWorkflow,
  getCompactionHistory,
  getTotalInvocationCount,
  type AgentCompletedResult,
} from "./workflows/orchestratorAgentCompleted";
