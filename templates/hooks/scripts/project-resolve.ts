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
 *    5a. Direct path match
 *    5b. Worktree fallback (if direct fails and not disabled)
 * 6. Empty string (caller shows error)
 */
import { dirname, join, resolve, sep, normalize } from "path";

/** Get home directory using Bun env. */
function homedir(): string {
  return Bun.env.HOME || "/tmp";
}
import type {
  BrainConfig,
  BrainProjectConfig,
  CwdMatchResult,
  WorktreeDetectionResult,
} from "./types";

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
    const config = (await configFile.json()) as BrainConfig;
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

// === Worktree Detection (DESIGN-002 Algorithm) ===

/** Timeout for git subprocess in milliseconds. */
const GIT_SUBPROCESS_TIMEOUT_MS = 3000;

/**
 * Check if worktree detection is disabled via env var or per-project config.
 *
 * Priority:
 * 1. BRAIN_DISABLE_WORKTREE_DETECTION=1 env var (global kill switch)
 * 2. Per-project disableWorktreeDetection config
 */
export function isWorktreeDetectionDisabled(
  projects: Record<string, BrainProjectConfig>,
): boolean {
  // Level 2: Global env var kill switch (checked first, highest priority)
  if (getEnv("BRAIN_DISABLE_WORKTREE_DETECTION") === "1") {
    return true;
  }

  // Level 1: Per-project config is checked at match time, not here
  // (we don't know which project yet at this stage)
  // This function checks global disable only. Per-project is checked
  // after a worktree match candidate is found.
  return false;
}

/**
 * Check if a specific project has worktree detection disabled.
 */
function isProjectWorktreeDisabled(project: BrainProjectConfig): boolean {
  return project.disableWorktreeDetection === true;
}

/**
 * Fast pre-check: walk up from cwd looking for .git file or directory.
 * Returns null if not in a git repo.
 *
 * DESIGN-002 Step 1: .git as a FILE indicates a possible linked worktree.
 * .git as a DIRECTORY indicates main worktree or standalone repo.
 *
 * Uses Bun.spawnSync with POSIX `test` for reliable sync file/dir checks.
 */
