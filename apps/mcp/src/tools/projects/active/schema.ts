/**
 * Schema for active_project tool
 *
 * Migrated from Zod to JSON Schema + AJV per ADR-022.
 * JSON Schema source: packages/validation/schemas/tools/projects/active-project.schema.json
 */

import {
	type ActiveProjectArgs,
	parseActiveProjectArgs,
	validateActiveProjectArgs,
} from "@brain/validation";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export {
	validateActiveProjectArgs,
	parseActiveProjectArgs,
	type ActiveProjectArgs,
};

// Re-export for backward compatibility
export const ActiveProjectArgsSchema = {
	parse: parseActiveProjectArgs,
	safeParse: (data: unknown) => {
		try {
			return { success: true as const, data: parseActiveProjectArgs(data) };
		} catch (error) {
			return { success: false as const, error };
		}
	},
};

export const toolDefinition: Tool = {
	name: "active_project",
	description: `Manage the active project for this session.

Operations:
- get: Returns current active project, resolution hierarchy, and code paths
- set: Sets the active project (requires project parameter)
- clear: Clears the active project, forcing re-selection

Example usage:
- Get current: active_project (or active_project with operation="get")
- Set: active_project with operation="set", project="myproject"
- Clear: active_project with operation="clear"`,
	inputSchema: {
		type: "object" as const,
		properties: {
			operation: {
				type: "string",
				enum: ["get", "set", "clear"],
				default: "get",
				description: "Operation to perform: get (default), set, or clear",
			},
			project: {
				type: "string",
				description: "Project name (required for set operation)",
			},
		},
	},
};
