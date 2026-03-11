/**
 * Shared path validation utilities for CWE-22 path traversal prevention.
 *
 * Provides repo-root-anchored path validation that prevents:
 * - Symlink traversal (symlinks resolving outside repo)
 * - Absolute paths (e.g., /etc/passwd)
 * - Encoded traversal edge cases (e.g., ..%2F)
 * - Literal .. components that resolve outside repo
 *
 * See: CWE-22 (https://cwe.mitre.org/data/definitions/22.html)
 */

import { resolve, isAbsolute } from "path";
import { realpathSync } from "fs";

/**
 * Get the repository root via git rev-parse.
 *
 * @returns Resolved absolute path to the repository root.
 * @throws Error if not in a git repository or git is unavailable.
 */
export async function getRepoRoot(): Promise<string> {
  const proc = Bun.spawn(["git", "rev-parse", "--show-toplevel"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error("Unable to determine repository root");
  }

  const stdout = await Bun.readableStreamToText(proc.stdout);
  return realpathSync(stdout.trim());
}

/**
 * Validate that a path resolves within the repository root.
 *
 * Resolves the path and verifies the resolved location is within the
 * repository root. This prevents path traversal via symlinks, absolute
 * paths, and .. components that escape the repo boundary.
 *
 * @param targetPath - Path to validate (absolute or relative).
 * @param repoRoot - Repository root to validate against. If undefined,
 *   determined automatically via git rev-parse.
 * @returns The resolved path (guaranteed to be within repo root).
 * @throws Error with "Path traversal blocked" message if path escapes repo root.
 * @throws Error if the repository root cannot be determined.
 */
export async function validatePathWithinRepo(
  targetPath: string,
  repoRoot?: string,
): Promise<string> {
  const root = repoRoot ?? (await getRepoRoot());
  const resolvedRoot = realpathSync(root);

  // Anchor relative paths to repo root before resolving.
  // This prevents absolute paths from bypassing containment.
  let resolvedPath: string;
  if (!isAbsolute(targetPath)) {
    resolvedPath = resolve(resolvedRoot, targetPath);
  } else {
    resolvedPath = resolve(targetPath);
  }

  // Resolve symlinks for the final check
  try {
    resolvedPath = realpathSync(resolvedPath);
  } catch {
    // Path may not exist yet (e.g., output files). Use the resolved path as-is.
  }

  // Verify containment
  if (!resolvedPath.startsWith(resolvedRoot + "/") && resolvedPath !== resolvedRoot) {
    throw new Error(
      `Path traversal blocked: '${targetPath}' resolves to '${resolvedPath}' ` +
        `which is outside repository root '${resolvedRoot}'`,
    );
  }

  return resolvedPath;
}
