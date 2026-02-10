/**
 * Tests for project-resolve.ts
 *
 * Ported from apps/claude-plugin/cmd/hooks/project_resolve_test.go (209 LOC).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import {
  resolveProjectFromEnv,
  resolveProjectWithCwd,
  resolveProjectFromCwd,
  setGetEnv,
  setBrainConfigPath,
} from "../project-resolve.js";

// Helpers
let origGetEnv: typeof import("../project-resolve.js").getEnv;
let origConfigPath: typeof import("../project-resolve.js").getBrainConfigPath;

function createTempConfig(content: string): string {
  const dir = join(tmpdir(), `brain-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  Bun.spawnSync(["mkdir", "-p", dir]);
  const configPath = join(dir, "config.json");
  await Bun.write(configPath, content);
  return configPath;
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
