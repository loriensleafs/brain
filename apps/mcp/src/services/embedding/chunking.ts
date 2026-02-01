/**
 * Text chunking service for embeddings.
 *
 * Splits large documents into overlapping chunks suitable for embedding.
 * Uses ~500 tokens per chunk (~2000 characters) with 10-20% overlap.
 */

import { split } from "llm-splitter";

/** Target chunk size in characters (~500 tokens at 4 chars/token average) */
const CHUNK_SIZE_CHARS = 2000;

/** Overlap percentage between chunks (15% = middle of 10-20% range) */
const OVERLAP_PERCENT = 0.15;

/** Minimum content length to require chunking */
const MIN_CHUNK_THRESHOLD = CHUNK_SIZE_CHARS;

/**
 * Metadata for a text chunk.
 */
export interface ChunkMetadata {
	/** The chunk text content */
	text: string;
	/** Start character index in original document */
	start: number;
	/** End character index in original document */
	end: number;
	/** Zero-based chunk index */
	chunkIndex: number;
	/** Total number of chunks for this document */
	totalChunks: number;
}

/**
 * Split text into overlapping chunks suitable for embedding.
 *
 * @param text - Full document text to chunk
 * @returns Array of chunk metadata. Returns single chunk if text is below threshold.
 */
export function chunkText(text: string): ChunkMetadata[] {
	if (!text || text.trim().length === 0) {
		return [];
	}

	// Small documents: return as single chunk, no splitting needed
	if (text.length <= MIN_CHUNK_THRESHOLD) {
		return [
			{
				text,
				start: 0,
				end: text.length,
				chunkIndex: 0,
				totalChunks: 1,
			},
		];
	}

	// Calculate overlap in characters
	const chunkOverlap = Math.floor(CHUNK_SIZE_CHARS * OVERLAP_PERCENT);

	// Use character-based splitting with word boundaries
	const chunks = split(text, {
		chunkSize: CHUNK_SIZE_CHARS,
		chunkOverlap,
		// Split on whitespace to preserve word boundaries
		splitter: (input: string) => input.split(/\s+/),
		chunkStrategy: "paragraph",
	});

	// Filter out empty/null chunks and map to our format
	const validChunks = chunks.filter(
		(chunk) => chunk.text !== null && chunk.text !== "",
	);

	const totalChunks = validChunks.length;

	return validChunks.map((chunk, index) => {
		// Handle both string and string[] return types from llm-splitter
		const chunkText = Array.isArray(chunk.text)
			? chunk.text.join(" ")
			: (chunk.text as string);

		return {
			text: chunkText,
			start: chunk.start,
			end: chunk.end,
			chunkIndex: index,
			totalChunks,
		};
	});
}

/**
 * Check if text requires chunking based on length.
 *
 * @param text - Text to check
 * @returns True if text exceeds chunk threshold
 */
export function requiresChunking(text: string): boolean {
	return text.length > MIN_CHUNK_THRESHOLD;
}

/**
 * Get chunk configuration for informational purposes.
 */
export function getChunkConfig() {
	return {
		chunkSizeChars: CHUNK_SIZE_CHARS,
		overlapPercent: OVERLAP_PERCENT,
		minChunkThreshold: MIN_CHUNK_THRESHOLD,
	};
}
