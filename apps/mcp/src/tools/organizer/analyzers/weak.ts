/**
 * Weak note analyzer for maintain mode
 *
 * Identifies notes that fall below a quality threshold based on structure
 * and content richness. Quality is scored based on frontmatter, observations,
 * relations, and section organization.
 */

import type { QualityIssue } from '../types';
import { getBasicMemoryClient } from '../../../proxy/client';
import { hasFrontmatter } from '../utils/markdown';
import { extractWikilinks } from '../utils/wikilinks';

/**
 * Quality scoring weights
 */
const QUALITY_WEIGHTS = {
  HAS_FRONTMATTER: 0.2,
  HAS_OBSERVATIONS: 0.3, // 3+ observations
  HAS_RELATIONS: 0.3, // 2+ wikilinks
  HAS_SECTIONS: 0.2, // Has ## sections
};

/**
 * Find notes below the quality threshold
 */
export async function findWeakNotes(
  project: string,
  threshold: number
): Promise<QualityIssue[]> {
  const client = await getBasicMemoryClient();
  const issues: QualityIssue[] = [];

  // Get all notes in project
  const listResult = await client.callTool({
    name: 'list_directory',
    arguments: { project, depth: 10, file_name_glob: '*.md' },
  });

  const noteFiles = parseListDirectoryResult(listResult);

  // Score each note
  for (const permalink of noteFiles) {
    try {
      const readResult = await client.callTool({
        name: 'read_note',
        arguments: { identifier: permalink, project },
      });

      const score = calculateQualityScore(readResult);

      if (score < threshold) {
        const recommendations = generateRecommendations(readResult, score);

        issues.push({
          type: 'WEAK',
          note: permalink,
          score,
          recommendation: `"${permalink}" has quality score ${score.toFixed(2)} (threshold: ${threshold}). ${recommendations}`,
        });
      }
    } catch (error) {
      // Skip notes that fail to read
      continue;
    }
  }

  return issues;
}

/**
 * Calculate quality score for a note
 */
function calculateQualityScore(result: any): number {
  const text = result.content?.[0]?.text || '';
  let score = 0;

  // Check for frontmatter
  if (hasFrontmatter(text)) {
    score += QUALITY_WEIGHTS.HAS_FRONTMATTER;
  }

  // Check for observations (3+ bullet points or numbered items)
  if (hasObservations(text, 3)) {
    score += QUALITY_WEIGHTS.HAS_OBSERVATIONS;
  }

  // Check for relations (2+ wikilinks)
  if (hasRelations(text, 2)) {
    score += QUALITY_WEIGHTS.HAS_RELATIONS;
  }

  // Check for sections
  if (hasSections(text)) {
    score += QUALITY_WEIGHTS.HAS_SECTIONS;
  }

  return score;
}

/**
 * Generate recommendations for improving note quality
 */
function generateRecommendations(result: any, currentScore: number): string {
  const text = result.content?.[0]?.text || '';
  const recommendations: string[] = [];

  if (!hasFrontmatter(text)) {
    recommendations.push('add frontmatter');
  }

  if (!hasObservations(text, 3)) {
    recommendations.push('add more observations');
  }

  if (!hasRelations(text, 2)) {
    recommendations.push('link to related notes');
  }

  if (!hasSections(text)) {
    recommendations.push('organize with sections');
  }

  return recommendations.length > 0
    ? `Improve by: ${recommendations.join(', ')}`
    : 'Consider enriching content';
}

/**
 * Check if note has minimum number of observations
 */
function hasObservations(content: string, minCount: number): boolean {
  // Count bullet points and numbered lists
  const bulletPoints = content.match(/^[\s]*[-*+]\s+/gm);
  const numberedItems = content.match(/^[\s]*\d+\.\s+/gm);

  const totalObservations =
    (bulletPoints?.length || 0) + (numberedItems?.length || 0);

  return totalObservations >= minCount;
}

/**
 * Check if note has minimum number of relations
 */
function hasRelations(content: string, minCount: number): boolean {
  const wikilinks = extractWikilinks(content);
  return wikilinks.length >= minCount;
}

/**
 * Check if note has sections
 */
function hasSections(content: string): boolean {
  return /^##\s+/m.test(content);
}

/**
 * Parse list_directory output to extract file paths
 */
function parseListDirectoryResult(result: any): string[] {
  const text = result.content?.[0]?.text || '';
  const files: string[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.includes('.md') && !line.includes('Directory:')) {
      const match = line.match(/([^\s]+\.md)/);
      if (match) files.push(match[1]);
    }
  }

  return files;
}
