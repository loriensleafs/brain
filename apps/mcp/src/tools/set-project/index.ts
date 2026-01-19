/**
 * set_project tool implementation
 *
 * Sets the active project for this session.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { setActiveProject } from "../../project/resolve";
import type { SetProjectArgs } from "./schema";

export async function handler(args: SetProjectArgs): Promise<CallToolResult> {
  setActiveProject(args.project);
  return {
    content: [
      {
        type: "text" as const,
        text: `🧠 Project set to "${args.project}".\n\nTo make this persist across terminal sessions, run:\nexport BM_PROJECT=${args.project}`,
      },
    ],
  };
}

export { toolDefinition } from "./schema";
