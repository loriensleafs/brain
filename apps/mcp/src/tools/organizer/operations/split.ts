/**
 * Split operation for note consolidation
 *
 * Breaks multi-topic notes into atomic notes, each covering a single topic.
 * Maintains observations and relations by distributing them to relevant splits.
 */

import { getBasicMemoryClient } from "../../../proxy/client";
import type { SplitCandidate, SplitResult } from "../types";

/**
 * Execute a split operation
 */
export async function executeSplit(
  candidate: SplitCandidate,
  project: string,
): Promise<SplitResult> {
  try {
    const client = await getBasicMemoryClient();

    // Read the note to split
    const readResult = await client.callTool({
      name: "read_note",
      arguments: { identifier: candidate.note, project },
    });

    const content =
      (readResult.content as Array<{ type: string; text?: string }> | undefined)?.[0]?.text || "";

    // Parse content into sections
    const sections = parseSections(content);

    // Extract frontmatter and shared content
    const frontmatter = extractFrontmatter(content);
    const observations = extractSection(content, "Observations");
    const relations = extractSection(content, "Relations");

    // Create individual notes for each topic
    const resultingNotes: string[] = [];

    for (const section of sections) {
      // Generate path for split note
      const targetPath = generateSplitNotePath(candidate.note, section.title);

      // Generate content for this split
      const splitContent = generateSplitContent(
        section,
        frontmatter,
        observations,
        relations,
        candidate.note,
      );

      // Create the note
      await client.callTool({
        name: "write_note",
        arguments: {
          path: targetPath,
          project,
          content: splitContent,
        },
      });

      resultingNotes.push(targetPath);
    }

    // Archive original note (placeholder)
    // TODO: Implement proper archiving in Phase 2

    return {
      success: true,
      resultingNotes,
      archivedNote: candidate.note,
    };
  } catch (error) {
    return {
      success: false,
      resultingNotes: [],
      archivedNote: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Section extracted from note
 */
interface Section {
  title: string;
  content: string;
  level: number;
}

/**
 * Parse note content into sections
 */
function parseSections(content: string): Section[] {
  const sections: Section[] = [];
  const lines = content.split("\n");
  let currentSection: Section | null = null;
  let inFrontmatter = false;
  let inSpecialSection = false;

  for (const line of lines) {
    // Skip frontmatter
    if (line.trim() === "---") {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) continue;

    // Check for section headers
    const headerMatch = line.match(/^(#{2,3})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();

      // Skip special sections (Observations, Relations, etc.)
      if (title.match(/^(Observations|Relations|Merged From|Context)$/i)) {
        inSpecialSection = true;
        if (currentSection) {
          sections.push(currentSection);
          currentSection = null;
        }
        continue;
      }

      inSpecialSection = false;

      // Start new section
      if (currentSection) {
        sections.push(currentSection);
      }

      currentSection = {
        title,
        content: "",
        level,
      };
    } else if (currentSection && !inSpecialSection) {
      // Add content to current section
      currentSection.content += `${line}\n`;
    }
  }

  // Add final section
  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Generate content for a split note
 */
function generateSplitContent(
  section: Section,
  frontmatter: string | null,
  observations: string[],
  relations: string[],
  originalNote: string,
): string {
  const parts: string[] = [];

  // Add frontmatter if present
  if (frontmatter) {
    parts.push(frontmatter);
    parts.push("");
  }

  // Add title
  parts.push(`# ${section.title}`);
  parts.push("");

  // Add split from reference
  parts.push("## Context");
  parts.push("");
  parts.push(`Split from: [[${originalNote}]]`);
  parts.push("");

  // Add section content
  parts.push("## Content");
  parts.push("");
  parts.push(section.content.trim());
  parts.push("");

  // Add relevant observations
  const relevantObs = observations.filter((obs) => isRelevantToSection(obs, section));
  if (relevantObs.length > 0) {
    parts.push("## Observations");
    parts.push("");
    for (const obs of relevantObs) {
      parts.push(obs);
    }
    parts.push("");
  }

  // Add relevant relations
  const relevantRels = relations.filter((rel) => isRelevantToSection(rel, section));
  if (relevantRels.length > 0) {
    parts.push("## Relations");
    parts.push("");
    for (const rel of relevantRels) {
      parts.push(rel);
    }
    parts.push("");
  }

  return parts.join("\n");
}

/**
 * Check if observation/relation is relevant to section
 */
function isRelevantToSection(text: string, section: Section): boolean {
  const sectionWords = section.title.toLowerCase().split(/\s+/);
  const textLower = text.toLowerCase();

  // Simple keyword matching - can be enhanced with LLM later
  return sectionWords.some((word) => word.length > 3 && textLower.includes(word));
}

/**
 * Generate path for split note
 */
function generateSplitNotePath(originalPath: string, sectionTitle: string): string {
  // Extract folder from original path
  const folder = originalPath.includes("/")
    ? originalPath.substring(0, originalPath.lastIndexOf("/"))
    : "";

  // Generate slug from section title
  const slug = sectionTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return folder ? `${folder}/${slug}.md` : `${slug}.md`;
}

/**
 * Extract frontmatter from content
 */
function extractFrontmatter(content: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? `---\n${match[1]}\n---` : null;
}

/**
 * Extract lines from a specific section
 */
function extractSection(content: string, sectionName: string): string[] {
  const lines: string[] = [];
  const contentLines = content.split("\n");
  let inSection = false;

  for (const line of contentLines) {
    // Check if we're entering the target section
    if (line.match(new RegExp(`^##\\s+${sectionName}`, "i"))) {
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
