/**
 * Unit tests for .agents/ Content Audit module.
 *
 * Tests TASK-020-08 requirements:
 * - auditAgentsDirectory(): Scan and categorize files
 * - generateAuditReport(): Produce summary statistics
 * - Category mapping from ADR-020
 * - File pattern matching for entity types
 * - formatAuditReport(): Generate human-readable output
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  AgentEntityCategory,
  ENTITY_PATTERNS,
  getCategoryFromPath,
  getEntityType,
  generateSuggestedTitle,
  auditAgentsDirectory,
  generateAuditReport,
  formatAuditReport,
  runAgentsAudit,
} from "../agents-audit";

/**
 * Create a temporary test directory with mock .agents/ structure.
 */
function createTestAgentsDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agents-audit-test-"));
  return tempDir;
}

/**
 * Create a mock file in the test directory.
 */
function createMockFile(baseDir: string, relativePath: string, content: string = "# Test"): void {
  const fullPath = path.join(baseDir, relativePath);
  const dir = path.dirname(fullPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content);
}

/**
 * Clean up test directory.
 */
function cleanupTestDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

describe("getCategoryFromPath", () => {
  test("detects sessions category", () => {
    expect(getCategoryFromPath("sessions/2026-01-31-session-01.md")).toBe(AgentEntityCategory.SESSIONS);
  });

  test("detects analysis category", () => {
    expect(getCategoryFromPath("analysis/001-configuration-analysis.md")).toBe(AgentEntityCategory.ANALYSIS);
  });

  test("detects architecture category", () => {
    expect(getCategoryFromPath("architecture/ADR-020-config.md")).toBe(AgentEntityCategory.ARCHITECTURE);
    expect(getCategoryFromPath("architecture/decision/ADR-020-config.md")).toBe(AgentEntityCategory.ARCHITECTURE);
  });

  test("detects planning category", () => {
    expect(getCategoryFromPath("planning/001-feature-plan.md")).toBe(AgentEntityCategory.PLANNING);
  });

  test("detects critique category", () => {
    expect(getCategoryFromPath("critique/ADR-020-debate-log.md")).toBe(AgentEntityCategory.CRITIQUE);
  });

  test("detects qa category", () => {
    expect(getCategoryFromPath("qa/001-validation.md")).toBe(AgentEntityCategory.QA);
  });

  test("detects specs category", () => {
    expect(getCategoryFromPath("specs/ADR-016/tasks/TASK-001.md")).toBe(AgentEntityCategory.SPECS);
  });

  test("detects security category", () => {
    expect(getCategoryFromPath("security/TM-001-threat-model.md")).toBe(AgentEntityCategory.SECURITY);
  });

  test("returns unknown for unrecognized paths", () => {
    expect(getCategoryFromPath("random/file.md")).toBe(AgentEntityCategory.UNKNOWN);
    expect(getCategoryFromPath("file.md")).toBe(AgentEntityCategory.UNKNOWN);
  });
});

