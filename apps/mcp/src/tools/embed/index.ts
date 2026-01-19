/**
 * Batch embedding generation tool
 *
 * Generates embeddings for all notes that don't have one yet.
 */
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { getBasicMemoryClient } from "../../proxy/client";
import { createVectorConnection } from "../../db/connection";
import { generateEmbedding } from "../../services/embedding/generateEmbedding";
import { storeEmbedding } from "../../db/vectors";
import { logger } from "../../utils/internal/logger";
import { resolveProject } from "../../project/resolve";

export const toolDefinition: Tool = {
  name: "generate_embeddings",
  description: `Generate embeddings for notes that don't have them yet.

Uses Ollama with nomic-embed-text model to generate 768-dimension embeddings.
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
        description: "Regenerate all embeddings, not just missing (default: false)",
      },
      limit: {
        type: "number",
        description: "Max notes to process (default: 100, 0 for all)",
      },
    },
    required: [],
  },
};


export async function handler(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const force = (args.force as boolean) ?? false;
  const limit = (args.limit as number) ?? 100;
  const project = (args.project as string) || resolveProject(undefined, process.cwd());

  logger.info({ project, force, limit }, "Starting batch embedding generation");

  try {
    const client = await getBasicMemoryClient();
    const db = createVectorConnection();

    // Get existing embeddings if not forcing regeneration
    const existingIds = new Set<string>();
    if (!force) {
      try {
        const existing = db
          .query("SELECT entity_id FROM brain_embeddings")
          .all() as Array<{ entity_id: string }>;
        existing.forEach((e) => existingIds.add(e.entity_id));
        logger.info({ count: existingIds.size }, "Found existing embeddings");
      } catch {
        // Table might be empty or have issues, continue
      }
    }

    // List all notes from project
    const listResult = await client.callTool({
      name: "list_directory",
      arguments: { project, depth: 10 },
    });

    // Parse the response to get note permalinks
    // Format for files: "📄 filename.md path/to/file.md | Title | Date"
    // Format for folders: "📁 folder-name    /permalink/path"
    // We only want notes (📄), not folders (📁)
    let notes: string[] = [];
    if (listResult.content && Array.isArray(listResult.content)) {
      const textContent = listResult.content.find(
        (c: { type: string }) => c.type === "text"
      );
      if (textContent && "text" in textContent) {
        const text = textContent.text as string;
        const lines = text.split("\n").filter((l) => l.trim());

        // Extract permalinks from lines marked with 📄 (notes only, not folders)
        for (const line of lines) {
          // Only process file entries (📄)
          if (!line.includes("📄")) {
            continue;
          }

          // Format: "📄 filename.md path/to/file.md | Title | Date"
          // Split by | and take the first part, then find the .md path
          const parts = line.split("|");
          if (parts.length > 0) {
            const pathPart = parts[0].trim();
            // Extract the full path ending in .md
            const match = pathPart.match(/\s(\S+\.md)\s*$/);
            if (match) {
              // Remove .md extension to get permalink
              const permalink = match[1].replace(/\.md$/, "");
              if (permalink) {
                notes.push(permalink);
              }
            }
          }
        }

        // Remove duplicates
        notes = [...new Set(notes)];
      }
    }

    logger.info({ totalNotes: notes.length }, "Found notes to process");

    // Filter out notes that already have embeddings
    const toProcess = force
      ? notes
      : notes.filter((n) => !existingIds.has(n));

    // Apply limit
    const batch = limit > 0 ? toProcess.slice(0, limit) : toProcess;

    logger.info(
      { toProcess: batch.length, skipped: notes.length - batch.length },
      "Processing notes"
    );

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const notePath of batch) {
      try {
        // Read the note content
        const readResult = await client.callTool({
          name: "read_note",
          arguments: { identifier: notePath, project },
        });

        let content = "";
        if (readResult.content && Array.isArray(readResult.content)) {
          const textContent = readResult.content.find(
            (c: { type: string }) => c.type === "text"
          );
          if (textContent && "text" in textContent) {
            content = textContent.text as string;
          }
        }

        if (!content) {
          logger.debug({ notePath }, "No content found, skipping");
          continue;
        }

        // Generate embedding
        const embedding = await generateEmbedding(content);
        if (!embedding) {
          logger.warn({ notePath }, "Failed to generate embedding");
          failed++;
          errors.push(`${notePath}: no embedding generated`);
          continue;
        }

        // Store embedding
        storeEmbedding(db, notePath, embedding);
        processed++;

        if (processed % 10 === 0) {
          logger.info({ processed, total: batch.length }, "Progress");
        }
      } catch (error) {
        failed++;
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`${notePath}: ${msg}`);
        logger.warn({ notePath, error: msg }, "Failed to process note");
      }
    }

    db.close();

    const result = {
      success: true,
      processed,
      failed,
      skipped: notes.length - batch.length,
      total: notes.length,
      errors: errors.slice(0, 10), // Limit error messages
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
