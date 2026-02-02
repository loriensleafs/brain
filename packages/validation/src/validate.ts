/**
 * AJV Validators for JSON Schema validation
 *
 * Provides pre-compiled validators for all JSON Schema definitions.
 * Import validators to validate data at runtime with type safety.
 *
 * Usage:
 *   import { validateSearchArgs, parseSearchArgs } from '@brain/validation';
 *
 *   if (validateSearchArgs(data)) {
 *     // data is typed as SearchArgs
 *   }
 *
 *   // Or use parse function that throws on invalid data
 *   const args = parseSearchArgs(data);
 */
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import type {
  ActiveProjectArgs,
  AgentInvocation,
  AgentInvocationInput,
  AgentInvocationOutput,
  AgentType,
  BootstrapContextArgs,
  BrainConfig,
  CompactionEntry,
  ConfigGetArgs,
  ConfigResetArgs,
  ConfigSetArgs,
  CreateProjectArgs,
  Decision,
  DecisionType,
  DefaultsConfig,
  DeleteProjectArgs,
  EditProjectArgs,
  GetProjectDetailsArgs,
  GetWorkflowArgs,
  Handoff,
  InvocationStatus,
  ListFeaturesByPriorityArgs,
  ListProjectsArgs,
  ListWorkflowsArgs,
  LoggingConfig,
  ModeHistoryEntry,
  OrchestratorWorkflow,
  ProjectConfig,
  SearchArgs,
  SendWorkflowEventArgs,
  SessionArgs,
  SessionState,
  SyncConfig,
  Verdict,
  VerdictDecision,
  WatcherConfig,
  WorkflowMode,
  WorkflowPhase,
} from "../generated/types";
import brainConfigSchema from "../schemas/config/brain-config.schema.json";
import sessionStateSchema from "../schemas/session/session-state.schema.json";
import bootstrapContextSchema from "../schemas/tools/bootstrap-context.schema.json";
import configGetSchema from "../schemas/tools/config/get.schema.json";
import configResetSchema from "../schemas/tools/config/reset.schema.json";
import configSetSchema from "../schemas/tools/config/set.schema.json";
import getWorkflowSchema from "../schemas/tools/get-workflow.schema.json";
import listFeaturesByPrioritySchema from "../schemas/tools/list-features-by-priority.schema.json";
import listWorkflowsSchema from "../schemas/tools/list-workflows.schema.json";
import activeProjectSchema from "../schemas/tools/projects/active-project.schema.json";
import createProjectSchema from "../schemas/tools/projects/create-project.schema.json";
import deleteProjectSchema from "../schemas/tools/projects/delete-project.schema.json";
import editProjectSchema from "../schemas/tools/projects/edit-project.schema.json";
import getProjectDetailsSchema from "../schemas/tools/projects/get-project-details.schema.json";
import listProjectsSchema from "../schemas/tools/projects/list-projects.schema.json";
import searchSchema from "../schemas/tools/search.schema.json";
import sendWorkflowEventSchema from "../schemas/tools/send-workflow-event.schema.json";
import sessionSchema from "../schemas/tools/session.schema.json";

// Export generated types
export type {
  ActiveProjectArgs,
  AgentInvocation,
  AgentInvocationInput,
  AgentInvocationOutput,
  AgentType,
  BootstrapContextArgs,
  BrainConfig,
  CompactionEntry,
  ConfigGetArgs,
  ConfigResetArgs,
  ConfigSetArgs,
  CreateProjectArgs,
  Decision,
  DecisionType,
  DefaultsConfig,
  DeleteProjectArgs,
  EditProjectArgs,
  GetProjectDetailsArgs,
  GetWorkflowArgs,
  Handoff,
  InvocationStatus,
  ListFeaturesByPriorityArgs,
  ListProjectsArgs,
  ListWorkflowsArgs,
  LoggingConfig,
  ModeHistoryEntry,
  OrchestratorWorkflow,
  ProjectConfig,
  SearchArgs,
  SendWorkflowEventArgs,
  SessionArgs,
  SessionState,
  SyncConfig,
  Verdict,
  VerdictDecision,
  WatcherConfig,
  WorkflowMode,
  WorkflowPhase,
};

