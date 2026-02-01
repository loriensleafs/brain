/**
 * edit_project tool implementation
 *
 * Edits project metadata including code path and memories path configuration.
 * Memories path supports enum options: DEFAULT, CODE, or absolute path.
 *
 * Security controls (TM-001):
 * - CWE-22: Path traversal prevention via symlink resolution
 * - CWE-59: Symlink attack prevention via parent directory validation
 * - C-002: Symlink resolution before file operations
 * - C-004: Copy-verify-delete pattern for safe migration
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getProjectMemoriesPath, ProjectNotFoundError } from "@brain/utils";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getDefaultMemoriesLocation } from "../../../config/brain-config";
import { getCodePath, setCodePath } from "../../../project/config";
import type { EditProjectArgs, MemoriesPathOption } from "./schema";

// ============================================================================
// Path Validation Utilities (Security: CWE-22, CWE-59)
// ============================================================================

/**
 * Protected paths that must never be deleted or modified.
 */
const PROTECTED_PATHS = [
  ".ssh",
  ".gnupg",
  ".config",
  ".local",
  "Library", // macOS
  "AppData", // Windows
];

const SYSTEM_ROOTS = [
  "/etc",
  "/usr",
  "/var",
  "/bin",
  "/sbin",
  "/tmp",
  "/proc",
  "/sys",
];

/**
 * Validation result for path operations.
 */
interface PathValidationResult {
  valid: boolean;
  error?: string;
  resolvedPath?: string;
}

/**
 * Validate a path for safe deletion/migration operations.
 * Resolves symlinks and checks against protected paths.
 *
 * Security: CWE-59 - Handles symlink attacks by resolving to real path.
 * Issue 3 Fix: For non-existent paths, validates parent directory instead.
 *
 * @param targetPath - Path to validate
 * @param requireExists - If false, allows validation of non-existent paths (for migration targets)
 * @returns Validation result with resolved path
 */
function validatePath(
  targetPath: string,
  requireExists = true,
): PathValidationResult {
  const homeDir = os.homedir();

  // Handle non-existent paths (Issue 3: symlink resolution edge case)
  if (!fs.existsSync(targetPath)) {
    if (requireExists) {
      return { valid: false, error: "Path does not exist" };
    }

    // For migration targets: validate parent directory exists and is safe
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      return {
        valid: false,
        error: `Parent directory does not exist: ${parentDir}`,
      };
    }

    // Resolve parent symlinks to validate the real location
    let resolvedParent: string;
    try {
      resolvedParent = fs.realpathSync(parentDir);
    } catch {
      return { valid: false, error: "Failed to resolve parent directory path" };
    }

    // Validate parent is not a protected location
    const validationResult = validateResolvedPath(resolvedParent, homeDir);
    if (!validationResult.valid) {
      return validationResult;
    }

    // Return the resolved target path (parent resolved + basename)
    return {
      valid: true,
      resolvedPath: path.join(resolvedParent, path.basename(targetPath)),
    };
  }

  // Path exists - resolve symlinks to get real path
  let resolved: string;
  try {
    resolved = fs.realpathSync(targetPath);
  } catch {
    return { valid: false, error: "Failed to resolve path (broken symlink?)" };
  }

  return validateResolvedPath(resolved, homeDir);
}

/**
 * Validate a resolved (real) path against security constraints.
 */
function validateResolvedPath(
  resolved: string,
  homeDir: string,
): PathValidationResult {
  // Check against system roots
  for (const root of SYSTEM_ROOTS) {
    if (resolved.startsWith(root + path.sep) || resolved === root) {
      return { valid: false, error: `Cannot operate on system path: ${root}` };
    }
  }

  // Cannot be home directory itself
  if (resolved === homeDir) {
    return { valid: false, error: "Cannot operate on user home directory" };
  }

  // Check against protected paths under home
  for (const protectedName of PROTECTED_PATHS) {
    const protectedFull = path.join(homeDir, protectedName);
    if (
      resolved === protectedFull ||
      resolved.startsWith(protectedFull + path.sep)
    ) {
      return {
        valid: false,
        error: `Cannot operate on protected path: ${protectedName}`,
      };
    }
  }

  return { valid: true, resolvedPath: resolved };
}

