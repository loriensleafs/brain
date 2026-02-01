/**
 * Consolidate mode for organizer tool
 *
 * Identifies merge and split candidates in a Brain project:
 * - Merge candidates: Small related notes on same topic
 * - Split candidates: Large notes covering multiple topics
 *
 * Uses heuristic similarity detection (title similarity, folder proximity,
 * wikilink references). LLM-based semantic similarity can be added later.
 */

import { getBasicMemoryClient } from "../../../proxy/client";
import type {
	ConsolidateConfig,
	ConsolidateResult,
	MergeCandidate,
	SplitCandidate,
} from "../types";
import { extractTitle } from "../utils/markdown";
import { levenshteinDistance } from "../utils/similarity";
import { extractWikilinks } from "../utils/wikilinks";

/**
 * Note metadata extracted from Brain notes
 */
interface NoteInfo {
	permalink: string;
	title: string;
	content: string;
	lineCount: number;
	folder: string;
	wikilinks: string[];
	sections: string[];
}

/**
 * Find consolidation candidates in a project
 */
export async function findConsolidationCandidates(
	config: ConsolidateConfig,
): Promise<ConsolidateResult> {
	const {
		project,
		similarityThreshold = 0.85,
		minNoteSize = 10,
		maxNoteSize = 200,
	} = config;

	const client = await getBasicMemoryClient();

	// Get all notes in project
	const listResult = await client.callTool({
		name: "list_directory",
		arguments: { project, depth: 10, file_name_glob: "*.md" },
	});

	const noteFiles = parseListDirectoryResult(listResult);
	const notes: NoteInfo[] = [];

	// Read all notes to extract metadata
	for (const permalink of noteFiles) {
		try {
			const readResult = await client.callTool({
				name: "read_note",
				arguments: { identifier: permalink, project },
			});

			const noteInfo = parseNoteContent(permalink, readResult);
			notes.push(noteInfo);
		} catch (_error) {}
	}

	// Find merge candidates (small similar notes)
	const mergeCandidates = findMergeCandidates(
		notes,
		similarityThreshold,
		minNoteSize,
	);

	// Find split candidates (large multi-topic notes)
	const splitCandidates = findSplitCandidates(notes, maxNoteSize);

	return {
		mergeCandidates,
		splitCandidates,
	};
}

/**
 * Identify merge candidates using heuristic similarity
 */
function findMergeCandidates(
	notes: NoteInfo[],
	similarityThreshold: number,
	minNoteSize: number,
): MergeCandidate[] {
	const candidates: MergeCandidate[] = [];

	// Filter to small notes only
	const smallNotes = notes.filter((n) => n.lineCount < minNoteSize);

	// Group by folder proximity
	const folderGroups = new Map<string, NoteInfo[]>();
	for (const note of smallNotes) {
		if (!folderGroups.has(note.folder)) {
			folderGroups.set(note.folder, []);
		}
		folderGroups.get(note.folder)?.push(note);
	}

	// Find similar notes within each folder
	for (const [folder, groupNotes] of folderGroups) {
		if (groupNotes.length < 2) continue;

		// Check for cross-references
		const referenceGroups = findReferenceGroups(groupNotes);
		for (const group of referenceGroups) {
			if (group.length < 2) continue;

			const similarity = calculateSimilarity(group);
			if (similarity >= similarityThreshold) {
				candidates.push({
					notes: group.map((n) => n.permalink),
					similarity,
					suggestedTitle: generateMergedTitle(group),
					rationale: `${group.length} small notes in "${folder}" with cross-references and title similarity ${similarity.toFixed(2)}`,
				});
			}
		}

		// Check for title similarity
		for (let i = 0; i < groupNotes.length; i++) {
			for (let j = i + 1; j < groupNotes.length; j++) {
				const similarity = calculateTitleSimilarity(
					groupNotes[i],
					groupNotes[j],
				);
				if (similarity >= similarityThreshold) {
					// Check if already in a candidate
					const alreadyGrouped = candidates.some((c) =>
						c.notes.includes(groupNotes[i].permalink),
					);
					if (!alreadyGrouped) {
						candidates.push({
							notes: [groupNotes[i].permalink, groupNotes[j].permalink],
							similarity,
							suggestedTitle: generateMergedTitle([
								groupNotes[i],
								groupNotes[j],
							]),
							rationale: `Similar titles in "${folder}" (similarity: ${similarity.toFixed(2)})`,
						});
					}
				}
			}
		}
	}

	return candidates;
}

