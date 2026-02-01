/**
 * Prompt handlers.
 *
 * Proxies prompts from basic-memory to clients.
 * Brain doesn't add custom prompts - just exposes basic-memory's.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  type Prompt,
} from "@modelcontextprotocol/sdk/types.js";
import { getBasicMemoryClient } from "../proxy/client";
import { logger } from "../utils/internal/logger";

// Store discovered prompts
let discoveredPrompts: Prompt[] = [];

/**
 * Discover and register prompt handlers.
 * Prompts are proxied from basic-memory.
 */
export async function discoverAndRegisterPrompts(
  server: McpServer,
): Promise<void> {
  const client = await getBasicMemoryClient();

  // Discover available prompts
  const promptsResult = await client.listPrompts();
  discoveredPrompts = promptsResult.prompts;
  logger.info(
    { count: discoveredPrompts.length },
    "Discovered basic-memory prompts",
  );

  // Register prompts/list handler
  server.server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: discoveredPrompts };
  });

  // Register prompts/get handler
  server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.debug({ prompt: name, args }, "Getting prompt");

    const result = await client.getPrompt({
      name,
      arguments: args,
    });
    return result;
  });

  logger.debug("Registered prompt handlers");
}
