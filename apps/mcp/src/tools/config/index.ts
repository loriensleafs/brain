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

// Re-export all schemas
export {
  ConfigGetArgsSchema,
  configGetToolDefinition,
  type ConfigGetArgs,
  ConfigSetArgsSchema,
  configSetToolDefinition,
  type ConfigSetArgs,
  ConfigResetArgsSchema,
  configResetToolDefinition,
  type ConfigResetArgs,
  ConfigRollbackArgsSchema,
  configRollbackToolDefinition,
  type ConfigRollbackArgs,
  ConfigUpdateProjectArgsSchema,
  configUpdateProjectToolDefinition,
  type ConfigUpdateProjectArgs,
  ConfigUpdateGlobalArgsSchema,
  configUpdateGlobalToolDefinition,
  type ConfigUpdateGlobalArgs,
} from "./schema";

// Re-export tool modules
export * as configGet from "./get";
export * as configSet from "./set";
export * as configReset from "./reset";
export * as configRollback from "./rollback";
export * as configUpdateProject from "./update-project";
export * as configUpdateGlobal from "./update-global";
