/**
 * Shared wikilink extraction utilities for organizer
 *
 * Provides consistent wikilink parsing across all organizer components
 * with support for alias format [[Target|Display]].
 */

/**
 * Extract wikilinks from markdown content
 *
 * Supports both simple [[Target]] and aliased [[Target|Display]] formats.
 * Returns the target (page reference), not the display text.
 *
 * @param content - Markdown content to parse
 * @returns Array of wikilink targets (deduplicated)
 *
 * @example
 * extractWikilinks("See [[Page]] and [[Other|Display]]")
 * // Returns: ["Page", "Other"]
 */
export function extractWikilinks(content: string): string[] {
	const links: string[] = [];

	// Pattern: [[Target]] or [[Target|Display]]
	// Captures only the target (before optional |)
	const pattern = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
	let match;

	while ((match = pattern.exec(content)) !== null) {
		const target = match[1].trim();
		if (target) {
			links.push(target);
		}
	}

	// Deduplicate
	return Array.from(new Set(links));
}
