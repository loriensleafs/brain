/**
 * delete_project tool implementation
 *
 * Two-stage deletion with security controls:
 * - Stage 1: Remove from config files (reversible)
 * - Stage 2: Delete notes directory (irreversible, only if delete_notes=true)
 *
 * Security controls:
 * - C-001: Path validation (project name and notes path)
 * - C-002: Symlink resolution before deletion
 * - C-003: Protected path blocklist
 * - H-001: Config locking with retry
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  getCodePath,
  getCodePaths,
  removeCodePath,
} from "../../../project/config";
import { logger } from "../../../utils/internal/logger";
import { withConfigLockSync } from "../../../utils/security/configLock";
import {
  validateDeleteOperation,
  validateProjectName,
} from "../../../utils/security/pathValidation";
import type { DeleteProjectArgs } from "./schema";

export {
  type DeleteProjectArgs,
  DeleteProjectArgsSchema,
  toolDefinition,
} from "./schema";

/**
 * Path to basic-memory config file
 */
const BASIC_MEMORY_CONFIG_PATH = path.join(
  os.homedir(),
  ".basic-memory",
  "config.json",
);

/**
 * Get notes path for a project from basic-memory config
 */
function getNotesPath(project: string): string | null {
  try {
    if (fs.existsSync(BASIC_MEMORY_CONFIG_PATH)) {
      const content = fs.readFileSync(BASIC_MEMORY_CONFIG_PATH, "utf-8");
      const config = JSON.parse(content);
      if (config.projects && typeof config.projects === "object") {
        return config.projects[project] || null;
      }
    }
  } catch (error) {
    logger.warn({ error, project }, "Failed to read notes path from config");
  }
  return null;
}

/**
 * Remove notes path for a project from basic-memory config
 */
function removeNotesPath(project: string): boolean {
  try {
    if (fs.existsSync(BASIC_MEMORY_CONFIG_PATH)) {
      const content = fs.readFileSync(BASIC_MEMORY_CONFIG_PATH, "utf-8");
      const config = JSON.parse(content);

      if (
        config.projects &&
        typeof config.projects === "object" &&
        project in config.projects
      ) {
        delete config.projects[project];
        fs.writeFileSync(
          BASIC_MEMORY_CONFIG_PATH,
          JSON.stringify(config, null, 2),
        );
        logger.info({ project }, "Removed notes path from basic-memory config");
        return true;
      }
    }
  } catch (error) {
    logger.error({ error, project }, "Failed to remove notes path from config");
    throw new Error(
      `Failed to update config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return false;
}

/**
 * Get list of all available projects for error messages
 */
function getAvailableProjects(): string[] {
  const codePaths = getCodePaths();
  return Object.keys(codePaths);
}

/**
 * Count files recursively in a directory
 */
function countFiles(dirPath: string): number {
  let count = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        count += countFiles(fullPath);
      } else {
        count++;
      }
    }
  } catch {
    // Ignore errors (permission issues, etc.)
  }
  return count;
}

export async function handler(
  args: DeleteProjectArgs,
): Promise<CallToolResult> {
  const { project, delete_notes = false } = args;

  // FIRST: Validate project name for security (C-001)
  // This must happen BEFORE any config lookups to prevent injection attacks
  const nameValidation = validateProjectName(project);
  if (!nameValidation.valid) {
    logger.warn(
      { project, error: nameValidation.error },
      "Project name validation failed",
    );
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: `Security validation failed: ${nameValidation.error}`,
              project,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }

  // Get current paths before deletion for response
  const notesPath = getNotesPath(project);
  const codePath = getCodePath(project);

  // Check if project exists
  if (!notesPath && !codePath) {
    const availableProjects = getAvailableProjects();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: `Project "${project}" not found`,
              available_projects: availableProjects,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }

  // Validate paths for deletion (C-002, C-003)
  const validation = validateDeleteOperation(project, notesPath, delete_notes);
  if (!validation.valid) {
    logger.warn(
      { project, notesPath, delete_notes, error: validation.error },
      "Delete operation validation failed",
    );
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: `Security validation failed: ${validation.error}`,
              project,
              memories_path: notesPath,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }

  // Use config locking for concurrent safety (H-001)
  try {
    const result = withConfigLockSync(() => {
      // Stage 1: Config cleanup (reversible)
      let brainConfigRemoved = false;
      let basicMemoryConfigRemoved = false;

      // Remove from brain-config.json
      if (codePath) {
        brainConfigRemoved = removeCodePath(project);
      }

      // Remove from basic-memory config.json
      if (notesPath) {
        basicMemoryConfigRemoved = removeNotesPath(project);
      }

      logger.info(
        { project, brainConfigRemoved, basicMemoryConfigRemoved },
        "Stage 1 complete: Config entries removed",
      );

      // Stage 2: File deletion (irreversible, only if requested)
      let notesDeleted = false;
      let filesRemoved = 0;

      if (delete_notes && notesPath && fs.existsSync(notesPath)) {
        // Count files before deletion for reporting
        filesRemoved = countFiles(notesPath);

        try {
          fs.rmSync(notesPath, { recursive: true, force: true });
          notesDeleted = true;
          logger.info(
            { project, notesPath, filesRemoved },
            "Stage 2 complete: Notes directory deleted",
          );
        } catch (error) {
          // File deletion failed - config is already removed
          // This is a partial success state
          logger.error(
            { error, project, notesPath },
            "Stage 2 failed: Notes directory deletion failed",
          );
          return {
            partial: true,
            config_removed: brainConfigRemoved || basicMemoryConfigRemoved,
            notes_deleted: false,
            memories_path: notesPath,
            error: `Config removed but file deletion failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }

      return {
        partial: false,
        config_removed: brainConfigRemoved || basicMemoryConfigRemoved,
        notes_deleted: notesDeleted,
        files_removed: filesRemoved,
      };
    });

    // Handle partial success
    if (result.partial) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                warning:
                  "Partial deletion - config removed but file deletion failed",
                project,
                deleted_config: result.config_removed,
                deleted_notes: false,
                memories_path: notesPath,
                error: result.error,
                recovery:
                  "Notes directory still exists at the path above. You can manually delete it or recreate the project config.",
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    // Full success
    const response = {
      project,
      deleted_config: result.config_removed,
      deleted_notes: result.notes_deleted,
      memories_path: notesPath,
      code_path: codePath,
      ...(result.notes_deleted && { files_removed: result.files_removed }),
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error({ error, project }, "Delete operation failed");
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: `Delete operation failed: ${error instanceof Error ? error.message : String(error)}`,
              project,
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
