/**
 * Stdio transport for Brain MCP server.
 *
 * Used when connecting to Claude Desktop, Cursor, or other
 * clients that spawn the server as a subprocess.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "../utils/internal/logger";

/**
 * Start the server with stdio transport.
 * Communication happens via stdin/stdout.
 */
export async function startStdioTransport(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();

  await server.connect(transport);

  logger.info("Stdio transport started - ready for MCP communication");
}
