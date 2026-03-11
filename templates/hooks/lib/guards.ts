/**
 * Repository type guards for hook scripts.
 *
 * Determines whether the current repo is a Brain project (has docs/ directory
 * for Brain memory storage) versus a consumer repo that just uses Brain as
 * a dependency.
 *
 * Migrated from guards.py. Pure Bun runtime -- no Node fs imports.
 */

import { join } from "path";
import { existsSync, statSync } from "fs";
import { getProjectDirectory } from "./utilities.ts";

/**
 * Check whether a path is an existing directory.
 */
function isDirectory(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check whether a path exists as a regular file (not a directory).
 */
function isFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * Check if running in a Brain project repo.
 *
 * A Brain project has either an `.agents/` directory (ai-agents style)
 * or a `docs/` directory (Brain memory storage). Uses getProjectDirectory()
 * to find the repo root, so this works from any subdirectory.
 */
async function isProjectRepo(stdinCwd?: string): Promise<boolean> {
  const projectRoot = await getProjectDirectory(stdinCwd);

  const agentsPath = join(projectRoot, ".agents");
  const docsPath = join(projectRoot, "docs");

  const agentsIsDir = isDirectory(agentsPath);
  const docsIsDir = isDirectory(docsPath);

  return agentsIsDir || docsIsDir;
}

/**
 * Print skip message and return true if this is a consumer repo.
 *
 * Use as an early exit guard in hook scripts:
 * ```ts
 * if (await skipIfConsumerRepo("pre-commit")) process.exit(0);
 * ```
 */
async function skipIfConsumerRepo(hookName: string, stdinCwd?: string): Promise<boolean> {
  if (!(await isProjectRepo(stdinCwd))) {
    console.log(
      `[SKIP] ${hookName}: .agents/ and docs/ not found (consumer repo)`,
    );
    return true;
  }
  return false;
}

export { isProjectRepo, skipIfConsumerRepo, getProjectDirectory };
