/**
 * Schema for unified search tool
 *
 * Defines input validation and tool definition for semantic/keyword search
 * with automatic fallback behavior.
 *
 * Note: SearchResult type is maintained here for tool output compatibility.
 * The internal SearchService uses its own SearchResult type which includes
 * additional source types (hybrid). The tool handler maps between them.
 *
 * Validation: Uses JSON Schema via AJV from @brain/validation
 *
 * @see SearchService for the underlying implementation
 */

import { parseSearchArgs as _parseSearchArgs, type SearchArgs } from "@brain/validation";
import searchSchema from "@brain/validation/schemas/tools/search.schema.json";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// Re-export type for backward compatibility
export type { SearchArgs };

/**
 * SearchArgsSchema provides Zod-compatible interface.
 * Uses AJV validation under the hood for 5-18x better performance.
 */
export const SearchArgsSchema = {
  parse: _parseSearchArgs,
};

export interface SearchResult {
  permalink: string;
  title: string;
  similarity_score: number;
  snippet: string;
  source: "semantic" | "keyword" | "related";
  depth?: number; // 0 = direct match, 1+ = related via wikilinks
  fullContent?: string; // Full note content when full_context=true (limited to 5000 chars)
}

export const toolDefinition: Tool = {
  name: "search",
  description: `Search knowledge base with automatic semantic/keyword fallback.

## Search Modes

- **auto** (default): Tries semantic search first, falls back to keyword if no embeddings or no results
- **semantic**: Vector similarity search only (requires embeddings)
- **keyword**: Text-based search via basic-memory
- **hybrid**: Combines semantic and keyword results with score fusion

## Parameters

- \`query\`: Search text (required)
- \`limit\`: Max results (default: 10, max: 100)
- \`threshold\`: Similarity threshold for semantic (default: 0.7)
- \`mode\`: Search mode (default: auto)
- \`depth\`: Relation depth - follow wikilinks N levels from results (default: 0, max: 3)
- \`full_context\`: When true, include full note content instead of snippets (default: false)

## Returns

List of results with:
- \`permalink\`: Note identifier
- \`title\`: Note title
- \`similarity_score\`: Match score (0-1)
- \`snippet\`: Content preview
- \`fullContent\`: Full note content (only when full_context=true, limited to 5000 chars)
- \`source\`: Which search method was used`,
  inputSchema: searchSchema as Tool["inputSchema"],
};
