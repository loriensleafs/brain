/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 *
 * This file was automatically generated from JSON Schema files.
 * Any manual changes will be overwritten on the next generation.
 *
 * To regenerate: bun run generate:types
 * Source schemas: packages/validation/schemas/*.schema.json
 *
 * Generated: 2026-02-01T12:28:23.287Z
 */

// Source: schemas/tools/bootstrap-context.schema.json
/**
 * Schema for bootstrap_context tool arguments. Provides semantic context for conversation initialization by querying active features, recent decisions, open bugs, and related notes.
 */
export interface BootstrapContextArgs {
  /**
   * Project to bootstrap context for. Auto-resolved from CWD if not specified.
   */
  project?: string;
  /**
   * Timeframe for recent activity (e.g., '5d', '7d', 'today')
   */
  timeframe?: string;
  /**
   * Whether to include first-level referenced notes
   */
  include_referenced?: boolean;
}

// Source: schemas/tools/search.schema.json
/**
 * Schema for unified search tool arguments. Defines input validation for semantic/keyword search with automatic fallback behavior.
 */
export interface SearchArgs {
  /**
   * Search query text
   */
  query: string;
  /**
   * Maximum number of results to return
   */
  limit?: number;
  /**
   * Similarity threshold for semantic search (0-1)
   */
  threshold?: number;
  /**
   * Search mode: auto, semantic, keyword, or hybrid
   */
  mode?: "auto" | "semantic" | "keyword" | "hybrid";
  /**
   * Relation depth: follow wikilinks N levels from results (0-3)
   */
  depth?: number;
  /**
   * Project name to search in
   */
  project?: string;
  /**
   * When true, include full note content instead of snippets (limited to 5000 chars per note)
   */
  full_context?: boolean;
}
