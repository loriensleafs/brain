/**
 * SearchService - Unified search abstraction for Brain MCP
 *
 * Provides a clean interface for semantic, keyword, and hybrid search
 * operations. Wraps the underlying search tool implementation.
 *
 * Semantic search uses chunked embeddings and deduplicates results by note,
 * returning the best matching chunk's text as the snippet.
 *
 * @see ADR-001: Search Service Abstraction
 */

import { getBasicMemoryClient } from "../../proxy/client";
import { createVectorConnection } from "../../db";
import { ensureEmbeddingTables } from "../../db/schema";
import {
  hasEmbeddings,
  semanticSearchChunked,
  deduplicateByEntity,
} from "../../db/vectors";
import { resolveProject } from "../../project/resolve";
import { logger } from "../../utils/internal/logger";
import { generateEmbedding } from "../embedding/generateEmbedding";
import { OllamaClient } from "../ollama/client";
import { ollamaConfig } from "../../config/ollama";
import type {
  SearchOptions,
  SearchResult,
  SearchResponse,
  SearchSource,
} from "./types";

// Re-export types for consumers
export type {
  SearchMode,
  SearchSource,
  SearchOptions,
  SearchResult,
  SearchResponse,
} from "./types";

/**
 * Default search options.
 */
const DEFAULT_OPTIONS: Required<Omit<SearchOptions, "project" | "folders" | "afterDate" | "fullContent">> & { fullContent: boolean } = {
  limit: 10,
  threshold: 0.7,
  mode: "auto",
  depth: 0,
  fullContent: false,
};

/**
 * Maximum characters for full note content.
 * Prevents token explosion in LLM context.
 */
const FULL_CONTENT_CHAR_LIMIT = 5000;

/**
 * Response structure from basic-memory search_notes.
 */
interface BasicMemorySearchResponse {
  results: Array<{
    title: string;
    permalink: string;
    content?: string;
    score?: number;
    [key: string]: unknown;
  }>;
  total: number;
  page: number;
  page_size: number;
}

/**
 * SearchService provides unified search capabilities across Brain MCP.
 *
 * Usage:
 * ```typescript
 * const searchService = new SearchService();
 *
 * // Semantic search (default auto mode)
 * const results = await searchService.search("authentication patterns");
 *
 * // Explicit keyword search
 * const keywordResults = await searchService.search("bug fix", { mode: "keyword" });
 *
 * // Semantic-only search with custom threshold
 * const semanticResults = await searchService.semanticSearch("design decisions", 5, 0.8);
 * ```
 */
export class SearchService {
  private defaultProject?: string;

  /**
   * Cache for full note content to avoid duplicate reads.
   * Key: permalink, Value: full content string
   */
  private fullContentCache: Map<string, string> = new Map();

  /**
   * Create a new SearchService instance.
   *
   * @param defaultProject - Optional default project for all searches
   */
  constructor(defaultProject?: string) {
    this.defaultProject = defaultProject;
  }

  /**
   * Clear the full content cache.
   * Useful for long-running services or testing.
   */
  clearFullContentCache(): void {
    this.fullContentCache.clear();
  }

  /**
   * Perform a unified search with automatic mode selection.
   *
   * @param query - Search query text
   * @param options - Search configuration options
   * @returns Search response with results and metadata
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResponse> {
    const opts = {
      ...DEFAULT_OPTIONS,
      ...options,
      project: options?.project ?? this.defaultProject,
      folders: options?.folders,
      afterDate: options?.afterDate,
    };

    const resolvedProject = this.resolveProjectContext(opts.project);

    logger.debug(
      { query, ...opts, resolvedProject },
      "SearchService executing search"
    );

    let results: SearchResult[] = [];
    let actualSource: SearchSource = "keyword";

    switch (opts.mode) {
      case "keyword":
        results = await this.executeKeywordSearch(query, opts.limit, resolvedProject);
        actualSource = "keyword";
        break;

      case "semantic":
        results = await this.executeSemanticSearch(query, opts.limit, opts.threshold);
        actualSource = "semantic";
        break;

      case "hybrid":
        results = await this.executeHybridSearch(
          query,
          opts.limit,
          opts.threshold,
          resolvedProject
        );
        actualSource = "hybrid";
        break;

      case "auto":
      default:
        const searchResult = await this.executeAutoSearch(
          query,
          opts.limit,
          opts.threshold,
          resolvedProject
        );
        results = searchResult.results;
        actualSource = searchResult.source;
        break;
    }

    // Apply folder filter if specified
    if (opts.folders && opts.folders.length > 0) {
      results = this.filterByFolders(results, opts.folders);
    }

    // Expand with related notes if depth > 0
    if (opts.depth > 0) {
      results = await this.expandWithRelations(results, opts.depth, resolvedProject);
    }

    // Fetch full content if requested
    if (opts.fullContent) {
      results = await this.enrichWithFullContent(results, resolvedProject);
    }

    return {
      results,
      total: results.length,
      query,
      mode: opts.mode,
      depth: opts.depth,
      actualSource,
    };
  }

  /**
   * Filter results to only include notes in specified folders.
   */
  private filterByFolders(results: SearchResult[], folders: string[]): SearchResult[] {
    return results.filter((result) => {
      return folders.some((folder) => {
        const normalizedFolder = folder.endsWith("/") ? folder : `${folder}/`;
        return result.permalink.startsWith(normalizedFolder) ||
               result.permalink.startsWith(folder);
      });
    });
  }

