/**
 * Schema for list_features_by_priority tool
 */
import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const ListFeaturesByPriorityArgsSchema = z.object({
  project: z
    .string()
    .optional()
    .describe("Project to list features for. Auto-resolved from CWD if not specified."),
  entity_type: z
    .enum(["feature", "task", "phase"])
    .optional()
    .default("feature")
    .describe("Type of entity to list. Default: feature"),
  include_completed: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include completed items. Default: false"),
  format: z
    .enum(["list", "tree"])
    .optional()
    .default("list")
    .describe("Output format. Default: list"),
});

export type ListFeaturesByPriorityArgs = z.infer<typeof ListFeaturesByPriorityArgsSchema>;

export const toolDefinition: Tool = {
  name: "list_features_by_priority",
  description: `List features ordered by dependency and priority.

Returns features sorted by:
1. Dependency order (topological sort - dependencies first)
2. Priority tie-breaking (lower number = higher priority)

Includes validation warnings for:
- Circular dependencies
- Missing dependency targets
- Features without priority set`,
  inputSchema: {
    type: "object" as const,
    properties: {
      project: {
        type: "string",
        description: "Project to list features for. Auto-resolved from CWD if not specified.",
      },
      entity_type: {
        type: "string",
        enum: ["feature", "task", "phase"],
        description: "Type of entity to list. Default: feature",
      },
      include_completed: {
        type: "boolean",
        description: "Include completed items. Default: false",
      },
      format: {
        type: "string",
        enum: ["list", "tree"],
        description: "Output format. Default: list",
      },
    },
    required: [],
  },
};