describe("getEntityType", () => {
  test("detects session log pattern", () => {
    expect(getEntityType("2026-01-31-session-01.md")).toBe("SESSION_LOG");
    expect(getEntityType("2026-01-31-session-44-topic.md")).toBe("SESSION_LOG");
    expect(getEntityType("2026-01-18-session-01-phase2-integration-tests.md")).toBe("SESSION_LOG");
  });

  test("detects ADR pattern", () => {
    expect(getEntityType("ADR-020-configuration-architecture.md")).toBe("ADR");
    expect(getEntityType("ADR-001-search-service.md")).toBe("ADR");
  });

  test("detects task spec pattern", () => {
    expect(getEntityType("TASK-001-session-state-types.md")).toBe("TASK_SPEC");
    expect(getEntityType("TASK-020-integrate-skill.md")).toBe("TASK_SPEC");
  });

  test("detects requirement pattern", () => {
    expect(getEntityType("REQ-001-session-state-schema.md")).toBe("REQUIREMENT");
    expect(getEntityType("REQ-018-slash-command.md")).toBe("REQUIREMENT");
  });

  test("detects design doc pattern", () => {
    expect(getEntityType("DESIGN-001-session-state-architecture.md")).toBe("DESIGN_DOC");
    expect(getEntityType("DESIGN-unified-projects.md")).toBe("DESIGN_DOC");
  });

  test("detects threat model pattern", () => {
    expect(getEntityType("TM-001-project-deletion.md")).toBe("THREAT_MODEL");
  });

  test("detects plan pattern", () => {
    expect(getEntityType("001-feature-plan.md")).toBe("PLAN");
    // ADR plans are detected specifically
    expect(getEntityType("ADR-016-implementation-plan.md")).toBe("PLAN");
  });

  test("detects validation pattern", () => {
    expect(getEntityType("001-validation.md")).toBe("VALIDATION");
    // ADR validations are detected specifically
    expect(getEntityType("ADR-016-test-report.md")).toBe("ADR_VALIDATION");
    // Non-ADR validation
    expect(getEntityType("pre-pr-validation.md")).toBe("VALIDATION");
  });

  test("detects debate log pattern", () => {
    // ADR debate logs
    expect(getEntityType("ADR-020-debate-log.md")).toBe("DEBATE_LOG");
    expect(getEntityType("ADR-017-debate-log-round-1.md")).toBe("DEBATE_LOG");
    // Non-ADR debate logs
    expect(getEntityType("memory-embeddings-debate-log.md")).toBe("DEBATE_LOG");
  });

  test("detects review pattern", () => {
    // ADR reviews
    expect(getEntityType("ADR-003-security-review.md")).toBe("ADR_REVIEW");
    // REVIEW-* prefix
    expect(getEntityType("REVIEW-ADR-002-architect.md")).toBe("REVIEW");
    // Generic -review suffix
    expect(getEntityType("pr-001-security-review.md")).toBe("REVIEW");
  });

  test("detects summary pattern", () => {
    expect(getEntityType("TASK-SUMMARY.md")).toBe("SUMMARY");
    // ADR summaries
    expect(getEntityType("ADR-016-plan-revision-summary.md")).toBe("ADR_SUMMARY");
    // Non-ADR summaries
    expect(getEntityType("project-summary.md")).toBe("SUMMARY");
  });

  test("detects checklist pattern", () => {
    expect(getEntityType("VERIFICATION-CHECKLIST.md")).toBe("CHECKLIST");
  });

  test("detects README pattern", () => {
    expect(getEntityType("README.md")).toBe("README");
  });

  test("detects backup files", () => {
    expect(getEntityType("2026-01-19-session-01.md.bak")).toBe("BACKUP");
  });

  test("returns GENERIC_MD for unrecognized markdown files", () => {
    expect(getEntityType("random-file.md")).toBe("GENERIC_MD");
    expect(getEntityType("memory-architecture-comparison.md")).toBe("GENERIC_MD");
  });

  test("returns UNKNOWN for non-markdown files", () => {
    expect(getEntityType("file.txt")).toBe("UNKNOWN");
    expect(getEntityType("config.json")).toBe("UNKNOWN");
  });
});

describe("generateSuggestedTitle", () => {
  test("transforms session logs", () => {
    expect(generateSuggestedTitle(
      "sessions/2026-01-31-session-44-topic.md",
      "2026-01-31-session-44-topic.md",
      AgentEntityCategory.SESSIONS
    )).toBe("session-2026-01-31-44-topic");
  });

  test("preserves ADR titles", () => {
    expect(generateSuggestedTitle(
      "architecture/ADR-020-config.md",
      "ADR-020-config.md",
      AgentEntityCategory.ARCHITECTURE
    )).toBe("ADR-020-config");
  });

  test("transforms plan titles", () => {
    expect(generateSuggestedTitle(
      "planning/001-feature-plan.md",
      "001-feature-plan.md",
      AgentEntityCategory.PLANNING
    )).toBe("plan-001-feature");
  });

  test("preserves TASK titles", () => {
    expect(generateSuggestedTitle(
      "specs/ADR-016/tasks/TASK-001-session-state.md",
      "TASK-001-session-state.md",
      AgentEntityCategory.SPECS
    )).toBe("TASK-001-session-state");
  });

  test("preserves REQ titles", () => {
    expect(generateSuggestedTitle(
      "specs/ADR-016/requirements/REQ-001-schema.md",
      "REQ-001-schema.md",
      AgentEntityCategory.SPECS
    )).toBe("REQ-001-schema");
  });

  test("preserves DESIGN titles", () => {
    expect(generateSuggestedTitle(
      "architecture/DESIGN-001-session-state.md",
      "DESIGN-001-session-state.md",
      AgentEntityCategory.ARCHITECTURE
    )).toBe("DESIGN-001-session-state");
  });

  test("includes parent context for nested specs", () => {
    expect(generateSuggestedTitle(
      "specs/ADR-016-session-protocol-enforcement/tasks/TASK-001.md",
      "TASK-001.md",
      AgentEntityCategory.SPECS
    )).toBe("TASK-001");
  });

  test("prefixes generic numbered files with category", () => {
    expect(generateSuggestedTitle(
      "analysis/025-mcp-connection-error.md",
      "025-mcp-connection-error.md",
      AgentEntityCategory.ANALYSIS
    )).toBe("analysis-025-mcp-connection-error");
  });

  test("keeps generic names without numbering", () => {
    expect(generateSuggestedTitle(
      "analysis/memory-architecture-comparison.md",
      "memory-architecture-comparison.md",
      AgentEntityCategory.ANALYSIS
    )).toBe("memory-architecture-comparison");
  });

  test("handles backup files", () => {
    expect(generateSuggestedTitle(
      "sessions/2026-01-19-session-01.md.bak",
      "2026-01-19-session-01.md.bak",
      AgentEntityCategory.SESSIONS
    )).toBe("session-2026-01-19-01");
  });
});

