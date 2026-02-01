/**
 * .agents/ Content Audit Module
 *
 * Provides functionality to scan and categorize all files in the .agents/ directory
 * to determine migration scope and category mapping for Brain memory system.
 *
 * This module supports the ADR-020 migration by:
 * 1. Scanning .agents/ directory recursively
 * 2. Categorizing files by entity type (session, analysis, ADR, etc.)
 * 3. Identifying files that don't match known patterns
 * 4. Generating audit reports with statistics
 *
 * @see ADR-020 for the configuration architecture decision
 * @see TASK-020-08 for the audit task specification
 */

import * as fs from "fs";
import * as path from "path";

/**
 * Entity categories from ADR-020 mapping.
 * Each category corresponds to a Brain memory folder.
 */
export enum AgentEntityCategory {
  /** Session logs: YYYY-MM-DD-session-NN-*.md */
  SESSIONS = "sessions",
  /** Research findings, CVAs, impact assessments */
  ANALYSIS = "analysis",
  /** ADRs and design documents */
  ARCHITECTURE = "architecture",
  /** PRDs, milestones, task breakdowns */
  PLANNING = "planning",
  /** Plan reviews, approval/rejection documents */
  CRITIQUE = "critique",
  /** Test strategies and reports */
  QA = "qa",
  /** EARS requirements, design docs, task specs */
  SPECS = "specs",
  /** Session retrospectives, skill extractions */
  RETROSPECTIVE = "retrospective",
  /** Learned skills and strategies */
  SKILLS = "skills",
  /** Naming conventions, consistency protocols */
  GOVERNANCE = "governance",
  /** Epics, prioritization, product roadmap */
  ROADMAP = "roadmap",
  /** Threat models, security reviews */
  SECURITY = "security",
  /** Files that don't match any known pattern */
  UNKNOWN = "unknown",
}

/**
 * Pattern definition for entity type detection.
 */
export interface EntityPattern {
  /** Type identifier */
  type: string;
  /** Regex to match filenames */
  regex: RegExp;
  /** Human-readable description */
  description: string;
}

/**
 * File pattern definitions for entity type detection.
 * IMPORTANT: Order matters! More specific patterns must come before generic ones.
 * The matching algorithm checks patterns in array order and returns the first match.
 */
