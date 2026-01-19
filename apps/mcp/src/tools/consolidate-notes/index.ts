/**
 * Handler for consolidate_notes tool
 *
 * Analyzes a Brain project to find consolidation opportunities:
 * - Merge candidates: Small related notes that could be combined
 * - Split candidates: Large notes covering multiple topics
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolveProject } from "../../project/resolve";
import { findConsolidationCandidates } from "../organizer/modes/consolidate";
import type { ConsolidateNotesArgs } from "./schema";

/**
 * Main handler for the consolidate_notes tool
 */
export async function handler(
  args: ConsolidateNotesArgs
): Promise<CallToolResult> {
  const project = args.project || resolveProject();

  if (!project) {
    return {
      content: [{ type: "text" as const, text: "No project specified." }],
      isError: true,
    };
  }

  // Map snake_case args to camelCase config
  const config = {
    project,
    similarityThreshold: args.similarity_threshold,
    minNoteSize: args.min_note_size,
    maxNoteSize: args.max_note_size,
  };

  // Call the consolidate mode function
  const result = await findConsolidationCandidates(config);

  // Format output
  const lines: string[] = [
    `## Consolidation Analysis`,
    ``,
    `**Project:** ${project}`,
    `**Merge Candidates:** ${result.mergeCandidates.length}`,
    `**Split Candidates:** ${result.splitCandidates.length}`,
    ``,
  ];

  if (result.mergeCandidates.length > 0) {
    lines.push(`### Merge Candidates`);
    lines.push(``);
    for (const candidate of result.mergeCandidates) {
      lines.push(`#### ${candidate.suggestedTitle}`);
      lines.push(`**Similarity:** ${(candidate.similarity * 100).toFixed(1)}%`);
      lines.push(`**Rationale:** ${candidate.rationale}`);
      lines.push(`**Notes to merge:**`);
      for (const note of candidate.notes) {
        lines.push(`- ${note}`);
      }
      lines.push(``);
    }
  }

  if (result.splitCandidates.length > 0) {
    lines.push(`### Split Candidates`);
    lines.push(``);
    for (const candidate of result.splitCandidates) {
      lines.push(`#### ${candidate.note}`);
      lines.push(`**Rationale:** ${candidate.rationale}`);
      lines.push(`**Suggested topics:**`);
      for (const topic of candidate.suggestedTopics) {
        lines.push(`- ${topic}`);
      }
      lines.push(``);
    }
  }

  if (result.mergeCandidates.length === 0 && result.splitCandidates.length === 0) {
    lines.push(`No consolidation opportunities found. Your knowledge graph is well-organized!`);
  }

  return {
    structuredContent: result as unknown as { [x: string]: unknown },
    content: [{ type: "text" as const, text: lines.join("\n") }],
  };
}

export { toolDefinition } from "./schema";
