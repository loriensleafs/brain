/**
 * bootstrap_context tool implementation
 *
 * Provides semantic context for conversation initialization by querying
 * active features, recent decisions, open bugs, and related notes.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolveProject } from "../../project/resolve";
import { logger } from "../../utils/internal/logger";

import type { BootstrapContextArgs } from "./schema";
import {
  queryRecentActivity,
  queryActiveFeatures,
  queryRecentDecisions,
  queryOpenBugs,
} from "./sectionQueries";
import { followRelations } from "./relationFollowing";
import { buildStructuredOutput } from "./structuredOutput";
import { buildFormattedOutputWithLimits } from "./formattedOutput";
import {
  getCachedContext,
  setCachedContext,
  type CacheOptions,
} from "./sessionCache";

export async function handler(
  args: BootstrapContextArgs
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
    "Building bootstrap context"
  );

  try {
    // Query all sections in parallel
    const [recentActivity, activeFeatures, recentDecisions, openBugs] =
      await Promise.all([
        queryRecentActivity({ project, timeframe }),
        queryActiveFeatures({ project, timeframe }),
        queryRecentDecisions({ project, timeframe: "3d" }),
        queryOpenBugs({ project, timeframe }),
      ]);

    // Follow relations if requested
    let referencedNotes: Awaited<ReturnType<typeof followRelations>> = [];
    if (includeReferenced) {
      const allNotes = [...activeFeatures, ...recentDecisions, ...openBugs];
      referencedNotes = await followRelations(allNotes, { project });
    }

    // Build structured output
    const structuredContent = buildStructuredOutput({
      project,
      timeframe,
      activeFeatures,
      recentDecisions,
      openBugs,
      recentActivity,
      referencedNotes,
    });

    // Cache the result
    setCachedContext(cacheOptions, structuredContent);

    // Build formatted output
    const formattedOutput = buildFormattedOutputWithLimits({
      project,
      activeFeatures,
      recentDecisions,
      openBugs,
      recentActivity,
      referencedNotes,
    });

    logger.info(
      {
        project,
        noteCount: structuredContent.metadata.note_count,
        features: activeFeatures.length,
        decisions: recentDecisions.length,
        bugs: openBugs.length,
        activity: recentActivity.length,
        referenced: referencedNotes.length,
      },
      "Bootstrap context built successfully"
    );

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
