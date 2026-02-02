/**
 * Schema definitions for config MCP tools
 *
 * Defines the input schemas for config_get, config_set, config_reset,
 * config_rollback, config_update_project, and config_update_global tools.
 *
 * All schemas use AJV for validation via @brain/validation.
 *
 * @see ADR-020 for configuration architecture
 * @see ADR-022 for schema-driven validation architecture
 * @see TASK-020-19 for implementation requirements
 */

import {
  parseConfigGetArgs as _parseConfigGetArgs,
  parseConfigResetArgs as _parseConfigResetArgs,
  parseConfigSetArgs as _parseConfigSetArgs,
  type ConfigGetArgs,
  type ConfigResetArgs,
  type ConfigSetArgs,
} from "@brain/validation";
import configGetSchema from "@brain/validation/schemas/tools/config/get.schema.json";
import configResetSchema from "@brain/validation/schemas/tools/config/reset.schema.json";
import configRollbackSchema from "@brain/validation/schemas/tools/config/rollback.schema.json";
import configSetSchema from "@brain/validation/schemas/tools/config/set.schema.json";
import configUpdateGlobalSchema from "@brain/validation/schemas/tools/config/update-global.schema.json";
import configUpdateProjectSchema from "@brain/validation/schemas/tools/config/update-project.schema.json";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import Ajv from "ajv";

// --- AJV Setup ---

const ajv = new Ajv({
  allErrors: true,
  useDefaults: true,
  coerceTypes: false,
  strict: true,
});

// ============================================================================
// config_get (uses @brain/validation)
// ============================================================================

// Re-export type for backward compatibility
export type { ConfigGetArgs };

/**
 * ConfigGetArgsSchema provides parse interface.
 * Uses AJV validation under the hood for 5-18x better performance.
 */
export const ConfigGetArgsSchema = {
  parse: _parseConfigGetArgs,
};

export const configGetToolDefinition: Tool = {
  name: "config_get",
  description: `Get Brain configuration values.

Returns the entire configuration or a specific field.

Examples:
- Get all config: config_get
- Get specific field: config_get with key="logging.level"
- Get nested field: config_get with key="defaults.memories_location"

Config structure:
- defaults.memories_location: Base path for DEFAULT mode
- defaults.memories_mode: Default mode for new projects
- projects.<name>.code_path: Project source code path
- projects.<name>.memories_mode: Project-specific mode
- sync.enabled: Enable file sync
- sync.delay_ms: Sync delay in milliseconds
- logging.level: Log verbosity (trace, debug, info, warn, error)
- watcher.enabled: Enable config file watching
- watcher.debounce_ms: Debounce delay for file watching`,
  inputSchema: configGetSchema as Tool["inputSchema"],
};

// ============================================================================
// config_set (uses @brain/validation)
// ============================================================================

// Re-export type for backward compatibility
export type { ConfigSetArgs };

/**
 * ConfigSetArgsSchema provides parse interface.
 * Uses AJV validation under the hood for 5-18x better performance.
 */
export const ConfigSetArgsSchema = {
  parse: _parseConfigSetArgs,
};

export const configSetToolDefinition: Tool = {
  name: "config_set",
  description: `Set a Brain configuration value.

Updates a single configuration field. Triggers reconfiguration if the change affects projects.

Settable keys:
- defaults.memories_location: Base path for DEFAULT mode (string)
- defaults.memories_mode: Default mode (DEFAULT, CODE, or CUSTOM)
- sync.enabled: Enable file sync (boolean)
- sync.delay_ms: Sync delay in milliseconds (number)
- logging.level: Log verbosity (trace, debug, info, warn, error)
- watcher.enabled: Enable config file watching (boolean)
- watcher.debounce_ms: Debounce delay for file watching (number)

NOTE: To update project-specific settings, use config_update_project instead.

Examples:
- Set log level: config_set with key="logging.level", value="debug"
- Set sync delay: config_set with key="sync.delay_ms", value=1000
- Disable watcher: config_set with key="watcher.enabled", value=false`,
  inputSchema: configSetSchema as Tool["inputSchema"],
};

