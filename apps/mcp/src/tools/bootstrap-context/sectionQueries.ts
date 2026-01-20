/**
 * Section query utilities for bootstrap_context tool
 *
 * Implements queries for each context section:
 * - Recent activity
 * - Active features (including phases and tasks)
 * - Recent decisions
 * - Open bugs
 *
 * All queries use SearchService for semantic search with
 * note type detection and status parsing for filtering.
 *
 * @see ADR-001: Search Service Abstraction
 */

import { getSearchService, type SearchResult } from "../../services/search";
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
 * Get the shared SearchService instance.
 */
function getSearch() {
  return getSearchService();
}

/**
 * Query recent activity (notes updated within timeframe)
 * Uses semantic search for better relevance of recent notes.
 */
export async function queryRecentActivity(
  options: QueryOptions
): Promise<ContextNote[]> {
  const { project, timeframe = "5d" } = options;
  const search = getSearch();

  // Search for recent activity using semantic search with broad query
  const response = await search.search("recent changes updates activity", {
    project,
    limit: 50,
    mode: "auto",
    afterDate: getDateFromTimeframe(timeframe),
    fullContent: true,
  });

  const notes = convertSearchResultsToContextNotes(response.results);

  // Filter to entity types only (exclude relations, observations)
  const filtered = notes.filter((note) => note.title && note.permalink);
  return dedupeByPermalink(filtered);
}

/**
 * Query active features, phases, and tasks
 * Uses semantic search for feature-related content.
 * (type=feature/phase/task, status IN NOT_STARTED/IN_PROGRESS)
 */
export async function queryActiveFeatures(
  options: QueryOptions
): Promise<ContextNote[]> {
  const { project, timeframe = "30d" } = options;
  const search = getSearch();

  // Search for feature/phase/task notes using semantic search
  const response = await search.search("feature phase task status in progress active", {
    project,
    limit: 50,
    mode: "auto",
    folders: ["features/"],
    afterDate: getDateFromTimeframe(timeframe),
    fullContent: true,
  });

  const notes = convertSearchResultsToContextNotes(response.results);

  // Filter to only notes with feature-related types and active statuses
  const featureTypes: NoteType[] = ["feature", "phase", "task"];
  const activeStatuses: NoteStatus[] = ["not_started", "in_progress", "active"];

  const filtered = notes.filter((note) => {
    return (
      featureTypes.includes(note.type) &&
      activeStatuses.includes(note.status)
    );
  });

  return dedupeByPermalink(filtered);
}

/**
 * Query recent decisions (type=decision, updated in timeframe)
 * Uses semantic search for decision-related content.
 */
export async function queryRecentDecisions(
  options: QueryOptions
): Promise<ContextNote[]> {
  const { project, timeframe = "3d" } = options;
  const search = getSearch();

  // Search for decision notes using semantic search
  const response = await search.search("decision architecture ADR technical choice rationale", {
    project,
    limit: 30,
    mode: "auto",
    folders: ["decisions/"],
    afterDate: getDateFromTimeframe(timeframe),
    fullContent: true,
  });

  const notes = convertSearchResultsToContextNotes(response.results);

  // Filter to decision type only
  const filtered = notes.filter((note) => note.type === "decision");

  return dedupeByPermalink(filtered);
}

/**
 * Query open bugs (type=bug, status != CLOSED, updated in timeframe)
 * Uses semantic search for bug-related content.
 */
export async function queryOpenBugs(
  options: QueryOptions
): Promise<ContextNote[]> {
  const { project, timeframe = "7d" } = options;
  const search = getSearch();

  // Search for bug notes using semantic search
  const response = await search.search("bug issue defect error problem fix", {
    project,
    limit: 30,
    mode: "auto",
    folders: ["bugs/"],
    afterDate: getDateFromTimeframe(timeframe),
    fullContent: true,
  });

  const notes = convertSearchResultsToContextNotes(response.results);

  // Filter to bug type with open status
  const filtered = notes.filter((note) => {
    return note.type === "bug" && isOpenStatus(note.status);
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
 * Convert SearchService results to ContextNote format with type/status enrichment.
 * Uses fullContent when available, falling back to snippet.
 */
function convertSearchResultsToContextNotes(results: SearchResult[]): ContextNote[] {
  return results
    .filter((result) => result.title && result.permalink)
    .map((result) => {
      const folder = result.permalink.split("/")[0] || "";

      // Detect type from folder or title (no frontmatter available from search)
      const type = detectNoteType(undefined, folder, result.title);

      // Parse status from full content or snippet
      const contentForParsing = result.fullContent || result.snippet;
      const status = parseStatus(contentForParsing, result.title);

      return {
        title: result.title,
        permalink: result.permalink,
        type,
        status,
        content: result.fullContent || result.snippet,
        file_path: result.permalink,
      };
    });
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
