import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { homedir } from "os";
import { join } from "path";

// Store original env
const originalEnv = { ...process.env };

describe("path-resolver", () => {
  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    delete process.env.BRAIN_PROJECT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getProjectMemoriesPath", () => {
    it("returns path for valid project", async () => {
      const { getProjectMemoriesPath } = await import("../path-resolver");
      const path = await getProjectMemoriesPath("brain");
      expect(path).toBe("/Users/peter.kloss/memories/mcps/brain");
    });

    it("throws ProjectNotFoundError for invalid project", async () => {
      const { getProjectMemoriesPath, ProjectNotFoundError } = await import(
        "../path-resolver"
      );

      try {
        await getProjectMemoriesPath("nonexistent-project");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ProjectNotFoundError);
        expect((error as ProjectNotFoundError).project).toBe(
          "nonexistent-project"
        );
        expect((error as ProjectNotFoundError).availableProjects).toContain(
          "brain"
        );
      }
    });

    it("returns path for shared project", async () => {
      const { getProjectMemoriesPath } = await import("../path-resolver");
      const path = await getProjectMemoriesPath("shared");
      expect(path).toBe("/Users/peter.kloss/memories/shared");
    });
  });

  describe("detectProjectFromPath", () => {
    it("detects project from directory name", async () => {
      const { detectProjectFromPath } = await import("../path-resolver");
      const project = await detectProjectFromPath("/some/path/brain");
      expect(project).toBe("brain");
    });

    it("detects project from parent directory name", async () => {
      const { detectProjectFromPath } = await import("../path-resolver");
      const project = await detectProjectFromPath("/some/path/brain/subdir");
      expect(project).toBe("brain");
    });

    it("returns undefined for unrecognized path", async () => {
      const { detectProjectFromPath } = await import("../path-resolver");
      const project = await detectProjectFromPath(
        "/totally/random/path/unknown"
      );
      expect(project).toBeUndefined();
    });

    it("detects project when cwd is inside memories path", async () => {
      const { detectProjectFromPath } = await import("../path-resolver");
      const project = await detectProjectFromPath(
        "/Users/peter.kloss/memories/mcps/brain/notes"
      );
      expect(project).toBe("brain");
    });
  });

  describe("resolveProjectMemoriesPath", () => {
    it("uses explicit project parameter first", async () => {
      const { resolveProjectMemoriesPath } = await import(
        "../path-resolver"
      );
      process.env.BRAIN_PROJECT = "shared"; // Should be ignored
      const path = await resolveProjectMemoriesPath("brain", "/some/other/path");
      expect(path).toBe("/Users/peter.kloss/memories/mcps/brain");
    });

    it("uses BRAIN_PROJECT env var when no explicit project", async () => {
      const { resolveProjectMemoriesPath } = await import(
        "../path-resolver"
      );
      process.env.BRAIN_PROJECT = "memory";
      const path = await resolveProjectMemoriesPath(
        undefined,
        "/unrelated/path"
      );
      expect(path).toBe("/Users/peter.kloss/memories/mcps/memory");
    });

    it("detects project from cwd when no explicit project or env var", async () => {
      const { resolveProjectMemoriesPath } = await import(
        "../path-resolver"
      );
      const path = await resolveProjectMemoriesPath(
        undefined,
        "/some/path/brain"
      );
      expect(path).toBe("/Users/peter.kloss/memories/mcps/brain");
    });

    it("falls back to default project when nothing else matches", async () => {
      const { resolveProjectMemoriesPath } = await import(
        "../path-resolver"
      );
      const path = await resolveProjectMemoriesPath(
        undefined,
        "/totally/random/unknown"
      );
      // Default project is "shared"
      expect(path).toBe("/Users/peter.kloss/memories/shared");
    });
  });
});

describe("config", () => {
  describe("getConfigPath", () => {
    it("returns path in home directory", async () => {
      const { getConfigPath } = await import("../config");
      const configPath = getConfigPath();
      expect(configPath).toBe(join(homedir(), ".basic-memory", "config.json"));
    });
  });

  describe("readConfig", () => {
    it("reads and parses config file", async () => {
      const { readConfig } = await import("../config");
      const config = await readConfig();
      expect(config.projects).toBeDefined();
      expect(config.default_project).toBe("shared");
      expect(typeof config.projects.brain).toBe("string");
    });
  });

  describe("getAvailableProjects", () => {
    it("returns list of project names", async () => {
      const { getAvailableProjects } = await import("../config");
      const projects = await getAvailableProjects();
      expect(projects).toContain("brain");
      expect(projects).toContain("shared");
      expect(projects).toContain("memory");
    });
  });

  describe("getDefaultProject", () => {
    it("returns default project name", async () => {
      const { getDefaultProject } = await import("../config");
      const defaultProject = await getDefaultProject();
      expect(defaultProject).toBe("shared");
    });
  });
});
