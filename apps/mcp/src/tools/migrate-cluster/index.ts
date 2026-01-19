/**
 * Handler for migrate_cluster tool
 *
 * Executes migrations from an analyze_project preview, moving notes to conform
 * to Brain project conventions. Supports dry-run mode and continues processing
 * even if individual migrations fail.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolveProject } from "../../project/resolve";
import { getBasicMemoryClient } from "../../proxy/client";
import type {
  MigrateClusterArgs,
  MigrateClusterOutput,
  MigrationChange,
  MigrationResult
} from "./schema";
import { executeMigration, validateChange } from "./executor";
import { logger } from "../../utils/internal/logger";

/**
 * Main handler for the migrate_cluster tool
 */
export async function handler(args: MigrateClusterArgs): Promise<CallToolResult> {
  const project = args.project || resolveProject();
  const dryRun = args.dry_run ?? false;
  const changes = args.changes || [];

  if (!project) {
    return {
      content: [{ type: "text" as const, text: "No project specified." }],
      isError: true,
    };
  }

  if (!Array.isArray(changes) || changes.length === 0) {
    return {
      content: [{ type: "text" as const, text: "No changes provided. Use analyze_project with preview=true to generate a migration plan first." }],
      isError: true,
    };
  }

  // Validate all changes before executing
  const validationErrors: string[] = [];
  const validChanges: MigrationChange[] = [];

  for (let i = 0; i < changes.length; i++) {
    if (validateChange(changes[i])) {
      validChanges.push(changes[i] as MigrationChange);
    } else {
      validationErrors.push(`Change at index ${i} is invalid: ${JSON.stringify(changes[i])}`);
    }
  }

  if (validationErrors.length > 0) {
    return {
      content: [{
        type: "text" as const,
        text: `Invalid changes detected:\n${validationErrors.join('\n')}`
      }],
      isError: true,
    };
  }

  // Dry run - just report what would happen
  if (dryRun) {
    return buildDryRunResponse(project, validChanges);
  }

  // Execute migrations
  const client = await getBasicMemoryClient();
  const results: MigrationResult[] = [];
  const errors: string[] = [];
  let changesApplied = 0;
  let changesFailed = 0;

  logger.info(
    { project, changeCount: validChanges.length },
    "Starting cluster migration"
  );

  for (const change of validChanges) {
    const result = await executeMigration(change, project, client);
    results.push(result);

    if (result.success) {
      changesApplied++;
    } else {
      changesFailed++;
      if (result.error) {
        errors.push(`${change.source}: ${result.error}`);
      }
    }
  }

  logger.info(
    { project, applied: changesApplied, failed: changesFailed },
    "Cluster migration complete"
  );

  const output: MigrateClusterOutput = {
    success: changesFailed === 0,
    changes_applied: changesApplied,
    changes_failed: changesFailed,
    results,
    errors
  };

  // Build text output
  const lines = buildResultText(project, output);

  return {
    structuredContent: output as unknown as { [x: string]: unknown },
    content: [{ type: "text" as const, text: lines.join("\n") }]
  };
}

/**
 * Builds the dry-run response showing what would happen
 */
function buildDryRunResponse(project: string, changes: MigrationChange[]): CallToolResult {
  const lines: string[] = [
    `## Migration Dry Run`,
    ``,
    `**Project:** ${project}`,
    `**Changes:** ${changes.length}`,
    ``,
    `### Planned Operations`,
    ``
  ];

  // Group by operation type
  const byOperation: Record<string, MigrationChange[]> = {
    move: [],
    rename: [],
    restructure: []
  };

  for (const change of changes) {
    byOperation[change.operation].push(change);
  }

  for (const [op, items] of Object.entries(byOperation)) {
    if (items.length === 0) continue;

    lines.push(`**${op.toUpperCase()}** (${items.length})`);
    for (const item of items.slice(0, 15)) {
      lines.push(`- ${item.source} → ${item.target}`);
    }
    if (items.length > 15) {
      lines.push(`- ... and ${items.length - 15} more`);
    }
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(`Run without dry_run=true to execute these migrations.`);

  const output: MigrateClusterOutput = {
    success: true,
    changes_applied: 0,
    changes_failed: 0,
    results: changes.map(c => ({
      source: c.source,
      target: c.target,
      operation: c.operation,
      success: true
    })),
    errors: []
  };

  return {
    structuredContent: output as unknown as { [x: string]: unknown },
    content: [{ type: "text" as const, text: lines.join("\n") }]
  };
}

/**
 * Builds the result text after executing migrations
 */
function buildResultText(project: string, output: MigrateClusterOutput): string[] {
  const lines: string[] = [
    `## Migration Results`,
    ``,
    `**Project:** ${project}`,
    `**Status:** ${output.success ? 'SUCCESS' : 'PARTIAL FAILURE'}`,
    `**Applied:** ${output.changes_applied}`,
    `**Failed:** ${output.changes_failed}`,
    ``
  ];

  // Show successful migrations
  const successes = output.results.filter(r => r.success);
  if (successes.length > 0) {
    lines.push(`### Completed (${successes.length})`);
    for (const result of successes.slice(0, 20)) {
      lines.push(`- [${result.operation}] ${result.source} → ${result.target}`);
    }
    if (successes.length > 20) {
      lines.push(`... and ${successes.length - 20} more`);
    }
    lines.push(``);
  }

  // Show failures with errors
  const failures = output.results.filter(r => !r.success);
  if (failures.length > 0) {
    lines.push(`### Failed (${failures.length})`);
    for (const result of failures) {
      lines.push(`- **${result.source}**`);
      if (result.error) {
        lines.push(`  Error: ${result.error}`);
      }
    }
    lines.push(``);
  }

  return lines;
}

export { toolDefinition } from "./schema";