  /**
   * Perform semantic-only vector search.
   *
   * @param query - Search query text
   * @param limit - Maximum results to return
   * @param threshold - Similarity threshold (0-1)
   * @returns Array of search results
   */
  async semanticSearch(
    query: string,
    limit: number = DEFAULT_OPTIONS.limit,
    threshold: number = DEFAULT_OPTIONS.threshold
  ): Promise<SearchResult[]> {
    return this.executeSemanticSearch(query, limit, threshold);
  }

  /**
   * Perform keyword-only text search.
   *
   * @param query - Search query text
   * @param limit - Maximum results to return
   * @param project - Optional project context
   * @returns Array of search results
   */
  async keywordSearch(
    query: string,
    limit: number = DEFAULT_OPTIONS.limit,
    project?: string
  ): Promise<SearchResult[]> {
    const resolvedProject = this.resolveProjectContext(
      project ?? this.defaultProject
    );
    return this.executeKeywordSearch(query, limit, resolvedProject);
  }

  /**
   * Check if embeddings are available for semantic search.
   *
   * @returns True if embeddings exist in the database
   */
  hasEmbeddings(): boolean {
    return this.checkEmbeddingsExist();
  }

  // ============================================================================
  // Private Implementation Methods
  // ============================================================================

  private resolveProjectContext(project?: string): string | undefined {
    if (project) return project;
    return resolveProject(undefined) ?? undefined;
  }

  /**
   * Check if embeddings exist in the database.
   */
  private checkEmbeddingsExist(): boolean {
    try {
      const db = createVectorConnection();
      ensureEmbeddingTables(db);
      const exists = hasEmbeddings(db);
      db.close();
      return exists;
    } catch (error) {
      logger.debug({ error }, "Failed to check embeddings existence");
      return false;
    }
  }

