/**
 * Project Resolution Utility
 *
 * Resolves project name using a 6-level hierarchy:
 * 1. Explicit parameter
 * 2. Brain CLI active project (via "brain config get active-project")
 * 3. BRAIN_PROJECT env var
 * 4. BM_PROJECT env var
 * 5. CWD matching against Brain config code_paths
 * 6. null (caller shows error)
 *
 * Configuration location: ~/.config/brain/config.json
 *
 * @see ADR-020 for configuration architecture details
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, normalize, resolve, sep } from "node:path";

import { detectWorktreeMainPath } from "./worktree-detector";

/**
 * Brain configuration structure (subset needed for project resolution).
 */
export interface BrainProjectConfig {
  code_path: string;
  memories_path?: string;
  memories_mode?: "DEFAULT" | "CODE" | "CUSTOM";
  disableWorktreeDetection?: boolean;
}

/**
 * Result of CWD-to-project matching with context about resolution method.
 */
export interface CwdMatchResult {
  projectName: string;
  effectiveCwd: string;
  isWorktreeResolved: boolean;
}

export interface BrainConfig {
  version: string;
  projects: Record<string, BrainProjectConfig>;
}

/**
 * Options for project resolution.
 */
export interface ResolveOptions {
  /** Explicit project name (highest priority) */
  explicit?: string;
  /** CWD for directory-based resolution */
  cwd?: string;
}

/**
 * Get the XDG-compliant Brain config path.
 *
 * @returns Absolute path to ~/.config/brain/config.json
 */
export function getBrainConfigPath(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(xdgConfigHome, "brain", "config.json");
}

/**
 * Load Brain configuration from disk.
 *
 * @returns Parsed BrainConfig or null if file does not exist
 * @throws Error if file exists but cannot be parsed
 */
export function loadBrainConfig(): BrainConfig | null {
  const configPath = getBrainConfigPath();

  if (!existsSync(configPath)) {
    return null;
  }

  const content = readFileSync(configPath, "utf-8");
  return JSON.parse(content) as BrainConfig;
}

/**
 * Get the Brain CLI active project by calling "brain config get active-project".
 *
 * @returns Active project name or null if not set or CLI not available
 */
