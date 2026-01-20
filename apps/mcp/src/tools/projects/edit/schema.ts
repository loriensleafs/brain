/**
 * Schema for edit_project tool
 *
 * Notes path supports three modes:
 * - 'DEFAULT': ${default_notes_path}/${project_name} (from brain-config.json)
 * - 'CODE': ${code_path}/docs
 * - Custom absolute path
 */
import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Notes path options:
 * - 'DEFAULT': Use default_notes_path from config + project name
 * - 'CODE': Use code_path/docs
 * - Any other string: Treat as absolute path
 */
export type NotesPathOption = "DEFAULT" | "CODE" | string;

export const EditProjectArgsSchema = z.object({
  name: z.string().describe("Project name to edit"),
  code_path: z
    .string()
    .describe("Code directory path (use ~ for home). Required for editing."),
  notes_path: z
    .string()
    .optional()
    .describe(
      "Notes directory path. Options: 'DEFAULT' (${default_notes_path}/${name}), 'CODE' (${code_path}/docs), or absolute path. Defaults to 'DEFAULT' when not specified, except auto-updates to new code_path/docs if was ${old_code_path}/docs."
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
- notes_path: Notes directory location. Options:
  - 'DEFAULT': \${default_notes_path}/\${project_name} (from brain-config.json)
  - 'CODE': \${code_path}/docs
  - Absolute path: Any custom absolute path

Default behavior when notes_path not specified:
- Defaults to 'DEFAULT' mode (\${default_notes_path}/\${project_name})
- Exception: If notes_path was \${old_code_path}/docs and code_path changes, auto-updates to \${new_code_path}/docs

Examples:
- Set code path (notes defaults to DEFAULT): edit_project with name="brain", code_path="~/Dev/brain"
- Keep notes in code: edit_project with name="brain", code_path="~/Dev/brain", notes_path="CODE"
- Set custom path: edit_project with name="brain", code_path="~/Dev/brain", notes_path="~/custom/notes"`,
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
      notes_path: {
        type: "string",
        description:
          "Notes directory path. Options: 'DEFAULT' (${default_notes_path}/${name}), 'CODE' (${code_path}/docs), or absolute path. Defaults to 'DEFAULT' when not specified, except auto-updates to new code_path/docs if was ${old_code_path}/docs.",
      },
    },
    required: ["name", "code_path"],
  },
};
