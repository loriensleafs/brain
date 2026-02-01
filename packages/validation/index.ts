/**
 * @brain/validation
 *
 * JSON Schema definitions and validators for Brain.
 * Provides AJV-based validation with TypeScript type safety.
 *
 * Usage:
 *   import {
 *     parseSearchArgs,
 *     validateSearchArgs,
 *     type SearchArgs
 *   } from '@brain/validation';
 */

export {
  // Validators
  validateBootstrapContextArgs,
  validateSearchArgs,
  // Parse functions (throw on error)
  parseBootstrapContextArgs,
  parseSearchArgs,
  // Error retrieval
  getBootstrapContextArgsErrors,
  getSearchArgsErrors,
  // Types
  type BootstrapContextArgs,
  type SearchArgs,
  type ValidationError,
} from "./validate";
