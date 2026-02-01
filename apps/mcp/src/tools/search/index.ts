/**
 * Unified search tool implementation
 *
 * Provides semantic search with automatic keyword fallback.
 * Delegates to SearchService for all search operations.
 *
 * @see SearchService for implementation details
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  getSearchService,
  type SearchMode,
  type SearchResult as ServiceSearchResult,
} from "../../services/search";
import { logger } from "../../utils/internal/logger";
import { SearchArgsSchema } from "./schema";

/**
 * Convert service SearchResult to tool SearchResult format.
 * Maps the 'hybrid' source to 'semantic' for tool output compatibility.
 */
function mapServiceResultToToolResult(result: ServiceSearchResult): {
  permalink: string;
  title: string;
  similarity_score: number;
  snippet: string;
  source: "semantic" | "keyword" | "related";
  depth?: number;
  fullContent?: string;
} {
  // Map hybrid source to semantic for backward compatibility
  const source = result.source === "hybrid" ? "semantic" : result.source;

  const mapped: {
    permalink: string;
    title: string;
    similarity_score: number;
    snippet: string;
    source: "semantic" | "keyword" | "related";
    depth?: number;
    fullContent?: string;
  } = {
    permalink: result.permalink,
    title: result.title,
    similarity_score: result.similarity_score,
    snippet: result.snippet,
    source,
    depth: result.depth,
  };

  // Include fullContent when present
  if (result.fullContent) {
    mapped.fullContent = result.fullContent;
  }

  return mapped;
}

/**
 * Main search handler with automatic fallback.
 * Delegates to SearchService for all search operations.
 */
export async function handler(
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  try {
    // Validate and parse input
    const parsed = SearchArgsSchema.parse(args);
    const { query, limit, threshold, mode, depth, project, full_context } =
      parsed;

    logger.debug(
      { query, limit, threshold, mode, depth, project, full_context },
      "Executing unified search via SearchService",
    );

    // Get the shared SearchService instance
    const searchService = getSearchService();

    // Execute search through SearchService
    // Map snake_case full_context to camelCase fullContent for service
    const response = await searchService.search(query, {
      limit,
      threshold,
      mode: mode as SearchMode,
      depth,
      project: project || undefined,
      fullContent: full_context,
    });

    // Map results to tool output format
    const results = response.results.map(mapServiceResultToToolResult);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              results,
              total: response.total,
              query: response.query,
              mode: response.mode,
              depth: response.depth,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    logger.error({ error }, "Search failed");
    return {
      content: [
        {
          type: "text" as const,
          text: `Error in search: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
}

export type { SearchArgs, SearchResult } from "./schema";
export { toolDefinition } from "./schema";
