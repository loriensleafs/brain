/**
 * Schema for list_projects tool
 */
import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const ListProjectsArgsSchema = z.object({});

export type ListProjectsArgs = z.infer<typeof ListProjectsArgsSchema>;

export const toolDefinition: Tool = {
  name: "list_projects",
  description: `List all available Brain memory projects.

Returns a simple array of project names: ["project1", "project2"]

Use this to see what projects are available. For detailed project information
including code_path and notes_path, use get_project_details with a specific project name.`,
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};
