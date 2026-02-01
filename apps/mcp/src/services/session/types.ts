/**
 * Session State Type Definitions
 *
 * TypeScript interfaces for extended session state with orchestrator workflow tracking.
 * Implements DESIGN-001 Component 1: Session State Schema.
 *
 * Key features:
 * - SessionState with orchestrator workflow tracking
 * - Optimistic locking via version field
 * - AJV-based runtime validation via @brain/validation
 *
 * @see DESIGN-001: Session State Architecture with Brain Note Persistence
 */

// Re-export all types and validators from @brain/validation
export {
  // Types
  type AgentType,
  type WorkflowMode,
  type WorkflowPhase,
  type InvocationStatus,
  type DecisionType,
  type VerdictDecision,
  type ModeHistoryEntry,
  type AgentInvocationInput,
  type AgentInvocationOutput,
  type AgentInvocation,
  type Decision,
  type Verdict,
  type Handoff,
  type CompactionEntry,
  type OrchestratorWorkflow,
  type SessionState,
  // Validators
  validateSessionState,
  parseSessionState,
  safeParseSessionState,
  getSessionStateErrors,
  // Type guards
  isAgentType,
  isWorkflowMode,
  isSessionState,
} from "@brain/validation";

// ============================================================================
// Factory Functions
// ============================================================================

import type {
  OrchestratorWorkflow,
  SessionState,
} from "@brain/validation";

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
