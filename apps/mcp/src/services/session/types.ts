/**
 * Session State Type Definitions
 *
 * TypeScript interfaces for extended session state with orchestrator workflow tracking.
 * Implements DESIGN-001 Component 1: Session State Schema.
 *
 * Key features:
 * - SessionState with orchestrator workflow tracking
 * - Optimistic locking via version field
 * - Zod schemas for runtime validation
 *
 * @see DESIGN-001: Session State Architecture with Brain Note Persistence
 */

import { z } from "zod";

// ============================================================================
// Agent Type Definition
// ============================================================================

/**
 * All agent types in the multi-agent system.
 *
 * 17 agent types as defined in AGENTS.md:
 * - orchestrator: Workflow coordinator
 * - analyst: Technical investigator
 * - architect: System designer
 * - planner: Implementation strategist
 * - implementer: Senior engineer
 * - critic: Plan validator
 * - qa: Test engineer
 * - security: Security engineer
 * - devops: Infrastructure specialist
 * - retrospective: Learning facilitator
 * - memory: Context manager
 * - skillbook: Knowledge curator
 * - independent-thinker: Contrarian analyst
 * - high-level-advisor: Strategic advisor
 * - explainer: Technical writer
 * - task-generator: Task decomposition specialist
 * - pr-comment-responder: PR review coordinator
 */
export type AgentType =
  | "orchestrator"
  | "analyst"
  | "architect"
  | "planner"
  | "implementer"
  | "critic"
  | "qa"
  | "security"
  | "devops"
  | "retrospective"
  | "memory"
  | "skillbook"
  | "independent-thinker"
  | "high-level-advisor"
  | "explainer"
  | "task-generator"
  | "pr-comment-responder";

/**
 * Zod schema for AgentType validation.
 */
export const AgentTypeSchema = z.enum([
  "orchestrator",
  "analyst",
  "architect",
  "planner",
  "implementer",
  "critic",
  "qa",
  "security",
  "devops",
  "retrospective",
  "memory",
  "skillbook",
  "independent-thinker",
  "high-level-advisor",
  "explainer",
  "task-generator",
  "pr-comment-responder",
]);

// ============================================================================
// Workflow Mode Definition
// ============================================================================

/**
 * Available workflow modes controlling tool access.
 *
 * - analysis: Read-only exploration. Blocks Edit, Write, Bash.
 * - planning: Design phase. Blocks Edit, Write. Allows read-only Bash.
 * - coding: Full access. All tools allowed.
 * - disabled: Mode enforcement disabled. All tools allowed.
 */
export type WorkflowMode = "analysis" | "planning" | "coding" | "disabled";

/**
 * Zod schema for WorkflowMode validation.
 */
export const WorkflowModeSchema = z.enum([
  "analysis",
  "planning",
  "coding",
  "disabled",
]);

// ============================================================================
// Workflow Phase Definition
// ============================================================================

/**
 * Orchestrator workflow phases.
 *
 * - planning: Requirements analysis and task breakdown
 * - implementation: Code writing and testing
 * - validation: QA and review
 * - complete: Workflow finished
 */
export type WorkflowPhase =
  | "planning"
  | "implementation"
  | "validation"
  | "complete";

/**
 * Zod schema for WorkflowPhase validation.
 */
export const WorkflowPhaseSchema = z.enum([
  "planning",
  "implementation",
  "validation",
  "complete",
]);

// ============================================================================
// Agent Invocation Status
// ============================================================================

/**
 * Status of an agent invocation.
 *
 * - in_progress: Agent currently executing
 * - completed: Agent finished successfully
 * - failed: Agent execution failed
 * - blocked: Agent blocked by dependency or error
 */
export type InvocationStatus =
  | "in_progress"
  | "completed"
  | "failed"
  | "blocked";

/**
 * Zod schema for InvocationStatus validation.
 */
export const InvocationStatusSchema = z.enum([
  "in_progress",
  "completed",
  "failed",
  "blocked",
]);

// ============================================================================
// Decision Type Definition
// ============================================================================

/**
 * Types of decisions recorded in workflow.
 *
 * - architectural: System design decisions (ADRs)
 * - technical: Implementation approach decisions
 * - process: Workflow or methodology decisions
 * - scope: Feature scope or requirements decisions
 */
export type DecisionType = "architectural" | "technical" | "process" | "scope";

/**
 * Zod schema for DecisionType validation.
 */
