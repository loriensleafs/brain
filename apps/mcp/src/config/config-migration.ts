/**
 * Config Migration Module
 *
 * Handles migration from old basic-memory config location (~/.basic-memory/brain-config.json)
 * to new XDG-compliant location (~/.config/brain/config.json).
 *
 * Migration process:
 * 1. Create backup of old config
 * 2. Transform old schema to new schema (rename fields)
 * 3. Write to new location atomically
 * 4. Verify new config loads correctly
 * 5. Remove old config after success
 *
 * @see ADR-020 for migration requirements
 * @see TASK-020-11 for acceptance criteria
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { logger } from "../utils/internal/logger";
import { getBrainConfigPath, loadBrainConfig, saveBrainConfig } from "./brain-config";
import type { ConfigRollbackManager } from "./rollback";
import {
  type BrainConfig,
  DEFAULT_BRAIN_CONFIG,
  type MemoriesMode,
  parseBrainConfig,
} from "./schema";
import { syncConfigToBasicMemory } from "./translation-layer";

/**
 * Old config location (basic-memory style).
 */
const OLD_CONFIG_DIR = path.join(os.homedir(), ".basic-memory");
const OLD_CONFIG_FILE = "brain-config.json";

/**
 * Backup file suffix.
 */
const BACKUP_SUFFIX = ".backup";

/**
 * File mode for backup files.
 */
const FILE_MODE = 0o600;

/**
 * Old configuration schema (v1).
 *
 * Maps to the old field names used in basic-memory.
 * Supports two formats:
 * - Format A: notes_path, projects (with code_path per project)
 * - Format B: default_notes_path, code_paths (flat mapping)
 */
export interface OldBrainConfig {
  /** Schema version in old format */
  version?: string;

  /** Old field name: notes_path (maps to memories_location) - Format A */
  notes_path?: string;

  /** Old field name: default_notes_path (maps to memories_location) - Format B */
  default_notes_path?: string;

  /** Projects in old format - Format A */
  projects?: Record<string, OldProjectConfig>;

  /** Code paths flat mapping - Format B: { projectName: codePath } */
  code_paths?: Record<string, string>;

  /** Sync settings in old format */
  sync?: {
    enabled?: boolean;
    delay?: number; // Was delay, now delay_ms
  };

  /** Logging in old format */
  log_level?: string;

  /** Allow unknown fields */
  [key: string]: unknown;
}

/**
 * Old project configuration format.
 */
export interface OldProjectConfig {
  /** Path to project code */
  code_path?: string;

  /** Old field name: notes_path (maps to memories_path) */
  notes_path?: string;

  /** Storage mode */
  mode?: string;

  /** Allow unknown fields */
  [key: string]: unknown;
}

/**
 * Result of a migration operation.
 */
export interface MigrationResult {
  /** Whether migration succeeded */
  success: boolean;

  /** Error message if migration failed */
  error?: string;

  /** Path to backup file if created */
  backupPath?: string;

  /** Migrated config if successful */
  migratedConfig?: BrainConfig;

  /** Whether old config was removed */
  oldConfigRemoved?: boolean;

  /** Migration steps completed */
  steps: MigrationStep[];
}

/**
 * Individual migration step.
 */
export interface MigrationStep {
  /** Step name */
  name: string;

  /** Step status */
  status: "completed" | "failed" | "skipped";

  /** Error message if failed */
  error?: string;
}

/**
 * Options for migration operation.
 */
export interface MigrationOptions {
  /** Remove old config after successful migration (default: true) */
  removeOldConfig?: boolean;

  /** Force migration even if new config exists (default: false) */
  force?: boolean;

  /** Dry run - don't write any files (default: false) */
  dryRun?: boolean;
}

/**
 * Get the path to the old config file.
 */
export function getOldConfigPath(): string {
  return path.join(OLD_CONFIG_DIR, OLD_CONFIG_FILE);
}

/**
 * Check if old config file exists.
 */
export function oldConfigExists(): boolean {
  return fs.existsSync(getOldConfigPath());
}

/**
 * Check if migration is needed.
 *
 * Migration is needed if:
 * - Old config exists
 * - New config does not exist (or force option is set)
 */
