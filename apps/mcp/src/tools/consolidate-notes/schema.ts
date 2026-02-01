/**
 * Schema definitions for the consolidate_notes tool
 *
 * Identifies merge and split candidates in a Brain project to improve
 * knowledge organization and reduce redundancy.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Arguments for the consolidate_notes tool
 */
export interface ConsolidateNotesArgs {
	project?: string;
	similarity_threshold?: number;
	min_note_size?: number;
	max_note_size?: number;
}

export const toolDefinition: Tool = {
	name: "consolidate_notes",
	description:
		"Analyze a Brain project for consolidation opportunities. Identifies merge candidates (small related notes) and split candidates (large multi-topic notes).",
	inputSchema: {
		type: "object" as const,
		properties: {
			project: {
				type: "string",
				description: "Project to analyze. Auto-resolved if not specified.",
			},
			similarity_threshold: {
				type: "number",
				default: 0.85,
				description:
					"Minimum similarity score (0-1) for merge candidates. Higher = stricter matching.",
			},
			min_note_size: {
				type: "number",
				default: 10,
				description:
					"Minimum line count for notes to be considered for merging.",
			},
			max_note_size: {
				type: "number",
				default: 200,
				description:
					"Maximum line count before a note is flagged for splitting.",
			},
		},
	},
};
