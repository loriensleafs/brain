/**
 * Schema definitions for the migrate_cluster tool
 *
 * Defines types for migration execution including input changes,
 * output results, and the tool definition for MCP registration.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Supported migration operation types
 */
export type MigrationOperation = "move" | "rename" | "restructure";

/**
 * Single migration change to execute
 */
export interface MigrationChange {
	source: string;
	target: string;
	operation: MigrationOperation;
}

/**
 * Input arguments for migrate_cluster tool
 *
 * Note: changes is typed as optional to allow the handler to receive
 * Record<string, unknown> from the MCP framework. Validation is done in handler.
 */
export interface MigrateClusterArgs {
	project?: string;
	changes?: MigrationChange[];
	dry_run?: boolean;
}

/**
 * Result of a single migration operation
 */
export interface MigrationResult {
	source: string;
	target: string;
	operation: string;
	success: boolean;
	error?: string;
}

/**
 * Output from migrate_cluster tool execution
 */
export interface MigrateClusterOutput {
	success: boolean;
	changes_applied: number;
	changes_failed: number;
	results: MigrationResult[];
	errors: string[];
}

export const toolDefinition: Tool = {
	name: "migrate_cluster",
	description: `Execute migrations from an analyze_project preview. Moves, renames, or restructures notes to conform to Brain project conventions.

Usage:
1. First run analyze_project with preview=true to get migration plan
2. Pass the changes array from the preview to this tool
3. Use dry_run=true to see what would happen without making changes

The tool uses Basic Memory's move_note internally and handles errors gracefully - one failed migration won't stop the rest.`,
	inputSchema: {
		type: "object" as const,
		properties: {
			project: {
				type: "string",
				description: "Project to migrate. Auto-resolved if not specified.",
			},
			changes: {
				type: "array",
				description: "Array of migration changes from analyze_project preview",
				items: {
					type: "object",
					properties: {
						source: { type: "string", description: "Source path of the note" },
						target: { type: "string", description: "Target path for the note" },
						operation: {
							type: "string",
							enum: ["move", "rename", "restructure"],
							description: "Type of migration operation",
						},
					},
					required: ["source", "target", "operation"],
				},
			},
			dry_run: {
				type: "boolean",
				default: false,
				description: "When true, show what would happen without making changes",
			},
		},
		required: ["changes"],
	},
};