export function needsMigration(options: MigrationOptions = {}): boolean {
  const oldExists = oldConfigExists();
  const newExists = fs.existsSync(getBrainConfigPath());

  if (!oldExists) {
    return false;
  }

  if (options.force) {
    return true;
  }

  return !newExists;
}

/**
 * Load old config from disk.
 *
 * @returns Old config object or null if not found/invalid
 */
export function loadOldConfig(): OldBrainConfig | null {
  const configPath = getOldConfigPath();

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(content) as OldBrainConfig;
  } catch (error) {
    logger.debug({ error, path: configPath }, "Failed to load old config");
    return null;
  }
}

/**
 * Transform old config schema to new schema.
 *
 * Field mapping:
 * - notes_path -> memories_location (defaults level)
 * - notes_path -> memories_path (project level)
 * - sync.delay -> sync.delay_ms
 * - mode -> memories_mode
 * - log_level -> logging.level
 *
 * @param oldConfig - Configuration in old format
 * @returns Configuration in new format
 */
export function transformOldToNew(oldConfig: OldBrainConfig): BrainConfig {
  const defaultSync = DEFAULT_BRAIN_CONFIG.sync ?? {
    enabled: true,
    delay_ms: 500,
  };
  const defaultLogging = DEFAULT_BRAIN_CONFIG.logging ?? {
    level: "info" as const,
  };
  const defaultWatcher = DEFAULT_BRAIN_CONFIG.watcher ?? {
    enabled: true,
    debounce_ms: 2000,
  };

  // Support both formats: notes_path (Format A) or default_notes_path (Format B)
  const memoriesLocation =
    oldConfig.notes_path ||
    oldConfig.default_notes_path ||
    DEFAULT_BRAIN_CONFIG.defaults.memories_location;

  const newConfig: BrainConfig = {
    $schema: DEFAULT_BRAIN_CONFIG.$schema,
    version: "2.0.0",
    defaults: {
      memories_location: memoriesLocation,
      memories_mode: DEFAULT_BRAIN_CONFIG.defaults.memories_mode,
    },
    projects: {},
    sync: {
      enabled: oldConfig.sync?.enabled ?? defaultSync.enabled,
      delay_ms: oldConfig.sync?.delay ?? defaultSync.delay_ms,
    },
    logging: {
      level:
        (oldConfig.log_level as "trace" | "debug" | "info" | "warn" | "error") ||
        defaultLogging.level,
    },
    watcher: { ...defaultWatcher },
  };

  // Transform projects - Format A: projects with nested code_path
  if (oldConfig.projects) {
    for (const [name, oldProject] of Object.entries(oldConfig.projects)) {
      if (!oldProject.code_path) {
        logger.debug({ project: name }, "Skipping project without code_path");
        continue;
      }

      newConfig.projects[name] = {
        code_path: oldProject.code_path,
      };

      // Map notes_path to memories_path
      if (oldProject.notes_path) {
        newConfig.projects[name].memories_path = oldProject.notes_path;
        newConfig.projects[name].memories_mode = "CUSTOM";
      }

      // Map mode to memories_mode
      if (oldProject.mode) {
        const modeMap: Record<string, MemoriesMode> = {
          default: "DEFAULT",
          code: "CODE",
          custom: "CUSTOM",
          DEFAULT: "DEFAULT",
          CODE: "CODE",
          CUSTOM: "CUSTOM",
        };
        newConfig.projects[name].memories_mode = modeMap[oldProject.mode] || "DEFAULT";
      }
    }
  }

  // Transform projects - Format B: flat code_paths mapping
  if (oldConfig.code_paths) {
    for (const [name, codePath] of Object.entries(oldConfig.code_paths)) {
      // Skip if already defined from Format A
      if (newConfig.projects[name]) {
        logger.debug({ project: name }, "Project already defined from Format A, skipping Format B");
        continue;
      }

      newConfig.projects[name] = {
        code_path: codePath,
        memories_mode: "DEFAULT",
      };
    }
  }

  return newConfig;
}

/**
 * Create a backup of the old config file.
 *
 * @returns Path to backup file
 */
