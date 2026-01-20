/**
 * Code path configuration storage.
 *
 * Maps project names to their source code directories,
 * enabling CWD-based project resolution.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { logger } from "../utils/internal/logger";

/**
 * Path to brain-specific config file
 * Separate from basic-memory config to avoid conflicts
 */
const CONFIG_PATH = path.join(
  os.homedir(),
  ".basic-memory",
  "brain-config.json"
);

/**
 * Brain configuration schema
 */
interface BrainConfig {
  /** Map of project names to code directory paths */
  code_paths: Record<string, string>;
  /** Default notes path. @deprecated '~/memories' */
  default_notes_path: string;
}

/**
 * Load brain config from disk
 */
function loadConfig(): BrainConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(content);
      return {
        code_paths: parsed.code_paths || {},
        default_notes_path: parsed.default_notes_path || "~/memories",
      };
    }
  } catch (error) {
    logger.warn({ error, path: CONFIG_PATH }, "Failed to load brain config");
  }

  return { code_paths: {}, default_notes_path: "~/memories" };
}

/**
 * Save brain config to disk
 */
function saveConfig(config: BrainConfig): void {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    logger.debug({ path: CONFIG_PATH }, "Saved brain config");
  } catch (error) {
    logger.error(
      { error, path: CONFIG_PATH },
      "Failed to save brain config"
    );
    throw error;
  }
}

/**
 * Get all code path mappings
 */
export function getCodePaths(): Record<string, string> {
  return loadConfig().code_paths;
}

/**
 * Set the code path for a project
 *
 * @param project - Project name
 * @param codePath - Path to code directory (supports ~)
 */
export function setCodePath(project: string, codePath: string): void {
  const config = loadConfig();

  // Expand ~ and resolve to absolute path
  let resolved = codePath;
  if (resolved.startsWith("~")) {
    resolved = path.join(os.homedir(), resolved.slice(1));
  }
  resolved = path.resolve(resolved);

  config.code_paths[project] = resolved;
  saveConfig(config);

  logger.info({ project, codePath: resolved }, "Code path configured");
}

/**
 * Remove the code path mapping for a project
 *
 * @param project - Project name
 * @returns true if removed, false if not found
 */
export function removeCodePath(project: string): boolean {
  const config = loadConfig();

  if (project in config.code_paths) {
    delete config.code_paths[project];
    saveConfig(config);
    logger.info({ project }, "Code path removed");
    return true;
  }

  return false;
}

/**
 * Get code path for a specific project
 */
export function getCodePath(project: string): string | undefined {
  return getCodePaths()[project];
}
