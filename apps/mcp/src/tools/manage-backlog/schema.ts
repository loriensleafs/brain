/**
 * Schema definitions for the manage_backlog tool
 *
 * Defines the tool interface for backlog management operations including
 * querying feature order, setting priorities, and managing dependencies.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Arguments for the manage_backlog tool
 */
export interface ManageBacklogArgs {
	project?: string;
	operation?:
		| "QUERY_ORDER"
		| "SET_PRIORITY"
		| "ADD_DEPENDENCY"
		| "REMOVE_DEPENDENCY";
	feature_id?: string;
	priority?: number;
	dependency_target?: string;
}

export const toolDefinition: Tool = {
	name: "manage_backlog",
	description:
		"Manage feature backlog with operations: QUERY_ORDER (get features sorted by dependency order then priority), SET_PRIORITY (update feature priority), ADD_DEPENDENCY (add dependency link), REMOVE_DEPENDENCY (remove dependency link)",
	inputSchema: {
		type: "object" as const,
		properties: {
			project: {
				type: "string",
				description: "Project to operate on. Auto-resolved if not specified.",
			},
			operation: {
				type: "string",
				enum: [
					"QUERY_ORDER",
					"SET_PRIORITY",
					"ADD_DEPENDENCY",
					"REMOVE_DEPENDENCY",
				],
				description:
					"Operation to perform: QUERY_ORDER, SET_PRIORITY, ADD_DEPENDENCY, or REMOVE_DEPENDENCY",
			},
			feature_id: {
				type: "string",
				description:
					"Feature permalink (required for SET_PRIORITY, ADD_DEPENDENCY, REMOVE_DEPENDENCY)",
			},
			priority: {
				type: "number",
				description: "Priority value 1-5 (required for SET_PRIORITY)",
			},
			dependency_target: {
				type: "string",
				description:
					"Target feature permalink (required for ADD_DEPENDENCY, REMOVE_DEPENDENCY)",
			},
		},
		required: ["operation"],
	},
};
