/**
 * Brain Configuration Read/Write Module
 *
 * Provides atomic read/write operations for Brain's global configuration
 * at ~/.config/brain/config.json with file locking, temp files, and error handling.
 *
 * Security controls:
 * - CWE-362: Race condition prevention via file locking
 * - CWE-367: TOCTOU mitigation via atomic write (temp + rename)
 * - File permissions: 0700 for directories, 0600 for config file
 *
 * @see ADR-020 for the configuration architecture decision
 * @see schema.ts for the Zod schema definitions
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  acquireConfigLock,
  releaseConfigLock,
} from "../utils/security/configLock";
import { validatePathOrThrow } from "./path-validator";
import {
  type BrainConfig,
  DEFAULT_BRAIN_CONFIG,
  validateBrainConfig,
} from "./schema";

/**
 * XDG-compliant configuration directory for Brain.
 * Uses ~/.config/brain/ on Unix-like systems.
 */
const XDG_CONFIG_HOME =
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
const BRAIN_CONFIG_DIR = path.join(XDG_CONFIG_HOME, "brain");
const BRAIN_CONFIG_FILE = "config.json";
const BRAIN_CONFIG_TEMP_FILE = "config.json.tmp";

/**
 * File permissions for security.
 * - Directory: 0700 (owner read/write/execute only)
 * - Config file: 0600 (owner read/write only)
 */
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

/**
 * Default lock timeout in milliseconds.
 */
const DEFAULT_LOCK_TIMEOUT_MS = 5000;

/**
 * Error class for Brain configuration operations.
 */
export class BrainConfigError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "PARSE_ERROR"
      | "VALIDATION_ERROR"
      | "IO_ERROR"
      | "LOCK_ERROR",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "BrainConfigError";
  }
}

/**
 * Options for configuration operations.
 */
export interface BrainConfigOptions {
  /** Lock timeout in milliseconds (default: 5000) */
  lockTimeoutMs?: number;
}

/**
 * Get the path to Brain's configuration directory.
 *
 * @returns Absolute path to ~/.config/brain/
 */
export function getBrainConfigDir(): string {
  return BRAIN_CONFIG_DIR;
}

/**
 * Get the path to Brain's configuration file.
 *
 * @returns Absolute path to ~/.config/brain/config.json
 */
export function getBrainConfigPath(): string {
  return path.join(BRAIN_CONFIG_DIR, BRAIN_CONFIG_FILE);
}

/**
 * Get the path to the temporary configuration file used for atomic writes.
 *
 * @returns Absolute path to ~/.config/brain/config.json.tmp
 */
function getTempConfigPath(): string {
  return path.join(BRAIN_CONFIG_DIR, BRAIN_CONFIG_TEMP_FILE);
}

/**
 * Ensure the configuration directory exists with correct permissions.
 *
 * @throws BrainConfigError if directory creation fails
 */
function ensureConfigDir(): void {
  const configDir = getBrainConfigDir();

  if (!fs.existsSync(configDir)) {
    try {
      fs.mkdirSync(configDir, { recursive: true, mode: DIR_MODE });
    } catch (error) {
      throw new BrainConfigError(
        `Failed to create config directory: ${configDir}`,
        "IO_ERROR",
        error,
      );
    }
  }

  // Verify/fix permissions on existing directory
  try {
    const stats = fs.statSync(configDir);
    if ((stats.mode & 0o777) !== DIR_MODE) {
      fs.chmodSync(configDir, DIR_MODE);
    }
  } catch {
    // Ignore permission check errors on non-Unix systems
  }
}

/**
 * Set file permissions to secure mode (owner-only read/write).
 *
 * @param filePath - Path to the file
 */
function setSecureFilePermissions(filePath: string): void {
  try {
    fs.chmodSync(filePath, FILE_MODE);
  } catch {
    // Ignore permission errors on non-Unix systems (e.g., Windows)
  }
}

/**
 * Load Brain configuration from disk.
 *
 * If the configuration file does not exist, returns the default configuration.
 * If the file exists but is invalid, throws a BrainConfigError.
 *
 * @param options - Configuration options
 * @returns Validated BrainConfig object
 * @throws BrainConfigError if file exists but cannot be parsed or validated
 *
 * @example
 * ```typescript
 * const config = await loadBrainConfig();
 * console.log(config.defaults.memories_location);
 * ```
 */