/**
 * Structured validation error for safe error reporting.
 * Does not expose raw input values in production.
 */
export interface ValidationError {
  field: string;
  constraint: string;
  message: string;
}

/**
 * AJV instance with secure configuration.
 * - allErrors: Report all errors, not just first
 * - useDefaults: Apply schema defaults
 * - coerceTypes: false - SECURITY: No type coercion
 * - strict: true - Strict mode for better error detection
 */
const ajv = new Ajv({
  allErrors: true,
  useDefaults: true,
  coerceTypes: false,
  strict: true,
});

// Add format validators (uri, email, date-time, etc.)
addFormats(ajv);

/**
 * Convert AJV errors to structured ValidationError format.
 * Sanitizes errors to avoid exposing raw input values.
 */
function toValidationErrors(errors: ErrorObject[] | null | undefined): ValidationError[] {
  if (!errors) return [];

  return errors.map((error) => ({
    field: error.instancePath || error.schemaPath,
    constraint: error.keyword,
    message: error.message || "Validation failed",
  }));
}

/**
 * Create a validation error message from AJV errors.
 */
function formatValidationError(errors: ErrorObject[] | null | undefined): string {
  const validationErrors = toValidationErrors(errors);
  if (validationErrors.length === 0) {
    return "Validation failed";
  }

  return validationErrors
    .map((e) => `${e.field || "root"}: ${e.message} (${e.constraint})`)
    .join("; ");
}

// Compile validators
const _validateActiveProjectArgs = ajv.compile<ActiveProjectArgs>(activeProjectSchema);
const _validateBootstrapContextArgs = ajv.compile<BootstrapContextArgs>(bootstrapContextSchema);
const _validateBrainConfig = ajv.compile<BrainConfig>(brainConfigSchema);
const _validateConfigGetArgs = ajv.compile<ConfigGetArgs>(configGetSchema);
const _validateConfigResetArgs = ajv.compile<ConfigResetArgs>(configResetSchema);
const _validateConfigSetArgs = ajv.compile<ConfigSetArgs>(configSetSchema);
const _validateCreateProjectArgs = ajv.compile<CreateProjectArgs>(createProjectSchema);
const _validateDeleteProjectArgs = ajv.compile<DeleteProjectArgs>(deleteProjectSchema);
const _validateEditProjectArgs = ajv.compile<EditProjectArgs>(editProjectSchema);
const _validateGetProjectDetailsArgs = ajv.compile<GetProjectDetailsArgs>(getProjectDetailsSchema);
const _validateGetWorkflowArgs = ajv.compile<GetWorkflowArgs>(getWorkflowSchema);
const _validateListFeaturesByPriorityArgs = ajv.compile<ListFeaturesByPriorityArgs>(
  listFeaturesByPrioritySchema,
);
const _validateListProjectsArgs = ajv.compile<ListProjectsArgs>(listProjectsSchema);
const _validateListWorkflowsArgs = ajv.compile<ListWorkflowsArgs>(listWorkflowsSchema);
const _validateSearchArgs = ajv.compile<SearchArgs>(searchSchema);
const _validateSendWorkflowEventArgs = ajv.compile<SendWorkflowEventArgs>(sendWorkflowEventSchema);
const _validateSessionArgs = ajv.compile<SessionArgs>(sessionSchema);
const _validateSessionState = ajv.compile<SessionState>(sessionStateSchema);

/**
 * Validate ActiveProjectArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateActiveProjectArgs.errors after validation.
 */
export const validateActiveProjectArgs: ValidateFunction<ActiveProjectArgs> =
  _validateActiveProjectArgs;

/**
 * Validate BootstrapContextArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateBootstrapContextArgs.errors after validation.
 */
export const validateBootstrapContextArgs: ValidateFunction<BootstrapContextArgs> =
  _validateBootstrapContextArgs;

/**
 * Validate BrainConfig.
 * Returns true if valid, false otherwise.
 * Access errors via validateBrainConfig.errors after validation.
 */
