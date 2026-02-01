/**
 * Keyword extraction utilities using keyword-extractor and stopword
 *
 * Provides improved keyword extraction with stopword removal for
 * better quality similarity scoring.
 */

import keywordExtractor from "keyword-extractor";
import { removeStopwords } from "stopword";

/**
 * Extract meaningful keywords from text content
 *
 * Uses keyword-extractor for proper extraction and stopword
 * removal to filter common words with no semantic value.
 */
export function extractKeywords(content: string): string[] {
	// Extract keywords using keyword-extractor
	const extracted = keywordExtractor.extract(content, {
		language: "english",
		remove_digits: true,
		return_changed_case: true,
		remove_duplicates: true,
	});

	// Apply stopword removal for additional filtering
	const cleaned = removeStopwords(extracted);

	// Return unique keywords
	return Array.from(new Set(cleaned));
}
