/**
 * Tests for naming pattern validation in write_note MCP tool.
 * ADR-023 Phase 3: MCP Tool Integration
 */

import { type PatternType, validateNamingPattern } from "@brain/validation";
import { describe, expect, test } from "vitest";

/**
 * Map folder paths to pattern types for validation.
 * Based on ADR-023 naming patterns and storage categories.
 *
 * This is a copy of the function from index.ts for testing purposes.
 */
function folderToPatternType(
  folder: string | undefined,
): PatternType | undefined {
  if (!folder) {
    return undefined;
  }

  // Normalize folder path (remove trailing slashes, lowercase for comparison)
  const normalized = folder.replace(/\/+$/, "").toLowerCase();

  const mapping: Record<string, PatternType> = {
    // Architecture decisions
    "architecture/decision": "decision",
    "architecture/decisions": "decision",
    decisions: "decision",
    // Sessions
    sessions: "session",
    // Requirements
    requirements: "requirement",
    "specs/requirements": "requirement",
    // Design
    design: "design",
    "specs/design": "design",
    // Tasks
    tasks: "task",
    "specs/tasks": "task",
    // Analysis
    analysis: "analysis",
    // Features/Planning
    planning: "feature",
    features: "feature",
    // Epics
    roadmap: "epic",
    epics: "epic",
    // Critique
    critique: "critique",
    reviews: "critique",
    // QA/Test reports
    qa: "test-report",
    "test-reports": "test-report",
    // Security
    security: "security",
    // Retrospectives
    retrospective: "retrospective",
    retrospectives: "retrospective",
    // Skills
    skills: "skill",
  };

  return mapping[normalized];
}

describe("folderToPatternType mapping", () => {
  describe("architecture decisions", () => {
    test("maps architecture/decision to decision", () => {
      expect(folderToPatternType("architecture/decision")).toBe("decision");
    });

    test("maps architecture/decisions to decision", () => {
      expect(folderToPatternType("architecture/decisions")).toBe("decision");
    });

    test("maps decisions to decision", () => {
      expect(folderToPatternType("decisions")).toBe("decision");
    });
  });

  describe("sessions", () => {
    test("maps sessions to session", () => {
      expect(folderToPatternType("sessions")).toBe("session");
    });
  });

  describe("requirements", () => {
    test("maps requirements to requirement", () => {
      expect(folderToPatternType("requirements")).toBe("requirement");
    });

    test("maps specs/requirements to requirement", () => {
      expect(folderToPatternType("specs/requirements")).toBe("requirement");
    });
  });

  describe("design", () => {
    test("maps design to design", () => {
      expect(folderToPatternType("design")).toBe("design");
    });

    test("maps specs/design to design", () => {
      expect(folderToPatternType("specs/design")).toBe("design");
    });
  });

  describe("tasks", () => {
    test("maps tasks to task", () => {
      expect(folderToPatternType("tasks")).toBe("task");
    });

    test("maps specs/tasks to task", () => {
      expect(folderToPatternType("specs/tasks")).toBe("task");
    });
  });

  describe("analysis", () => {
    test("maps analysis to analysis", () => {
      expect(folderToPatternType("analysis")).toBe("analysis");
    });
  });

  describe("features/planning", () => {
    test("maps planning to feature", () => {
      expect(folderToPatternType("planning")).toBe("feature");
    });

    test("maps features to feature", () => {
      expect(folderToPatternType("features")).toBe("feature");
    });
  });

  describe("epics", () => {
    test("maps roadmap to epic", () => {
      expect(folderToPatternType("roadmap")).toBe("epic");
    });

    test("maps epics to epic", () => {
      expect(folderToPatternType("epics")).toBe("epic");
    });
  });

  describe("critique", () => {
    test("maps critique to critique", () => {
      expect(folderToPatternType("critique")).toBe("critique");
    });

    test("maps reviews to critique", () => {
      expect(folderToPatternType("reviews")).toBe("critique");
    });
  });

  describe("test reports", () => {
    test("maps qa to test-report", () => {
      expect(folderToPatternType("qa")).toBe("test-report");
    });

    test("maps test-reports to test-report", () => {
      expect(folderToPatternType("test-reports")).toBe("test-report");
    });
  });

  describe("security", () => {
    test("maps security to security", () => {
      expect(folderToPatternType("security")).toBe("security");
    });
  });

  describe("retrospectives", () => {
    test("maps retrospective to retrospective", () => {
      expect(folderToPatternType("retrospective")).toBe("retrospective");
    });

    test("maps retrospectives to retrospective", () => {
      expect(folderToPatternType("retrospectives")).toBe("retrospective");
    });
  });

  describe("skills", () => {
    test("maps skills to skill", () => {
      expect(folderToPatternType("skills")).toBe("skill");
    });
  });

  describe("edge cases", () => {
    test("returns undefined for unknown folder", () => {
      expect(folderToPatternType("unknown")).toBeUndefined();
    });

    test("returns undefined for undefined folder", () => {
      expect(folderToPatternType(undefined)).toBeUndefined();
    });

    test("handles trailing slashes", () => {
      expect(folderToPatternType("sessions/")).toBe("session");
    });

    test("handles uppercase folders (case insensitive)", () => {
      expect(folderToPatternType("SESSIONS")).toBe("session");
    });
  });
});