export const DecisionTypeSchema = z.enum([
  "architectural",
  "technical",
  "process",
  "scope",
]);

// ============================================================================
// Verdict Decision Definition
// ============================================================================

/**
 * Verdict outcomes from agent validation.
 *
 * - approve: Validation passed
 * - reject: Validation failed
 * - conditional: Approved with conditions
 * - needs_revision: Requires changes before approval
 */
export type VerdictDecision =
  | "approve"
  | "reject"
  | "conditional"
  | "needs_revision";

/**
 * Zod schema for VerdictDecision validation.
 */
export const VerdictDecisionSchema = z.enum([
  "approve",
  "reject",
  "conditional",
  "needs_revision",
]);

// ============================================================================
// Mode History Entry
// ============================================================================

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
 * Zod schema for ModeHistoryEntry validation.
 */
export const ModeHistoryEntrySchema = z.object({
  mode: WorkflowModeSchema,
  timestamp: z.string().datetime(),
});

// ============================================================================
// Agent Invocation Interface
// ============================================================================

/**
 * Input context provided to an agent invocation.
 */
export interface AgentInvocationInput {
  /** The prompt or instruction given to the agent */
  prompt: string;
  /** Additional context data passed to the agent */
  context: Record<string, unknown>;
  /** Artifact paths referenced in the invocation */
  artifacts: string[];
}

/**
 * Zod schema for AgentInvocationInput validation.
 */
export const AgentInvocationInputSchema = z.object({
  prompt: z.string(),
  context: z.record(z.unknown()),
  artifacts: z.array(z.string()),
});

/**
 * Output produced by an agent invocation.
 */
