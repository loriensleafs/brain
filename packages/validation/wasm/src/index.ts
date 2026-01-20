import * as fs from 'fs';
import * as path from 'path';

// Types matching Go validation package
export interface ValidationResult {
  valid: boolean;
  checks: Check[];
  message: string;
  remediation?: string;
}

export interface Check {
  name: string;
  passed: boolean;
  message: string;
}

export interface WorkflowState {
  mode: string;
  task?: string;
  sessionId?: string;
  updatedAt?: string;
}

export interface ScenarioResult {
  detected: boolean;
  scenario?: string;
  keywords?: string[];
  recommended?: string;
  directory?: string;
  noteType?: string;
}

export interface TaskStatus {
  name?: string;
  status?: string;
  completed?: boolean;
}

// Alias for backwards compatibility with existing code
export type Task = TaskStatus;

/**
 * Checklist validation result for a protocol section.
 */
export interface ChecklistValidation {
  totalMustItems: number;
  completedMustItems: number;
  totalShouldItems: number;
  completedShouldItems: number;
  missingMustItems?: string[];
  missingShouldItems?: string[];
}

/**
 * Session protocol validation result with protocol-specific fields.
 */
export interface SessionProtocolValidationResult extends ValidationResult {
  sessionLogPath?: string;
  brainInitialized: boolean;
  brainUpdated: boolean;
  startChecklist: ChecklistValidation;
  endChecklist: ChecklistValidation;
}

/**
 * Feature artifacts discovered for consistency validation.
 */
export interface FeatureArtifacts {
  epic?: string;
  prd?: string;
  tasks?: string;
  plan?: string;
}

/**
 * Scope alignment validation result.
 */
export interface ScopeAlignmentResult {
  passed: boolean;
  issues?: string[];
}

/**
 * Requirement coverage validation result.
 */
export interface RequirementCoverageResult {
  passed: boolean;
  issues?: string[];
  requirementCount: number;
  taskCount: number;
}

/**
 * Naming conventions validation result.
 */
export interface NamingConventionsResult {
  passed: boolean;
  issues?: string[];
}

/**
 * Cross-references validation result.
 */
export interface CrossReferencesResult {
  passed: boolean;
  issues?: string[];
  references?: string[];
}

/**
 * Task completion validation result.
 */
export interface TaskCompletionResult {
  passed: boolean;
  issues?: string[];
  total: number;
  completed: number;
  p0Incomplete?: string[];
  p1Incomplete?: string[];
}

/**
 * Consistency validation result with cross-document validation fields.
 */
export interface ConsistencyValidationResult extends ValidationResult {
  basePath?: string;
  feature?: string;
  checkpoint: number;
  artifacts: FeatureArtifacts;
  scopeAlignment: ScopeAlignmentResult;
  requirementCoverage: RequirementCoverageResult;
  namingConventions: NamingConventionsResult;
  crossReferences: CrossReferencesResult;
  taskCompletion: TaskCompletionResult;
}

/**
 * Artifact naming validation result.
 */
export interface ArtifactNamingResult {
  valid: boolean;
  filePath: string;
  patternType: string;
}

/**
 * Naming convention validation result.
 */
export interface NamingConventionResult {
  valid: boolean;
  filename: string;
  pattern: string;
}