// ============================================================================
// config_reset (uses @brain/validation)
// ============================================================================

// Re-export type for backward compatibility
export type { ConfigResetArgs };

/**
 * ConfigResetArgsSchema provides parse interface.
 * Uses AJV validation under the hood for 5-18x better performance.
 */
export const ConfigResetArgsSchema = {
  parse: _parseConfigResetArgs,
};

export const configResetToolDefinition: Tool = {
  name: "config_reset",
  description: `Reset Brain configuration to defaults.

Reset a specific field or the entire configuration.

WARNING: Resetting all will remove all project configurations. Projects will need to be re-created.

Resettable keys:
- defaults: Reset default settings
- sync: Reset sync settings
- logging: Reset logging settings
- watcher: Reset watcher settings

Examples:
- Reset log level: config_reset with key="logging.level"
- Reset all sync settings: config_reset with key="sync"
- Reset entire config: config_reset with all=true`,
  inputSchema: configResetSchema as Tool["inputSchema"],
};

// ============================================================================
// config_rollback (AJV)
// ============================================================================

/**
 * ConfigRollbackArgs type definition.
 */
export interface ConfigRollbackArgs {
  /** Rollback target: 'lastKnownGood' (baseline from startup) or 'previous' (most recent snapshot). */
  target: "lastKnownGood" | "previous";
}

const _validateConfigRollbackArgs = ajv.compile<ConfigRollbackArgs>(configRollbackSchema);

/**
 * Parse and validate ConfigRollbackArgs.
 * Throws on validation failure.
 */
export function parseConfigRollbackArgs(data: unknown): ConfigRollbackArgs {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  if (_validateConfigRollbackArgs(cloned)) {
    return cloned;
  }
  const errors = _validateConfigRollbackArgs.errors ?? [];
  const message = errors.map((e) => `${e.instancePath || "root"}: ${e.message}`).join("; ");
  throw new Error(`Validation failed: ${message}`);
}

/**
 * ConfigRollbackArgsSchema provides parse interface.
 */
export const ConfigRollbackArgsSchema = {
  parse: parseConfigRollbackArgs,
};

export const configRollbackToolDefinition: Tool = {
  name: "config_rollback",
  description: `Rollback Brain configuration to a previous state.

Restores configuration from snapshots created before risky operations.

Targets:
- lastKnownGood: The baseline configuration from MCP server startup or last successful operation
- previous: The most recent snapshot in rollback history

Use this to recover from:
- Failed migrations
- Invalid manual edits
- Broken configuration changes

Examples:
- Restore baseline: config_rollback with target="lastKnownGood"
- Restore previous: config_rollback with target="previous"`,
  inputSchema: configRollbackSchema as Tool["inputSchema"],
};

// ============================================================================
// config_update_project (AJV)
// ============================================================================

/**
 * ConfigUpdateProjectArgs type definition.
 */
export interface ConfigUpdateProjectArgs {
  /** Project name to update. */
  project: string;
  /** New code path for the project. Use ~ for home directory. */
  code_path?: string;
  /** New memories path. Use 'DEFAULT', 'CODE', or an absolute path. */
  memories_path?: string;
  /** Memories mode for the project. */
  memories_mode?: "DEFAULT" | "CODE" | "CUSTOM";
  /** Whether to migrate memories to new location if path changes. Default: true. */
  migrate?: boolean;
}

const _validateConfigUpdateProjectArgs =
  ajv.compile<ConfigUpdateProjectArgs>(configUpdateProjectSchema);

/**
 * Parse and validate ConfigUpdateProjectArgs.
 * Throws on validation failure.
 */
export function parseConfigUpdateProjectArgs(data: unknown): ConfigUpdateProjectArgs {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  if (_validateConfigUpdateProjectArgs(cloned)) {
    return cloned;
  }
  const errors = _validateConfigUpdateProjectArgs.errors ?? [];
  const message = errors.map((e) => `${e.instancePath || "root"}: ${e.message}`).join("; ");
  throw new Error(`Validation failed: ${message}`);
}

