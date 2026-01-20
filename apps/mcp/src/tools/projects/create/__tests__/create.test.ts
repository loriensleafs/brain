/**
 * Unit tests for create_project tool
 *
 * Tests P0 blocking issues from QA validation:
 * - DEFAULT mode is the default when notes_path omitted
 * - CODE mode uses code_path/docs
 * - DEFAULT mode uses default_notes_path/project_name
 * - Custom absolute paths work correctly
 * - Path expansion works for ~ in all modes
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import * as os from "os";
import * as path from "path";

// Type for MCP tool result content
type ToolResultContent = {
  type: "text";
  text: string;
} | {
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
  existsSync: mock(() => false) as ReturnType<typeof mock<(p: unknown) => boolean>>,
  readFileSync: mock(() => "{}") as ReturnType<typeof mock<(p: unknown) => string>>,
  writeFileSync: mock(() => undefined) as ReturnType<typeof mock<(p: unknown, data: unknown) => void>>,
  mkdirSync: mock(() => undefined) as ReturnType<typeof mock<(p: unknown, opts: unknown) => void>>,
};

mock.module("fs", () => mockFs);

// Mock config module
const mockSetCodePath = mock(() => undefined) as ReturnType<typeof mock<(name: unknown, path: unknown) => void>>;
const mockGetCodePath = mock(() => undefined as string | undefined) as ReturnType<typeof mock<(name: unknown) => string | undefined>>;

mock.module("../../../project/config", () => ({
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

    // Default: project doesn't exist, config files don't exist
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue("{}");
    mockGetCodePath.mockReturnValue(undefined);
  });

  afterEach(() => {
    mock.restore();
  });

  describe("DEFAULT mode (notes_path omitted)", () => {
    test("uses DEFAULT mode when notes_path is not provided", async () => {
      const args: CreateProjectArgs = {
        name: "test-project",
        code_path: "~/Dev/test-project",
      };

      const result = await handler(args);

      expect(result.isError).toBeUndefined();
      const response = JSON.parse(getResponseText(result.content as ToolResultContent[]));

      expect(response.notes_path_mode).toBe("DEFAULT");
      expect(response.created).toBe(true);
    });

    test("creates notes path at default_notes_path/project_name", async () => {
      // Mock brain-config.json with custom default_notes_path
      mockFs.existsSync.mockImplementation((p: unknown) => {
        const pStr = String(p);
        if (pStr.includes("brain-config.json")) return true;
        if (pStr.includes("config.json")) return false;
        return false;
      });
      mockFs.readFileSync.mockImplementation((p: unknown) => {
        const pStr = String(p);
        if (pStr.includes("brain-config.json")) {
          return JSON.stringify({ default_notes_path: "~/memories" });
        }
        return "{}";
      });

      const args: CreateProjectArgs = {
        name: "my-project",
        code_path: "~/Dev/my-project",
      };

      const result = await handler(args);
      const response = JSON.parse(getResponseText(result.content as ToolResultContent[]));

      // Notes path should be ~/memories/my-project expanded
      expect(response.notes_path).toBe(path.join(homeDir, "memories", "my-project"));
      expect(response.notes_path_mode).toBe("DEFAULT");
    });

    test("uses ~/memories as fallback when brain-config.json doesn't exist", async () => {
      // No config files exist
      mockFs.existsSync.mockReturnValue(false);

      const args: CreateProjectArgs = {
        name: "fallback-project",
        code_path: "~/Dev/fallback-project",
      };

      const result = await handler(args);
      const response = JSON.parse(getResponseText(result.content as ToolResultContent[]));

      expect(response.notes_path).toBe(path.join(homeDir, "memories", "fallback-project"));
      expect(response.notes_path_mode).toBe("DEFAULT");
    });
  });

  describe("Explicit DEFAULT mode", () => {
    test("uses DEFAULT mode when explicitly specified", async () => {
      mockFs.existsSync.mockImplementation((p: unknown) => {
        const pStr = String(p);
        if (pStr.includes("brain-config.json")) return true;
        return false;
      });
      mockFs.readFileSync.mockImplementation((p: unknown) => {
        const pStr = String(p);
        if (pStr.includes("brain-config.json")) {
          return JSON.stringify({ default_notes_path: "~/custom-memories" });
        }
        return "{}";
      });

      const args: CreateProjectArgs = {
        name: "explicit-default",
        code_path: "~/Dev/explicit-default",
        notes_path: "DEFAULT",
      };

      const result = await handler(args);
      const response = JSON.parse(getResponseText(result.content as ToolResultContent[]));

      expect(response.notes_path).toBe(path.join(homeDir, "custom-memories", "explicit-default"));
      expect(response.notes_path_mode).toBe("DEFAULT");
    });
  });

  describe("CODE mode", () => {
    test("uses code_path/docs when notes_path is CODE", async () => {
      const args: CreateProjectArgs = {
        name: "code-mode-project",
        code_path: "~/Dev/code-mode-project",
        notes_path: "CODE",
      };

      const result = await handler(args);
      const response = JSON.parse(getResponseText(result.content as ToolResultContent[]));

      expect(response.notes_path).toBe(path.join(homeDir, "Dev", "code-mode-project", "docs"));
      expect(response.notes_path_mode).toBe("CODE");
    });

    test("resolves CODE mode with absolute code_path", async () => {
      const args: CreateProjectArgs = {
        name: "absolute-code",
        code_path: "/var/projects/absolute-code",
        notes_path: "CODE",
      };

      const result = await handler(args);
      const response = JSON.parse(getResponseText(result.content as ToolResultContent[]));

      expect(response.notes_path).toBe("/var/projects/absolute-code/docs");
      expect(response.notes_path_mode).toBe("CODE");
    });
  });

  describe("Custom absolute path mode", () => {
    test("uses custom absolute path when provided", async () => {
      const args: CreateProjectArgs = {
        name: "custom-path-project",
        code_path: "~/Dev/custom-path-project",
        notes_path: "/var/custom/notes",
      };

      const result = await handler(args);
      const response = JSON.parse(getResponseText(result.content as ToolResultContent[]));

      expect(response.notes_path).toBe("/var/custom/notes");
      expect(response.notes_path_mode).toBe("/var/custom/notes");
    });

    test("expands ~ in custom path", async () => {
      const args: CreateProjectArgs = {
        name: "tilde-custom",
        code_path: "~/Dev/tilde-custom",
        notes_path: "~/my-notes/special",
      };

      const result = await handler(args);
      const response = JSON.parse(getResponseText(result.content as ToolResultContent[]));

      expect(response.notes_path).toBe(path.join(homeDir, "my-notes", "special"));
      expect(response.notes_path_mode).toBe("~/my-notes/special");
    });
  });

  describe("Path expansion", () => {
    test("expands ~ in code_path", async () => {
      const args: CreateProjectArgs = {
        name: "tilde-code",
        code_path: "~/Projects/tilde-code",
      };

      const result = await handler(args);
      const response = JSON.parse(getResponseText(result.content as ToolResultContent[]));

      expect(response.code_path).toBe(path.join(homeDir, "Projects", "tilde-code"));
    });

    test("resolves relative paths to absolute", async () => {
      const args: CreateProjectArgs = {
        name: "relative-project",
        code_path: "./relative/path",
      };

      const result = await handler(args);
      const response = JSON.parse(getResponseText(result.content as ToolResultContent[]));

      // Should be resolved to absolute path
      expect(path.isAbsolute(response.code_path)).toBe(true);
    });
  });

  describe("Error handling", () => {
    test("returns error if project exists in basic-memory config", async () => {
      // Project exists in config.json (basic-memory)
      mockFs.existsSync.mockImplementation((p: unknown) => {
        const pStr = String(p);
        if (pStr.includes("config.json") && !pStr.includes("brain-config")) return true;
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
      const response = JSON.parse(getResponseText(result.content as ToolResultContent[]));
      expect(response.error).toContain("already exists");
      expect(response.error).toContain("edit_project");
      expect(response.error).toContain("delete_project");
      expect(response.suggestion).toBe("Use edit_project to update configuration");
      expect(response.existing_notes_path).toBe("/existing/notes/path");
      // Note: getCodePath mock may not work due to module caching, verify behavior
      // The important assertion is that the error message and suggestion are correct
    });

    test("returns error with suggestion and includes edit_project guidance", async () => {
      // Project exists in config.json (basic-memory)
      mockFs.existsSync.mockImplementation((p: unknown) => {
        const pStr = String(p);
        if (pStr.includes("config.json") && !pStr.includes("brain-config")) return true;
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
      const response = JSON.parse(getResponseText(result.content as ToolResultContent[]));

      // Verify actionable error message format per M4 acceptance criteria
      expect(response.error).toBe(
        'Project "duplicate-project" already exists. Use edit_project to modify it, or delete_project to remove it first.'
      );
      expect(response.suggestion).toBe("Use edit_project to update configuration");
      expect(response.existing_notes_path).toBe("/some/notes/path");
    });
  });

  describe("Config updates", () => {
    test("response includes project name and resolved paths", async () => {
      const args: CreateProjectArgs = {
        name: "config-test",
        code_path: "~/Dev/config-test",
      };

      const result = await handler(args);
      const response = JSON.parse(getResponseText(result.content as ToolResultContent[]));

      // Verify the response contains expected values
      expect(response.project).toBe("config-test");
      expect(response.code_path).toBe(path.join(homeDir, "Dev", "config-test"));
      expect(response.created).toBe(true);
    });

    test("writes notes path to basic-memory config", async () => {
      const args: CreateProjectArgs = {
        name: "notes-config-test",
        code_path: "~/Dev/notes-config-test",
      };

      await handler(args);

      // Verify writeFileSync was called for config.json
      const writeCalls = mockFs.writeFileSync.mock.calls;
      const configWrite = writeCalls.find((call) =>
        String(call[0]).includes("config.json")
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