describe("auditAgentsDirectory", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = createTestAgentsDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  test("scans empty directory", () => {
    const files = auditAgentsDirectory(testDir);
    expect(files).toEqual([]);
  });

  test("scans single file", () => {
    createMockFile(testDir, "sessions/2026-01-31-session-01.md");
    const files = auditAgentsDirectory(testDir);

    expect(files.length).toBe(1);
    expect(files[0].filename).toBe("2026-01-31-session-01.md");
    expect(files[0].category).toBe(AgentEntityCategory.SESSIONS);
    expect(files[0].entityType).toBe("SESSION_LOG");
    expect(files[0].matched).toBe(true);
  });

  test("scans nested directory structure", () => {
    createMockFile(testDir, "sessions/2026-01-31-session-01.md");
    createMockFile(testDir, "analysis/001-analysis.md");
    createMockFile(testDir, "architecture/decision/ADR-020-config.md");
    createMockFile(testDir, "specs/ADR-016/tasks/TASK-001.md");

    const files = auditAgentsDirectory(testDir);
    expect(files.length).toBe(4);

    const categories = files.map(f => f.category);
    expect(categories).toContain(AgentEntityCategory.SESSIONS);
    expect(categories).toContain(AgentEntityCategory.ANALYSIS);
    expect(categories).toContain(AgentEntityCategory.ARCHITECTURE);
    expect(categories).toContain(AgentEntityCategory.SPECS);
  });

  test("throws for non-existent path", () => {
    expect(() => auditAgentsDirectory("/nonexistent/path")).toThrow();
  });

  test("throws for file path instead of directory", () => {
    const filePath = path.join(testDir, "file.md");
    fs.writeFileSync(filePath, "test");
    expect(() => auditAgentsDirectory(filePath)).toThrow();
  });

  test("sets matched=false for unrecognized patterns", () => {
    createMockFile(testDir, "random/generic-file.md");
    const files = auditAgentsDirectory(testDir);

    expect(files.length).toBe(1);
    expect(files[0].entityType).toBe("GENERIC_MD");
    expect(files[0].matched).toBe(false);
  });

  test("includes file metadata", () => {
    const content = "# Test Content\n\nThis is test content.";
    createMockFile(testDir, "sessions/2026-01-31-session-01.md", content);

    const files = auditAgentsDirectory(testDir);
    expect(files[0].sizeBytes).toBe(content.length);
    expect(files[0].modifiedAt).toBeInstanceOf(Date);
  });
});

