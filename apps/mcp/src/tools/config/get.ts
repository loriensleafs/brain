/**
 * config_get tool implementation
 *
 * Retrieves Brain configuration values - either the entire config
 * or a specific field using dot notation.
 *
 * @see ADR-020 for configuration architecture
 * @see TASK-020-19 for implementation requirements
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { loadBrainConfig } from "../../config/brain-config";
import { type ConfigGetArgs, ConfigGetArgsSchema } from "./schema";

export {
  type ConfigGetArgs,
  ConfigGetArgsSchema,
  configGetToolDefinition as toolDefinition,
} from "./schema";

/**
 * Get a nested value from an object using dot notation.
 *
 * @param obj - Object to traverse
 * @param path - Dot-separated path (e.g., "logging.level")
 * @returns The value at the path, or undefined if not found
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Handler for config_get tool.
 *
 * @param args - Tool arguments (raw from MCP, will be validated)
 * @returns CallToolResult with config data or error
 */
export async function handler(args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    // Validate and parse input using AJV
    const parsed: ConfigGetArgs = ConfigGetArgsSchema.parse(args);

    const config = await loadBrainConfig();

    // If no key specified, return entire config
    if (!parsed.key) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(config, null, 2),
          },
        ],
      };
    }

    // Get specific key using dot notation
    const value = getNestedValue(config as unknown as Record<string, unknown>, parsed.key);

    if (value === undefined) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                error: `Key not found: ${parsed.key}`,
                available_keys: [
                  "defaults.memories_location",
                  "defaults.memories_mode",
                  "projects",
                  "sync.enabled",
                  "sync.delay_ms",
                  "logging.level",
                  "watcher.enabled",
                  "watcher.debounce_ms",
                ],
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              key: parsed.key,
              value,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: `Failed to get config: ${error instanceof Error ? error.message : String(error)}`,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
}
