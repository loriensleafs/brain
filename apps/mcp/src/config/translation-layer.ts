/**
 * Translation Layer: Brain Config -> basic-memory Config
 *
 * Provides one-way translation from Brain's user-facing configuration
 * to basic-memory's internal configuration format.
 *
 * Key concepts:
 * - Brain is the source of truth for configuration
 * - basic-memory config is derived and should never be edited directly
 * - Unknown fields in basic-memory config are preserved (round-trip fidelity)
 * - Memory path resolution happens during translation (DEFAULT/CODE/CUSTOM modes)
 *
 * @see ADR-020 for the field mapping specification
 * @see brain-config.ts for Brain config read/write operations
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  acquireConfigLock,
  releaseConfigLock,
} from "../utils/security/configLock";
import { expandTilde, normalizePath, validatePath } from "./path-validator";
import type {
  BrainConfig,
  LogLevel,
  MemoriesMode,
  ProjectConfig,
} from "./schema";

/**
 * Path to basic-memory's configuration file.
 * This is the target of our translation.
 */
const BASIC_MEMORY_CONFIG_DIR = path.join(os.homedir(), ".basic-memory");
const BASIC_MEMORY_CONFIG_FILE = "config.json";

/**
 * File mode for basic-memory config (owner read/write only).
 */
const FILE_MODE = 0o600;

/**
 * Default lock timeout in milliseconds.
 */
const DEFAULT_LOCK_TIMEOUT_MS = 5000;

/**
 * basic-memory configuration format.
 *
 * This represents the structure that basic-memory expects in ~/.basic-memory/config.json.
 * We only define the fields we actively manage; other fields are preserved as-is.
 */
export interface BasicMemoryConfig {
  /** Project name to memories path mapping */
  projects?: Record<string, string>;

  /** Default project name (preserved from existing config) */
  default_project?: string;

  /** Enable file sync */
  sync_changes?: boolean;

  /** Sync delay in milliseconds */
  sync_delay?: number;

  /** Log level */
  log_level?: string;

  /** Use kebab-case filenames (preserved) */
  kebab_filenames?: boolean;

  /** Cloud mode (preserved) */
  cloud_mode?: boolean;

  /** Allow unknown fields for forward compatibility */
  [key: string]: unknown;
}

/**
 * Error class for translation layer operations.
 */
export class TranslationError extends Error {
  constructor(
    message: string,
    public readonly code: "IO_ERROR" | "VALIDATION_ERROR" | "LOCK_ERROR",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "TranslationError";
  }
}

/**
 * Options for translation operations.
 */
export interface TranslationOptions {
  /** Lock timeout in milliseconds (default: 5000) */
  lockTimeoutMs?: number;
}

/**
 * Result of memories path resolution.
 */
export interface ResolvedMemoriesPath {
  /** The resolved absolute path */
  path: string;
  /** How the path was resolved */
  mode: MemoriesMode;
  /** Error if resolution failed */
  error?: string;
}

/**
 * Get the path to basic-memory's configuration directory.
 *
 * @returns Absolute path to ~/.basic-memory/
 */
export function getBasicMemoryConfigDir(): string {
  return BASIC_MEMORY_CONFIG_DIR;
}

/**
 * Get the path to basic-memory's configuration file.
 *
 * @returns Absolute path to ~/.basic-memory/config.json
 */
export function getBasicMemoryConfigPath(): string {
  return path.join(BASIC_MEMORY_CONFIG_DIR, BASIC_MEMORY_CONFIG_FILE);
}

