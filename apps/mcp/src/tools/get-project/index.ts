/**
 * get_project tool implementation
 *
 * Returns current project state, resolution hierarchy, and available projects.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getBasicMemoryClient } from "../../proxy/client";
import {
  getActiveProject,
  resolveProject,
  getResolutionHierarchy,
} from "../../project/resolve";
import { getCodePaths } from "../../project/config";
import type { GetProjectArgs } from "./schema";

export async function handler(_args: GetProjectArgs): Promise<CallToolResult> {
  const client = await getBasicMemoryClient();
  const projectsResult = await client.callTool({
    name: "list_memory_projects",
    arguments: {},
  });

  const active = getActiveProject();
  const resolved = resolveProject();
  const codePaths = getCodePaths();
  const hierarchy = getResolutionHierarchy();

  const response = {
    active_project: active,
    resolved_project: resolved,
    resolution_hierarchy: hierarchy,
    code_paths: codePaths,
    available_projects: projectsResult,
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

export { toolDefinition } from "./schema";
