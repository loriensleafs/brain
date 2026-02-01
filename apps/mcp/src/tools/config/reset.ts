/**
 * config_reset tool implementation
 *
 * Resets Brain configuration to defaults - either a specific field
 * or the entire configuration.
 *
 * @see ADR-020 for configuration architecture
 * @see TASK-020-19 for implementation requirements
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { loadBrainConfig, saveBrainConfig } from "../../config/brain-config";
import { rollbackManager } from "../../config/rollback";
import { type BrainConfig, DEFAULT_BRAIN_CONFIG } from "../../config/schema";
import { syncConfigToBasicMemory } from "../../config/translation-layer";
import { type ConfigResetArgs, ConfigResetArgsSchema } from "./schema";

export {
  type ConfigResetArgs,
  ConfigResetArgsSchema,
  configResetToolDefinition as toolDefinition,
} from "./schema";

/**
 * Resettable top-level configuration keys.
 */
const RESETTABLE_KEYS = ["defaults", "sync", "logging", "watcher"] as const;
type ResettableKey = (typeof RESETTABLE_KEYS)[number];

/**
 * Handler for config_reset tool.
 *
 * @param args - Tool arguments (raw from MCP, will be validated)
 * @returns CallToolResult with reset confirmation or error
 */
export async function handler(
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  // Validate and parse input using AJV
  const parsed: ConfigResetArgs = ConfigResetArgsSchema.parse(args);
  const { key, all } = parsed;

  // Validate arguments
  if (!key && !all) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: "Either 'key' or 'all=true' must be provided",
              resettable_keys: [...RESETTABLE_KEYS],
              usage: [
                "Reset specific section: config_reset with key='logging'",
                "Reset entire config: config_reset with all=true",
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

  // Validate key if provided
  if (key) {
    // Extract top-level key (e.g., "logging.level" -> "logging")
    const topLevelKey = key.split(".")[0] as ResettableKey;
    if (!RESETTABLE_KEYS.includes(topLevelKey)) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                error: `Key not resettable: ${key}`,
                resettable_keys: [...RESETTABLE_KEYS],
                hint: "Projects cannot be reset via config_reset. Use delete_project and create_project instead.",
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

  try {
    // Load current config
    const oldConfig = await loadBrainConfig();

    // Create snapshot before modification
    if (rollbackManager.isInitialized()) {
      rollbackManager.snapshot(
        oldConfig,
        all ? "Before config_reset --all" : `Before config_reset: ${key}`,
      );
    }

    let newConfig: BrainConfig;
    let resetDescription: string;

    if (all) {
      // Reset entire config to defaults, but preserve projects
      newConfig = {
        ...DEFAULT_BRAIN_CONFIG,
        projects: oldConfig.projects, // Preserve existing projects
      };
      resetDescription =
        "Reset entire configuration to defaults (projects preserved)";
    } else if (key) {
      // Reset specific section
      const topLevelKey = key.split(".")[0] as ResettableKey;
      newConfig = structuredClone(oldConfig);

      switch (topLevelKey) {
        case "defaults":
          newConfig.defaults = { ...DEFAULT_BRAIN_CONFIG.defaults };
          break;
        case "sync":
          newConfig.sync = { ...DEFAULT_BRAIN_CONFIG.sync };
          break;
        case "logging":
          newConfig.logging = { ...DEFAULT_BRAIN_CONFIG.logging };
          break;
        case "watcher":
          newConfig.watcher = { ...DEFAULT_BRAIN_CONFIG.watcher };
          break;
      }

      resetDescription = `Reset ${topLevelKey} to defaults`;
    } else {
      // Should not reach here due to earlier validation
      throw new Error("Invalid arguments");
    }

    // Save updated config
    await saveBrainConfig(newConfig);

    // Sync to basic-memory
    await syncConfigToBasicMemory(newConfig);

    // Mark as good after successful reset
    if (rollbackManager.isInitialized()) {
      await rollbackManager.markAsGood(newConfig, resetDescription);
    }

    // Build response showing what changed
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    if (all) {
      // Show all top-level changes
      for (const k of RESETTABLE_KEYS) {
        if (JSON.stringify(oldConfig[k]) !== JSON.stringify(newConfig[k])) {
          changes[k] = {
            old: oldConfig[k],
            new: newConfig[k],
          };
        }
      }
    } else if (key) {
      const topLevelKey = key.split(".")[0] as ResettableKey;
      changes[topLevelKey] = {
        old: oldConfig[topLevelKey],
        new: newConfig[topLevelKey],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: true,
              description: resetDescription,
              changes,
              projects_preserved: Object.keys(newConfig.projects).length,
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
              error: `Failed to reset config: ${error instanceof Error ? error.message : String(error)}`,
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
