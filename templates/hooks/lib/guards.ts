/**
 * Repository type guards for hook scripts.
 *
 * Determines whether the current repo is a Brain project (has .agents/ or
 * docs/ directory) versus a consumer repo that just uses Brain as a dependency.
 *
 * Migrated from guards.py. Pure Bun runtime -- no Node fs imports.
 */

import { join } from "path";
import { $ } from "bun";
import { getProjectDirectory } from "./utilities.ts";

/**
 * Check whether a path is an existing directory using Bun shell.
 */
async function isDirectory(path: string): Promise<boolean> {
  const result = await $`test -d ${path}`.nothrow().quiet();
  return result.exitCode === 0;
}

/**
 * Check whether a path exists as a regular file (not a directory).
 */
async function isFile(path: string): Promise<boolean> {
  const result = await $`test -f ${path}`.nothrow().quiet();
  return result.exitCode === 0;
}

/**
 * Check if running in a Brain project repo.
 *
 * A Brain project has either an `.agents/` directory (ai-agents style)
 * or a `docs/` directory (Brain memory storage). Uses getProjectDirectory()
 * to find the repo root, so this works from any subdirectory.
 */
async function isProjectRepo(): Promise<boolean> {
  const projectRoot = await getProjectDirectory();

  const agentsPath = join(projectRoot, ".agents");
  const docsPath = join(projectRoot, "docs");

  const [agentsIsDir, docsIsDir, agentsIsFile, docsIsFile] = await Promise.all(
    [
      isDirectory(agentsPath),
      isDirectory(docsPath),
      isFile(agentsPath),
      isFile(docsPath),
    ],
  );

  if (agentsIsFile) {
    console.warn(
      "[WARNING] .agents exists but is not a directory. " +
        "Guards will treat this as a consumer repo.",
    );
  }

  if (docsIsFile) {
    console.warn(
      "[WARNING] docs exists but is not a directory. " +
        "Guards will treat this as a consumer repo.",
    );
  }

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
async function skipIfConsumerRepo(hookName: string): Promise<boolean> {
  if (!(await isProjectRepo())) {
    console.error(
      `[SKIP] ${hookName}: .agents/ and docs/ not found (consumer repo)`,
    );
    return true;
  }
  return false;
}

export { isProjectRepo, skipIfConsumerRepo, getProjectDirectory };
