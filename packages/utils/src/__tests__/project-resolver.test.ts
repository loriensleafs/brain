import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    testDir = join(
      tmpdir(),
      `brain-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
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
      const result = resolveProjectFromCwd(
        "/Users/dev/brain/apps/claude-plugin/cmd/hooks",
      );
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
      const result1 = resolveProjectFromCwd(
        "/Users/dev/brain/apps/claude-plugin/cmd",
      );
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
