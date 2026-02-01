/**
 * Markdown parsing utilities using gray-matter
 *
 * Provides functions for extracting titles and frontmatter from markdown files.
 */

import matter from "gray-matter";

/**
 * Extract title from markdown content
 *
 * Tries frontmatter title first, then falls back to first H1 heading.
 */
export function extractTitle(content: string): string | null {
  try {
    const parsed = matter(content);

    // Try frontmatter title
    if (parsed.data.title) {
      return String(parsed.data.title).trim();
    }

    // Fall back to first H1 heading
    const h1Match = parsed.content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      return h1Match[1].trim();
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract all frontmatter from markdown content
 */
export function extractFrontmatter(content: string): Record<string, unknown> {
  try {
    const parsed = matter(content);
    return parsed.data;
  } catch (error) {
    return {};
  }
}

/**
 * Check if content has YAML frontmatter
 */
export function hasFrontmatter(content: string): boolean {
  return /^---\n[\s\S]*?\n---/.test(content);
}
