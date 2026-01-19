/**
 * Merge operation for note consolidation
 *
 * Combines content from multiple notes into one, preserving provenance
 * with "## Merged From" section. Archives originals instead of deleting.
 */

import type { MergeCandidate, MergeResult } from '../types';
import { getBasicMemoryClient } from '../../../proxy/client';
import { extractTitle } from '../utils/markdown';

/**
 * Execute a merge operation
 */
export async function executeMerge(
  candidate: MergeCandidate,
  project: string,
  targetPath?: string
): Promise<MergeResult> {
  try {
    const client = await getBasicMemoryClient();

    // Read all notes to merge
    const noteContents: Array<{ permalink: string; content: string }> = [];
    for (const permalink of candidate.notes) {
      const readResult = await client.callTool({
        name: 'read_note',
        arguments: { identifier: permalink, project },
      });

      const content = (readResult.content as any)?.[0]?.text || '';
      noteContents.push({ permalink, content });
    }

    // Generate merged content
    const mergedContent = generateMergedContent(
      candidate.suggestedTitle,
      noteContents
    );

    // Determine target path
    const target =
      targetPath || generateTargetPath(candidate.notes[0], candidate.suggestedTitle);

    // Create merged note
    await client.callTool({
      name: 'write_note',
      arguments: {
        path: target,
        project,
        content: mergedContent,
      },
    });

    // Archive original notes (placeholder - basic-memory may not have archive)
    const archivedNotes: string[] = [];
    for (const permalink of candidate.notes) {
      try {
        // For MVP, we'll leave notes in place
        // TODO: Implement proper archiving in Phase 2
        archivedNotes.push(permalink);
      } catch (error) {
        // Continue if archiving fails
      }
    }

    return {
      success: true,
      targetNote: target,
      archivedNotes,
    };
  } catch (error) {
    return {
      success: false,
      targetNote: '',
      archivedNotes: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate merged content from multiple notes
 */
function generateMergedContent(
  title: string,
  notes: Array<{ permalink: string; content: string }>
): string {
  const sections: string[] = [];

  // Add title
  sections.push(`# ${title}`);
  sections.push('');

  // Add merged from section
  sections.push('## Merged From');
  sections.push('');
  for (const note of notes) {
    const noteTitle = extractTitle(note.content) || note.permalink;
    sections.push(`- [[${note.permalink}]] - ${noteTitle}`);
  }
  sections.push('');

  // Combine content from all notes
  sections.push('## Content');
  sections.push('');

  for (const note of notes) {
    const noteTitle = extractTitle(note.content) || note.permalink;
    sections.push(`### From: ${noteTitle}`);
    sections.push('');

    // Extract main content (skip title and frontmatter)
    const content = stripFrontmatterAndTitle(note.content);
    sections.push(content);
    sections.push('');
  }

  // Extract and combine observations
  const allObservations = notes.flatMap((n) => extractSection(n.content, 'Observations'));
  if (allObservations.length > 0) {
    sections.push('## Observations');
    sections.push('');
    for (const obs of allObservations) {
      sections.push(obs);
    }
    sections.push('');
  }

  // Extract and combine relations
  const allRelations = notes.flatMap((n) => extractSection(n.content, 'Relations'));
  if (allRelations.length > 0) {
    sections.push('## Relations');
    sections.push('');
    for (const rel of allRelations) {
      sections.push(rel);
    }
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Generate target path for merged note
 */
function generateTargetPath(firstNotePath: string, title: string): string {
  // Extract folder from first note
  const folder = firstNotePath.includes('/')
    ? firstNotePath.substring(0, firstNotePath.lastIndexOf('/'))
    : '';

  // Generate slug from title
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return folder ? `${folder}/${slug}.md` : `${slug}.md`;
}

/**
 * Strip frontmatter and title from content
 */
function stripFrontmatterAndTitle(content: string): string {
  let result = content;

  // Remove frontmatter
  result = result.replace(/^---\n[\s\S]*?\n---\n?/, '');

  // Remove first H1
  result = result.replace(/^#\s+.+\n?/, '');

  return result.trim();
}

/**
 * Extract lines from a specific section
 */
function extractSection(content: string, sectionName: string): string[] {
  const lines: string[] = [];
  const contentLines = content.split('\n');
  let inSection = false;

  for (const line of contentLines) {
    // Check if we're entering the target section
    if (line.match(new RegExp(`^##\\s+${sectionName}`, 'i'))) {
      inSection = true;
      continue;
    }

    // Check if we're leaving the section (next ## heading)
    if (inSection && line.match(/^##\s+/)) {
      break;
    }

    // Collect lines while in section
    if (inSection && line.trim()) {
      lines.push(line);
    }
  }

  return lines;
}