// ============================================================================
// Migration Utilities (Security: C-004 Copy-Verify-Delete)
// ============================================================================

/**
 * Result of a note migration operation.
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
 * Large directory threshold for performance warning.
 */
const LARGE_DIRECTORY_THRESHOLD = 1000;

/**
 * Migrate memories from old location to new location using copy-verify-delete pattern.
 *
 * Security: Implements C-004 from TM-001 threat model.
 * - Copies all files to new location
 * - Verifies file count AND total size match
 * - Only deletes source after successful verification
 * - Automatic rollback on any failure
 *
 * @param oldPath - Source memories directory
 * @param newPath - Destination memories directory
 * @returns Migration result with file count
 */
function migrateMemories(oldPath: string, newPath: string): MigrationResult {
  // Validate source path (must exist)
  const oldValidation = validatePath(oldPath, true);
  if (!oldValidation.valid) {
    return {
      migrated: false,
      files_moved: 0,
      old_path: oldPath,
      new_path: newPath,
      error: `Source validation failed: ${oldValidation.error}`,
    };
  }

  // Validate destination path (may not exist yet - Issue 3)
  const newValidation = validatePath(newPath, false);
  if (!newValidation.valid) {
    return {
      migrated: false,
      files_moved: 0,
      old_path: oldPath,
      new_path: newPath,
      error: `Destination validation failed: ${newValidation.error}`,
    };
  }

  // Get source metrics before copy
  const sourceCount = countFiles(oldPath);
  const sourceSize = getTotalSize(oldPath);

  // Log warning for large directories (M-002 from threat model)
  if (sourceCount > LARGE_DIRECTORY_THRESHOLD) {
    console.warn(
      `[WARNING] Large directory migration: ${sourceCount} files. Consider manual migration for better control.`,
    );
  }

  // Step 1: Copy to new location
  try {
    fs.cpSync(oldPath, newPath, { recursive: true });
  } catch (copyError) {
    // Rollback: remove partial copy if it exists
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

  // Step 2: Verify integrity (dual-check: file count + total size)
  const destCount = countFiles(newPath);
  const destSize = getTotalSize(newPath);

  if (sourceCount !== destCount) {
    // Rollback: remove failed copy
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
      error: `Verification failed: file count mismatch (${sourceCount} source vs ${destCount} destination)`,
    };
  }

  if (sourceSize !== destSize) {
    // Rollback: remove failed copy
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
      error: `Verification failed: size mismatch (${sourceSize} bytes source vs ${destSize} bytes destination)`,
    };
  }

  // Step 3: Delete source (only after successful verification)
  try {
    fs.rmSync(oldPath, { recursive: true, force: true });
  } catch (deleteError) {
    // Migration succeeded but cleanup failed - this is acceptable
    // Memories are now in new location, old location remains (no data loss)
    return {
      migrated: true,
      files_moved: sourceCount,
      old_path: oldPath,
      new_path: newPath,
      error: `Migration complete but failed to delete source: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`,
    };
  }

  return {
    migrated: true,
    files_moved: sourceCount,
    old_path: oldPath,
    new_path: newPath,
  };
}

// ============================================================================
// Configuration Utilities
// ============================================================================

export {
  type EditProjectArgs,
  EditProjectArgsSchema,
  type MemoriesPathOption,
  toolDefinition,
} from "./schema";

// getDefaultMemoriesLocation is imported from ../../../config/brain-config

/**
 * Get existing memories path for a project, returning null if not found
 */
async function _getExistingMemoriesPath(
  project: string,
): Promise<string | null> {
  try {
    return await getProjectMemoriesPath(project);
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return null;
    }
    throw error;
  }
}

/**
 * Set memories path for a project in basic-memory config
 */
