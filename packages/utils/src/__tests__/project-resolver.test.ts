import { existsSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, normalize } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Store original env
const originalEnv = { ...process.env };

describe("project-resolver", () => {
  let testDir: string;
  let testConfigPath: string;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    // Clear project-related env vars
    delete process.env.BRAIN_PROJECT;
    delete process.env.BM_PROJECT;

    // Create unique temp directory for each test
    testDir = join(tmpdir(), `brain-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(testDir, "brain"), { recursive: true });
    testConfigPath = join(testDir, "brain", "config.json");

    // Point XDG_CONFIG_HOME to test directory
    process.env.XDG_CONFIG_HOME = testDir;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();

    // Clean up test directory
    if (testDir && existsSync(testDir)) {
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("getBrainConfigPath", () => {
    it("returns XDG-compliant path", async () => {
      const { getBrainConfigPath } = await import("../project-resolver");
      const configPath = getBrainConfigPath();
      expect(configPath).toBe(testConfigPath);
    });

    it("uses XDG_CONFIG_HOME when set", async () => {
      process.env.XDG_CONFIG_HOME = "/custom/config";
      const { getBrainConfigPath } = await import("../project-resolver");
      const configPath = getBrainConfigPath();
      expect(configPath).toBe("/custom/config/brain/config.json");
    });
  });

  describe("loadBrainConfig", () => {
    it("returns null when config does not exist", async () => {
      const { loadBrainConfig } = await import("../project-resolver");
      const config = loadBrainConfig();
      expect(config).toBeNull();
    });

    it("loads valid config", async () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify({
          version: "2.0.0",
          projects: {
            brain: { code_path: "/Users/dev/brain" },
          },
        }),
      );

      const { loadBrainConfig } = await import("../project-resolver");
      const config = loadBrainConfig();

      expect(config).not.toBeNull();
      expect(config?.version).toBe("2.0.0");
      expect(config?.projects.brain.code_path).toBe("/Users/dev/brain");
    });

    it("throws on invalid JSON", async () => {
      writeFileSync(testConfigPath, "not valid json");

      const { loadBrainConfig } = await import("../project-resolver");

      expect(() => loadBrainConfig()).toThrow();
    });
  });

  describe("resolveProject", () => {
    it("returns null when config does not exist and no env vars", async () => {
      const { resolveProject } = await import("../project-resolver");
      const result = resolveProject({ cwd: "/Users/dev/brain" });
      expect(result).toBeNull();
    });

    it("explicit parameter wins over everything", async () => {
      process.env.BRAIN_PROJECT = "env-project";
      writeFileSync(
        testConfigPath,
        JSON.stringify({
          version: "2.0.0",
          projects: {
            brain: { code_path: "/Users/dev/brain" },
          },
        }),
      );

      const { resolveProject } = await import("../project-resolver");
      const result = resolveProject({
        explicit: "explicit-project",
        cwd: "/Users/dev/brain",
      });
      expect(result).toBe("explicit-project");
    });

    it("BRAIN_PROJECT env var wins over BM_PROJECT", async () => {
      process.env.BRAIN_PROJECT = "brain-env";
      process.env.BM_PROJECT = "bm-env";

      const { resolveProject } = await import("../project-resolver");
      const result = resolveProject();
      expect(result).toBe("brain-env");
    });

    it("BM_PROJECT env var works as fallback", async () => {
      process.env.BM_PROJECT = "bm-env";

      const { resolveProject } = await import("../project-resolver");
      const result = resolveProject();
      expect(result).toBe("bm-env");
    });

    it("falls back to CWD matching when no env vars", async () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify({
          version: "2.0.0",
          projects: {
            brain: { code_path: "/Users/dev/brain" },
          },
        }),
      );

      const { resolveProject } = await import("../project-resolver");
      const result = resolveProject({ cwd: "/Users/dev/brain/apps/mcp" });
      expect(result).toBe("brain");
    });

    it("accepts string shorthand for cwd (backward compat)", async () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify({
          version: "2.0.0",
          projects: {
            brain: { code_path: "/Users/dev/brain" },
          },
        }),
      );

      const { resolveProject } = await import("../project-resolver");
      // Pass string directly instead of options object
      const result = resolveProject("/Users/dev/brain/apps/mcp");
      expect(result).toBe("brain");
    });

    it("returns null when no match found", async () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify({
          version: "2.0.0",
          projects: {
            brain: { code_path: "/Users/dev/brain" },
          },
        }),
      );

      const { resolveProject } = await import("../project-resolver");
      const result = resolveProject({ cwd: "/Users/dev/other" });
      expect(result).toBeNull();
    });
  });

  describe("resolveProjectFromCwd", () => {
    it("returns null when config does not exist", async () => {
      const { resolveProjectFromCwd } = await import("../project-resolver");
      const result = resolveProjectFromCwd("/Users/dev/brain");
      expect(result).toBeNull();
    });

    it("returns null when no projects configured", async () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify({
          version: "2.0.0",
          projects: {},
        }),
      );

      const { resolveProjectFromCwd } = await import("../project-resolver");
      const result = resolveProjectFromCwd("/Users/dev/brain");
      expect(result).toBeNull();
    });

    it("matches exact path", async () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify({
          version: "2.0.0",
          projects: {
            brain: { code_path: "/Users/dev/brain" },
          },
        }),
      );

      const { resolveProjectFromCwd } = await import("../project-resolver");
      const result = resolveProjectFromCwd("/Users/dev/brain");
      expect(result).toBe("brain");
    });

    it("matches subdirectory", async () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify({
          version: "2.0.0",
          projects: {
            brain: { code_path: "/Users/dev/brain" },
          },
        }),
      );

      const { resolveProjectFromCwd } = await import("../project-resolver");
      const result = resolveProjectFromCwd("/Users/dev/brain/apps/mcp");
      expect(result).toBe("brain");
    });

    it("matches deep subdirectory", async () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify({
          version: "2.0.0",
          projects: {
            brain: { code_path: "/Users/dev/brain" },
          },
        }),
      );

      const { resolveProjectFromCwd } = await import("../project-resolver");
      const result = resolveProjectFromCwd("/Users/dev/brain/apps/claude-plugin/cmd/hooks");
      expect(result).toBe("brain");
    });

    it("returns deepest match for nested projects", async () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify({
          version: "2.0.0",
          projects: {
            parent: { code_path: "/Users/dev" },
            brain: { code_path: "/Users/dev/brain" },
            "brain-plugin": { code_path: "/Users/dev/brain/apps/claude-plugin" },
          },
        }),
      );

      const { resolveProjectFromCwd } = await import("../project-resolver");

      // Should match brain-plugin (deepest)
      const result1 = resolveProjectFromCwd("/Users/dev/brain/apps/claude-plugin/cmd");
      expect(result1).toBe("brain-plugin");

      // Should match brain (not parent)
      const result2 = resolveProjectFromCwd("/Users/dev/brain/apps/mcp");
      expect(result2).toBe("brain");
    });

    it("returns null for no match", async () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify({
          version: "2.0.0",
          projects: {
            brain: { code_path: "/Users/dev/brain" },
          },
        }),
      );

      const { resolveProjectFromCwd } = await import("../project-resolver");
      const result = resolveProjectFromCwd("/Users/dev/other-project");
      expect(result).toBeNull();
    });

    it("does not match partial path prefixes", async () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify({
          version: "2.0.0",
          projects: {
            brain: { code_path: "/Users/dev/brain" },
          },
        }),
      );

      const { resolveProjectFromCwd } = await import("../project-resolver");
      // /brain-other starts with "brain" but is not inside it
      const result = resolveProjectFromCwd("/Users/dev/brain-other");
      expect(result).toBeNull();
    });

    it("skips projects with empty code_path", async () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify({
          version: "2.0.0",
          projects: {
            empty: { code_path: "" },
            brain: { code_path: "/Users/dev/brain" },
          },
        }),
      );

      const { resolveProjectFromCwd } = await import("../project-resolver");
      const result = resolveProjectFromCwd("/Users/dev/brain");
      expect(result).toBe("brain");
    });
  });

  describe("getProjectCodePaths", () => {
    it("returns empty map when config does not exist", async () => {
      const { getProjectCodePaths } = await import("../project-resolver");
      const result = getProjectCodePaths();
      expect(result.size).toBe(0);
    });

    it("returns all project code paths", async () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify({
          version: "2.0.0",
          projects: {
            brain: { code_path: "/Users/dev/brain" },
            other: { code_path: "/Users/dev/other" },
          },
        }),
      );

      const { getProjectCodePaths } = await import("../project-resolver");
      const result = getProjectCodePaths();

      expect(result.size).toBe(2);
      expect(result.get("brain")).toBe("/Users/dev/brain");
      expect(result.get("other")).toBe("/Users/dev/other");
    });

    it("skips projects without code_path", async () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify({
          version: "2.0.0",
          projects: {
            brain: { code_path: "/Users/dev/brain" },
            empty: {},
          },
        }),
      );

      const { getProjectCodePaths } = await import("../project-resolver");
      const result = getProjectCodePaths();

      expect(result.size).toBe(1);
      expect(result.has("empty")).toBe(false);
    });
  });
});

// Worktree integration tests use a separate describe block with its own mock setup
vi.mock("../worktree-detector", () => ({
  detectWorktreeMainPath: vi.fn(),
}));

describe("resolveProjectWithContext (worktree integration)", () => {
  let testDir: string;
  let testConfigPath: string;
  let mockedDetect: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.BRAIN_PROJECT;
    delete process.env.BM_PROJECT;
    delete process.env.BRAIN_DISABLE_WORKTREE_DETECTION;

    const rawDir = join(
      tmpdir(),
      `brain-wt-int-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(join(rawDir, "brain"), { recursive: true });
    testDir = realpathSync(rawDir);
    testConfigPath = join(testDir, "brain", "config.json");
    process.env.XDG_CONFIG_HOME = testDir;

    const { detectWorktreeMainPath } = await import("../worktree-detector");
    mockedDetect = vi.mocked(detectWorktreeMainPath);
    mockedDetect.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();

    if (testDir && existsSync(testDir)) {
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it("returns direct match with isWorktreeResolved=false", async () => {
    writeFileSync(
      testConfigPath,
      JSON.stringify({
        version: "2.0.0",
        projects: {
          brain: { code_path: "/Users/dev/brain" },
        },
      }),
    );

    const { resolveProjectWithContext } = await import("../project-resolver");
    const result = await resolveProjectWithContext({ cwd: "/Users/dev/brain/apps/mcp" });

    expect(result).not.toBeNull();
    expect(result!.projectName).toBe("brain");
    expect(result!.effectiveCwd).toBe("/Users/dev/brain/apps/mcp");
    expect(result!.isWorktreeResolved).toBe(false);
    // Worktree detection should NOT be called on direct match
    expect(mockedDetect).not.toHaveBeenCalled();
  });

  it("falls back to worktree detection when direct match fails", async () => {
    writeFileSync(
      testConfigPath,
      JSON.stringify({
        version: "2.0.0",
        projects: {
          brain: { code_path: normalize("/Users/dev/brain") },
        },
      }),
    );

    mockedDetect.mockResolvedValue({
      mainWorktreePath: "/Users/dev/brain",
      isLinkedWorktree: true,
    });

    const { resolveProjectWithContext } = await import("../project-resolver");
    const result = await resolveProjectWithContext({ cwd: "/Users/dev/brain-feature-1/apps/mcp" });

    expect(result).not.toBeNull();
    expect(result!.projectName).toBe("brain");
    expect(result!.isWorktreeResolved).toBe(true);
    expect(mockedDetect).toHaveBeenCalledWith("/Users/dev/brain-feature-1/apps/mcp");
  });

  it("returns null when worktree detection returns null", async () => {
    writeFileSync(
      testConfigPath,
      JSON.stringify({
        version: "2.0.0",
        projects: {
          brain: { code_path: "/Users/dev/brain" },
        },
      }),
    );

    mockedDetect.mockResolvedValue(null);

    const { resolveProjectWithContext } = await import("../project-resolver");
    const result = await resolveProjectWithContext({ cwd: "/Users/dev/other" });

    expect(result).toBeNull();
  });

  it("skips worktree detection when BRAIN_DISABLE_WORKTREE_DETECTION=1", async () => {
    process.env.BRAIN_DISABLE_WORKTREE_DETECTION = "1";

    writeFileSync(
      testConfigPath,
      JSON.stringify({
        version: "2.0.0",
        projects: {
          brain: { code_path: "/Users/dev/brain" },
        },
      }),
    );

    const { resolveProjectWithContext } = await import("../project-resolver");
    const result = await resolveProjectWithContext({ cwd: "/Users/dev/other" });

    expect(result).toBeNull();
    expect(mockedDetect).not.toHaveBeenCalled();
  });

  it("skips project with disableWorktreeDetection=true", async () => {
    writeFileSync(
      testConfigPath,
      JSON.stringify({
        version: "2.0.0",
        projects: {
          brain: {
            code_path: normalize("/Users/dev/brain"),
            disableWorktreeDetection: true,
          },
        },
      }),
    );

    mockedDetect.mockResolvedValue({
      mainWorktreePath: "/Users/dev/brain",
      isLinkedWorktree: true,
    });

    const { resolveProjectWithContext } = await import("../project-resolver");
    const result = await resolveProjectWithContext({ cwd: "/Users/dev/brain-feature-1" });

    // Detection runs but the matching project is opted-out
    expect(result).toBeNull();
  });

  it("rejects effectiveCwd with path traversal", async () => {
    writeFileSync(
      testConfigPath,
      JSON.stringify({
        version: "2.0.0",
        projects: {
          brain: { code_path: "/Users/dev/brain" },
        },
      }),
    );

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockedDetect.mockResolvedValue({
      mainWorktreePath: "/Users/dev/../../etc/passwd",
      isLinkedWorktree: true,
    });

    const { resolveProjectWithContext } = await import("../project-resolver");
    const result = await resolveProjectWithContext({ cwd: "/Users/dev/other" });

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("traversal"), expect.any(String));
    warnSpy.mockRestore();
  });

  it("rejects effectiveCwd pointing to system path", async () => {
    writeFileSync(
      testConfigPath,
      JSON.stringify({
        version: "2.0.0",
        projects: {
          brain: { code_path: "/etc/brain" },
        },
      }),
    );

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockedDetect.mockResolvedValue({
      mainWorktreePath: "/etc/brain",
      isLinkedWorktree: true,
    });

    const { resolveProjectWithContext } = await import("../project-resolver");
    const result = await resolveProjectWithContext({ cwd: "/Users/dev/other" });

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("blocked system path"),
      expect.any(String),
    );
    warnSpy.mockRestore();
  });

  it("explicit parameter takes priority over worktree", async () => {
    const { resolveProjectWithContext } = await import("../project-resolver");
    const result = await resolveProjectWithContext({ explicit: "my-project" });

    expect(result).not.toBeNull();
    expect(result!.projectName).toBe("my-project");
    expect(result!.isWorktreeResolved).toBe(false);
    expect(mockedDetect).not.toHaveBeenCalled();
  });

  it("BRAIN_PROJECT env var takes priority over worktree", async () => {
    process.env.BRAIN_PROJECT = "env-project";

    const { resolveProjectWithContext } = await import("../project-resolver");
    const result = await resolveProjectWithContext({ cwd: "/Users/dev/other" });

    expect(result).not.toBeNull();
    expect(result!.projectName).toBe("env-project");
    expect(result!.isWorktreeResolved).toBe(false);
    expect(mockedDetect).not.toHaveBeenCalled();
  });

  it("returns null when effectiveCwd contains null bytes", async () => {
    writeFileSync(
      testConfigPath,
      JSON.stringify({
        version: "2.0.0",
        projects: {
          brain: { code_path: "/Users/dev/brain" },
        },
      }),
    );

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockedDetect.mockResolvedValue({
      mainWorktreePath: "/Users/dev/brain\0/evil",
      isLinkedWorktree: true,
    });

    const { resolveProjectWithContext } = await import("../project-resolver");
    const result = await resolveProjectWithContext({ cwd: "/Users/dev/other" });

    expect(result).toBeNull();
    warnSpy.mockRestore();
  });
});