export async function loadBrainConfig(
  options: BrainConfigOptions = {},
): Promise<BrainConfig> {
  const configPath = getBrainConfigPath();
  const { lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS } = options;

  // Acquire lock for reading (prevents partial reads during writes)
  const lockResult = await acquireConfigLock({ timeoutMs: lockTimeoutMs });
  if (!lockResult.acquired) {
    throw new BrainConfigError(
      lockResult.error || "Failed to acquire config lock for reading",
      "LOCK_ERROR",
    );
  }

  try {
    // Check if file exists
    if (!fs.existsSync(configPath)) {
      return { ...DEFAULT_BRAIN_CONFIG };
    }

    // Read file content
    let content: string;
    try {
      content = fs.readFileSync(configPath, "utf-8");
    } catch (error) {
      throw new BrainConfigError(
        `Failed to read config file: ${configPath}`,
        "IO_ERROR",
        error,
      );
    }

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new BrainConfigError(
        `Invalid JSON in config file: ${error instanceof SyntaxError ? error.message : "parse error"}`,
        "PARSE_ERROR",
        error,
      );
    }

    // Validate against schema
    const result = validateBrainConfig(parsed);
    if (!result.success) {
      const errors = result.errors || [];
      const errorDetails = errors
        .map((error) => `${error.field || "root"}: ${error.message}`)
        .join("; ");
      throw new BrainConfigError(
        `Config validation failed: ${errorDetails}`,
        "VALIDATION_ERROR",
        new Error(errorDetails),
      );
    }

    return result.data!;
  } finally {
    releaseConfigLock();
  }
}

/**
 * Load Brain configuration synchronously.
 *
 * Use this only when async is not possible (e.g., module initialization).
 * Prefers loadBrainConfig() for most use cases.
 *
 * @returns Validated BrainConfig object or default config on error
 */
export function loadBrainConfigSync(): BrainConfig {
  const configPath = getBrainConfigPath();

  try {
    if (!fs.existsSync(configPath)) {
      return { ...DEFAULT_BRAIN_CONFIG };
    }

    const content = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content);
    const result = validateBrainConfig(parsed);

    if (result.success) {
      return result.data!;
    }
  } catch {
    // Return defaults on any error
  }

  return { ...DEFAULT_BRAIN_CONFIG };
}

/**
 * Save Brain configuration to disk using atomic write pattern.
 *
 * Atomicity is achieved via:
 * 1. Write to temporary file (config.json.tmp)
 * 2. Validate the written JSON
 * 3. Atomic rename (temp -> config.json)
 * 4. Clean up temp file on failure
 *
 * @param config - Configuration to save
 * @param options - Configuration options
 * @throws BrainConfigError if validation or write fails
 *
 * @example
 * ```typescript
 * const config = await loadBrainConfig();
 * config.logging.level = "debug";
 * await saveBrainConfig(config);
 * ```
 */
export async function saveBrainConfig(
  config: BrainConfig,
  options: BrainConfigOptions = {},
): Promise<void> {
  const { lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS } = options;

  // Validate config before writing
  const result = validateBrainConfig(config);
  if (!result.success) {
    const errors = result.errors || [];
    const errorDetails = errors
      .map((error) => `${error.field || "root"}: ${error.message}`)
      .join("; ");
    throw new BrainConfigError(
      `Invalid config: ${errorDetails}`,
      "VALIDATION_ERROR",
      new Error(errorDetails),
    );
  }

  // Validate all paths in the config
  validateConfigPaths(config);

  // Acquire lock for writing
  const lockResult = await acquireConfigLock({ timeoutMs: lockTimeoutMs });
  if (!lockResult.acquired) {
    throw new BrainConfigError(
      lockResult.error || "Failed to acquire config lock for writing",
      "LOCK_ERROR",
    );
  }

  const configPath = getBrainConfigPath();
  const tempPath = getTempConfigPath();

  try {
    // Ensure directory exists
    ensureConfigDir();

    // Serialize config
    const content = JSON.stringify(config, null, 2);

    // Write to temp file
    try {
      fs.writeFileSync(tempPath, content, {
        encoding: "utf-8",
        mode: FILE_MODE,
      });
    } catch (error) {
      throw new BrainConfigError(
        `Failed to write temp config file: ${tempPath}`,
        "IO_ERROR",
        error,
      );
    }

    // Verify temp file is valid JSON (guards against partial writes)
    try {
      const verifyContent = fs.readFileSync(tempPath, "utf-8");
      JSON.parse(verifyContent);
    } catch (error) {
      // Clean up invalid temp file
      cleanupTempFile(tempPath);
      throw new BrainConfigError(
        "Temp file verification failed: written JSON is invalid",
        "PARSE_ERROR",
        error,
      );
    }

    // Atomic rename
    try {
      fs.renameSync(tempPath, configPath);
    } catch (error) {
      cleanupTempFile(tempPath);
      throw new BrainConfigError(
        `Failed to rename temp file to config: ${error instanceof Error ? error.message : "rename error"}`,
        "IO_ERROR",
        error,
      );
    }

    // Set secure permissions on final file
    setSecureFilePermissions(configPath);
  } finally {
    // Always release lock
    releaseConfigLock();

    // Clean up temp file if it still exists (shouldn't happen on success)
    cleanupTempFile(tempPath);
  }
}

