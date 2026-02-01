/**
 * config_update_global tool implementation
 *
 * Updates global default configuration with optional migration of
 * affected projects (those using DEFAULT mode).
 *
 * @see ADR-020 for configuration architecture
 * @see TASK-020-19 for implementation requirements
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import { loadBrainConfig, saveBrainConfig } from "../../config/brain-config";
import {
  syncConfigToBasicMemory,
  resolveMemoriesPath,
} from "../../config/translation-layer";
import { rollbackManager } from "../../config/rollback";
import {
  detectConfigDiff,
  getDefaultModeAffectedProjects,
} from "../../config/diff";
import type { BrainConfig, MemoriesMode } from "../../config/schema";
import { expandTilde, normalizePath } from "../../config/path-validator";
import type { ConfigUpdateGlobalArgs } from "./schema";
import { getBasicMemoryClient } from "../../proxy/client";

export {
  configUpdateGlobalToolDefinition as toolDefinition,
  ConfigUpdateGlobalArgsSchema,
  type ConfigUpdateGlobalArgs,
} from "./schema";

/**
 * Migration result for a single project.
 */
interface ProjectMigrationResult {
  project: string;
  migrated: boolean;
  files_moved: number;
  old_path: string;
  new_path: string;
  error?: string;
}

/**
 * Count files recursively in a directory.
 */
function countFiles(dirPath: string): number {
  let count = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        count += countFiles(fullPath);
      } else if (entry.isFile()) {
        count++;
      }
    }
  } catch {
    // Directory may not exist or not readable
  }
  return count;
}

/**
 * Get total size of all files in a directory recursively.
 */
function getTotalSize(dirPath: string): number {
  let size = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += getTotalSize(fullPath);
      } else if (entry.isFile()) {
        const stats = fs.statSync(fullPath);
        size += stats.size;
      }
    }
  } catch {
    // Directory may not exist or not readable
  }
  return size;
}

/**
 * Migrate memories using copy-verify-delete pattern.
 */
