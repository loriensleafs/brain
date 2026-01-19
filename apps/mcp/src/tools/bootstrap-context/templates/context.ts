/**
 * Main context template
 *
 * Renders the complete bootstrap context with all sections.
 */

import type { ContextNote } from "../sectionQueries";

export interface ContextData {
  project: string;
  timestamp: string;
  activeFeatures: ContextNote[];
  recentDecisions: ContextNote[];
  openBugs: ContextNote[];
  recentActivity: ContextNote[];
  referencedNotes: ContextNote[];
}

/**
 * Render the full context markdown output
 */
export function renderContext(data: ContextData): string {
  const sections: string[] = [];

  // Header
  sections.push(renderHeader(data.project, data.timestamp));

  // Active Features (if any)
  if (data.activeFeatures.length > 0) {
    sections.push(renderFeaturesBlock(data.activeFeatures));
  }

  // Recent Decisions (if any)
  if (data.recentDecisions.length > 0) {
    sections.push(renderDecisionsBlock(data.recentDecisions));
  }

  // Open Bugs (if any)
  if (data.openBugs.length > 0) {
    sections.push(renderBugsBlock(data.openBugs));
  }

  // Recent Activity (if any)
  if (data.recentActivity.length > 0) {
    sections.push(renderActivityBlock(data.recentActivity));
  }

  // Referenced Notes (if any)
  if (data.referencedNotes.length > 0) {
    sections.push(renderReferencedBlock(data.referencedNotes));
  }

  return sections.join("\n\n");
}

function renderHeader(project: string, timestamp: string): string {
  return `## Memory Context [v6]

**Project:** ${project}
**Retrieved:** ${timestamp}`;
}

function renderFeaturesBlock(features: ContextNote[]): string {
  const lines = features.map((f) => {
    const statusBadge = getStatusBadge(f.status);
    return `- ${statusBadge} [[${f.title}]]`;
  });

  return `### Active Features

${lines.join("\n")}`;
}

function renderDecisionsBlock(decisions: ContextNote[]): string {
  const lines = decisions.map((d) => `- [[${d.title}]]`);

  return `### Recent Decisions

${lines.join("\n")}`;
}

function renderBugsBlock(bugs: ContextNote[]): string {
  const lines = bugs.map((b) => {
    const statusBadge = getStatusBadge(b.status);
    return `- ${statusBadge} [[${b.title}]]`;
  });

  return `### Open Bugs

${lines.join("\n")}`;
}

function renderActivityBlock(activity: ContextNote[]): string {
  const lines = activity.slice(0, 10).map((a) => `- [[${a.title}]]`);

  return `### Recent Activity

${lines.join("\n")}`;
}

function renderReferencedBlock(notes: ContextNote[]): string {
  const lines = notes.map((n) => `- [[${n.title}]] (${n.type})`);

  return `### Referenced Notes

${lines.join("\n")}`;
}

function getStatusBadge(status: string): string {
  switch (status) {
    case "not_started":
      return "○";
    case "in_progress":
      return "◐";
    case "complete":
      return "●";
    case "blocked":
      return "⊘";
    case "closed":
      return "✓";
    default:
      return "·";
  }
}