/**
 * Initialize Brain configuration with defaults if it doesn't exist.
 *
 * Call this at application startup to ensure configuration exists.
 *
 * @param options - Configuration options
 * @returns The loaded or created configuration
 *
 * @example
 * ```typescript
 * // At application startup
 * const config = await initBrainConfig();
 * ```
 */
export async function initBrainConfig(
  options: BrainConfigOptions = {},
): Promise<BrainConfig> {
  const configPath = getBrainConfigPath();

  if (!fs.existsSync(configPath)) {
    await saveBrainConfig(DEFAULT_BRAIN_CONFIG, options);
    return { ...DEFAULT_BRAIN_CONFIG };
  }

  return loadBrainConfig(options);
}

/**
 * Validate all path fields in the configuration.
 *
 * @param config - Configuration to validate
 * @throws BrainConfigError if any path is invalid
 */
function validateConfigPaths(config: BrainConfig): void {
  // Validate memories_location
  try {
    validatePathOrThrow(config.defaults.memories_location);
  } catch (error) {
    throw new BrainConfigError(
      `Invalid memories_location: ${error instanceof Error ? error.message : "validation error"}`,
      "VALIDATION_ERROR",
      error,
    );
  }

  // Validate project paths
  for (const [projectName, projectConfig] of Object.entries(
    config.projects ?? {},
  )) {
    if (!projectConfig) continue;

    // Validate code_path
    try {
      validatePathOrThrow(projectConfig.code_path);
    } catch (error) {
      throw new BrainConfigError(
        `Invalid code_path for project '${projectName}': ${error instanceof Error ? error.message : "validation error"}`,
        "VALIDATION_ERROR",
        error,
      );
    }

    // Validate memories_path if set
    if (projectConfig.memories_path) {
      try {
        validatePathOrThrow(projectConfig.memories_path);
      } catch (error) {
        throw new BrainConfigError(
          `Invalid memories_path for project '${projectName}': ${error instanceof Error ? error.message : "validation error"}`,
          "VALIDATION_ERROR",
          error,
        );
      }
    }
  }
}

/**
 * Clean up temporary file if it exists.
 *
 * @param tempPath - Path to temp file
 */
function cleanupTempFile(tempPath: string): void {
  try {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Check if Brain configuration file exists.
 *
 * @returns true if config file exists
 */
export function brainConfigExists(): boolean {
  return fs.existsSync(getBrainConfigPath());
}

/**
 * Get the default memories location from Brain configuration.
 *
 * This is a convenience function for tools that need the default memories
 * location without loading the entire config. Uses synchronous loading
 * since this is typically called during tool initialization.
 *
 * @returns The default memories location path (e.g., "~/memories")
 *
 * @example
 * ```typescript
 * const memoriesLocation = getDefaultMemoriesLocation();
 * // "~/memories" (or custom value from config)
 * ```
 */
export function getDefaultMemoriesLocation(): string {
  const config = loadBrainConfigSync();
  return config.defaults.memories_location;
}

/**
 * Delete Brain configuration file.
 *
 * Use with caution - primarily for testing and migration cleanup.
 *
 * @param options - Configuration options
 * @throws BrainConfigError if deletion fails
 */
export async function deleteBrainConfig(
  options: BrainConfigOptions = {},
): Promise<void> {
  const { lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS } = options;
  const configPath = getBrainConfigPath();

  if (!fs.existsSync(configPath)) {
    return;
  }

  const lockResult = await acquireConfigLock({ timeoutMs: lockTimeoutMs });
  if (!lockResult.acquired) {
    throw new BrainConfigError(
      lockResult.error || "Failed to acquire config lock for deletion",
      "LOCK_ERROR",
    );
  }

  try {
    fs.unlinkSync(configPath);
  } catch (error) {
    throw new BrainConfigError(
      `Failed to delete config file: ${configPath}`,
      "IO_ERROR",
      error,
    );
  } finally {
    releaseConfigLock();
  }
}
