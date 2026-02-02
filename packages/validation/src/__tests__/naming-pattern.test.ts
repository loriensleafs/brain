/**
 * Tests for naming pattern validators.
 *
 * Tests all 13 naming patterns from ADR-023 with valid and invalid examples.
 * Also tests deprecated pattern detection and path traversal protection.
 */
import { describe, expect, test } from "vitest";
import {
  CanonicalDirectories,
  DeprecatedDirectories,
  DeprecatedPatterns,
  getMatchingPatterns,
  getPatternRegex,
  getPatternTypes,
  isValidNamingPattern,
  type NamingPatternResult,
  NamingPatterns,
  type PatternType,
  parseNamingPattern,
  validateDirectory,
  validateNamingPattern,
} from "../naming-pattern";

/**
 * Type guard to assert validation result is valid.
 * Narrows type to allow safe access to patternType.
 */
function expectValid(
  result: NamingPatternResult,
): asserts result is Extract<NamingPatternResult, { valid: true }> {
  expect(result.valid).toBe(true);
}

/**
 * Type guard to assert validation result is invalid.
 * Narrows type to allow safe access to error.
 * Note: Prefixed with _ because tests use inline type narrowing instead.
 */
function _expectInvalid(
  result: NamingPatternResult,
): asserts result is Extract<NamingPatternResult, { valid: false }> {
  expect(result.valid).toBe(false);
}

describe("NamingPatterns", () => {
  test("contains all 13 pattern types", () => {
    const types = Object.keys(NamingPatterns);
    expect(types).toHaveLength(13);
    expect(types).toContain("decision");
    expect(types).toContain("session");
    expect(types).toContain("requirement");
    expect(types).toContain("design");
    expect(types).toContain("task");
    expect(types).toContain("analysis");
    expect(types).toContain("feature");
    expect(types).toContain("epic");
    expect(types).toContain("critique");
    expect(types).toContain("test-report");
    expect(types).toContain("security");
    expect(types).toContain("retrospective");
    expect(types).toContain("skill");
  });
});