export const ENTITY_PATTERNS: EntityPattern[] = [
  // Session logs: YYYY-MM-DD-session-NN-*.md (most specific date pattern)
  {
    type: "SESSION_LOG",
    regex: /^\d{4}-\d{2}-\d{2}-session-\d+.*\.md$/,
    description: "Session log (YYYY-MM-DD-session-NN-*.md)",
  },
  // Backup files: *.md.bak (check before other patterns)
  {
    type: "BACKUP",
    regex: /.*\.md\.bak$/i,
    description: "Backup file (*.md.bak)",
  },
  // Task spec: TASK-NNN-*.md or TASK-SUMMARY.md
  {
    type: "TASK_SPEC",
    regex: /^TASK-\d{3}-.*\.md$/i,
    description: "Task specification (TASK-NNN-*.md)",
  },
  // Requirement: REQ-NNN-*.md
  {
    type: "REQUIREMENT",
    regex: /^REQ-\d{3}-.*\.md$/i,
    description: "Requirement (REQ-NNN-*.md)",
  },
  // Design doc: DESIGN-*.md
  {
    type: "DESIGN_DOC",
    regex: /^DESIGN-.*\.md$/i,
    description: "Design document (DESIGN-*.md)",
  },
  // Threat model: TM-NNN-*.md
  {
    type: "THREAT_MODEL",
    regex: /^TM-\d{3}-.*\.md$/i,
    description: "Threat model (TM-NNN-*.md)",
  },
  // REVIEW-*.md (specific prefix before generic -review suffix)
  {
    type: "REVIEW",
    regex: /^REVIEW-.*\.md$/i,
    description: "Review document (REVIEW-*.md)",
  },
  // ADR-NNN-*debate-log*.md (must come before generic ADR)
  // Matches: ADR-020-debate-log.md, ADR-017-debate-log-round-1.md
  {
    type: "DEBATE_LOG",
    regex: /^ADR-\d{3}-.*debate-log.*\.md$/i,
    description: "ADR debate log (ADR-NNN-*debate-log*.md)",
  },
  // ADR-NNN-*-review.md (must come before generic ADR)
  // Matches: ADR-003-security-review.md, ADR-020-qa-review.md
  {
    type: "ADR_REVIEW",
    regex: /^ADR-\d{3}-.*-review\.md$/i,
    description: "ADR review document (ADR-NNN-*-review.md)",
  },
  // ADR-NNN-*-summary.md (must come before generic ADR)
  // Matches: ADR-016-plan-revision-summary.md
  {
    type: "ADR_SUMMARY",
    regex: /^ADR-\d{3}-.*-summary\.md$/i,
    description: "ADR summary document (ADR-NNN-*-summary.md)",
  },
  // ADR-NNN-*-plan.md (must come before generic ADR)
  // Matches: ADR-016-implementation-plan.md
  {
    type: "PLAN",
    regex: /^ADR-\d{3}-.*-plan\.md$/i,
    description: "ADR implementation plan (ADR-NNN-*-plan.md)",
  },
  // ADR-NNN-*-(validation|test-report).md (must come before generic ADR)
  // Matches: ADR-016-test-report.md, ADR-016-qa-validation.md
  {
    type: "ADR_VALIDATION",
    regex: /^ADR-\d{3}-.*(validation|test-report)\.md$/i,
    description: "ADR validation/test report (ADR-NNN-*-validation.md)",
  },
  // Generic ADR: ADR-NNN-*.md (after all specific ADR patterns)
  {
    type: "ADR",
    regex: /^ADR-\d{3}-.*\.md$/i,
    description: "Architecture Decision Record (ADR-NNN-*.md)",
  },
  // Plan: NNN-*-plan.md (non-ADR plans)
  {
    type: "PLAN",
    regex: /^\d{3}-.+-plan\.md$/i,
    description: "Implementation plan (NNN-*-plan.md)",
  },
  // Analysis: NNN-*-analysis.md or descriptive names
  {
    type: "ANALYSIS",
    regex: /^\d{3}-.+-analysis\.md$|^.*-analysis\.md$/i,
    description: "Analysis document (NNN-*-analysis.md)",
  },
  // Validation/QA: *-validation.md or *-test-report.md (non-ADR)
  {
    type: "VALIDATION",
    regex: /.*-validation\.md$|.*-test-report\.md$/i,
    description: "Validation/test report (*-validation.md)",
  },
  // Debate log: *-debate-log*.md (non-ADR)
  {
    type: "DEBATE_LOG",
    regex: /.*-debate-log.*\.md$/i,
    description: "Debate log (*-debate-log*.md)",
  },
  // Review: *-review.md (non-prefix)
  {
    type: "REVIEW",
    regex: /.*-review\.md$/i,
    description: "Review document (*-review.md)",
  },
  // Summary: *-summary.md or TASK-SUMMARY.md
  {
    type: "SUMMARY",
    regex: /.*-summary\.md$|^TASK-SUMMARY\.md$/i,
    description: "Summary document (*-summary.md)",
  },
  // Checklist: *-checklist.md or VERIFICATION-CHECKLIST.md
  {
    type: "CHECKLIST",
    regex: /.*-checklist\.md$/i,
    description: "Checklist document (*-checklist.md)",
  },
  // README: README.md
  {
    type: "README",
    regex: /^README\.md$/i,
    description: "README file (README.md)",
  },
  // Generic markdown (fallback, must be last)
  {
    type: "GENERIC_MD",
    regex: /.*\.md$/i,
    description: "Generic markdown file",
  },
];

/**
 * Pattern lookup by type for backward compatibility.
 */
export const ENTITY_PATTERNS_BY_TYPE: Record<string, EntityPattern> =
  ENTITY_PATTERNS.reduce(
    (acc, pattern) => {
      acc[pattern.type] = pattern;
      return acc;
    },
    {} as Record<string, EntityPattern>,
  );

/**
 * Audited file information.
 */
export interface AuditedFile {
  /** Full path to the file */
  path: string;
  /** Relative path from .agents/ root */
  relativePath: string;
  /** File name without path */
  filename: string;
  /** Detected entity category */
  category: AgentEntityCategory;
  /** Detected entity type pattern */
  entityType: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Last modified date */
  modifiedAt: Date;
  /** Suggested Brain memory title */
  suggestedTitle: string;
  /** Suggested Brain memory folder */
  suggestedFolder: string;
  /** Whether file matches a known pattern */
  matched: boolean;
}

/**
 * Category statistics for audit report.
 */
