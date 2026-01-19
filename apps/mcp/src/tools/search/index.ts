/**
 * Unified search tool implementation
 *
 * Provides semantic search with automatic keyword fallback.
 * Uses sqlite-vec for vector similarity when embeddings are available.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getBasicMemoryClient } from "../../proxy/client";
import { createVectorConnection } from "../../db";
import { resolveProject } from "../../project/resolve";
import { logger } from "../../utils/internal/logger";
import { SearchArgsSchema, type SearchResult } from "./schema";
import { generateEmbedding } from "../../services/embedding/generateEmbedding";

/**
 * Response structure from basic-memory search_notes
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
 * Check if embeddings table has any entries
 */
function checkEmbeddingsExist(): boolean {
  try {
    const db = createVectorConnection();
    const row = db
      .query("SELECT COUNT(*) as count FROM brain_embeddings")
      .get() as { count: number } | null;
    db.close();
    return row ? row.count > 0 : false;
  } catch (error) {
    logger.debug({ error }, "Failed to check embeddings existence");
    return false;
  }
}

/**
 * Perform semantic vector search using sqlite-vec
 */
async function semanticSearch(
  query: string,
  limit: number,
  threshold: number
): Promise<SearchResult[]> {
  // Check if embeddings exist first
  if (!checkEmbeddingsExist()) {
    logger.debug("No embeddings in database, semantic search unavailable");
    return [];
  }

  try {
    // Generate query embedding using Ollama
    const queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding) {
      logger.debug("Failed to generate query embedding");
      return [];
    }

    // Query sqlite-vec for similar embeddings
    // Note: vec0 uses vec_distance_cosine(embedding, ?) syntax
    const db = createVectorConnection();
    const embeddingArr = new Float32Array(queryEmbedding);

    const results = db
      .query(
        `
        SELECT
          entity_id,
          vec_distance_cosine(embedding, ?) as distance
        FROM brain_embeddings
        WHERE distance <= ?
        ORDER BY distance ASC
        LIMIT ?
        `
      )
      .all(embeddingArr, 1 - threshold, limit) as Array<{
      entity_id: string;
      distance: number;
    }>;
    db.close();

    // Convert to search results - entity_id is the permalink
    // Extract title from permalink (last segment, humanized)
    return results.map((r) => {
      const parts = r.entity_id.split("/");
      const titleSlug = parts[parts.length - 1] || r.entity_id;
      const title = titleSlug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      return {
        permalink: r.entity_id,
        title,
        similarity_score: 1 - r.distance,
        snippet: "",
        source: "semantic" as const,
      };
    });
  } catch (error) {
    logger.error({ error }, "Semantic search failed");
    return [];
  }
}

/**
 * Extract wikilinks from note content
 * Matches [[Note Title]] patterns
 */
function extractWikilinks(content: string): string[] {
  const wikilinks: string[] = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const linkText = match[1];
    // Convert title to permalink-style (lowercase, spaces to hyphens)
    // Note: This is a rough conversion - actual lookup may be needed
    wikilinks.push(linkText);
  }

  return [...new Set(wikilinks)]; // Deduplicate
}

/**
 * Resolve a wikilink title to a permalink using keyword search
 */
async function resolveWikilinkToPermalink(
  title: string,
  project?: string
): Promise<string | null> {
  try {
    // Search for the exact title
    const results = await keywordSearch(`"${title}"`, 1, project);
    if (results.length > 0) {
      return results[0].permalink;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get related notes for a permalink by reading the note and extracting wikilinks
 */
async function getRelatedNotes(
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

    // Read the note content
    const result = await client.callTool({
      name: "read_note",
      arguments: args,
    });

    // Parse response to get content
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find(
        (c: { type: string }) => c.type === "text"
      );
      if (textContent && "text" in textContent) {
        const content = textContent.text as string;

        // Extract wikilinks from content
        const wikilinks = extractWikilinks(content);

        // Resolve wikilinks to permalinks (limit to 5 to avoid too many lookups)
        const relatedNotes: SearchResult[] = [];
        for (const title of wikilinks.slice(0, 5)) {
          const resolvedPermalink = await resolveWikilinkToPermalink(title, project);
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

/**
 * Expand search results with related notes up to specified depth
 */
async function expandWithRelations(
  results: SearchResult[],
  maxDepth: number,
  project?: string
): Promise<SearchResult[]> {
  if (maxDepth <= 0) {
    return results;
  }

  // Mark direct matches with depth 0
  const directMatches: SearchResult[] = results.map((r) => ({ ...r, depth: 0 }));
  const seenPermalinks = new Set(directMatches.map((r) => r.permalink));
  const allResults: SearchResult[] = [...directMatches];

  // Process each depth level
  let currentLevel: SearchResult[] = directMatches;
  for (let d = 1; d <= maxDepth; d++) {
    const nextLevel: SearchResult[] = [];

    for (const result of currentLevel) {
      const related = await getRelatedNotes(result.permalink, project);

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

/**
 * Perform keyword search via basic-memory proxy
 */
async function keywordSearch(
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

    // Add project if specified
    if (project) {
      args.project = project;
    }

    const result = await client.callTool({
      name: "search_notes",
      arguments: args,
    });

    // Parse response
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

/**
 * Main search handler with automatic fallback
 */
export async function handler(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  try {
    // Validate and parse input
    const parsed = SearchArgsSchema.parse(args);
    const { query, limit, threshold, mode, depth } = parsed;

    // Resolve project
    const project = parsed.project || resolveProject(undefined, process.cwd());

    logger.debug(
      { query, limit, threshold, mode, depth, project },
      "Executing unified search"
    );

    let results: SearchResult[] = [];

    if (mode === "keyword") {
      results = await keywordSearch(query, limit, project || undefined);
    } else if (mode === "semantic") {
      results = await semanticSearch(query, limit, threshold);
    } else {
      // Auto mode: semantic first, keyword fallback
      try {
        const hasEmbeddings = checkEmbeddingsExist();
        if (!hasEmbeddings) {
          logger.debug("No embeddings available, using keyword search");
          results = await keywordSearch(query, limit, project || undefined);
        } else {
          results = await semanticSearch(query, limit, threshold);
          if (results.length === 0) {
            logger.debug("Semantic search returned no results, falling back");
            results = await keywordSearch(query, limit, project || undefined);
          }
        }
      } catch (error) {
        logger.error({ error }, "Semantic search failed, falling back");
        results = await keywordSearch(query, limit, project || undefined);
      }
    }

    // Expand with related notes if depth > 0
    if (depth > 0) {
      results = await expandWithRelations(results, depth, project || undefined);
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              results,
              total: results.length,
              query,
              mode,
              depth,
            },
            null,
            2
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

export { toolDefinition } from "./schema";
export type { SearchArgs, SearchResult } from "./schema";
