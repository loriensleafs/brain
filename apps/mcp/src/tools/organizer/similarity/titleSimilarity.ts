/**
 * Title-based similarity detection for dedupe mode
 *
 * Implements heuristic similarity detection using:
 * - Levenshtein distance on titles
 * - Folder proximity
 * - Shared wikilinks
 * - Common keywords
 */

import type { DuplicatePair } from '../types';
import { levenshteinDistance } from '../utils/similarity';

/**
 * Note metadata for similarity comparison
 */
export interface NoteMetadata {
  permalink: string;
  title: string;
  folder: string;
  wikilinks: string[];
  keywords: string[];
}

/**
 * Find similar note pairs using title and metadata heuristics
 */
export async function findSimilarPairs(
  notes: NoteMetadata[],
  threshold: number
): Promise<DuplicatePair[]> {
  const pairs: DuplicatePair[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const note1 = notes[i];
      const note2 = notes[j];

      // Generate unique key for this pair
      const pairKey = [note1.permalink, note2.permalink].sort().join('|');
      if (seen.has(pairKey)) continue;

      // Calculate similarity score
      const similarity = calculateSimilarity(note1, note2);

      if (similarity >= threshold) {
        pairs.push({
          note1: note1.permalink,
          note2: note2.permalink,
          embeddingSimilarity: similarity,
          fulltextSimilarity: 0, // Will be calculated later
          rationale: generateRationale(note1, note2, similarity),
        });
        seen.add(pairKey);
      }
    }
  }

  return pairs;
}

/**
 * Calculate overall similarity between two notes
 */
function calculateSimilarity(note1: NoteMetadata, note2: NoteMetadata): number {
  let score = 0;
  let weights = 0;

  // Title similarity (weight: 0.4)
  const titleSim = calculateTitleSimilarity(note1.title, note2.title);
  score += titleSim * 0.4;
  weights += 0.4;

  // Folder proximity (weight: 0.2)
  const folderSim = note1.folder === note2.folder ? 1 : 0;
  score += folderSim * 0.2;
  weights += 0.2;

  // Shared wikilinks (weight: 0.2)
  const wikilinkSim = calculateWikilinkSimilarity(
    note1.wikilinks,
    note2.wikilinks
  );
  score += wikilinkSim * 0.2;
  weights += 0.2;

  // Keyword overlap (weight: 0.2)
  const keywordSim = calculateKeywordSimilarity(note1.keywords, note2.keywords);
  score += keywordSim * 0.2;
  weights += 0.2;

  return weights > 0 ? score / weights : 0;
}

/**
 * Calculate title similarity using Levenshtein distance
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const t1 = title1.toLowerCase();
  const t2 = title2.toLowerCase();

  const distance = levenshteinDistance(t1, t2);
  const maxLength = Math.max(t1.length, t2.length);

  return maxLength > 0 ? 1 - distance / maxLength : 0;
}

/**
 * Calculate wikilink similarity using Jaccard coefficient
 */
function calculateWikilinkSimilarity(
  links1: string[],
  links2: string[]
): number {
  if (links1.length === 0 && links2.length === 0) return 0;

  const set1 = new Set(links1);
  const set2 = new Set(links2);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Calculate keyword similarity using Jaccard coefficient
 */
function calculateKeywordSimilarity(
  keywords1: string[],
  keywords2: string[]
): number {
  if (keywords1.length === 0 && keywords2.length === 0) return 0;

  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Generate rationale for why two notes are similar
 */
function generateRationale(
  note1: NoteMetadata,
  note2: NoteMetadata,
  similarity: number
): string {
  const reasons: string[] = [];

  const titleSim = calculateTitleSimilarity(note1.title, note2.title);
  if (titleSim > 0.7) {
    reasons.push(`similar titles (${(titleSim * 100).toFixed(0)}%)`);
  }

  if (note1.folder === note2.folder) {
    reasons.push(`same folder "${note1.folder}"`);
  }

  const sharedLinks = note1.wikilinks.filter((link) =>
    note2.wikilinks.includes(link)
  );
  if (sharedLinks.length > 0) {
    reasons.push(`${sharedLinks.length} shared wikilinks`);
  }

  const sharedKeywords = note1.keywords.filter((kw) =>
    note2.keywords.includes(kw)
  );
  if (sharedKeywords.length > 0) {
    reasons.push(`${sharedKeywords.length} shared keywords`);
  }

  const reasonText =
    reasons.length > 0 ? reasons.join(', ') : 'metadata similarity';
  return `Similarity ${(similarity * 100).toFixed(0)}%: ${reasonText}`;
}
