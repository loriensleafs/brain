/**
 * Shared types for brain-hooks TS port.
 *
 * Ported from apps/claude-plugin/cmd/hooks/ Go types.
 * These types match the Go struct JSON serialization exactly.
 */

// === Hook Protocol Types (Claude Code) ===

/** JSON input from Claude Code hooks via stdin. */
export interface HookInput {
  session_id?: string;
  cwd?: string;
}

/** Claude Code's expected hook output structure. */
export interface HookSpecificOutput {
  hookEventName: string;
  additionalContext: string;
}

/** Top-level Claude Code hook response. */
export interface HookOutput {
  hookSpecificOutput: HookSpecificOutput;
}

// === Session Start Types ===

/** Internal output structure for session start processing. */
export interface SessionStartOutput {
  success: boolean;
  project?: string;
  gitContext?: GitContextInfo;
  bootstrapInfo?: Record<string, unknown>;
  workflowState?: WorkflowStateInfo;
  openSessions?: OpenSession[];
  activeSession?: ActiveSession;
  error?: string;
}

/** Git repository context. */
export interface GitContextInfo {
  branch?: string;
  recentCommits?: string[];
  status?: string;
}

/** Workflow state information. */
export interface WorkflowStateInfo {
  mode?: string;
  description?: string;
  sessionId?: string;
  updatedAt?: string;
  task?: string;
}

/** Session with status IN_PROGRESS or PAUSED. */
export interface OpenSession {
  sessionId: string;
  status: string;
  date: string;
  branch?: string;
  topic?: string;
  permalink: string;
}

/** Currently active session (status: IN_PROGRESS). */
export interface ActiveSession {
  sessionId: string;
  status: string;
  path: string;
  mode?: string;
  task?: string;
  branch?: string;
  date: string;
  topic?: string;
  isValid: boolean;
  checks: SessionValidationCheck[];
}

/** Single validation check result. */
export interface SessionValidationCheck {
  name: string;
  passed: boolean;
}

/** Metadata about the bootstrap context. */
export interface BootstrapMetadata {
  project: string;
  generated_at: string;
  note_count: number;
  timeframe: string;
}

/** Structured JSON output from bootstrap_context. */
export interface BootstrapResponse {
  metadata: BootstrapMetadata;
  open_sessions: OpenSession[];
  active_session?: ActiveSession;
}

/** Bootstrap context result with both raw and parsed data. */
export interface BootstrapContextResult {
  markdown: string;
  openSessions: OpenSession[];
  activeSession?: ActiveSession;
  parsedJSON: boolean;
}

// === User Prompt Types ===

export interface UserPromptInput {
  prompt: string;
  sessionId?: string;
}

export interface UserPromptOutput {
  continue: boolean;
  message?: string;
  scenario?: ScenarioDetectionResult;
  workflowState?: WorkflowStateInfo;
}

export interface ScenarioDetectionResult {
  detected: boolean;
  scenario?: string;
  triggers?: string[];
  recommended?: string;
  directory?: string;
  noteType?: string;
}

// === Pre-Tool-Use Types ===

export interface PreToolUseInput {
  tool: string;
  input?: Record<string, unknown>;
  sessionId?: string;
}

export interface PreToolUseOutput {
  decision: "allow" | "block" | "ask";
  message?: string;
  mode?: string;
}

// === Stop Types ===

export interface StopOutput {
  continue: boolean;
  message?: string;
  checks?: Check[];
  remediation?: string;
}

export interface Check {
  name: string;
  passed: boolean;
  message?: string;
}

// === Gate Check Types ===

/** Session state from Brain CLI. */
export interface BrainSessionState {
  sessionId: string;
  currentMode: string;
  modeHistory?: ModeHistoryEntry[];
  protocolStartComplete?: boolean;
  protocolEndComplete?: boolean;
  protocolStartEvidence?: Record<string, string>;
  protocolEndEvidence?: Record<string, string>;
  activeFeature?: string;
  activeTask?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ModeHistoryEntry {
  mode: string;
  timestamp: string;
}

export interface GateCheckResult {
  allowed: boolean;
  mode: string;
  tool: string;
  message?: string;
}

// === Detect Scenario Types ===

export interface DetectScenarioInput {
  prompt: string;
}

export interface DetectScenarioOutput {
  detected: boolean;
  scenario?: string;
  triggers?: string[];
  recommended?: string;
  directory?: string;
  noteType?: string;
}

// === Load Skills Types ===

export interface LoadSkillsInput {
  skills?: string[];
  scenario?: string;
  skillsDir?: string;
}

export interface LoadSkillsOutput {
  success: boolean;
  content?: string;
  skills?: SkillInfo[];
  skillsDir?: string;
  error?: string;
  filesLoaded?: string[];
}

export interface SkillInfo {
  name: string;
  path: string;
  content?: string;
}

// === Analyze Types ===

export interface AnalyzeInput {
  stepNumber: number;
  totalSteps: number;
  thoughts?: string;
  stateFile?: string;
}

export interface AnalyzeOutput {
  phase: string;
  stepTitle: string;
  status: string;
  actions: string[];
  next?: string;
  stateFile?: string;
  stateSummary?: string;
}

export interface AnalyzeState {
  stepNumber: number;
  totalSteps: number;
  phase: string;
  startedAt: string;
  updatedAt: string;
  focusAreas?: FocusArea[];
  investigations?: Investigation[];
  findings?: Finding[];
  patterns?: string[];
  openQuestions?: string[];
  explorationSummary?: string;
  rawThoughts?: string;
}

export interface FocusArea {
  name: string;
  priority: string;
  reason: string;
}

export interface Investigation {
  focusArea: string;
  files: string[];
  questions: string[];
  hypotheses: string[];
  status: string;
}

export interface Finding {
  severity: string;
  description: string;
  file?: string;
  line?: number;
  code?: string;
  impact?: string;
  fix?: string;
}

// === Validate Session Types ===

export interface ValidateSessionInput {
  sessionLogPath?: string;
}

export interface ValidateSessionOutput {
  valid: boolean;
  checks: Check[];
  message: string;
  remediation?: string;
}

// === Validation Package Types (ported from packages/validation) ===

/** Workflow state for validation functions. */
export interface WorkflowState {
  mode: string;
  task?: string;
  sessionId?: string;
  updatedAt?: string;
}

/** Result from validation functions. */
export interface ValidationResult {
  valid: boolean;
  checks: Check[];
  message: string;
  remediation?: string;
}

/** Scenario result from DetectScenario. */
export interface ScenarioResult {
  detected: boolean;
  scenario: string;
  keywords: string[];
  recommended: string;
  directory: string;
  noteType: string;
}

/** Scenario configuration. */
export interface ScenarioConfig {
  keywords: string[];
  recommended: string;
  directory: string;
  noteType: string;
}

// === Brain Config Types (for project resolution) ===

export interface BrainProjectConfig {
  code_path: string;
  memories_path?: string;
  memories_mode?: string;
  disableWorktreeDetection?: boolean;
}

export interface BrainConfig {
  version: string;
  projects: Record<string, BrainProjectConfig>;
}

// === Worktree Detection Types ===

/** Result from detectWorktreeMainPath. */
export interface WorktreeDetectionResult {
  mainWorktreePath: string;
  isLinkedWorktree: boolean;
}

/** Extended result from matchCwdToProject with worktree context. */
export interface CwdMatchResult {
  projectName: string;
  effectiveCwd: string;
  isWorktreeResolved: boolean;
}
