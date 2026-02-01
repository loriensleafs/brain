/**
 * get_project_details tool implementation
 *
 * Gets detailed information about a specific project including
 * memories path, code path, and whether it's currently active.
 */

import {
  getAvailableProjects,
  getProjectMemoriesPath,
  ProjectNotFoundError,
} from "@brain/utils";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getCodePath } from "../../../project/config";
import { resolveProject } from "../../../project/resolve";
import type { GetProjectDetailsArgs } from "./schema";

export {
  type GetProjectDetailsArgs,
  GetProjectDetailsArgsSchema,
  toolDefinition,
} from "./schema";

export async function handler(
  args: GetProjectDetailsArgs,
): Promise<CallToolResult> {
  const { project } = args;

  // Get memories path from basic-memory config
  let memoriesPath: string;
  try {
    memoriesPath = await getProjectMemoriesPath(project);
  } catch (error) {
    // If project doesn't exist, return error with available projects
    if (error instanceof ProjectNotFoundError) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                error: `Project "${project}" does not exist`,
                available_projects: error.availableProjects,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }
    // Re-throw unexpected errors
    throw error;
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