export interface CategoryStats {
  /** Category name */
  category: AgentEntityCategory;
  /** Number of files in this category */
  fileCount: number;
  /** Total size in bytes */
  totalSizeBytes: number;
  /** List of files in this category */
  files: AuditedFile[];
}

/**
 * Complete audit report structure.
 */
export interface AgentsAuditReport {
  /** Timestamp when audit was performed */
  timestamp: Date;
  /** Root path that was scanned */
  rootPath: string;
  /** Total number of files found */
  totalFiles: number;
  /** Total size in bytes */
  totalSizeBytes: number;
  /** Number of files that matched known patterns */
  matchedFiles: number;
  /** Number of files that did not match any pattern */
  unmatchedFiles: number;
  /** Statistics per category */
  categories: Map<AgentEntityCategory, CategoryStats>;
  /** List of unmapped files (warnings) */
  warnings: AuditedFile[];
  /** All audited files */
  allFiles: AuditedFile[];
}

/**
 * Determine the category based on directory path.
 *
 * @param relativePath - Path relative to .agents/ root
 * @returns Category enum value
 */
export function getCategoryFromPath(relativePath: string): AgentEntityCategory {
  const parts = relativePath.split(path.sep);
  const firstDir = parts[0]?.toLowerCase();

  switch (firstDir) {
    case "sessions":
      return AgentEntityCategory.SESSIONS;
    case "analysis":
      return AgentEntityCategory.ANALYSIS;
    case "architecture":
      return AgentEntityCategory.ARCHITECTURE;
    case "planning":
      return AgentEntityCategory.PLANNING;
    case "critique":
      return AgentEntityCategory.CRITIQUE;
    case "qa":
      return AgentEntityCategory.QA;
    case "specs":
      return AgentEntityCategory.SPECS;
    case "retrospective":
      return AgentEntityCategory.RETROSPECTIVE;
    case "skills":
      return AgentEntityCategory.SKILLS;
    case "governance":
      return AgentEntityCategory.GOVERNANCE;
    case "roadmap":
      return AgentEntityCategory.ROADMAP;
    case "security":
      return AgentEntityCategory.SECURITY;
    default:
      return AgentEntityCategory.UNKNOWN;
  }
}

/**
 * Determine the entity type pattern that matches a filename.
 * Patterns are checked in array order (most specific first).
 *
 * @param filename - File name to check
 * @returns Entity type key or "UNKNOWN"
 */
export function getEntityType(filename: string): string {
  // Check patterns in order (specific patterns before generic)
  for (const pattern of ENTITY_PATTERNS) {
    // Skip GENERIC_MD during first pass (it's a fallback)
    if (pattern.type === "GENERIC_MD") continue;
    if (pattern.regex.test(filename)) {
      return pattern.type;
    }
  }
  // Check if it's at least a markdown file (fallback)
  const genericPattern = ENTITY_PATTERNS.find((p) => p.type === "GENERIC_MD");
  if (genericPattern && genericPattern.regex.test(filename)) {
    return "GENERIC_MD";
  }
  return "UNKNOWN";
}

/**
 * Generate a suggested Brain memory title from a file path.
 *
 * Title transformation rules from ADR-020:
 * - .agents/sessions/2026-01-31-session-44-topic.md -> session-2026-01-31-44-topic
 * - .agents/architecture/ADR-020-title.md -> ADR-020-title
 * - .agents/planning/001-feature-plan.md -> plan-001-feature
 *
 * @param relativePath - Path relative to .agents/ root
 * @param filename - File name without extension
 * @param category - Detected category
 * @returns Suggested title for Brain memory
 */
