/**
 * Batch embedding generation tool
 *
 * Generates embeddings for all notes that don't have one yet.
 * Uses text chunking for long documents to stay within model token limits.
 */
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import pLimit from "p-limit";
import { ollamaConfig } from "../../config/ollama";
import { createVectorConnection } from "../../db/connection";
import { ensureEmbeddingTables } from "../../db/schema";
import {
	type ChunkEmbeddingInput,
	storeChunkedEmbeddings,
} from "../../db/vectors";
import { resolveProject } from "../../project/resolve";
import { getBasicMemoryClient } from "../../proxy/client";
import {
	type ChunkMetadata,
	chunkText,
} from "../../services/embedding/chunking";
import { generateEmbedding } from "../../services/embedding/generateEmbedding";
import { OllamaClient } from "../../services/ollama/client";
import { logger } from "../../utils/internal/logger";

/** Maximum concurrent note operations (matches Ollama OLLAMA_NUM_PARALLEL default) */
const CONCURRENCY_LIMIT = 4;

/** Maximum chunks per batch request to prevent memory exhaustion */
const MAX_CHUNKS_PER_BATCH = 32;

/** Warn when batch size exceeds this threshold */
const LARGE_BATCH_WARNING_THRESHOLD = 500;

export const toolDefinition: Tool = {
	name: "generate_embeddings",
	description: `Generate embeddings for notes that don't have them yet.

Uses Ollama with nomic-embed-text model to generate 768-dimension embeddings.
Long documents are automatically chunked (~2000 chars per chunk with 15% overlap).
Stores embeddings in brain_embeddings table for semantic search.

Parameters:
- project: Optional project name (auto-resolved if not specified)
- force: If true, regenerate all embeddings (default: false, only missing)
- limit: Maximum notes to process (default: 100, use 0 for all)

Returns progress and counts of processed/failed notes.`,
	inputSchema: {
		type: "object" as const,
		properties: {
			project: {
				type: "string",
				description: "Project name (auto-resolved if not specified)",
			},
			force: {
				type: "boolean",
				description:
					"Regenerate all embeddings, not just missing (default: false)",
			},
			limit: {
				type: "number",
				description: "Max notes to process (default: 100, 0 for all)",
			},
		},
		required: [],
	},
};

/**
 * Generate embeddings for all chunks of a note using batch API.
 * Splits large notes into multiple batch requests if needed.
 *
 * @param chunks - Array of text chunks
 * @param ollamaClient - OllamaClient instance for batch API calls
 * @returns Array of chunk inputs with embeddings, or null if any batch fails
 */
async function generateChunkEmbeddings(
	chunks: ChunkMetadata[],
	ollamaClient: OllamaClient,
): Promise<ChunkEmbeddingInput[] | null> {
	if (chunks.length === 0) {
		return [];
	}

	try {
		const results: ChunkEmbeddingInput[] = [];

		// Split large notes into multiple batch requests
		for (let i = 0; i < chunks.length; i += MAX_CHUNKS_PER_BATCH) {
			const chunkBatch = chunks.slice(i, i + MAX_CHUNKS_PER_BATCH);
			const texts = chunkBatch.map((c) => c.text);

			// Call batch API
			const embeddings = await ollamaClient.generateBatchEmbeddings(
				texts,
				"search_document",
			);

			// Map embeddings back to chunk metadata
			for (let j = 0; j < chunkBatch.length; j++) {
				results.push({
					chunkIndex: chunkBatch[j].chunkIndex,
					totalChunks: chunkBatch[j].totalChunks,
					chunkStart: chunkBatch[j].start,
					chunkEnd: chunkBatch[j].end,
					chunkText: chunkBatch[j].text,
					embedding: embeddings[j],
				});
			}
		}

		return results;
	} catch (error) {
		logger.warn(
			{ error: error instanceof Error ? error.message : String(error) },
			"Batch embedding generation failed",
		);
		return null;
	}
}

