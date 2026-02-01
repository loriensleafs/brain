/**
 * Schema for list_features_by_priority tool
 *
 * Migrated from Zod to JSON Schema + AJV per ADR-022.
 * JSON Schema source: packages/validation/schemas/tools/list-features-by-priority.schema.json
 */
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  type ListFeaturesByPriorityArgs,
  validateListFeaturesByPriorityArgs,
  parseListFeaturesByPriorityArgs,
  getListFeaturesByPriorityArgsErrors,
} from "@brain/validation";
import listFeaturesByPrioritySchema from "@brain/validation/schemas/tools/list-features-by-priority.schema.json";

// Re-export types and validation functions from @brain/validation
export type { ListFeaturesByPriorityArgs };
export {
  validateListFeaturesByPriorityArgs,
  parseListFeaturesByPriorityArgs,
  getListFeaturesByPriorityArgsErrors,
};

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
  inputSchema: listFeaturesByPrioritySchema as Tool["inputSchema"],
};
