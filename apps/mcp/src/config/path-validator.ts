/**
 * Path Validation Utilities
 *
 * Security-focused path validation to prevent directory traversal attacks,
 * null byte injection, and access to system directories.
 *
 * @see ADR-020 Security Requirements section for the full specification
 */

import * as os from "node:os";
import * as path from "node:path";

/**
 * Result of path validation.
 *
 * Uses discriminated union for proper TypeScript narrowing:
 * - When `valid: true`, `normalizedPath` is guaranteed to exist
 * - When `valid: false`, `error` is guaranteed to exist
 */
export type PathValidationResult =
  | { valid: true; normalizedPath: string }
  | { valid: false; error: string };

/**
 * System paths that are blocked from access.
 *
 * These paths represent system directories that should never be used
 * as memories locations or code paths.
 */
const BLOCKED_SYSTEM_PATHS_UNIX: readonly string[] = [
  "/etc",
  "/usr",
  "/var",
  "/bin",
  "/sbin",
  "/lib",
  "/lib64",
  "/boot",
  "/dev",
  "/proc",
  "/sys",
  "/run",
  "/tmp",
  "/root",
] as const;

const BLOCKED_SYSTEM_PATHS_WINDOWS: readonly string[] = [
  "C:\\Windows",
  "C:\\Program Files",
  "C:\\Program Files (x86)",
  "C:\\ProgramData",
  "C:\\System Volume Information",
] as const;

/**
 * Get the appropriate blocked paths for the current platform.
 */
function getBlockedSystemPaths(): readonly string[] {
  if (process.platform === "win32") {
    return BLOCKED_SYSTEM_PATHS_WINDOWS;
  }
  return BLOCKED_SYSTEM_PATHS_UNIX;
}

/**
 * Expand tilde (~) to the user's home directory.
 *
 * @param inputPath - Path that may contain ~
 * @returns Path with ~ expanded to home directory
 *
 * @example
 * ```typescript
 * expandTilde("~/memories"); // "/Users/peter/memories"
 * expandTilde("/absolute/path"); // "/absolute/path"
 * ```
 */
