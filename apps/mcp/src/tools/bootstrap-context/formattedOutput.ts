/**
 * Formatted output builder for bootstrap_context tool
 *
 * Generates human-readable markdown output using templates.
 * Returns TextContent for display in Claude Code terminal.
 */

import type { ContextNote } from "./sectionQueries";
import type { SessionEnrichment } from "./sessionEnrichment";
import { type ContextData, renderContext } from "./templates";

/**
 * Input data for building formatted output
 */
export interface FormattedOutputInput {
  project: string;
  activeFeatures: ContextNote[];
  recentDecisions: ContextNote[];
  openBugs: ContextNote[];
  recentActivity: ContextNote[];
  referencedNotes: ContextNote[];
  sessionEnrichment?: SessionEnrichment;
}

/**
 * Build formatted markdown output from context data
 *
 * Uses templates to generate human-readable output for terminal display.
 *
 * @param input - Context data to format
 * @param fullContent - When true, includes full note content instead of wikilinks
 */
export function buildFormattedOutput(
  input: FormattedOutputInput,
  fullContent = false,
): string {
  const {
    project,
    activeFeatures,
    recentDecisions,
    openBugs,
    recentActivity,
    referencedNotes,
    sessionEnrichment,
  } = input;

  // Build context data for template
  const contextData: ContextData = {
    project,
    timestamp: new Date().toLocaleString(),
    activeFeatures,
    recentDecisions,
    openBugs,
    recentActivity,
    referencedNotes,
    sessionEnrichment,
    fullContent,
  };

  // Render using template
  return renderContext(contextData);
}

/**
 * Build formatted output with section limits
 *
 * Limits each section to prevent overwhelming output.
 *
 * @param input - Context data to format
 * @param limits - Section limits to apply
 * @param fullContent - When true, includes full note content instead of wikilinks
 */
export function buildFormattedOutputWithLimits(
  input: FormattedOutputInput,
  limits: {
    features?: number;
    decisions?: number;
    bugs?: number;
    activity?: number;
    referenced?: number;
  } = {},
  fullContent = false,
): string {
  const {
    features = 10,
    decisions = 5,
    bugs = 5,
    activity = 10,
    referenced = 10,
  } = limits;

  return buildFormattedOutput(
    {
      project: input.project,
      activeFeatures: input.activeFeatures.slice(0, features),
      recentDecisions: input.recentDecisions.slice(0, decisions),
      openBugs: input.openBugs.slice(0, bugs),
      recentActivity: input.recentActivity.slice(0, activity),
      referencedNotes: input.referencedNotes.slice(0, referenced),
      sessionEnrichment: input.sessionEnrichment,
    },
    fullContent,
  );
}