/**
 * Identify split candidates (large multi-topic notes)
 */
function findSplitCandidates(
	notes: NoteInfo[],
	maxNoteSize: number,
): SplitCandidate[] {
	const candidates: SplitCandidate[] = [];

	for (const note of notes) {
		if (note.lineCount <= maxNoteSize) continue;

		// Check if note has multiple distinct sections
		if (note.sections.length > 3) {
			candidates.push({
				note: note.permalink,
				suggestedTopics: note.sections,
				rationale: `Large note (${note.lineCount} lines) with ${note.sections.length} distinct sections`,
			});
		}
	}

	return candidates;
}

/**
 * Find groups of notes that reference each other
 */
function findReferenceGroups(notes: NoteInfo[]): NoteInfo[][] {
	const groups: NoteInfo[][] = [];
	const visited = new Set<string>();

	for (const note of notes) {
		if (visited.has(note.permalink)) continue;

		const group: NoteInfo[] = [note];
		visited.add(note.permalink);

		// Find notes that this note references or that reference this note
		for (const other of notes) {
			if (visited.has(other.permalink)) continue;

			const hasReference =
				note.wikilinks.some((link) => other.permalink.includes(link)) ||
				other.wikilinks.some((link) => note.permalink.includes(link));

			if (hasReference) {
				group.push(other);
				visited.add(other.permalink);
			}
		}

		if (group.length > 1) {
			groups.push(group);
		}
	}

	return groups;
}

/**
 * Calculate similarity score for a group of notes
 */
function calculateSimilarity(notes: NoteInfo[]): number {
	if (notes.length < 2) return 0;

	let totalSimilarity = 0;
	let comparisons = 0;

	for (let i = 0; i < notes.length; i++) {
		for (let j = i + 1; j < notes.length; j++) {
			totalSimilarity += calculateTitleSimilarity(notes[i], notes[j]);
			comparisons++;
		}
	}

	return comparisons > 0 ? totalSimilarity / comparisons : 0;
}

/**
 * Calculate title similarity using Levenshtein distance
 */
function calculateTitleSimilarity(note1: NoteInfo, note2: NoteInfo): number {
	const title1 = note1.title.toLowerCase();
	const title2 = note2.title.toLowerCase();

	const distance = levenshteinDistance(title1, title2);
	const maxLength = Math.max(title1.length, title2.length);

	return maxLength > 0 ? 1 - distance / maxLength : 0;
}

/**
 * Generate a merged title from multiple notes
 */
function generateMergedTitle(notes: NoteInfo[]): string {
	if (notes.length === 0) return "Merged Note";
	if (notes.length === 1) return notes[0].title;

	// Find common prefix or use first note's title
	const titles = notes.map((n) => n.title);
	const commonPrefix = findCommonPrefix(titles);

	if (commonPrefix.length > 5) {
		return commonPrefix.trim();
	}

	return titles[0];
}

/**
 * Find common prefix across multiple strings
 */
function findCommonPrefix(strings: string[]): string {
	if (strings.length === 0) return "";
	if (strings.length === 1) return strings[0];

	let prefix = strings[0];
	for (let i = 1; i < strings.length; i++) {
		while (strings[i].indexOf(prefix) !== 0) {
			prefix = prefix.substring(0, prefix.length - 1);
			if (prefix.length === 0) return "";
		}
	}

	return prefix;
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
 * Parse note content to extract metadata
 */
function parseNoteContent(permalink: string, result: any): NoteInfo {
	const text = result.content?.[0]?.text || "";
	const lines = text.split("\n");

	// Extract title from first heading or frontmatter
	const title = extractTitle(text) || permalink;

	// Extract folder from permalink
	const folder = permalink.includes("/")
		? permalink.substring(0, permalink.lastIndexOf("/"))
		: "";

	// Extract wikilinks
	const wikilinks = extractWikilinks(text);

	// Extract section headings
	const sections = extractSections(text);

	return {
		permalink,
		title,
		content: text,
		lineCount: lines.length,
		folder,
		wikilinks,
		sections,
	};
}

/**
 * Extract section headings from note content
 */
function extractSections(content: string): string[] {
	const sections: string[] = [];
	const lines = content.split("\n");

	for (const line of lines) {
		const match = line.match(/^##\s+(.+)$/);
		if (match) {
			sections.push(match[1].trim());
		}
	}

	return sections;
}