describe("naming pattern validation integration", () => {
  describe("valid patterns", () => {
    test("accepts valid ADR filename in decisions folder", () => {
      const folder = "decisions";
      const title = "ADR-001-my-decision";
      const fileName = `${title}.md`;
      const patternType = folderToPatternType(folder);

      expect(patternType).toBe("decision");
      const result = validateNamingPattern({ fileName, patternType });
      expect(result.valid).toBe(true);
      expect(result.patternType).toBe("decision");
    });

    test("accepts valid session filename in sessions folder", () => {
      const folder = "sessions";
      const title = "SESSION-2026-02-01-01-my-session";
      const fileName = `${title}.md`;
      const patternType = folderToPatternType(folder);

      expect(patternType).toBe("session");
      const result = validateNamingPattern({ fileName, patternType });
      expect(result.valid).toBe(true);
      expect(result.patternType).toBe("session");
    });

    test("accepts valid skill filename in skills folder", () => {
      const folder = "skills";
      const title = "SKILL-001-memory-ops";
      const fileName = `${title}.md`;
      const patternType = folderToPatternType(folder);

      expect(patternType).toBe("skill");
      const result = validateNamingPattern({ fileName, patternType });
      expect(result.valid).toBe(true);
      expect(result.patternType).toBe("skill");
    });
  });

  describe("invalid patterns", () => {
    test("rejects invalid ADR filename format", () => {
      const folder = "decisions";
      const title = "my-adr"; // Missing ADR-NNN- prefix
      const fileName = `${title}.md`;
      const patternType = folderToPatternType(folder);

      expect(patternType).toBe("decision");
      const result = validateNamingPattern({ fileName, patternType });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("does not match decision pattern");
    });

    test("rejects deprecated skill filename format", () => {
      const folder = "skills";
      const title = "Skill-Memory-001"; // Old format
      const fileName = `${title}.md`;
      const patternType = folderToPatternType(folder);

      expect(patternType).toBe("skill");
      const result = validateNamingPattern({ fileName, patternType });
      expect(result.valid).toBe(false);
      expect(result.isDeprecated).toBe(true);
    });

    test("rejects deprecated session filename format", () => {
      const folder = "sessions";
      const title = "2026-02-01-session-01"; // Old format
      const fileName = `${title}.md`;
      const patternType = folderToPatternType(folder);

      expect(patternType).toBe("session");
      const result = validateNamingPattern({ fileName, patternType });
      expect(result.valid).toBe(false);
      expect(result.isDeprecated).toBe(true);
    });
  });

  describe("security: path traversal protection", () => {
    test("rejects path traversal in filename", () => {
      const result = validateNamingPattern({
        fileName: "../../../etc/passwd",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Path traversal detected");
    });

    test("rejects forward slashes in filename", () => {
      const result = validateNamingPattern({
        fileName: "folder/ADR-001-decision.md",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Path traversal detected");
    });

    test("rejects backslashes in filename", () => {
      const result = validateNamingPattern({
        fileName: "folder\\ADR-001-decision.md",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Path traversal detected");
    });
  });

  describe("no validation for unmapped folders", () => {
    test("does not validate files in unmapped folders", () => {
      const folder = "custom-folder";
      const patternType = folderToPatternType(folder);

      // Should be undefined, meaning no validation
      expect(patternType).toBeUndefined();
    });
  });
});
