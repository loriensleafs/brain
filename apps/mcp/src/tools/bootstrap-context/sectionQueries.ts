/**
 * Section query utilities for bootstrap_context tool
 *
 * Implements queries for each context section:
 * - Recent activity
 * - Active features (including phases and tasks)
 * - Recent decisions
 * - Open bugs
 *
 * All queries use note type detection and status parsing.
 */

import { getBasicMemoryClient } from "../../proxy/client";
import { detectNoteType, type NoteType } from "./noteType";
import { parseStatus, isOpenStatus, type NoteStatus } from "./statusParser";

/**
 * Common note structure returned from queries
 */
export interface ContextNote {
  title: string;
  permalink: string;
  type: NoteType;
  status: NoteStatus;
  content?: string;
  updatedAt?: string;
  file_path?: string;
}

/**
 * Query options shared across section queries
 */
export interface QueryOptions {
  project: string;
  timeframe?: string;
}

/**
 * Result from basic-memory search/activity tools
 */
interface BasicMemoryNote {
  title?: string;
  permalink?: string;
  entity?: string;
  file_path?: string;
  content?: string;
  type?: string; // basic-memory type: "entity", "relation", "observation"
  metadata?: {
    entity_type?: string;
    [key: string]: unknown;
  };
}

interface BasicMemoryResult {
  result?: {
    results?: BasicMemoryNote[];
  };
  content?: Array<{ type: string; text: string }>;
}

/**
 * Query recent activity (notes updated within timeframe)
 * Uses search_notes with after_date filter since recent_activity returns markdown
 */
export async function queryRecentActivity(
  options: QueryOptions
): Promise<ContextNote[]> {
  const { project, timeframe = "5d" } = options;
  const client = await getBasicMemoryClient();

  // Use search_notes with after_date instead of recent_activity (which returns markdown)
  const result = (await client.callTool({
    name: "search_notes",
    arguments: {
      project,
      query: "*",
      after_date: getDateFromTimeframe(timeframe),
      page_size: 50,
    },
  })) as BasicMemoryResult;

  const notes = parseAndEnrichNotes(result);

  // Filter to entity types only (exclude relations, observations)
  const filtered = notes.filter((note) => note.title && note.permalink);
  return dedupeByPermalink(filtered);
}

/**
 * Query active features, phases, and tasks
 * (type=feature/phase/task, status IN NOT_STARTED/IN_PROGRESS)
 */
export async function queryActiveFeatures(
  options: QueryOptions
): Promise<ContextNote[]> {
  const { project, timeframe = "30d" } = options;
  const client = await getBasicMemoryClient();

  // Search for feature/phase/task notes by type
  const result = (await client.callTool({
    name: "search_notes",
    arguments: {
      project,
      query: "Status",
      types: ["feature", "phase", "task"],
      after_date: getDateFromTimeframe(timeframe),
    },
  })) as BasicMemoryResult;

  const notes = parseAndEnrichNotes(result);

  // Filter to only notes in features/ folder with feature-related types and active statuses
  const featureTypes: NoteType[] = ["feature", "phase", "task"];
  const activeStatuses: NoteStatus[] = ["not_started", "in_progress", "active"];

  const filtered = notes.filter((note) => {
    // Must be in features/ folder (check both file_path and permalink)
    const inFeaturesFolder =
      note.file_path?.startsWith("features/") ||
      note.permalink.startsWith("features/");

    return (
      inFeaturesFolder &&
      featureTypes.includes(note.type) &&
      activeStatuses.includes(note.status)
    );
  });

  return dedupeByPermalink(filtered);
}

/**
 * Query recent decisions (type=decision, updated in timeframe)
 */