describe("validateNamingPattern", () => {
  describe("decision (ADR) pattern", () => {
    test("accepts valid ADR file names", () => {
      const validNames = [
        "ADR-001-database-selection.md",
        "ADR-023-unified-validation.md",
        "ADR-999-final-decision.md",
        "ADR-001-my_mixed-name.md",
      ];

      for (const fileName of validNames) {
        const result = validateNamingPattern({ fileName });
        expectValid(result);
        expect(result.patternType).toBe("decision");
      }
    });

    test("rejects invalid ADR file names", () => {
      const invalidNames = [
        "adr-001-lowercase.md", // lowercase prefix
        "ADR-01-too-short.md", // 2-digit number
        "ADR-0001-too-long.md", // 4-digit number
        "ADR-001.md", // missing description
        "ADR001-no-dash.md", // missing dash after prefix
      ];

      for (const fileName of invalidNames) {
        const result = validateNamingPattern({ fileName });
        expect(result.valid, `Expected ${fileName} to be invalid`).toBe(false);
      }
    });
  });

  describe("session pattern", () => {
    test("accepts valid session file names", () => {
      const validNames = [
        "SESSION-2026-01-15-01-audit.md",
        "SESSION-2024-12-31-99-year-end.md",
        "SESSION-2026-02-01-05-morning-standup.md",
      ];

      for (const fileName of validNames) {
        const result = validateNamingPattern({ fileName });
        expectValid(result);
        expect(result.patternType).toBe("session");
      }
    });

    test("rejects old session format", () => {
      const result = validateNamingPattern({
        fileName: "2026-01-15-session-01.md",
      });
      expect(result.valid).toBe(false);
      expect(result.isDeprecated).toBe(true);
      expect(result.deprecatedPattern).toBe("oldSession");
    });
  });

  describe("requirement pattern", () => {
    test("accepts valid requirement file names", () => {
      const validNames = [
        "REQ-001-user-login.md",
        "REQ-123-data-export.md",
        "REQ-999-final-requirement.md",
      ];

      for (const fileName of validNames) {
        const result = validateNamingPattern({ fileName });
        expectValid(result);
        expect(result.patternType).toBe("requirement");
      }
    });
  });

  describe("design pattern", () => {
    test("accepts valid design file names", () => {
      const validNames = ["DESIGN-001-api-architecture.md", "DESIGN-050-database-schema.md"];

      for (const fileName of validNames) {
        const result = validateNamingPattern({ fileName });
        expectValid(result);
        expect(result.patternType).toBe("design");
      }
    });
  });

  describe("task pattern", () => {
    test("accepts valid task file names", () => {
      const validNames = ["TASK-001-implement-auth.md", "TASK-042-fix-bug.md"];

      for (const fileName of validNames) {
        const result = validateNamingPattern({ fileName });
        expectValid(result);
        expect(result.patternType).toBe("task");
      }
    });
  });

  describe("analysis pattern", () => {
    test("accepts valid analysis file names", () => {
      const validNames = ["ANALYSIS-001-copilot-cli.md", "ANALYSIS-015-performance-review.md"];

      for (const fileName of validNames) {
        const result = validateNamingPattern({ fileName });
        expectValid(result);
        expect(result.patternType).toBe("analysis");
      }
    });
  });

  describe("feature pattern", () => {
    test("accepts valid feature file names", () => {
      const validNames = ["FEATURE-001-oauth-integration.md", "FEATURE-003-dashboard.md"];

      for (const fileName of validNames) {
        const result = validateNamingPattern({ fileName });
        expectValid(result);
        expect(result.patternType).toBe("feature");
      }
    });
  });

  describe("epic pattern", () => {
    test("accepts valid epic file names", () => {
      const validNames = ["EPIC-001-user-authentication.md", "EPIC-005-reporting-system.md"];

      for (const fileName of validNames) {
        const result = validateNamingPattern({ fileName });
        expectValid(result);
        expect(result.patternType).toBe("epic");
      }
    });
  });

  describe("critique pattern", () => {
    test("accepts valid critique file names", () => {
      const validNames = ["CRIT-001-auth-plan-critique.md", "CRIT-010-api-design-review.md"];

      for (const fileName of validNames) {
        const result = validateNamingPattern({ fileName });
        expectValid(result);
        expect(result.patternType).toBe("critique");
      }
    });
  });

  describe("test-report (QA) pattern", () => {
    test("accepts valid test report file names", () => {
      const validNames = ["QA-001-auth-test-report.md", "QA-050-integration-tests.md"];

      for (const fileName of validNames) {
        const result = validateNamingPattern({ fileName });
        expectValid(result);
        expect(result.patternType).toBe("test-report");
      }
    });
  });

  describe("security (SEC) pattern", () => {
    test("accepts valid security file names", () => {
      const validNames = ["SEC-001-auth-flow.md", "SEC-025-data-encryption.md"];

      for (const fileName of validNames) {
        const result = validateNamingPattern({ fileName });
        expectValid(result);
        expect(result.patternType).toBe("security");
      }
    });

    test("rejects old TM format", () => {
      const result = validateNamingPattern({ fileName: "TM-001-auth.md" });
      expect(result.valid).toBe(false);
      expect(result.isDeprecated).toBe(true);
      expect(result.deprecatedPattern).toBe("oldThreatModel");
    });
  });

  describe("retrospective pattern", () => {
    test("accepts valid retrospective file names", () => {
      const validNames = ["RETRO-2026-01-15-sprint-review.md", "RETRO-2024-12-31-year-end.md"];

      for (const fileName of validNames) {
        const result = validateNamingPattern({ fileName });
        expectValid(result);
        expect(result.patternType).toBe("retrospective");
      }
    });
  });

  describe("skill pattern", () => {
    test("accepts valid skill file names", () => {
      const validNames = ["SKILL-001-memory-ops.md", "SKILL-015-git-workflow.md"];

      for (const fileName of validNames) {
        const result = validateNamingPattern({ fileName });
        expectValid(result);
        expect(result.patternType).toBe("skill");
      }
    });

    test("rejects old Skill format", () => {
      const result = validateNamingPattern({
        fileName: "Skill-Memory-001.md",
      });
      expect(result.valid).toBe(false);
      expect(result.isDeprecated).toBe(true);
      expect(result.deprecatedPattern).toBe("oldSkill");
    });
  });

  describe("specific pattern type validation", () => {
    test("validates against specified pattern type", () => {
      const result = validateNamingPattern({
        fileName: "ADR-001-test.md",
        patternType: "decision",
      });
      expectValid(result);
      expect(result.patternType).toBe("decision");
    });

    test("rejects when file does not match specified type", () => {
      const result = validateNamingPattern({
        fileName: "ADR-001-test.md",
        patternType: "session",
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("session pattern");
      }
    });

    test("rejects unknown pattern type", () => {
      const result = validateNamingPattern({
        fileName: "test.md",
        patternType: "unknown" as PatternType,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("Unknown pattern type");
      }
    });
  });

  describe("path traversal protection", () => {
    test("rejects file names with ..", () => {
      const result = validateNamingPattern({ fileName: "../etc/passwd" });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("Path traversal detected");
      }
    });

    test("rejects file names with forward slash", () => {
      const result = validateNamingPattern({
        fileName: "path/to/ADR-001-test.md",
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("Path traversal detected");
      }
    });

    test("rejects file names with backslash", () => {
      const result = validateNamingPattern({
        fileName: "path\\to\\ADR-001-test.md",
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("Path traversal detected");
      }
    });
  });

  describe("empty input handling", () => {
    test("rejects empty fileName", () => {
      const result = validateNamingPattern({ fileName: "" });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("fileName is required");
      }
    });

    test("rejects undefined fileName", () => {
      const result = validateNamingPattern({
        fileName: undefined as unknown as string,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("fileName is required");
      }
    });
  });

  describe("no pattern match", () => {
    test("returns error for unrecognized file name", () => {
      const result = validateNamingPattern({ fileName: "random-file.md" });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("does not match any known naming pattern");
      }
    });
  });
});

describe("parseNamingPattern", () => {
  test("returns validated input for valid file name", () => {
    const result = parseNamingPattern({ fileName: "ADR-001-test.md" });
    expect(result.fileName).toBe("ADR-001-test.md");
    expect(result.patternType).toBe("decision");
  });

  test("throws on invalid file name", () => {
    expect(() => parseNamingPattern({ fileName: "invalid.md" })).toThrow(
      "does not match any known naming pattern",
    );
  });

  test("throws on empty file name", () => {
    expect(() => parseNamingPattern({ fileName: "" })).toThrow("fileName is required");
  });

  test("throws on path traversal", () => {
    expect(() => parseNamingPattern({ fileName: "../test.md" })).toThrow("Path traversal detected");
  });

  test("throws on deprecated format", () => {
    expect(() => parseNamingPattern({ fileName: "Skill-Memory-001.md" })).toThrow(
      "deprecated pattern",
    );
  });
});

describe("getMatchingPatterns", () => {
  test("returns array of matching pattern types", () => {
    const matches = getMatchingPatterns("ADR-001-test.md");
    expect(matches).toContain("decision");
    expect(matches).toHaveLength(1);
  });

  test("returns empty array for no matches", () => {
    const matches = getMatchingPatterns("random-file.md");
    expect(matches).toEqual([]);
  });
});

describe("isValidNamingPattern", () => {
  test("returns true for valid patterns", () => {
    expect(isValidNamingPattern("ADR-001-test.md")).toBe(true);
    expect(isValidNamingPattern("SESSION-2026-01-15-01-audit.md")).toBe(true);
    expect(isValidNamingPattern("SKILL-001-test.md")).toBe(true);
  });

  test("returns false for invalid patterns", () => {
    expect(isValidNamingPattern("invalid.md")).toBe(false);
    expect(isValidNamingPattern("../passwd")).toBe(false);
    expect(isValidNamingPattern("")).toBe(false);
  });
});

describe("getPatternRegex", () => {
  test("returns regex for valid pattern type", () => {
    const regex = getPatternRegex("decision");
    expect(regex).toBeDefined();
    expect(regex?.test("ADR-001-test.md")).toBe(true);
  });

  test("returns undefined for unknown type", () => {
    const regex = getPatternRegex("unknown" as PatternType);
    expect(regex).toBeUndefined();
  });
});

describe("getPatternTypes", () => {
  test("returns all 13 pattern types", () => {
    const types = getPatternTypes();
    expect(types).toHaveLength(13);
    expect(types).toContain("decision");
    expect(types).toContain("session");
    expect(types).toContain("skill");
  });
});

describe("DeprecatedPatterns", () => {
  test("contains expected deprecated patterns", () => {
    expect(DeprecatedPatterns.oldSkill.test("Skill-Category-001.md")).toBe(true);
    expect(DeprecatedPatterns.oldSession.test("2026-01-15-session-01.md")).toBe(true);
    expect(DeprecatedPatterns.oldThreatModel.test("TM-001-auth.md")).toBe(true);
  });

  test("old patterns do not match new formats", () => {
    expect(DeprecatedPatterns.oldSkill.test("SKILL-001-test.md")).toBe(false);
    expect(DeprecatedPatterns.oldSession.test("SESSION-2026-01-15-01-audit.md")).toBe(false);
    expect(DeprecatedPatterns.oldThreatModel.test("SEC-001-auth.md")).toBe(false);
  });
});

describe("edge cases", () => {
  test("handles file names with underscores", () => {
    const result = validateNamingPattern({ fileName: "ADR-001-my_decision.md" });
    expect(result.valid).toBe(true);
  });

  test("handles file names with multiple dashes", () => {
    const result = validateNamingPattern({
      fileName: "ADR-001-my-long-decision-name.md",
    });
    expect(result.valid).toBe(true);
  });

  test("rejects file names without .md extension", () => {
    const result = validateNamingPattern({ fileName: "ADR-001-test.txt" });
    expect(result.valid).toBe(false);
  });

  test("rejects file names with spaces", () => {
    const result = validateNamingPattern({ fileName: "ADR-001-my decision.md" });
    expect(result.valid).toBe(false);
  });

  test("handles maximum valid numbers", () => {
    const result = validateNamingPattern({ fileName: "ADR-999-test.md" });
    expect(result.valid).toBe(true);
  });

  test("handles session with two-digit sequence", () => {
    const result = validateNamingPattern({
      fileName: "SESSION-2026-12-31-99-test.md",
    });
    expect(result.valid).toBe(true);
  });
});

describe("CanonicalDirectories", () => {
  test("contains single path per entity (not array)", () => {
    // Verify each value is a string, not an array
    for (const [_key, value] of Object.entries(CanonicalDirectories)) {
      expect(typeof value).toBe("string");
      expect(Array.isArray(value)).toBe(false);
    }
  });

  test("contains all 13 pattern types", () => {
    const keys = Object.keys(CanonicalDirectories);
    expect(keys).toHaveLength(13);
    expect(keys).toContain("decision");
    expect(keys).toContain("session");
    expect(keys).toContain("requirement");
    expect(keys).toContain("design");
    expect(keys).toContain("task");
    expect(keys).toContain("analysis");
    expect(keys).toContain("feature");
    expect(keys).toContain("epic");
    expect(keys).toContain("critique");
    expect(keys).toContain("test-report");
    expect(keys).toContain("security");
    expect(keys).toContain("retrospective");
    expect(keys).toContain("skill");
  });

  test("has correct canonical paths", () => {
    expect(CanonicalDirectories.decision).toBe("decisions");
    expect(CanonicalDirectories.session).toBe("sessions");
    expect(CanonicalDirectories.requirement).toBe("specs/{name}/requirements");
    expect(CanonicalDirectories.design).toBe("specs/{name}/design");
    expect(CanonicalDirectories.task).toBe("specs/{name}/tasks");
    expect(CanonicalDirectories.analysis).toBe("analysis");
    expect(CanonicalDirectories.feature).toBe("planning");
    expect(CanonicalDirectories.epic).toBe("roadmap");
    expect(CanonicalDirectories.critique).toBe("critique");
    expect(CanonicalDirectories["test-report"]).toBe("qa");
    expect(CanonicalDirectories.security).toBe("security");
    expect(CanonicalDirectories.retrospective).toBe("retrospectives");
    expect(CanonicalDirectories.skill).toBe("skills");
  });
});

describe("DeprecatedDirectories", () => {
  test("contains all deprecated paths", () => {
    // Architecture paths
    expect(DeprecatedDirectories["architecture/decision"]).toBe("decisions");
    expect(DeprecatedDirectories["architecture/decisions"]).toBe("decisions");
    expect(DeprecatedDirectories.architecture).toBe("decisions");

    // Old requirement/design/task paths
    expect(DeprecatedDirectories.requirements).toBe("specs/{name}/requirements");
    expect(DeprecatedDirectories["specs/requirements"]).toBe("specs/{name}/requirements");
    expect(DeprecatedDirectories.design).toBe("specs/{name}/design");
    expect(DeprecatedDirectories["specs/design"]).toBe("specs/{name}/design");
    expect(DeprecatedDirectories.tasks).toBe("specs/{name}/tasks");
    expect(DeprecatedDirectories["specs/tasks"]).toBe("specs/{name}/tasks");

    // Other deprecated paths
    expect(DeprecatedDirectories.features).toBe("planning");
    expect(DeprecatedDirectories.epics).toBe("roadmap");
    expect(DeprecatedDirectories.reviews).toBe("critique");
    expect(DeprecatedDirectories["test-reports"]).toBe("qa");
    expect(DeprecatedDirectories.retrospective).toBe("retrospectives");
  });
});

describe("validateDirectory", () => {
  describe("canonical paths (accepted)", () => {
    test("accepts decisions for decision", () => {
      const result = validateDirectory("decisions", "decision");
      expect(result.valid).toBe(true);
    });

    test("accepts sessions for session", () => {
      const result = validateDirectory("sessions", "session");
      expect(result.valid).toBe(true);
    });

    test("accepts specs/myproject/requirements for requirement", () => {
      const result = validateDirectory("specs/myproject/requirements", "requirement");
      expect(result.valid).toBe(true);
    });

    test("accepts specs/any-name/design for design", () => {
      const result = validateDirectory("specs/any-name/design", "design");
      expect(result.valid).toBe(true);
    });

    test("accepts specs/project_name/tasks for task", () => {
      const result = validateDirectory("specs/project_name/tasks", "task");
      expect(result.valid).toBe(true);
    });

    test("accepts planning for feature", () => {
      const result = validateDirectory("planning", "feature");
      expect(result.valid).toBe(true);
    });

    test("accepts roadmap for epic", () => {
      const result = validateDirectory("roadmap", "epic");
      expect(result.valid).toBe(true);
    });

    test("accepts retrospectives for retrospective", () => {
      const result = validateDirectory("retrospectives", "retrospective");
      expect(result.valid).toBe(true);
    });
  });

  describe("deprecated paths (rejected)", () => {
    test("rejects architecture/decision for decision", () => {
      const result = validateDirectory("architecture/decision", "decision");
      expect(result.valid).toBe(false);
      expect(result.isDeprecated).toBe(true);
      expect(result.canonicalDirectory).toBe("decisions");
    });

    test("rejects requirements for requirement", () => {
      const result = validateDirectory("requirements", "requirement");
      expect(result.valid).toBe(false);
      expect(result.isDeprecated).toBe(true);
      expect(result.canonicalDirectory).toBe("specs/{name}/requirements");
    });

    test("rejects design for design", () => {
      const result = validateDirectory("design", "design");
      expect(result.valid).toBe(false);
      expect(result.isDeprecated).toBe(true);
      expect(result.canonicalDirectory).toBe("specs/{name}/design");
    });

    test("rejects features for feature", () => {
      const result = validateDirectory("features", "feature");
      expect(result.valid).toBe(false);
      expect(result.isDeprecated).toBe(true);
      expect(result.canonicalDirectory).toBe("planning");
    });

    test("rejects epics for epic", () => {
      const result = validateDirectory("epics", "epic");
      expect(result.valid).toBe(false);
      expect(result.isDeprecated).toBe(true);
      expect(result.canonicalDirectory).toBe("roadmap");
    });

    test("rejects reviews for critique", () => {
      const result = validateDirectory("reviews", "critique");
      expect(result.valid).toBe(false);
      expect(result.isDeprecated).toBe(true);
      expect(result.canonicalDirectory).toBe("critique");
    });

    test("rejects test-reports for test-report", () => {
      const result = validateDirectory("test-reports", "test-report");
      expect(result.valid).toBe(false);
      expect(result.isDeprecated).toBe(true);
      expect(result.canonicalDirectory).toBe("qa");
    });

    test("rejects retrospective for retrospective", () => {
      const result = validateDirectory("retrospective", "retrospective");
      expect(result.valid).toBe(false);
      expect(result.isDeprecated).toBe(true);
      expect(result.canonicalDirectory).toBe("retrospectives");
    });
  });

  describe("wrong directory for type (rejected)", () => {
    test("rejects qa for decision", () => {
      const result = validateDirectory("qa", "decision");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("not valid for decision");
      }
      expect(result.canonicalDirectory).toBe("decisions");
    });

    test("rejects decisions for session", () => {
      const result = validateDirectory("decisions", "session");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("not valid for session");
      }
      expect(result.canonicalDirectory).toBe("sessions");
    });
  });
});
