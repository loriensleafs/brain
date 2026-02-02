/**
 * Relation following utilities for bootstrap_context tool
 *
 * Extracts [[WikiLinks]] from notes and resolves them to actual notes.
 * Only follows first-level relations to prevent context explosion.
 */

import { getBasicMemoryClient } from "../../proxy/client";
import { detectNoteType } from "./noteType";
import type { ContextNote } from "./sectionQueries";
import { parseStatus } from "./statusParser";

/**
 * WikiLink pattern: [[Title]] or [[Title|Display Text]]
 */
const WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

/**
 * Extract all [[WikiLinks]] from content
 *
 * @param content - Markdown content to extract links from
 * @returns Array of unique link targets (titles/permalinks)
 */
export function extractWikiLinks(content: string): string[] {
  const links: Set<string> = new Set();

  for (const match of content.matchAll(WIKILINK_PATTERN)) {
    const linkTarget = match[1].trim();
    if (linkTarget) {
      links.add(linkTarget);
    }
  }

  return Array.from(links);
}

/**
 * Follow relations from a set of notes and return referenced notes
 *
 * @param notes - Notes to extract relations from
 * @param options - Query options (project)
 * @returns Array of referenced notes (deduplicated)
 */
export async function followRelations(
  notes: ContextNote[],
  options: { project: string },
): Promise<ContextNote[]> {
  const { project } = options;

  // Collect all WikiLinks from all notes
  const allLinks: Set<string> = new Set();
  for (const note of notes) {
    if (note.content) {
      const links = extractWikiLinks(note.content);
      for (const link of links) {
        allLinks.add(link);
      }
    }
  }

  // Remove links that point to notes we already have
  const existingPermalinks = new Set(notes.map((n) => n.permalink));
  const existingTitles = new Set(notes.map((n) => n.title));

  const linksToResolve = Array.from(allLinks).filter(
    (link) => !existingPermalinks.has(link) && !existingTitles.has(link),
  );

  if (linksToResolve.length === 0) {
    return [];
  }

  // Resolve links to actual notes
  const resolvedNotes = await resolveLinks(linksToResolve, project);

  // Deduplicate by permalink
  const seen = new Set<string>();
  return resolvedNotes.filter((note) => {
    if (seen.has(note.permalink)) {
      return false;
    }
    seen.add(note.permalink);
    return true;
  });
}

/**
 * Resolve WikiLink targets to actual notes
 *
 * @param links - Array of link targets to resolve
 * @param project - Project to search in
 * @returns Array of resolved notes (broken links are skipped)
 */
async function resolveLinks(links: string[], project: string): Promise<ContextNote[]> {
  const client = await getBasicMemoryClient();
  const resolved: ContextNote[] = [];

  // Batch resolve links by searching for each
  // Could be optimized with bulk lookup if basic-memory supports it
  for (const link of links) {
    try {
      // Try to read note directly by identifier (title or permalink)
      const result = await client.callTool({
        name: "read_note",
        arguments: {
          project,
          identifier: link,
        },
      });

      const note = parseReadNoteResult(result, link);
      if (note) {
        resolved.push(note);
      }
    } catch {
      // Link couldn't be resolved - skip silently
      // This is expected for broken/invalid links
    }
  }

  return resolved;
}

/**
 * Parse result from read_note tool call
 */
function parseReadNoteResult(result: unknown, originalLink: string): ContextNote | null {
  // Handle various response formats
  const typedResult = result as {
    result?: string;
    content?: Array<{ type: string; text: string }>;
  };

  let content: string | undefined;
  let title = originalLink;
  let permalink = originalLink;

  // Extract content from result
  if (typeof typedResult.result === "string") {
    content = typedResult.result;
  } else if (typedResult.content?.[0]?.text) {
    content = typedResult.content[0].text;
  }

  if (!content) {
    return null;
  }

  // Parse frontmatter for title and permalink
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];

    const titleMatch = frontmatter.match(/^title:\s*['"]?(.+?)['"]?\s*$/m);
    if (titleMatch) {
      title = titleMatch[1];
    }

    const permalinkMatch = frontmatter.match(/^permalink:\s*(.+)\s*$/m);
    if (permalinkMatch) {
      permalink = permalinkMatch[1];
    }
  }

  // Detect type and status
  const folder = permalink.split("/")[0] || "";
  const type = detectNoteType(undefined, folder, title);
  const status = parseStatus(content, title);

  return {
    title,
    permalink,
    type,
    status,
    content,
  };
}

/**
 * Extract relations from a note's ## Relations section
 * (Alternative approach if we want to focus on explicit relations)
 */
export function extractRelationsSection(content: string): string[] {
  // Match ## Relations section
  const sectionMatch = content.match(/^##\s+Relations\s*\n+([\s\S]*?)(?=\n##\s|\n---|\n\n\n|$)/im);

  if (!sectionMatch) {
    return [];
  }

  const sectionContent = sectionMatch[1];
  return extractWikiLinks(sectionContent);
}
