/**
 * Formatted output builder for bootstrap_context tool
 *
 * Generates human-readable markdown output using templates.
 * Returns TextContent for display in Claude Code terminal.
 */

import type { ContextNote } from "./sectionQueries";
import { renderContext, type ContextData } from "./templates";

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
}

/**
 * Build formatted markdown output from context data
 *
 * Uses templates to generate human-readable output for terminal display.
 */
export function buildFormattedOutput(input: FormattedOutputInput): string {
  const {
    project,
    activeFeatures,
    recentDecisions,
    openBugs,
    recentActivity,
    referencedNotes,
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
  };

  // Render using template
  return renderContext(contextData);
}

/**
 * Build formatted output with section limits
 *
 * Limits each section to prevent overwhelming output.
 */
export function buildFormattedOutputWithLimits(
  input: FormattedOutputInput,
  limits: {
    features?: number;
    decisions?: number;
    bugs?: number;
    activity?: number;
    referenced?: number;
  } = {}
): string {
  const {
    features = 10,
    decisions = 5,
    bugs = 5,
    activity = 10,
    referenced = 10,
  } = limits;

  return buildFormattedOutput({
    project: input.project,
    activeFeatures: input.activeFeatures.slice(0, features),
    recentDecisions: input.recentDecisions.slice(0, decisions),
    openBugs: input.openBugs.slice(0, bugs),
    recentActivity: input.recentActivity.slice(0, activity),
    referencedNotes: input.referencedNotes.slice(0, referenced),
  });
}
