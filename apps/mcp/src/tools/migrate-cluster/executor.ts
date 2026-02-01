/**
 * Migration execution logic for migrate_cluster tool
 *
 * Executes individual migration operations using Basic Memory's move_note tool.
 * Handles errors gracefully to allow batch processing to continue.
 */

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { logger } from "../../utils/internal/logger";
import type { MigrationChange, MigrationResult } from "./schema";

/**
 * Executes a single migration using Basic Memory's move_note tool
 *
 * All operation types (move, rename, restructure) use move_note internally
 * since they all result in relocating a note to a new path.
 */
export async function executeMigration(
  change: MigrationChange,
  project: string,
  client: Client,
): Promise<MigrationResult> {
  const { source, target, operation } = change;

  logger.debug({ source, target, operation, project }, "Executing migration");

  try {
    // All operations use move_note - the operation type is for categorization
    const result = await client.callTool({
      name: "move_note",
      arguments: {
        identifier: source,
        destination_path: target,
        project,
      },
    });

    // Check if the result indicates success
    const text =
      (result.content as Array<{ type: string; text?: string }>)?.[0]?.text ||
      "";
    const isError = result.isError || text.toLowerCase().includes("error");

    if (isError) {
      logger.warn(
        { source, target, operation, error: text },
        "Migration failed",
      );

      return {
        source,
        target,
        operation,
        success: false,
        error: text || "Unknown error from move_note",
      };
    }

    logger.info({ source, target, operation }, "Migration succeeded");

    return {
      source,
      target,
      operation,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(
      { source, target, operation, error: errorMessage },
      "Migration threw exception",
    );

    return {
      source,
      target,
      operation,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Validates a migration change has required fields
 */
export function validateChange(change: unknown): change is MigrationChange {
  if (typeof change !== "object" || change === null) {
    return false;
  }

  const c = change as Record<string, unknown>;

  return (
    typeof c.source === "string" &&
    typeof c.target === "string" &&
    typeof c.operation === "string" &&
    ["move", "rename", "restructure"].includes(c.operation)
  );
}