export function generateSuggestedTitle(
  relativePath: string,
  filename: string,
  category: AgentEntityCategory,
): string {
  // Remove .md extension
  const baseName = filename.replace(/\.md(\.bak)?$/i, "");

  // Session logs: YYYY-MM-DD-session-NN-topic -> session-YYYY-MM-DD-NN-topic
  const sessionMatch = baseName.match(
    /^(\d{4}-\d{2}-\d{2})-session-(\d+)(.*)$/,
  );
  if (sessionMatch) {
    const [, date, num, rest] = sessionMatch;
    return `session-${date}-${num}${rest}`;
  }

  // ADRs: Keep as-is (ADR-020-title)
  if (baseName.match(/^ADR-\d{3}/i)) {
    return baseName;
  }

  // Plans: NNN-feature-plan -> plan-NNN-feature
  const planMatch = baseName.match(/^(\d{3})-(.+)-plan$/i);
  if (planMatch) {
    const [, num, feature] = planMatch;
    return `plan-${num}-${feature}`;
  }

  // Tasks: TASK-NNN-title -> Keep as-is
  if (baseName.match(/^TASK-\d{3}/i)) {
    return baseName;
  }

  // Requirements: REQ-NNN-title -> Keep as-is
  if (baseName.match(/^REQ-\d{3}/i)) {
    return baseName;
  }

  // Design docs: DESIGN-title -> Keep as-is
  if (baseName.match(/^DESIGN-/i)) {
    return baseName;
  }

  // For nested specs files, include parent context
  if (category === AgentEntityCategory.SPECS) {
    const parts = relativePath.split(path.sep);
    if (parts.length > 2) {
      // e.g., specs/ADR-016-session-protocol-enforcement/tasks/TASK-001.md
      const specName = parts[1]; // ADR-016-session-protocol-enforcement
      const subDir = parts[2]; // tasks, requirements, design
      return `${specName}-${subDir}-${baseName}`;
    }
  }

  // Default: use basename with category prefix if generic
  if (baseName.match(/^\d{3}-/)) {
    return `${category}-${baseName}`;
  }

  return baseName;
}

/**
 * Scan a directory recursively and return all file paths.
 *
 * @param dirPath - Directory to scan
 * @param files - Accumulator for file paths (internal)
 * @returns Array of absolute file paths
 */