function findGitDir(startPath: string): { path: string; isFile: boolean } | null {
  let current = resolve(startPath);
  const root = resolve("/");

  while (current !== root) {
    const gitPath = join(current, ".git");

    // Check if .git is a regular file (worktree pointer)
    if (Bun.spawnSync(["test", "-f", gitPath]).exitCode === 0) {
      return { path: gitPath, isFile: true };
    }

    // Check if .git is a directory (main worktree or standalone repo)
    if (Bun.spawnSync(["test", "-d", gitPath]).exitCode === 0) {
      return { path: gitPath, isFile: false };
    }

    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

/**
 * Detect if cwd is inside a linked git worktree and return the main worktree path.
 *
 * Algorithm from DESIGN-002:
 * 1. Fast pre-check for .git
 * 2. Spawn git rev-parse subprocess
 * 3. Parse commonDir, gitDir, isBare
 * 4. Validate (reject bare repos)
 * 5. Compare paths (same = main worktree, different = linked)
 * 6. Derive main path from commonDir
 * 7. Return result
 *
 * Returns null for: not a git repo, main worktree, bare repo, errors, timeouts.
 */
export function detectWorktreeMainPath(
  cwd: string,
): WorktreeDetectionResult | null {
  // Step 1: Fast pre-check
  const gitInfo = findGitDir(cwd);
  if (!gitInfo) {
    return null; // Not a git repo
  }

  // Step 2: Spawn git subprocess using Bun.spawnSync
  let stdout: string;
  try {
    const result = Bun.spawnSync(
      [
        "git",
        "rev-parse",
        "--path-format=absolute",
        "--git-common-dir",
        "--git-dir",
        "--is-bare-repository",
      ],
      {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
        timeout: GIT_SUBPROCESS_TIMEOUT_MS,
      },
    );

    if (result.exitCode !== 0) {
      return null; // Git not installed, too old, or failed
    }

    stdout = result.stdout.toString().trim();
  } catch {
    // Git not installed (ENOENT) or other spawn failure
    return null;
  }

  // Step 3: Parse output - expect exactly 3 lines
  const lines = stdout.split("\n");
  if (lines.length !== 3) {
    return null; // Unexpected output format
  }

  const commonDir = lines[0].trim();
  const gitDir = lines[1].trim();
  const isBare = lines[2].trim();

  // Step 4: Validate - reject bare repos
  if (isBare === "true") {
    return null;
  }

  // Step 5: Compare paths (normalize to handle trailing slashes and symlinks)
  // Use Bun.spawnSync(["realpath", ...]) for symlink resolution
  let normalizedCommon: string;
  let normalizedGitDir: string;
  try {
    const rpCommon = Bun.spawnSync(["realpath", commonDir], { stdout: "pipe", stderr: "pipe" });
    const rpGitDir = Bun.spawnSync(["realpath", gitDir], { stdout: "pipe", stderr: "pipe" });
    if (rpCommon.exitCode === 0 && rpGitDir.exitCode === 0) {
      normalizedCommon = rpCommon.stdout.toString().trim();
      normalizedGitDir = rpGitDir.stdout.toString().trim();
    } else {
      normalizedCommon = normalize(resolve(commonDir));
      normalizedGitDir = normalize(resolve(gitDir));
    }
  } catch {
    // Path resolution failed (broken worktree, deleted main repo)
    try {
      normalizedCommon = normalize(resolve(commonDir));
      normalizedGitDir = normalize(resolve(gitDir));
    } catch {
      return null;
    }
  }

  if (normalizedCommon === normalizedGitDir) {
    return null; // Main worktree, not linked
  }

  // Step 6: Derive main worktree path
  // commonDir is /path/to/main-repo/.git, dirname gives /path/to/main-repo
  const mainWorktreePath = dirname(normalizedCommon);

  // Step 7: Return result
  return { mainWorktreePath, isLinkedWorktree: true };
}

/**
 * Validate effectiveCwd for security concerns.
 * Checks for null bytes, path traversal, and blocked system paths.
 * Returns the normalized path if valid, null if rejected.
 */
export function validateEffectiveCwd(effectiveCwd: string): string | null {
  if (!effectiveCwd || effectiveCwd.trim() === "") {
    return null;
  }

  // Null byte check
  if (effectiveCwd.includes("\0")) {
    console.error(
      "[WARN] effectiveCwd contains null bytes, rejecting:",
      effectiveCwd,
    );
    return null;
  }

  // Path traversal check (before normalization)
  if (
    effectiveCwd.includes("..") ||
    effectiveCwd.includes("%2e%2e") ||
    effectiveCwd.includes("%2E%2E")
  ) {
    console.error(
      "[WARN] effectiveCwd contains traversal sequences, rejecting:",
      effectiveCwd,
    );
    return null;
  }

  // Normalize and resolve
  let normalizedPath: string;
  try {
    normalizedPath = normalize(resolve(effectiveCwd));
  } catch {
    console.error("[WARN] Failed to normalize effectiveCwd:", effectiveCwd);
    return null;
  }

  // Blocked system paths (Unix)
  const blockedPaths = [
    "/etc",
    "/usr",
    "/var",
    "/bin",
    "/sbin",
    "/lib",
    "/lib64",
    "/boot",
    "/dev",
    "/proc",
    "/sys",
    "/run",
    "/tmp",
    "/root",
  ];
  const lowerPath = normalizedPath.toLowerCase();
  for (const blocked of blockedPaths) {
    if (
      lowerPath === blocked ||
      lowerPath.startsWith(blocked + sep)
    ) {
      console.error(
        "[WARN] effectiveCwd resolves to blocked system path:",
        normalizedPath,
      );
      return null;
    }
  }

  return normalizedPath;
}

// === CWD Matching with Worktree Fallback ===

/**
 * Match CWD against configured code paths (direct match only).
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
 * Match CWD against configured code paths with worktree fallback.
 * Returns a CwdMatchResult with context about how the match was made.
 *
 * Algorithm from DESIGN-002 integration spec:
 * 1. Try direct path match (existing behavior)
 * 2. If no match, check opt-out settings
 * 3. Run worktree detection
 * 4. Validate effectiveCwd
 * 5. Try matching effectiveCwd against code paths
 */
export function matchCwdToProjectWithContext(
  cwd: string,
  projects: Record<string, BrainProjectConfig>,
): CwdMatchResult | null {
  if (!cwd || Object.keys(projects).length === 0) return null;

  // Step 1: Direct path match (existing behavior)
  const directMatch = matchCwdToProject(cwd, projects);
  if (directMatch) {
    return {
      projectName: directMatch,
      effectiveCwd: cwd,
      isWorktreeResolved: false,
    };
  }

  // Step 2: Check global opt-out
  if (isWorktreeDetectionDisabled(projects)) {
    return null;
  }

  // Step 3: Worktree detection
  const worktreeResult = detectWorktreeMainPath(cwd);
  if (!worktreeResult) {
    return null;
  }

  // Step 4: Validate effectiveCwd
  const validatedPath = validateEffectiveCwd(worktreeResult.mainWorktreePath);
  if (!validatedPath) {
    return null;
  }

  // Step 5: Match effectiveCwd against code paths
  const normalizedEffective = normalize(resolve(validatedPath));
  let bestMatch = "";
  let bestMatchLen = 0;

  for (const [projectName, project] of Object.entries(projects)) {
    if (!project.code_path) continue;

    // Per-project opt-out check
    if (isProjectWorktreeDisabled(project)) continue;

    const projectPath = normalize(resolve(project.code_path));

    if (
      normalizedEffective === projectPath ||
      normalizedEffective.startsWith(projectPath + sep)
    ) {
      if (projectPath.length > bestMatchLen) {
        bestMatch = projectName;
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

/**
 * Resolve project with full context including worktree detection.
 * Returns a CwdMatchResult with information about how resolution happened.
 *
 * This is the new public API that provides worktree-aware resolution.
 * Callers that need to know if resolution was via worktree should use this.
 */
export async function resolveProjectWithContext(
  explicit: string,
  cwd: string,
): Promise<CwdMatchResult | null> {
  // First: env var resolution (no worktree needed)
  const envProject = resolveProjectFromEnv(explicit);
  if (envProject) {
    return {
      projectName: envProject,
      effectiveCwd: cwd || process.cwd(),
      isWorktreeResolved: false,
    };
  }

  // Second: CWD matching with worktree fallback
  const config = await loadBrainConfig();
  if (!config) return null;

  const resolvedCwd = cwd || process.cwd();
  return matchCwdToProjectWithContext(resolvedCwd, config.projects);
}
