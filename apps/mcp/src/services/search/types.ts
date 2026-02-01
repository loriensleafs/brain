/**
 * Type definitions for SearchService
 *
 * Defines the interfaces and options for the unified search service
 * that abstracts Brain MCP search with semantic capabilities.
 */

/**
 * Search mode determining which search strategy to use.
 *
 * - auto: Tries semantic first, falls back to keyword if no embeddings or results
 * - semantic: Vector similarity search only (requires embeddings)
 * - keyword: Text-based search via basic-memory
 * - hybrid: Combines semantic and keyword results (future enhancement)
 */
export type SearchMode = "auto" | "semantic" | "keyword" | "hybrid";

/**
 * Source indicating which search method produced a result.
 */
export type SearchSource = "semantic" | "keyword" | "related" | "hybrid";

/**
 * Options for configuring search behavior.
 */
export interface SearchOptions {
	/**
	 * Maximum number of results to return.
	 * @default 10
	 */
	limit?: number;

	/**
	 * Similarity threshold for semantic search (0-1).
	 * Higher values return more relevant but fewer results.
	 * @default 0.7
	 */
	threshold?: number;

	/**
	 * Search mode determining strategy.
	 * @default "auto"
	 */
	mode?: SearchMode;

	/**
	 * Relation depth: follow wikilinks N levels from results.
	 * @default 0
	 */
	depth?: number;

	/**
	 * Project name to search in.
	 * If not specified, uses the current project context.
	 */
	project?: string;

	/**
	 * Filter results to notes in specific folders.
	 * Example: ["features/", "decisions/"]
	 */
	folders?: string[];

	/**
	 * Filter results to notes modified after this date.
	 * ISO date string format (YYYY-MM-DD).
	 */
	afterDate?: string;

	/**
	 * When true, fetch full note content for each result.
	 * When false (default), results include only snippets.
	 * Full content is limited to 5000 characters per note.
	 * @default false
	 */
	fullContent?: boolean;
}

/**
 * Result from a search operation.
 */
export interface SearchResult {
	/**
	 * Note identifier/path.
	 */
	permalink: string;

	/**
	 * Note title for display.
	 */
	title: string;

	/**
	 * Match score (0-1) where 1 is exact match.
	 */
	similarity_score: number;

	/**
	 * Content preview snippet.
	 */
	snippet: string;

	/**
	 * Which search method produced this result.
	 */
	source: SearchSource;

	/**
	 * Relation depth from original query.
	 * 0 = direct match, 1+ = related via wikilinks.
	 */
	depth?: number;

	/**
	 * Full note content when fullContent option is enabled.
	 * Limited to 5000 characters. Populated only when requested.
	 */
	fullContent?: string;
}

/**
 * Response from a search operation including metadata.
 */
export interface SearchResponse {
	/**
	 * Search results ordered by relevance.
	 */
	results: SearchResult[];

	/**
	 * Total number of results found.
	 */
	total: number;

	/**
	 * The query that was executed.
	 */
	query: string;

	/**
	 * Search mode that was used.
	 */
	mode: SearchMode;

	/**
	 * Relation depth that was applied.
	 */
	depth: number;

	/**
	 * Which search strategy actually executed.
	 * May differ from requested mode in auto mode.
	 */
	actualSource: SearchSource;
}