function scanDirectory(dirPath: string, files: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) {
    return files;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Audit a single file and return its metadata.
 *
 * @param filePath - Absolute path to the file
 * @param rootPath - Root .agents/ directory path
 * @returns Audited file information
 */
function auditFile(filePath: string, rootPath: string): AuditedFile {
  const relativePath = path.relative(rootPath, filePath);
  const filename = path.basename(filePath);
  const stats = fs.statSync(filePath);

  const category = getCategoryFromPath(relativePath);
  const entityType = getEntityType(filename);
  const matched = entityType !== "UNKNOWN" && entityType !== "GENERIC_MD";

  const suggestedTitle = generateSuggestedTitle(
    relativePath,
    filename,
    category,
  );
  const suggestedFolder =
    category === AgentEntityCategory.UNKNOWN ? "uncategorized" : category;

  return {
    path: filePath,
    relativePath,
    filename,
    category,
    entityType,
    sizeBytes: stats.size,
    modifiedAt: stats.mtime,
    suggestedTitle,
    suggestedFolder,
    matched,
  };
}

/**
 * Scan and categorize all files in the .agents/ directory.
 *
 * @param agentsPath - Path to the .agents/ directory
 * @returns Array of audited file information
 */
export function auditAgentsDirectory(agentsPath: string): AuditedFile[] {
  if (!fs.existsSync(agentsPath)) {
    throw new Error(`Path does not exist: ${agentsPath}`);
  }

  const stats = fs.statSync(agentsPath);
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${agentsPath}`);
  }

  const filePaths = scanDirectory(agentsPath);
  const auditedFiles: AuditedFile[] = [];

  for (const filePath of filePaths) {
    try {
      const audited = auditFile(filePath, agentsPath);
      auditedFiles.push(audited);
    } catch (error) {
      // Log error but continue auditing
      console.error(`Failed to audit file ${filePath}: ${error}`);
    }
  }

  return auditedFiles;
}

/**
 * Generate a complete audit report from audited files.
 *
 * @param auditedFiles - Array of audited file information
 * @param rootPath - Root .agents/ directory path
 * @returns Complete audit report
 */
export function generateAuditReport(
  auditedFiles: AuditedFile[],
  rootPath: string,
): AgentsAuditReport {
  const categories = new Map<AgentEntityCategory, CategoryStats>();

  // Initialize all categories
  for (const category of Object.values(AgentEntityCategory)) {
    categories.set(category, {
      category,
      fileCount: 0,
      totalSizeBytes: 0,
      files: [],
    });
  }

  // Categorize files
  let totalSizeBytes = 0;
  let matchedFiles = 0;
  let unmatchedFiles = 0;
  const warnings: AuditedFile[] = [];

  for (const file of auditedFiles) {
    const categoryStats = categories.get(file.category);
    if (categoryStats) {
      categoryStats.fileCount++;
      categoryStats.totalSizeBytes += file.sizeBytes;
      categoryStats.files.push(file);
    }

    totalSizeBytes += file.sizeBytes;

    if (file.matched) {
      matchedFiles++;
    } else {
      unmatchedFiles++;
      warnings.push(file);
    }
  }

  return {
    timestamp: new Date(),
    rootPath,
    totalFiles: auditedFiles.length,
    totalSizeBytes,
    matchedFiles,
    unmatchedFiles,
    categories,
    warnings,
    allFiles: auditedFiles,
  };
}

/**
 * Format file size in human-readable format.
 *
 * @param bytes - Size in bytes
 * @returns Formatted size string (e.g., "1.5 KB")
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Generate a formatted text report from an audit report.
 *
 * @param report - Audit report to format
 * @returns Formatted text report
 */
export function formatAuditReport(report: AgentsAuditReport): string {
  const lines: string[] = [];

  lines.push("=".repeat(80));
  lines.push(".agents/ Content Audit Report");
  lines.push("=".repeat(80));
  lines.push("");
  lines.push(`Timestamp: ${report.timestamp.toISOString()}`);
  lines.push(`Root Path: ${report.rootPath}`);
  lines.push("");
  lines.push("-".repeat(40));
  lines.push("Summary");
  lines.push("-".repeat(40));
  lines.push(`Total Files: ${report.totalFiles}`);
  lines.push(`Total Size: ${formatSize(report.totalSizeBytes)}`);
  lines.push(`Matched Files: ${report.matchedFiles}`);
  lines.push(`Unmatched Files: ${report.unmatchedFiles}`);
  lines.push("");

  lines.push("-".repeat(40));
  lines.push("Files by Category");
  lines.push("-".repeat(40));
  lines.push("");

  // Sort categories by file count (descending)
  const sortedCategories = Array.from(report.categories.values())
    .filter((cat) => cat.fileCount > 0)
    .sort((a, b) => b.fileCount - a.fileCount);

  for (const cat of sortedCategories) {
    lines.push(`## ${cat.category.toUpperCase()}`);
    lines.push(`   Files: ${cat.fileCount}`);
    lines.push(`   Size: ${formatSize(cat.totalSizeBytes)}`);
    lines.push(
      `   Brain Folder: ${cat.category === AgentEntityCategory.UNKNOWN ? "uncategorized" : cat.category}`,
    );
    lines.push("");
  }

  if (report.warnings.length > 0) {
    lines.push("-".repeat(40));
    lines.push("[WARNING] Unmapped Files");
    lines.push("-".repeat(40));
    lines.push("");
    for (const file of report.warnings) {
      lines.push(`  - ${file.relativePath}`);
      lines.push(`    Type: ${file.entityType}`);
      lines.push(`    Suggested Title: ${file.suggestedTitle}`);
      lines.push(`    Suggested Folder: ${file.suggestedFolder}`);
      lines.push("");
    }
  }

  lines.push("-".repeat(40));
  lines.push("Migration Mapping");
  lines.push("-".repeat(40));
  lines.push("");
  lines.push("| Source Directory | Brain Memory Category | File Count |");
  lines.push("|------------------|----------------------|------------|");

  for (const cat of sortedCategories) {
    const sourceDir = `.agents/${cat.category}/`;
    const brainCategory =
      cat.category === AgentEntityCategory.UNKNOWN
        ? "uncategorized"
        : cat.category;
    lines.push(
      `| ${sourceDir.padEnd(18)} | ${brainCategory.padEnd(20)} | ${cat.fileCount.toString().padStart(10)} |`,
    );
  }

  lines.push("");
  lines.push("=".repeat(80));
  lines.push("End of Report");
  lines.push("=".repeat(80));

  return lines.join("\n");
}

/**
 * Run a complete audit of the .agents/ directory and return results.
 *
 * This is the main entry point for the audit functionality.
 *
 * @param agentsPath - Path to the .agents/ directory
 * @returns Object containing audited files and formatted report
 *
 * @example
 * ```typescript
 * const { report, formattedReport, files } = runAgentsAudit("/path/to/.agents");
 * console.log(formattedReport);
 * ```
 */
export function runAgentsAudit(agentsPath: string): {
  files: AuditedFile[];
  report: AgentsAuditReport;
  formattedReport: string;
} {
  const files = auditAgentsDirectory(agentsPath);
  const report = generateAuditReport(files, agentsPath);
  const formattedReport = formatAuditReport(report);

  return { files, report, formattedReport };
}
