/**
 * create_project tool implementation
 *
 * Creates a new project with required code_path and optional notes_path.
 * Notes path supports enum options: DEFAULT, CODE, or absolute path.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { setCodePath, getCodePath } from "../../../project/config";
import type { CreateProjectArgs, NotesPathOption } from "./schema";

export {
  toolDefinition,
  CreateProjectArgsSchema,
  type CreateProjectArgs,
  type NotesPathOption,
} from "./schema";

/**
 * Load brain config to get default_notes_path
 */
function getDefaultNotesPath(): string {
  const configPath = path.join(os.homedir(), ".basic-memory", "brain-config.json");
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      return config.default_notes_path || "~/memories";
    }
  } catch {
    // Ignore errors, return default
  }
  return "~/memories";
}

/**
 * Get notes path for a project from basic-memory config
 */
function getNotesPath(project: string): string | null {
  const configPath = path.join(os.homedir(), ".basic-memory", "config.json");
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      if (config.projects && typeof config.projects === "object") {
        return config.projects[project] || null;
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Set notes path for a project in basic-memory config
 */
function setNotesPath(project: string, notesPath: string): void {
  const configPath = path.join(os.homedir(), ".basic-memory", "config.json");
  try {
    let config: Record<string, unknown> = {};
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      config = JSON.parse(content);
    }

    if (!config.projects || typeof config.projects !== "object") {
      config.projects = {};
    }

    // Expand ~ and resolve to absolute path
    let resolved = notesPath;
    if (resolved.startsWith("~")) {
      resolved = path.join(os.homedir(), resolved.slice(1));
    }
    resolved = path.resolve(resolved);

    (config.projects as Record<string, string>)[project] = resolved;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new Error(
      `Failed to update notes path: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Resolve a path, expanding ~ and making it absolute
 */
function resolvePath(inputPath: string): string {
  let resolved = inputPath;
  if (resolved.startsWith("~")) {
    resolved = path.join(os.homedir(), resolved.slice(1));
  }
  return path.resolve(resolved);
}

/**
 * Resolve notes_path option to an actual path
 *
 * BREAKING CHANGE: Default changed from 'CODE' to 'DEFAULT' mode.
 * To restore old behavior, explicitly pass notes_path='CODE'.
 *
 * @param option - NotesPathOption: 'DEFAULT', 'CODE', or absolute path
 * @param projectName - Project name (for DEFAULT option)
 * @param resolvedCodePath - Resolved code path (for CODE option)
 */
function resolveNotesPathOption(
  option: NotesPathOption | undefined,
  projectName: string,
  resolvedCodePath: string
): string {
  // Handle explicit CODE mode
  if (option === "CODE") {
    return path.join(resolvedCodePath, "docs");
  }

  // Default to DEFAULT mode if not specified, or explicit DEFAULT
  if (!option || option === "DEFAULT") {
    const defaultNotesPath = getDefaultNotesPath();
    const resolved = resolvePath(defaultNotesPath);
    return path.join(resolved, projectName);
  }

  // Treat as absolute path
  return resolvePath(option);
}

export async function handler(args: CreateProjectArgs): Promise<CallToolResult> {
  const { name, code_path, notes_path } = args;

  // Check if project already exists in basic-memory config
  const existingNotesPath = getNotesPath(name);
  if (existingNotesPath) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: `Project "${name}" already exists. Use edit_project to modify it, or delete_project to remove it first.`,
              suggestion: "Use edit_project to update configuration",
              existing_notes_path: existingNotesPath,
              existing_code_path: getCodePath(name) || null,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  // Check if project exists in brain-config code_paths
  const existingCodePath = getCodePath(name);
  if (existingCodePath) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: `Project "${name}" already exists. Use edit_project to modify it, or delete_project to remove it first.`,
              suggestion: "Use edit_project to update configuration",
              existing_notes_path: null,
              existing_code_path: existingCodePath,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  const resolvedCodePath = resolvePath(code_path);

  // Resolve notes_path using enum logic
  const resolvedNotesPath = resolveNotesPathOption(
    notes_path as NotesPathOption | undefined,
    name,
    resolvedCodePath
  );

  // Create notes directory if it doesn't exist
  if (!fs.existsSync(resolvedNotesPath)) {
    try {
      fs.mkdirSync(resolvedNotesPath, { recursive: true });
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                error: `Failed to create notes directory: ${error instanceof Error ? error.message : String(error)}`,
                attempted_path: resolvedNotesPath,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }

  // Set notes path in basic-memory config
  setNotesPath(name, resolvedNotesPath);

  // Set code path in brain config
  setCodePath(name, code_path);

  const response = {
    project: name,
    code_path: resolvedCodePath,
    notes_path: resolvedNotesPath,
    notes_path_mode: notes_path || "DEFAULT",
    created: true,
  };

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}