// Go runtime interface from wasm_exec.js
interface GoRuntime {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

// Global interface augmentation for WASM functions
declare global {
  function brainValidateSession(
    workflowState: WorkflowState | null
  ): ValidationResult;

  function brainValidateWorkflow(state: WorkflowState): ValidationResult;

  function brainDetectScenario(prompt: string): ScenarioResult;

  function brainCheckTasks(tasks: TaskStatus[]): ValidationResult;

  function brainValidateSessionProtocol(
    content: string,
    sessionLogPath?: string
  ): SessionProtocolValidationResult;

  function brainValidateConsistency(
    epicContent: string,
    prdContent: string,
    tasksContent: string,
    planContent: string,
    feature: string,
    checkpoint: number
  ): ConsistencyValidationResult;

  function brainValidateNamingConvention(
    filename: string,
    pattern: string
  ): NamingConventionResult;

  function brainValidateArtifactNaming(filePath: string): ArtifactNamingResult;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var Go: new () => GoRuntime;
}

let wasmInstance: WebAssembly.Instance | null = null;
let goRuntime: GoRuntime | null = null;
let initialized = false;

/**
 * Initialize the WASM module. Must be called before using validation functions.
 * Safe to call multiple times - subsequent calls are no-ops.
 */
export async function initValidation(): Promise<void> {
  if (initialized) return;

  // Load wasm_exec.js shim (TinyGo version)
  const wasmExecPath = path.join(__dirname, 'wasm_exec.js');
  require(wasmExecPath);

  const go = new globalThis.Go();
  goRuntime = go;

  const wasmPath = path.join(__dirname, 'validation.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);
  const wasmModule = await WebAssembly.compile(wasmBuffer);
  wasmInstance = await WebAssembly.instantiate(wasmModule, go.importObject);

  // Run the Go program (registers global functions)
  go.run(wasmInstance);

  initialized = true;
}

/**
 * Check if the WASM module has been initialized.
 */
export function isInitialized(): boolean {
  return initialized;
}

/**
 * Ensure WASM is initialized before calling validation functions.
 */
function ensureInitialized(): void {
  if (!initialized) {
    throw new Error('WASM not initialized. Call initValidation() first.');
  }
}

/**
 * Validate session state for completeness before ending.
 * Checks workflow state persistence, recent activity, and task status.
 *
 * @param workflowState - Current workflow state or null
 * @returns ValidationResult with checks and recommendations
 */
export function validateSession(
  workflowState: WorkflowState | null
): ValidationResult {
  ensureInitialized();
  return globalThis.brainValidateSession(workflowState);
}

/**
 * Validate the current workflow state.
 * Checks that mode is valid (analysis/planning/coding) and task is set if in coding mode.
 *
 * @param state - Workflow state to validate
 * @returns ValidationResult with checks and recommendations
 */
export function validateWorkflow(state: WorkflowState): ValidationResult {
  ensureInitialized();
  return globalThis.brainValidateWorkflow(state);
}

/**
 * Detect the scenario type from a prompt based on keywords.
 * Returns the detected scenario with matched keywords and metadata.
 *
 * @param prompt - User prompt to analyze
 * @returns ScenarioResult with detected scenario and recommendations
 */
export function detectScenario(prompt: string): ScenarioResult {
  ensureInitialized();
  return globalThis.brainDetectScenario(prompt);
}

/**
 * Verify that no IN_PROGRESS tasks are incomplete.
 * Returns a validation result with a list of incomplete tasks if any.
 *
 * @param tasks - Array of task status objects
 * @returns ValidationResult with checks for each incomplete task
 */
export function checkTasks(tasks: TaskStatus[]): ValidationResult {
  ensureInitialized();
  return globalThis.brainCheckTasks(tasks);
}

/**
 * Validate session protocol compliance from session log content.
 * Performs comprehensive validation per SESSION-PROTOCOL.md requirements.
 *
 * Checks performed:
 * - Filename format (if path provided)
 * - Required sections present (Session Info, Protocol Compliance, Session Start, Session End)
 * - Session Start checklist MUST items completed
 * - Session End checklist MUST items completed
 * - Brain MCP initialization evidence
 * - Brain note update evidence
 * - Git branch documented
 * - Commit SHA evidence
 * - Markdown lint evidence
 *
 * @param content - Session log file content
 * @param sessionLogPath - Optional path for filename format validation
 * @returns SessionProtocolValidationResult with detailed check results
 */
export function validateSessionProtocol(
  content: string,
  sessionLogPath?: string
): SessionProtocolValidationResult {
  ensureInitialized();
  return globalThis.brainValidateSessionProtocol(content, sessionLogPath);
}

/**
 * Validate cross-document consistency for a feature.
 * Performs comprehensive validation of artifact relationships, naming conventions,
 * and requirement coverage.
 *
 * Checkpoint 1 (Pre-Critic) validates:
 * - Scope alignment between Epic and PRD
 * - Requirement coverage (PRD requirements have corresponding tasks)
 * - Naming conventions for all artifacts
 * - Cross-references point to existing files
 *
 * Checkpoint 2 (Post-Implementation) additionally validates:
 * - Task completion (all P0 tasks complete)
 *
 * @param epicContent - Epic document content (empty string if not available)
 * @param prdContent - PRD document content
 * @param tasksContent - Tasks document content
 * @param planContent - Plan document content (empty string if not available)
 * @param feature - Feature name being validated
 * @param checkpoint - Validation checkpoint (1 = Pre-Critic, 2 = Post-Implementation)
 * @returns ConsistencyValidationResult with detailed validation results
 */
export function validateConsistency(
  epicContent: string,
  prdContent: string,
  tasksContent: string,
  planContent: string,
  feature: string,
  checkpoint: number
): ConsistencyValidationResult {
  ensureInitialized();
  return globalThis.brainValidateConsistency(
    epicContent,
    prdContent,
    tasksContent,
    planContent,
    feature,
    checkpoint
  );
}

/**
 * Validate that a filename matches a specific naming convention pattern.
 *
 * Valid patterns:
 * - epic: EPIC-NNN-kebab-case.md
 * - adr: ADR-NNN-kebab-case.md
 * - prd: prd-kebab-case.md
 * - tasks: tasks-kebab-case.md
 * - plan: NNN-kebab-case-plan.md or plan-kebab-case.md
 * - tm: TM-NNN-kebab-case.md
 * - req: REQ-NNN-kebab-case.md
 * - design: DESIGN-NNN-kebab-case.md
 * - task: TASK-NNN-kebab-case.md
 * - skill: Skill-Category-NNN.md
 * - retro: YYYY-MM-DD-kebab-case.md
 * - session: YYYY-MM-DD-session-NN.md
 *
 * @param filename - Filename to validate
 * @param pattern - Pattern type to validate against
 * @returns NamingConventionResult with validation result
 */
export function validateNamingConvention(
  filename: string,
  pattern: string
): NamingConventionResult {
  ensureInitialized();
  return globalThis.brainValidateNamingConvention(filename, pattern);
}

/**
 * Validate that a file follows artifact naming conventions.
 * Auto-detects the artifact type based on filename and directory.
 *
 * @param filePath - Full path to the file
 * @returns ArtifactNamingResult with validation result and detected pattern type
 */
export function validateArtifactNaming(filePath: string): ArtifactNamingResult {
  ensureInitialized();
  return globalThis.brainValidateArtifactNaming(filePath);
}
