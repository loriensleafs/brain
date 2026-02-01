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
import { getDefaultMemoriesLocation } from "../config/brain-config";

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
 * Brain configuration schema (legacy format)
 *
 * @deprecated Use ~/.config/brain/config.json via brain-config.ts instead.
 * This interface is maintained for backward compatibility during migration.
 */
interface LegacyBrainConfig {
  /** Map of project names to code directory paths */
  code_paths: Record<string, string>;
  /**
   * Default memories location.
   * @deprecated Read from new config via getDefaultMemoriesLocation() instead.
   */
  default_memories_location?: string;
}

/**
 * Load legacy brain config from disk.
 *
 * @deprecated This function reads from the legacy config location.
 * For the default memories location, use getDefaultMemoriesLocation() instead.
 */
function loadConfig(): LegacyBrainConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(content);
      return {
        code_paths: parsed.code_paths || {},
        // Support both old and new field names during migration
        default_memories_location:
          parsed.default_memories_location ||
          parsed.default_notes_path ||
          getDefaultMemoriesLocation(),
      };
    }
  } catch (error) {
    logger.warn({ error, path: CONFIG_PATH }, "Failed to load brain config");
  }

  return { code_paths: {}, default_memories_location: getDefaultMemoriesLocation() };
}

/**
 * Save brain config to disk
 *
 * @deprecated This function writes to the legacy config location.
 */
function saveConfig(config: LegacyBrainConfig): void {
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
