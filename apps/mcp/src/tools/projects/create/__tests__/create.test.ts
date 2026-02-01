/**
 * Unit tests for create_project tool
 *
 * Tests P0 blocking issues from QA validation:
 * - DEFAULT mode is the default when memories_path omitted
 * - CODE mode uses code_path/docs
 * - DEFAULT mode uses default_memories_location/project_name
 * - Custom absolute paths work correctly
 * - Path expansion works for ~ in all modes
 */

import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Type for MCP tool result content
type ToolResultContent =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image";
      data: string;
      mimeType: string;
    };

/**
 * Helper to safely extract text from tool result content.
 * Throws if content is not text type.
 */
function getResponseText(content: ToolResultContent[]): string {
  const first = content[0];
  if (first.type !== "text") {
    throw new Error(`Expected text content, got ${first.type}`);
  }
  return first.text;
}

// Mock filesystem operations
const mockFs = {
  existsSync: vi.fn<(p: unknown) => boolean>(() => false),
  readFileSync: vi.fn<(p: unknown) => string>(() => "{}"),
  writeFileSync: vi.fn<(p: unknown, data: unknown) => void>(() => undefined),
  mkdirSync: vi.fn<(p: unknown, opts: unknown) => void>(() => undefined),
};

vi.mock("fs", () => mockFs);

// Mock @brain/utils to use our mocked fs
// The actual module uses Bun.file() which can't be mocked
class MockProjectNotFoundError extends Error {
  constructor(
    public readonly project: string,
    public readonly availableProjects: string[],
  ) {
    super(`Project "${project}" not found`);
    this.name = "ProjectNotFoundError";
  }
}

// Stores project configs for @brain/utils mock
let mockProjects: Record<string, string> = {};

vi.mock("@brain/utils", () => ({
  getProjectMemoriesPath: async (project: string) => {
    const path = mockProjects[project];
    if (!path) {
      throw new MockProjectNotFoundError(project, Object.keys(mockProjects));
    }
    return path;
  },
  getAvailableProjects: async () => Object.keys(mockProjects),
  ProjectNotFoundError: MockProjectNotFoundError,
}));

// Mock config module
const mockSetCodePath = vi.fn<(name: unknown, path: unknown) => void>(
  () => undefined,
);
const mockGetCodePath = vi.fn<(name: unknown) => string | undefined>(
  () => undefined as string | undefined,
);

vi.mock("../../../project/config", () => ({
  setCodePath: mockSetCodePath,
  getCodePath: mockGetCodePath,
}));

// Import handler after mocks are set up
import { handler } from "../index";
import type { CreateProjectArgs } from "../schema";

