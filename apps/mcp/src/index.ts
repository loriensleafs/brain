/**
 * Brain MCP Server Entry Point
 *
 * A TypeScript/Bun wrapper around basic-memory that provides:
 * - Active project selection with 5-level resolution hierarchy
 * - Dual transport: stdio for Claude/Cursor, HTTP for TUI
 * - CWD-based automatic project detection
 * - Session state persistence
 * - Graceful degradation when Inngest unavailable
 */

import { config } from "./config";
import { createVectorConnection } from "./db/connection";
import { createEmbeddingsTable } from "./db/schema";
import { closeBasicMemoryClient } from "./proxy/client";
import { initInngestService } from "./services/inngest";
import { ensureOllama } from "./services/ollama";
import { getSession } from "./services/session";
import { flushLogs, logger, logStartup } from "./utils/internal/logger";

async function main(): Promise<void> {
  logStartup();

  // Initialize embeddings table for semantic search
  try {
    const db = createVectorConnection();
    createEmbeddingsTable(db);
    db.close();
    logger.info("Embeddings table initialized");
  } catch (error) {
    logger.warn(
      { error },
      "Failed to initialize embeddings table - semantic search disabled",
    );
  }

  // Ensure Ollama is running for semantic search (auto-starts if needed)
  const ollamaReady = await ensureOllama();
  logger.info(
    { ollamaReady },
    ollamaReady
      ? "Ollama ready for semantic search"
      : "Ollama unavailable - semantic search will use keyword fallback",
  );

  // Initialize session state (creates default if not exists)
  await getSession();
  logger.info("Session state initialized");

  // Initialize Inngest service (non-blocking)
  // Server continues even if Inngest unavailable
  const inngestAvailable = await initInngestService();
  logger.info(
    { inngestAvailable },
    inngestAvailable
      ? "Workflow features enabled"
      : "Workflow features disabled - start Inngest dev server to enable",
  );

  try {
    // Import server creation (lazy to allow config to initialize first)
    const { createServer } = await import("./server");
    const server = await createServer();

    // Start appropriate transport based on config
    if (config.transport === "http") {
      const { startHttpTransport } = await import("./transport/http");
      await startHttpTransport(server);
    } else {
      const { startStdioTransport } = await import("./transport/stdio");
      await startStdioTransport(server);
    }

    logger.info({ transport: config.transport }, "Brain MCP server ready");
  } catch (error) {
    // Log error with full details (Pino may serialize Error objects poorly)
    const errorInfo =
      error instanceof Error
        ? { message: error.message, stack: error.stack, name: error.name }
        : { error };
    logger.fatal(errorInfo, "Failed to start Brain MCP server");
    console.error("Startup error:", error); // Also print to stderr for debugging
    await shutdown(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(code: number = 0): Promise<void> {
  logger.info({ code }, "Shutting down Brain MCP server");

  try {
    await closeBasicMemoryClient();
  } catch (error) {
    logger.error({ error }, "Error during shutdown");
  }

  flushLogs();
  process.exit(code);
}

// Handle termination signals
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "Uncaught exception");
  shutdown(1);
});
process.on("unhandledRejection", (reason) => {
  // Serialize error properly for logging
  const errorInfo =
    reason instanceof Error
      ? { message: reason.message, stack: reason.stack, name: reason.name }
      : { reason: String(reason) };
  logger.fatal(errorInfo, "Unhandled rejection");
  // Also log to stderr for immediate visibility
  console.error("Unhandled rejection:", reason);
  shutdown(1);
});

// Start the server
main();