export const validateBrainConfig: ValidateFunction<BrainConfig> = _validateBrainConfig;

/**
 * Validate ConfigGetArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateConfigGetArgs.errors after validation.
 */
export const validateConfigGetArgs: ValidateFunction<ConfigGetArgs> = _validateConfigGetArgs;

/**
 * Validate ConfigResetArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateConfigResetArgs.errors after validation.
 */
export const validateConfigResetArgs: ValidateFunction<ConfigResetArgs> = _validateConfigResetArgs;

/**
 * Validate ConfigSetArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateConfigSetArgs.errors after validation.
 */
export const validateConfigSetArgs: ValidateFunction<ConfigSetArgs> = _validateConfigSetArgs;

/**
 * Validate CreateProjectArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateCreateProjectArgs.errors after validation.
 */
export const validateCreateProjectArgs: ValidateFunction<CreateProjectArgs> =
  _validateCreateProjectArgs;

/**
 * Validate DeleteProjectArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateDeleteProjectArgs.errors after validation.
 */
export const validateDeleteProjectArgs: ValidateFunction<DeleteProjectArgs> =
  _validateDeleteProjectArgs;

/**
 * Validate EditProjectArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateEditProjectArgs.errors after validation.
 */
export const validateEditProjectArgs: ValidateFunction<EditProjectArgs> = _validateEditProjectArgs;

/**
 * Validate GetProjectDetailsArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateGetProjectDetailsArgs.errors after validation.
 */
export const validateGetProjectDetailsArgs: ValidateFunction<GetProjectDetailsArgs> =
  _validateGetProjectDetailsArgs;

/**
 * Validate GetWorkflowArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateGetWorkflowArgs.errors after validation.
 */
export const validateGetWorkflowArgs: ValidateFunction<GetWorkflowArgs> = _validateGetWorkflowArgs;

/**
 * Validate ListFeaturesByPriorityArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateListFeaturesByPriorityArgs.errors after validation.
 */
export const validateListFeaturesByPriorityArgs: ValidateFunction<ListFeaturesByPriorityArgs> =
  _validateListFeaturesByPriorityArgs;

/**
 * Validate ListProjectsArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateListProjectsArgs.errors after validation.
 */
export const validateListProjectsArgs: ValidateFunction<ListProjectsArgs> =
  _validateListProjectsArgs;

/**
 * Validate ListWorkflowsArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateListWorkflowsArgs.errors after validation.
 */
export const validateListWorkflowsArgs: ValidateFunction<ListWorkflowsArgs> =
  _validateListWorkflowsArgs;

/**
 * Validate SearchArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateSearchArgs.errors after validation.
 */
export const validateSearchArgs: ValidateFunction<SearchArgs> = _validateSearchArgs;

/**
 * Validate SendWorkflowEventArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateSendWorkflowEventArgs.errors after validation.
 */
export const validateSendWorkflowEventArgs: ValidateFunction<SendWorkflowEventArgs> =
  _validateSendWorkflowEventArgs;

/**
 * Validate SessionArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateSessionArgs.errors after validation.
 */
export const validateSessionArgs: ValidateFunction<SessionArgs> = _validateSessionArgs;

/**
 * Validate SessionState.
 * Returns true if valid, false otherwise.
 * Access errors via validateSessionState.errors after validation.
 */
export const validateSessionState: ValidateFunction<SessionState> = _validateSessionState;

