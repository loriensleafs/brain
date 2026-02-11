/**
 * Tests for project-resolve.ts
 *
 * Ported from apps/claude-plugin/cmd/hooks/project_resolve_test.go (209 LOC).
 * Extended with worktree detection tests per DESIGN-002.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { join, resolve } from "path";
import { tmpdir } from "os";
import {
  resolveProjectFromEnv,
  resolveProjectWithCwd,
  resolveProjectFromCwd,
  resolveProjectWithContext,
  matchCwdToProjectWithContext,
  detectWorktreeMainPath,
  isWorktreeDetectionDisabled,
  validateEffectiveCwd,
  setGetEnv,
  setBrainConfigPath,
} from "../project-resolve.js";

/** Resolve symlinks using realpath command (macOS /var -> /private/var). */
function realpath(p: string): string {
  const result = Bun.spawnSync(["realpath", p], { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) return resolve(p);
  return result.stdout.toString().trim();
}

// Helpers
let origGetEnv: typeof import("../project-resolve.js").getEnv;
let origConfigPath: typeof import("../project-resolve.js").getBrainConfigPath;

function createTempConfig(content: string): string {
  const dir = join(tmpdir(), `brain-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  Bun.spawnSync(["mkdir", "-p", dir]);
  const configPath = join(dir, "config.json");
  Bun.spawnSync(["sh", "-c", `cat > "${configPath}"`], {
    stdin: new TextEncoder().encode(content),
  });
  return configPath;
}

/** Create a temporary directory and return its path. */
function createTempDir(suffix: string = ""): string {
  const dir = join(
    tmpdir(),
    `brain-wt-test-${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`,
  );
  Bun.spawnSync(["mkdir", "-p", dir]);
  return dir;
}

/** Clean up temp directories, ignoring errors. */
function cleanupDir(dir: string): void {
  Bun.spawnSync(["rm", "-rf", dir]);
}

/**
 * Create a real git repo for worktree testing.
 * Returns { mainDir, worktreeDir, cleanup }.
 */
function createGitWorktreeFixture(): {
  mainDir: string;
  worktreeDir: string;
  cleanup: () => void;
} {
  const baseDir = createTempDir("-wt-fixture");
  const mainDir = join(baseDir, "main-repo");
  const worktreeDir = join(baseDir, "linked-worktree");

  // Initialize a real git repo with a commit
  Bun.spawnSync(["mkdir", "-p", mainDir]);
  Bun.spawnSync(["git", "init"], { cwd: mainDir });
  Bun.spawnSync(["git", "config", "user.email", "test@test.com"], {
    cwd: mainDir,
  });
  Bun.spawnSync(["git", "config", "user.name", "Test"], { cwd: mainDir });
  Bun.spawnSync(["sh", "-c", `echo "# Test repo" > "${join(mainDir, "README.md")}"`]);
  Bun.spawnSync(["git", "add", "."], { cwd: mainDir });
  Bun.spawnSync(["git", "commit", "-m", "initial"], { cwd: mainDir });

  // Create a linked worktree
  Bun.spawnSync(["git", "worktree", "add", worktreeDir, "-b", "feature"], {
    cwd: mainDir,
  });

  return {
    mainDir,
    worktreeDir,
    cleanup: () => cleanupDir(baseDir),
  };
}

describe("resolveProjectFromEnv", () => {
  afterEach(() => {
    setGetEnv((key) => process.env[key] ?? "");
  });

  it("explicit parameter wins over env vars", () => {
    setGetEnv(() => "env-project");
    expect(resolveProjectFromEnv("explicit-project")).toBe("explicit-project");
  });

  it("resolves from BRAIN_PROJECT", () => {
    setGetEnv((key) => (key === "BRAIN_PROJECT" ? "brain-project" : ""));
    expect(resolveProjectFromEnv("")).toBe("brain-project");
  });

  it("resolves from BM_PROJECT", () => {
    setGetEnv((key) => (key === "BM_PROJECT" ? "bm-project" : ""));
    expect(resolveProjectFromEnv("")).toBe("bm-project");
  });

  it("resolves from BM_ACTIVE_PROJECT", () => {
    setGetEnv((key) => (key === "BM_ACTIVE_PROJECT" ? "active-project" : ""));
    expect(resolveProjectFromEnv("")).toBe("active-project");
  });

  it("BRAIN_PROJECT takes precedence over BM_PROJECT", () => {
    setGetEnv((key) => {
      if (key === "BRAIN_PROJECT") return "brain";
      if (key === "BM_PROJECT") return "bm";
      if (key === "BM_ACTIVE_PROJECT") return "active";
      return "";
    });
    expect(resolveProjectFromEnv("")).toBe("brain");
  });

  it("returns empty string when no env vars set", () => {
    setGetEnv(() => "");
    expect(resolveProjectFromEnv("")).toBe("");
  });
});

describe("resolveProjectWithCwd", () => {
  afterEach(() => {
    setGetEnv((key) => process.env[key] ?? "");
    setBrainConfigPath(() => "");
  });

  it("env var wins over CWD match", () => {
    setGetEnv((key) => (key === "BRAIN_PROJECT" ? "env-project" : ""));
    expect(resolveProjectWithCwd("", "/some/path")).toBe("env-project");
  });

  it("explicit wins over env and CWD", () => {
    setGetEnv((key) => (key === "BRAIN_PROJECT" ? "env-project" : ""));
    expect(resolveProjectWithCwd("explicit-project", "/some/path")).toBe(
      "explicit-project",
    );
  });

  it("falls back to CWD matching", () => {
    setGetEnv(() => "");
    const configPath = createTempConfig(
      JSON.stringify({
        version: "2.0.0",
        projects: {
          brain: { code_path: "/Users/peter.kloss/Dev/brain" },
        },
      }),
    );
    setBrainConfigPath(() => configPath);

    expect(
      resolveProjectWithCwd("", "/Users/peter.kloss/Dev/brain/apps/mcp"),
    ).toBe("brain");
  });
});

describe("resolveProjectFromCwd", () => {
  afterEach(() => {
    setBrainConfigPath(() => "");
  });

  it("matches exact project path", () => {
    const projectDir = join(tmpdir(), `brain-test-proj-${Date.now()}`);
    Bun.spawnSync(["mkdir", "-p", projectDir]);

    const configPath = createTempConfig(
      JSON.stringify({
        version: "2.0.0",
        projects: {
          "test-project": { code_path: projectDir },
        },
      }),
    );
    setBrainConfigPath(() => configPath);

    expect(resolveProjectFromCwd(projectDir)).toBe("test-project");
  });

  it("matches subdirectory of project path", () => {
    const projectDir = join(tmpdir(), `brain-test-proj-${Date.now()}`);
    const subDir = join(projectDir, "src", "lib");
    Bun.spawnSync(["mkdir", "-p", subDir]);

    const configPath = createTempConfig(
      JSON.stringify({
        version: "2.0.0",
        projects: {
          "test-project": { code_path: projectDir },
        },
      }),
    );
    setBrainConfigPath(() => configPath);

    expect(resolveProjectFromCwd(subDir)).toBe("test-project");
  });

  it("returns empty for non-matching path", () => {
    const configPath = createTempConfig(
      JSON.stringify({
        version: "2.0.0",
        projects: {
          "other-project": { code_path: "/some/other/path" },
        },
      }),
    );
    setBrainConfigPath(() => configPath);

    expect(resolveProjectFromCwd("/completely/different/path")).toBe("");
  });

  it("returns empty for empty config", () => {
    const configPath = createTempConfig(
      JSON.stringify({ version: "2.0.0", projects: {} }),
    );
    setBrainConfigPath(() => configPath);

    expect(resolveProjectFromCwd("/any/path")).toBe("");
  });
});

// === Worktree Detection Tests (DESIGN-002) ===

describe("detectWorktreeMainPath", () => {
  // Edge Case 1: Nested worktree paths
  it("detects worktree from nested subdirectory", () => {
    const fixture = createGitWorktreeFixture();
    try {
      const subDir = join(fixture.worktreeDir, "packages", "utils", "src");
      Bun.spawnSync(["mkdir", "-p", subDir]);

      const result = detectWorktreeMainPath(subDir);
      expect(result).not.toBeNull();
      expect(result!.isLinkedWorktree).toBe(true);
      // Use realpath for macOS /var -> /private/var symlink resolution
      expect(result!.mainWorktreePath).toBe(
        realpath(fixture.mainDir),
      );
    } finally {
      fixture.cleanup();
    }
  });

  // Edge Case 2: Main worktree user (not linked)
  it("returns null for main worktree (not linked)", () => {
    const fixture = createGitWorktreeFixture();
    try {
      const result = detectWorktreeMainPath(fixture.mainDir);
      expect(result).toBeNull();
    } finally {
      fixture.cleanup();
    }
  });

  // Edge Case 3: Not a git repo
  it("returns null for non-git directory", () => {
    const dir = createTempDir("-no-git");
    try {
      const result = detectWorktreeMainPath(dir);
      expect(result).toBeNull();
    } finally {
      cleanupDir(dir);
    }
  });

  // Edge Case 4: Git version too old (simulated - hard to test directly)
  // This is covered by the "git not installed" path since both produce
  // non-zero exit codes from the subprocess.

  // Edge Case 5: Network-mounted repository (timeout)
  // Cannot be reliably tested in unit tests; the 3s timeout is configured.

  // Edge Case 6: Bare repository
  it("returns null for bare repository", () => {
    const baseDir = createTempDir("-bare");
    const bareDir = join(baseDir, "bare.git");
    try {
      Bun.spawnSync(["git", "init", "--bare", bareDir]);
      const result = detectWorktreeMainPath(bareDir);
      expect(result).toBeNull();
    } finally {
      cleanupDir(baseDir);
    }
  });

  // Edge Case 7: Broken worktree (main repo deleted)
  it("returns null for broken worktree (main repo deleted)", () => {
    const fixture = createGitWorktreeFixture();
    try {
      // Delete the main repo, breaking the worktree
      Bun.spawnSync(["rm", "-rf", fixture.mainDir]);

      const result = detectWorktreeMainPath(fixture.worktreeDir);
      // Should return null because git rev-parse will fail or paths are broken
      // (exact behavior depends on git version, but should not crash)
      // The result is null because the .git file points to a deleted path
      expect(result).toBeNull();
    } finally {
      fixture.cleanup();
    }
  });

  // Edge Case 8: Symlinked paths
  it("handles symlinked worktree paths", () => {
    const fixture = createGitWorktreeFixture();
    const baseDir = createTempDir("-symlink");
    const symlinkPath = join(baseDir, "symlinked-worktree");
    try {
      Bun.spawnSync(["ln", "-s", fixture.worktreeDir, symlinkPath]);

      const result = detectWorktreeMainPath(symlinkPath);
      expect(result).not.toBeNull();
      expect(result!.isLinkedWorktree).toBe(true);
      expect(result!.mainWorktreePath).toBe(
        realpath(fixture.mainDir),
      );
    } finally {
      fixture.cleanup();
      cleanupDir(baseDir);
    }
  });

  // Linked worktree detection (happy path)
  it("detects linked worktree and returns main path", () => {
    const fixture = createGitWorktreeFixture();
    try {
      const result = detectWorktreeMainPath(fixture.worktreeDir);
      expect(result).not.toBeNull();
      expect(result!.isLinkedWorktree).toBe(true);
      expect(result!.mainWorktreePath).toBe(
        realpath(fixture.mainDir),
      );
    } finally {
      fixture.cleanup();
    }
  });

  // Standalone repo (no worktrees)
  it("returns null for standalone repo without worktrees", () => {
    const dir = createTempDir("-standalone");
    try {
      Bun.spawnSync(["git", "init"], { cwd: dir });
      Bun.spawnSync(["git", "config", "user.email", "test@test.com"], {
        cwd: dir,
      });
      Bun.spawnSync(["git", "config", "user.name", "Test"], { cwd: dir });
      Bun.spawnSync(["sh", "-c", `echo "hello" > "${join(dir, "file.txt")}"`]);
      Bun.spawnSync(["git", "add", "."], { cwd: dir });
      Bun.spawnSync(["git", "commit", "-m", "init"], { cwd: dir });

      const result = detectWorktreeMainPath(dir);
      expect(result).toBeNull();
    } finally {
      cleanupDir(dir);
    }
  });
});

describe("isWorktreeDetectionDisabled", () => {
  afterEach(() => {
    setGetEnv((key) => process.env[key] ?? "");
  });

  it("returns false by default (detection enabled)", () => {
    setGetEnv(() => "");
    expect(isWorktreeDetectionDisabled({})).toBe(false);
  });

  it("returns true when BRAIN_DISABLE_WORKTREE_DETECTION=1", () => {
    setGetEnv((key) =>
      key === "BRAIN_DISABLE_WORKTREE_DETECTION" ? "1" : "",
    );
    expect(isWorktreeDetectionDisabled({})).toBe(true);
  });

  it("returns false when env var is empty", () => {
    setGetEnv(() => "");
    expect(isWorktreeDetectionDisabled({})).toBe(false);
  });

  it("returns false when env var is '0'", () => {
    setGetEnv((key) =>
      key === "BRAIN_DISABLE_WORKTREE_DETECTION" ? "0" : "",
    );
    expect(isWorktreeDetectionDisabled({})).toBe(false);
  });
});

describe("validateEffectiveCwd", () => {
  it("returns normalized path for valid path", () => {
    const result = validateEffectiveCwd("/Users/test/project");
    expect(result).toBe(resolve("/Users/test/project"));
  });

  it("returns null for empty path", () => {
    expect(validateEffectiveCwd("")).toBeNull();
  });

  it("returns null for whitespace-only path", () => {
    expect(validateEffectiveCwd("   ")).toBeNull();
  });

  it("rejects paths with null bytes", () => {
    expect(validateEffectiveCwd("/Users/test\0/evil")).toBeNull();
  });

  it("rejects paths with traversal sequences", () => {
    expect(validateEffectiveCwd("/Users/test/../etc/passwd")).toBeNull();
  });

  it("rejects paths with encoded traversal", () => {
    expect(validateEffectiveCwd("/Users/test/%2e%2e/etc")).toBeNull();
  });

  it("rejects blocked system paths", () => {
    expect(validateEffectiveCwd("/etc/passwd")).toBeNull();
    expect(validateEffectiveCwd("/usr/local/bin")).toBeNull();
    expect(validateEffectiveCwd("/tmp/something")).toBeNull();
  });

  it("accepts normal user paths", () => {
    expect(validateEffectiveCwd("/home/user/project")).not.toBeNull();
    expect(validateEffectiveCwd("/Users/dev/brain")).not.toBeNull();
  });
});

describe("matchCwdToProjectWithContext", () => {
  afterEach(() => {
    setGetEnv((key) => process.env[key] ?? "");
  });

  it("returns direct match with isWorktreeResolved=false", () => {
    const projects = {
      brain: { code_path: "/Users/dev/brain" },
    };
    const result = matchCwdToProjectWithContext(
      "/Users/dev/brain/apps/mcp",
      projects,
    );
    expect(result).not.toBeNull();
    expect(result!.projectName).toBe("brain");
    expect(result!.isWorktreeResolved).toBe(false);
    expect(result!.effectiveCwd).toBe("/Users/dev/brain/apps/mcp");
  });

  it("returns null for non-matching path in non-git dir", () => {
    const dir = createTempDir("-nomatch");
    try {
      const projects = {
        brain: { code_path: "/Users/dev/brain" },
      };
      const result = matchCwdToProjectWithContext(dir, projects);
      expect(result).toBeNull();
    } finally {
      cleanupDir(dir);
    }
  });

  it("returns null when empty projects", () => {
    const result = matchCwdToProjectWithContext("/any/path", {});
    expect(result).toBeNull();
  });

  it("falls back to worktree detection for linked worktree", () => {
    const fixture = createGitWorktreeFixture();
    try {
      setGetEnv(() => "");
      // Use realpath for code_path to match what detectWorktreeMainPath returns
      const realMainDir = realpath(fixture.mainDir);
      const projects = {
        "test-project": { code_path: realMainDir },
      };
      const result = matchCwdToProjectWithContext(
        fixture.worktreeDir,
        projects,
      );
      expect(result).not.toBeNull();
      expect(result!.projectName).toBe("test-project");
      expect(result!.isWorktreeResolved).toBe(true);
      expect(result!.effectiveCwd).toBe(realMainDir);
    } finally {
      fixture.cleanup();
    }
  });

  it("skips worktree detection when globally disabled", () => {
    const fixture = createGitWorktreeFixture();
    try {
      setGetEnv((key) =>
        key === "BRAIN_DISABLE_WORKTREE_DETECTION" ? "1" : "",
      );
      const projects = {
        "test-project": { code_path: realpath(fixture.mainDir) },
      };
      const result = matchCwdToProjectWithContext(
        fixture.worktreeDir,
        projects,
      );
      expect(result).toBeNull();
    } finally {
      fixture.cleanup();
    }
  });

  it("skips project with disableWorktreeDetection=true", () => {
    const fixture = createGitWorktreeFixture();
    try {
      setGetEnv(() => "");
      const projects = {
        "test-project": {
          code_path: realpath(fixture.mainDir),
          disableWorktreeDetection: true,
        },
      };
      const result = matchCwdToProjectWithContext(
        fixture.worktreeDir,
        projects,
      );
      expect(result).toBeNull();
    } finally {
      fixture.cleanup();
    }
  });

  it("matches deepest project path with worktree", () => {
    const fixture = createGitWorktreeFixture();
    try {
      setGetEnv(() => "");
      // Create a parent path project and a more specific one
      const realMainDir = realpath(fixture.mainDir);
      const parentDir = resolve(realMainDir, "..");
      const projects = {
        parent: { code_path: parentDir },
        specific: { code_path: realMainDir },
      };
      const result = matchCwdToProjectWithContext(
        fixture.worktreeDir,
        projects,
      );
      expect(result).not.toBeNull();
      expect(result!.projectName).toBe("specific");
    } finally {
      fixture.cleanup();
    }
  });
});

describe("resolveProjectWithContext", () => {
  afterEach(() => {
    setGetEnv((key) => process.env[key] ?? "");
    setBrainConfigPath(() => "");
  });

  it("returns env var match with isWorktreeResolved=false", async () => {
    setGetEnv((key) => (key === "BRAIN_PROJECT" ? "env-project" : ""));
    const result = await resolveProjectWithContext("", "/some/path");
    expect(result).not.toBeNull();
    expect(result!.projectName).toBe("env-project");
    expect(result!.isWorktreeResolved).toBe(false);
  });

  it("returns explicit match with isWorktreeResolved=false", async () => {
    const result = await resolveProjectWithContext("explicit", "/some/path");
    expect(result).not.toBeNull();
    expect(result!.projectName).toBe("explicit");
    expect(result!.isWorktreeResolved).toBe(false);
  });

  it("returns null for no config and no env", async () => {
    setGetEnv(() => "");
    setBrainConfigPath(() => "/nonexistent/config.json");
    const dir = createTempDir("-no-config");
    try {
      const result = await resolveProjectWithContext("", dir);
      expect(result).toBeNull();
    } finally {
      cleanupDir(dir);
    }
  });

  it("resolves via worktree when direct match fails", async () => {
    const fixture = createGitWorktreeFixture();
    try {
      setGetEnv(() => "");
      const realMainDir = realpath(fixture.mainDir);
      const configPath = createTempConfig(
        JSON.stringify({
          version: "2.0.0",
          projects: {
            "test-project": { code_path: realMainDir },
          },
        }),
      );
      setBrainConfigPath(() => configPath);

      const result = await resolveProjectWithContext(
        "",
        fixture.worktreeDir,
      );
      expect(result).not.toBeNull();
      expect(result!.projectName).toBe("test-project");
      expect(result!.isWorktreeResolved).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });
});
