/**
 * Decisions section template
 *
 * Renders recent decisions.
 */

export interface DecisionData {
  title: string;
  permalink: string;
  updatedAt?: string;
}

/**
 * Render decisions section
 */
export function renderDecisionsSection(decisions: DecisionData[]): string {
  if (decisions.length === 0) {
    return "";
  }

  const lines: string[] = ["### Recent Decisions", ""];

  for (const decision of decisions) {
    const date = decision.updatedAt ? ` (${formatDate(decision.updatedAt)})` : "";
    lines.push(`- [[${decision.title}]]${date}`);
  }

  return lines.join("\n");
}

function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}
