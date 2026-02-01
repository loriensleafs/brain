#!/usr/bin/env bun
/**
 * Extract-SessionEpisode.ts
 *
 * Parses session log markdown files and extracts structured episode data
 * for the reflexion memory system per ADR-038.
 *
 * Extraction targets:
 * - Session metadata (date, objectives, status)
 * - Decisions made during the session
 * - Events (commits, errors, milestones)
 * - Metrics (duration, file counts)
 * - Lessons learned
 *
 * Resolves project paths from Brain MCP config (~/.basic-memory/config.json)
 * and writes episode files directly to the project's episodes folder.
 *
 * Usage:
 *   bun run extract-episode.ts <session-log-path> [--force] [--project <name>]
 *
 * Example:
 *   bun run extract-episode.ts .agents/sessions/2026-01-20-session-06.md --project brain
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { basename, join } from "path";
import { parseArgs } from "util";
import { getProjectMemoriesPath } from "@brain/utils";

// Types
interface Decision {
  id: string;
  timestamp: string;
  type: "design" | "implementation" | "test" | "recovery" | "routing";
  context: string;
  chosen: string;
  rationale: string;
  outcome: "success" | "partial" | "failure";
  effects: string[];
}

interface Event {
  id: string;
  timestamp: string;
  type: "commit" | "error" | "milestone" | "test" | "handoff" | "tool_call";
  content: string;
  caused_by: string[];
  leads_to: string[];
}

interface Metrics {
  duration_minutes: number;
  tool_calls: number;
  errors: number;
  recoveries: number;
  commits: number;
  files_changed: number;
}

interface Metadata {
  title: string;
  date: string;
  status: string;
  objectives: string[];
  deliverables: string[];
}

interface Episode {
  id: string;
  session: string;
  timestamp: string;
  outcome: "success" | "partial" | "failure";
  task: string;
  decisions: Decision[];
  events: Event[];
  metrics: Metrics;
  lessons: string[];
}

// Helper Functions

function getSessionIdFromPath(filePath: string): string {
  const fileName = basename(filePath, ".md");

  // Pattern: YYYY-MM-DD-session-NNN or session-NNN-description
  const dateSessionMatch = fileName.match(/(\d{4}-\d{2}-\d{2}-session-\d+)/);
  if (dateSessionMatch) {
    return dateSessionMatch[1];
  }

  const sessionMatch = fileName.match(/(session-\d+)/);
  if (sessionMatch) {
    return sessionMatch[1];
  }

  return fileName;
}

function parseMetadata(lines: string[]): Metadata {
  const metadata: Metadata = {
    title: "",
    date: "",
    status: "",
    objectives: [],
    deliverables: [],
  };

  let inSection = "";

  for (const line of lines) {
    // Title (first H1)
    const titleMatch = line.match(/^#\s+(.+)$/);
    if (titleMatch && !metadata.title) {
      metadata.title = titleMatch[1];
      continue;
    }

    // Date field
    const dateMatch = line.match(/^\*\*Date\*\*:\s*(.+)$/);
    if (dateMatch) {
      metadata.date = dateMatch[1].trim();
      continue;
    }

    // Status field
    const statusMatch = line.match(/^\*\*Status\*\*:\s*(.+)$/);
    if (statusMatch) {
      metadata.status = statusMatch[1].trim();
      continue;
    }

    // Objectives section
    if (/^##\s*Objectives?/i.test(line)) {
      inSection = "objectives";
      continue;
    }

    // Deliverables section
    if (/^##\s*Deliverables?/i.test(line)) {
      inSection = "deliverables";
      continue;
    }

    // New section ends current
    if (/^##\s/.test(line)) {
      inSection = "";
      continue;
    }

    // Collect list items
    const listMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (listMatch) {
      const item = listMatch[1].trim();
      if (inSection === "objectives") {
        metadata.objectives.push(item);
      } else if (inSection === "deliverables") {
        metadata.deliverables.push(item);
      }
    }
  }

  return metadata;
}

function getDecisionType(
  text: string
): "design" | "implementation" | "test" | "recovery" | "routing" {
  const textLower = text.toLowerCase();

  if (/design|architect|schema|structure/.test(textLower)) {
    return "design";
  }
  if (/test|pester|coverage|assert|pytest/.test(textLower)) {
    return "test";
  }
  if (/recover|fix|retry|fallback/.test(textLower)) {
    return "recovery";
  }
  if (/route|delegate|agent|handoff/.test(textLower)) {
    return "routing";
  }
  return "implementation";
}

function parseDecisions(lines: string[]): Decision[] {
  const decisions: Decision[] = [];
  let decisionIndex = 0;
  let inDecisionSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for decision markers
    if (/^##\s*Decisions?/i.test(line)) {
      inDecisionSection = true;
      continue;
    }

    if (inDecisionSection && /^##\s/.test(line)) {
      inDecisionSection = false;
    }

    // Decision patterns in various formats
    const explicitDecision = line.match(/^\*\*Decision\*\*:\s*(.+)$/);
    const simpleDecision = line.match(/^Decision:\s*(.+)$/);
    const sectionDecision =
      inDecisionSection && line.match(/^\s*[-*]\s+\*\*(.+?)\*\*:\s*(.+)$/);

    if (explicitDecision || simpleDecision || sectionDecision) {
      decisionIndex++;
      let decisionText: string;

      if (sectionDecision) {
        decisionText = `${sectionDecision[1]}: ${sectionDecision[2]}`;
      } else {
        decisionText = (explicitDecision || simpleDecision)![1];
      }

      const decision: Decision = {
        id: `d${String(decisionIndex).padStart(3, "0")}`,
        timestamp: new Date().toISOString(),
        type: getDecisionType(decisionText),
        context: "",
        chosen: decisionText,
        rationale: "",
        outcome: "success",
        effects: [],
      };

      // Look for context in previous line
      if (i > 0) {
        const prevMatch = lines[i - 1].match(/^\s*[-*]\s+(.+)$/);
        if (prevMatch) {
          decision.context = prevMatch[1];
        }
      }

      decisions.push(decision);
    }

    // Also capture decisions from work log entries
    if (
      /chose|decided|selected|opted for/i.test(line) &&
      !/^#/.test(line) &&
      !decisions.some((d) => d.chosen === line.trim())
    ) {
      decisionIndex++;
      decisions.push({
        id: `d${String(decisionIndex).padStart(3, "0")}`,
        timestamp: new Date().toISOString(),
        type: "implementation",
        context: "",
        chosen: line.trim(),
        rationale: "",
        outcome: "success",
        effects: [],
      });
    }
  }

  return decisions;
}

function parseEvents(lines: string[]): Event[] {
  const events: Event[] = [];
  let eventIndex = 0;
  const seenContent = new Set<string>();

  for (const line of lines) {
    let evt: Event | null = null;

    // Commit events
    const commitMatch =
      line.match(/commit[ted]?\s+(?:as\s+)?([a-f0-9]{7,40})/i) ||
      line.match(/([a-f0-9]{7,40})\s+\w+\(.+\):/);
    if (commitMatch) {
      const content = `Commit: ${commitMatch[1]}`;
      if (!seenContent.has(content)) {
        eventIndex++;
        evt = {
          id: `e${String(eventIndex).padStart(3, "0")}`,
          timestamp: new Date().toISOString(),
          type: "commit",
          content,
          caused_by: [],
          leads_to: [],
        };
        seenContent.add(content);
      }
    }

    // Error events
    if (/error|fail|exception/i.test(line) && !/^#/.test(line)) {
      const content = line.trim();
      if (!seenContent.has(content)) {
        eventIndex++;
        evt = {
          id: `e${String(eventIndex).padStart(3, "0")}`,
          timestamp: new Date().toISOString(),
          type: "error",
          content,
          caused_by: [],
          leads_to: [],
        };
        seenContent.add(content);
      }
    }

    // Milestone events (check mark emoji or completion words)
    if (
      (/\u2705|completed?|done|finished|success/i.test(line) &&
        /^[-*]/.test(line)) ||
      /\[x\]/i.test(line)
    ) {
      const content = line.trim().replace(/^[-*]\s*/, "");
      if (!seenContent.has(content)) {
        eventIndex++;
        evt = {
          id: `e${String(eventIndex).padStart(3, "0")}`,
          timestamp: new Date().toISOString(),
          type: "milestone",
          content,
          caused_by: [],
          leads_to: [],
        };
        seenContent.add(content);
      }
    }

    // Test events
    if (/test[s]?\s+(pass|fail|run)/i.test(line) || /Pester|pytest/i.test(line)) {
      const content = line.trim();
      if (!seenContent.has(content)) {
        eventIndex++;
        evt = {
          id: `e${String(eventIndex).padStart(3, "0")}`,
          timestamp: new Date().toISOString(),
          type: "test",
          content,
          caused_by: [],
          leads_to: [],
        };
        seenContent.add(content);
      }
    }

    if (evt) {
      events.push(evt);
    }
  }

  return events;
}

