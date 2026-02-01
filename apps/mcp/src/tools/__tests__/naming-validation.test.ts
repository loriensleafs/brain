/**
 * Tests for naming pattern validation in write_note MCP tool.
 * ADR-023 Phase 3: MCP Tool Integration
 */

import { type PatternType, validateNamingPattern } from "@brain/validation";
import { describe, expect, test } from "vitest";

/**
 * Map folder paths to pattern types for validation.
 * Based on ADR-023/ADR-024 naming patterns - ONLY canonical paths.
 *
 * This is a copy of the function from index.ts for testing purposes.
 *
 * Canonical mappings (single path per entity):
 *   decision → decisions
 *   session → sessions
 *   requirement → specs/{name}/requirements
 *   design → specs/{name}/design
 *   task → specs/{name}/tasks
 *   analysis → analysis
 *   feature → planning
 *   epic → roadmap
 *   critique → critique
 *   test-report → qa
 *   security → security
 *   retrospective → retrospectives
 *   skill → skills
 */
function folderToPatternType(
  folder: string | undefined,
): PatternType | undefined {
  if (!folder) {
    return undefined;
  }

  // Normalize folder path (remove trailing slashes, lowercase for comparison)
  const normalized = folder.replace(/\/+$/, "").toLowerCase();

  // Simple exact-match canonical paths
  const exactMapping: Record<string, PatternType> = {
    decisions: "decision",
    sessions: "session",
    analysis: "analysis",
    planning: "feature",
    roadmap: "epic",
    critique: "critique",
    qa: "test-report",
    security: "security",
    retrospectives: "retrospective",
    skills: "skill",
  };

  if (exactMapping[normalized]) {
    return exactMapping[normalized];
  }

  // Parameterized specs/{name}/* paths
  // Match: specs/anything/requirements, specs/anything/design, specs/anything/tasks
  if (normalized.startsWith("specs/") && normalized.split("/").length === 3) {
    const suffix = normalized.split("/")[2];
    const specsMapping: Record<string, PatternType> = {
      requirements: "requirement",
      design: "design",
      tasks: "task",
    };
    return specsMapping[suffix];
  }

  return undefined;
}

describe("folderToPatternType mapping", () => {
  describe("canonical paths (accepted)", () => {
    test("decisions -> decision", () => {
      expect(folderToPatternType("decisions")).toBe("decision");
    });

    test("sessions -> session", () => {
      expect(folderToPatternType("sessions")).toBe("session");
    });

    test("specs/myproject/requirements -> requirement", () => {
      expect(folderToPatternType("specs/myproject/requirements")).toBe(
        "requirement",
      );
    });

    test("specs/myproject/design -> design", () => {
      expect(folderToPatternType("specs/myproject/design")).toBe("design");
    });

    test("specs/myproject/tasks -> task", () => {
      expect(folderToPatternType("specs/myproject/tasks")).toBe("task");
    });

    test("analysis -> analysis", () => {
      expect(folderToPatternType("analysis")).toBe("analysis");
    });

    test("planning -> feature", () => {
      expect(folderToPatternType("planning")).toBe("feature");
    });

    test("roadmap -> epic", () => {
      expect(folderToPatternType("roadmap")).toBe("epic");
    });

    test("critique -> critique", () => {
      expect(folderToPatternType("critique")).toBe("critique");
    });

    test("qa -> test-report", () => {
      expect(folderToPatternType("qa")).toBe("test-report");
    });

    test("security -> security", () => {
      expect(folderToPatternType("security")).toBe("security");
    });

    test("retrospectives -> retrospective", () => {
      expect(folderToPatternType("retrospectives")).toBe("retrospective");
    });

    test("skills -> skill", () => {
      expect(folderToPatternType("skills")).toBe("skill");
    });
  });

  describe("deprecated paths (rejected)", () => {
    test("architecture/decision -> undefined (deprecated)", () => {
      expect(folderToPatternType("architecture/decision")).toBeUndefined();
    });

    test("architecture/decisions -> undefined (deprecated)", () => {
      expect(folderToPatternType("architecture/decisions")).toBeUndefined();
    });

    test("requirements -> undefined (deprecated, use specs/{name}/requirements)", () => {
      expect(folderToPatternType("requirements")).toBeUndefined();
    });

    test("specs/requirements -> undefined (deprecated, missing project name)", () => {
      expect(folderToPatternType("specs/requirements")).toBeUndefined();
    });

    test("design -> undefined (deprecated, use specs/{name}/design)", () => {
      expect(folderToPatternType("design")).toBeUndefined();
    });

    test("specs/design -> undefined (deprecated, missing project name)", () => {
      expect(folderToPatternType("specs/design")).toBeUndefined();
    });

    test("tasks -> undefined (deprecated, use specs/{name}/tasks)", () => {
      expect(folderToPatternType("tasks")).toBeUndefined();
    });

    test("specs/tasks -> undefined (deprecated, missing project name)", () => {
      expect(folderToPatternType("specs/tasks")).toBeUndefined();
    });

    test("features -> undefined (deprecated, use planning)", () => {
      expect(folderToPatternType("features")).toBeUndefined();
    });

    test("epics -> undefined (deprecated, use roadmap)", () => {
      expect(folderToPatternType("epics")).toBeUndefined();
    });

    test("reviews -> undefined (deprecated, use critique)", () => {
      expect(folderToPatternType("reviews")).toBeUndefined();
    });

    test("test-reports -> undefined (deprecated, use qa)", () => {
      expect(folderToPatternType("test-reports")).toBeUndefined();
    });

    test("retrospective -> undefined (deprecated, use retrospectives)", () => {
      expect(folderToPatternType("retrospective")).toBeUndefined();
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

    test("specs path with any project name works", () => {
      expect(folderToPatternType("specs/brain/requirements")).toBe(
        "requirement",
      );
      expect(folderToPatternType("specs/my-project/design")).toBe("design");
      expect(folderToPatternType("specs/another_one/tasks")).toBe("task");
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
