/**
 * Schema for set_project tool
 */
import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const SetProjectArgsSchema = z.object({
  project: z.string().describe("Project name to activate"),
});

export type SetProjectArgs = z.infer<typeof SetProjectArgsSchema>;

export const toolDefinition: Tool = {
  name: "set_project",
  description:
    "Set the active project for this session. Call this when prompted to select a project.",
  inputSchema: {
    type: "object" as const,
    properties: {
      project: {
        type: "string",
        description: "Project name to activate",
      },
    },
    required: ["project"],
  },
};