function parseLessons(lines: string[]): string[] {
  const lessons: string[] = [];
  let inLessonsSection = false;
  const seen = new Set<string>();

  for (const line of lines) {
    // Lessons section header
    if (/^##\s*(Lessons?\s*Learned?|Key\s*Learnings?|Takeaways?)/i.test(line)) {
      inLessonsSection = true;
      continue;
    }

    // New section ends lessons
    if (inLessonsSection && /^##\s/.test(line)) {
      inLessonsSection = false;
    }

    // Collect lesson items
    if (inLessonsSection) {
      const listMatch = line.match(/^\s*[-*]\s+(.+)$/);
      if (listMatch) {
        const lesson = listMatch[1].trim();
        if (!seen.has(lesson)) {
          lessons.push(lesson);
          seen.add(lesson);
        }
      }
    }

    // Also capture inline lessons
    if (
      /lesson|learned|takeaway|note for future/i.test(line) &&
      !/^#/.test(line)
    ) {
      const lesson = line.trim();
      if (!seen.has(lesson)) {
        lessons.push(lesson);
        seen.add(lesson);
      }
    }
  }

  return lessons;
}

function parseMetrics(lines: string[]): Metrics {
  const metrics: Metrics = {
    duration_minutes: 0,
    tool_calls: 0,
    errors: 0,
    recoveries: 0,
    commits: 0,
    files_changed: 0,
  };

  for (const line of lines) {
    // Duration
    const durationMatch =
      line.match(/(\d+)\s*minutes?/i) || line.match(/duration:\s*(\d+)/i);
    if (durationMatch) {
      metrics.duration_minutes = parseInt(durationMatch[1], 10);
    }

    // Count commits
    if (/[a-f0-9]{7,40}/.test(line)) {
      metrics.commits++;
    }

    // Count errors
    if (/error|fail|exception/i.test(line) && !/^#/.test(line)) {
      metrics.errors++;
    }

    // Count files
    const filesMatch = line.match(/(\d+)\s+files?\s+(changed|modified|created)/i);
    if (filesMatch) {
      metrics.files_changed += parseInt(filesMatch[1], 10);
    }
  }

  return metrics;
}

