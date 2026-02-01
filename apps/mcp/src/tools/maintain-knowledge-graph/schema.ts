/**
 * Schema definitions for the maintain_knowledge_graph tool
 *
 * Defines input parameters and MCP tool definition for monitoring knowledge graph
 * health. Identifies orphan notes, stale content, gap references, and low-quality notes.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Arguments for maintain_knowledge_graph tool
 */
export interface MaintainKnowledgeGraphArgs {
  project?: string;
  stale_threshold_days?: number;
  quality_threshold?: number;
}

export const toolDefinition: Tool = {
  name: "maintain_knowledge_graph",
  description:
    "Monitor knowledge graph health by identifying quality issues: orphan notes (no relations), stale notes (not updated recently), gap references (missing wikilinks), and weak notes (below quality threshold).",
  inputSchema: {
    type: "object" as const,
    properties: {
      project: {
        type: "string",
        description: "Project to analyze. Auto-resolved if not specified.",
      },
      stale_threshold_days: {
        type: "number",
        default: 90,
        description: "Days since last update to consider a note stale.",
      },
      quality_threshold: {
        type: "number",
        default: 0.5,
        description: "Minimum quality score (0-1) for notes.",
      },
    },
  },
};