export function expandTilde(inputPath: string): string {
  if (inputPath === "~") {
    return os.homedir();
  }
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  if (inputPath.startsWith("~\\")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

/**
 * Normalize a path by resolving . and symlinks.
 *
 * This function expands tilde and normalizes the path structure.
 * Note: This does NOT resolve symlinks at runtime (would require fs access).
 * Use path.resolve for symlink resolution when needed.
 *
 * @param inputPath - Path to normalize
 * @returns Normalized absolute path
 *
 * @example
 * ```typescript
 * normalizePath("~/memories/../docs"); // "/Users/peter/docs"
 * normalizePath("./relative"); // "/current/working/dir/relative"
 * ```
 */
export function normalizePath(inputPath: string): string {
  const expanded = expandTilde(inputPath);
  return path.normalize(path.resolve(expanded));
}

/**
 * Check if a path contains directory traversal sequences.
 *
 * @param inputPath - Path to check
 * @returns true if path contains traversal sequences
 */
function containsTraversal(inputPath: string): boolean {
  // Check for .. in various forms
  const traversalPatterns = ["..", "..\\", "../"];

  for (const pattern of traversalPatterns) {
    if (inputPath.includes(pattern)) {
      return true;
    }
  }

  // Also check for encoded traversal
  if (inputPath.includes("%2e%2e") || inputPath.includes("%2E%2E")) {
    return true;
  }

  return false;
}

/**
 * Check if a path contains null bytes.
 *
 * Null bytes can be used to truncate paths in some systems,
 * potentially bypassing security checks.
 *
 * @param inputPath - Path to check
 * @returns true if path contains null bytes
 */
function containsNullBytes(inputPath: string): boolean {
  return inputPath.includes("\0");
}

/**
 * Check if a normalized path starts with any blocked system path.
 *
 * @param normalizedPath - Normalized absolute path to check
 * @returns true if path is within a blocked system directory
 */
function isBlockedSystemPath(normalizedPath: string): boolean {
  const blockedPaths = getBlockedSystemPaths();
  const lowerPath = normalizedPath.toLowerCase();

  for (const blockedPath of blockedPaths) {
    const lowerBlocked = blockedPath.toLowerCase();

    // Check exact match or if path is under blocked directory
    if (lowerPath === lowerBlocked || lowerPath.startsWith(lowerBlocked + path.sep)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate a path for security concerns.
 *
 * Checks for:
 * 1. Directory traversal sequences (..)
 * 2. Null byte injection
 * 3. System directory access
 *
 * @param inputPath - Path to validate
 * @returns ValidationResult with success status and normalized path or error
 *
 * @example
 * ```typescript
 * // Valid path
 * const result = validatePath("~/memories");
 * // { valid: true, normalizedPath: "/Users/peter/memories" }
 *
 * // Invalid: traversal
 * const result = validatePath("~/memories/../etc");
 * // { valid: false, error: "Path traversal not allowed" }
 *
 * // Invalid: system path
 * const result = validatePath("/etc/passwd");
 * // { valid: false, error: "System path not allowed: /etc" }
 * ```
 */
export function validatePath(inputPath: string): PathValidationResult {
  // Check for empty path
  if (!inputPath || inputPath.trim() === "") {
    return { valid: false, error: "Path cannot be empty" };
  }

  // Check for null bytes BEFORE any processing
  if (containsNullBytes(inputPath)) {
    return {
      valid: false,
      error: "Invalid path characters: null byte detected",
    };
  }

  // Check for directory traversal BEFORE normalization
  // This catches attempts to use .. to escape directories
  if (containsTraversal(inputPath)) {
    return { valid: false, error: "Path traversal not allowed" };
  }

  // Normalize the path
  let normalizedPath: string;
  try {
    normalizedPath = normalizePath(inputPath);
  } catch {
    return { valid: false, error: "Failed to normalize path" };
  }

  // Check if normalized path is a system path
  if (isBlockedSystemPath(normalizedPath)) {
    // Find which system path was matched for better error message
    const blockedPaths = getBlockedSystemPaths();
    const lowerPath = normalizedPath.toLowerCase();

    for (const blockedPath of blockedPaths) {
      const lowerBlocked = blockedPath.toLowerCase();
      if (lowerPath === lowerBlocked || lowerPath.startsWith(lowerBlocked + path.sep)) {
        return {
          valid: false,
          error: `System path not allowed: ${blockedPath}`,
        };
      }
    }

    return { valid: false, error: "System path not allowed" };
  }

  return { valid: true, normalizedPath };
}

/**
 * Validate a path and throw an error if invalid.
 *
 * Convenience function for contexts where throwing is preferred over returning results.
 *
 * @param inputPath - Path to validate
 * @returns Normalized path if valid
 * @throws Error if path is invalid
 *
 * @example
 * ```typescript
 * try {
 *   const safePath = validatePathOrThrow("~/memories");
 *   // Use safePath...
 * } catch (error) {
 *   console.error("Invalid path:", error.message);
 * }
 * ```
 */
export function validatePathOrThrow(inputPath: string): string {
  const result = validatePath(inputPath);
  if (!result.valid) {
    throw new Error(result.error);
  }
  return result.normalizedPath;
}

/**
 * Check if a path is within a given base directory.
 *
 * Useful for ensuring paths don't escape a sandbox directory.
 *
 * @param inputPath - Path to check
 * @param basePath - Base directory that should contain the path
 * @returns true if inputPath is within basePath
 *
 * @example
 * ```typescript
 * isPathWithin("/home/user/project/file.md", "/home/user/project"); // true
 * isPathWithin("/home/user/other/file.md", "/home/user/project"); // false
 * ```
 */
export function isPathWithin(inputPath: string, basePath: string): boolean {
  const normalizedInput = normalizePath(inputPath);
  const normalizedBase = normalizePath(basePath);

  // Ensure base path ends with separator for accurate comparison
  const baseWithSep = normalizedBase.endsWith(path.sep)
    ? normalizedBase
    : normalizedBase + path.sep;

  return normalizedInput === normalizedBase || normalizedInput.startsWith(baseWithSep);
}

/**
 * Get a human-readable description of why a path is invalid.
 *
 * @param inputPath - Path to analyze
 * @returns Description of validation issues or "Path is valid"
 */
export function explainPathValidation(inputPath: string): string {
  if (!inputPath || inputPath.trim() === "") {
    return "Path is empty or contains only whitespace";
  }

  if (containsNullBytes(inputPath)) {
    return "Path contains null bytes which could be used for path truncation attacks";
  }

  if (containsTraversal(inputPath)) {
    return "Path contains '..' sequences which could be used to escape directory boundaries";
  }

  try {
    const normalizedPath = normalizePath(inputPath);
    if (isBlockedSystemPath(normalizedPath)) {
      return `Path resolves to a system directory which is blocked for security reasons`;
    }
  } catch {
    return "Path cannot be normalized due to invalid format";
  }

  return "Path is valid";
}