export interface AgentInvocationOutput {
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
 * Zod schema for AgentInvocationOutput validation.
 */
export const AgentInvocationOutputSchema = z.object({
  artifacts: z.array(z.string()),
  summary: z.string(),
  recommendations: z.array(z.string()),
  blockers: z.array(z.string()),
});

/**
 * Agent invocation metadata for routing tracking.
 *
 * Records the full lifecycle of an agent execution including
 * input, output, status, and handoff information.
 */
export interface AgentInvocation {
  /** Agent type that was invoked */
  agent: AgentType;
  /** ISO timestamp when invocation started */
  startedAt: string;
  /** ISO timestamp when invocation completed (null if in progress) */
  completedAt: string | null;
  /** Current status of the invocation */
  status: InvocationStatus;
  /** Input provided to the agent */
  input: AgentInvocationInput;
  /** Output from the agent (null if not yet complete) */
  output: AgentInvocationOutput | null;
  /** Agent that handed off to this agent (null if orchestrator-initiated) */
  handoffFrom: AgentType | null;
  /** Agent to hand off to after completion (null if returning to orchestrator) */
  handoffTo: AgentType | null;
  /** Reason for the handoff */
  handoffReason: string;
}

/**
 * Zod schema for AgentInvocation validation.
 */
export const AgentInvocationSchema = z.object({
  agent: AgentTypeSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  status: InvocationStatusSchema,
  input: AgentInvocationInputSchema,
  output: AgentInvocationOutputSchema.nullable(),
  handoffFrom: AgentTypeSchema.nullable(),
  handoffTo: AgentTypeSchema.nullable(),
  handoffReason: z.string(),
});

// ============================================================================
// Decision Interface
// ============================================================================

/**
 * Decision tracking for workflow decisions.
 *
 * Records decisions made during workflow execution including
 * rationale and approval/rejection status.
 */
export interface Decision {
  /** Unique identifier for the decision */
  id: string;
  /** Type of decision */
  type: DecisionType;
  /** Description of the decision */
  description: string;
  /** Rationale explaining why this decision was made */
  rationale: string;
  /** Agent that made the decision */
  decidedBy: AgentType;
  /** Agents that approved the decision */
  approvedBy: AgentType[];
  /** Agents that rejected the decision */
  rejectedBy: AgentType[];
  /** ISO timestamp when decision was made */
  timestamp: string;
}

/**
 * Zod schema for Decision validation.
 */
export const DecisionSchema = z.object({
  id: z.string().uuid(),
  type: DecisionTypeSchema,
  description: z.string(),
  rationale: z.string(),
  decidedBy: AgentTypeSchema,
  approvedBy: z.array(AgentTypeSchema),
  rejectedBy: z.array(AgentTypeSchema),
  timestamp: z.string().datetime(),
});

// ============================================================================
// Verdict Interface
// ============================================================================

/**
 * Verdict aggregation from agent validation.
 *
 * Records validation outcomes from agents with confidence
 * levels and any conditions or blockers.
 */
export interface Verdict {
  /** Agent that produced this verdict */
  agent: AgentType;
  /** Validation decision */
  decision: VerdictDecision;
  /** Confidence level (0.0 to 1.0) */
  confidence: number;
  /** Reasoning explaining the verdict */
  reasoning: string;
  /** Conditions that must be met (for conditional approval) */
  conditions?: string[];
  /** Blockers preventing approval (for rejection) */
  blockers?: string[];
  /** ISO timestamp when verdict was recorded */
  timestamp: string;
}

/**
 * Zod schema for Verdict validation.
 */
export const VerdictSchema = z.object({
  agent: AgentTypeSchema,
  decision: VerdictDecisionSchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  conditions: z.array(z.string()).optional(),
  blockers: z.array(z.string()).optional(),
  timestamp: z.string().datetime(),
});

// ============================================================================
// Handoff Interface
// ============================================================================

/**
 * Agent handoff metadata.
 *
 * Records the context and artifacts passed between agents
 * during workflow transitions.
 */
export interface Handoff {
  /** Agent handing off */
  fromAgent: AgentType;
  /** Agent receiving handoff */
  toAgent: AgentType;
  /** Reason for the handoff */
  reason: string;
  /** Context description for the receiving agent */
  context: string;
  /** Artifact paths being passed */
  artifacts: string[];
  /** Additional preserved context data */
  preservedContext?: Record<string, unknown>;
  /** ISO timestamp when handoff was created */
  createdAt: string;
}

/**
 * Zod schema for Handoff validation.
 */
export const HandoffSchema = z.object({
  fromAgent: AgentTypeSchema,
  toAgent: AgentTypeSchema,
  reason: z.string(),
  context: z.string(),
  artifacts: z.array(z.string()),
  preservedContext: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
});

// ============================================================================
// Compaction Entry Interface
// ============================================================================

/**
 * Compaction tracking entry.
 *
 * Records when agent history was compacted and archived
 * to prevent unbounded state growth.
 */
export interface CompactionEntry {
  /** Brain note path where history was archived */
  notePath: string;
  /** ISO timestamp when compaction occurred */
  compactedAt: string;
  /** Number of invocations compacted */
  count: number;
}

/**
 * Zod schema for CompactionEntry validation.
 */
export const CompactionEntrySchema = z.object({
  notePath: z.string(),
  compactedAt: z.string().datetime(),
  count: z.number().int().positive(),
});

// ============================================================================
// Orchestrator Workflow Interface
// ============================================================================

/**
 * Orchestrator workflow tracking state.
 *
 * Tracks the full state of an orchestrator-managed workflow including
 * active agent, phase, history, decisions, and verdicts.
 *
 * @example
 * ```typescript
 * const workflow: OrchestratorWorkflow = {
 *   activeAgent: "analyst",
 *   workflowPhase: "planning",
 *   agentHistory: [],
 *   decisions: [],
 *   verdicts: [],
 *   pendingHandoffs: [],
 *   compactionHistory: [],
 *   startedAt: "2026-01-18T10:00:00Z",
 *   lastAgentChange: "2026-01-18T10:00:00Z",
 * };
 * ```
 */
export interface OrchestratorWorkflow {
  /** Currently active agent (null if no agent active) */
  activeAgent: AgentType | null;
  /** Current workflow phase */
  workflowPhase: WorkflowPhase;
  /** History of agent invocations */
  agentHistory: AgentInvocation[];
  /** Decisions made during workflow */
  decisions: Decision[];
  /** Verdicts from agent validations */
  verdicts: Verdict[];
  /** Pending handoffs awaiting execution */
  pendingHandoffs: Handoff[];
  /** History of compaction operations */
  compactionHistory: CompactionEntry[];
  /** ISO timestamp when workflow started */
  startedAt: string;
  /** ISO timestamp of last agent change */
  lastAgentChange: string;
}

/**
 * Zod schema for OrchestratorWorkflow validation.
 */
export const OrchestratorWorkflowSchema = z.object({
  activeAgent: AgentTypeSchema.nullable(),
  workflowPhase: WorkflowPhaseSchema,
  agentHistory: z.array(AgentInvocationSchema),
  decisions: z.array(DecisionSchema),
  verdicts: z.array(VerdictSchema),
  pendingHandoffs: z.array(HandoffSchema),
  compactionHistory: z.array(CompactionEntrySchema),
  startedAt: z.string().datetime(),
  lastAgentChange: z.string().datetime(),
});

// ============================================================================
// Session State Interface
// ============================================================================

/**
 * Session state structure for persistent context.
 *
 * Contains critical information that must survive context compaction:
 * - Current workflow mode (analysis/planning/coding/disabled)
 * - History of mode transitions
 * - Protocol completion status
 * - Orchestrator workflow tracking
 * - Active feature and task
 * - Version for optimistic locking
 *
 * @example
 * ```typescript
 * const session: SessionState = {
 *   currentMode: "analysis",
 *   modeHistory: [{ mode: "analysis", timestamp: "2026-01-18T10:00:00Z" }],
 *   protocolStartComplete: true,
 *   protocolEndComplete: false,
 *   protocolStartEvidence: {
 *     brainMcpInitialized: "2026-01-18T10:00:00Z",
 *     handoffRead: "2026-01-18T10:00:05Z",
 *     sessionLogCreated: ".agents/sessions/2026-01-18-session-01.md",
 *   },
 *   protocolEndEvidence: {},
 *   orchestratorWorkflow: null,
 *   activeFeature: "ADR-016-session-enforcement",
 *   activeTask: "TASK-001",
 *   version: 1,
 *   createdAt: "2026-01-18T10:00:00Z",
 *   updatedAt: "2026-01-18T10:15:00Z",
 * };
 * ```
 */
export interface SessionState {
  /** Current workflow mode */
  currentMode: WorkflowMode;
  /** History of mode changes for context reconstruction */
  modeHistory: ModeHistoryEntry[];
  /** Whether session start protocol has been completed */
  protocolStartComplete: boolean;
  /** Whether session end protocol has been completed */
  protocolEndComplete: boolean;
  /** Evidence of session start protocol completion */
  protocolStartEvidence: Record<string, string>;
  /** Evidence of session end protocol completion */
  protocolEndEvidence: Record<string, string>;
  /** Orchestrator workflow tracking (null if no orchestrator active) */
  orchestratorWorkflow: OrchestratorWorkflow | null;
  /** Currently active feature (slug/path) */
  activeFeature?: string;
  /** Currently active task within the feature */
  activeTask?: string;
  /** Version number for optimistic locking */
  version: number;
  /** ISO timestamp when session was created */
  createdAt: string;
  /** ISO timestamp of last state update */
  updatedAt: string;
}

/**
 * Zod schema for SessionState validation.
 */
export const SessionStateSchema = z.object({
  currentMode: WorkflowModeSchema,
  modeHistory: z.array(ModeHistoryEntrySchema),
  protocolStartComplete: z.boolean(),
  protocolEndComplete: z.boolean(),
  protocolStartEvidence: z.record(z.string()),
  protocolEndEvidence: z.record(z.string()),
  orchestratorWorkflow: OrchestratorWorkflowSchema.nullable(),
  activeFeature: z.string().optional(),
  activeTask: z.string().optional(),
  version: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ============================================================================
// Factory Functions
// ============================================================================

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

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid AgentType.
 *
 * @param value - Value to check
 * @returns True if value is a valid AgentType
 */
export function isAgentType(value: unknown): value is AgentType {
  return AgentTypeSchema.safeParse(value).success;
}

/**
 * Type guard to check if a value is a valid WorkflowMode.
 *
 * @param value - Value to check
 * @returns True if value is a valid WorkflowMode
 */
export function isWorkflowMode(value: unknown): value is WorkflowMode {
  return WorkflowModeSchema.safeParse(value).success;
}

/**
 * Type guard to check if a value is a valid SessionState.
 *
 * @param value - Value to check
 * @returns True if value passes SessionState schema validation
 */
export function isSessionState(value: unknown): value is SessionState {
  return SessionStateSchema.safeParse(value).success;
}


// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate and parse a SessionState from unknown input.
 *
 * @param value - Value to validate
 * @returns Validated SessionState
 * @throws ZodError if validation fails
 */
export function parseSessionState(value: unknown): SessionState {
  return SessionStateSchema.parse(value) as SessionState;
}


/**
 * Safely validate a SessionState, returning null on failure.
 *
 * @param value - Value to validate
 * @returns Validated SessionState or null if invalid
 */
export function safeParseSessionState(value: unknown): SessionState | null {
  const result = SessionStateSchema.safeParse(value);
  return result.success ? (result.data as SessionState) : null;
}

