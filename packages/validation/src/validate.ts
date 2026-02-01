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
import searchSchema from "../schemas/tools/search.schema.json";

import type { BootstrapContextArgs, SearchArgs } from "../generated/types";

// Export generated types
export type { BootstrapContextArgs, SearchArgs };

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
const _validateBootstrapContextArgs = ajv.compile<BootstrapContextArgs>(bootstrapContextSchema);
const _validateSearchArgs = ajv.compile<SearchArgs>(searchSchema);

/**
 * Validate BootstrapContextArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateBootstrapContextArgs.errors after validation.
 */
export const validateBootstrapContextArgs: ValidateFunction<BootstrapContextArgs> =
  _validateBootstrapContextArgs;

/**
 * Validate SearchArgs.
 * Returns true if valid, false otherwise.
 * Access errors via validateSearchArgs.errors after validation.
 */
export const validateSearchArgs: ValidateFunction<SearchArgs> = _validateSearchArgs;

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
 * Get validation errors for BootstrapContextArgs without throwing.
 * Returns empty array if valid, array of ValidationError otherwise.
 */
export function getBootstrapContextArgsErrors(data: unknown): ValidationError[] {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  _validateBootstrapContextArgs(cloned);
  return toValidationErrors(_validateBootstrapContextArgs.errors);
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