/**
 * ConfigUpdateProjectArgsSchema provides parse interface.
 */
export const ConfigUpdateProjectArgsSchema = {
  parse: parseConfigUpdateProjectArgs,
};

export const configUpdateProjectToolDefinition: Tool = {
  name: "config_update_project",
  description: `Update project configuration with optional migration.

Updates a project's configuration in Brain config and optionally migrates
memories to a new location.

This tool provides atomic updates with automatic rollback on failure:
1. Creates config snapshot
2. Updates Brain config
3. Syncs to basic-memory config
4. Migrates memories if path changed and migrate=true
5. Verifies indexing after migration
6. On failure: rolls back to snapshot

Parameters:
- project: Project name (required)
- code_path: New code path (optional)
- memories_path: New memories location - 'DEFAULT', 'CODE', or absolute path (optional)
- memories_mode: Memories mode - DEFAULT, CODE, or CUSTOM (optional)
- migrate: Whether to migrate memories on path change (default: true)

Examples:
- Change to CODE mode: config_update_project with project="brain", memories_mode="CODE"
- Change to DEFAULT: config_update_project with project="brain", memories_mode="DEFAULT"
- Change code path: config_update_project with project="brain", code_path="~/Dev/new-path"`,
  inputSchema: configUpdateProjectSchema as Tool["inputSchema"],
};

// ============================================================================
// config_update_global (AJV)
// ============================================================================

/**
 * ConfigUpdateGlobalArgs type definition.
 */
export interface ConfigUpdateGlobalArgs {
  /** New default memories location. Use ~ for home directory. */
  memories_location?: string;
  /** New default memories mode for new projects. */
  memories_mode?: "DEFAULT" | "CODE" | "CUSTOM";
  /** Whether to migrate memories for all affected projects when default location changes. Default: true. */
  migrate_affected?: boolean;
}

const _validateConfigUpdateGlobalArgs =
  ajv.compile<ConfigUpdateGlobalArgs>(configUpdateGlobalSchema);

/**
 * Parse and validate ConfigUpdateGlobalArgs.
 * Throws on validation failure.
 */
export function parseConfigUpdateGlobalArgs(data: unknown): ConfigUpdateGlobalArgs {
  const cloned = typeof data === "object" && data !== null ? { ...data } : data;
  if (_validateConfigUpdateGlobalArgs(cloned)) {
    return cloned;
  }
  const errors = _validateConfigUpdateGlobalArgs.errors ?? [];
  const message = errors.map((e) => `${e.instancePath || "root"}: ${e.message}`).join("; ");
  throw new Error(`Validation failed: ${message}`);
}

/**
 * ConfigUpdateGlobalArgsSchema provides parse interface.
 */
export const ConfigUpdateGlobalArgsSchema = {
  parse: parseConfigUpdateGlobalArgs,
};

export const configUpdateGlobalToolDefinition: Tool = {
  name: "config_update_global",
  description: `Update global default configuration with optional migration.

Updates default settings that affect new projects and optionally migrates
existing projects using DEFAULT mode.

This tool provides atomic updates with automatic rollback on failure:
1. Creates config snapshot
2. Identifies affected projects (those using DEFAULT mode)
3. Updates Brain config
4. Syncs to basic-memory config
5. Migrates affected project memories if migrate_affected=true
6. Verifies indexing after migration
7. On failure: rolls back to snapshot

Parameters:
- memories_location: New default memories base path (optional)
- memories_mode: New default mode for new projects (optional)
- migrate_affected: Whether to migrate affected projects (default: true)

Examples:
- Change default location: config_update_global with memories_location="~/brain-memories"
- Change without migration: config_update_global with memories_location="~/new-path", migrate_affected=false`,
  inputSchema: configUpdateGlobalSchema as Tool["inputSchema"],
};
