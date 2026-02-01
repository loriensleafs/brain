/**
 * File-based logging for Brain MCP server.
 *
 * CRITICAL: Never log to stdout in MCP servers!
 * Stdout is reserved for the MCP protocol communication.
 * All logs must go to a file.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import pino from "pino";
import { config } from "../../config";

// Ensure log directory exists
const logDir = path.dirname(config.logFile);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const LOG_PREFIX = "🧠";

/**
 * Pino logger configured for file output only.
 * Uses synchronous transport for reliability during shutdown.
 * All messages are automatically prefixed with 🧠.
 */
export const logger = pino(
  {
    level: config.logLevel,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    hooks: {
      // Automatically prefix all log messages with 🧠
      logMethod(inputArgs, method) {
        const lastArg = inputArgs[inputArgs.length - 1];
        if (typeof lastArg === "string") {
          // Message is the last argument - prefix it
          inputArgs[inputArgs.length - 1] = lastArg.startsWith(LOG_PREFIX)
            ? lastArg
            : `${LOG_PREFIX} ${lastArg}`;
        }
        return method.apply(this, inputArgs as Parameters<typeof method>);
      },
    },
  },
  pino.destination({
    dest: config.logFile,
    sync: false, // Async for performance, buffer flushes on close
    mkdir: true,
  }),
);

/**
 * Log startup info
 */
export function logStartup(): void {
  logger.info(
    {
      transport: config.transport,
      logFile: config.logFile,
      pid: process.pid,
    },
    "Brain MCP server starting",
  );
}

/**
 * Flush logs on shutdown
 */
export function flushLogs(): void {
  logger.flush();
}

// Handle process termination
process.on("beforeExit", flushLogs);
