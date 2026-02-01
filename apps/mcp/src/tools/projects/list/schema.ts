/**
 * Schema for list_projects tool
 *
 * Migrated from Zod to JSON Schema + AJV per ADR-022.
 * JSON Schema source: packages/validation/schemas/tools/projects/list-projects.schema.json
 */

import {
  type ListProjectsArgs,
  parseListProjectsArgs,
  validateListProjectsArgs,
} from "@brain/validation";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export {
  validateListProjectsArgs,
  parseListProjectsArgs,
  type ListProjectsArgs,
};

// Re-export for backward compatibility
export const ListProjectsArgsSchema = {
  parse: parseListProjectsArgs,
  safeParse: (data: unknown) => {
    try {
      return { success: true as const, data: parseListProjectsArgs(data) };
    } catch (error) {
      return { success: false as const, error };
    }
  },
};

export const toolDefinition: Tool = {
  name: "list_projects",
  description: `List all available Brain memory projects.

Returns a simple array of project names: ["project1", "project2"]

Use this to see what projects are available. For detailed project information
including code_path and memories_path, use get_project_details with a specific project name.`,
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};
