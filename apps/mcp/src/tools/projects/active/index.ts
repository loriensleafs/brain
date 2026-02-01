/**
 * active_project tool implementation
 *
 * Unified tool for getting, setting, and clearing the active project.
 * Replaces separate set_project, get_project, clear_project tools.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getCodePaths } from "../../../project/config";
import {
  clearActiveProject,
  getActiveProject,
  getResolutionHierarchy,
  resolveProject,
  setActiveProject,
} from "../../../project/resolve";
import type { ActiveProjectArgs } from "./schema";

export {
  type ActiveProjectArgs,
  ActiveProjectArgsSchema,
  toolDefinition,
} from "./schema";

export async function handler(
  args: ActiveProjectArgs,
): Promise<CallToolResult> {
  const operation = args.operation || "get";

  switch (operation) {
    case "set":
      return handleSet(args.project);
    case "clear":
      return handleClear();
    case "get":
    default:
      return handleGet();
  }
}

async function handleGet(): Promise<CallToolResult> {
  const active = getActiveProject();
  const resolved = resolveProject();
  const codePaths = getCodePaths();
  const hierarchy = getResolutionHierarchy();

  const response = {
    active_project: active,
    resolved_project: resolved,
    resolution_hierarchy: hierarchy,
    code_paths: codePaths,
  };

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

async function handleSet(project: string | undefined): Promise<CallToolResult> {
  if (!project) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Error: project parameter is required for set operation",
        },
      ],
      isError: true,
    };
  }

  setActiveProject(project);

  return {
    content: [
      {
        type: "text" as const,
        text: `Project set to "${project}".\n\nTo persist across terminal sessions, run:\nexport BM_PROJECT=${project}`,
      },
    ],
  };
}

async function handleClear(): Promise<CallToolResult> {
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
