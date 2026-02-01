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
import Ajv, { type ValidateFunction, type ErrorObject } from "ajv";
import addFormats from "ajv-formats";

import bootstrapContextSchema from "../schemas/tools/bootstrap-context.schema.json";
import configGetSchema from "../schemas/tools/config/get.schema.json";
import configResetSchema from "../schemas/tools/config/reset.schema.json";
import configSetSchema from "../schemas/tools/config/set.schema.json";
import getWorkflowSchema from "../schemas/tools/get-workflow.schema.json";
import listWorkflowsSchema from "../schemas/tools/list-workflows.schema.json";
import activeProjectSchema from "../schemas/tools/projects/active-project.schema.json";
import deleteProjectSchema from "../schemas/tools/projects/delete-project.schema.json";
import listProjectsSchema from "../schemas/tools/projects/list-projects.schema.json";
import searchSchema from "../schemas/tools/search.schema.json";
import sendWorkflowEventSchema from "../schemas/tools/send-workflow-event.schema.json";
import sessionSchema from "../schemas/tools/session.schema.json";

import type {
  ActiveProjectArgs,
  BootstrapContextArgs,
  ConfigGetArgs,
  ConfigResetArgs,
  ConfigSetArgs,
  DeleteProjectArgs,
  GetWorkflowArgs,
  ListProjectsArgs,
  ListWorkflowsArgs,
  SearchArgs,
  SendWorkflowEventArgs,
  SessionArgs,
} from "../generated/types";

// Export generated types
export type {
  ActiveProjectArgs,
  BootstrapContextArgs,
  ConfigGetArgs,
  ConfigResetArgs,
  ConfigSetArgs,
  DeleteProjectArgs,
  GetWorkflowArgs,
  ListProjectsArgs,
  ListWorkflowsArgs,
  SearchArgs,
  SendWorkflowEventArgs,
  SessionArgs,
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
const _validateConfigGetArgs = ajv.compile<ConfigGetArgs>(configGetSchema);
const _validateConfigResetArgs = ajv.compile<ConfigResetArgs>(configResetSchema);
const _validateConfigSetArgs = ajv.compile<ConfigSetArgs>(configSetSchema);
const _validateDeleteProjectArgs = ajv.compile<DeleteProjectArgs>(deleteProjectSchema);
const _validateGetWorkflowArgs = ajv.compile<GetWorkflowArgs>(getWorkflowSchema);
const _validateListProjectsArgs = ajv.compile<ListProjectsArgs>(listProjectsSchema);
const _validateListWorkflowsArgs = ajv.compile<ListWorkflowsArgs>(listWorkflowsSchema);
const _validateSearchArgs = ajv.compile<SearchArgs>(searchSchema);
const _validateSendWorkflowEventArgs = ajv.compile<SendWorkflowEventArgs>(sendWorkflowEventSchema);
const _validateSessionArgs = ajv.compile<SessionArgs>(sessionSchema);

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
 * Validate ConfigGetArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateConfigGetArgs.errors after validation.
 */
export const validateConfigGetArgs: ValidateFunction<ConfigGetArgs> =
  _validateConfigGetArgs;

/**
 * Validate ConfigResetArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateConfigResetArgs.errors after validation.
 */
export const validateConfigResetArgs: ValidateFunction<ConfigResetArgs> =
  _validateConfigResetArgs;

/**
 * Validate ConfigSetArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateConfigSetArgs.errors after validation.
 */
export const validateConfigSetArgs: ValidateFunction<ConfigSetArgs> =
  _validateConfigSetArgs;

/**
 * Validate DeleteProjectArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateDeleteProjectArgs.errors after validation.
 */
export const validateDeleteProjectArgs: ValidateFunction<DeleteProjectArgs> =
  _validateDeleteProjectArgs;

/**
 * Validate GetWorkflowArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateGetWorkflowArgs.errors after validation.
 */
export const validateGetWorkflowArgs: ValidateFunction<GetWorkflowArgs> =
  _validateGetWorkflowArgs;

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
 * Get validation errors for DeleteProjectArgs without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getDeleteProjectArgsErrors(data: unknown): ValidationError[] {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  _validateDeleteProjectArgs(cloned);
  return toValidationErrors(_validateDeleteProjectArgs.errors);
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
