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
  FeatureCompletionRequestedEvent,
  ApprovalRequestedEvent,
  ApprovalGrantedEvent,
  ApprovalDeniedEvent,
  SessionStateUpdateEvent,
  SessionStateQueryEvent,
  SessionModeChangedEvent,
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