/**
 * Resolve the memories path for a project based on its configuration mode.
 *
 * Mode resolution:
 * - DEFAULT: ${memories_location}/${project_name}
 * - CODE: ${code_path}/docs
 * - CUSTOM: Explicit memories_path value
 *
 * @param projectName - Name of the project
 * @param projectConfig - Project configuration
 * @param defaultMemoriesLocation - Default memories location from Brain config defaults
 * @returns Resolved path information
 *
 * @example
 * ```typescript
 * // DEFAULT mode
 * const result = resolveMemoriesPath("brain", { code_path: "/dev/brain" }, "~/memories");
 * // { path: "/Users/peter/memories/brain", mode: "DEFAULT" }
 *
 * // CODE mode
 * const result = resolveMemoriesPath("brain", { code_path: "/dev/brain", memories_mode: "CODE" }, "~/memories");
 * // { path: "/dev/brain/docs", mode: "CODE" }
 *
 * // CUSTOM mode
 * const result = resolveMemoriesPath("brain", { code_path: "/dev/brain", memories_path: "~/custom", memories_mode: "CUSTOM" }, "~/memories");
 * // { path: "/Users/peter/custom", mode: "CUSTOM" }
 * ```
 */
export function resolveMemoriesPath(
  projectName: string,
  projectConfig: ProjectConfig,
  defaultMemoriesLocation: string,
): ResolvedMemoriesPath {
  // Determine which mode to use
  const mode: MemoriesMode = projectConfig.memories_mode || "DEFAULT";

  try {
    switch (mode) {
      case "DEFAULT": {
        // ${memories_location}/${project_name}
        const expandedLocation = expandTilde(defaultMemoriesLocation);
        const resolvedPath = path.join(expandedLocation, projectName);
        const normalizedPath = normalizePath(resolvedPath);

        // Validate the resulting path
        const validation = validatePath(normalizedPath);
        if (!validation.valid) {
          return {
            path: normalizedPath,
            mode,
            error: validation.error,
          };
        }

        return { path: validation.normalizedPath!, mode };
      }

      case "CODE": {
        // ${code_path}/docs
        const expandedCodePath = expandTilde(projectConfig.code_path);
        const resolvedPath = path.join(expandedCodePath, "docs");
        const normalizedPath = normalizePath(resolvedPath);

        // Validate the resulting path
        const validation = validatePath(normalizedPath);
        if (!validation.valid) {
          return {
            path: normalizedPath,
            mode,
            error: validation.error,
          };
        }

        return { path: validation.normalizedPath!, mode };
      }

      case "CUSTOM": {
        // Explicit memories_path value
        if (!projectConfig.memories_path) {
          return {
            path: "",
            mode,
            error: "CUSTOM mode requires memories_path to be set",
          };
        }

        const normalizedPath = normalizePath(projectConfig.memories_path);

        // Validate the resulting path
        const validation = validatePath(normalizedPath);
        if (!validation.valid) {
          return {
            path: normalizedPath,
            mode,
            error: validation.error,
          };
        }

        return { path: validation.normalizedPath!, mode };
      }

      default: {
        // Should never happen due to TypeScript enum exhaustiveness
        return {
          path: "",
          mode: "DEFAULT",
          error: `Unknown memories mode: ${mode}`,
        };
      }
    }
  } catch (error) {
    return {
      path: "",
      mode,
      error: error instanceof Error ? error.message : "Path resolution failed",
    };
  }
}

/**
 * Translate Brain configuration to basic-memory configuration format.
 *
 * This is a one-way translation. Brain is the source of truth.
 * The translation resolves memories_mode to actual paths and maps
 * field names according to ADR-020.
 *
 * Field mapping:
 * | Brain Field                | basic-memory Field |
 * |----------------------------|--------------------|
 * | projects.<n>.memories_path | projects.<n>       |
 * | sync.enabled               | sync_changes       |
 * | sync.delay_ms              | sync_delay         |
 * | logging.level              | log_level          |
 *
 * @param brainConfig - Brain configuration to translate
 * @param existingConfig - Existing basic-memory config to preserve unknown fields (optional)
 * @returns basic-memory configuration object
 *
 * @example
 * ```typescript
 * const brainConfig: BrainConfig = {
 *   version: "2.0.0",
 *   defaults: { memories_location: "~/memories", memories_mode: "DEFAULT" },
 *   projects: { brain: { code_path: "/dev/brain" } },
 *   sync: { enabled: true, delay_ms: 500 },
 *   logging: { level: "info" },
 *   watcher: { enabled: true, debounce_ms: 2000 }
 * };
 *
 * const basicMemoryConfig = translateBrainToBasicMemory(brainConfig);
 * // {
 * //   projects: { brain: "/Users/peter/memories/brain" },
 * //   sync_changes: true,
 * //   sync_delay: 500,
 * //   log_level: "info"
 * // }
 * ```
 */
