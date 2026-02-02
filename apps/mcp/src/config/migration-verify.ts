/**
 * Migration Verification Module
 *
 * Verifies that migrated memories are properly indexed and searchable.
 * Used by migration tools to ensure semantic search works after migration.
 *
 * Verification process:
 * 1. Search by title using SearchService
 * 2. Verify content match (first 100 chars)
 * 3. Return list of missing/mismatched memories
 *
 * @see ADR-020 for migration requirements
 * @see TASK-020-10 for acceptance criteria
 */

import { getBasicMemoryClient } from "../proxy/client";
import { SearchService } from "../services/search";
import { logger } from "../utils/internal/logger";

/**
 * Result of verifying a single memory note.
 */
export interface MemoryVerificationResult {
  /** Title of the memory being verified */
  title: string;

  /** Permalink of the memory */
  permalink: string;

  /** Verification status */
  status: "found" | "missing" | "mismatched";

  /** Expected content prefix (first 100 chars) */
  expectedPrefix?: string;

  /** Actual content prefix found (first 100 chars) */
  actualPrefix?: string;

  /** Similarity score from search */
  similarityScore?: number;

  /** Error message if verification failed */
  error?: string;
}

/**
 * Summary of memory indexing verification.
 */
export interface VerificationSummary {
  /** Total memories verified */
  total: number;

  /** Successfully found and matched */
  found: number;

  /** Not found in search */
  missing: number;

  /** Found but content mismatch */
  mismatched: number;

  /** Verification passed (all found and matched) */
  success: boolean;

  /** Individual verification results */
  results: MemoryVerificationResult[];

  /** Timestamp of verification */
  verifiedAt: Date;
}

/**
 * Memory entry to verify.
 */
export interface MemoryToVerify {
  /** Title of the memory note */
  title: string;

  /** Expected permalink path */
  permalink: string;

  /** Expected content (at least first 100 chars) */
  content: string;
}

/**
 * Content prefix length for verification.
 * Compares first N characters of content.
 */
const CONTENT_PREFIX_LENGTH = 100;

/**
 * Search similarity threshold for title matching.
 */
const SEARCH_THRESHOLD = 0.5;

/**
 * Maximum search results to check per memory.
 */
const SEARCH_LIMIT = 5;

/**
 * Verify that migrated memories are properly indexed and searchable.
 *
 * Performs the following checks for each memory:
 * 1. Search by title to find the memory
 * 2. Verify the permalink matches
 * 3. Compare content prefix (first 100 chars)
 *
 * @param memories - Array of memories to verify
 * @param project - Optional project context for search
 * @returns Verification summary with results
 *
 * @example
 * ```typescript
 * const memories = [
 *   { title: "Authentication Patterns", permalink: "patterns/auth", content: "..." },
 *   { title: "Database Design", permalink: "decisions/db", content: "..." },
 * ];
 *
 * const summary = await verifyMemoryIndexing(memories);
 * if (!summary.success) {
 *   console.log("Missing memories:", summary.missing);
 *   console.log("Mismatched:", summary.results.filter(r => r.status === "mismatched"));
 * }
 * ```
 */
export async function verifyMemoryIndexing(
  memories: MemoryToVerify[],
  project?: string,
): Promise<VerificationSummary> {
  const searchService = new SearchService(project);
  const results: MemoryVerificationResult[] = [];

  logger.info({ count: memories.length, project }, "Starting memory indexing verification");

  for (const memory of memories) {
    const result = await verifySingleMemory(memory, searchService, project);
    results.push(result);
  }

  const found = results.filter((r) => r.status === "found").length;
  const missing = results.filter((r) => r.status === "missing").length;
  const mismatched = results.filter((r) => r.status === "mismatched").length;

  const summary: VerificationSummary = {
    total: memories.length,
    found,
    missing,
    mismatched,
    success: found === memories.length,
    results,
    verifiedAt: new Date(),
  };

  logger.info(
    {
      total: summary.total,
      found: summary.found,
      missing: summary.missing,
      mismatched: summary.mismatched,
      success: summary.success,
    },
    "Memory indexing verification complete",
  );

  return summary;
}

/**
 * Verify a single memory note.
 *
 * @param memory - Memory to verify
 * @param searchService - SearchService instance
 * @param project - Optional project context
 * @returns Verification result for the memory
 */
