/**
 * String similarity utilities using Levenshtein distance
 *
 * Provides normalized and raw distance calculations for comparing strings,
 * used by organizer tools for duplicate detection and suggestion matching.
 */

import { distance } from 'fastest-levenshtein';

/**
 * Calculate Levenshtein distance between two strings
 *
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions)
 * required to change one string into the other.
 */
export function levenshteinDistance(str1: string, str2: string): number {
  return distance(str1, str2);
}

/**
 * Calculate normalized similarity between two strings
 *
 * Returns a value between 0 (completely different) and 1 (identical).
 * Uses Levenshtein distance normalized by the length of the longer string.
 */
export function similarity(str1: string, str2: string): number {
  if (str1.length === 0 && str2.length === 0) {
    return 1; // Both empty strings are identical
  }

  const dist = distance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  return 1 - dist / maxLength;
}