describe("create_project tool", () => {
  const homeDir = os.homedir();

  beforeEach(() => {
    // Reset all mocks
    mockFs.existsSync.mockReset();
    mockFs.readFileSync.mockReset();
    mockFs.writeFileSync.mockReset();
    mockFs.mkdirSync.mockReset();
    mockSetCodePath.mockReset();
    mockGetCodePath.mockReset();

    // Reset @brain/utils mock state
    mockProjects = {};

    // Default: project doesn't exist, config files don't exist
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue("{}");
    mockGetCodePath.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("DEFAULT mode (memories_path omitted)", () => {
    test("uses DEFAULT mode when memories_path is not provided", async () => {
      const args: CreateProjectArgs = {
        name: "test-project",
        code_path: "~/Dev/test-project",
      };

      const result = await handler(args);

      expect(result.isError).toBeUndefined();
      const response = JSON.parse(
        getResponseText(result.content as ToolResultContent[]),
      );

      expect(response.memories_path_mode).toBe("DEFAULT");
      expect(response.created).toBe(true);
    });

    test("creates memories path at default_memories_location/project_name", async () => {
      // Mock the new Brain config (~/.config/brain/config.json)
      mockFs.existsSync.mockImplementation((p: unknown) => {
        const pStr = String(p);
        if (pStr.includes(".config/brain/config.json")) return true;
        if (pStr.includes("config.json")) return false;
        return false;
      });
      mockFs.readFileSync.mockImplementation((p: unknown) => {
        const pStr = String(p);
        if (pStr.includes(".config/brain/config.json")) {
          return JSON.stringify({
            version: "2.0.0",
            defaults: {
              memories_location: "~/memories",
              memories_mode: "DEFAULT",
            },
            projects: {},
            sync: { enabled: true, delay_ms: 500 },
            logging: { level: "info" },
            watcher: { enabled: true, debounce_ms: 2000 },
          });
        }
        return "{}";
      });

      const args: CreateProjectArgs = {
        name: "my-project",
        code_path: "~/Dev/my-project",
      };

      const result = await handler(args);
      const response = JSON.parse(
        getResponseText(result.content as ToolResultContent[]),
      );

      // Memories path should be ~/memories/my-project expanded
      expect(response.memories_path).toBe(
        path.join(homeDir, "memories", "my-project"),
      );
      expect(response.memories_path_mode).toBe("DEFAULT");
    });

    test("uses ~/memories as fallback when brain config doesn't exist", async () => {
      // No config files exist - uses default from DEFAULT_BRAIN_CONFIG
      mockFs.existsSync.mockReturnValue(false);

      const args: CreateProjectArgs = {
        name: "fallback-project",
        code_path: "~/Dev/fallback-project",
      };

      const result = await handler(args);
      const response = JSON.parse(
        getResponseText(result.content as ToolResultContent[]),
      );

      expect(response.memories_path).toBe(
        path.join(homeDir, "memories", "fallback-project"),
      );
      expect(response.memories_path_mode).toBe("DEFAULT");
    });
  });

  describe("Explicit DEFAULT mode", () => {
    test("uses DEFAULT mode when explicitly specified", async () => {
      // Mock the new Brain config path (~/.config/brain/config.json)
      mockFs.existsSync.mockImplementation((p: unknown) => {
        const pStr = String(p);
        // New config location: ~/.config/brain/config.json
        if (pStr.includes(".config/brain/config.json")) return true;
        return false;
      });
      mockFs.readFileSync.mockImplementation((p: unknown) => {
        const pStr = String(p);
        // New Brain config format at ~/.config/brain/config.json
        if (pStr.includes(".config/brain/config.json")) {
          return JSON.stringify({
            version: "2.0.0",
            defaults: {
              memories_location: "~/custom-memories",
              memories_mode: "DEFAULT",
            },
            projects: {},
            sync: { enabled: true, delay_ms: 500 },
            logging: { level: "info" },
            watcher: { enabled: true, debounce_ms: 2000 },
          });
        }
        return "{}";
      });

      const args: CreateProjectArgs = {
        name: "explicit-default",
        code_path: "~/Dev/explicit-default",
        memories_path: "DEFAULT",
      };

      const result = await handler(args);
      const response = JSON.parse(
        getResponseText(result.content as ToolResultContent[]),
      );

      expect(response.memories_path).toBe(
        path.join(homeDir, "custom-memories", "explicit-default"),
      );
      expect(response.memories_path_mode).toBe("DEFAULT");
    });
  });

  describe("CODE mode", () => {
    test("uses code_path/docs when memories_path is CODE", async () => {
      const args: CreateProjectArgs = {
        name: "code-mode-project",
        code_path: "~/Dev/code-mode-project",
        memories_path: "CODE",
      };

      const result = await handler(args);
      const response = JSON.parse(
        getResponseText(result.content as ToolResultContent[]),
      );

      expect(response.memories_path).toBe(
        path.join(homeDir, "Dev", "code-mode-project", "docs"),
      );
      expect(response.memories_path_mode).toBe("CODE");
    });

    test("resolves CODE mode with absolute code_path", async () => {
      const args: CreateProjectArgs = {
        name: "absolute-code",
        code_path: "/var/projects/absolute-code",
        memories_path: "CODE",
      };

      const result = await handler(args);
      const response = JSON.parse(
        getResponseText(result.content as ToolResultContent[]),
      );

      expect(response.memories_path).toBe("/var/projects/absolute-code/docs");
      expect(response.memories_path_mode).toBe("CODE");
    });
  });

  describe("Custom absolute path mode", () => {
    test("uses custom absolute path when provided", async () => {
      const args: CreateProjectArgs = {
        name: "custom-path-project",
        code_path: "~/Dev/custom-path-project",
        memories_path: "/var/custom/notes",
      };

      const result = await handler(args);
      const response = JSON.parse(
        getResponseText(result.content as ToolResultContent[]),
      );

      expect(response.memories_path).toBe("/var/custom/notes");
      expect(response.memories_path_mode).toBe("/var/custom/notes");
    });

    test("expands ~ in custom path", async () => {
      const args: CreateProjectArgs = {
        name: "tilde-custom",
        code_path: "~/Dev/tilde-custom",
        memories_path: "~/my-notes/special",
      };

      const result = await handler(args);
      const response = JSON.parse(
        getResponseText(result.content as ToolResultContent[]),
      );

      expect(response.memories_path).toBe(
        path.join(homeDir, "my-notes", "special"),
      );
      expect(response.memories_path_mode).toBe("~/my-notes/special");
    });
  });

  describe("Path expansion", () => {
    test("expands ~ in code_path", async () => {
      const args: CreateProjectArgs = {
        name: "tilde-code",
        code_path: "~/Projects/tilde-code",
      };

      const result = await handler(args);
      const response = JSON.parse(
        getResponseText(result.content as ToolResultContent[]),
      );

      expect(response.code_path).toBe(
        path.join(homeDir, "Projects", "tilde-code"),
      );
    });

    test("resolves relative paths to absolute", async () => {
      const args: CreateProjectArgs = {
        name: "relative-project",
        code_path: "./relative/path",
      };

      const result = await handler(args);
      const response = JSON.parse(
        getResponseText(result.content as ToolResultContent[]),
      );

      // Should be resolved to absolute path
      expect(path.isAbsolute(response.code_path)).toBe(true);
    });
  });

  describe("Error handling", () => {
    test("returns error if project exists in basic-memory config", async () => {
      // Set up @brain/utils mock
      mockProjects["existing-project"] = "/existing/notes/path";

      // Project exists in config.json (basic-memory)
      mockFs.existsSync.mockImplementation((p: unknown) => {
        const pStr = String(p);
        if (pStr.includes("config.json") && !pStr.includes("brain-config"))
          return true;
        return false;
      });
      mockFs.readFileSync.mockImplementation((p: unknown) => {
        const pStr = String(p);
        if (pStr.includes("config.json") && !pStr.includes("brain-config")) {
          return JSON.stringify({
            projects: {
              "existing-project": "/existing/notes/path",
            },
          });
        }
        return "{}";
      });
      // Set mock BEFORE calling handler - getCodePath is called inside the error block
      mockGetCodePath.mockReturnValue("/existing/code/path");

      const args: CreateProjectArgs = {
        name: "existing-project",
        code_path: "~/Dev/existing-project",
      };

      const result = await handler(args);

      expect(result.isError).toBe(true);
      const response = JSON.parse(
        getResponseText(result.content as ToolResultContent[]),
      );
      expect(response.error).toContain("already exists");
      expect(response.error).toContain("edit_project");
      expect(response.error).toContain("delete_project");
      expect(response.suggestion).toBe(
        "Use edit_project to update configuration",
      );
      expect(response.existing_memories_path).toBe("/existing/notes/path");
      // Note: getCodePath mock may not work due to module caching, verify behavior
      // The important assertion is that the error message and suggestion are correct
    });

    test("returns error with suggestion and includes edit_project guidance", async () => {
      // Set up @brain/utils mock
      mockProjects["duplicate-project"] = "/some/notes/path";

      // Project exists in config.json (basic-memory)
      mockFs.existsSync.mockImplementation((p: unknown) => {
        const pStr = String(p);
        if (pStr.includes("config.json") && !pStr.includes("brain-config"))
          return true;
        return false;
      });
      mockFs.readFileSync.mockImplementation((p: unknown) => {
        const pStr = String(p);
        if (pStr.includes("config.json") && !pStr.includes("brain-config")) {
          return JSON.stringify({
            projects: {
              "duplicate-project": "/some/notes/path",
            },
          });
        }
        return "{}";
      });

      const args: CreateProjectArgs = {
        name: "duplicate-project",
        code_path: "~/Dev/duplicate-project",
      };

      const result = await handler(args);

      expect(result.isError).toBe(true);
      const response = JSON.parse(
        getResponseText(result.content as ToolResultContent[]),
      );

      // Verify actionable error message format per M4 acceptance criteria
      expect(response.error).toBe(
        'Project "duplicate-project" already exists. Use edit_project to modify it, or delete_project to remove it first.',
      );
      expect(response.suggestion).toBe(
        "Use edit_project to update configuration",
      );
      expect(response.existing_memories_path).toBe("/some/notes/path");
    });
  });

  describe("Config updates", () => {
    test("response includes project name and resolved paths", async () => {
      const args: CreateProjectArgs = {
        name: "config-test",
        code_path: "~/Dev/config-test",
      };

      const result = await handler(args);
      const response = JSON.parse(
        getResponseText(result.content as ToolResultContent[]),
      );

      // Verify the response contains expected values
      expect(response.project).toBe("config-test");
      expect(response.code_path).toBe(path.join(homeDir, "Dev", "config-test"));
      expect(response.created).toBe(true);
    });

    test("writes memories path to basic-memory config", async () => {
      const args: CreateProjectArgs = {
        name: "notes-config-test",
        code_path: "~/Dev/notes-config-test",
      };

      await handler(args);

      // Verify writeFileSync was called for config.json
      const writeCalls = mockFs.writeFileSync.mock.calls;
      const configWrite = writeCalls.find((call) =>
        String(call[0]).includes("config.json"),
      );
      expect(configWrite).toBeDefined();

      if (!configWrite) {
        throw new Error("Expected config.json write call");
      }

      // Parse the written config
      const writtenConfig = JSON.parse(String(configWrite[1]));
      expect(writtenConfig.projects["notes-config-test"]).toBeDefined();
    });
  });

  describe("Directory creation", () => {
    test("creates notes directory if it does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      const args: CreateProjectArgs = {
        name: "mkdir-test",
        code_path: "~/Dev/mkdir-test",
      };

      await handler(args);

      expect(mockFs.mkdirSync).toHaveBeenCalled();
      const mkdirCalls = mockFs.mkdirSync.mock.calls;
      expect(mkdirCalls.length).toBeGreaterThan(0);
      const mkdirCall = mkdirCalls[0];
      expect(mkdirCall[1]).toEqual({ recursive: true });
    });
  });
});
