/**
 * Dry-run preview generation for analyze_project tool
 *
 * Transforms conformance analysis output into a grouped visual format
 * that shows planned migrations organized by operation type (rename,
 * restructure, move).
 */

import type {
  NonConformingFile,
  MigrationPreview,
  MigrationPreviewItem,
  MigrationOperation,
  ConformanceIssueType
} from './schema';

/**
 * Maps conformance issue types to migration operations
 */
const ISSUE_TO_OPERATION: Record<ConformanceIssueType, MigrationOperation | null> = {
  'bad_prefix': 'rename',
  'not_overview': 'rename',
  'redundant_child_prefix': 'rename',
  'root_level_scoped': 'restructure',
  'wrong_folder': 'move',
  // These don't result in file operations
  'missing_frontmatter': null,
  'missing_observations': null,
  'missing_relations': null
};

/**
 * Human-readable reasons for each issue type
 */
const ISSUE_REASONS: Record<ConformanceIssueType, string> = {
  'bad_prefix': 'Remove redundant type prefix from filename',
  'not_overview': 'Main file should be named overview.md',
  'redundant_child_prefix': 'Remove parent directory name from filename',
  'root_level_scoped': 'Move to subdirectory with overview.md structure',
  'wrong_folder': 'Move to correct folder based on note type',
  'missing_frontmatter': 'Add required frontmatter',
  'missing_observations': 'Add observations section',
  'missing_relations': 'Add relations section'
};

/**
 * Generates a migration preview from non-conforming files
 *
 * Groups files by operation type and calculates summary statistics.
 * Files with multiple issues are categorized by their primary operation.
 */
export function generatePreview(nonConforming: NonConformingFile[]): MigrationPreview {
  const preview: MigrationPreview = {
    total_changes: 0,
    by_operation: {
      rename: [],
      restructure: [],
      move: []
    },
    warnings: [],
    auto_fixable_count: 0,
    needs_review_count: 0
  };

  for (const file of nonConforming) {
    // Find the primary operation for this file
    const operation = determinePrimaryOperation(file);

    if (!operation) {
      // File only has content issues (frontmatter, observations, relations)
      // These don't result in file moves/renames
      continue;
    }

    const item: MigrationPreviewItem = {
      source: file.path,
      target: file.suggested_target,
      operation,
      reason: buildReason(file),
      issues: file.issues
    };

    preview.by_operation[operation].push(item);
    preview.total_changes++;

    // Count fixability
    const allAutoFixable = file.issues.every(i => i.auto_fixable);
    if (allAutoFixable) {
      preview.auto_fixable_count++;
    } else {
      preview.needs_review_count++;
    }
  }

  // Add warnings for potential conflicts
  const warnings = detectConflicts(preview);
  preview.warnings = warnings;

  return preview;
}

/**
 * Determines the primary operation for a file based on its issues
 *
 * Priority: restructure > move > rename (more significant changes first)
 */
function determinePrimaryOperation(file: NonConformingFile): MigrationOperation | null {
  const operations = file.issues
    .map(issue => ISSUE_TO_OPERATION[issue.type])
    .filter((op): op is MigrationOperation => op !== null);

  if (operations.length === 0) return null;

  // Priority order: restructure > move > rename
  if (operations.includes('restructure')) return 'restructure';
  if (operations.includes('move')) return 'move';
  return 'rename';
}

/**
 * Builds a human-readable reason string from file issues
 */
function buildReason(file: NonConformingFile): string {
  const fileOpIssues = file.issues.filter(i => ISSUE_TO_OPERATION[i.type] !== null);

  if (fileOpIssues.length === 1) {
    return ISSUE_REASONS[fileOpIssues[0].type];
  }

  // Multiple issues - combine reasons
  return fileOpIssues.map(i => ISSUE_REASONS[i.type]).join('; ');
}

/**
 * Detects potential conflicts in the migration plan
 */
function detectConflicts(preview: MigrationPreview): string[] {
  const warnings: string[] = [];
  const targetPaths = new Map<string, string[]>();

  // Collect all target paths
  for (const operation of ['rename', 'restructure', 'move'] as const) {
    for (const item of preview.by_operation[operation]) {
      const existing = targetPaths.get(item.target) || [];
      existing.push(item.source);
      targetPaths.set(item.target, existing);
    }
  }

  // Check for conflicts (multiple sources -> same target)
  for (const [target, sources] of targetPaths) {
    if (sources.length > 1) {
      warnings.push(`Conflict: Multiple files would migrate to ${target}: ${sources.join(', ')}`);
    }
  }

  return warnings;
}

