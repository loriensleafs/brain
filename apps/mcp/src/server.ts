/**
 * Brain MCP Server setup.
 *
 * Creates the McpServer instance with:
 * - Brain-specific tools (set_project, get_project, etc.)
 * - Proxied tools from basic-memory
 * - Proxied resources and prompts
 *
 * NOTE: We use low-level setRequestHandler for ALL tools (including wrapper tools)
 * because McpServer's registerTool conflicts with custom handlers.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { discoverAndRegisterPrompts } from "./prompts";
import { discoverAndRegisterTools } from "./tools";
import { discoverAndRegisterResources } from "./transport/resources";
import { logger } from "./utils/internal/logger";

/**
 * Server instructions sent to clients on connect.
 * Reinforces proactive memory behavior.
 */
const SERVER_INSTRUCTIONS = `🧠 Brain MCP - Memory Management Server

CRITICAL BEHAVIORS:
1. ALWAYS search before write_note
2. Prefer edit_note over write_note (80/20 ratio)
3. Write notes frequently during work (every 1-2 minutes)
4. Use proper observation categories: [decision], [fact], [insight], etc.
5. Use exact entity titles in [[WikiLinks]]

FREQUENCY TRIGGERS:
- More than 1-2 minutes without a memory operation? STOP AND WRITE.
- User made a decision? Record it immediately.
- Discovered something important? Save it now.

This server wraps basic-memory with proactive memory management patterns.`;

/**
 * Create and configure the Brain MCP server.
 */
export async function createServer(): Promise<McpServer> {
  const server = new McpServer(
    {
      name: "🧠 brain",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  // Discover and register ALL tools (wrapper + proxied) via low-level handlers
  // This must be done before any registerTool calls to avoid conflicts
  await discoverAndRegisterTools(server);

  // Discover and register resources (Brain guides + basic-memory)
  await discoverAndRegisterResources(server);

  // Discover and register prompts (proxied from basic-memory)
  await discoverAndRegisterPrompts(server);

  logger.info("Brain MCP server created");
  return server;
}
