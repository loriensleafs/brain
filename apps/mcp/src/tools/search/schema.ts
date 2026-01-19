/**
 * Schema for unified search tool
 *
 * Defines input validation and tool definition for semantic/keyword search
 * with automatic fallback behavior.
 */
import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const SearchArgsSchema = z.object({
  query: z.string().min(1).describe("Search query text"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe("Maximum number of results to return"),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.7)
    .describe("Similarity threshold for semantic search (0-1)"),
  mode: z
    .enum(["auto", "semantic", "keyword"])
    .default("auto")
    .describe("Search mode: auto, semantic, or keyword"),
  depth: z
    .number()
    .int()
    .min(0)
    .max(3)
    .default(0)
    .describe("Relation depth: follow wikilinks N levels from results (0-3)"),
  project: z.string().optional().describe("Project name to search in"),
});

export type SearchArgs = z.infer<typeof SearchArgsSchema>;

export interface SearchResult {
  permalink: string;
  title: string;
  similarity_score: number;
  snippet: string;
  source: "semantic" | "keyword" | "related";
  depth?: number; // 0 = direct match, 1+ = related via wikilinks
}

export const toolDefinition: Tool = {
  name: "search",
  description: `Search knowledge base with automatic semantic/keyword fallback.

## Search Modes

- **auto** (default): Tries semantic search first, falls back to keyword if no embeddings or no results
- **semantic**: Vector similarity search only (requires embeddings)
- **keyword**: Text-based search via basic-memory

## Parameters

- \`query\`: Search text (required)
- \`limit\`: Max results (default: 10, max: 100)
- \`threshold\`: Similarity threshold for semantic (default: 0.7)
- \`mode\`: Search mode (default: auto)
- \`depth\`: Relation depth - follow wikilinks N levels from results (default: 0, max: 3)

## Returns

List of results with:
- \`permalink\`: Note identifier
- \`title\`: Note title
- \`similarity_score\`: Match score (0-1)
- \`snippet\`: Content preview
- \`source\`: Which search method was used`,
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Search query text",
        minLength: 1,
      },
      limit: {
        type: "number",
        description: "Maximum number of results (default: 10)",
        minimum: 1,
        maximum: 100,
      },
      threshold: {
        type: "number",
        description: "Similarity threshold for semantic search (default: 0.7)",
        minimum: 0,
        maximum: 1,
      },
      mode: {
        type: "string",
        enum: ["auto", "semantic", "keyword"],
        description: "Search mode (default: auto)",
      },
      depth: {
        type: "number",
        description: "Relation depth: follow wikilinks N levels from results (default: 0, max: 3)",
        minimum: 0,
        maximum: 3,
      },
      project: {
        type: "string",
        description: "Project name to search in",
      },
    },
    required: ["query"],
  },
};
