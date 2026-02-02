/**
 * SET_PRIORITY operation for backlog mode
 *
 * Updates a feature's priority value in frontmatter.
 * Lower priority number = higher priority (processed first).
 */

import { getBasicMemoryClient } from "../../../proxy/client";

/**
 * Result from setting priority
 */
export interface SetPriorityResult {
  success: boolean;
  feature: string;
  oldPriority?: number;
  newPriority: number;
  error?: string;
}

/**
 * Update a feature's priority value
 */
export async function setPriority(
  project: string,
  featureId: string,
  newPriority: number,
): Promise<SetPriorityResult> {
  try {
    const client = await getBasicMemoryClient();

    // Read current note to get old priority
    const readResult = await client.callTool({
      name: "read_note",
      arguments: { identifier: featureId, project },
    });

    const content =
      (readResult.content as Array<{ type: string; text?: string }> | undefined)?.[0]?.text || "";
    const oldPriority = extractPriority(content);

    // Update priority in frontmatter
    const updatedContent = updatePriorityInContent(content, newPriority);

    // Write back the note
    await client.callTool({
      name: "write_note",
      arguments: {
        path: featureId,
        project,
        content: updatedContent,
      },
    });

    return {
      success: true,
      feature: featureId,
      oldPriority,
      newPriority,
    };
  } catch (error) {
    return {
      success: false,
      feature: featureId,
      newPriority,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract priority from frontmatter
 */
function extractPriority(content: string): number | undefined {
  const match = content.match(/^priority:\s*(\d+)/m);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Update or add priority field in frontmatter
 */
function updatePriorityInContent(content: string, priority: number): string {
  const lines = content.split("\n");

  // Check if content has frontmatter
  if (lines[0] !== "---") {
    // No frontmatter, add it
    return `---\npriority: ${priority}\n---\n${content}`;
  }

  // Find end of frontmatter
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    // Malformed frontmatter, add priority at top
    return `---\npriority: ${priority}\n---\n${content}`;
  }

  // Check if priority already exists in frontmatter
  let priorityFound = false;
  for (let i = 1; i < endIndex; i++) {
    if (lines[i].match(/^priority:/)) {
      lines[i] = `priority: ${priority}`;
      priorityFound = true;
      break;
    }
  }

  // If priority field not found, add it after first line
  if (!priorityFound) {
    lines.splice(1, 0, `priority: ${priority}`);
  }

  return lines.join("\n");
}
