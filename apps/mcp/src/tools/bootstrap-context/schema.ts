/**
 * Schema for bootstrap_context tool
 *
 * Provides semantic context for conversation initialization by querying
 * active features, recent decisions, open bugs, and related notes.
 *
 * Validation: Uses JSON Schema via AJV from @brain/validation
 */

import {
  parseBootstrapContextArgs as _parseBootstrapContextArgs,
  type BootstrapContextArgs,
} from "@brain/validation";
import bootstrapContextSchema from "@brain/validation/schemas/tools/bootstrap-context.schema.json";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// Re-export type for backward compatibility
export type { BootstrapContextArgs };

/**
 * BootstrapContextArgsSchema provides Zod-compatible interface.
 * Uses AJV validation under the hood for 5-18x better performance.
 */
export const BootstrapContextArgsSchema = {
  parse: _parseBootstrapContextArgs,
};

export const toolDefinition: Tool = {
  name: "bootstrap_context",
  description: `Build semantic context for conversation initialization.

Returns structured context including:
- Active features with phases and tasks (status parsed)
- Recent decisions (3 days)
- Open bugs (status != CLOSED)
- First-level referenced notes (with full content)
- Session state and enrichment

Use this when starting a session or after compaction to restore context.
Always includes full note content for rich context injection.`,
  inputSchema: bootstrapContextSchema as Tool["inputSchema"],
};
