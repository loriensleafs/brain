/**
 * bootstrap_context tool implementation
 *
 * Provides semantic context for conversation initialization by querying
 * active features, recent decisions, open bugs, and related notes.
 * Now includes session state enrichment for task/feature context.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  resolveProject,
  setActiveProject,
} from "../../project/resolve";
import { createDefaultSessionState, getSession } from "../../services/session";
import { logger } from "../../utils/internal/logger";
import { triggerCatchupEmbedding } from "./catchupTrigger";
import { buildFormattedOutputWithLimits } from "./formattedOutput";
import { followRelations } from "./relationFollowing";
import type { BootstrapContextArgs } from "./schema";
import {
  queryActiveFeatures,
  queryOpenBugs,
  queryRecentActivity,
  queryRecentDecisions,
} from "./sectionQueries";
import {
  type CacheOptions,
  getCachedContext,
  setCachedContext,
} from "./sessionCache";
import { buildSessionEnrichment } from "./sessionEnrichment";
import { buildStructuredOutput } from "./structuredOutput";

export async function handler(
  args: BootstrapContextArgs,
): Promise<CallToolResult> {
  const project = args.project || resolveProject();

  if (!project) {
    return {
      content: [
        {
          type: "text" as const,
          text: "🧠 No project specified and none could be resolved from CWD.\n\nUse set_project to set an active project, or pass project parameter.",
        },
      ],
      isError: true,
    };
  }

  // Set as active project for subsequent tool calls
  setActiveProject(project);
  logger.debug({ project }, "Set active project from bootstrap_context");

  const timeframe = args.timeframe || "5d";
  const includeReferenced = args.include_referenced ?? true;

  // Check cache first
  const cacheOptions: CacheOptions = {
    project,
    timeframe,
    includeReferenced,
  };

  const cached = getCachedContext(cacheOptions);
  if (cached) {
    logger.info({ project, timeframe }, "Returning cached bootstrap context");
    return {
      content: [
        {
          type: "text" as const,
          text: `🧠 Bootstrap Context (cached)\n\n${JSON.stringify(cached, null, 2)}`,
        },
      ],
    };
  }

  logger.info(
    { project, timeframe, includeReferenced },
    "Building bootstrap context",
  );

  try {
    // Load session state (create default if none exists)
    let sessionState = await getSession();
    if (!sessionState) {
      sessionState = createDefaultSessionState();
      logger.info({ project }, "No session found, using default state");
    }

    // Query all sections in parallel, including session enrichment
    const [
      recentActivity,
      activeFeatures,
      recentDecisions,
      openBugs,
      sessionEnrichment,
    ] = await Promise.all([
      queryRecentActivity({ project, timeframe }),
      queryActiveFeatures({ project, timeframe }),
      queryRecentDecisions({ project, timeframe: "3d" }),
      queryOpenBugs({ project, timeframe }),
      buildSessionEnrichment({ project, sessionState }),
    ]);

    // Follow relations if requested
    let referencedNotes: Awaited<ReturnType<typeof followRelations>> = [];
    if (includeReferenced) {
      const allNotes = [...activeFeatures, ...recentDecisions, ...openBugs];
      referencedNotes = await followRelations(allNotes, { project });
    }

    // Build structured output with session enrichment
    const structuredContent = buildStructuredOutput({
      project,
      timeframe,
      activeFeatures,
      recentDecisions,
      openBugs,
      recentActivity,
      referencedNotes,
      sessionEnrichment,
    });

    // Cache the result
    setCachedContext(cacheOptions, structuredContent);

    // Build formatted output with session enrichment
    // Always use full content for rich context injection
    const formattedOutput = buildFormattedOutputWithLimits(
      {
        project,
        activeFeatures,
        recentDecisions,
        openBugs,
        recentActivity,
        referencedNotes,
        sessionEnrichment,
      },
      {}, // default limits
      true, // Always include full content
    );

    logger.info(
      {
        project,
        noteCount: structuredContent.metadata.note_count,
        features: activeFeatures.length,
        decisions: recentDecisions.length,
        bugs: openBugs.length,
        activity: recentActivity.length,
        referenced: referencedNotes.length,
        sessionMode: sessionState.currentMode,
        hasActiveTask: !!sessionState.activeTask,
        hasActiveFeature: !!sessionState.activeFeature,
        hasWorkflow: !!sessionState.orchestratorWorkflow,
      },
      "Bootstrap context built successfully with session enrichment",
    );

    // Trigger catch-up embedding asynchronously (non-blocking)
    // Per strategic verdict 038: run on every bootstrap_context call
    triggerCatchupEmbedding(project).catch((error) => {
      logger.error({ project, error }, "Catch-up embedding trigger failed");
    });

    return {
      content: [
        {
          type: "text" as const,
          text: formattedOutput,
        },
      ],
    };
  } catch (error) {
    logger.error({ project, error }, "Failed to build bootstrap context");

    return {
      content: [
        {
          type: "text" as const,
          text: `🧠 Error building bootstrap context: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
}

export { toolDefinition } from "./schema";
