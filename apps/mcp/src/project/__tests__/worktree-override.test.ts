import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../../config/brain-config", () => ({
  loadBrainConfigSync: vi.fn(() => ({
    version: "2.0.0" as const,
    defaults: {
      memories_location: "~/memories",
      memories_mode: "DEFAULT" as const,
    },
    projects: {
      "test-project": {
        code_path: "/Users/dev/test-project",
        memories_mode: "CODE" as const,
      },
      "default-project": {
        code_path: "/Users/dev/default-project",
        memories_mode: "DEFAULT" as const,
      },
      "custom-project": {
        code_path: "/Users/dev/custom-project",
        memories_mode: "CUSTOM" as const,
        memories_path: "/custom/path",
      },
      "no-mode-project": {
        code_path: "/Users/dev/no-mode",
      },
    },
    sync: { enabled: true, delay_ms: 500 },
    logging: { level: "info" as const },
    watcher: { enabled: true, debounce_ms: 2000 },
  })),
}));

import {
  clearAllWorktreeOverrides,
  clearWorktreeOverride,
  computeWorktreeOverride,
  getAllWorktreeOverrides,
  getWorktreeOverride,
  setWorktreeOverride,
} from "../worktree-override";

describe("worktree-override", () => {
  beforeEach(() => {
    clearAllWorktreeOverrides();
  });

  afterEach(() => {
    clearAllWorktreeOverrides();
  });

  describe("computeWorktreeOverride", () => {
    test("returns null when isWorktreeResolved is false", () => {
      const result = computeWorktreeOverride(
        "test-project",
        false,
        "/Users/dev/test-project-wt",
        "/Users/dev/test-project",
      );
      expect(result).toBeNull();
    });

    test("returns override for CODE mode worktree", () => {
      const result = computeWorktreeOverride(
        "test-project",
        true,
        "/Users/dev/test-project-wt",
        "/Users/dev/test-project",
      );
      expect(result).not.toBeNull();
      expect(result!.projectName).toBe("test-project");
      expect(result!.actualCwd).toBe("/Users/dev/test-project-wt");
      expect(result!.effectiveCwd).toBe("/Users/dev/test-project");
      expect(result!.memoriesPath).toBe("/Users/dev/test-project-wt/docs");
    });

    test("returns null for DEFAULT mode worktree", () => {
      const result = computeWorktreeOverride(
        "default-project",
        true,
        "/Users/dev/default-project-wt",
        "/Users/dev/default-project",
      );
      expect(result).toBeNull();
    });

    test("returns null for CUSTOM mode worktree", () => {
      const result = computeWorktreeOverride(
        "custom-project",
        true,
        "/Users/dev/custom-project-wt",
        "/Users/dev/custom-project",
      );
      expect(result).toBeNull();
    });

    test("returns null for unknown project", () => {
      const result = computeWorktreeOverride(
        "unknown-project",
        true,
        "/Users/dev/unknown-wt",
        "/Users/dev/unknown",
      );
      expect(result).toBeNull();
    });

    test("falls back to global default mode when project has no mode", () => {
      const result = computeWorktreeOverride(
        "no-mode-project",
        true,
        "/Users/dev/no-mode-wt",
        "/Users/dev/no-mode",
      );
      expect(result).toBeNull();
    });
  });

  describe("override map operations", () => {
    const override = {
      projectName: "test-project",
      actualCwd: "/Users/dev/test-project-wt",
      effectiveCwd: "/Users/dev/test-project",
      memoriesPath: "/Users/dev/test-project-wt/docs",
    };

    test("set and get override", () => {
      expect(getWorktreeOverride("test-project")).toBeNull();

      setWorktreeOverride(override);

      const result = getWorktreeOverride("test-project");
      expect(result).not.toBeNull();
      expect(result!.memoriesPath).toBe("/Users/dev/test-project-wt/docs");
    });

    test("clear specific override", () => {
      setWorktreeOverride(override);
      expect(getWorktreeOverride("test-project")).not.toBeNull();

      clearWorktreeOverride("test-project");
      expect(getWorktreeOverride("test-project")).toBeNull();
    });

    test("clear all overrides", () => {
      setWorktreeOverride(override);
      setWorktreeOverride({
        ...override,
        projectName: "other-project",
      });

      expect(getAllWorktreeOverrides().size).toBe(2);

      clearAllWorktreeOverrides();
      expect(getAllWorktreeOverrides().size).toBe(0);
    });

    test("clearing non-existent override is a no-op", () => {
      clearWorktreeOverride("nonexistent");
    });

    test("overriding same project replaces previous", () => {
      setWorktreeOverride(override);
      setWorktreeOverride({
        ...override,
        memoriesPath: "/new/path/docs",
      });

      const result = getWorktreeOverride("test-project");
      expect(result!.memoriesPath).toBe("/new/path/docs");
      expect(getAllWorktreeOverrides().size).toBe(1);
    });
  });
});
