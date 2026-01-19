/**
 * Schema definitions for the validate_import tool
 *
 * Defines types for migration validation including input migration results,
 * conformance checks, and quality scoring. Used to verify migrations succeeded
 * and notes now conform to Brain project conventions.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Input migration result from migrate_cluster
 */
export interface MigrationResultInput {
  source: string;
  target: string;
  success: boolean;
}

/**
 * Input arguments for validate_import tool
 *
 * Note: migration_results is typed as optional to allow the handler to receive
 * Record<string, unknown> from the MCP framework. Validation is done in handler.
 */
export interface ValidateImportArgs {
  project?: string;
  migration_results?: MigrationResultInput[];
}

/**
 * Conformance check results after migration
 */
export interface ConformanceCheckResult {
  all_conform: boolean;
  still_non_conforming: string[];
  issues_fixed: number;
}

/**
 * Output from validate_import tool execution
 */
export interface ValidateImportOutput {
  content_preserved: boolean;
  content_coverage: number;
  missing_content: string[];

  conformance_check: ConformanceCheckResult;

  quality_score: number;
  summary: string;
}

export const toolDefinition: Tool = {
  name: 'validate_import',
  description: `Verify migration quality after running migrate_cluster. Checks that:
- Target files exist and contain content (content preservation)
- Migrated files now conform to Brain project conventions
- Returns a quality score based on conformance improvement

Usage:
1. Run migrate_cluster to execute migrations
2. Pass the migration results to this tool
3. Review the quality score and any remaining issues

The tool re-runs conformance checks on migrated files to verify improvements.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      project: {
        type: 'string',
        description: 'Project to validate. Auto-resolved if not specified.'
      },
      migration_results: {
        type: 'array',
        description: 'Array of migration results from migrate_cluster',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'Original source path' },
            target: { type: 'string', description: 'Target path after migration' },
            success: { type: 'boolean', description: 'Whether migration succeeded' }
          },
          required: ['source', 'target', 'success']
        }
      }
    },
    required: ['migration_results']
  }
};
