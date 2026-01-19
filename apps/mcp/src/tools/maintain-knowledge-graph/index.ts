/**
 * Handler for maintain_knowledge_graph tool
 *
 * Monitors knowledge graph health by identifying quality issues including orphan notes,
 * stale content, gap references, and notes below quality threshold.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolveProject } from "../../project/resolve";
import { findMaintainIssues } from "../organizer/modes/maintain";
import type { MaintainKnowledgeGraphArgs } from "./schema";
import type { MaintainConfig } from "../organizer/types";

/**
 * Main handler for the maintain_knowledge_graph tool
 */
export async function handler(
  args: MaintainKnowledgeGraphArgs
): Promise<CallToolResult> {
  const project = args.project || resolveProject();

  if (!project) {
    return {
      content: [{ type: "text" as const, text: "No project specified." }],
      isError: true,
    };
  }

  // Map snake_case args to camelCase config
  const config: MaintainConfig = {
    project,
    staleThresholdDays: args.stale_threshold_days,
    qualityThreshold: args.quality_threshold,
  };

  // Execute maintain analysis
  const result = await findMaintainIssues(config);

  // Format output
  const lines: string[] = [
    `## Knowledge Graph Maintenance Report`,
    ``,
    `**Project:** ${project}`,
    `**Total Issues:** ${result.summary.totalIssues}`,
    ``,
  ];

  // Summary section
  lines.push(`### Summary`);
  lines.push(`- Orphan notes: ${result.summary.orphanCount}`);
  lines.push(`- Stale notes: ${result.summary.staleCount}`);
  lines.push(`- Gap references: ${result.summary.gapCount}`);
  lines.push(`- Weak notes: ${result.summary.weakCount}`);
  lines.push(``);

  // Orphan notes section
  if (result.orphans.length > 0) {
    lines.push(`### Orphan Notes (${result.orphans.length})`);
    lines.push(`Notes with no relations to other notes:`);
    for (const issue of result.orphans.slice(0, 10)) {
      lines.push(`- **${issue.note}**`);
      lines.push(`  ${issue.recommendation}`);
    }
    if (result.orphans.length > 10) {
      lines.push(`... and ${result.orphans.length - 10} more`);
    }
    lines.push(``);
  }

  // Stale notes section
  if (result.stale.length > 0) {
    lines.push(`### Stale Notes (${result.stale.length})`);
    lines.push(
      `Notes not updated within ${config.staleThresholdDays || 90} days:`
    );
    for (const issue of result.stale.slice(0, 10)) {
      const lastModified = issue.lastModified
        ? new Date(issue.lastModified).toLocaleDateString()
        : "unknown";
      lines.push(`- **${issue.note}** (last modified: ${lastModified})`);
      lines.push(`  ${issue.recommendation}`);
    }
    if (result.stale.length > 10) {
      lines.push(`... and ${result.stale.length - 10} more`);
    }
    lines.push(``);
  }

  // Gap references section
  if (result.gaps.length > 0) {
    lines.push(`### Gap References (${result.gaps.length})`);
    lines.push(`Wikilinks to notes that don't exist:`);
    for (const issue of result.gaps.slice(0, 10)) {
      lines.push(`- **${issue.reference}** (referenced in: ${issue.note})`);
      lines.push(`  ${issue.recommendation}`);
    }
    if (result.gaps.length > 10) {
      lines.push(`... and ${result.gaps.length - 10} more`);
    }
    lines.push(``);
  }

  // Weak notes section
  if (result.weak.length > 0) {
    lines.push(`### Weak Notes (${result.weak.length})`);
    lines.push(
      `Notes below quality threshold (${config.qualityThreshold || 0.5}):`
    );
    for (const issue of result.weak.slice(0, 10)) {
      const scoreText = issue.score !== undefined ? issue.score.toFixed(2) : "N/A";
      lines.push(`- **${issue.note}** (score: ${scoreText})`);
      lines.push(`  ${issue.recommendation}`);
    }
    if (result.weak.length > 10) {
      lines.push(`... and ${result.weak.length - 10} more`);
    }
    lines.push(``);
  }

  return {
    structuredContent: result as unknown as { [x: string]: unknown },
    content: [{ type: "text" as const, text: lines.join("\n") }],
  };
}

export { toolDefinition } from "./schema";
