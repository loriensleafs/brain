/**
 * get_project_details tool implementation
 *
 * Gets detailed information about a specific project including
 * memories path, code path, and whether it's currently active.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { getCodePath } from "../../../project/config";
import { resolveProject } from "../../../project/resolve";
import { getBasicMemoryClient } from "../../../proxy/client";
import type { GetProjectDetailsArgs } from "./schema";

export {
  toolDefinition,
  GetProjectDetailsArgsSchema,
  type GetProjectDetailsArgs,
} from "./schema";

/**
 * Get list of available projects from basic-memory config
 */
async function getAvailableProjects(): Promise<string[]> {
  const configPath = path.join(os.homedir(), ".basic-memory", "config.json");
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      if (config.projects && typeof config.projects === "object") {
        return Object.keys(config.projects);
      }
    }
  } catch {
    // Fall back to listing projects via basic-memory
  }

  // Fallback: use basic-memory client
  try {
    const client = await getBasicMemoryClient();
    const result = await client.callTool({
      name: "list_memory_projects",
      arguments: {},
    });

    if (result.content && Array.isArray(result.content)) {
      for (const item of result.content) {
        if (item.type === "text" && item.text) {
          try {
            const parsed = JSON.parse(item.text);
            if (Array.isArray(parsed)) {
              return parsed;
            } else if (parsed.projects && Array.isArray(parsed.projects)) {
              return parsed.projects;
            }
          } catch {
            return item.text.split("\n").filter((p: string) => p.trim());
          }
        }
      }
    }
  } catch {
    // Return empty if all else fails
  }

  return [];
}

/**
 * Get memories path for a project from basic-memory config
 */
function getMemoriesPath(project: string): string | null {
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

export async function handler(args: GetProjectDetailsArgs): Promise<CallToolResult> {
  const { project } = args;

  // Get memories path from basic-memory config
  const memoriesPath = getMemoriesPath(project);

  // If project doesn't exist, return error with available projects
  if (!memoriesPath) {
    const availableProjects = await getAvailableProjects();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: `Project "${project}" does not exist`,
              available_projects: availableProjects,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  // Get code path from brain config
  const codePath = getCodePath(project);

  // Check if this project is currently active
  const currentProject = resolveProject();
  const isActive = currentProject === project;

  const response = {
    project,
    memories_path: memoriesPath,
    code_path: codePath || null,
    isActive,
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
