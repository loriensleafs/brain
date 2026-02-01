/**
 * Cluster schema definitions for grouping related files during import
 *
 * Defines structures for representing file clusters detected through reference
 * analysis, folder grouping, or topic detection. Used by the cluster detection
 * algorithm to identify which files should be migrated together.
 */

/**
 * Cluster of related files for batch migration
 */
export interface FileCluster {
  id: string;
  files: string[]; // Source file paths in cluster
  cluster_type: "reference" | "folder" | "topic";
  merge_recommendation: "merge" | "keep_separate";
  target_note?: string; // Suggested Brain note path if merging
  rationale: string; // Why these files are clustered
}

/**
 * Reference edge between two files
 */
export interface FileReference {
  from: string;
  to: string;
  reference_type: "wikilink" | "see_also" | "related_to";
}

/**
 * Parsed source file with content for analysis
 */
export interface ParsedSourceFile {
  path: string;
  content: string;
  title?: string;
  folder: string;
  lineCount: number;
}