/**
 * Parse and validate ActiveProjectArgs.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseActiveProjectArgs(data: unknown): ActiveProjectArgs {
  // Clone data to avoid mutating input when applying defaults
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;

  if (_validateActiveProjectArgs(cloned)) {
    return cloned;
  }

  throw new Error(formatValidationError(_validateActiveProjectArgs.errors));
}

/**
 * Parse and validate BootstrapContextArgs.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseBootstrapContextArgs(data: unknown): BootstrapContextArgs {
  // Clone data to avoid mutating input when applying defaults
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;

  if (_validateBootstrapContextArgs(cloned)) {
    return cloned;
  }

  throw new Error(formatValidationError(_validateBootstrapContextArgs.errors));
}

/**
 * Parse and validate BrainConfig.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseBrainConfig(data: unknown): BrainConfig {
  // Deep clone data to avoid mutating input when applying defaults
  const cloned =
    typeof data === "object" && data !== null ? JSON.parse(JSON.stringify(data)) : data;

  if (_validateBrainConfig(cloned)) {
    return cloned;
  }

  throw new Error(formatValidationError(_validateBrainConfig.errors));
}

/**
 * Parse and validate ConfigGetArgs.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseConfigGetArgs(data: unknown): ConfigGetArgs {
  // Clone data to avoid mutating input when applying defaults
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;

  if (_validateConfigGetArgs(cloned)) {
    return cloned;
  }

  throw new Error(formatValidationError(_validateConfigGetArgs.errors));
}

/**
 * Parse and validate ConfigResetArgs.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseConfigResetArgs(data: unknown): ConfigResetArgs {
  // Clone data to avoid mutating input when applying defaults
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;

  if (_validateConfigResetArgs(cloned)) {
    return cloned;
  }

  throw new Error(formatValidationError(_validateConfigResetArgs.errors));
}

/**
 * Parse and validate ConfigSetArgs.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseConfigSetArgs(data: unknown): ConfigSetArgs {
  // Clone data to avoid mutating input when applying defaults
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;

  if (_validateConfigSetArgs(cloned)) {
    return cloned;
  }

  throw new Error(formatValidationError(_validateConfigSetArgs.errors));
}

/**
 * Parse and validate CreateProjectArgs.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseCreateProjectArgs(data: unknown): CreateProjectArgs {
  // Clone data to avoid mutating input when applying defaults
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;

  if (_validateCreateProjectArgs(cloned)) {
    return cloned;
  }

  throw new Error(formatValidationError(_validateCreateProjectArgs.errors));
}

/**
 * Parse and validate DeleteProjectArgs.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseDeleteProjectArgs(data: unknown): DeleteProjectArgs {
  // Clone data to avoid mutating input when applying defaults
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;

  if (_validateDeleteProjectArgs(cloned)) {
    return cloned;
  }

  throw new Error(formatValidationError(_validateDeleteProjectArgs.errors));
}

/**
 * Parse and validate EditProjectArgs.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseEditProjectArgs(data: unknown): EditProjectArgs {
  // Clone data to avoid mutating input when applying defaults
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;

  if (_validateEditProjectArgs(cloned)) {
    return cloned;
  }

  throw new Error(formatValidationError(_validateEditProjectArgs.errors));
}

/**
 * Parse and validate GetProjectDetailsArgs.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseGetProjectDetailsArgs(data: unknown): GetProjectDetailsArgs {
  // Clone data to avoid mutating input when applying defaults
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;

  if (_validateGetProjectDetailsArgs(cloned)) {
    return cloned;
  }

  throw new Error(formatValidationError(_validateGetProjectDetailsArgs.errors));
}

/**
 * Parse and validate GetWorkflowArgs.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseGetWorkflowArgs(data: unknown): GetWorkflowArgs {
  // Clone data to avoid mutating input when applying defaults
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;

  if (_validateGetWorkflowArgs(cloned)) {
    return cloned;
  }

  throw new Error(formatValidationError(_validateGetWorkflowArgs.errors));
}

/**
 * Parse and validate ListFeaturesByPriorityArgs.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseListFeaturesByPriorityArgs(data: unknown): ListFeaturesByPriorityArgs {
  // Clone data to avoid mutating input when applying defaults
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;

  if (_validateListFeaturesByPriorityArgs(cloned)) {
    return cloned;
  }

  throw new Error(formatValidationError(_validateListFeaturesByPriorityArgs.errors));
}

/**
 * Parse and validate ListProjectsArgs.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseListProjectsArgs(data: unknown): ListProjectsArgs {
  // Clone data to avoid mutating input when applying defaults
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;

  if (_validateListProjectsArgs(cloned)) {
    return cloned;
  }

  throw new Error(formatValidationError(_validateListProjectsArgs.errors));
}

/**
 * Parse and validate ListWorkflowsArgs.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseListWorkflowsArgs(data: unknown): ListWorkflowsArgs {
  // Clone data to avoid mutating input when applying defaults
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;

  if (_validateListWorkflowsArgs(cloned)) {
    return cloned;
  }

  throw new Error(formatValidationError(_validateListWorkflowsArgs.errors));
}

/**
 * Parse and validate SearchArgs.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseSearchArgs(data: unknown): SearchArgs {
  // Clone data to avoid mutating input when applying defaults
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;

  if (_validateSearchArgs(cloned)) {
    return cloned;
  }

  throw new Error(formatValidationError(_validateSearchArgs.errors));
}

/**
 * Parse and validate SendWorkflowEventArgs.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseSendWorkflowEventArgs(data: unknown): SendWorkflowEventArgs {
  // Clone data to avoid mutating input when applying defaults
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;

  if (_validateSendWorkflowEventArgs(cloned)) {
    return cloned;
  }

  throw new Error(formatValidationError(_validateSendWorkflowEventArgs.errors));
}

/**
 * Parse and validate SessionArgs.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseSessionArgs(data: unknown): SessionArgs {
  // Clone data to avoid mutating input when applying defaults
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;

  if (_validateSessionArgs(cloned)) {
    return cloned;
  }

  throw new Error(formatValidationError(_validateSessionArgs.errors));
}

/**
 * Parse and validate SessionState.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseSessionState(data: unknown): SessionState {
  // Deep clone data to avoid mutating input when applying defaults
  const cloned =
    typeof data === "object" && data !== null ? JSON.parse(JSON.stringify(data)) : data;

  if (_validateSessionState(cloned)) {
    return cloned;
  }

  throw new Error(formatValidationError(_validateSessionState.errors));
}

/**
 * Safely validate a SessionState, returning null on failure.
 *
 * @param value - Value to validate
 * @returns Validated SessionState or null if invalid
 */