function getSessionOutcome(
  metadata: Metadata,
  events: Event[]
): "success" | "partial" | "failure" {
  const status = metadata.status?.toLowerCase() || "";

  if (/complete|done|success/.test(status)) {
    return "success";
  }
  if (/partial|in.?progress|blocked/.test(status)) {
    return "partial";
  }
  if (/fail|abort|error/.test(status)) {
    return "failure";
  }

  // Infer from events
  const errorCount = events.filter((e) => e.type === "error").length;
  const milestoneCount = events.filter((e) => e.type === "milestone").length;

  if (errorCount > milestoneCount) {
    return "failure";
  }
  if (milestoneCount > 0) {
    return "success";
  }

  return "partial";
}

function loadTemplate(): string {
  const templatePath = join(
    import.meta.dir,
    "..",
    "templates",
    "episode-template.md"
  );
  try {
    return readFileSync(templatePath, "utf-8");
  } catch {
    // Fallback template
    return `---
title: EPISODE-{{session_id}}
type: episode
tags: [episode, {{outcome}}, session-log]
session_id: {{session_id}}
outcome: {{outcome}}
task: {{task}}
date: {{date}}
metrics:
  decisions_made: {{decisions_made}}
  errors_encountered: {{errors_encountered}}
  commits: {{commits}}
  files_changed: {{files_changed}}
  duration_minutes: {{duration_minutes}}
---

# Episode: {{session_id}}

**Task**: {{task}}
**Outcome**: {{outcome}}
**Date**: {{date}}

## Metrics

| Metric | Value |
|--------|-------|
| Duration (minutes) | {{duration_minutes}} |
| Decisions | {{decisions_made}} |
| Errors | {{errors_encountered}} |
| Commits | {{commits}} |
| Files Changed | {{files_changed}} |

## Observations

{{observations}}

## Decisions

{{decisions}}

## Events Timeline

{{events}}

## Lessons Learned

{{lessons}}

## Relations

- part_of [[sessions/{{session_id}}]]
{{relations}}
`;
  }
}

