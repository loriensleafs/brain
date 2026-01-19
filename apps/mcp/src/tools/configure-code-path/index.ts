/**
 * configure_code_path tool implementation
 *
 * Maps a project to a code directory for automatic CWD-based resolution.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { setCodePath, removeCodePath } from "../../project/config";
import type { ConfigureCodePathArgs } from "./schema";

export async function handler(args: ConfigureCodePathArgs): Promise<CallToolResult> {
  const { project, code_path, remove } = args;

  if (remove) {
    const removed = removeCodePath(project);
    return {
      content: [
        {
          type: "text" as const,
          text: removed
            ? `🧠 Code path removed for "${project}".`
            : `🧠 No code path was configured for "${project}".`,
        },
      ],
    };
  }

  if (!code_path) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Error: code_path is required when not removing a mapping.",
        },
      ],
      isError: true,
    };
  }

  setCodePath(project, code_path);
  return {
    content: [
      {
        type: "text" as const,
        text: `🧠 Code path configured: "${project}" → "${code_path}"\n\nNow when you cd to ${code_path} (or any subdirectory), the "${project}" project will be automatically selected.`,
      },
    ],
  };
}

export { toolDefinition } from "./schema";
