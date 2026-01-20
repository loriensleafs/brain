/**
 * Path validation utilities for secure file operations.
 *
 * Security controls:
 * - CWE-22: Path traversal prevention
 * - CWE-59: Symlink attack prevention
 *
 * @module utils/security/pathValidation
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface PathValidationResult {
  valid: boolean;
  error?: string;
  resolvedPath?: string;
}

/**
 * Protected paths under user home directory that must never be deleted.
 * Expanded per critic review to include cloud credentials.
 */
const PROTECTED_HOME_PATHS = [
  // Security credentials
  ".ssh",
  ".gnupg",
  ".aws",
  ".kube",
  ".azure",
  ".gcloud",

  // Configuration
  ".config",
  ".local",

  // macOS
  "Library",
  ".Trash",

  // Windows
  "AppData",
  "Application Data",
  "Local Settings",

  // User directories (expanded per critic review)
  "Documents",
  "Desktop",
  "Downloads",
  "Pictures",
  "Music",
  "Videos",
];

/**
 * System root paths that must never be accessed.
 * Expanded per critic review for macOS/Linux/Windows.
 */
const SYSTEM_ROOTS = [
  // Unix/Linux
  "/etc",
  "/usr",
  "/var",
  "/bin",
  "/sbin",
  "/tmp",
  "/proc",
  "/sys",
  "/boot",
  "/lib",
  "/lib64",
  "/opt",
  "/root",
  "/run",
  "/dev",

  // macOS specific
  "/System",
  "/Library",
  "/Applications",
  "/Volumes",
  "/private",
  "/cores",

  // Windows (when running under WSL or cross-platform)
  "C:\\Windows",
  "C:\\Program Files",
  "C:\\Program Files (x86)",
  "C:\\ProgramData",
];

/**
 * Validate a project name for security.
 * Rejects names containing path separators or traversal sequences.
 *
 * @param name - Project name to validate
 * @returns Validation result
 */
export function validateProjectName(name: string): PathValidationResult {
  if (!name || name.length === 0) {
    return { valid: false, error: "Project name cannot be empty" };
  }

  if (name.length > 255) {
    return { valid: false, error: "Project name exceeds maximum length (255)" };
  }

  // Check for path separators (both Unix and Windows)
  if (/[/\\]/.test(name)) {
    return {
      valid: false,
      error: "Project name cannot contain path separators",
    };
  }

  // Check for path traversal sequences
  if (name.includes("..")) {
    return {
      valid: false,
      error: "Project name cannot contain path traversal sequences",
    };
  }

  // Check for null bytes (CWE-158)
  if (name.includes("\0")) {
    return { valid: false, error: "Project name cannot contain null bytes" };
  }

  return { valid: true };
}

/**
 * Validate a path for safe deletion operations.
 * Resolves symlinks and checks against protected paths.
 *
 * @param targetPath - Path to validate for deletion
 * @returns Validation result with resolved path
 */
export function validateDeletePath(targetPath: string): PathValidationResult {
  const homeDir = os.homedir();

  // Check path exists
  if (!fs.existsSync(targetPath)) {
    return { valid: false, error: "Path does not exist" };
  }

  // Resolve symlinks to get real path (CWE-59 prevention)
  let resolved: string;
  try {
    resolved = fs.realpathSync(targetPath);
  } catch (error) {
    return {
      valid: false,
      error: `Failed to resolve path: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Normalize path for comparison
  resolved = path.normalize(resolved);

  // Cannot be root filesystem
  if (resolved === "/" || resolved === path.parse(resolved).root) {
    return { valid: false, error: "Cannot delete root filesystem" };
  }

  // Cannot be home directory itself
  if (resolved === homeDir) {
    return { valid: false, error: "Cannot delete user home directory" };
  }

  // Check against system root paths
  for (const systemRoot of SYSTEM_ROOTS) {
    const normalizedRoot = path.normalize(systemRoot);
    if (
      resolved === normalizedRoot ||
      resolved.startsWith(normalizedRoot + path.sep)
    ) {
      return { valid: false, error: `Cannot delete system path: ${systemRoot}` };
    }
  }

  // Check against protected paths under home directory
  for (const protectedName of PROTECTED_HOME_PATHS) {
    const protectedFull = path.join(homeDir, protectedName);
    if (
      resolved === protectedFull ||
      resolved.startsWith(protectedFull + path.sep)
    ) {
      return {
        valid: false,
        error: `Cannot delete protected path: ~/${protectedName}`,
      };
    }
  }

  return { valid: true, resolvedPath: resolved };
}

/**
 * Check if a path is a symlink without following it.
 *
 * @param targetPath - Path to check
 * @returns true if path is a symlink
 */
export function isSymlink(targetPath: string): boolean {
  try {
    const stats = fs.lstatSync(targetPath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Validate both project name and notes path for delete operation.
 * Combines all security checks into a single validation.
 *
 * @param projectName - Project name to validate
 * @param notesPath - Notes path to validate (optional, only checked if delete_notes is true)
 * @param deleteNotes - Whether notes will be deleted
 * @returns Validation result
 */
export function validateDeleteOperation(
  projectName: string,
  notesPath: string | null | undefined,
  deleteNotes: boolean
): PathValidationResult {
  // Validate project name
  const nameValidation = validateProjectName(projectName);
  if (!nameValidation.valid) {
    return nameValidation;
  }

  // If deleting notes, validate the path
  if (deleteNotes && notesPath) {
    const pathValidation = validateDeletePath(notesPath);
    if (!pathValidation.valid) {
      return pathValidation;
    }
    return { valid: true, resolvedPath: pathValidation.resolvedPath };
  }

  return { valid: true };
}
