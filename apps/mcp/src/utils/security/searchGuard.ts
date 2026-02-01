/**
 * Search-Before-Write Middleware
 *
 * Prevents duplicate notes by checking if a note with the same title
 * already exists before allowing write_note to proceed.
 *
 * Modes:
 * - warn: Log a warning but allow the write (default)
 * - enforce: Throw an error, forcing use of edit_note
 */

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { config } from "../../config";
import { logger } from "../internal/logger";

export interface SearchGuardResult {
  allowed: boolean;
  existingMatches?: string[];
  warning?: string;
}

interface SearchResult {
  title: string;
  permalink: string;
}

interface SearchResponse {
  results?: SearchResult[];
}

interface ToolResultContent {
  type: string;
  text?: string;
}

interface ToolResult {
  content?: ToolResultContent[];
}

/**
 * Check if a write_note call would create a duplicate.
 *
 * @param client - The basic-memory MCP client
 * @param args - The arguments being passed to write_note
 * @returns SearchGuardResult indicating if the write should proceed
 */
export async function checkForDuplicates(
  client: Client,
  args: Record<string, unknown>,
): Promise<SearchGuardResult> {
  // Only check write_note calls
  const title = args.title as string;
  if (!title) {
    return { allowed: true };
  }

  try {
    // Search for existing notes with matching title
    const result = (await client.callTool({
      name: "search_notes",
      arguments: {
        query: title,
        search_type: "title",
        project: args.project,
        page_size: 5,
      },
    })) as ToolResult;

    // Parse the search results
    const textContent = result.content?.find((c) => c.type === "text")?.text;
    if (!textContent) {
      return { allowed: true };
    }

    let searchData: SearchResponse;
    try {
      searchData = JSON.parse(textContent);
    } catch {
      // If we can't parse, allow the write
      return { allowed: true };
    }

    if (!searchData.results || searchData.results.length === 0) {
      return { allowed: true };
    }

    // Check for exact or close title matches
    const matches = searchData.results.filter((r) => {
      const normalizedExisting = r.title.toLowerCase().trim();
      const normalizedNew = title.toLowerCase().trim();
      return (
        normalizedExisting === normalizedNew ||
        normalizedExisting.includes(normalizedNew) ||
        normalizedNew.includes(normalizedExisting)
      );
    });

    if (matches.length === 0) {
      return { allowed: true };
    }

    const matchTitles = matches.map((m) => m.title);
    const warning = `Potential duplicate: "${title}" matches existing notes: ${matchTitles.join(
      ", ",
    )}. Consider using edit_note instead.`;

    logger.warn(
      {
        newTitle: title,
        matches: matchTitles,
        project: args.project,
      },
      "Search guard: potential duplicate detected",
    );

    // In enforce mode, block the write
    if (config.searchGuardEnforce) {
      return {
        allowed: false,
        existingMatches: matchTitles,
        warning,
      };
    }

    // In warn mode, allow but return warning
    return {
      allowed: true,
      existingMatches: matchTitles,
      warning,
    };
  } catch (error) {
    // If search fails, log and allow the write
    logger.error(
      { error, title },
      "Search guard: search failed, allowing write",
    );
    return { allowed: true };
  }
}

/**
 * Format the guard result into an error message for the client
 */
export function formatGuardError(result: SearchGuardResult): string {
  const matches = result.existingMatches?.join(", ") || "unknown";
  return (
    `Duplicate note blocked by search guard.\n\n` +
    `Existing notes with similar titles: ${matches}\n\n` +
    `To update an existing note, use edit_note instead:\n` +
    `  edit_note(identifier="<permalink>", operation="append", content="...")\n\n` +
    `To disable this check, set BRAIN_SEARCH_GUARD=off`
  );
}
