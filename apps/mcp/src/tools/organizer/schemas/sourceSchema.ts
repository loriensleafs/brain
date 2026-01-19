/**
 * Source schema definitions for external project import
 *
 * Defines how external projects (like working-memory) are structured so they
 * can be analyzed and imported into Brain project conventions. Each source
 * schema describes folder-to-type mappings, metadata formats, and relation
 * patterns specific to that project's conventions.
 */

/**
 * Metadata format used in the source project's notes
 */
export type MetadataFormat = 'yaml_frontmatter' | 'inline_header' | 'none';

/**
 * Schema describing an external project's structure for import analysis
 */
export interface SourceSchema {
  name: string;
  folder_types: Record<string, string>;      // folder -> note type
  file_patterns: Record<string, string>;     // filename pattern -> note type
  metadata_format: MetadataFormat;
  relation_patterns: string[];               // Regex patterns for relationships
}

/**
 * Working-memory project schema instance
 *
 * Maps working-memory folder structure to Brain note types for import.
 * Uses inline_header metadata format (no YAML frontmatter).
 */
export const workingMemorySchema: SourceSchema = {
  name: 'working-memory',
  folder_types: {
    'analysis': 'analysis',
    'decisions': 'decision',
    'planning': 'feature',
    'research': 'research',
    'implementation': 'feature',
    'debugging': 'analysis',
    'history': 'conversation',
    'documentation': 'spec',
    'failures': 'analysis',
    'features': 'feature',
    'fixes': 'analysis',
    'improvements': 'feature',
    'instructions': 'spec',
    'knowledge': 'research',
    'reports': 'analysis',
    'testing': 'analysis',
    'validation': 'analysis'
  },
  file_patterns: {},
  metadata_format: 'inline_header',
  relation_patterns: [
    '\\[\\[.*?\\]\\]',
    'See: (.+\\.md)',
    'Related to: (.+)'
  ]
};
