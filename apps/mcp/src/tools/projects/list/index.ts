/**
 * list_projects tool implementation
 *
 * Lists all available projects from basic-memory.
 * Wrapper around basic-memory's list_memory_projects tool.
 *
 * Returns a simple array of project names.
 * For detailed project info, use get_project_details.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getBasicMemoryClient } from "../../../proxy/client";
import type { ListProjectsArgs } from "./schema";

export {
  type ListProjectsArgs,
  ListProjectsArgsSchema,
  toolDefinition,
} from "./schema";

export async function handler(
  _args: ListProjectsArgs,
): Promise<CallToolResult> {
  const client = await getBasicMemoryClient();

  // Get projects from basic-memory
  const projectsResult = await client.callTool({
    name: "list_memory_projects",
    arguments: {},
  });

  // Extract project names from result
  let projects: string[] = [];
  if (projectsResult.content && Array.isArray(projectsResult.content)) {
    for (const item of projectsResult.content) {
      if (item.type === "text" && item.text) {
        try {
          const parsed = JSON.parse(item.text);
          if (Array.isArray(parsed)) {
            projects = parsed;
          } else if (parsed.projects && Array.isArray(parsed.projects)) {
            projects = parsed.projects;
          }
        } catch {
          // If not JSON, try to parse as newline-separated list
          projects = item.text.split("\n").filter((p: string) => p.trim());
        }
      }
    }
  }

  // Return simple array of project names
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(projects, null, 2),
      },
    ],
  };
}
