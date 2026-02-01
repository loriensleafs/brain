import { basename, dirname } from "node:path";
import { getDefaultProject, readConfig } from "./config";

export class ProjectNotFoundError extends Error {
  constructor(
    public readonly project: string,
    public readonly availableProjects: string[],
  ) {
    super(
      `Project "${project}" not found in basic-memory config. ` +
        `Available projects: ${availableProjects.join(", ")}`,
    );
    this.name = "ProjectNotFoundError";
  }
}

/**
 * Get the memories path for a specific project.
 *
 * @param project - Project name as defined in ~/.basic-memory/config.json
 * @returns Absolute path to project's memories directory
 * @throws ProjectNotFoundError if project not found in config
 *
 * @example
 * ```ts
 * const path = await getProjectMemoriesPath("brain");
 * // Returns: "/Users/peter.kloss/memories/mcps/brain"
 * ```
 */
export async function getProjectMemoriesPath(project: string): Promise<string> {
  const config = await readConfig();
  const memoriesPath = config.projects[project];

  if (!memoriesPath) {
    throw new ProjectNotFoundError(project, Object.keys(config.projects));
  }

  return memoriesPath;
}

/**
 * Try to detect project name from a directory path by matching against known projects.
 *
 * @param cwd - Directory path to analyze
 * @returns Project name if found, undefined otherwise
 */
export async function detectProjectFromPath(
  cwd: string,
): Promise<string | undefined> {
  const config = await readConfig();
  const dirName = basename(cwd);
  const parentDirName = basename(dirname(cwd));

  // Direct match on directory name
  if (config.projects[dirName]) {
    return dirName;
  }

  // Try parent directory name
  if (config.projects[parentDirName]) {
    return parentDirName;
  }

  // Check if cwd is inside any project's memories path
  for (const [projectName, memoriesPath] of Object.entries(config.projects)) {
    if (cwd.startsWith(memoriesPath)) {
      return projectName;
    }
  }

  return undefined;
}

/**
 * Resolve project memories path with automatic project detection.
 *
 * Resolution order:
 * 1. Explicit project parameter
 * 2. BRAIN_PROJECT environment variable
 * 3. Detection from cwd (directory name matching)
 * 4. Default project from config
 *
 * @param project - Explicit project name (optional)
 * @param cwd - Working directory for detection (defaults to process.cwd())
 * @returns Absolute path to project's memories directory
 * @throws ProjectNotFoundError if resolved project not found
 *
 * @example
 * ```ts
 * // Explicit project
 * const path1 = await resolveProjectMemoriesPath("brain");
 *
 * // Auto-detect from environment
 * process.env.BRAIN_PROJECT = "memory";
 * const path2 = await resolveProjectMemoriesPath();
 *
 * // Auto-detect from cwd
 * const path3 = await resolveProjectMemoriesPath(undefined, "/path/to/brain");
 * ```
 */
export async function resolveProjectMemoriesPath(
  project?: string,
  cwd?: string,
): Promise<string> {
  // 1. Explicit project parameter
  if (project) {
    return getProjectMemoriesPath(project);
  }

  // 2. Environment variable
  const envProject = process.env.BRAIN_PROJECT;
  if (envProject) {
    return getProjectMemoriesPath(envProject);
  }

  // 3. Detect from cwd
  const workingDir = cwd ?? process.cwd();
  const detectedProject = await detectProjectFromPath(workingDir);
  if (detectedProject) {
    return getProjectMemoriesPath(detectedProject);
  }

  // 4. Fall back to default project
  const defaultProject = await getDefaultProject();
  return getProjectMemoriesPath(defaultProject);
}
