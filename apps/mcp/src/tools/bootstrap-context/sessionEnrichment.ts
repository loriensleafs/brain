/**
 * Session-based context enrichment for bootstrap_context tool
 *
 * Provides additional context based on active session state:
 * - If activeTask: Search for task-related notes
 * - If activeFeature: Search for feature-related notes
 * - If orchestratorWorkflow: Include recent agent history
 *
 * Uses SearchService for semantic search to improve relevance.
 *
 * @see ADR-001: Search Service Abstraction
 */

import {
  getSearchService,
  type SearchResult as ServiceSearchResult,
} from "../../services/search";
import type { SessionState } from "../../services/session/types";
import { detectNoteType } from "./noteType";
import type { ContextNote } from "./sectionQueries";
import { parseStatus } from "./statusParser";

/**
 * Task note enriched from feature wikilinks
 */
export interface EnrichedTaskNote extends ContextNote {
  /** Task identifier extracted from wikilink */
  taskId: string;
}

/**
 * Feature note with its related task notes
 */
export interface FeatureWithTasks {
  /** The feature note */
  feature: ContextNote;
  /** Task notes referenced by this feature */
  tasks: EnrichedTaskNote[];
}

/**
 * Session context with enrichment notes
 */
export interface SessionEnrichment {
  /** Session state (may be default if no session exists) */
  sessionState: SessionState;
  /** Notes related to active task */
  taskNotes: ContextNote[];
  /** Notes related to active feature */
  featureNotes: ContextNote[];
  /** Features enriched with their task notes */
  featuresWithTasks: FeatureWithTasks[];
  /** Recent agent invocations (from orchestrator workflow) */
  recentAgentHistory: AgentHistorySummary[];
}

/**
 * Summary of agent invocation for display
 */
export interface AgentHistorySummary {
  agent: string;
  status: string;
  startedAt: string;
  summary?: string;
}

/**
 * Options for session enrichment
 */
export interface SessionEnrichmentOptions {
  project: string;
  sessionState: SessionState;
  maxTaskNotes?: number;
  maxFeatureNotes?: number;
  maxFeatureTasks?: number;
  maxAgentHistory?: number;
}

/**
 * Get the shared SearchService instance.
 */
function getSearch() {
  return getSearchService();
}

/**
 * Query notes related to active task using semantic search.
 */
async function queryTaskNotes(
  project: string,
  taskIdentifier: string,
  limit: number = 5,
): Promise<ContextNote[]> {
  const search = getSearch();

  // Use semantic search for task-related notes with full content
  const response = await search.search(taskIdentifier, {
    project,
    limit,
    mode: "auto",
    fullContent: true,
    depth: 2,
  });

  return convertSearchResultsToContextNotes(response.results);
}

/**
 * Query notes related to active feature using semantic search.
 */
async function queryFeatureNotes(
  project: string,
  featureIdentifier: string,
  limit: number = 10,
): Promise<ContextNote[]> {
  const search = getSearch();

  // Use semantic search for feature-related notes with full content
  const response = await search.search(featureIdentifier, {
    project,
    limit,
    mode: "auto",
    folders: ["features/"],
    fullContent: true,
    depth: 2,
  });

  return convertSearchResultsToContextNotes(response.results);
}

/**
 * Extract recent agent history from orchestrator workflow
 */
function extractAgentHistory(
  sessionState: SessionState,
  limit: number = 5,
): AgentHistorySummary[] {
  const workflow = sessionState.orchestratorWorkflow;
  if (!workflow) {
    return [];
  }

  return workflow.agentHistory
    .slice(-limit)
    .reverse()
    .map((invocation) => ({
      agent: invocation.agent,
      status: invocation.status,
      startedAt: invocation.startedAt,
      summary: invocation.output?.summary,
    }));
}

/**
 * Extract task wikilinks from note content.
 *
 * Matches patterns like [[TASK-X-Y]], [[tasks/TASK-001]], [[TASK-123]].
 * Also handles task references that may include folder paths.
 *
 * @param content - Note content to parse
 * @returns Array of unique task identifiers found
 */
