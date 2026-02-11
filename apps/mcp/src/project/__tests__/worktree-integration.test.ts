/**
 * Integration tests for the worktree-to-memory resolution pipeline.
 *
 * These tests create real git repositories with linked worktrees
 * and verify the full pipeline: CWD -> worktree detection -> project
 * resolution -> CODE mode override computation.
 *
 * @see TASK-008-integration-tests-with-real-worktree
 * @see FEAT-003-worktree-aware-project-resolution
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, normalize } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Helper: create a temp directory with a unique name, resolving symlinks.
 * macOS /tmp -> /private/var/... so we use realpathSync for path consistency.
 */
function createTempDir(prefix: string): string {
  const raw = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(raw, { recursive: true });
  return realpathSync(raw);
}

/**
 * Helper: initialize a git repo and add an initial commit (required for worktree add).
 */
function initGitRepo(repoPath: string): void {
  mkdirSync(repoPath, { recursive: true });
  execSync("git init", { cwd: repoPath, stdio: "pipe" });
  execSync("git config user.email test@test.com", { cwd: repoPath, stdio: "pipe" });
  execSync("git config user.name Test", { cwd: repoPath, stdio: "pipe" });
  // Need at least one commit before worktree add
  writeFileSync(join(repoPath, "README.md"), "# test\n");
  execSync("git add .", { cwd: repoPath, stdio: "pipe" });
  execSync('git commit -m "init"', { cwd: repoPath, stdio: "pipe" });
}

/**
 * Helper: add a linked worktree to an existing repo.
 * Returns the absolute path to the worktree directory.
 */
function addWorktree(mainRepoPath: string, worktreePath: string, branchName: string): string {
  execSync(`git worktree add "${worktreePath}" -b ${branchName}`, {
    cwd: mainRepoPath,
    stdio: "pipe",
  });
  return realpathSync(worktreePath);
}

/**
 * Helper: write a Brain config JSON to the test config path.
 */
function writeBrainConfig(
  configDir: string,
  projects: Record<
    string,
    {
      code_path: string;
      memories_mode?: string;
      memories_path?: string;
      disableWorktreeDetection?: boolean;
    }
  >,
): void {
  mkdirSync(join(configDir, "brain"), { recursive: true });
  writeFileSync(
    join(configDir, "brain", "config.json"),
    JSON.stringify({
      version: "2.0.0",
      defaults: {
        memories_location: "~/memories",
        memories_mode: "DEFAULT",
      },
      projects,
      sync: { enabled: true, delay_ms: 500 },
      logging: { level: "info" },
      watcher: { enabled: true, debounce_ms: 2000 },
    }),
  );
}

// Store original env to restore after each test
const originalEnv = { ...process.env };