function formatDecisions(decisions: Decision[]): string {
  if (decisions.length === 0) {
    return "- No decisions recorded";
  }

  return decisions
    .map(
      (d) =>
        `- **${d.id}** [${d.type}]: ${d.chosen}${d.context ? ` (context: ${d.context})` : ""}`
    )
    .join("\n");
}

function formatEvents(events: Event[]): string {
  if (events.length === 0) {
    return "- No events recorded";
  }

  return events.map((e) => `- **${e.id}** [${e.type}]: ${e.content}`).join("\n");
}

function formatLessons(lessons: string[]): string {
  if (lessons.length === 0) {
    return "- No lessons recorded";
  }

  return lessons.map((l) => `- ${l}`).join("\n");
}

function formatObservations(
  decisions: Decision[],
  events: Event[],
  lessons: string[]
): string {
  const observations: string[] = [];

  // Add decision observations
  for (const d of decisions) {
    observations.push(`- [decision] ${d.chosen} #${d.type}`);
  }

  // Add milestone observations
  for (const e of events.filter((e) => e.type === "milestone")) {
    observations.push(`- [fact] ${e.content} #milestone`);
  }

  // Add lesson observations
  for (const l of lessons) {
    observations.push(`- [insight] ${l} #lesson`);
  }

  return observations.length > 0
    ? observations.join("\n")
    : "- No observations extracted";
}

function renderTemplate(episode: Episode, template: string): string {
  const replacements: Record<string, string> = {
    "{{session_id}}": episode.session,
    "{{outcome}}": episode.outcome,
    "{{task}}": episode.task,
    "{{date}}": episode.timestamp.split("T")[0],
    "{{agents_used}}": "0", // Not tracked in session logs
    "{{decisions_made}}": String(episode.decisions.length),
    "{{errors_encountered}}": String(episode.metrics.errors),
    "{{commits}}": String(episode.metrics.commits),
    "{{files_changed}}": String(episode.metrics.files_changed),
    "{{duration_minutes}}": String(episode.metrics.duration_minutes),
    "{{observations}}": formatObservations(
      episode.decisions,
      episode.events,
      episode.lessons
    ),
    "{{decisions}}": formatDecisions(episode.decisions),
    "{{events}}": formatEvents(episode.events),
    "{{lessons}}": formatLessons(episode.lessons),
    "{{relations}}": "", // Additional relations can be added manually
  };

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(key, value);
  }

  return result;
}

