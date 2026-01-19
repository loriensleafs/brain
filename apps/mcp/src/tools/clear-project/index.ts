/**
 * clear_project tool implementation
 *
 * Clears the active project, forcing re-selection on next operation.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { clearActiveProject } from "../../project/resolve";
import type { ClearProjectArgs } from "./schema";

export async function handler(_args: ClearProjectArgs): Promise<CallToolResult> {
  clearActiveProject();
  return {
    content: [
      {
        type: "text" as const,
        text: "Active project cleared. Next operation will prompt for project selection.",
      },
    ],
  };
}

export { toolDefinition } from "./schema";
