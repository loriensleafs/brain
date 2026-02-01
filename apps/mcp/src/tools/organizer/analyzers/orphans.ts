/**
 * Orphan note analyzer for maintain mode
 *
 * Identifies notes with no relations to other notes in the knowledge graph.
 * Orphaned notes may indicate isolated knowledge that should be connected.
 */

import { getBasicMemoryClient } from "../../../proxy/client";
import type { QualityIssue } from "../types";
import { extractWikilinks } from "../utils/wikilinks";

/**
 * Find notes that have no relations to other notes
 */
export async function findOrphanNotes(
  project: string,
): Promise<QualityIssue[]> {
  const client = await getBasicMemoryClient();
  const issues: QualityIssue[] = [];

  // Get all notes in project
  const listResult = await client.callTool({
    name: "list_directory",
    arguments: { project, depth: 10, file_name_glob: "*.md" },
  });

  const noteFiles = parseListDirectoryResult(listResult);

  // Check each note for relations
  for (const permalink of noteFiles) {
    try {
      const readResult = await client.callTool({
        name: "read_note",
        arguments: { identifier: permalink, project },
      });

      const relationCount = countRelations(readResult);

      if (relationCount === 0) {
        issues.push({
          type: "ORPHAN",
          note: permalink,
          recommendation: `Connect "${permalink}" to related notes using [[wikilinks]] or add it to relevant context`,
        });
      }
    } catch (_error) {}
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
 * Count relations in a note
 */
function countRelations(result: any): number {
  const text = result.content?.[0]?.text || "";

  // Count wikilinks as relations
  const wikilinks = extractWikilinks(text);

  return wikilinks.length;
}