export async function handler(
	args: Record<string, unknown>,
): Promise<CallToolResult> {
	const force = (args.force as boolean) ?? false;
	const limit = (args.limit as number) ?? 100;
	const project =
		args.project !== undefined
			? (args.project as string)
			: resolveProject(undefined);

	if (!project) {
		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(
						{
							error:
								"No project specified and none could be auto-resolved. Use --project flag or set BM_PROJECT env var.",
						},
						null,
						2,
					),
				},
			],
			isError: true,
		};
	}

	logger.info({ project, force, limit }, "Starting batch embedding generation");

	try {
		// Health check: verify Ollama is available before starting batch
		const ollamaClient = new OllamaClient(ollamaConfig);
		const isHealthy = await ollamaClient.healthCheck();
		if (!isHealthy) {
			logger.error("Ollama health check failed - server not available");
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								error:
									"Ollama is not available. Ensure Ollama is running (ollama serve) and the model is loaded.",
							},
							null,
							2,
						),
					},
				],
				isError: true,
			};
		}

		// Warmup: generate a test embedding to ensure model is loaded
		logger.debug("Warming up Ollama with test embedding");
		try {
			await generateEmbedding("warmup");
			logger.debug("Ollama warmup successful");
		} catch (warmupError) {
			logger.warn(
				{
					error:
						warmupError instanceof Error
							? warmupError.message
							: String(warmupError),
				},
				"Ollama warmup failed, continuing anyway",
			);
		}

		logger.info(
			{ project, force, limit, projectType: typeof project },
			"Project resolved, starting",
		);

		const client = await getBasicMemoryClient();
		logger.debug("basic-memory client acquired");

		const db = createVectorConnection();
		logger.debug("vector database connection created");

		// Ensure v2 table exists
		ensureEmbeddingTables(db);
		logger.debug("embedding tables ensured");

		// Get existing embeddings if not forcing regeneration
		// Check v2 table for existing entity_ids
		const existingIds = new Set<string>();
		if (!force) {
			try {
				const existing = db
					.query("SELECT DISTINCT entity_id FROM brain_embeddings")
					.all() as Array<{ entity_id: string }>;
				existing.forEach((e) => existingIds.add(e.entity_id));
				logger.info(
					{ count: existingIds.size },
					"Found existing embeddings in v2 table",
				);
			} catch {
				// Table might be empty or have issues, continue
				logger.debug("No existing v2 embeddings found");
			}
		}

		// List all notes from project
		logger.info(
			{ project, callName: "list_directory" },
			"Calling list_directory",
		);
		const listResult = await client.callTool({
			name: "list_directory",
			arguments: { project, depth: 10 },
		});
		logger.info(
			{ hasContent: !!listResult.content },
			"list_directory returned",
		);

		// Parse the response to get note permalinks
		let notes: string[] = [];
		if (listResult.content && Array.isArray(listResult.content)) {
			const textContent = listResult.content.find(
				(c: { type: string }) => c.type === "text",
			);
			if (textContent && "text" in textContent) {
				const text = textContent.text as string;
				const lines = text.split("\n").filter((l) => l.trim());

				for (const line of lines) {
					if (!line.includes("\u{1F4C4}")) {
						continue;
					}

					const parts = line.split("|");
					if (parts.length > 0) {
						const pathPart = parts[0].trim();
						const match = pathPart.match(/\s(\S+\.md)\s*$/);
						if (match) {
							const permalink = match[1].replace(/\.md$/, "");
							if (permalink) {
								notes.push(permalink);
							}
						}
					}
				}

				notes = [...new Set(notes)];
			}
		}

		logger.info({ notesCount: notes.length }, "list_directory succeeded");
		logger.info({ totalNotes: notes.length }, "Found notes to process");

		// Filter out notes that already have embeddings
		const toProcess = force ? notes : notes.filter((n) => !existingIds.has(n));

		// Apply limit
		const batch = limit > 0 ? toProcess.slice(0, limit) : toProcess;

		logger.info(
			{ toProcess: batch.length, skipped: notes.length - batch.length },
			"Processing notes",
		);

		// Warn about large batch operations
		if (limit === 0 || batch.length > LARGE_BATCH_WARNING_THRESHOLD) {
			logger.warn(
				{ batchSize: batch.length, threshold: LARGE_BATCH_WARNING_THRESHOLD },
				"Large batch operation: may take a long time. Consider using smaller batches (limit <= 500)",
			);
		}

		// Process notes concurrently with p-limit
		logger.info(
			{ concurrency: CONCURRENCY_LIMIT, totalNotes: batch.length },
			"Starting concurrent note processing",
		);

		const concurrencyLimit = pLimit(CONCURRENCY_LIMIT);
		const errors: string[] = [];

		// Process each note concurrently
		const results = await Promise.allSettled(
			batch.map((notePath) =>
				concurrencyLimit(async () => {
					try {
						// Read the note content
						logger.debug({ permalink: notePath }, "Calling read_note");
						const readResult = await client.callTool({
							name: "read_note",
							arguments: { identifier: notePath, project },
						});

						let content = "";
						if (readResult.content && Array.isArray(readResult.content)) {
							const textContent = readResult.content.find(
								(c: { type: string }) => c.type === "text",
							);
							if (textContent && "text" in textContent) {
								content = textContent.text as string;
							}
						}

						if (!content) {
							logger.debug({ notePath }, "No content found, skipping");
							return { success: false, chunks: 0 };
						}

						// Chunk the content
						const chunks = chunkText(content);
						logger.debug(
							{
								permalink: notePath,
								contentLength: content.length,
								chunkCount: chunks.length,
							},
							"Content chunked",
						);

						// Generate embeddings for all chunks using batch API
						const chunkEmbeddings = await generateChunkEmbeddings(
							chunks,
							ollamaClient,
						);

						if (!chunkEmbeddings) {
							logger.warn(
								{ notePath },
								"Failed to generate embeddings for one or more chunks",
							);
							errors.push(`${notePath}: embedding generation failed`);
							return { success: false, chunks: 0 };
						}

						// Store all chunk embeddings
						logger.debug(
							{ permalink: notePath, chunkCount: chunkEmbeddings.length },
							"Storing chunk embeddings",
						);
						const stored = storeChunkedEmbeddings(
							db,
							notePath,
							chunkEmbeddings,
						);
						logger.debug(
							{ permalink: notePath, storedCount: stored },
							"Chunk embeddings stored",
						);

						return { success: true, chunks: stored };
					} catch (error) {
						const msg = error instanceof Error ? error.message : String(error);
						errors.push(`${notePath}: ${msg}`);
						logger.warn({ notePath, error: msg }, "Failed to process note");
						return { success: false, chunks: 0 };
					}
				}),
			),
		);

		// Aggregate results
		let processed = 0;
		let failed = 0;
		let totalChunksGenerated = 0;

		for (const result of results) {
			if (result.status === "fulfilled" && result.value.success) {
				processed++;
				totalChunksGenerated += result.value.chunks;
			} else {
				failed++;
			}
		}

		logger.info(
			{ processed, failed, totalChunks: totalChunksGenerated },
			"Concurrent processing complete",
		);

		db.close();

		const result = {
			success: true,
			processed,
			failed,
			skipped: notes.length - batch.length,
			total: notes.length,
			totalChunksGenerated,
			errors: errors.slice(0, 10),
		};

		logger.info(result, "Batch embedding complete");

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(result, null, 2),
				},
			],
		};
	} catch (error) {
		logger.error({ error }, "Batch embedding failed");
		return {
			content: [
				{
					type: "text" as const,
					text: `Error: ${error instanceof Error ? error.message : String(error)}`,
				},
			],
			isError: true,
		};
	}
}
