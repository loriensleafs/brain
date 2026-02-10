/**
 * Project resolution for brain-hooks.
 *
 * Ported from apps/claude-plugin/cmd/hooks/project_resolve.go
 * and packages/utils/internal/project_resolver.go.
 *
 * Resolution hierarchy:
 * 1. Explicit parameter
 * 2. BRAIN_PROJECT env var
 * 3. BM_PROJECT env var
 * 4. BM_ACTIVE_PROJECT env var (legacy)
 * 5. CWD matching against Brain config code_paths
 * 6. Empty string (caller shows error)
 */
import { join, resolve, sep, normalize } from "path";

/** Get home directory using Bun env. */
function homedir(): string {
  return Bun.env.HOME || "/tmp";
}
import type { BrainConfig, BrainProjectConfig } from "./types";

/**
 * Testable wrapper for process.env access.
 * Tests can replace this to mock environment variables.
 */
export let getEnv: (key: string) => string = (key) => process.env[key] ?? "";

export function setGetEnv(fn: (key: string) => string): void {
  getEnv = fn;
}

/**
 * Testable wrapper for Brain config path resolution.
 * Default: ~/.config/brain/config.json (XDG-compliant)
 */
export let getBrainConfigPath: () => string = () => {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME ?? "";
  const configBase = xdgConfigHome || join(homedir(), ".config");
  return join(configBase, "brain", "config.json");
};

export function setBrainConfigPath(fn: () => string): void {
  getBrainConfigPath = fn;
}

/**
 * Load Brain configuration from disk.
 * Returns empty config (not error) if file does not exist.
 */
export async function loadBrainConfig(): Promise<BrainConfig | null> {
  const configPath = getBrainConfigPath();
  if (!configPath) {
    return { version: "2.0.0", projects: {} };
  }

  try {
    const configFile = Bun.file(configPath);
    if (!configFile.size) return { version: "2.0.0", projects: {} };
    const config = await configFile.json() as BrainConfig;
    if (!config.projects) {
      config.projects = {};
    }
    return config;
  } catch {
    return { version: "2.0.0", projects: {} };
  }
}

/**
 * Resolve project from environment variables only.
 * Does NOT do CWD matching.
 */
export function resolveProjectFromEnv(explicit: string): string {
  if (explicit) return explicit;

  const brainProject = getEnv("BRAIN_PROJECT");
  if (brainProject) return brainProject;

  const bmProject = getEnv("BM_PROJECT");
  if (bmProject) return bmProject;

  const bmActiveProject = getEnv("BM_ACTIVE_PROJECT");
  if (bmActiveProject) return bmActiveProject;

  return "";
}

/**
 * Match CWD against configured code paths.
 * Returns the project name for the deepest (most specific) match.
 */
function matchCwdToProject(
  cwd: string,
  projects: Record<string, BrainProjectConfig>,
): string {
  if (!cwd || Object.keys(projects).length === 0) return "";

  const normalizedCwd = normalize(resolve(cwd));
  let bestMatch = "";
  let bestMatchLen = 0;

  for (const [projectName, project] of Object.entries(projects)) {
    if (!project.code_path) continue;

    const projectPath = normalize(resolve(project.code_path));

    if (
      normalizedCwd === projectPath ||
      normalizedCwd.startsWith(projectPath + sep)
    ) {
      if (projectPath.length > bestMatchLen) {
        bestMatch = projectName;
        bestMatchLen = projectPath.length;
      }
    }
  }

  return bestMatch;
}

/**
 * Resolve project from CWD matching only (no env vars).
 * Low-level function for directory matching.
 */
export async function resolveProjectFromCwd(cwd: string): Promise<string> {
  const config = await loadBrainConfig();
  if (!config) return "";

  const resolvedCwd = cwd || process.cwd();
  return matchCwdToProject(resolvedCwd, config.projects);
}

/**
 * Resolve project with CWD matching as fallback.
 * First tries env vars, then CWD matching.
 */
export async function resolveProjectWithCwd(
  explicit: string,
  cwd: string,
): Promise<string> {
  const project = resolveProjectFromEnv(explicit);
  if (project) return project;

  return resolveProjectFromCwd(cwd);
}