  /**
   * Fetch full note content for a single permalink.
   * Uses caching to avoid duplicate reads within the same service instance.
   *
   * @param permalink - Note identifier to read
   * @param project - Optional project context
   * @returns Full content string, limited to FULL_CONTENT_CHAR_LIMIT characters
   */
  private async fetchFullContent(
    permalink: string,
    project?: string
  ): Promise<string> {
    // Check cache first
    const cacheKey = project ? `${project}:${permalink}` : permalink;
    if (this.fullContentCache.has(cacheKey)) {
      return this.fullContentCache.get(cacheKey)!;
    }

    try {
      const client = await getBasicMemoryClient();

      const args: Record<string, unknown> = {
        identifier: permalink,
      };

      if (project) {
        args.project = project;
      }

      const result = await client.callTool({
        name: "read_note",
        arguments: args,
      });

      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content.find(
          (c: { type: string }) => c.type === "text"
        );
        if (textContent && "text" in textContent) {
          let content = textContent.text as string;

          // Apply character limit to prevent token explosion
          if (content.length > FULL_CONTENT_CHAR_LIMIT) {
            content = content.slice(0, FULL_CONTENT_CHAR_LIMIT);
            logger.debug(
              { permalink, originalLength: (textContent.text as string).length },
              "Truncated full content to character limit"
            );
          }

          // Cache the result
          this.fullContentCache.set(cacheKey, content);
          return content;
        }
      }

      logger.debug({ permalink }, "No text content found in read_note response");
      return "";
    } catch (error) {
      logger.debug({ error, permalink }, "Failed to fetch full content for note");
      return "";
    }
  }

  /**
   * Enrich search results with full note content.
   * Fetches content in parallel for performance.
   *
   * @param results - Search results to enrich
   * @param project - Optional project context
   * @returns Results with fullContent field populated
   */
  private async enrichWithFullContent(
    results: SearchResult[],
    project?: string
  ): Promise<SearchResult[]> {
    const enriched = await Promise.all(
      results.map(async (result) => {
        const fullContent = await this.fetchFullContent(result.permalink, project);
        return {
          ...result,
          fullContent: fullContent || undefined,
        };
      })
    );

    logger.debug(
      { count: results.length, enrichedCount: enriched.filter(r => r.fullContent).length },
      "Enriched search results with full content"
    );

    return enriched;
  }

  private async executeSemanticSearch(
    query: string,
    limit: number,
    threshold: number
  ): Promise<SearchResult[]> {
    if (!this.checkEmbeddingsExist()) {
      logger.debug("No embeddings in database, semantic search unavailable");
      return [];
    }

    try {
      // Generate query embedding using OllamaClient directly to specify search_query task type
      const client = new OllamaClient(ollamaConfig);
      const queryEmbedding = await client.generateEmbedding(query, "search_query");
      if (!queryEmbedding) {
        logger.debug("Failed to generate query embedding");
        return [];
      }

      const db = createVectorConnection();
      ensureEmbeddingTables(db);

      // Search across all chunks, fetch more than limit to allow for deduplication
      const rawResults = semanticSearchChunked(
        db,
        queryEmbedding,
        limit * 3, // Fetch extra to ensure enough after deduplication
        threshold
      );
      db.close();

      // Deduplicate by entity, keeping best chunk per note
      const deduplicated = deduplicateByEntity(rawResults);

      // Limit to requested number and map to SearchResult
      return deduplicated.slice(0, limit).map((r) => {
        const parts = r.entityId.split("/");
        const titleSlug = parts[parts.length - 1] || r.entityId;
        const title = titleSlug
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());

        return {
          permalink: r.entityId,
          title,
          similarity_score: r.similarity,
          // Use the matching chunk's text as the snippet
          snippet: r.chunkText.slice(0, 200),
          source: "semantic" as const,
        };
      });
    } catch (error) {
      logger.error({ error }, "Semantic search failed");
      return [];
    }
  }

  private async executeKeywordSearch(
    query: string,
    limit: number,
    project?: string
  ): Promise<SearchResult[]> {
    const client = await getBasicMemoryClient();

    try {
      const args: Record<string, unknown> = {
        query,
        page_size: limit,
      };

      if (project) {
        args.project = project;
      }

      const result = await client.callTool({
        name: "search_notes",
        arguments: args,
      });

      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content.find(
          (c: { type: string }) => c.type === "text"
        );
        if (textContent && "text" in textContent) {
          try {
            const parsed = JSON.parse(
              textContent.text as string
            ) as BasicMemorySearchResponse;
            return parsed.results.map((r) => ({
              permalink: r.permalink || "",
              title: r.title || "",
              similarity_score: r.score ?? 0,
              snippet: r.content?.slice(0, 200) ?? "",
              source: "keyword" as const,
            }));
          } catch (parseError) {
            logger.debug({ error: parseError }, "Failed to parse search response");
          }
        }
      }

      return [];
    } catch (error) {
      logger.error({ error }, "Keyword search failed");
      throw error;
    }
  }

  private async executeHybridSearch(
    query: string,
    limit: number,
    threshold: number,
    project?: string
  ): Promise<SearchResult[]> {
    // Execute both searches in parallel
    const [semanticResults, keywordResults] = await Promise.all([
      this.executeSemanticSearch(query, limit, threshold),
      this.executeKeywordSearch(query, limit, project),
    ]);

    // Merge and deduplicate by permalink, preferring semantic results
    const seen = new Set<string>();
    const merged: SearchResult[] = [];

    // Add semantic results first (higher quality)
    for (const result of semanticResults) {
      if (!seen.has(result.permalink)) {
        seen.add(result.permalink);
        merged.push({ ...result, source: "hybrid" });
      }
    }

    // Add keyword results not already included
    for (const result of keywordResults) {
      if (!seen.has(result.permalink)) {
        seen.add(result.permalink);
        merged.push({ ...result, source: "hybrid" });
      }
    }

    // Sort by similarity score descending
    merged.sort((a, b) => b.similarity_score - a.similarity_score);

    return merged.slice(0, limit);
  }

  private async executeAutoSearch(
    query: string,
    limit: number,
    threshold: number,
    project?: string
  ): Promise<{ results: SearchResult[]; source: SearchSource }> {
    const hasEmbeddings = this.checkEmbeddingsExist();

    if (!hasEmbeddings) {
      logger.debug("No embeddings available, using keyword search");
      const results = await this.executeKeywordSearch(query, limit, project);
      return { results, source: "keyword" };
    }

    try {
      const semanticResults = await this.executeSemanticSearch(query, limit, threshold);
      if (semanticResults.length > 0) {
        return { results: semanticResults, source: "semantic" };
      }

      logger.debug("Semantic search returned no results, falling back to keyword");
      const keywordResults = await this.executeKeywordSearch(query, limit, project);
      return { results: keywordResults, source: "keyword" };
    } catch (error) {
      logger.error({ error }, "Semantic search failed, falling back to keyword");
      const results = await this.executeKeywordSearch(query, limit, project);
      return { results, source: "keyword" };
    }
  }

  private async expandWithRelations(
    results: SearchResult[],
    maxDepth: number,
    project?: string
  ): Promise<SearchResult[]> {
    if (maxDepth <= 0) {
      return results;
    }

    const directMatches: SearchResult[] = results.map((r) => ({ ...r, depth: 0 }));
    const seenPermalinks = new Set(directMatches.map((r) => r.permalink));
    const allResults: SearchResult[] = [...directMatches];

    let currentLevel: SearchResult[] = directMatches;
    for (let d = 1; d <= maxDepth; d++) {
      const nextLevel: SearchResult[] = [];

      for (const result of currentLevel) {
        const related = await this.getRelatedNotes(result.permalink, project);

        for (const r of related) {
          if (!seenPermalinks.has(r.permalink)) {
            seenPermalinks.add(r.permalink);
            const relatedWithDepth: SearchResult = { ...r, depth: d };
            nextLevel.push(relatedWithDepth);
            allResults.push(relatedWithDepth);
          }
        }
      }

      currentLevel = nextLevel;
      if (currentLevel.length === 0) break;
    }

    logger.debug(
      { direct: directMatches.length, total: allResults.length, maxDepth },
      "Expanded search with relations"
    );

    return allResults;
  }

  private async getRelatedNotes(
    permalink: string,
    project?: string
  ): Promise<SearchResult[]> {
    const client = await getBasicMemoryClient();

    try {
      const args: Record<string, unknown> = {
        identifier: permalink,
      };

      if (project) {
        args.project = project;
      }

      const result = await client.callTool({
        name: "read_note",
        arguments: args,
      });

      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content.find(
          (c: { type: string }) => c.type === "text"
        );
        if (textContent && "text" in textContent) {
          const content = textContent.text as string;
          const wikilinks = this.extractWikilinks(content);

          const relatedNotes: SearchResult[] = [];
          for (const title of wikilinks.slice(0, 5)) {
            const resolvedPermalink = await this.resolveWikilinkToPermalink(
              title,
              project
            );
            relatedNotes.push({
              permalink: resolvedPermalink || "",
              title,
              similarity_score: 0.5,
              snippet: `Related via [[${title}]]`,
              source: "related" as const,
            });
          }

          return relatedNotes;
        }
      }

      return [];
    } catch (error) {
      logger.debug({ error, permalink }, "Failed to get related notes");
      return [];
    }
  }

  private extractWikilinks(content: string): string[] {
    const wikilinks: string[] = [];
    const regex = /\[\[([^\]]+)\]\]/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      wikilinks.push(match[1]);
    }

    return [...new Set(wikilinks)];
  }

  private async resolveWikilinkToPermalink(
    title: string,
    project?: string
  ): Promise<string | null> {
    try {
      const results = await this.executeKeywordSearch(`"${title}"`, 1, project);
      if (results.length > 0) {
        return results[0].permalink;
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Default singleton instance for convenience.
 */
let defaultInstance: SearchService | null = null;

/**
 * Get the default SearchService instance.
 * Creates one if it does not exist.
 */
export function getSearchService(): SearchService {
  if (!defaultInstance) {
    defaultInstance = new SearchService();
  }
  return defaultInstance;
}

/**
 * Create a new SearchService instance with a specific project context.
 */
export function createSearchService(project?: string): SearchService {
  return new SearchService(project);
}
