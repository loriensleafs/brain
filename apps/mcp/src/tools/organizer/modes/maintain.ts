/**
 * Maintain mode for organizer tool
 *
 * Monitors knowledge graph health by identifying quality issues:
 * - Orphan notes: Notes with no relations to other notes
 * - Stale notes: Notes not updated within threshold period
 * - Gap references: Wikilinks to notes that don't exist
 * - Weak notes: Notes below quality threshold
 *
 * Orchestrates all analyzers and aggregates results.
 */

import type { MaintainConfig, MaintainResult } from '../types';
import { findOrphanNotes } from '../analyzers/orphans';
import { findStaleNotes } from '../analyzers/stale';
import { findGapReferences } from '../analyzers/gaps';
import { findWeakNotes } from '../analyzers/weak';

/**
 * Find all maintenance issues in a project
 */
export async function findMaintainIssues(
  config: MaintainConfig
): Promise<MaintainResult> {
  const {
    project,
    staleThresholdDays = 90,
    qualityThreshold = 0.5,
  } = config;

  // Run all analyzers in parallel for efficiency
  const [orphans, stale, gaps, weak] = await Promise.all([
    findOrphanNotes(project),
    findStaleNotes(project, staleThresholdDays),
    findGapReferences(project),
    findWeakNotes(project, qualityThreshold),
  ]);

  // Calculate summary statistics
  const summary = {
    totalIssues: orphans.length + stale.length + gaps.length + weak.length,
    orphanCount: orphans.length,
    staleCount: stale.length,
    gapCount: gaps.length,
    weakCount: weak.length,
  };

  return {
    orphans,
    stale,
    gaps,
    weak,
    summary,
  };
}