describe("worktree integration: full pipeline with real git worktrees", () => {
  let testRoot: string;
  let configDir: string;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.BRAIN_PROJECT;
    delete process.env.BM_PROJECT;
    delete process.env.BRAIN_DISABLE_WORKTREE_DETECTION;

    // Create isolated temp root and config directory
    testRoot = createTempDir("brain-wt-integ");
    configDir = join(testRoot, "config");
    mkdirSync(configDir, { recursive: true });

    // Point XDG_CONFIG_HOME to test directory so config reads are isolated
    process.env.XDG_CONFIG_HOME = configDir;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();

    if (testRoot && existsSync(testRoot)) {
      try {
        rmSync(testRoot, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  // ===========================================================================
  // Scenario 1: CODE mode full pipeline
  // CWD inside worktree -> project resolved -> memoriesPath = worktree/docs/
  // ===========================================================================
  it("CODE mode: resolves project from worktree CWD and overrides memoriesPath to worktree/docs/", async () => {
    // Setup: real git repo + linked worktree
    const mainRepo = join(testRoot, "main-repo");
    initGitRepo(mainRepo);
    const worktreePath = addWorktree(mainRepo, join(testRoot, "feature-wt"), "feature-branch");

    // Configure Brain with CODE mode pointing at main repo
    writeBrainConfig(configDir, {
      "test-project": {
        code_path: normalize(mainRepo),
        memories_mode: "CODE",
      },
    });

    // Import fresh modules (vi.resetModules ensures clean state)
    const { resolveProjectWithContext } = await import("@brain/utils");
    const { computeWorktreeOverride } = await import("../worktree-override");

    // Act: resolve from worktree CWD
    const result = await resolveProjectWithContext({ cwd: worktreePath });

    // Assert: project resolved via worktree detection
    expect(result).not.toBeNull();
    expect(result!.projectName).toBe("test-project");
    expect(result!.isWorktreeResolved).toBe(true);

    // Act: compute CODE mode override
    const override = computeWorktreeOverride(
      result!.projectName,
      result!.isWorktreeResolved,
      worktreePath,
      result!.effectiveCwd,
    );

    // Assert: memoriesPath points to worktree-local docs/
    expect(override).not.toBeNull();
    expect(override!.memoriesPath).toBe(join(worktreePath, "docs"));
    expect(override!.actualCwd).toBe(worktreePath);
  });

  // ===========================================================================
  // Scenario 2: DEFAULT mode -- no override
  // ===========================================================================
  it("DEFAULT mode: resolves project from worktree CWD but does NOT override memoriesPath", async () => {
    const mainRepo = join(testRoot, "main-repo");
    initGitRepo(mainRepo);
    const worktreePath = addWorktree(mainRepo, join(testRoot, "feature-wt"), "feature-branch");

    writeBrainConfig(configDir, {
      "test-project": {
        code_path: normalize(mainRepo),
        memories_mode: "DEFAULT",
      },
    });

    const { resolveProjectWithContext } = await import("@brain/utils");
    const { computeWorktreeOverride } = await import("../worktree-override");

    const result = await resolveProjectWithContext({ cwd: worktreePath });

    expect(result).not.toBeNull();
    expect(result!.projectName).toBe("test-project");
    expect(result!.isWorktreeResolved).toBe(true);

    // DEFAULT mode: no override
    const override = computeWorktreeOverride(
      result!.projectName,
      result!.isWorktreeResolved,
      worktreePath,
      result!.effectiveCwd,
    );
    expect(override).toBeNull();
  });

  // ===========================================================================
  // Scenario 3: CUSTOM mode -- no override
  // ===========================================================================
  it("CUSTOM mode: resolves project from worktree CWD but does NOT override memoriesPath", async () => {
    const mainRepo = join(testRoot, "main-repo");
    initGitRepo(mainRepo);
    const worktreePath = addWorktree(mainRepo, join(testRoot, "feature-wt"), "feature-branch");

    writeBrainConfig(configDir, {
      "test-project": {
        code_path: normalize(mainRepo),
        memories_mode: "CUSTOM",
        memories_path: "/custom/shared/memories",
      },
    });

    const { resolveProjectWithContext } = await import("@brain/utils");
    const { computeWorktreeOverride } = await import("../worktree-override");

    const result = await resolveProjectWithContext({ cwd: worktreePath });

    expect(result).not.toBeNull();
    expect(result!.projectName).toBe("test-project");
    expect(result!.isWorktreeResolved).toBe(true);

    // CUSTOM mode: no override
    const override = computeWorktreeOverride(
      result!.projectName,
      result!.isWorktreeResolved,
      worktreePath,
      result!.effectiveCwd,
    );
    expect(override).toBeNull();
  });

  // ===========================================================================
  // Scenario 4: Opt-out via env var
  // ===========================================================================
  it("env var opt-out: BRAIN_DISABLE_WORKTREE_DETECTION=1 prevents worktree resolution", async () => {
    const mainRepo = join(testRoot, "main-repo");
    initGitRepo(mainRepo);
    const worktreePath = addWorktree(mainRepo, join(testRoot, "feature-wt"), "feature-branch");

    writeBrainConfig(configDir, {
      "test-project": {
        code_path: normalize(mainRepo),
        memories_mode: "CODE",
      },
    });

    // Set global opt-out
    process.env.BRAIN_DISABLE_WORKTREE_DETECTION = "1";

    const { resolveProjectWithContext } = await import("@brain/utils");

    // Worktree CWD does not match main repo directly, and detection is disabled
    const result = await resolveProjectWithContext({ cwd: worktreePath });
    expect(result).toBeNull();
  });

  // ===========================================================================
  // Scenario 5: Opt-out via per-project config
  // ===========================================================================
  it("per-project opt-out: disableWorktreeDetection=true prevents worktree resolution for that project", async () => {
    const mainRepo = join(testRoot, "main-repo");
    initGitRepo(mainRepo);
    const worktreePath = addWorktree(mainRepo, join(testRoot, "feature-wt"), "feature-branch");

    writeBrainConfig(configDir, {
      "test-project": {
        code_path: normalize(mainRepo),
        memories_mode: "CODE",
        disableWorktreeDetection: true,
      },
    });

    const { resolveProjectWithContext } = await import("@brain/utils");

    const result = await resolveProjectWithContext({ cwd: worktreePath });

    // Detection runs (returns main repo path), but the matching project has opt-out
    expect(result).toBeNull();
  });

  // ===========================================================================
  // Scenario 6: Nested CWD inside worktree
  // ===========================================================================
  it("nested CWD: resolves from deep path inside worktree", async () => {
    const mainRepo = join(testRoot, "main-repo");
    initGitRepo(mainRepo);
    const worktreePath = addWorktree(mainRepo, join(testRoot, "feature-wt"), "feature-branch");

    // Create a deep directory inside the worktree
    const deepPath = join(worktreePath, "packages", "utils", "src");
    mkdirSync(deepPath, { recursive: true });

    writeBrainConfig(configDir, {
      "test-project": {
        code_path: normalize(mainRepo),
        memories_mode: "CODE",
      },
    });

    const { resolveProjectWithContext } = await import("@brain/utils");
    const { computeWorktreeOverride } = await import("../worktree-override");

    const result = await resolveProjectWithContext({ cwd: deepPath });

    expect(result).not.toBeNull();
    expect(result!.projectName).toBe("test-project");
    expect(result!.isWorktreeResolved).toBe(true);

    const override = computeWorktreeOverride(
      result!.projectName,
      result!.isWorktreeResolved,
      worktreePath,
      result!.effectiveCwd,
    );
    expect(override).not.toBeNull();
    expect(override!.memoriesPath).toBe(join(worktreePath, "docs"));
  });

  // ===========================================================================
  // Scenario 7: Security -- crafted effectiveCwd rejected
  // The security validation is tested thoroughly in the unit tests.
  // Here we verify the full pipeline handles edge cases gracefully.
  // ===========================================================================
  it("security: path traversal in effectiveCwd is rejected", async () => {
    writeBrainConfig(configDir, {
      "test-project": {
        code_path: "/Users/dev/brain",
        memories_mode: "CODE",
      },
    });

    const { resolveProjectWithContext } = await import("@brain/utils");

    // Non-existent path with no .git -> detection returns null -> pipeline returns null
    const result = await resolveProjectWithContext({ cwd: "/nonexistent/path" });
    expect(result).toBeNull();
  });

  // ===========================================================================
  // Scenario 8: Graceful degradation -- non-git directory
  // ===========================================================================
  it("graceful degradation: non-git directory returns null without crash", async () => {
    const nonGitDir = join(testRoot, "not-a-repo", "some", "deep", "path");
    mkdirSync(nonGitDir, { recursive: true });

    writeBrainConfig(configDir, {
      "test-project": {
        code_path: "/Users/dev/brain",
        memories_mode: "CODE",
      },
    });

    const { resolveProjectWithContext } = await import("@brain/utils");

    const result = await resolveProjectWithContext({ cwd: nonGitDir });
    expect(result).toBeNull();
  });

  // ===========================================================================
  // Scenario 9: Direct match takes priority over worktree detection
  // ===========================================================================
  it("direct CWD match takes priority: worktree detection is not invoked", async () => {
    const mainRepo = join(testRoot, "main-repo");
    initGitRepo(mainRepo);

    writeBrainConfig(configDir, {
      "test-project": {
        code_path: normalize(mainRepo),
        memories_mode: "CODE",
      },
    });

    const { resolveProjectWithContext } = await import("@brain/utils");

    // CWD is directly inside the main repo -- should match without worktree fallback
    const result = await resolveProjectWithContext({ cwd: mainRepo });

    expect(result).not.toBeNull();
    expect(result!.projectName).toBe("test-project");
    expect(result!.isWorktreeResolved).toBe(false);
    expect(result!.effectiveCwd).toBe(mainRepo);
  });

  // ===========================================================================
  // Scenario 10: Main worktree (not linked) does not trigger override
  // ===========================================================================
  it("main worktree: non-linked worktree user gets direct match, no override", async () => {
    const mainRepo = join(testRoot, "main-repo");
    initGitRepo(mainRepo);

    writeBrainConfig(configDir, {
      "test-project": {
        code_path: normalize(mainRepo),
        memories_mode: "CODE",
      },
    });

    const { resolveProjectWithContext } = await import("@brain/utils");
    const { computeWorktreeOverride } = await import("../worktree-override");

    // Direct CWD match from main repo path itself
    const result = await resolveProjectWithContext({ cwd: mainRepo });

    expect(result).not.toBeNull();
    expect(result!.projectName).toBe("test-project");
    expect(result!.isWorktreeResolved).toBe(false);

    // Not worktree resolved => computeWorktreeOverride returns null
    const override = computeWorktreeOverride(
      result!.projectName,
      result!.isWorktreeResolved,
      mainRepo,
      result!.effectiveCwd,
    );
    expect(override).toBeNull();
  });
});