/**
 * Formats a migration preview as a visual text box
 */
export function formatPreviewText(preview: MigrationPreview): string {
  const BOX_WIDTH = 72;
  const INNER_WIDTH = BOX_WIDTH - 4; // Account for borders and padding

  const lines: string[] = [];

  // Top border
  lines.push(`\u256D\u2500 MIGRATION PREVIEW ${'─'.repeat(BOX_WIDTH - 22)}\u256E`);
  lines.push(`\u2502${' '.repeat(BOX_WIDTH - 2)}\u2502`);

  // Summary
  lines.push(padLine(`Total changes: ${preview.total_changes}`, BOX_WIDTH));
  lines.push(padLine(`Auto-fixable: ${preview.auto_fixable_count}  |  Needs review: ${preview.needs_review_count}`, BOX_WIDTH));
  lines.push(`\u2502${' '.repeat(BOX_WIDTH - 2)}\u2502`);

  // Each operation section
  const operations: Array<{ key: 'rename' | 'restructure' | 'move'; label: string }> = [
    { key: 'rename', label: 'RENAME' },
    { key: 'restructure', label: 'RESTRUCTURE' },
    { key: 'move', label: 'MOVE' }
  ];

  for (const { key, label } of operations) {
    const items = preview.by_operation[key];
    if (items.length === 0) continue;

    // Section header
    const headerText = `${label} (${items.length} files)`;
    const headerPadding = INNER_WIDTH - headerText.length - 6;
    lines.push(`\u2502  \u250C\u2500 ${headerText} ${'─'.repeat(Math.max(0, headerPadding))}\u2510  \u2502`);

    // Items (limit to first 10 per section for readability)
    const displayItems = items.slice(0, 10);
    for (const item of displayItems) {
      const itemText = `${item.source} → ${item.target}`;
      if (itemText.length <= INNER_WIDTH - 6) {
        lines.push(`\u2502  \u2502 ${itemText.padEnd(INNER_WIDTH - 6)} \u2502  \u2502`);
      } else {
        // Truncate long paths
        const truncated = truncatePath(item.source, item.target, INNER_WIDTH - 6);
        lines.push(`\u2502  \u2502 ${truncated.padEnd(INNER_WIDTH - 6)} \u2502  \u2502`);
      }
    }

    if (items.length > 10) {
      const moreText = `... and ${items.length - 10} more`;
      lines.push(`\u2502  \u2502 ${moreText.padEnd(INNER_WIDTH - 6)} \u2502  \u2502`);
    }

    // Section footer
    lines.push(`\u2502  \u2514${'─'.repeat(INNER_WIDTH - 4)}\u2518  \u2502`);
    lines.push(`\u2502${' '.repeat(BOX_WIDTH - 2)}\u2502`);
  }

  // Warnings section
  if (preview.warnings.length > 0) {
    lines.push(`\u2502  \u26A0 WARNINGS:${' '.repeat(INNER_WIDTH - 12)}  \u2502`);
    for (const warning of preview.warnings) {
      const wrappedWarning = wrapText(warning, INNER_WIDTH - 6);
      for (const line of wrappedWarning) {
        lines.push(`\u2502  ${line.padEnd(INNER_WIDTH - 2)}  \u2502`);
      }
    }
    lines.push(`\u2502${' '.repeat(BOX_WIDTH - 2)}\u2502`);
  }

  // Bottom border
  lines.push(`\u2570${'─'.repeat(BOX_WIDTH - 2)}\u256F`);

  return lines.join('\n');
}

/**
 * Pads a line to fit within the box
 */
function padLine(text: string, boxWidth: number): string {
  const contentWidth = boxWidth - 4;
  return `\u2502  ${text.padEnd(contentWidth)}\u2502`;
}

/**
 * Truncates source and target paths to fit within max length
 */
function truncatePath(source: string, target: string, maxLen: number): string {
  const arrow = ' → ';
  const availableLen = maxLen - arrow.length;

  // Try to show full target, truncate source if needed
  const halfLen = Math.floor(availableLen / 2);

  let src = source;
  let tgt = target;

  if (source.length > halfLen) {
    src = '...' + source.slice(-(halfLen - 3));
  }

  if (target.length > halfLen) {
    tgt = '...' + target.slice(-(halfLen - 3));
  }

  return `${src}${arrow}${tgt}`;
}

/**
 * Wraps text to fit within a maximum width
 */
function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}