export function extractTaskWikilinks(content: string | undefined): string[] {
  if (!content) {
    return [];
  }

  const taskIds: string[] = [];

  // Match wikilinks containing task identifiers
  // Pattern: [[...TASK-...]] or [[tasks/...]]
  const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
  let match;

  while ((match = wikilinkRegex.exec(content)) !== null) {
    const linkContent = match[1];

    // Check if it looks like a task reference
    // Matches: TASK-001, TASK-1-2, tasks/TASK-001, etc.
    if (/TASK-\d+(-\d+)?/i.test(linkContent) || /^tasks\//i.test(linkContent)) {
      // Extract just the task ID if it's a path
      const taskIdMatch = linkContent.match(/TASK-\d+(-\d+)?/i);
      if (taskIdMatch) {
        taskIds.push(taskIdMatch[0].toUpperCase());
      } else if (/^tasks\//i.test(linkContent)) {
        // Use the full path for tasks folder references
        taskIds.push(linkContent);
      }
    }
  }

  // Return unique task IDs, limited to reasonable count
  return [...new Set(taskIds)];
}

/**
 * Query a single task note by identifier with full content.
 *
 * @param project - Project context for search
 * @param taskId - Task identifier to search for
 * @returns Task note with full content, or null if not found
 */
async function queryTaskNote(
  project: string,
  taskId: string,
): Promise<EnrichedTaskNote | null> {
  const search = getSearch();

  try {
    const response = await search.search(taskId, {
      project,
      limit: 1,
      mode: "auto",
      fullContent: true,
    });

    if (response.results.length === 0) {
      return null;
    }

    const result = response.results[0];
    const folder = result.permalink.split("/")[0] || "";
    const type = detectNoteType(undefined, folder, result.title);
    const contentForParsing = result.fullContent || result.snippet;
    const status = parseStatus(contentForParsing, result.title);

    return {
      title: result.title,
      permalink: result.permalink,
      type,
      status,
      content: result.fullContent || result.snippet,
      file_path: result.permalink,
      taskId,
    };
  } catch {
    // Log but do not block on missing tasks
    return null;
  }
}

/**
 * Enrich feature notes with their referenced task notes.
 *
 * For each feature note, parses task wikilinks from content and
 * queries each task with fullContent=true.
 *
 * @param featureNotes - Feature notes to enrich
 * @param project - Project context for search
 * @param maxTasksPerFeature - Maximum tasks to query per feature (default 10)
 * @returns Features with their related task notes
 */
async function enrichFeaturesWithTasks(
  featureNotes: ContextNote[],
  project: string,
  maxTasksPerFeature: number = 10,
): Promise<FeatureWithTasks[]> {
  const results: FeatureWithTasks[] = [];

  for (const feature of featureNotes) {
    const taskIds = extractTaskWikilinks(feature.content);
    const limitedTaskIds = taskIds.slice(0, maxTasksPerFeature);

    // Query all task notes in parallel
    const taskPromises = limitedTaskIds.map((taskId) =>
      queryTaskNote(project, taskId),
    );

    const taskResults = await Promise.all(taskPromises);

    // Filter out null results (missing tasks)
    const tasks = taskResults.filter(
      (task): task is EnrichedTaskNote => task !== null,
    );

    results.push({
      feature,
      tasks,
    });
  }

  return results;
}

/**
 * Build session enrichment from session state
 */
export async function buildSessionEnrichment(
  options: SessionEnrichmentOptions,
): Promise<SessionEnrichment> {
  const {
    project,
    sessionState,
    maxTaskNotes = 5,
    maxFeatureNotes = 10,
    maxFeatureTasks = 10,
    maxAgentHistory = 15,
  } = options;

  // Query task-related notes if activeTask is set
  const taskNotes: ContextNote[] = sessionState.activeTask
    ? await queryTaskNotes(project, sessionState.activeTask, maxTaskNotes)
    : [];

  // Query feature-related notes if activeFeature is set
  const featureNotes: ContextNote[] = sessionState.activeFeature
    ? await queryFeatureNotes(
        project,
        sessionState.activeFeature,
        maxFeatureNotes,
      )
    : [];

  // Enrich feature notes with their task notes (query tasks with fullContent)
  const featuresWithTasks: FeatureWithTasks[] =
    featureNotes.length > 0
      ? await enrichFeaturesWithTasks(featureNotes, project, maxFeatureTasks)
      : [];

  // Extract agent history from orchestrator workflow
  const recentAgentHistory = extractAgentHistory(sessionState, maxAgentHistory);

  return {
    sessionState,
    taskNotes,
    featureNotes,
    featuresWithTasks,
    recentAgentHistory,
  };
}

/**
 * Convert SearchService results to ContextNote format with type/status enrichment.
 * Uses fullContent when available, falling back to snippet.
 */
function convertSearchResultsToContextNotes(
  results: ServiceSearchResult[],
): ContextNote[] {
  return results
    .filter((result) => result.title && result.permalink)
    .map((result) => {
      const folder = result.permalink.split("/")[0] || "";

      // Detect type from folder or title
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