// Main Execution

async function main(): Promise<void> {
  const args = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      force: {
        type: "boolean",
        short: "f",
        default: false,
      },
      project: {
        type: "string",
        short: "p",
        default: "brain",
      },
      help: {
        type: "boolean",
        short: "h",
        default: false,
      },
    },
    allowPositionals: true,
  });

  if (args.values.help || args.positionals.length === 0) {
    console.log(`
Usage: bun run extract-episode.ts <session-log-path> [options]

Options:
  -f, --force          Overwrite existing episode file
  -p, --project NAME   Brain project name (default: brain)
  -h, --help           Show this help message

Example:
  bun run extract-episode.ts .agents/sessions/2026-01-20-session-06.md --project brain

Resolves project paths from ~/.basic-memory/config.json and writes episode
files directly to the project's episodes folder as EPISODE-{session-id}.md.
`);
    process.exit(args.values.help ? 0 : 1);
  }

  const sessionLogPath = args.positionals[0];
  const project = args.values.project ?? "brain";

  // Validate input file
  if (!existsSync(sessionLogPath)) {
    console.error(`Error: Session log not found: ${sessionLogPath}`);
    process.exit(1);
  }

  console.log(`Extracting episode from: ${sessionLogPath}`);

  // Read session log
  const content = readFileSync(sessionLogPath, "utf-8");
  const lines = content.split("\n");
  const sessionId = getSessionIdFromPath(sessionLogPath);

  // Parse components
  console.log("  Parsing metadata...");
  const metadata = parseMetadata(lines);

  console.log("  Parsing decisions...");
  const decisions = parseDecisions(lines);

  console.log("  Parsing events...");
  const events = parseEvents(lines);

  console.log("  Parsing lessons...");
  const lessons = parseLessons(lines);

  console.log("  Parsing metrics...");
  const metrics = parseMetrics(lines);

  // Determine outcome
  const outcome = getSessionOutcome(metadata, events);

  // Parse timestamp
  let timestamp: string;
  if (metadata.date) {
    try {
      timestamp = new Date(metadata.date).toISOString();
    } catch {
      console.warn(
        `Warning: Could not parse date '${metadata.date}', using current time`
      );
      timestamp = new Date().toISOString();
    }
  } else {
    timestamp = new Date().toISOString();
  }

  // Build episode
  const episode: Episode = {
    id: `EPISODE-${sessionId}`,
    session: sessionId,
    timestamp,
    outcome,
    task:
      metadata.objectives.length > 0 ? metadata.objectives[0] : metadata.title,
    decisions,
    events,
    metrics,
    lessons,
  };

  // Generate markdown from template
  const template = loadTemplate();
  const markdown = renderTemplate(episode, template);

  // Resolve project path and write episode file directly
  let memoriesPath: string;
  try {
    memoriesPath = await getProjectMemoriesPath(project);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const episodesDir = join(memoriesPath, "episodes");
  const episodeFileName = `EPISODE-${sessionId}.md`;
  const episodePath = join(episodesDir, episodeFileName);

  // Ensure episodes directory exists
  mkdirSync(episodesDir, { recursive: true });

  // Check for existing file unless --force
  if (existsSync(episodePath) && !args.values.force) {
    console.error(`Error: Episode file already exists: ${episodePath}`);
    console.error("Use --force to overwrite");
    process.exit(1);
  }

  console.log(`  Writing to ${episodePath}...`);
  writeFileSync(episodePath, markdown, "utf-8");

  // Summary
  console.log(`
Episode extracted:
  ID:        ${episode.id}
  Session:   ${sessionId}
  Outcome:   ${outcome}
  Decisions: ${decisions.length}
  Events:    ${events.length}
  Lessons:   ${lessons.length}
  Path:      ${episodePath}
`);
}

main();
