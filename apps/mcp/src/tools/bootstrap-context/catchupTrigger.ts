/**
 * Embedding catch-up trigger for bootstrap_context.
 *
 * Implements P0 catch-up strategy: query for missing embeddings on session start,
 * trigger background batch if any found.
 *
 * Strategic Decision (038-catchup-trigger-verdict.md):
 * - Run on every bootstrap_context call (session start)
 * - Fire-and-forget (non-blocking)
 * - "If there aren't any missing, it's almost instant" (user insight)
 */

import { createVectorConnection } from "../../db/connection";
import { logger } from "../../utils/internal/logger";
import { handler as generateEmbeddings } from "../embed";

/**
 * Query database for notes without embeddings.
 *
 * Query logic:
 * - Get all notes from basic-memory for the project
 * - Get all entity_ids from brain_embeddings
 * - Compare and count missing embeddings
 *
 * @param project - Project name to filter notes
 * @returns Count of notes without embeddings
 */
export async function getMissingEmbeddingsCount(
  project: string,
): Promise<number> {
  if (!project || project.trim().length === 0) {
    throw new Error("Project parameter is required");
  }

  try {
    // Import getBasicMemoryClient dynamically to avoid circular dependency
    const { getBasicMemoryClient } = await import("../../proxy/client");
    const client = await getBasicMemoryClient();

    // List all notes from project
    const listResult = await client.callTool({
      name: "list_directory",
      arguments: { project, depth: 10 },
    });

    // Parse the response to get note permalinks
    const notes: string[] = [];
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
      }
    }

    // Get existing embeddings from vector database
    const db = createVectorConnection();
    const existingIds = new Set<string>();

    try {
      const existing = db
        .query<{ entity_id: string }, []>(
          "SELECT DISTINCT entity_id FROM brain_embeddings",
        )
        .all();
      existing.forEach((e) => existingIds.add(e.entity_id));
    } catch {
      // Table might be empty or have issues, continue
      logger.debug({ project }, "No existing embeddings found");
    }

    db.close();

    // Count notes without embeddings
    const uniqueNotes = [...new Set(notes)];
    const missingCount = uniqueNotes.filter((n) => !existingIds.has(n)).length;

    logger.debug(
      {
        project,
        totalNotes: uniqueNotes.length,
        embeddedNotes: existingIds.size,
        missingCount,
      },
      "Missing embeddings count calculated",
    );

    return missingCount;
  } catch (error) {
    logger.warn(
      {
        project,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to query missing embeddings count",
    );
    return 0; // Return 0 on error to prevent blocking bootstrap_context
  }
}

/**
 * Trigger background embedding catch-up if notes are missing embeddings.
 *
 * Flow:
 * 1. Query for missing embeddings count
 * 2. If count > 0, log trigger event
 * 3. Fire-and-forget batch embedding generation
 * 4. Log completion/error events
 *
 * Non-blocking: Does not await batch completion, returns immediately.
 *
 * @param project - Project name to process
 */
export async function triggerCatchupEmbedding(project: string): Promise<void> {
  const count = await getMissingEmbeddingsCount(project);

  if (count === 0) {
    logger.debug({ project }, "No missing embeddings, skipping catch-up");
    return;
  }

  // Log trigger event (REQ-003a from requirements)
  logger.info(
    { project, missingCount: count },
    "Catch-up embedding trigger activated",
  );

  // Fire-and-forget batch embedding
  // Use limit: 0 to process all missing embeddings
  generateEmbeddings({ project, limit: 0, force: false })
    .then((result) => {
      // Log completion event (REQ-003b)
      const content = result.content?.[0];
      if (content && "text" in content) {
        try {
          const stats = JSON.parse(content.text as string);
          logger.info(
            {
              project,
              processed: stats.processed,
              failed: stats.failed,
              totalChunks: stats.totalChunksGenerated,
            },
            "Catch-up embedding complete",
          );
        } catch {
          logger.info(
            { project },
            "Catch-up embedding complete (unable to parse stats)",
          );
        }
      }
    })
    .catch((error) => {
      // Log error event (REQ-003b)
      logger.error(
        {
          project,
          error: error instanceof Error ? error.message : String(error),
        },
        "Catch-up embedding failed",
      );
    });
}
