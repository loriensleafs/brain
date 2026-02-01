/**
 * Config MCP tools index
 *
 * Exports all configuration management tools:
 * - config_get: Get configuration values
 * - config_set: Set configuration values
 * - config_reset: Reset configuration to defaults
 * - config_rollback: Rollback to previous configuration
 * - config_update_project: Update project configuration with migration
 * - config_update_global: Update global defaults with migration
 *
 * @see ADR-020 for configuration architecture
 * @see TASK-020-19 for implementation requirements
 */

// Re-export tool modules
export * as configGet from "./get";
export * as configReset from "./reset";
export * as configRollback from "./rollback";
// Re-export all schemas
export {
  type ConfigGetArgs,
  ConfigGetArgsSchema,
  type ConfigResetArgs,
  ConfigResetArgsSchema,
  type ConfigRollbackArgs,
  ConfigRollbackArgsSchema,
  type ConfigSetArgs,
  ConfigSetArgsSchema,
  type ConfigUpdateGlobalArgs,
  ConfigUpdateGlobalArgsSchema,
  type ConfigUpdateProjectArgs,
  ConfigUpdateProjectArgsSchema,
  configGetToolDefinition,
  configResetToolDefinition,
  configRollbackToolDefinition,
  configSetToolDefinition,
  configUpdateGlobalToolDefinition,
  configUpdateProjectToolDefinition,
} from "./schema";
export * as configSet from "./set";
export * as configUpdateGlobal from "./update-global";
export * as configUpdateProject from "./update-project";
