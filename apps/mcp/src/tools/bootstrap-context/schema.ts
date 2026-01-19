/**
 * Schema for bootstrap_context tool
 *
 * Provides semantic context for conversation initialization by querying
 * active features, recent decisions, open bugs, and related notes.
 */
import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const BootstrapContextArgsSchema = z.object({
  project: z
    .string()
    .optional()
    .describe(
      "Project to bootstrap context for. Auto-resolved from CWD if not specified."
    ),
  timeframe: z
    .string()
    .default("5d")
    .describe("Timeframe for recent activity (e.g., '5d', '7d', 'today')"),
  include_referenced: z
    .boolean()
    .default(true)
    .describe("Whether to include first-level referenced notes"),
});

export type BootstrapContextArgs = z.infer<typeof BootstrapContextArgsSchema>;

export const toolDefinition: Tool = {
  name: "bootstrap_context",
  description: `Build semantic context for conversation initialization.

Returns structured context including:
- Active features with phases and tasks (status parsed)
- Recent decisions (3 days)
- Open bugs (status != CLOSED)
- First-level referenced notes

Use this when starting a session or after compaction to restore context.`,
  inputSchema: {
    type: "object" as const,
    properties: {
      project: {
        type: "string",
        description:
          "Project to bootstrap context for. Auto-resolved from CWD if not specified.",
      },
      timeframe: {
        type: "string",
        description:
          "Timeframe for recent activity (e.g., '5d', '7d', 'today')",
        default: "5d",
      },
      include_referenced: {
        type: "boolean",
        description: "Whether to include first-level referenced notes",
        default: true,
      },
    },
    required: [],
  },
};