function setMemoriesPath(project: string, memoriesPath: string): void {
  const configPath = path.join(os.homedir(), ".basic-memory", "config.json");
  try {
    let config: Record<string, unknown> = {};
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      config = JSON.parse(content);
    }

    if (!config.projects || typeof config.projects !== "object") {
      config.projects = {};
    }

    // Expand ~ and resolve to absolute path
    let resolved = memoriesPath;
    if (resolved.startsWith("~")) {
      resolved = path.join(os.homedir(), resolved.slice(1));
    }
    resolved = path.resolve(resolved);

    (config.projects as Record<string, string>)[project] = resolved;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new Error(
      `Failed to update memories path: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Resolve a path, expanding ~ and making it absolute
 */
function resolvePath(inputPath: string): string {
  let resolved = inputPath;
  if (resolved.startsWith("~")) {
    resolved = path.join(os.homedir(), resolved.slice(1));
  }
  return path.resolve(resolved);
}

/**
 * Resolve memories_path option to an actual path
 *
 * @param option - MemoriesPathOption: 'DEFAULT', 'CODE', or absolute path
 * @param projectName - Project name (for DEFAULT option)
 * @param resolvedCodePath - Resolved code path (for CODE option)
 */
function resolveMemoriesPathOption(
  option: MemoriesPathOption,
  projectName: string,
  resolvedCodePath: string,
): string {
  if (option === "CODE") {
    return path.join(resolvedCodePath, "docs");
  }

  if (option === "DEFAULT") {
    const defaultMemoriesPath = getDefaultMemoriesLocation();
    const resolved = resolvePath(defaultMemoriesPath);
    return path.join(resolved, projectName);
  }

  // Treat as absolute path
  return resolvePath(option);
}

export async function handler(args: EditProjectArgs): Promise<CallToolResult> {
  const { name, code_path, memories_path } = args;

  // Check if project exists in basic-memory
  let currentMemoriesPath: string;
  try {
    currentMemoriesPath = await getProjectMemoriesPath(name);
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                error: `Project "${name}" does not exist. Use create_project to create it first.`,
                available_projects: error.availableProjects,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }
    throw error;
  }

  const updates: string[] = [];
  const oldCodePath = getCodePath(name);
  const resolvedNewCodePath = resolvePath(code_path);

  // Update code path
  setCodePath(name, code_path);
  updates.push(`Set code path: ${resolvedNewCodePath}`);

  // Handle memories_path
  let finalMemoriesPath = currentMemoriesPath;
  let memoriesPathMode: string | null = null;
  let migrationResult: MigrationResult | null = null;

  if (memories_path !== undefined) {
    // Explicit memories_path provided - resolve using enum logic
    finalMemoriesPath = resolveMemoriesPathOption(
      memories_path as MemoriesPathOption,
      name,
      resolvedNewCodePath,
    );
    memoriesPathMode =
      memories_path === "DEFAULT" || memories_path === "CODE"
        ? memories_path
        : "CUSTOM";

    // Check if migration is needed (path changed AND old directory exists)
    const normalizedCurrent = path.resolve(currentMemoriesPath);
    const normalizedNew = path.resolve(finalMemoriesPath);

    if (
      normalizedCurrent !== normalizedNew &&
      fs.existsSync(currentMemoriesPath)
    ) {
      // Perform migration with copy-verify-delete pattern (C-004)
      migrationResult = migrateMemories(currentMemoriesPath, finalMemoriesPath);

      if (
        !migrationResult.migrated &&
        !migrationResult.error?.includes("Migration complete")
      ) {
        // Migration failed - return error, config not updated
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: `Memories migration failed: ${migrationResult.error}`,
                  old_path: currentMemoriesPath,
                  new_path: finalMemoriesPath,
                  rollback: "Source memories preserved, no changes made",
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      updates.push(
        `Migrated memories: ${migrationResult.files_moved} files from ${currentMemoriesPath} to ${finalMemoriesPath}`,
      );
      if (migrationResult.error) {
        // Migration succeeded but with warning (e.g., couldn't delete source)
        updates.push(`Warning: ${migrationResult.error}`);
      }
    }

    setMemoriesPath(name, finalMemoriesPath);
    updates.push(
      `Set memories path: ${finalMemoriesPath} (${memoriesPathMode})`,
    );
  } else {
    // memories_path not specified - check for auto-update scenario first
    let autoUpdated = false;

    if (oldCodePath) {
      // Check if memories_path was auto-configured from old code_path (CODE mode)
      const oldDefaultMemoriesPath = path.join(
        resolvePath(oldCodePath),
        "docs",
      );
      if (currentMemoriesPath === oldDefaultMemoriesPath) {
        // Auto-update memories_path to new code_path/docs (preserve CODE mode)
        const newDefaultMemoriesPath = path.join(resolvedNewCodePath, "docs");

        // Check if migration is needed for CODE mode auto-update
        const normalizedCurrent = path.resolve(currentMemoriesPath);
        const normalizedNew = path.resolve(newDefaultMemoriesPath);

        if (
          normalizedCurrent !== normalizedNew &&
          fs.existsSync(currentMemoriesPath)
        ) {
          // Perform migration with copy-verify-delete pattern (C-004)
          migrationResult = migrateMemories(
            currentMemoriesPath,
            newDefaultMemoriesPath,
          );

          if (
            !migrationResult.migrated &&
            !migrationResult.error?.includes("Migration complete")
          ) {
            // Migration failed - return error, config not updated
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      error: `Memories migration failed during CODE auto-update: ${migrationResult.error}`,
                      old_path: currentMemoriesPath,
                      new_path: newDefaultMemoriesPath,
                      rollback: "Source memories preserved, no changes made",
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }

          updates.push(
            `Migrated memories: ${migrationResult.files_moved} files from ${currentMemoriesPath} to ${newDefaultMemoriesPath}`,
          );
          if (migrationResult.error) {
            updates.push(`Warning: ${migrationResult.error}`);
          }
        }

        setMemoriesPath(name, newDefaultMemoriesPath);
        finalMemoriesPath = newDefaultMemoriesPath;
        memoriesPathMode = "CODE (auto-updated)";
        updates.push(`Auto-updated memories path: ${newDefaultMemoriesPath}`);
        autoUpdated = true;
      }
    }

    // If not auto-updated, default to 'DEFAULT' mode
    if (!autoUpdated) {
      finalMemoriesPath = resolveMemoriesPathOption(
        "DEFAULT",
        name,
        resolvedNewCodePath,
      );

      // Check if migration is needed for DEFAULT mode
      const normalizedCurrent = path.resolve(currentMemoriesPath);
      const normalizedNew = path.resolve(finalMemoriesPath);

      if (
        normalizedCurrent !== normalizedNew &&
        fs.existsSync(currentMemoriesPath)
      ) {
        // Perform migration with copy-verify-delete pattern (C-004)
        migrationResult = migrateMemories(
          currentMemoriesPath,
          finalMemoriesPath,
        );

        if (
          !migrationResult.migrated &&
          !migrationResult.error?.includes("Migration complete")
        ) {
          // Migration failed - return error, config not updated
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    error: `Memories migration failed: ${migrationResult.error}`,
                    old_path: currentMemoriesPath,
                    new_path: finalMemoriesPath,
                    rollback: "Source memories preserved, no changes made",
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }

        updates.push(
          `Migrated memories: ${migrationResult.files_moved} files from ${currentMemoriesPath} to ${finalMemoriesPath}`,
        );
        if (migrationResult.error) {
          updates.push(`Warning: ${migrationResult.error}`);
        }
      }

      setMemoriesPath(name, finalMemoriesPath);
      memoriesPathMode = "DEFAULT";
      updates.push(
        `Set memories path: ${finalMemoriesPath} (${memoriesPathMode})`,
      );
    }
  }

  // Build response with migration details if applicable
  const response: Record<string, unknown> = {
    project: name,
    updates,
    code_path: getCodePath(name) || null,
    memories_path: finalMemoriesPath,
    memories_path_mode: memoriesPathMode,
  };

  // Include migration details in response
  if (migrationResult?.migrated) {
    response.migration = {
      migrated: true,
      files_moved: migrationResult.files_moved,
      old_path: migrationResult.old_path,
      new_path: migrationResult.new_path,
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
}
