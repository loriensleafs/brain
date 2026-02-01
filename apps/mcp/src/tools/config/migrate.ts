/**
 * migrate_config tool implementation
 *
 * Migrates Brain configuration from old location (~/.basic-memory/brain-config.json)
 * to new XDG-compliant location (~/.config/brain/config.json).
 *
 * @see ADR-020 for configuration architecture
 * @see TASK-020-11 for implementation requirements
 */

import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getBrainConfigPath } from "../../config/brain-config";
import {
  getOldConfigPath,
  migrateToNewConfigLocation,
  oldConfigExists,
} from "../../config/config-migration";

// ============================================================================
// Schema Definition
// ============================================================================

export const ConfigMigrateArgsSchema = z.object({
  dry_run: z
    .boolean()
    .optional()
    .default(false)
    .describe("Preview migration without making changes."),
  cleanup: z
    .boolean()
    .optional()
    .default(false)
    .describe("Remove deprecated files after successful migration."),
});

export type ConfigMigrateArgs = z.infer<typeof ConfigMigrateArgsSchema>;

export const toolDefinition: Tool = {
  name: "migrate_config",
  description: `Migrate Brain configuration from old format to new format.

This tool migrates configuration from the old location
(~/.basic-memory/brain-config.json) to the new XDG-compliant location
(~/.config/brain/config.json) with the updated schema.

Migration includes:
- Converting old config format to new schema (v2.0.0)
- Creating ~/.config/brain/ directory with proper permissions (0700)
- Writing config with proper permissions (0600)
- Syncing to basic-memory config via translation layer

Deprecated files removed with cleanup=true:
- ~/.basic-memory/brain-config.json
- ~/.brain/projects.json
- ~/.brain/ directory (if empty)

Use dry_run=true to preview what will be migrated without making changes.`,
  inputSchema: {
    type: "object" as const,
    properties: {
      dry_run: {
        type: "boolean",
        description: "Preview migration without making changes.",
        default: false,
      },
      cleanup: {
        type: "boolean",
        description: "Remove deprecated files after migration.",
        default: false,
      },
    },
    required: [],
  },
};

// ============================================================================
// Handler Implementation
// ============================================================================

/**
 * Handler for migrate_config tool.
 *
 * @param args - Tool arguments (raw from MCP, will be validated)
 * @returns CallToolResult with migration result or error
 */
export async function handler(
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  try {
    // Validate and parse input
    const parsed = ConfigMigrateArgsSchema.parse(args);
    const { dry_run, cleanup } = parsed;

    // Check if old config exists
    const oldExists = oldConfigExists();
    const oldPath = getOldConfigPath();
    const newPath = getBrainConfigPath();

    if (!oldExists) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                dry_run,
                old_config_found: false,
                message: "No old config found - migration not needed",
                old_location: oldPath,
                new_location: newPath,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // Run migration
    const result = await migrateToNewConfigLocation({
      dryRun: dry_run,
      removeOldConfig: cleanup,
    });

    if (!result.success) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                error: result.error || "Migration failed",
                old_location: oldPath,
                new_location: newPath,
                backup_path: result.backupPath,
                steps: result.steps,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    // Build success response
    const response: Record<string, unknown> = {
      success: true,
      dry_run,
      old_config_found: true,
      new_config_path: newPath,
      migrated: !dry_run,
    };

    if (result.backupPath) {
      response.backup_path = result.backupPath;
    }

    if (result.oldConfigRemoved) {
      response.cleaned_up = [oldPath];
    }

    if (result.migratedConfig) {
      response.config_summary = {
        version: result.migratedConfig.version,
        projects: Object.keys(result.migratedConfig.projects || {}),
        defaults: result.migratedConfig.defaults,
      };
    }

    // Include migration steps for transparency
    response.steps = result.steps.map((step) => ({
      name: step.name,
      status: step.status,
      ...(step.error ? { error: step.error } : {}),
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(response, null, 2),
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
              error: `Failed to migrate config: ${error instanceof Error ? error.message : String(error)}`,
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