describe("generateAuditReport", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = createTestAgentsDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  test("generates report for empty directory", () => {
    const files = auditAgentsDirectory(testDir);
    const report = generateAuditReport(files, testDir);

    expect(report.totalFiles).toBe(0);
    expect(report.totalSizeBytes).toBe(0);
    expect(report.matchedFiles).toBe(0);
    expect(report.unmatchedFiles).toBe(0);
    expect(report.warnings.length).toBe(0);
  });

  test("generates report with category statistics", () => {
    createMockFile(testDir, "sessions/2026-01-31-session-01.md", "Session 1");
    createMockFile(testDir, "sessions/2026-01-31-session-02.md", "Session 2");
    createMockFile(testDir, "analysis/001-analysis.md", "Analysis");

    const files = auditAgentsDirectory(testDir);
    const report = generateAuditReport(files, testDir);

    expect(report.totalFiles).toBe(3);

    const sessionsStats = report.categories.get(AgentEntityCategory.SESSIONS);
    expect(sessionsStats?.fileCount).toBe(2);

    const analysisStats = report.categories.get(AgentEntityCategory.ANALYSIS);
    expect(analysisStats?.fileCount).toBe(1);
  });

  test("tracks unmatched files as warnings", () => {
    createMockFile(testDir, "random/generic-file.md");
    createMockFile(testDir, "sessions/2026-01-31-session-01.md");

    const files = auditAgentsDirectory(testDir);
    const report = generateAuditReport(files, testDir);

    expect(report.matchedFiles).toBe(1);
    expect(report.unmatchedFiles).toBe(1);
    expect(report.warnings.length).toBe(1);
    expect(report.warnings[0].filename).toBe("generic-file.md");
  });

  test("calculates total size correctly", () => {
    createMockFile(testDir, "sessions/s1.md", "12345");
    createMockFile(testDir, "sessions/s2.md", "1234567890");

    const files = auditAgentsDirectory(testDir);
    const report = generateAuditReport(files, testDir);

    expect(report.totalSizeBytes).toBe(15); // 5 + 10
  });

  test("includes timestamp", () => {
    const files = auditAgentsDirectory(testDir);
    const before = new Date();
    const report = generateAuditReport(files, testDir);
    const after = new Date();

    expect(report.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(report.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe("formatAuditReport", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = createTestAgentsDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  test("formats empty report", () => {
    const files = auditAgentsDirectory(testDir);
    const report = generateAuditReport(files, testDir);
    const formatted = formatAuditReport(report);

    expect(formatted).toContain(".agents/ Content Audit Report");
    expect(formatted).toContain("Total Files: 0");
    expect(formatted).toContain("Matched Files: 0");
    expect(formatted).toContain("Unmatched Files: 0");
  });

  test("includes category breakdown", () => {
    createMockFile(testDir, "sessions/2026-01-31-session-01.md");
    createMockFile(testDir, "analysis/001-analysis.md");

    const files = auditAgentsDirectory(testDir);
    const report = generateAuditReport(files, testDir);
    const formatted = formatAuditReport(report);

    expect(formatted).toContain("## SESSIONS");
    expect(formatted).toContain("## ANALYSIS");
    expect(formatted).toContain("Files: 1");
  });

  test("includes warnings section when unmatched files exist", () => {
    createMockFile(testDir, "random/generic-file.md");

    const files = auditAgentsDirectory(testDir);
    const report = generateAuditReport(files, testDir);
    const formatted = formatAuditReport(report);

    expect(formatted).toContain("[WARNING] Unmapped Files");
    expect(formatted).toContain("generic-file.md");
  });

  test("includes migration mapping table", () => {
    createMockFile(testDir, "sessions/2026-01-31-session-01.md");

    const files = auditAgentsDirectory(testDir);
    const report = generateAuditReport(files, testDir);
    const formatted = formatAuditReport(report);

    expect(formatted).toContain("Migration Mapping");
    expect(formatted).toContain("Source Directory");
    expect(formatted).toContain("Brain Memory Category");
  });
});

describe("runAgentsAudit", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = createTestAgentsDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  test("returns complete audit results", () => {
    createMockFile(testDir, "sessions/2026-01-31-session-01.md");
    createMockFile(testDir, "analysis/001-analysis.md");

    const result = runAgentsAudit(testDir);

    expect(result.files.length).toBe(2);
    expect(result.report.totalFiles).toBe(2);
    expect(result.formattedReport).toContain(".agents/ Content Audit Report");
  });

  test("is the main entry point for auditing", () => {
    // Verify it returns all expected properties
    const result = runAgentsAudit(testDir);

    expect(result).toHaveProperty("files");
    expect(result).toHaveProperty("report");
    expect(result).toHaveProperty("formattedReport");

    expect(Array.isArray(result.files)).toBe(true);
    expect(typeof result.report.totalFiles).toBe("number");
    expect(typeof result.formattedReport).toBe("string");
  });
});

describe("ENTITY_PATTERNS coverage", () => {
  test("all patterns have required properties", () => {
    for (const pattern of ENTITY_PATTERNS) {
      expect(pattern.type).toBeDefined();
      expect(pattern.type.length).toBeGreaterThan(0);
      expect(pattern.description).toBeDefined();
      expect(pattern.description.length).toBeGreaterThan(0);
      expect(pattern.regex).toBeInstanceOf(RegExp);
    }
  });

  test("GENERIC_MD is the last pattern for fallback", () => {
    const lastPattern = ENTITY_PATTERNS[ENTITY_PATTERNS.length - 1];
    expect(lastPattern.type).toBe("GENERIC_MD");
  });

  test("patterns are checked in order for proper specificity", () => {
    // More specific patterns should return before generic ones
    // ADR debate log should return DEBATE_LOG, not ADR
    expect(getEntityType("ADR-020-debate-log.md")).toBe("DEBATE_LOG");
    // ADR review should return ADR_REVIEW, not ADR
    expect(getEntityType("ADR-020-security-review.md")).toBe("ADR_REVIEW");
    // ADR summary should return ADR_SUMMARY, not ADR
    expect(getEntityType("ADR-020-plan-summary.md")).toBe("ADR_SUMMARY");
    // Pure ADR should still return ADR
    expect(getEntityType("ADR-020-config.md")).toBe("ADR");
  });

  test("patterns are mutually exclusive for specific types", () => {
    // ADR pattern should not match TASK files
    expect(getEntityType("TASK-001-session.md")).toBe("TASK_SPEC");
    expect(getEntityType("TASK-001-session.md")).not.toBe("ADR");

    // Session pattern should not match generic analysis
    expect(getEntityType("2026-01-31-session-01.md")).toBe("SESSION_LOG");
    expect(getEntityType("2026-01-31-session-01.md")).not.toBe("ANALYSIS");
  });
});
