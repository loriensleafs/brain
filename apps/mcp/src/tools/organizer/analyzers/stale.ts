/**
 * Stale note analyzer for maintain mode
 *
 * Identifies notes that haven't been modified in a specified time period.
 * Stale notes may contain outdated information or forgotten knowledge.
 */

import { getBasicMemoryClient } from "../../../proxy/client";
import type { QualityIssue } from "../types";
import { extractFrontmatter } from "../utils/markdown";

/**
 * Find notes that haven't been updated within the threshold period
 */
export async function findStaleNotes(
  project: string,
  thresholdDays: number,
): Promise<QualityIssue[]> {
  const client = await getBasicMemoryClient();
  const issues: QualityIssue[] = [];

  // Calculate threshold date
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);

  // Get all notes in project
  const listResult = await client.callTool({
    name: "list_directory",
    arguments: { project, depth: 10, file_name_glob: "*.md" },
  });

  const noteFiles = parseListDirectoryResult(listResult);

  // Check each note's modification date
  for (const permalink of noteFiles) {
    try {
      const readResult = await client.callTool({
        name: "read_note",
        arguments: { identifier: permalink, project },
      });

      const lastModified = extractModifiedDate(readResult);

      if (lastModified && lastModified < thresholdDate) {
        const daysSinceModified = Math.floor(
          (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24),
        );

        issues.push({
          type: "STALE",
          note: permalink,
          lastModified,
          recommendation: `"${permalink}" hasn't been updated in ${daysSinceModified} days. Review for relevance and update if needed`,
        });
      }
    } catch (error) {}
  }

  return issues;
}

/**
 * Parse list_directory output to extract file paths
 */
function parseListDirectoryResult(result: any): string[] {
  const text = result.content?.[0]?.text || "";
  const files: string[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    if (line.includes(".md") && !line.includes("Directory:")) {
      const match = line.match(/([^\s]+\.md)/);
      if (match) files.push(match[1]);
    }
  }

  return files;
}

/**
 * Extract modification date from note frontmatter or metadata
 */
function extractModifiedDate(result: any): Date | null {
  const text = result.content?.[0]?.text || "";

  // Extract frontmatter using shared utility
  const frontmatter = extractFrontmatter(text);

  // Try date fields in order of preference
  const dateStr =
    frontmatter.updated || frontmatter.modified || frontmatter.date;

  if (dateStr) {
    const date = new Date(String(dateStr));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // If no frontmatter date, return null (will need filesystem date)
  return null;
}
