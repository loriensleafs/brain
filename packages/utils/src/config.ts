import { homedir } from "node:os";
import { join } from "node:path";

export interface BasicMemoryConfig {
  env: string;
  projects: Record<string, string>;
  default_project: string;
  default_project_mode: boolean;
  log_level: string;
  sync_delay: number;
  watch_project_reload_interval: number;
  update_permalinks_on_move: boolean;
  sync_changes: boolean;
  sync_thread_pool_size: number;
  sync_max_concurrent_files: number;
  kebab_filenames: boolean;
  disable_permalinks: boolean;
  skip_initialization_sync: boolean;
  project_root: string | null;
  cloud_client_id: string;
  cloud_domain: string;
  cloud_host: string;
  cloud_mode: boolean;
  cloud_projects: Record<string, unknown>;
}

/**
 * Default path to basic-memory config file.
 */
export function getConfigPath(): string {
  return join(homedir(), ".basic-memory", "config.json");
}

/**
 * Read and parse the basic-memory config file.
 * @throws Error if config file does not exist or is invalid JSON
 */
export async function readConfig(): Promise<BasicMemoryConfig> {
  const configPath = getConfigPath();
  const file = Bun.file(configPath);

  // Check existence and read atomically (avoids TOCTOU race condition)
  if (!(await file.exists())) {
    throw new Error(
      `Basic-memory config not found at ${configPath}. Run 'basic-memory init' to create it.`,
    );
  }

  // Read and parse
  let content: string;
  try {
    content = await file.text();
  } catch (error) {
    throw new Error(
      `Failed to read config file at ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    return JSON.parse(content) as BasicMemoryConfig;
  } catch (error) {
    throw new Error(
      `Invalid JSON in config file at ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Get list of available project names from config.
 */
export async function getAvailableProjects(): Promise<string[]> {
  const config = await readConfig();
  return Object.keys(config.projects);
}

/**
 * Get the default project name from config.
 */
export async function getDefaultProject(): Promise<string> {
  const config = await readConfig();
  return config.default_project;
}
