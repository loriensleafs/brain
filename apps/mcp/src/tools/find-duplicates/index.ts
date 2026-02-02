/**
 * Handler for find_duplicates tool
 *
 * Finds semantically duplicate notes in a Brain project using embedding and
 * fulltext similarity. Returns candidate pairs and confirmed duplicates.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolveProject } from "../../project/resolve";
import { findDuplicates } from "../organizer/modes/dedupe";
import type { FindDuplicatesArgs } from "./schema";

/**
 * Main handler for the find_duplicates tool
 */
export async function handler(args: FindDuplicatesArgs): Promise<CallToolResult> {
  const project = args.project || resolveProject();

  if (!project) {
    return {
      content: [{ type: "text" as const, text: "No project specified." }],
      isError: true,
    };
  }

  // Map snake_case args to camelCase config
  const result = await findDuplicates({
    project,
    embeddingThreshold: args.embedding_threshold,
    fulltextThreshold: args.fulltext_threshold,
  });

  // Format output text
  const lines: string[] = [
    `## Duplicate Detection Results`,
    ``,
    `**Project:** ${project}`,
    `**Embedding Threshold:** ${args.embedding_threshold ?? 0.85}`,
    `**Fulltext Threshold:** ${args.fulltext_threshold ?? 0.7}`,
    ``,
    `**Summary:**`,
    `- Total Candidates: ${result.summary.totalCandidates}`,
    `- Confirmed Duplicates: ${result.summary.confirmedDuplicates}`,
    ``,
  ];

  if (result.confirmed.length > 0) {
    lines.push(`### Confirmed Duplicates`);
    lines.push(``);
    for (const pair of result.confirmed) {
      lines.push(`**Pair:**`);
      lines.push(`- ${pair.note1}`);
      lines.push(`- ${pair.note2}`);
      lines.push(`- Embedding Similarity: ${pair.embeddingSimilarity.toFixed(3)}`);
      lines.push(`- Fulltext Similarity: ${pair.fulltextSimilarity.toFixed(3)}`);
      if (pair.rationale) {
        lines.push(`- Rationale: ${pair.rationale}`);
      }
      lines.push(``);
    }
  }

  if (result.candidates.length > result.confirmed.length) {
    const unconfirmed = result.candidates.filter((c) => !result.confirmed.includes(c));
    lines.push(`### Candidate Duplicates (Below Threshold)`);
    lines.push(``);
    for (const pair of unconfirmed.slice(0, 10)) {
      // Limit to 10
      lines.push(`**Pair:**`);
      lines.push(`- ${pair.note1}`);
      lines.push(`- ${pair.note2}`);
      lines.push(`- Embedding Similarity: ${pair.embeddingSimilarity.toFixed(3)}`);
      lines.push(`- Fulltext Similarity: ${pair.fulltextSimilarity.toFixed(3)}`);
      lines.push(``);
    }
    if (unconfirmed.length > 10) {
      lines.push(`... and ${unconfirmed.length - 10} more candidates`);
      lines.push(``);
    }
  }

  return {
    structuredContent: result as unknown as { [x: string]: unknown },
    content: [{ type: "text" as const, text: lines.join("\n") }],
  };
}

export { toolDefinition } from "./schema";
