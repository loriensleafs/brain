/**
 * Schema definitions for the find_duplicates tool
 *
 * Defines argument interface and tool definition for finding semantically
 * duplicate notes in a Brain project using embedding and fulltext similarity.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Arguments for find_duplicates tool
 */
export interface FindDuplicatesArgs {
	project?: string;
	embedding_threshold?: number;
	fulltext_threshold?: number;
}

export const toolDefinition: Tool = {
	name: "find_duplicates",
	description:
		"Find semantically duplicate notes in a Brain project using embedding and fulltext similarity. Returns candidate pairs and confirmed duplicates with similarity scores.",
	inputSchema: {
		type: "object" as const,
		properties: {
			project: {
				type: "string",
				description: "Project to analyze. Auto-resolved if not specified.",
			},
			embedding_threshold: {
				type: "number",
				default: 0.85,
				description:
					"Minimum embedding similarity score to consider notes as potential duplicates (0-1). Default: 0.85",
			},
			fulltext_threshold: {
				type: "number",
				default: 0.7,
				description:
					"Minimum fulltext similarity score to confirm duplicates (0-1). Default: 0.7",
			},
		},
	},
};
