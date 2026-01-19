/**
 * Configuration schema and environment loading for Brain MCP server.
 * Uses Zod for validation and type-safe environment parsing.
 */

import { z } from "zod";
import * as path from "path";
import * as os from "os";

export const configSchema = z.object({
  /** Transport mode: stdio for Claude/Cursor, http for TUI */
  transport: z.enum(["stdio", "http"]).default("stdio"),

  /** HTTP server port (only used when transport=http) */
  httpPort: z.coerce.number().default(8765),

  /** HTTP server host (only used when transport=http) */
  httpHost: z.string().default("127.0.0.1"),

  /** Log file path - NEVER log to stdout in MCP! */
  logFile: z.string().default("~/.basic-memory/brain.log"),

  /** Command to spawn basic-memory MCP server */
  basicMemoryCmd: z.string().default("basic-memory"),

  /** Log level */
  logLevel: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),

  /** Search guard mode: "warn" (log only), "enforce" (block duplicates), "off" (disabled) */
  searchGuard: z.enum(["warn", "enforce", "off"]).default("warn"),

  /** Computed: whether search guard is enabled */
  searchGuardEnabled: z.boolean().optional(),

  /** Computed: whether search guard should enforce (block duplicates) */
  searchGuardEnforce: z.boolean().optional(),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Expand ~ to home directory in paths
 */
function expandPath(p: string): string {
  if (p.startsWith("~")) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

/**
 * Parse and validate configuration from environment variables
 */
function loadConfig(): Config {
  const raw = {
    transport: process.env.BRAIN_TRANSPORT,
    httpPort: process.env.BRAIN_HTTP_PORT,
    httpHost: process.env.BRAIN_HTTP_HOST,
    logFile: process.env.BRAIN_LOG_FILE,
    basicMemoryCmd: process.env.BRAIN_BM_CMD,
    logLevel: process.env.BRAIN_LOG_LEVEL,
    searchGuard: process.env.BRAIN_SEARCH_GUARD,
  };

  const parsed = configSchema.parse(raw);

  // Expand paths
  parsed.logFile = expandPath(parsed.logFile);

  // Compute search guard flags
  parsed.searchGuardEnabled = parsed.searchGuard !== "off";
  parsed.searchGuardEnforce = parsed.searchGuard === "enforce";

  return parsed;
}

export const config = loadConfig();
