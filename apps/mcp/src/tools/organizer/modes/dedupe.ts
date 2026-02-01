/**
 * Dedupe mode for organizer tool
 *
 * Finds and identifies semantic duplicate notes using a 3-step approach:
 * 1. Title similarity - Find candidates with similar titles
 * 2. Content similarity - Refine by comparing note content
 * 3. Confirmation - Filter to high-confidence duplicates
 *
 * MVP implementation uses heuristic similarity without embeddings.
 * Embeddings can be added in future for improved accuracy.
 */

import { getBasicMemoryClient } from "../../../proxy/client";
import {
	calculateContentSimilarity,
	extractKeywords,
	extractObservations,
	extractWikilinks,
	type NoteContent,
} from "../similarity/contentSimilarity";
import {
	findSimilarPairs,
	type NoteMetadata,
} from "../similarity/titleSimilarity";
import type { DedupeConfig, DedupeResult } from "../types";
import { extractTitle } from "../utils/markdown";

/**
 * Find duplicate notes in a project
 */
export async function findDuplicates(
	config: DedupeConfig,
): Promise<DedupeResult> {
	const {
		project,
		embeddingThreshold = 0.85,
		fulltextThreshold = 0.7,
	} = config;

	const client = await getBasicMemoryClient();

	// Get all notes in project
	const listResult = await client.callTool({
		name: "list_directory",
		arguments: { project, depth: 10, file_name_glob: "*.md" },
	});

	const noteFiles = parseListDirectoryResult(listResult);

	// Read all notes and extract metadata
	const noteMetadata: NoteMetadata[] = [];
	const noteContentMap = new Map<string, NoteContent>();

	for (const permalink of noteFiles) {
		try {
			const readResult = await client.callTool({
				name: "read_note",
				arguments: { identifier: permalink, project },
			});

			const content = (readResult.content as any)?.[0]?.text || "";
			const metadata = extractNoteMetadata(permalink, content);
			const noteContent = extractNoteContent(permalink, content);

			noteMetadata.push(metadata);
			noteContentMap.set(permalink, noteContent);
		} catch (_error) {}
	}

	// Step 1: Find candidates using title and metadata similarity
	const candidates = await findSimilarPairs(noteMetadata, embeddingThreshold);

	// Step 2: Refine with content similarity
	const withContentSim = await calculateContentSimilarity(
		candidates,
		noteContentMap,
	);

	// Step 3: Filter to confirmed duplicates
	const confirmed = withContentSim.filter(
		(pair) => pair.fulltextSimilarity >= fulltextThreshold,
	);

	return {
		candidates: withContentSim,
		confirmed,
		summary: {
			totalCandidates: withContentSim.length,
			confirmedDuplicates: confirmed.length,
		},
	};
}

/**
 * Extract note metadata for similarity comparison
 */
function extractNoteMetadata(permalink: string, content: string): NoteMetadata {
	const title = extractTitle(content) || permalink;
	const folder = extractFolder(permalink);
	const wikilinks = extractWikilinks(content);
	const keywords = extractKeywords(content);

	return {
		permalink,
		title,
		folder,
		wikilinks,
		keywords,
	};
}

/**
 * Extract note content for similarity comparison
 */
function extractNoteContent(permalink: string, content: string): NoteContent {
	const observations = extractObservations(content);
	const wikilinks = extractWikilinks(content);
	const keywords = extractKeywords(content);

	return {
		permalink,
		observations,
		wikilinks,
		keywords,
		content,
	};
}

/**
 * Extract folder from permalink
 */
function extractFolder(permalink: string): string {
	return permalink.includes("/")
		? permalink.substring(0, permalink.lastIndexOf("/"))
		: "";
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
