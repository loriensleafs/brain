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
