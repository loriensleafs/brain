/**
 * edit_project tool implementation
 *
 * Edits project metadata including code path and notes path configuration.
 * Notes path supports enum options: DEFAULT, CODE, or absolute path.
 *
 * Security controls (TM-001):
 * - CWE-22: Path traversal prevention via symlink resolution
 * - CWE-59: Symlink attack prevention via parent directory validation
 * - C-002: Symlink resolution before file operations
 * - C-004: Copy-verify-delete pattern for safe migration
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { setCodePath, getCodePath } from "../../../project/config";
import { getBasicMemoryClient } from "../../../proxy/client";
import type { EditProjectArgs, NotesPathOption } from "./schema";

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

const SYSTEM_ROOTS = ["/etc", "/usr", "/var", "/bin", "/sbin", "/tmp", "/proc", "/sys"];

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
function validatePath(targetPath: string, requireExists = true): PathValidationResult {
  const homeDir = os.homedir();

  // Handle non-existent paths (Issue 3: symlink resolution edge case)
  if (!fs.existsSync(targetPath)) {
    if (requireExists) {
      return { valid: false, error: "Path does not exist" };
    }

    // For migration targets: validate parent directory exists and is safe
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      return { valid: false, error: `Parent directory does not exist: ${parentDir}` };
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
function validateResolvedPath(resolved: string, homeDir: string): PathValidationResult {
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
    if (resolved === protectedFull || resolved.startsWith(protectedFull + path.sep)) {
      return { valid: false, error: `Cannot operate on protected path: ${protectedName}` };
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
 * Migrate notes from old location to new location using copy-verify-delete pattern.
 *
 * Security: Implements C-004 from TM-001 threat model.
 * - Copies all files to new location
 * - Verifies file count AND total size match
 * - Only deletes source after successful verification
 * - Automatic rollback on any failure
 *
 * @param oldPath - Source notes directory
 * @param newPath - Destination notes directory
 * @returns Migration result with file count
 */
function migrateNotes(oldPath: string, newPath: string): MigrationResult {
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
      `[WARNING] Large directory migration: ${sourceCount} files. Consider manual migration for better control.`
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
    // Notes are now in new location, old location remains (no data loss)
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
  toolDefinition,
  EditProjectArgsSchema,
  type EditProjectArgs,
  type NotesPathOption,
} from "./schema";

/**
 * Load brain config to get default_notes_path
 */
function getDefaultNotesPath(): string {
  const configPath = path.join(os.homedir(), ".basic-memory", "brain-config.json");
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      return config.default_notes_path || "~/memories";
    }
  } catch {
    // Ignore errors, return default
  }
  return "~/memories";
}

/**
 * Get notes path for a project from basic-memory config
 */
