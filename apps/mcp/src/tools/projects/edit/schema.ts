/**
 * Schema for edit_project tool
 *
 * Memories path supports three modes:
 * - 'DEFAULT': ${default_memories_location}/${project_name} (from brain config)
 * - 'CODE': ${code_path}/docs
 * - Custom absolute path
 */
import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Memories path options:
 * - 'DEFAULT': Use default_memories_location from config + project name
 * - 'CODE': Use code_path/docs
 * - Any other string: Treat as absolute path
 */
export type MemoriesPathOption = "DEFAULT" | "CODE" | string;

export const EditProjectArgsSchema = z.object({
  name: z.string().describe("Project name to edit"),
  code_path: z
    .string()
    .describe("Code directory path (use ~ for home). Required for editing."),
  memories_path: z
    .string()
    .optional()
    .describe(
      "Memories directory path. Options: 'DEFAULT' (${default_memories_location}/${name}), 'CODE' (${code_path}/docs), or absolute path. Defaults to 'DEFAULT' when not specified, except auto-updates to new code_path/docs if was ${old_code_path}/docs."
    ),
});

export type EditProjectArgs = z.infer<typeof EditProjectArgsSchema>;

export const toolDefinition: Tool = {
  name: "edit_project",
  description: `Edit project metadata and configuration.

Required parameters:
- name: Project name to edit
- code_path: Code directory path for CWD-based project resolution

Optional parameters:
- memories_path: Memories directory location. Options:
  - 'DEFAULT': \${default_memories_location}/\${project_name} (from brain config)
  - 'CODE': \${code_path}/docs
  - Absolute path: Any custom absolute path

Default behavior when memories_path not specified:
- Defaults to 'DEFAULT' mode (\${default_memories_location}/\${project_name})
- Exception: If memories_path was \${old_code_path}/docs and code_path changes, auto-updates to \${new_code_path}/docs

Examples:
- Set code path (memories defaults to DEFAULT): edit_project with name="brain", code_path="~/Dev/brain"
- Keep memories in code: edit_project with name="brain", code_path="~/Dev/brain", memories_path="CODE"
- Set custom path: edit_project with name="brain", code_path="~/Dev/brain", memories_path="~/custom/memories"`,
  inputSchema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        description: "Project name to edit",
      },
      code_path: {
        type: "string",
        description: "Code directory path (use ~ for home). Required for editing.",
      },
      memories_path: {
        type: "string",
        description:
          "Memories directory path. Options: 'DEFAULT' (${default_memories_location}/${name}), 'CODE' (${code_path}/docs), or absolute path. Defaults to 'DEFAULT' when not specified, except auto-updates to new code_path/docs if was ${old_code_path}/docs.",
      },
    },
    required: ["name", "code_path"],
  },
};
