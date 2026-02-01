/**
 * Inngest exports for Brain MCP server.
 */

export {
	checkInngestAvailability,
	getInngestDevServerUrl,
	inngest,
	isInngestAvailable,
} from "./client";
export type {
	AgentInvocationOutputData,
	ApprovalDeniedEvent,
	ApprovalGrantedEvent,
	// Approval Events (HITL)
	ApprovalRequestedEvent,
	// Feature Completion Events
	FeatureCompletionRequestedEvent,
	InngestEvents,
	OrchestratorAgentCompletedEvent,
	// Orchestrator Events (ADR-016)
	OrchestratorAgentInvokedEvent,
	SessionModeChangedEvent,
	SessionProtocolEndEvent,
	// Session Protocol Events (ADR-016)
	SessionProtocolStartEvent,
	SessionStateQueryEvent,
	SessionStateUpdateEvent,
} from "./events";
export { featureCompletionWorkflow } from "./workflows/featureCompletion";
export {
	type ApprovalStatus,
	type HitlApprovalResult,
	hitlApprovalWorkflow,
} from "./workflows/hitlApproval";
export {
	type AgentCompletedResult,
	getCompactionHistory,
	getTotalInvocationCount,
	orchestratorAgentCompletedWorkflow,
} from "./workflows/orchestratorAgentCompleted";
export {
	type AgentInvokedResult,
	orchestratorAgentInvokedWorkflow,
} from "./workflows/orchestratorAgentInvoked";
export {
	type SessionProtocolEndResult,
	type StepResult,
	sessionProtocolEndWorkflow,
	validateSessionProtocolEnd,
} from "./workflows/sessionProtocolEnd";
export {
	getSessionProtocolContext,
	isProtocolStartComplete,
	type ProtocolStartEvidence,
	type SessionProtocolContext,
	type SessionProtocolStartResult,
	sessionProtocolStartWorkflow,
} from "./workflows/sessionProtocolStart";
export {
	clearSessionState,
	getActiveSessionIds,
	getSessionState,
	hasSessionState,
	sessionStateQueryWorkflow,
	sessionStateWorkflow,
} from "./workflows/sessionState";