export function translateBrainToBasicMemory(
  brainConfig: BrainConfig,
  existingConfig?: BasicMemoryConfig,
): BasicMemoryConfig {
  // Start with existing config to preserve unknown fields
  const result: BasicMemoryConfig = existingConfig ? { ...existingConfig } : {};

  // Translate projects with resolved paths
  result.projects = {};
  for (const [projectName, projectConfig] of Object.entries(
    brainConfig.projects,
  )) {
    if (!projectConfig) continue;

    const resolved = resolveMemoriesPath(
      projectName,
      projectConfig,
      brainConfig.defaults.memories_location,
    );

    // Only include projects with successfully resolved paths
    if (!resolved.error && resolved.path) {
      result.projects[projectName] = resolved.path;
    }
    // Note: Failed resolutions are logged but don't block the entire translation
  }

  // Translate sync settings
  result.sync_changes = brainConfig.sync.enabled;
  result.sync_delay = brainConfig.sync.delay_ms;

  // Translate logging
  result.log_level = brainConfig.logging.level;

  return result;
}

/**
 * Load existing basic-memory configuration if it exists.
 *
 * @returns Existing config or empty object
 */
function loadExistingBasicMemoryConfig(): BasicMemoryConfig {
  const configPath = getBasicMemoryConfigPath();

  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(content) as BasicMemoryConfig;
    }
  } catch {
    // Return empty config on error
  }

  return {};
}

/**
 * Ensure the basic-memory config directory exists.
 */
function ensureBasicMemoryConfigDir(): void {
  const configDir = getBasicMemoryConfigDir();

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

/**
 * Write basic-memory configuration to disk using atomic write pattern.
 *
 * @param config - Configuration to write
 * @throws TranslationError if write fails
 */
function writeBasicMemoryConfig(config: BasicMemoryConfig): void {
  const configPath = getBasicMemoryConfigPath();
  const tempPath = `${configPath}.tmp`;

  try {
    ensureBasicMemoryConfigDir();

    // Write to temp file
    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(tempPath, content, { encoding: "utf-8", mode: FILE_MODE });

    // Verify temp file
    const verifyContent = fs.readFileSync(tempPath, "utf-8");
    JSON.parse(verifyContent); // Throws if invalid

    // Atomic rename
    fs.renameSync(tempPath, configPath);

    // Set permissions
    try {
      fs.chmodSync(configPath, FILE_MODE);
    } catch {
      // Ignore permission errors on non-Unix systems
    }
  } catch (error) {
    // Clean up temp file
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors
    }

    throw new TranslationError(
      `Failed to write basic-memory config: ${error instanceof Error ? error.message : "unknown error"}`,
      "IO_ERROR",
      error,
    );
  }
}

/**
 * Sync Brain configuration to basic-memory configuration file.
 *
 * This is the main entry point for the translation layer.
 * It loads the existing basic-memory config (to preserve unknown fields),
 * translates Brain config, and writes the result.
 *
 * Sync failures are logged but don't throw by default (configurable).
 * This ensures Brain operations can continue even if basic-memory sync fails.
 *
 * @param brainConfig - Brain configuration to sync
 * @param options - Translation options
 * @throws TranslationError if throwOnError is true and sync fails
 *
 * @example
 * ```typescript
 * // In saveBrainConfig or config change handler:
 * await syncConfigToBasicMemory(brainConfig);
 * ```
 */
