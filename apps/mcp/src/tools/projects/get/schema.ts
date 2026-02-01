/**
 * Schema for get_project_details tool
 */
import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const GetProjectDetailsArgsSchema = z.object({
  project: z.string().describe("Project name to get details for"),
});

export type GetProjectDetailsArgs = z.infer<typeof GetProjectDetailsArgsSchema>;

export const toolDefinition: Tool = {
  name: "get_project_details",
  description: `Get detailed information about a specific Brain memory project.

Returns:
- project: Project name
- memories_path: Path to memories directory
- code_path: Configured code directory path (if set)
- isActive: Whether this project is currently active

If project does not exist, returns an error with a list of available projects.

Use this to inspect project configuration before editing.`,
  inputSchema: {
    type: "object" as const,
    properties: {
      project: {
        type: "string",
        description: "Project name to get details for",
      },
    },
    required: ["project"],
  },
};