function getNotesPath(project: string): string | null {
  const configPath = path.join(os.homedir(), ".basic-memory", "config.json");
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      if (config.projects && typeof config.projects === "object") {
        return config.projects[project] || null;
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Set notes path for a project in basic-memory config
 */
function setNotesPath(project: string, notesPath: string): void {
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
    let resolved = notesPath;
    if (resolved.startsWith("~")) {
      resolved = path.join(os.homedir(), resolved.slice(1));
    }
    resolved = path.resolve(resolved);

    (config.projects as Record<string, string>)[project] = resolved;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new Error(
      `Failed to update notes path: ${error instanceof Error ? error.message : String(error)}`
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
 * Resolve notes_path option to an actual path
 *
 * @param option - NotesPathOption: 'DEFAULT', 'CODE', or absolute path
 * @param projectName - Project name (for DEFAULT option)
 * @param resolvedCodePath - Resolved code path (for CODE option)
 */
function resolveNotesPathOption(
  option: NotesPathOption,
  projectName: string,
  resolvedCodePath: string
): string {
  if (option === "CODE") {
    return path.join(resolvedCodePath, "docs");
  }

  if (option === "DEFAULT") {
    const defaultNotesPath = getDefaultNotesPath();
    const resolved = resolvePath(defaultNotesPath);
    return path.join(resolved, projectName);
  }

  // Treat as absolute path
  return resolvePath(option);
}

/**
 * Get list of available projects from basic-memory config
 */
async function getAvailableProjects(): Promise<string[]> {
  const configPath = path.join(os.homedir(), ".basic-memory", "config.json");
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      if (config.projects && typeof config.projects === "object") {
        return Object.keys(config.projects);
      }
    }
  } catch {
    // Fall back to listing projects via basic-memory
  }

  // Fallback: use basic-memory client
  try {
    const client = await getBasicMemoryClient();
    const result = await client.callTool({
      name: "list_memory_projects",
      arguments: {},
    });

    if (result.content && Array.isArray(result.content)) {
      for (const item of result.content) {
        if (item.type === "text" && item.text) {
          try {
            const parsed = JSON.parse(item.text);
            if (Array.isArray(parsed)) {
              return parsed;
            } else if (parsed.projects && Array.isArray(parsed.projects)) {
              return parsed.projects;
            }
          } catch {
            return item.text.split("\n").filter((p: string) => p.trim());
          }
        }
      }
    }
  } catch {
    // Return empty if all else fails
  }

  return [];
}

export async function handler(args: EditProjectArgs): Promise<CallToolResult> {
  const { name, code_path, notes_path } = args;

  // Check if project exists in basic-memory
  const currentNotesPath = getNotesPath(name);

  if (!currentNotesPath) {
    const availableProjects = await getAvailableProjects();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: `Project "${name}" does not exist. Use create_project to create it first.`,
              available_projects: availableProjects,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  const updates: string[] = [];
  const oldCodePath = getCodePath(name);
  const resolvedNewCodePath = resolvePath(code_path);

  // Update code path
  setCodePath(name, code_path);
  updates.push(`Set code path: ${resolvedNewCodePath}`);

  // Handle notes_path
  let finalNotesPath = currentNotesPath;
  let notesPathMode: string | null = null;
  let migrationResult: MigrationResult | null = null;

  if (notes_path !== undefined) {
    // Explicit notes_path provided - resolve using enum logic
    finalNotesPath = resolveNotesPathOption(
      notes_path as NotesPathOption,
      name,
      resolvedNewCodePath
    );
    notesPathMode = notes_path === "DEFAULT" || notes_path === "CODE" ? notes_path : "CUSTOM";

    // Check if migration is needed (path changed AND old directory exists)
    const normalizedCurrent = path.resolve(currentNotesPath);
    const normalizedNew = path.resolve(finalNotesPath);

    if (normalizedCurrent !== normalizedNew && fs.existsSync(currentNotesPath)) {
      // Perform migration with copy-verify-delete pattern (C-004)
      migrationResult = migrateNotes(currentNotesPath, finalNotesPath);

      if (!migrationResult.migrated && !migrationResult.error?.includes("Migration complete")) {
        // Migration failed - return error, config not updated
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: `Note migration failed: ${migrationResult.error}`,
                  old_path: currentNotesPath,
                  new_path: finalNotesPath,
                  rollback: "Source notes preserved, no changes made",
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      updates.push(
        `Migrated notes: ${migrationResult.files_moved} files from ${currentNotesPath} to ${finalNotesPath}`
      );
      if (migrationResult.error) {
        // Migration succeeded but with warning (e.g., couldn't delete source)
        updates.push(`Warning: ${migrationResult.error}`);
      }
    }

    setNotesPath(name, finalNotesPath);
    updates.push(`Set notes path: ${finalNotesPath} (${notesPathMode})`);
  } else {
    // notes_path not specified - check for auto-update scenario first
    let autoUpdated = false;

    if (oldCodePath) {
      // Check if notes_path was auto-configured from old code_path (CODE mode)
      const oldDefaultNotesPath = path.join(resolvePath(oldCodePath), "docs");
      if (currentNotesPath === oldDefaultNotesPath) {
        // Auto-update notes_path to new code_path/docs (preserve CODE mode)
        const newDefaultNotesPath = path.join(resolvedNewCodePath, "docs");

        // Check if migration is needed for CODE mode auto-update
        const normalizedCurrent = path.resolve(currentNotesPath);
        const normalizedNew = path.resolve(newDefaultNotesPath);

        if (normalizedCurrent !== normalizedNew && fs.existsSync(currentNotesPath)) {
          // Perform migration with copy-verify-delete pattern (C-004)
          migrationResult = migrateNotes(currentNotesPath, newDefaultNotesPath);

          if (!migrationResult.migrated && !migrationResult.error?.includes("Migration complete")) {
            // Migration failed - return error, config not updated
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      error: `Note migration failed during CODE auto-update: ${migrationResult.error}`,
                      old_path: currentNotesPath,
                      new_path: newDefaultNotesPath,
                      rollback: "Source notes preserved, no changes made",
                    },
                    null,
                    2
                  ),
                },
              ],
              isError: true,
            };
          }

          updates.push(
            `Migrated notes: ${migrationResult.files_moved} files from ${currentNotesPath} to ${newDefaultNotesPath}`
          );
          if (migrationResult.error) {
            updates.push(`Warning: ${migrationResult.error}`);
          }
        }

        setNotesPath(name, newDefaultNotesPath);
        finalNotesPath = newDefaultNotesPath;
        notesPathMode = "CODE (auto-updated)";
        updates.push(`Auto-updated notes path: ${newDefaultNotesPath}`);
        autoUpdated = true;
      }
    }

    // If not auto-updated, default to 'DEFAULT' mode
    if (!autoUpdated) {
      finalNotesPath = resolveNotesPathOption("DEFAULT", name, resolvedNewCodePath);

      // Check if migration is needed for DEFAULT mode
      const normalizedCurrent = path.resolve(currentNotesPath);
      const normalizedNew = path.resolve(finalNotesPath);

      if (normalizedCurrent !== normalizedNew && fs.existsSync(currentNotesPath)) {
        // Perform migration with copy-verify-delete pattern (C-004)
        migrationResult = migrateNotes(currentNotesPath, finalNotesPath);

        if (!migrationResult.migrated && !migrationResult.error?.includes("Migration complete")) {
          // Migration failed - return error, config not updated
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    error: `Note migration failed: ${migrationResult.error}`,
                    old_path: currentNotesPath,
                    new_path: finalNotesPath,
                    rollback: "Source notes preserved, no changes made",
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        updates.push(
          `Migrated notes: ${migrationResult.files_moved} files from ${currentNotesPath} to ${finalNotesPath}`
        );
        if (migrationResult.error) {
          updates.push(`Warning: ${migrationResult.error}`);
        }
      }

      setNotesPath(name, finalNotesPath);
      notesPathMode = "DEFAULT";
      updates.push(`Set notes path: ${finalNotesPath} (${notesPathMode})`);
    }
  }

  // Build response with migration details if applicable
  const response: Record<string, unknown> = {
    project: name,
    updates,
    code_path: getCodePath(name) || null,
    notes_path: finalNotesPath,
    notes_path_mode: notesPathMode,
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
