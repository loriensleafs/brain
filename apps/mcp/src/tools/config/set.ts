/**
 * config_set tool implementation
 *
 * Sets a Brain configuration value and triggers reconfiguration
 * if the change affects projects.
 *
 * @see ADR-020 for configuration architecture
 * @see TASK-020-19 for implementation requirements
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { loadBrainConfig, saveBrainConfig } from "../../config/brain-config";
import { syncConfigToBasicMemory } from "../../config/translation-layer";
import { rollbackManager } from "../../config/rollback";
import { detectConfigDiff, summarizeConfigDiff } from "../../config/diff";
import type { BrainConfig, MemoriesMode, LogLevel } from "../../config/schema";
import type { ConfigSetArgs } from "./schema";

export { configSetToolDefinition as toolDefinition, ConfigSetArgsSchema, type ConfigSetArgs } from "./schema";

/**
 * Settable configuration keys with their expected types and validation.
 */
const SETTABLE_KEYS: Record<string, { type: "string" | "number" | "boolean"; validate?: (v: unknown) => boolean }> = {
  "defaults.memories_location": { type: "string" },
  "defaults.memories_mode": {
    type: "string",
    validate: (v) => ["DEFAULT", "CODE", "CUSTOM"].includes(v as string),
  },
  "sync.enabled": { type: "boolean" },
  "sync.delay_ms": { type: "number", validate: (v) => typeof v === "number" && v >= 0 },
  "logging.level": {
    type: "string",
    validate: (v) => ["trace", "debug", "info", "warn", "error"].includes(v as string),
  },
  "watcher.enabled": { type: "boolean" },
  "watcher.debounce_ms": { type: "number", validate: (v) => typeof v === "number" && v >= 0 },
};

/**
 * Set a nested value in an object using dot notation.
 *
 * @param obj - Object to modify (will be mutated)
 * @param path - Dot-separated path
 * @param value - Value to set
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
}

/**
 * Handler for config_set tool.
 *
 * @param args - Tool arguments
 * @returns CallToolResult with update confirmation or error
 */
export async function handler(args: ConfigSetArgs): Promise<CallToolResult> {
  const { key, value } = args;

  // Validate key is settable
  if (!(key in SETTABLE_KEYS)) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: `Key not settable: ${key}`,
              settable_keys: Object.keys(SETTABLE_KEYS),
              hint: "Use config_update_project for project-specific settings",
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  const keyConfig = SETTABLE_KEYS[key];

  // Validate value type
  const actualType = typeof value;
  if (actualType !== keyConfig.type) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: `Invalid type for ${key}: expected ${keyConfig.type}, got ${actualType}`,
              key,
              value,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  // Validate value if validator exists
  if (keyConfig.validate && !keyConfig.validate(value)) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: `Invalid value for ${key}: ${value}`,
              key,
              hint: getValidationHint(key),
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  try {
    // Load current config
    const oldConfig = await loadBrainConfig();

    // Create snapshot before modification
    if (rollbackManager.isInitialized()) {
      rollbackManager.snapshot(oldConfig, `Before config_set: ${key}`);
    }

    // Create new config with updated value
    const newConfig = structuredClone(oldConfig);
    setNestedValue(newConfig as unknown as Record<string, unknown>, key, value);

    // Detect changes
    const diff = detectConfigDiff(oldConfig, newConfig as BrainConfig);

    // Save updated config
    await saveBrainConfig(newConfig as BrainConfig);

    // Sync to basic-memory
    await syncConfigToBasicMemory(newConfig as BrainConfig);

    // Mark as good after successful update
    if (rollbackManager.isInitialized()) {
      await rollbackManager.markAsGood(newConfig as BrainConfig, `After config_set: ${key}`);
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: true,
              key,
              old_value: getNestedValue(oldConfig as unknown as Record<string, unknown>, key),
              new_value: value,
              requires_migration: diff.requiresMigration,
              changes: summarizeConfigDiff(diff),
            },
            null,
            2
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
              error: `Failed to set config: ${error instanceof Error ? error.message : String(error)}`,
              key,
              value,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Get a nested value from an object using dot notation.
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
 * Get validation hint for a key.
 */
function getValidationHint(key: string): string {
  switch (key) {
    case "defaults.memories_mode":
      return "Valid values: DEFAULT, CODE, CUSTOM";
    case "logging.level":
      return "Valid values: trace, debug, info, warn, error";
    case "sync.delay_ms":
    case "watcher.debounce_ms":
      return "Must be a non-negative number";
    default:
      return "";
  }
}
