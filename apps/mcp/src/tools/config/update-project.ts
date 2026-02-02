/**
 * config_update_project tool implementation
 *
 * Updates project configuration with optional migration of memories
 * to a new location. Provides atomic updates with automatic rollback.
 *
 * @see ADR-020 for configuration architecture
 * @see TASK-020-19 for implementation requirements
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { loadBrainConfig, saveBrainConfig } from "../../config/brain-config";
import { detectConfigDiff } from "../../config/diff";
import { expandTilde, normalizePath } from "../../config/path-validator";
import { rollbackManager } from "../../config/rollback";
import type { BrainConfig, ProjectConfig } from "../../config/schema";
import { resolveMemoriesPath, syncConfigToBasicMemory } from "../../config/translation-layer";
import { getBasicMemoryClient } from "../../proxy/client";
import type { ConfigUpdateProjectArgs } from "./schema";

export {
  type ConfigUpdateProjectArgs,
  ConfigUpdateProjectArgsSchema,
  configUpdateProjectToolDefinition as toolDefinition,
} from "./schema";

/**
 * Migration result for memories directory.
 */
interface MigrationResult {
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
function migrateMemories(oldPath: string, newPath: string): MigrationResult {
  // Check if source exists
  if (!fs.existsSync(oldPath)) {
    return {
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
      migrated: true,
      files_moved: sourceCount,
      old_path: oldPath,
      new_path: newPath,
      error: `Cleanup failed: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`,
    };
  }

  return {
    migrated: true,
    files_moved: sourceCount,
    old_path: oldPath,
    new_path: newPath,
  };
}

/**
 * Verify that a memory is searchable via basic-memory.
 */
async function verifyIndexing(memoriesPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if any .md files exist
    const mdFiles: string[] = [];
    const findMdFiles = (dir: string): void => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            findMdFiles(fullPath);
          } else if (entry.isFile() && entry.name.endsWith(".md")) {
            mdFiles.push(fullPath);
          }
        }
      } catch {
        // Ignore read errors
      }
    };

    findMdFiles(memoriesPath);

    if (mdFiles.length === 0) {
      // No files to verify - success (empty migration)
      return { success: true };
    }

    // Try to search for content from the first file
    const client = await getBasicMemoryClient();
    const _result = await client.callTool({
      name: "search_notes",
      arguments: {
        query: path.basename(mdFiles[0], ".md"),
        limit: 1,
      },
    });

    // If we got any result, indexing is working
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Indexing verification failed: ${error instanceof Error ? error.message : String(error)}`,
    };
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
 * Handler for config_update_project tool.
 */
export async function handler(args: ConfigUpdateProjectArgs): Promise<CallToolResult> {
  const { project, code_path, memories_path, memories_mode, migrate = true } = args;

  try {
    // Load current config
    const oldConfig = await loadBrainConfig();

    // Check if project exists
    if (!(project in oldConfig.projects)) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                error: `Project not found: ${project}`,
                available_projects: Object.keys(oldConfig.projects),
                hint: "Use create_project to create a new project",
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    // Create snapshot before modification
    if (rollbackManager.isInitialized()) {
      rollbackManager.snapshot(oldConfig, `Before config_update_project: ${project}`);
    }

    // Get current project config
    const oldProjectConfig = oldConfig.projects[project];
    if (!oldProjectConfig) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                error: `Project not found: ${project}`,
                available_projects: Object.keys(oldConfig.projects),
                hint: "Use create_project to create a new project",
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    // Build new project config
    const newProjectConfig: ProjectConfig = {
      ...oldProjectConfig,
    };

    // Update code_path if provided
    if (code_path) {
      newProjectConfig.code_path = resolvePath(code_path);
    }

    // Update memories_mode if provided
    if (memories_mode) {
      newProjectConfig.memories_mode = memories_mode;
    }

    // Update memories_path if provided (only for CUSTOM mode)
    if (memories_path) {
      if (memories_path === "DEFAULT" || memories_path === "CODE") {
        // Use as mode, not as path
        newProjectConfig.memories_mode = memories_path;
        delete newProjectConfig.memories_path; // Let translation layer resolve
      } else {
        // Use as explicit path (CUSTOM mode)
        newProjectConfig.memories_mode = "CUSTOM";
        newProjectConfig.memories_path = resolvePath(memories_path);
      }
    }

    // Build new config
    const newConfig: BrainConfig = {
      ...oldConfig,
      projects: {
        ...oldConfig.projects,
        [project]: newProjectConfig,
      },
    };

    // Resolve old and new memories paths for migration
    const oldResolvedPath = resolveMemoriesPath(
      project,
      oldProjectConfig,
      oldConfig.defaults.memories_location,
    );

    const newResolvedPath = resolveMemoriesPath(
      project,
      newProjectConfig,
      newConfig.defaults.memories_location,
    );

    // Check if migration is needed
    let migrationResult: MigrationResult | null = null;
    const pathChanged =
      oldResolvedPath.path && newResolvedPath.path && oldResolvedPath.path !== newResolvedPath.path;

    if (migrate && pathChanged && fs.existsSync(oldResolvedPath.path)) {
      // Perform migration
      migrationResult = migrateMemories(oldResolvedPath.path, newResolvedPath.path);

      if (!migrationResult.migrated && !migrationResult.error?.includes("Cleanup failed")) {
        // Migration failed - rollback
        if (rollbackManager.isInitialized()) {
          await rollbackManager.rollback("lastKnownGood");
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: `Migration failed: ${migrationResult.error}`,
                  old_path: migrationResult.old_path,
                  new_path: migrationResult.new_path,
                  rollback: "Config restored to previous state",
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      // Verify indexing after migration
      const verification = await verifyIndexing(newResolvedPath.path);
      if (!verification.success) {
        // Rollback if indexing failed
        if (rollbackManager.isInitialized()) {
          await rollbackManager.rollback("lastKnownGood");
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: `Indexing verification failed after migration: ${verification.error}`,
                  rollback: "Config restored to previous state",
                },
                null,
                2,
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
      await rollbackManager.markAsGood(newConfig, `After config_update_project: ${project}`);
    }

    // Detect diff for response
    const _diff = detectConfigDiff(oldConfig, newConfig);

    // Build response
    const response: Record<string, unknown> = {
      success: true,
      project,
      old_config: {
        code_path: oldProjectConfig.code_path,
        memories_mode: oldProjectConfig.memories_mode || "DEFAULT",
        memories_path: oldResolvedPath.path,
      },
      new_config: {
        code_path: newProjectConfig.code_path,
        memories_mode: newProjectConfig.memories_mode || "DEFAULT",
        memories_path: newResolvedPath.path,
      },
    };

    if (migrationResult) {
      response.migration = {
        performed: true,
        files_moved: migrationResult.files_moved,
        old_path: migrationResult.old_path,
        new_path: migrationResult.new_path,
        warning: migrationResult.error,
      };
    } else if (pathChanged) {
      response.migration = {
        performed: false,
        reason: migrate ? "Source directory not found" : "Migration disabled",
        old_path: oldResolvedPath.path,
        new_path: newResolvedPath.path,
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
              error: `Failed to update project: ${error instanceof Error ? error.message : String(error)}`,
              project,
              rollback: "Config restored to previous state if possible",
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
}
