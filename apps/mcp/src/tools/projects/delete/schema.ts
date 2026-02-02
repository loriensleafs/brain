/**
 * Schema for delete_project tool
 *
 * Two-stage deletion with safety controls:
 * - Stage 1: Config cleanup (always happens)
 * - Stage 2: File deletion (only if delete_notes=true)
 *
 * Security controls:
 * - delete_notes defaults to false (safety by default)
 * - Path validation prevents traversal attacks
 * - Symlink resolution prevents symlink attacks
 *
 * Migrated from Zod to JSON Schema + AJV per ADR-022.
 * JSON Schema source: packages/validation/schemas/tools/projects/delete-project.schema.json
 */

import {
  type DeleteProjectArgs,
  parseDeleteProjectArgs,
  validateDeleteProjectArgs,
} from "@brain/validation";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export { validateDeleteProjectArgs, parseDeleteProjectArgs, type DeleteProjectArgs };

// Re-export for backward compatibility
export const DeleteProjectArgsSchema = {
  parse: parseDeleteProjectArgs,
  safeParse: (data: unknown) => {
    try {
      return { success: true as const, data: parseDeleteProjectArgs(data) };
    } catch (error) {
      return { success: false as const, error };
    }
  },
};

export const toolDefinition: Tool = {
  name: "delete_project",
  description: `Delete a Brain memory project.

This is a DESTRUCTIVE operation. Review carefully before proceeding.

Parameters:
- project: Project name to delete (required)
- delete_notes: If true, also delete the notes directory (optional, default: false)

Behavior:
1. Config-only deletion (delete_notes=false, default):
   - Removes project from brain-config.json and basic-memory config.json
   - Preserves the notes directory for manual recovery
   - Use this when you want to "unregister" a project but keep the data

2. Full deletion (delete_notes=true):
   - Removes project from both config files
   - PERMANENTLY DELETES the notes directory and all contents
   - Cannot be undone - ensure you have backups

Safety controls:
- delete_notes defaults to false (must explicitly opt-in to file deletion)
- Path traversal prevention (rejects ../etc patterns)
- Symlink attack prevention (follows symlinks before validation)
- Protected path blocklist (cannot delete ~/.ssh, ~/.config, etc.)
- Two-stage deletion (config removed before files, allows recovery if file deletion fails)

Recovery:
- Config-only deletion: Recreate with create_project using the preserved notes path
- Full deletion: Restore from backup (Git, Time Machine, etc.)

Examples:
- Unregister project (keep notes): delete_project with project="myproject"
- Full delete: delete_project with project="myproject", delete_notes=true`,
  inputSchema: {
    type: "object" as const,
    properties: {
      project: {
        type: "string",
        description: "Project name to delete",
      },
      delete_notes: {
        type: "boolean",
        description:
          "If true, also delete the notes directory. DESTRUCTIVE - defaults to false for safety.",
        default: false,
      },
    },
    required: ["project"],
  },
};
