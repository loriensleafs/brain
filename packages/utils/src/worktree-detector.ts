/**
 * Git Worktree Detection
 *
 * Detects whether the current working directory is inside a linked git worktree
 * and resolves the main worktree path. Used as a fallback in project resolution
 * when direct CWD matching fails.
 *
 * Algorithm follows DESIGN-002 specification:
 * 1. Fast pre-check for .git file/directory
 * 2. Single git rev-parse subprocess with 3s timeout
 * 3. Parse and validate output
 * 4. Compare commonDir vs gitDir to detect linked worktree
 * 5. Derive main worktree path from commonDir
 *
 * @see DESIGN-002-detection-algorithm-detail
 * @see FEAT-003-worktree-aware-project-resolution
 */

import { execFile } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";

const SUBPROCESS_TIMEOUT_MS = 3000;

export interface WorktreeDetectionResult {
  mainWorktreePath: string;
  isLinkedWorktree: boolean;
}

/**
 * Walk up from the given directory looking for a .git file or directory.
 *
 * @returns The path where .git was found, or null if not in a git repo
 */
async function findGitRoot(startPath: string): Promise<string | null> {
  let current = normalize(startPath);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const gitPath = join(current, ".git");
    try {
      await stat(gitPath);
      return current;
    } catch {
      // .git not found at this level, walk up
    }

    const parent = dirname(current);
    if (parent === current) {
      // Reached filesystem root
      return null;
    }
    current = parent;
  }
}

/**
 * Run git rev-parse to get worktree information.
 *
 * @returns Parsed stdout lines or null on any failure
 */
function runGitRevParse(cwd: string): Promise<string[] | null> {
  return new Promise((resolve) => {
    execFile(
      "git",
      [
        "rev-parse",
        "--path-format=absolute",
        "--git-common-dir",
        "--git-dir",
        "--is-bare-repository",
      ],
      {
        cwd,
        timeout: SUBPROCESS_TIMEOUT_MS,
        maxBuffer: 1024,
      },
      (error, stdout) => {
        if (error) {
          if (error.killed) {
            // Timeout
            console.warn(
              `[worktree-detector] git rev-parse timed out after ${SUBPROCESS_TIMEOUT_MS}ms for cwd: ${cwd}`,
            );
          }
          resolve(null);
          return;
        }

        const lines = stdout.trim().split("\n");
        resolve(lines);
      },
    );
  });
}

/**
 * Detect whether the given directory is inside a linked git worktree
 * and return the main worktree path.
 *
 * Returns null in all non-linked-worktree cases:
 * - Not a git repository
 * - Main worktree (not linked)
 * - Bare repository
 * - Git not installed or too old
 * - Subprocess timeout
 * - Any error condition
 *
 * @param cwd - Absolute path to the current working directory
 * @returns Detection result with main worktree path, or null
 */
export async function detectWorktreeMainPath(cwd: string): Promise<WorktreeDetectionResult | null> {
  // Step 1: Fast pre-check - walk up looking for .git
  const gitRoot = await findGitRoot(cwd);
  if (!gitRoot) {
    // Not a git repo
    return null;
  }

  // Step 2: Spawn git subprocess
  const lines = await runGitRevParse(gitRoot);
  if (!lines) {
    // Git failed (not installed, too old, or error)
    return null;
  }

  // Step 3: Parse output - expect exactly 3 lines
  if (lines.length !== 3) {
    return null;
  }

  const [commonDir, gitDir, isBare] = lines;

  // Step 4: Validate - reject bare repos
  if (isBare === "true") {
    return null;
  }

  // Step 5: Compare paths - normalize and resolve symlinks
  let normalizedCommonDir: string;
  let normalizedGitDir: string;
  try {
    normalizedCommonDir = normalize(await realpath(commonDir));
    normalizedGitDir = normalize(await realpath(gitDir));
  } catch {
    // Path resolution failed (broken symlinks, deleted paths)
    return null;
  }

  if (normalizedCommonDir === normalizedGitDir) {
    // Main worktree, not linked - direct match handles this
    return null;
  }

  // Step 6: Derive main worktree path
  // commonDir is /path/to/main-repo/.git, dirname gives /path/to/main-repo
  const mainWorktreePath = dirname(normalizedCommonDir);

  // Step 7: Return result
  return {
    mainWorktreePath,
    isLinkedWorktree: true,
  };
}
