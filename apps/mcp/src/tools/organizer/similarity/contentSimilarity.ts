/**
 * Content-based similarity detection for dedupe mode
 *
 * Refines duplicate candidates by comparing note content:
 * - Observation overlap
 * - Shared wikilink references
 * - Common keywords in content
 */

import type { DuplicatePair } from "../types";

/**
 * Note content for similarity comparison
 */
export interface NoteContent {
  permalink: string;
  observations: string[];
  wikilinks: string[];
  keywords: string[];
  content: string;
}

/**
 * Calculate content similarity for duplicate pairs
 */
export async function calculateContentSimilarity(
  pairs: DuplicatePair[],
  noteContents: Map<string, NoteContent>,
): Promise<DuplicatePair[]> {
  const refined: DuplicatePair[] = [];

  for (const pair of pairs) {
    const content1 = noteContents.get(pair.note1);
    const content2 = noteContents.get(pair.note2);

    if (!content1 || !content2) {
      // Skip if content not available
      refined.push(pair);
      continue;
    }

    // Calculate content similarity score
    const contentSim = calculateSimilarity(content1, content2);

    refined.push({
      ...pair,
      fulltextSimilarity: contentSim,
    });
  }

  return refined;
}

/**
 * Calculate overall content similarity between two notes
 */
function calculateSimilarity(content1: NoteContent, content2: NoteContent): number {
  let score = 0;
  let weights = 0;

  // Observation overlap (weight: 0.4)
  const obsSim = calculateObservationSimilarity(content1.observations, content2.observations);
  score += obsSim * 0.4;
  weights += 0.4;

  // Wikilink overlap (weight: 0.3)
  const linkSim = calculateJaccardSimilarity(content1.wikilinks, content2.wikilinks);
  score += linkSim * 0.3;
  weights += 0.3;

  // Keyword overlap (weight: 0.3)
  const keywordSim = calculateJaccardSimilarity(content1.keywords, content2.keywords);
  score += keywordSim * 0.3;
  weights += 0.3;

  return weights > 0 ? score / weights : 0;
}

/**
 * Calculate observation similarity using fuzzy matching
 */
function calculateObservationSimilarity(obs1: string[], obs2: string[]): number {
  if (obs1.length === 0 && obs2.length === 0) return 0;
  if (obs1.length === 0 || obs2.length === 0) return 0;

  let matches = 0;
  const total = Math.max(obs1.length, obs2.length);

  // Count similar observation pairs
  for (const o1 of obs1) {
    for (const o2 of obs2) {
      if (areSimilarObservations(o1, o2)) {
        matches++;
        break; // Only count each observation once
      }
    }
  }

  return total > 0 ? matches / total : 0;
}

/**
 * Check if two observations are semantically similar
 */
function areSimilarObservations(obs1: string, obs2: string): boolean {
  const normalized1 = normalizeObservation(obs1);
  const normalized2 = normalizeObservation(obs2);

  // Exact match after normalization
  if (normalized1 === normalized2) return true;

  // Check for substring containment
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }

  // Check for high word overlap
  const words1 = new Set(normalized1.split(/\s+/));
  const words2 = new Set(normalized2.split(/\s+/));
  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  const overlap = union.size > 0 ? intersection.size / union.size : 0;
  return overlap > 0.7;
}

/**
 * Normalize observation text for comparison
 */
function normalizeObservation(obs: string): string {
  return obs
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Calculate Jaccard similarity coefficient
 */
function calculateJaccardSimilarity(arr1: string[], arr2: string[]): number {
  if (arr1.length === 0 && arr2.length === 0) return 0;

  const set1 = new Set(arr1);
  const set2 = new Set(arr2);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Extract observations from note content
 */
export function extractObservations(content: string): string[] {
  const observations: string[] = [];
  const lines = content.split("\n");
  let inObservations = false;

  for (const line of lines) {
    // Check if we're entering observations section
    if (line.match(/^##\s+Observations/i)) {
      inObservations = true;
      continue;
    }

    // Check if we're leaving observations section
    if (inObservations && line.match(/^##\s+/)) {
      break;
    }

    // Collect observation items
    if (inObservations) {
      const match = line.match(/^-\s+(.+)$/);
      if (match) {
        observations.push(match[1].trim());
      }
    }
  }

  return observations;
}

export { extractKeywords } from "../utils/keywords";
// Re-export for backward compatibility
export { extractWikilinks } from "../utils/wikilinks";
