/**
 * Schema for clear_project tool
 */
import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const ClearProjectArgsSchema = z.object({});

export type ClearProjectArgs = z.infer<typeof ClearProjectArgsSchema>;

export const toolDefinition: Tool = {
  name: "clear_project",
  description: "Clear the active project, forcing re-selection.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};
