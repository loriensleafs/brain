/**
 * Brain Configuration Schema
 *
 * Zod schema definitions for Brain's global configuration at ~/.config/brain/config.json.
 * This schema represents the user-facing configuration that gets translated to basic-memory's
 * internal config via the translation layer.
 *
 * @see ADR-020 for the configuration architecture decision
 * @see translation-layer.ts for Brain -> basic-memory field mapping
 */

import { z } from "zod";

/**
 * Memories mode determines where project memories are stored.
 *
 * - DEFAULT: ${memories_location}/${project_name}
 * - CODE: ${code_path}/docs
 * - CUSTOM: Explicit memories_path value
 */
export const MemoriesModeSchema = z.enum(["DEFAULT", "CODE", "CUSTOM"]);
export type MemoriesMode = z.infer<typeof MemoriesModeSchema>;

/**
 * Log level for Brain operations.
 */
export const LogLevelSchema = z.enum(["trace", "debug", "info", "warn", "error"]);
export type LogLevel = z.infer<typeof LogLevelSchema>;

/**
 * Project-specific configuration.
 *
 * Each project tracks:
 * - code_path: Absolute path to the project source code
 * - memories_path: Computed or explicit path to memories (optional)
 * - memories_mode: How to resolve the memories path (optional, defaults to global)
 */
export const ProjectConfigSchema = z.object({
  /** Absolute path to project source code. */
  code_path: z.string().min(1, "code_path is required"),

  /** Computed or explicit path to project memories. Optional if using DEFAULT or CODE mode. */
  memories_path: z.string().optional(),

  /** How to resolve the memories path. Defaults to global memories_mode if not set. */
  memories_mode: MemoriesModeSchema.optional(),
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

/**
 * Global default settings for new projects.
 */
export const DefaultsConfigSchema = z.object({
  /** Base path for DEFAULT mode memories (e.g., ~/memories). */
  memories_location: z.string().min(1, "memories_location is required"),

  /** Default memories mode for new projects. */
  memories_mode: MemoriesModeSchema.default("DEFAULT"),
});
export type DefaultsConfig = z.infer<typeof DefaultsConfigSchema>;

/**
 * File synchronization settings.
 */
export const SyncConfigSchema = z.object({
  /** Enable file sync between code and memories. */
  enabled: z.boolean().default(true),

  /** Sync delay in milliseconds. */
  delay_ms: z.number().int().min(0).default(500),
});
export type SyncConfig = z.infer<typeof SyncConfigSchema>;

/**
 * Logging configuration.
 */
export const LoggingConfigSchema = z.object({
  /** Log verbosity level. */
  level: LogLevelSchema.default("info"),
});
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

/**
 * File watcher configuration for detecting manual config edits.
 */
export const WatcherConfigSchema = z.object({
  /** Enable config file watching. */
  enabled: z.boolean().default(true),

  /** Debounce delay in milliseconds to handle editor chunked writes. */
  debounce_ms: z.number().int().min(0).default(2000),
});
export type WatcherConfig = z.infer<typeof WatcherConfigSchema>;

/**
 * Complete Brain configuration schema.
 *
 * This is the user-facing configuration stored at ~/.config/brain/config.json.
 * It provides a clean abstraction over basic-memory's internal configuration.
 */
export const BrainConfigSchema = z.object({
  /** JSON Schema URL for editor validation support. */
  $schema: z.string().optional(),

  /** Configuration version. Must be "2.0.0" for this schema. */
  version: z.literal("2.0.0"),

  /** Global default settings. */
  defaults: DefaultsConfigSchema,

  /** Project-specific configurations keyed by project name. */
  projects: z.record(z.string(), ProjectConfigSchema).default({}),

  /** File synchronization settings. */
  sync: SyncConfigSchema.default({
    enabled: true,
    delay_ms: 500,
  }),

  /** Logging configuration. */
  logging: LoggingConfigSchema.default({
    level: "info",
  }),

  /** File watcher configuration. */
  watcher: WatcherConfigSchema.default({
    enabled: true,
    debounce_ms: 2000,
  }),
});

/**
 * Inferred TypeScript type from the Zod schema.
 */
export type BrainConfig = z.infer<typeof BrainConfigSchema>;

/**
 * Validation result from safeParse operations.
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: z.ZodError;
}

/**
 * Validate a Brain configuration object using Zod safeParse.
 *
 * Returns a result object with success status and either parsed data or error details.
 * Use this instead of parse() when you need to handle validation errors gracefully.
 *
 * @param config - The configuration object to validate
 * @returns ValidationResult with success status and data or error
 *
 * @example
 * ```typescript
 * const result = validateBrainConfig(unknownConfig);
 * if (result.success) {
 *   console.log("Valid config:", result.data);
 * } else {
 *   console.error("Invalid config:", result.error.format());
 * }
 * ```
 */
export function validateBrainConfig(config: unknown): ValidationResult<BrainConfig> {
  const result = BrainConfigSchema.safeParse(config);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validate a single project configuration.
 *
 * @param project - The project configuration to validate
 * @returns ValidationResult with success status and data or error
 */
export function validateProjectConfig(project: unknown): ValidationResult<ProjectConfig> {
  const result = ProjectConfigSchema.safeParse(project);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Default Brain configuration for new installations.
 *
 * Used when no config file exists or when resetting to defaults.
 */
export const DEFAULT_BRAIN_CONFIG: BrainConfig = {
  $schema: "https://brain.dev/schemas/config-v2.json",
  version: "2.0.0",
  defaults: {
    memories_location: "~/memories",
    memories_mode: "DEFAULT",
  },
  projects: {},
  sync: {
    enabled: true,
    delay_ms: 500,
  },
  logging: {
    level: "info",
  },
  watcher: {
    enabled: true,
    debounce_ms: 2000,
  },
};