export async function queryRecentDecisions(
  options: QueryOptions
): Promise<ContextNote[]> {
  const { project, timeframe = "3d" } = options;
  const client = await getBasicMemoryClient();

  // Search for decision notes
  const result = (await client.callTool({
    name: "search_notes",
    arguments: {
      project,
      query: "decision",
      types: ["decision"],
      after_date: getDateFromTimeframe(timeframe),
    },
  })) as BasicMemoryResult;

  const notes = parseAndEnrichNotes(result);

  // Filter to decision type only, in decisions/ folder
  const filtered = notes.filter((note) => {
    const inDecisionsFolder =
      note.file_path?.startsWith("decisions/") ||
      note.permalink.startsWith("decisions/");

    return inDecisionsFolder && note.type === "decision";
  });

  return dedupeByPermalink(filtered);
}

/**
 * Query open bugs (type=bug, status != CLOSED, updated in timeframe)
 */
export async function queryOpenBugs(
  options: QueryOptions
): Promise<ContextNote[]> {
  const { project, timeframe = "7d" } = options;
  const client = await getBasicMemoryClient();

  // Search for bug notes
  const result = (await client.callTool({
    name: "search_notes",
    arguments: {
      project,
      query: "bug",
      types: ["bug"],
      after_date: getDateFromTimeframe(timeframe),
    },
  })) as BasicMemoryResult;

  const notes = parseAndEnrichNotes(result);

  // Filter to bug type with open status, in bugs/ folder
  const filtered = notes.filter((note) => {
    const inBugsFolder =
      note.file_path?.startsWith("bugs/") || note.permalink.startsWith("bugs/");

    return inBugsFolder && note.type === "bug" && isOpenStatus(note.status);
  });

  return dedupeByPermalink(filtered);
}

/**
 * Deduplicate notes by permalink
 */
function dedupeByPermalink(notes: ContextNote[]): ContextNote[] {
  const seen = new Set<string>();
  return notes.filter((note) => {
    if (seen.has(note.permalink)) return false;
    seen.add(note.permalink);
    return true;
  });
}

/**
 * Parse basic-memory results and enrich with type/status detection
 */
function parseAndEnrichNotes(result: BasicMemoryResult): ContextNote[] {
  // Handle different response formats from basic-memory
  let rawNotes: BasicMemoryNote[] = [];

  if (result.result?.results) {
    rawNotes = result.result.results;
  } else if (result.content?.[0]?.text) {
    // Try to parse JSON from text content
    try {
      const parsed = JSON.parse(result.content[0].text);
      if (parsed.results) {
        // Direct results array (basic-memory format)
        rawNotes = parsed.results;
      } else if (parsed.result?.results) {
        // Nested under result (legacy format)
        rawNotes = parsed.result.results;
      } else if (Array.isArray(parsed)) {
        rawNotes = parsed;
      }
    } catch {
      // Not JSON, skip
    }
  }

  return (
    rawNotes
      // Only include entity results (not relations or observations)
      .filter(
        (note) => note.type === "entity" && (note.title || note.permalink)
      )
      .map((note) => {
        const title = note.title || note.permalink || "";
        const permalink = note.permalink || note.entity || "";
        const folder = permalink.split("/")[0] || "";

        // Detect type from frontmatter, folder, or title
        const type = detectNoteType(note.metadata?.entity_type, folder, title);

        // Parse status from content
        const status = parseStatus(note.content, title);

        return {
          title,
          permalink,
          type,
          status,
          content: note.content,
          file_path: note.file_path,
        };
      })
  );
}

/**
 * Convert timeframe string to ISO date string for filtering
 */
function getDateFromTimeframe(timeframe: string): string {
  const now = new Date();
  const match = timeframe.match(/^(\d+)([dhwm])$/);

  if (!match) {
    // Default to 7 days ago
    now.setDate(now.getDate() - 7);
    return now.toISOString().split("T")[0];
  }

  const [, amount, unit] = match;
  const num = parseInt(amount, 10);

  switch (unit) {
    case "d":
      now.setDate(now.getDate() - num);
      break;
    case "h":
      now.setHours(now.getHours() - num);
      break;
    case "w":
      now.setDate(now.getDate() - num * 7);
      break;
    case "m":
      now.setMonth(now.getMonth() - num);
      break;
  }

  return now.toISOString().split("T")[0];
}
