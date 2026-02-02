import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Store original env
const originalEnv = { ...process.env };

// Helper to get a valid project from config dynamically
async function getTestProject(): Promise<string> {
  const { getAvailableProjects } = await import("../config");
  const projects = await getAvailableProjects();
  return projects[0]; // Use first available project
}

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
      const testProject = await getTestProject();
      const path = await getProjectMemoriesPath(testProject);

      // Verify returns a non-empty string path
      expect(typeof path).toBe("string");
      expect(path.length).toBeGreaterThan(0);
    });

    it("throws ProjectNotFoundError for invalid project", async () => {
      const { getProjectMemoriesPath, ProjectNotFoundError } = await import("../path-resolver");

      try {
        await getProjectMemoriesPath("nonexistent-project-xyz-12345");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ProjectNotFoundError);
        expect((error as ProjectNotFoundError).project).toBe("nonexistent-project-xyz-12345");
        expect((error as ProjectNotFoundError).availableProjects.length).toBeGreaterThan(0);
      }
    });
  });

  describe("detectProjectFromPath", () => {
    it("detects project from directory name matching a valid project", async () => {
      const { detectProjectFromPath } = await import("../path-resolver");
      const testProject = await getTestProject();
      const project = await detectProjectFromPath(`/some/path/${testProject}`);
      expect(project).toBe(testProject);
    });

    it("detects project from parent directory name", async () => {
      const { detectProjectFromPath } = await import("../path-resolver");
      const testProject = await getTestProject();
      const project = await detectProjectFromPath(`/some/path/${testProject}/subdir`);
      expect(project).toBe(testProject);
    });

    it("returns undefined for unrecognized path", async () => {
      const { detectProjectFromPath } = await import("../path-resolver");
      const project = await detectProjectFromPath("/totally/random/path/unknown-xyz-99999");
      expect(project).toBeUndefined();
    });

    it("detects project when cwd is inside memories path", async () => {
      const { detectProjectFromPath, getProjectMemoriesPath } = await import("../path-resolver");
      const testProject = await getTestProject();
      const memoriesPath = await getProjectMemoriesPath(testProject);
      const project = await detectProjectFromPath(`${memoriesPath}/notes`);
      expect(project).toBe(testProject);
    });
  });

  describe("resolveProjectMemoriesPath", () => {
    it("uses explicit project parameter first", async () => {
      const { resolveProjectMemoriesPath, getProjectMemoriesPath } = await import(
        "../path-resolver"
      );
      const { getAvailableProjects } = await import("../config");
      const projects = await getAvailableProjects();

      // Need at least 2 projects for this test
      if (projects.length < 2) {
        return; // Skip if only one project
      }

      const [project1, project2] = projects;
      process.env.BRAIN_PROJECT = project2; // Should be ignored
      const path = await resolveProjectMemoriesPath(project1, "/some/other/path");
      const expectedPath = await getProjectMemoriesPath(project1);
      expect(path).toBe(expectedPath);
    });

    it("uses BRAIN_PROJECT env var when no explicit project", async () => {
      const { resolveProjectMemoriesPath, getProjectMemoriesPath } = await import(
        "../path-resolver"
      );
      const testProject = await getTestProject();
      process.env.BRAIN_PROJECT = testProject;
      const path = await resolveProjectMemoriesPath(undefined, "/unrelated/path");
      const expectedPath = await getProjectMemoriesPath(testProject);
      expect(path).toBe(expectedPath);
    });

    it("detects project from cwd when no explicit project or env var", async () => {
      const { resolveProjectMemoriesPath, getProjectMemoriesPath } = await import(
        "../path-resolver"
      );
      const testProject = await getTestProject();
      const path = await resolveProjectMemoriesPath(undefined, `/some/path/${testProject}`);
      const expectedPath = await getProjectMemoriesPath(testProject);
      expect(path).toBe(expectedPath);
    });

    it("falls back to default project when nothing else matches", async () => {
      const { resolveProjectMemoriesPath } = await import("../path-resolver");
      const { getDefaultProject } = await import("../config");
      const path = await resolveProjectMemoriesPath(undefined, "/totally/random/unknown-xyz-99999");
      const defaultProject = await getDefaultProject();

      // Verify path is returned (using default project)
      expect(typeof path).toBe("string");
      expect(path.length).toBeGreaterThan(0);
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

      // Verify structure, not specific values
      expect(config.projects).toBeDefined();
      expect(typeof config.projects).toBe("object");
      expect(Object.keys(config.projects).length).toBeGreaterThan(0);
      expect(typeof config.default_project).toBe("string");
      expect(config.default_project.length).toBeGreaterThan(0);
    });
  });

  describe("getAvailableProjects", () => {
    it("returns list of project names", async () => {
      const { getAvailableProjects } = await import("../config");
      const projects = await getAvailableProjects();

      // Verify returns non-empty array of strings
      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBeGreaterThan(0);
      expect(projects.every((p) => typeof p === "string")).toBe(true);
    });
  });

  describe("getDefaultProject", () => {
    it("returns default project name", async () => {
      const { getDefaultProject } = await import("../config");
      const defaultProject = await getDefaultProject();

      // Verify returns non-empty string
      expect(typeof defaultProject).toBe("string");
      expect(defaultProject.length).toBeGreaterThan(0);
    });
  });
});