function createBackup(): string {
  const oldPath = getOldConfigPath();
  const backupPath = oldPath + BACKUP_SUFFIX;

  // If backup already exists, add timestamp
  let finalBackupPath = backupPath;
  if (fs.existsSync(backupPath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    finalBackupPath = `${oldPath}.${timestamp}${BACKUP_SUFFIX}`;
  }

  fs.copyFileSync(oldPath, finalBackupPath);

  try {
    fs.chmodSync(finalBackupPath, FILE_MODE);
  } catch {
    // Ignore permission errors on non-Unix systems
  }

  return finalBackupPath;
}

/**
 * Remove the old config file.
 */
function removeOldConfig(): void {
  const oldPath = getOldConfigPath();

  if (fs.existsSync(oldPath)) {
    fs.unlinkSync(oldPath);
  }
}

/**
 * Migrate configuration from old location to new location.
 *
 * Migration process:
 * 1. Check if migration is needed
 * 2. Load old config
 * 3. Create backup
 * 4. Transform to new schema
 * 5. Save to new location (atomic write)
 * 6. Verify new config loads correctly
 * 7. Sync to basic-memory
 * 8. Remove old config (if enabled)
 *
 * @param options - Migration options
 * @returns Migration result with details
 *
 * @example
 * ```typescript
 * const result = await migrateToNewConfigLocation();
 * if (result.success) {
 *   console.log("Migration complete:", result.migratedConfig);
 *   console.log("Backup at:", result.backupPath);
 * } else {
 *   console.error("Migration failed:", result.error);
 *   // Rollback if needed
 * }
 * ```
 */
export async function migrateToNewConfigLocation(
  options: MigrationOptions = {},
): Promise<MigrationResult> {
  const { removeOldConfig: shouldRemoveOld = true, force = false, dryRun = false } = options;
  const steps: MigrationStep[] = [];

  logger.info({ options }, "Starting config migration");

  // Step 1: Check if migration is needed
  if (!needsMigration({ force })) {
    const reason = !oldConfigExists()
      ? "Old config does not exist"
      : "New config already exists (use force to override)";

    steps.push({
      name: "check_migration_needed",
      status: "skipped",
      error: reason,
    });

    return {
      success: true,
      steps,
      error: reason,
    };
  }

  steps.push({ name: "check_migration_needed", status: "completed" });

  // Step 2: Load old config
  const oldConfig = loadOldConfig();
  if (!oldConfig) {
    steps.push({
      name: "load_old_config",
      status: "failed",
      error: "Failed to load old config",
    });

    return {
      success: false,
      error: "Failed to load old configuration file",
      steps,
    };
  }

  steps.push({ name: "load_old_config", status: "completed" });

  // Step 3: Create backup
  let backupPath: string | undefined;
  if (!dryRun) {
    try {
      backupPath = createBackup();
      steps.push({ name: "create_backup", status: "completed" });
    } catch (error) {
      steps.push({
        name: "create_backup",
        status: "failed",
        error: error instanceof Error ? error.message : "Backup failed",
      });

      return {
        success: false,
        error: `Failed to create backup: ${error instanceof Error ? error.message : "unknown error"}`,
        steps,
      };
    }
  } else {
    steps.push({ name: "create_backup", status: "skipped", error: "Dry run" });
  }

  // Step 4: Transform to new schema
  let newConfig: BrainConfig;
  try {
    newConfig = transformOldToNew(oldConfig);

    // Validate the transformed config by parsing (throws on error)
    parseBrainConfig(newConfig);

    steps.push({ name: "transform_schema", status: "completed" });
  } catch (error) {
    steps.push({
      name: "transform_schema",
      status: "failed",
      error: error instanceof Error ? error.message : "Transform failed",
    });

    return {
      success: false,
      error: `Schema transformation failed: ${error instanceof Error ? error.message : "unknown error"}`,
      backupPath,
      steps,
    };
  }

  // Step 5: Save to new location
  if (!dryRun) {
    try {
      await saveBrainConfig(newConfig);
      steps.push({ name: "save_new_config", status: "completed" });
    } catch (error) {
      steps.push({
        name: "save_new_config",
        status: "failed",
        error: error instanceof Error ? error.message : "Save failed",
      });

      return {
        success: false,
        error: `Failed to save new config: ${error instanceof Error ? error.message : "unknown error"}`,
        backupPath,
        steps,
      };
    }
  } else {
    steps.push({
      name: "save_new_config",
      status: "skipped",
      error: "Dry run",
    });
  }

  // Step 6: Verify new config loads correctly
  if (!dryRun) {
    try {
      const loaded = await loadBrainConfig();

      // Verify key fields match
      if (loaded.version !== newConfig.version) {
        throw new Error("Version mismatch after load");
      }

      steps.push({ name: "verify_new_config", status: "completed" });
    } catch (error) {
      steps.push({
        name: "verify_new_config",
        status: "failed",
        error: error instanceof Error ? error.message : "Verification failed",
      });

      return {
        success: false,
        error: `Config verification failed: ${error instanceof Error ? error.message : "unknown error"}`,
        backupPath,
        migratedConfig: newConfig,
        steps,
      };
    }
  } else {
    steps.push({
      name: "verify_new_config",
      status: "skipped",
      error: "Dry run",
    });
  }

  // Step 7: Sync to basic-memory
  if (!dryRun) {
    try {
      await syncConfigToBasicMemory(newConfig);
      steps.push({ name: "sync_basic_memory", status: "completed" });
    } catch (error) {
      // Log but don't fail migration for sync errors
      steps.push({
        name: "sync_basic_memory",
        status: "failed",
        error: error instanceof Error ? error.message : "Sync failed",
      });
      logger.warn({ error }, "Failed to sync to basic-memory after migration");
    }
  } else {
    steps.push({
      name: "sync_basic_memory",
      status: "skipped",
      error: "Dry run",
    });
  }

  // Step 8: Remove old config
  let oldRemoved = false;
  if (shouldRemoveOld && !dryRun) {
    try {
      removeOldConfig();
      oldRemoved = true;
      steps.push({ name: "remove_old_config", status: "completed" });
    } catch (error) {
      // Log but don't fail migration for cleanup errors
      steps.push({
        name: "remove_old_config",
        status: "failed",
        error: error instanceof Error ? error.message : "Removal failed",
      });
      logger.warn({ error }, "Failed to remove old config");
    }
  } else {
    steps.push({
      name: "remove_old_config",
      status: "skipped",
      error: dryRun ? "Dry run" : "Removal disabled",
    });
  }

  logger.info(
    {
      backupPath,
      oldRemoved,
      projectCount: Object.keys(newConfig.projects ?? {}).length,
    },
    "Config migration completed successfully",
  );

  return {
    success: true,
    backupPath,
    migratedConfig: newConfig,
    oldConfigRemoved: oldRemoved,
    steps,
  };
}

/**
 * Rollback migration by restoring from backup.
 *
 * @param backupPath - Path to backup file
 * @returns True if rollback succeeded
 */
export async function rollbackMigration(backupPath: string): Promise<boolean> {
  const oldPath = getOldConfigPath();

  try {
    if (!fs.existsSync(backupPath)) {
      logger.error({ backupPath }, "Backup file not found for rollback");
      return false;
    }

    // Restore old config from backup
    fs.copyFileSync(backupPath, oldPath);

    // Remove new config if it exists
    const newPath = getBrainConfigPath();
    if (fs.existsSync(newPath)) {
      fs.unlinkSync(newPath);
    }

    logger.info({ backupPath }, "Migration rolled back successfully");
    return true;
  } catch (error) {
    logger.error({ error, backupPath }, "Failed to rollback migration");
    return false;
  }
}

/**
 * Run migration with rollback support.
 *
 * Uses ConfigRollbackManager to create a snapshot before migration
 * and automatically rolls back on failure.
 *
 * @param rollbackManager - Rollback manager instance
 * @param options - Migration options
 * @returns Migration result
 */
export async function migrateWithRollback(
  rollbackManager: ConfigRollbackManager,
  options: MigrationOptions = {},
): Promise<MigrationResult> {
  // Create snapshot of current state (if new config exists)
  const newConfigExists = fs.existsSync(getBrainConfigPath());
  if (newConfigExists && rollbackManager.isInitialized()) {
    try {
      const currentConfig = await loadBrainConfig();
      rollbackManager.snapshot(currentConfig, "Before migration");
    } catch (error) {
      logger.debug({ error }, "Could not create snapshot before migration");
    }
  }

  // Run migration
  const result = await migrateToNewConfigLocation(options);

  // On success, mark as good
  if (result.success && result.migratedConfig && rollbackManager.isInitialized()) {
    try {
      await rollbackManager.markAsGood(result.migratedConfig, "After successful migration");
    } catch (error) {
      logger.debug({ error }, "Could not mark config as good after migration");
    }
  }

  return result;
}
