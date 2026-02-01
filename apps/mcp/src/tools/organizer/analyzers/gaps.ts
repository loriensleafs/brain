/**
 * Gap reference analyzer for maintain mode
 *
 * Identifies wikilink references to notes that don't exist in the knowledge graph.
 * Gap references indicate missing knowledge or broken links.
 */

import { getBasicMemoryClient } from "../../../proxy/client";
import type { QualityIssue } from "../types";
import { extractTitle } from "../utils/markdown";
import { extractWikilinks } from "../utils/wikilinks";

/**
 * Find referenced notes that don't exist
 */
export async function findGapReferences(
	project: string,
): Promise<QualityIssue[]> {
	const client = await getBasicMemoryClient();
	const issues: QualityIssue[] = [];

	// Get all notes in project
	const listResult = await client.callTool({
		name: "list_directory",
		arguments: { project, depth: 10, file_name_glob: "*.md" },
	});

	const noteFiles = parseListDirectoryResult(listResult);
	const existingNotes = new Set(noteFiles);
	const titleToPath = new Map<string, string>();

	// Build title-to-path mapping
	for (const permalink of noteFiles) {
		try {
			const readResult = await client.callTool({
				name: "read_note",
				arguments: { identifier: permalink, project },
			});

			const noteContent = (readResult.content as any)?.[0]?.text || "";
			const title = extractTitle(noteContent);

			if (title) {
				titleToPath.set(title.toLowerCase(), permalink);
			}
		} catch (_error) {}
	}

	// Track references and their source notes
	const referenceMap = new Map<string, string[]>();

	// Scan each note for wikilinks
	for (const permalink of noteFiles) {
		try {
			const readResult = await client.callTool({
				name: "read_note",
				arguments: { identifier: permalink, project },
			});

			const noteContent = (readResult.content as any)?.[0]?.text || "";
			const wikilinks = extractWikilinks(noteContent);

			for (const link of wikilinks) {
				// Check if referenced note exists
				const exists = checkNoteExists(link, existingNotes, titleToPath);

				if (!exists) {
					if (!referenceMap.has(link)) {
						referenceMap.set(link, []);
					}
					referenceMap.get(link)?.push(permalink);
				}
			}
		} catch (_error) {}
	}

	// Create issues for missing references
	for (const [reference, sourceNotes] of referenceMap) {
		issues.push({
			type: "GAP",
			reference,
			note: sourceNotes[0], // Primary source
			recommendation: `Create note "${reference}" (referenced by ${sourceNotes.length} note${sourceNotes.length > 1 ? "s" : ""}: ${sourceNotes.join(", ")})`,
		});
	}

	return issues;
}

/**
 * Parse list_directory output to extract file paths
 */
function parseListDirectoryResult(result: any): string[] {
	const text = result.content?.[0]?.text || "";
	const files: string[] = [];
	const lines = text.split("\n");

	for (const line of lines) {
		if (line.includes(".md") && !line.includes("Directory:")) {
			const match = line.match(/([^\s]+\.md)/);
			if (match) files.push(match[1]);
		}
	}

	return files;
}

/**
 * Check if a note exists in the set of known notes
 */
function checkNoteExists(
	reference: string,
	existingNotes: Set<string>,
	titleToPath: Map<string, string>,
): boolean {
	// Check if reference matches a note title (case-insensitive)
	if (titleToPath.has(reference.toLowerCase())) {
		return true;
	}

	// Direct match
	if (existingNotes.has(reference)) {
		return true;
	}

	// Try with .md extension
	if (existingNotes.has(`${reference}.md`)) {
		return true;
	}

	// Try matching just the filename part
	for (const note of existingNotes) {
		const noteName = note.replace(/\.md$/, "");
		const noteBasename = noteName.split("/").pop() || "";

		if (noteBasename === reference || noteName === reference) {
			return true;
		}
	}

	return false;
}