function migrateMemories(
  project: string,
  oldPath: string,
  newPath: string
): ProjectMigrationResult {
  // Check if source exists
  if (!fs.existsSync(oldPath)) {
    return {
      project,
      migrated: false,
      files_moved: 0,
      old_path: oldPath,
      new_path: newPath,
      error: "Source directory does not exist",
    };
  }

  // Get source metrics
  const sourceCount = countFiles(oldPath);
  const sourceSize = getTotalSize(oldPath);

  // Copy to new location
  try {
    // Ensure parent directory exists
    const parentDir = path.dirname(newPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.cpSync(oldPath, newPath, { recursive: true });
  } catch (copyError) {
    // Rollback: remove partial copy
    if (fs.existsSync(newPath)) {
      try {
        fs.rmSync(newPath, { recursive: true, force: true });
      } catch {
        // Best effort cleanup
      }
    }
    return {
      project,
      migrated: false,
      files_moved: 0,
      old_path: oldPath,
      new_path: newPath,
      error: `Copy failed: ${copyError instanceof Error ? copyError.message : String(copyError)}`,
    };
  }

  // Verify integrity
  const destCount = countFiles(newPath);
  const destSize = getTotalSize(newPath);

  if (sourceCount !== destCount || sourceSize !== destSize) {
    // Rollback
    try {
      fs.rmSync(newPath, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
    return {
      project,
      migrated: false,
      files_moved: 0,
      old_path: oldPath,
      new_path: newPath,
      error: `Verification failed: count ${sourceCount}/${destCount}, size ${sourceSize}/${destSize}`,
    };
  }

  // Delete source
  try {
    fs.rmSync(oldPath, { recursive: true, force: true });
  } catch (deleteError) {
    // Migration succeeded but cleanup failed
    return {
      project,
      migrated: true,
      files_moved: sourceCount,
      old_path: oldPath,
      new_path: newPath,
      error: `Cleanup failed: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`,
    };
  }

  return {
    project,
    migrated: true,
    files_moved: sourceCount,
    old_path: oldPath,
    new_path: newPath,
  };
}

/**
 * Rollback migrations that were performed.
 */
function rollbackMigrations(results: ProjectMigrationResult[]): void {
  for (const result of results) {
    if (result.migrated && fs.existsSync(result.new_path)) {
      try {
        // Move back to original location
        fs.cpSync(result.new_path, result.old_path, { recursive: true });
        fs.rmSync(result.new_path, { recursive: true, force: true });
      } catch {
        // Best effort rollback
      }
    }
  }
}

/**
 * Resolve path with tilde expansion.
 */
function resolvePath(inputPath: string): string {
  const expanded = expandTilde(inputPath);
  return normalizePath(expanded);
}

/**
 * Handler for config_update_global tool.
 */
export async function handler(args: ConfigUpdateGlobalArgs): Promise<CallToolResult> {
  const { memories_location, memories_mode, migrate_affected = true } = args;

  // Validate at least one update is provided
  if (!memories_location && !memories_mode) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: "At least one of memories_location or memories_mode must be provided",
              usage: [
                "config_update_global with memories_location='~/brain-memories'",
                "config_update_global with memories_mode='CODE'",
              ],
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  try {
    // Load current config
    const oldConfig = await loadBrainConfig();

    // Create snapshot before modification
    if (rollbackManager.isInitialized()) {
      rollbackManager.snapshot(oldConfig, "Before config_update_global");
    }

    // Build new config
    const newConfig: BrainConfig = structuredClone(oldConfig);

    if (memories_location) {
      newConfig.defaults.memories_location = resolvePath(memories_location);
    }

    if (memories_mode) {
      newConfig.defaults.memories_mode = memories_mode;
    }

    // Detect diff
    const diff = detectConfigDiff(oldConfig, newConfig);

    // Get affected projects (those using DEFAULT mode)
    const affectedProjects = getDefaultModeAffectedProjects(diff, oldConfig, newConfig);

    // Perform migrations if needed
    const migrationResults: ProjectMigrationResult[] = [];
    let migrationFailed = false;

    if (migrate_affected && affectedProjects.length > 0 && memories_location) {
      for (const projectName of affectedProjects) {
        const projectConfig = oldConfig.projects[projectName];

        // Resolve old and new paths
        const oldResolved = resolveMemoriesPath(
          projectName,
          projectConfig,
          oldConfig.defaults.memories_location
        );

        const newResolved = resolveMemoriesPath(
          projectName,
          projectConfig,
          newConfig.defaults.memories_location
        );

        if (oldResolved.path && newResolved.path && oldResolved.path !== newResolved.path) {
          const result = migrateMemories(projectName, oldResolved.path, newResolved.path);
          migrationResults.push(result);

          // Check for failure (ignore cleanup failures)
          if (!result.migrated && !result.error?.includes("Cleanup failed") && !result.error?.includes("does not exist")) {
            migrationFailed = true;
            break;
          }
        }
      }

      // If any migration failed, rollback all and restore config
      if (migrationFailed) {
        rollbackMigrations(migrationResults);

        if (rollbackManager.isInitialized()) {
          await rollbackManager.rollback("lastKnownGood");
        }

        const failedResult = migrationResults.find(
          (r) => !r.migrated && !r.error?.includes("Cleanup failed") && !r.error?.includes("does not exist")
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: `Migration failed for project: ${failedResult?.project}`,
                  details: failedResult?.error,
                  rollback: "All changes reverted",
                  partial_results: migrationResults,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }

    // Save updated config
    await saveBrainConfig(newConfig);

    // Sync to basic-memory
    await syncConfigToBasicMemory(newConfig);

    // Mark as good after successful update
    if (rollbackManager.isInitialized()) {
      await rollbackManager.markAsGood(newConfig, "After config_update_global");
    }

    // Build response
    const response: Record<string, unknown> = {
      success: true,
      old_defaults: oldConfig.defaults,
      new_defaults: newConfig.defaults,
      affected_projects: affectedProjects,
    };

    if (migrationResults.length > 0) {
      const successful = migrationResults.filter((r) => r.migrated);
      const skipped = migrationResults.filter(
        (r) => !r.migrated && r.error?.includes("does not exist")
      );

      response.migration = {
        total_affected: affectedProjects.length,
        migrated: successful.length,
        skipped: skipped.length,
        total_files_moved: successful.reduce((sum, r) => sum + r.files_moved, 0),
        details: migrationResults.map((r) => ({
          project: r.project,
          status: r.migrated ? "migrated" : "skipped",
          files_moved: r.files_moved,
          old_path: r.old_path,
          new_path: r.new_path,
          note: r.error,
        })),
      };
    } else if (affectedProjects.length > 0 && !migrate_affected) {
      response.migration = {
        performed: false,
        reason: "Migration disabled (migrate_affected=false)",
        affected_projects: affectedProjects,
        warning:
          "Projects using DEFAULT mode may have broken paths. Use migrate_agents tool to migrate manually.",
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  } catch (error) {
    // Attempt rollback on error
    if (rollbackManager.isInitialized()) {
      await rollbackManager.rollback("lastKnownGood");
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: `Failed to update global config: ${error instanceof Error ? error.message : String(error)}`,
              rollback: "Config restored to previous state if possible",
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