export function safeParseSessionState(value: unknown): SessionState | null {
  const cloned =
    typeof value === "object" && value !== null ? JSON.parse(JSON.stringify(value)) : value;
  if (_validateSessionState(cloned)) {
    return cloned;
  }
  return null;
}

/**
 * Get validation errors for ActiveProjectArgs without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getActiveProjectArgsErrors(data: unknown): ValidationError[] {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  _validateActiveProjectArgs(cloned);
  return toValidationErrors(_validateActiveProjectArgs.errors);
}

/**
 * Get validation errors for BootstrapContextArgs without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getBootstrapContextArgsErrors(data: unknown): ValidationError[] {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  _validateBootstrapContextArgs(cloned);
  return toValidationErrors(_validateBootstrapContextArgs.errors);
}

/**
 * Get validation errors for BrainConfig without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getBrainConfigErrors(data: unknown): ValidationError[] {
  const cloned =
    typeof data === "object" && data !== null ? JSON.parse(JSON.stringify(data)) : data;
  _validateBrainConfig(cloned);
  return toValidationErrors(_validateBrainConfig.errors);
}

/**
 * Get validation errors for ConfigGetArgs without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getConfigGetArgsErrors(data: unknown): ValidationError[] {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  _validateConfigGetArgs(cloned);
  return toValidationErrors(_validateConfigGetArgs.errors);
}

/**
 * Get validation errors for ConfigResetArgs without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getConfigResetArgsErrors(data: unknown): ValidationError[] {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  _validateConfigResetArgs(cloned);
  return toValidationErrors(_validateConfigResetArgs.errors);
}

/**
 * Get validation errors for ConfigSetArgs without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getConfigSetArgsErrors(data: unknown): ValidationError[] {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  _validateConfigSetArgs(cloned);
  return toValidationErrors(_validateConfigSetArgs.errors);
}

/**
 * Get validation errors for CreateProjectArgs without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getCreateProjectArgsErrors(data: unknown): ValidationError[] {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  _validateCreateProjectArgs(cloned);
  return toValidationErrors(_validateCreateProjectArgs.errors);
}

/**
 * Get validation errors for DeleteProjectArgs without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getDeleteProjectArgsErrors(data: unknown): ValidationError[] {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  _validateDeleteProjectArgs(cloned);
  return toValidationErrors(_validateDeleteProjectArgs.errors);
}

/**
 * Get validation errors for EditProjectArgs without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getEditProjectArgsErrors(data: unknown): ValidationError[] {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  _validateEditProjectArgs(cloned);
  return toValidationErrors(_validateEditProjectArgs.errors);
}

/**
 * Get validation errors for GetProjectDetailsArgs without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getGetProjectDetailsArgsErrors(data: unknown): ValidationError[] {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  _validateGetProjectDetailsArgs(cloned);
  return toValidationErrors(_validateGetProjectDetailsArgs.errors);
}

/**
 * Get validation errors for GetWorkflowArgs without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getGetWorkflowArgsErrors(data: unknown): ValidationError[] {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  _validateGetWorkflowArgs(cloned);
  return toValidationErrors(_validateGetWorkflowArgs.errors);
}

/**
 * Get validation errors for ListFeaturesByPriorityArgs without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getListFeaturesByPriorityArgsErrors(data: unknown): ValidationError[] {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  _validateListFeaturesByPriorityArgs(cloned);
  return toValidationErrors(_validateListFeaturesByPriorityArgs.errors);
}

/**
 * Get validation errors for ListProjectsArgs without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getListProjectsArgsErrors(data: unknown): ValidationError[] {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  _validateListProjectsArgs(cloned);
  return toValidationErrors(_validateListProjectsArgs.errors);
}

/**
 * Get validation errors for ListWorkflowsArgs without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getListWorkflowsArgsErrors(data: unknown): ValidationError[] {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  _validateListWorkflowsArgs(cloned);
  return toValidationErrors(_validateListWorkflowsArgs.errors);
}

/**
 * Get validation errors for SearchArgs without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getSearchArgsErrors(data: unknown): ValidationError[] {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  _validateSearchArgs(cloned);
  return toValidationErrors(_validateSearchArgs.errors);
}

/**
 * Get validation errors for SendWorkflowEventArgs without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getSendWorkflowEventArgsErrors(data: unknown): ValidationError[] {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  _validateSendWorkflowEventArgs(cloned);
  return toValidationErrors(_validateSendWorkflowEventArgs.errors);
}

/**
 * Get validation errors for SessionArgs without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getSessionArgsErrors(data: unknown): ValidationError[] {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  _validateSessionArgs(cloned);
  return toValidationErrors(_validateSessionArgs.errors);
}

/**
 * Get validation errors for SessionState without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getSessionStateErrors(data: unknown): ValidationError[] {
  const cloned =
    typeof data === "object" && data !== null ? JSON.parse(JSON.stringify(data)) : data;
  _validateSessionState(cloned);
  return toValidationErrors(_validateSessionState.errors);
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Valid agent type values for runtime checking.
 */
const AGENT_TYPES = new Set([
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

/**
 * Valid workflow mode values for runtime checking.
 */
const WORKFLOW_MODES = new Set(["analysis", "planning", "coding", "disabled"]);

/**
 * Type guard to check if a value is a valid AgentType.
 *
 * @param value - Value to check
 * @returns True if value is a valid AgentType
 */
export function isAgentType(value: unknown): value is AgentType {
  return typeof value === "string" && AGENT_TYPES.has(value);
}

/**
 * Type guard to check if a value is a valid WorkflowMode.
 *
 * @param value - Value to check
 * @returns True if value is a valid WorkflowMode
 */
export function isWorkflowMode(value: unknown): value is WorkflowMode {
  return typeof value === "string" && WORKFLOW_MODES.has(value);
}

/**
 * Type guard to check if a value is a valid SessionState.
 *
 * @param value - Value to check
 * @returns True if value passes SessionState schema validation
 */
export function isSessionState(value: unknown): value is SessionState {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const cloned = JSON.parse(JSON.stringify(value));
  return _validateSessionState(cloned);
}