async function verifySingleMemory(
  memory: MemoryToVerify,
  searchService: SearchService,
  project?: string,
): Promise<MemoryVerificationResult> {
  const expectedPrefix = memory.content.slice(0, CONTENT_PREFIX_LENGTH).trim();

  try {
    // Search by title
    const searchResponse = await searchService.search(memory.title, {
      limit: SEARCH_LIMIT,
      threshold: SEARCH_THRESHOLD,
      mode: "auto",
      project,
    });

    // Look for exact permalink match in results
    const exactMatch = searchResponse.results.find(
      (r) => normalizePermalink(r.permalink) === normalizePermalink(memory.permalink),
    );

    if (exactMatch) {
      // Found by permalink, verify content
      const actualContent = await fetchMemoryContent(memory.permalink, project);
      const actualPrefix = actualContent?.slice(0, CONTENT_PREFIX_LENGTH).trim() ?? "";

      const contentMatches = normalizeContent(actualPrefix) === normalizeContent(expectedPrefix);

      if (contentMatches) {
        return {
          title: memory.title,
          permalink: memory.permalink,
          status: "found",
          expectedPrefix,
          actualPrefix,
          similarityScore: exactMatch.similarity_score,
        };
      } else {
        return {
          title: memory.title,
          permalink: memory.permalink,
          status: "mismatched",
          expectedPrefix,
          actualPrefix,
          similarityScore: exactMatch.similarity_score,
          error: "Content prefix does not match",
        };
      }
    }

    // Check if any result has similar title
    const titleMatch = searchResponse.results.find(
      (r) => normalizeTitle(r.title) === normalizeTitle(memory.title),
    );

    if (titleMatch) {
      // Found by title but different permalink
      const actualContent = await fetchMemoryContent(titleMatch.permalink, project);
      const actualPrefix = actualContent?.slice(0, CONTENT_PREFIX_LENGTH).trim() ?? "";

      return {
        title: memory.title,
        permalink: memory.permalink,
        status: "mismatched",
        expectedPrefix,
        actualPrefix,
        similarityScore: titleMatch.similarity_score,
        error: `Found at different permalink: ${titleMatch.permalink}`,
      };
    }

    // Not found
    return {
      title: memory.title,
      permalink: memory.permalink,
      status: "missing",
      expectedPrefix,
      error: "Memory not found in search results",
    };
  } catch (error) {
    logger.debug(
      { error, title: memory.title, permalink: memory.permalink },
      "Error verifying memory",
    );

    return {
      title: memory.title,
      permalink: memory.permalink,
      status: "missing",
      expectedPrefix,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Fetch the full content of a memory note.
 *
 * @param permalink - Permalink of the note to read
 * @param project - Optional project context
 * @returns Content string or null if not found
 */
async function fetchMemoryContent(permalink: string, project?: string): Promise<string | null> {
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
      const textContent = result.content.find((c: { type: string }) => c.type === "text");
      if (textContent && "text" in textContent) {
        return textContent.text as string;
      }
    }

    return null;
  } catch (error) {
    logger.debug({ error, permalink }, "Failed to fetch memory content");
    return null;
  }
}

/**
 * Normalize permalink for comparison.
 * Removes leading/trailing slashes and normalizes case.
 */
function normalizePermalink(permalink: string): string {
  return permalink.toLowerCase().replace(/^\/+|\/+$/g, "");
}

/**
 * Normalize title for comparison.
 * Removes extra whitespace and normalizes case.
 */
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Normalize content for comparison.
 * Removes extra whitespace and normalizes line endings.
 */
function normalizeContent(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Quick check if a single memory is indexed.
 *
 * Useful for verifying individual memories after migration.
 *
 * @param title - Title to search for
 * @param expectedPermalink - Expected permalink
 * @param project - Optional project context
 * @returns True if found at expected permalink
 */
export async function isMemoryIndexed(
  title: string,
  expectedPermalink: string,
  project?: string,
): Promise<boolean> {
  const searchService = new SearchService(project);

  try {
    const response = await searchService.search(title, {
      limit: SEARCH_LIMIT,
      threshold: SEARCH_THRESHOLD,
      mode: "auto",
      project,
    });

    return response.results.some(
      (r) => normalizePermalink(r.permalink) === normalizePermalink(expectedPermalink),
    );
  } catch {
    return false;
  }
}

/**
 * Get list of missing or mismatched memories from verification results.
 *
 * @param summary - Verification summary
 * @returns Array of problem memories with details
 */
export function getProblematicMemories(summary: VerificationSummary): MemoryVerificationResult[] {
  return summary.results.filter((r) => r.status === "missing" || r.status === "mismatched");
}
