/**
 * Main context template
 *
 * Renders the complete bootstrap context with all sections.
 */

import type { ContextNote, OpenSession } from "../sectionQueries";
import type { SessionEnrichment } from "../sessionEnrichment";

export interface ContextData {
  project: string;
  timestamp: string;
  openSessions: OpenSession[];
  activeFeatures: ContextNote[];
  recentDecisions: ContextNote[];
  openBugs: ContextNote[];
  recentActivity: ContextNote[];
  referencedNotes: ContextNote[];
  sessionEnrichment?: SessionEnrichment;
  /**
   * When true, includes full note content for features, decisions, and activity.
   * Default (false) returns compact wikilink references only.
   */
  fullContent?: boolean;
}

/**
 * Render the full context markdown output
 */
export function renderContext(data: ContextData): string {
  const sections: string[] = [];
  const fullContent = data.fullContent ?? false;

  // Header
  sections.push(renderHeader(data.project, data.timestamp, fullContent));

  // Session Context (if available) - renders first as it provides current focus
  if (data.sessionEnrichment) {
    sections.push(renderSessionBlock(data.sessionEnrichment));
  }

  // Open Sessions (if any) - shows sessions that need to be resumed
  if (data.openSessions.length > 0) {
    sections.push(renderOpenSessionsBlock(data.openSessions));
  }

  // Active Features (if any) - expanded with full content
  if (data.activeFeatures.length > 0) {
    sections.push(renderFeaturesBlock(data.activeFeatures, fullContent));
  }

  // Recent Decisions (if any) - expanded with full content
  if (data.recentDecisions.length > 0) {
    sections.push(renderDecisionsBlock(data.recentDecisions, fullContent));
  }

  // Open Bugs (if any) - always compact (wikilinks only)
  if (data.openBugs.length > 0) {
    sections.push(renderBugsBlock(data.openBugs));
  }

  // Recent Activity (if any) - expanded with full content
  if (data.recentActivity.length > 0) {
    sections.push(renderActivityBlock(data.recentActivity, fullContent));
  }

  // Referenced Notes (if any) - always compact (wikilinks only)
  if (data.referencedNotes.length > 0) {
    sections.push(renderReferencedBlock(data.referencedNotes));
  }

  return sections.join("\n\n");
}

function renderHeader(project: string, timestamp: string, fullContent: boolean): string {
  const modeIndicator = fullContent ? " (Full)" : "";
  return `## Memory Context [v7]${modeIndicator}

**Project:** ${project}
**Retrieved:** ${timestamp}`;
}

function renderOpenSessionsBlock(sessions: OpenSession[]): string {
  const lines: string[] = [];

  lines.push("### Open Sessions");
  lines.push("");
  lines.push("Sessions with work in progress that may need to be resumed:");
  lines.push("");

  sessions.forEach((session) => {
    const branchInfo = session.branch ? ` (branch: \`${session.branch}\`)` : "";
    lines.push(`- [[${session.title}]]${branchInfo}`);
  });

  return lines.join("\n");
}

function renderSessionBlock(session: SessionEnrichment): string {
  const { sessionState, taskNotes, featureNotes, recentAgentHistory } = session;
  const lines: string[] = [];

  lines.push("### Session State");
  lines.push("");
  lines.push(`**Mode:** ${sessionState.currentMode}`);

  if (sessionState.activeFeature) {
    lines.push(`**Active Feature:** ${sessionState.activeFeature}`);
  }

  if (sessionState.activeTask) {
    lines.push(`**Active Task:** ${sessionState.activeTask}`);
  }

  // Orchestrator workflow info
  const workflow = sessionState.orchestratorWorkflow;
  if (workflow) {
    lines.push(`**Workflow Phase:** ${workflow.workflowPhase}`);
    if (workflow.activeAgent) {
      lines.push(`**Active Agent:** ${workflow.activeAgent}`);
    }
  }

  // Task-related notes (if any)
  if (taskNotes.length > 0) {
    lines.push("");
    lines.push("**Task Context:**");
    taskNotes.slice(0, 5).forEach((note) => {
      lines.push(`- [[${note.title}]]`);
    });
  }

  // Feature-related notes (if any)
  if (featureNotes.length > 0) {
    lines.push("");
    lines.push("**Feature Context:**");
    featureNotes.slice(0, 5).forEach((note) => {
      lines.push(`- [[${note.title}]]`);
    });
  }

  // Recent agent history (if orchestrator workflow active)
  if (recentAgentHistory.length > 0) {
    lines.push("");
    lines.push("**Recent Agent Activity:**");
    recentAgentHistory.slice(0, 5).forEach((entry) => {
      const summary = entry.summary ? ` - ${entry.summary.slice(0, 50)}...` : "";
      lines.push(`- ${entry.agent} (${entry.status})${summary}`);
    });
  }

  return lines.join("\n");
}

function renderFeaturesBlock(features: ContextNote[], fullContent: boolean): string {
  if (fullContent) {
    // Full mode: include note content
    const sections = features.map((f) => {
      const statusBadge = getStatusBadge(f.status);
      const content = f.content?.trim() || "(No content available)";
      return `#### ${statusBadge} ${f.title}

${content}`;
    });

    return `### Active Features

${sections.join("\n\n")}`;
  }

  // Compact mode: wikilinks only
  const lines = features.map((f) => {
    const statusBadge = getStatusBadge(f.status);
    return `- ${statusBadge} [[${f.title}]]`;
  });

  return `### Active Features

${lines.join("\n")}`;
}

function renderDecisionsBlock(decisions: ContextNote[], fullContent: boolean): string {
  if (fullContent) {
    // Full mode: include note content
    const sections = decisions.map((d) => {
      const content = d.content?.trim() || "(No content available)";
      return `#### ${d.title}

${content}`;
    });

    return `### Recent Decisions

${sections.join("\n\n")}`;
  }

  // Compact mode: wikilinks only
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

function renderActivityBlock(activity: ContextNote[], fullContent: boolean): string {
  const limited = activity.slice(0, 10);

  if (fullContent) {
    // Full mode: include note content
    const sections = limited.map((a) => {
      const content = a.content?.trim() || "(No content available)";
      return `#### ${a.title}

${content}`;
    });

    return `### Recent Activity

${sections.join("\n\n")}`;
  }

  // Compact mode: wikilinks only
  const lines = limited.map((a) => `- [[${a.title}]]`);

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