export async function syncConfigToBasicMemory(
  brainConfig: BrainConfig,
  options: TranslationOptions = {},
): Promise<void> {
  const { lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS } = options;

  // Acquire lock for writing
  const lockResult = await acquireConfigLock({ timeoutMs: lockTimeoutMs });
  if (!lockResult.acquired) {
    throw new TranslationError(
      lockResult.error || "Failed to acquire lock for basic-memory sync",
      "LOCK_ERROR",
    );
  }

  try {
    // Load existing config to preserve unknown fields
    const existingConfig = loadExistingBasicMemoryConfig();

    // Translate Brain config
    const translatedConfig = translateBrainToBasicMemory(
      brainConfig,
      existingConfig,
    );

    // Write to basic-memory config
    writeBasicMemoryConfig(translatedConfig);
  } finally {
    releaseConfigLock();
  }
}

/**
 * Sync Brain configuration to basic-memory without throwing on failure.
 *
 * Returns a result object instead of throwing, suitable for non-critical sync operations.
 *
 * @param brainConfig - Brain configuration to sync
 * @param options - Translation options
 * @returns Result with success status and optional error
 */
export async function trySyncConfigToBasicMemory(
  brainConfig: BrainConfig,
  options: TranslationOptions = {},
): Promise<{ success: boolean; error?: string }> {
  try {
    await syncConfigToBasicMemory(brainConfig, options);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Sync failed";
    return { success: false, error: errorMessage };
  }
}

/**
 * Validate that a Brain configuration can be successfully translated.
 *
 * Performs a dry-run translation and returns any validation errors.
 *
 * @param brainConfig - Brain configuration to validate
 * @returns Array of validation errors (empty if valid)
 *
 * @example
 * ```typescript
 * const errors = validateTranslation(brainConfig);
 * if (errors.length > 0) {
 *   console.error("Translation would fail:", errors);
 * }
 * ```
 */
export function validateTranslation(brainConfig: BrainConfig): string[] {
  const errors: string[] = [];

  // Check that at least one project can be resolved
  let _resolvedCount = 0;
  for (const [projectName, projectConfig] of Object.entries(
    brainConfig.projects,
  )) {
    if (!projectConfig) continue;

    const resolved = resolveMemoriesPath(
      projectName,
      projectConfig,
      brainConfig.defaults.memories_location,
    );

    if (resolved.error) {
      errors.push(`Project '${projectName}': ${resolved.error}`);
    } else {
      _resolvedCount++;
    }
  }

  // Validate log level
  const validLogLevels: LogLevel[] = [
    "trace",
    "debug",
    "info",
    "warn",
    "error",
  ];
  const logLevel = brainConfig.logging.level ?? "info";
  if (!validLogLevels.includes(logLevel)) {
    errors.push(`Invalid log level: ${logLevel}`);
  }

  // Validate sync delay
  const syncDelayMs = brainConfig.sync.delay_ms ?? 500;
  if (syncDelayMs < 0) {
    errors.push(`Invalid sync delay: ${syncDelayMs} (must be >= 0)`);
  }

  return errors;
}

/**
 * Get the translation result without writing to disk.
 *
 * Useful for previewing what would be written to basic-memory config.
 *
 * @param brainConfig - Brain configuration to translate
 * @returns Translated configuration with resolution details
 */
export function previewTranslation(brainConfig: BrainConfig): {
  config: BasicMemoryConfig;
  resolutions: Record<string, ResolvedMemoriesPath>;
} {
  const resolutions: Record<string, ResolvedMemoriesPath> = {};

  // Resolve all projects
  for (const [projectName, projectConfig] of Object.entries(
    brainConfig.projects,
  )) {
    if (!projectConfig) continue;
    resolutions[projectName] = resolveMemoriesPath(
      projectName,
      projectConfig,
      brainConfig.defaults.memories_location,
    );
  }

  // Get the translated config
  const config = translateBrainToBasicMemory(brainConfig);

  return { config, resolutions };
}
