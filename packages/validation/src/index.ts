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
  validateActiveProjectArgs,
  validateBootstrapContextArgs,
  validateConfigGetArgs,
  validateConfigResetArgs,
  validateConfigSetArgs,
  validateDeleteProjectArgs,
  validateGetWorkflowArgs,
  validateListProjectsArgs,
  validateListWorkflowsArgs,
  validateSearchArgs,
  validateSendWorkflowEventArgs,
  validateSessionArgs,
  // Parse functions (throw on error)
  parseActiveProjectArgs,
  parseBootstrapContextArgs,
  parseConfigGetArgs,
  parseConfigResetArgs,
  parseConfigSetArgs,
  parseDeleteProjectArgs,
  parseGetWorkflowArgs,
  parseListProjectsArgs,
  parseListWorkflowsArgs,
  parseSearchArgs,
  parseSendWorkflowEventArgs,
  parseSessionArgs,
  // Error retrieval
  getActiveProjectArgsErrors,
  getBootstrapContextArgsErrors,
  getConfigGetArgsErrors,
  getConfigResetArgsErrors,
  getConfigSetArgsErrors,
  getDeleteProjectArgsErrors,
  getGetWorkflowArgsErrors,
  getListProjectsArgsErrors,
  getListWorkflowsArgsErrors,
  getSearchArgsErrors,
  getSendWorkflowEventArgsErrors,
  getSessionArgsErrors,
  // Types
  type ActiveProjectArgs,
  type BootstrapContextArgs,
  type ConfigGetArgs,
  type ConfigResetArgs,
  type ConfigSetArgs,
  type DeleteProjectArgs,
  type GetWorkflowArgs,
  type ListProjectsArgs,
  type ListWorkflowsArgs,
  type SearchArgs,
  type SendWorkflowEventArgs,
  type SessionArgs,
  type ValidationError,
} from "./validate";
