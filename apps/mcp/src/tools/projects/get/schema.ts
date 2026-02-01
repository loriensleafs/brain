/**
 * Schema for get_project_details tool
 *
 * Migrated from Zod to JSON Schema + AJV per ADR-022.
 * JSON Schema source: packages/validation/schemas/tools/projects/get-project-details.schema.json
 */

import {
  type GetProjectDetailsArgs,
  parseGetProjectDetailsArgs,
  validateGetProjectDetailsArgs,
} from "@brain/validation";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export {
  validateGetProjectDetailsArgs,
  parseGetProjectDetailsArgs,
  type GetProjectDetailsArgs,
};

// Re-export for backward compatibility
export const GetProjectDetailsArgsSchema = {
  parse: parseGetProjectDetailsArgs,
  safeParse: (data: unknown) => {
    try {
      return { success: true as const, data: parseGetProjectDetailsArgs(data) };
    } catch (error) {
      return { success: false as const, error };
    }
  },
};

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
