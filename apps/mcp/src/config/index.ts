/**
 * Configuration schema and environment loading for Brain MCP server.
 * Uses plain TypeScript for validation - migrated from Zod.
 */

import * as os from "node:os";
import * as path from "node:path";

/**
 * MCP Server configuration type.
 */
export interface Config {
  /** Transport mode: stdio for Claude/Cursor, http for TUI */
  transport: "stdio" | "http";

  /** HTTP server port (only used when transport=http) */
  httpPort: number;

  /** HTTP server host (only used when transport=http) */
  httpHost: string;

  /** Log file path - NEVER log to stdout in MCP! */
  logFile: string;

  /** Command to spawn basic-memory MCP server */
  basicMemoryCmd: string;

  /** Log level */
  logLevel: "trace" | "debug" | "info" | "warn" | "error";

  /** Search guard mode: "warn" (log only), "enforce" (block duplicates), "off" (disabled) */
  searchGuard: "warn" | "enforce" | "off";

  /** Computed: whether search guard is enabled */
  searchGuardEnabled?: boolean;

  /** Computed: whether search guard should enforce (block duplicates) */
  searchGuardEnforce?: boolean;
}

/**
 * Expand ~ to home directory in paths.
 */
function expandPath(p: string): string {
  if (p.startsWith("~")) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

/**
 * Parse transport from environment variable.
 */
function parseTransport(value: string | undefined): "stdio" | "http" {
  if (value === "http") return "http";
  return "stdio";
}

/**
 * Parse log level from environment variable.
 */
function parseLogLevel(value: string | undefined): "trace" | "debug" | "info" | "warn" | "error" {
  const validLevels = ["trace", "debug", "info", "warn", "error"] as const;
  if (value && validLevels.includes(value as (typeof validLevels)[number])) {
    return value as (typeof validLevels)[number];
  }
  return "info";
}

/**
 * Parse search guard mode from environment variable.
 */
function parseSearchGuard(value: string | undefined): "warn" | "enforce" | "off" {
  const validModes = ["warn", "enforce", "off"] as const;
  if (value && validModes.includes(value as (typeof validModes)[number])) {
    return value as (typeof validModes)[number];
  }
  return "warn";
}

/**
 * Parse and validate configuration from environment variables.
 */
function loadConfig(): Config {
  const transport = parseTransport(process.env.BRAIN_TRANSPORT);
  const httpPort = Number(process.env.BRAIN_HTTP_PORT) || 8765;
  const httpHost = process.env.BRAIN_HTTP_HOST || "127.0.0.1";
  const logFile = expandPath(process.env.BRAIN_LOG_FILE || "~/.basic-memory/brain.log");
  const basicMemoryCmd = process.env.BRAIN_BM_CMD || "basic-memory";
  const logLevel = parseLogLevel(process.env.BRAIN_LOG_LEVEL);
  const searchGuard = parseSearchGuard(process.env.BRAIN_SEARCH_GUARD);

  return {
    transport,
    httpPort,
    httpHost,
    logFile,
    basicMemoryCmd,
    logLevel,
    searchGuard,
    searchGuardEnabled: searchGuard !== "off",
    searchGuardEnforce: searchGuard === "enforce",
  };
}

export const config = loadConfig();