function getBrainCliActiveProject(): string | null {
  try {
    const result = execSync("brain config get active-project", {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    // brain CLI returns "null" or empty when no active project
    if (!result || result === "null") {
      return null;
    }
    return result;
  } catch {
    // brain CLI not available or command failed
    return null;
  }
}

/**
 * Match CWD against configured code paths.
 *
 * @param cwd - Working directory to match
 * @param config - Brain configuration with projects
 * @returns Project name if found, null otherwise
 */
function matchCwdToProject(cwd: string, config: BrainConfig | null): string | null {
  if (!config || !config.projects) {
    return null;
  }

  const currentDir = normalize(cwd);

  let bestMatch: string | null = null;
  let bestMatchLen = 0;

  for (const [name, project] of Object.entries(config.projects)) {
    if (!project || !project.code_path) {
      continue;
    }

    const projectPath = normalize(project.code_path);

    // Check exact match or subdirectory match
    if (currentDir === projectPath || currentDir.startsWith(projectPath + sep)) {
      // Track the deepest match (longest path wins)
      if (projectPath.length > bestMatchLen) {
        bestMatch = name;
        bestMatchLen = projectPath.length;
      }
    }
  }

  return bestMatch;
}

/**
 * Resolve project name using the 6-level hierarchy:
 *
 * 1. Explicit parameter
 * 2. Brain CLI active project (via "brain config get active-project")
 * 3. BRAIN_PROJECT env var
 * 4. BM_PROJECT env var
 * 5. CWD matching against Brain config code_paths
 * 6. null (caller shows error)
 *
 * @param optionsOrCwd - Resolution options object, or CWD string (backward compat)
 * @returns Project name if found, null otherwise
 *
 * @example
 * ```typescript
 * // Explicit always wins
 * resolveProject({ explicit: "my-project" }) // => "my-project"
 *
 * // Falls back through hierarchy
 * process.env.BRAIN_PROJECT = "env-project"
 * resolveProject() // => "env-project"
 *
 * // CWD matching (options object)
 * resolveProject({ cwd: "/Users/dev/brain/apps/mcp" }) // => "brain"
 *
 * // CWD matching (string shorthand for backward compat)
 * resolveProject("/Users/dev/brain/apps/mcp") // => "brain"
 * ```
 */
export function resolveProject(optionsOrCwd?: ResolveOptions | string): string | null {
  // Normalize input: string becomes { cwd: string }
  const options: ResolveOptions | undefined =
    typeof optionsOrCwd === "string" ? { cwd: optionsOrCwd } : optionsOrCwd;

  // 1. Explicit parameter always wins
  if (options?.explicit) {
    return options.explicit;
  }

  // 2. Brain CLI active project
  const cliProject = getBrainCliActiveProject();
  if (cliProject) {
    return cliProject;
  }

  // 3. BRAIN_PROJECT env var
  if (process.env.BRAIN_PROJECT) {
    return process.env.BRAIN_PROJECT;
  }

  // 4. BM_PROJECT env var
  if (process.env.BM_PROJECT) {
    return process.env.BM_PROJECT;
  }

  // 5. CWD matching against Brain config code_paths
  const config = loadBrainConfig();
  const cwd = options?.cwd || process.cwd();
  const cwdProject = matchCwdToProject(cwd, config);
  if (cwdProject) {
    return cwdProject;
  }

  // 6. No project resolved
  return null;
}

/**
 * Resolve project by matching CWD only (no env vars or CLI).
 * This is the low-level function for just directory matching.
 *
 * @param cwd - Working directory to match. Defaults to process.cwd()
 * @returns Project name if found, null otherwise
 *
 * @example
 * ```typescript
 * // Config: { projects: { brain: { code_path: "/Users/dev/brain" } } }
 *
 * // Exact match
 * resolveProjectFromCwd("/Users/dev/brain") // => "brain"
 *
 * // Subdirectory match
 * resolveProjectFromCwd("/Users/dev/brain/apps/mcp") // => "brain"
 *
 * // No match
 * resolveProjectFromCwd("/Users/dev/other") // => null
 * ```
 */
export function resolveProjectFromCwd(cwd?: string): string | null {
  const config = loadBrainConfig();
  return matchCwdToProject(cwd || process.cwd(), config);
}

/**
 * Get all configured projects and their code paths.
 *
 * @returns Map of project names to code paths, or empty map if no config
 */
export function getProjectCodePaths(): Map<string, string> {
  const config = loadBrainConfig();
  const result = new Map<string, string>();

  if (!config || !config.projects) {
    return result;
  }

  for (const [name, project] of Object.entries(config.projects)) {
    if (project?.code_path) {
      result.set(name, project.code_path);
    }
  }

  return result;
}

// === Worktree Integration ===

const BLOCKED_SYSTEM_PATHS = [
  "/etc",
  "/usr",
  "/bin",
  "/sbin",
  "/lib",
  "/lib64",
  "/boot",
  "/dev",
  "/proc",
  "/sys",
  "/root",
];

/**
 * Check if worktree detection is globally disabled via environment variable.
 *
 * @returns true if BRAIN_DISABLE_WORKTREE_DETECTION=1
 */
function isWorktreeDetectionGloballyDisabled(): boolean {
  return process.env.BRAIN_DISABLE_WORKTREE_DETECTION === "1";
}

/**
 * Validate an effectiveCwd path for security.
 * Checks for null bytes, path traversal, and blocked system paths.
 *
 * @returns Normalized path if valid, null if rejected
 */
function validateEffectiveCwd(effectiveCwd: string): string | null {
  if (!effectiveCwd || effectiveCwd.trim() === "") {
    return null;
  }

  if (effectiveCwd.includes("\0")) {
    console.warn("[worktree-resolver] effectiveCwd contains null bytes, rejecting:", effectiveCwd);
    return null;
  }

  if (
    effectiveCwd.includes("..") ||
    effectiveCwd.includes("%2e%2e") ||
    effectiveCwd.includes("%2E%2E")
  ) {
    console.warn(
      "[worktree-resolver] effectiveCwd contains traversal sequences, rejecting:",
      effectiveCwd,
    );
    return null;
  }

  let normalizedPath: string;
  try {
    normalizedPath = normalize(resolve(effectiveCwd));
  } catch {
    console.warn("[worktree-resolver] Failed to normalize effectiveCwd:", effectiveCwd);
    return null;
  }

  const lowerPath = normalizedPath.toLowerCase();
  for (const blocked of BLOCKED_SYSTEM_PATHS) {
    if (lowerPath === blocked || lowerPath.startsWith(blocked + sep)) {
      console.warn(
        "[worktree-resolver] effectiveCwd resolves to blocked system path:",
        normalizedPath,
      );
      return null;
    }
  }

  return normalizedPath;
}

/**
 * Match CWD against configured code paths with worktree fallback.
 * Async version that supports worktree detection.
 *
 * Algorithm from DESIGN-002:
 * 1. Try direct path match (existing behavior)
 * 2. Check global opt-out (env var)
 * 3. Run worktree detection
 * 4. Validate effectiveCwd
 * 5. Match effectiveCwd against code paths (skip per-project opt-out projects)
 *
 * @param cwd - Working directory to match
 * @param config - Brain configuration with projects
 * @returns Match result with context, or null if no match
 */
async function matchCwdToProjectWithContext(
  cwd: string,
  config: BrainConfig | null,
): Promise<CwdMatchResult | null> {
  if (!config || !config.projects) {
    return null;
  }

  // Step 1: Direct path match (existing behavior)
  const directMatch = matchCwdToProject(cwd, config);
  if (directMatch) {
    return {
      projectName: directMatch,
      effectiveCwd: cwd,
      isWorktreeResolved: false,
    };
  }

  // Step 2: Check global opt-out
  if (isWorktreeDetectionGloballyDisabled()) {
    return null;
  }

  // Step 3: Worktree detection
  const worktreeResult = await detectWorktreeMainPath(cwd);
  if (!worktreeResult) {
    return null;
  }

  // Step 4: Validate effectiveCwd
  const validatedPath = validateEffectiveCwd(worktreeResult.mainWorktreePath);
  if (!validatedPath) {
    return null;
  }

  // Step 5: Match effectiveCwd against code paths
  let bestMatch: string | null = null;
  let bestMatchLen = 0;

  for (const [name, project] of Object.entries(config.projects)) {
    if (!project || !project.code_path) {
      continue;
    }

    // Per-project opt-out check
    if (project.disableWorktreeDetection === true) {
      continue;
    }

    const projectPath = normalize(project.code_path);

    if (validatedPath === projectPath || validatedPath.startsWith(projectPath + sep)) {
      if (projectPath.length > bestMatchLen) {
        bestMatch = name;
        bestMatchLen = projectPath.length;
      }
    }
  }

  if (!bestMatch) {
    return null;
  }

  return {
    projectName: bestMatch,
    effectiveCwd: validatedPath,
    isWorktreeResolved: true,
  };
}

/**
 * Resolve project with full context including worktree detection.
 *
 * Same 6-level hierarchy as resolveProject, but the CWD matching step (level 5)
 * includes worktree fallback detection. Returns a CwdMatchResult with context
 * about how the project was resolved.
 *
 * @param optionsOrCwd - Resolution options object, or CWD string (backward compat)
 * @returns Match result with project name and context, or null
 *
 * @example
 * ```typescript
 * // Direct CWD match
 * const result = await resolveProjectWithContext({ cwd: "/Users/dev/brain/apps/mcp" });
 * // => { projectName: "brain", effectiveCwd: "/Users/dev/brain/apps/mcp", isWorktreeResolved: false }
 *
 * // Worktree fallback match
 * const result = await resolveProjectWithContext({ cwd: "/Users/dev/brain-feature-1/apps/mcp" });
 * // => { projectName: "brain", effectiveCwd: "/Users/dev/brain", isWorktreeResolved: true }
 * ```
 */
export async function resolveProjectWithContext(
  optionsOrCwd?: ResolveOptions | string,
): Promise<CwdMatchResult | null> {
  const options: ResolveOptions | undefined =
    typeof optionsOrCwd === "string" ? { cwd: optionsOrCwd } : optionsOrCwd;

  // 1. Explicit parameter always wins
  if (options?.explicit) {
    return {
      projectName: options.explicit,
      effectiveCwd: options.cwd || process.cwd(),
      isWorktreeResolved: false,
    };
  }

  // 2. Brain CLI active project
  const cliProject = getBrainCliActiveProject();
  if (cliProject) {
    return {
      projectName: cliProject,
      effectiveCwd: options?.cwd || process.cwd(),
      isWorktreeResolved: false,
    };
  }

  // 3. BRAIN_PROJECT env var
  if (process.env.BRAIN_PROJECT) {
    return {
      projectName: process.env.BRAIN_PROJECT,
      effectiveCwd: options?.cwd || process.cwd(),
      isWorktreeResolved: false,
    };
  }

  // 4. BM_PROJECT env var
  if (process.env.BM_PROJECT) {
    return {
      projectName: process.env.BM_PROJECT,
      effectiveCwd: options?.cwd || process.cwd(),
      isWorktreeResolved: false,
    };
  }

  // 5. CWD matching with worktree fallback
  const config = loadBrainConfig();
  const cwd = options?.cwd || process.cwd();
  return matchCwdToProjectWithContext(cwd, config);
}
