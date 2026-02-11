/**
 * Worktree Project Registration
 *
 * Registers worktree-specific projects in basic-memory at runtime so that
 * CODE mode worktree sessions have their memories path point to the
 * worktree-local docs/ directory.
 *
 * This modifies basic-memory's derived config (~/.basic-memory/config.json)
 * at runtime -- NOT Brain's source-of-truth config (~/.config/brain/config.json).
 * The basic-memory config is regenerated from Brain's config on translation sync,
 * so runtime entries are transient by design.
 *
 * @see TASK-006 MCP Server Runtime Override
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { logger } from "../utils/internal/logger";

/**
 * Set of projects already registered in this session.
 * Prevents redundant config writes on every tool call.
 */
const registeredProjects = new Set<string>();

/**
 * Ensure a worktree-specific project is registered in basic-memory's config
 * so that tool calls for this project route to the worktree's docs/ directory.
 *
 * This directly updates basic-memory's config file with the override path.
 * The operation is idempotent -- repeated calls for the same project + path
 * are no-ops after the first registration.
 *
 * @param _client - The basic-memory client (unused but kept for API consistency)
 * @param projectName - The project name to override
 * @param memoriesPath - The worktree-local memories path (actualCwd + "/docs")
 */
export async function ensureWorktreeProject(
  _client: Client,
  projectName: string,
  memoriesPath: string,
): Promise<void> {
  // Build a cache key that captures both project and path
  const cacheKey = `${projectName}::${memoriesPath}`;
  if (registeredProjects.has(cacheKey)) {
    logger.debug({ projectName, memoriesPath }, "Worktree project already registered this session");
    return;
  }

  // Directly update basic-memory config to point this project to the worktree path
  const configPath = path.join(os.homedir(), ".basic-memory", "config.json");

  try {
    let config: Record<string, unknown> = {};
    try {
      const content = fs.readFileSync(configPath, "utf-8");
      config = JSON.parse(content);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "ENOENT") {
        throw error;
      }
    }

    if (!config.projects || typeof config.projects !== "object") {
      config.projects = {};
    }

    const projects = config.projects as Record<string, string>;
    const currentPath = projects[projectName];

    if (currentPath === memoriesPath) {
      // Already pointing to the right place
      registeredProjects.add(cacheKey);
      logger.debug(
        { projectName, memoriesPath },
        "Worktree project already configured in basic-memory",
      );
      return;
    }

    // Override the project's memories path to the worktree-local docs/
    const previousPath = projects[projectName];
    projects[projectName] = memoriesPath;

    // Ensure the docs/ directory exists in the worktree
    if (!fs.existsSync(memoriesPath)) {
      fs.mkdirSync(memoriesPath, { recursive: true });
      logger.debug({ memoriesPath }, "Created worktree docs/ directory");
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    registeredProjects.add(cacheKey);

    logger.info(
      {
        projectName,
        previousPath,
        memoriesPath,
      },
      "Worktree project registered in basic-memory config",
    );
  } catch (error) {
    logger.error(
      { projectName, memoriesPath, error },
      "Failed to register worktree project in basic-memory config",
    );
    // Don't throw -- fall back to default behavior silently
  }
}

/**
 * Clear the registration cache (for testing or session reset).
 */
export function clearWorktreeProjectCache(): void {
  registeredProjects.clear();
}
