/**
 * Tests for relation detector module
 */

import { describe, expect, it } from "vitest";
import { formatRelationsMarkdown, generateRelations } from "../relations";
import type { ParsedAgentFile } from "../schema";

function createParsedFile(
  overrides: Partial<ParsedAgentFile> = {},
): ParsedAgentFile {
  return {
    sourcePath: "/test/.agents/test.md",
    relativePath: "test.md",
    originalFrontmatter: {},
    content: "",
    entityType: "note",
    title: "Test Document",
    sections: new Map(),
    ...overrides,
  };
}

describe("generateRelations", () => {
  describe("wikilink detection", () => {
    it("extracts existing wikilinks", () => {
      const parsed = createParsedFile({
        content: "See [[ADR-001]] and [[Feature Plan]] for details.",
      });

      const relations = generateRelations(parsed);

      expect(relations.some((r) => r.target === "ADR-001")).toBe(true);
      expect(relations.some((r) => r.target === "Feature Plan")).toBe(true);
    });

    it("handles aliased wikilinks", () => {
      const parsed = createParsedFile({
        content: "Refer to [[ADR-015|Auth Decision]] for context.",
      });

      const relations = generateRelations(parsed);

      expect(relations.some((r) => r.target === "ADR-015")).toBe(true);
    });
  });

  describe("frontmatter relation extraction", () => {
    it("extracts related array", () => {
      const parsed = createParsedFile({
        originalFrontmatter: {
          related: ["ADR-001", "REQ-002", "DESIGN-003"],
        },
      });

      const relations = generateRelations(parsed);

      expect(relations.some((r) => r.target === "ADR-001")).toBe(true);
      expect(relations.some((r) => r.target === "REQ-002")).toBe(true);
      expect(relations.some((r) => r.target === "DESIGN-003")).toBe(true);
    });

    it("extracts implements field", () => {
      const parsed = createParsedFile({
        originalFrontmatter: {
          implements: "REQ-001",
        },
      });

      const relations = generateRelations(parsed);

      expect(
        relations.some(
          (r) => r.target === "REQ-001" && r.type === "implements",
        ),
      ).toBe(true);
    });

    it("extracts epic field as part_of", () => {
      const parsed = createParsedFile({
        originalFrontmatter: {
          epic: "EPIC-001-auth",
        },
      });

      const relations = generateRelations(parsed);

      expect(
        relations.some(
          (r) => r.target.includes("EPIC-001") && r.type === "part_of",
        ),
      ).toBe(true);
    });
  });

  describe("entity reference detection", () => {
    it("detects ADR references in content", () => {
      const parsed = createParsedFile({
        content: "This implements ADR-015 and follows ADR-003 guidelines.",
      });

      const relations = generateRelations(parsed);

      expect(relations.some((r) => r.target === "ADR-015")).toBe(true);
      expect(relations.some((r) => r.target === "ADR-003")).toBe(true);
    });

    it("detects REQ references with implements type", () => {
      const parsed = createParsedFile({
        content: "Fulfills REQ-001 and REQ-002.",
      });

      const relations = generateRelations(parsed);

      expect(
        relations.some(
          (r) => r.target === "REQ-001" && r.type === "implements",
        ),
      ).toBe(true);
    });

    it("detects TASK references with contains type", () => {
      const parsed = createParsedFile({
        content: "Includes TASK-001 and TASK-002.",
      });

      const relations = generateRelations(parsed);

      expect(
        relations.some((r) => r.target === "TASK-001" && r.type === "contains"),
      ).toBe(true);
    });

    it("pads numbers consistently", () => {
      const parsed = createParsedFile({
        content: "See ADR-1 and REQ-15.",
      });

      const relations = generateRelations(parsed);

      expect(relations.some((r) => r.target === "ADR-001")).toBe(true);
      expect(relations.some((r) => r.target === "REQ-015")).toBe(true);
    });
  });

  describe("hierarchical relations", () => {
    it("extracts from Requirements Addressed section", () => {
      const sections = new Map<string, string>();
      sections.set(
        "Requirements Addressed",
        `
- REQ-001: User Authentication
- REQ-002: Session Management
`,
      );

      const parsed = createParsedFile({ sections });

      const relations = generateRelations(parsed);

      expect(
        relations.some(
          (r) => r.target === "REQ-001" && r.type === "implements",
        ),
      ).toBe(true);
    });

    it("extracts from Traceability section", () => {
      const sections = new Map<string, string>();
      sections.set(
        "Traceability",
        `
REQ-001 -> DESIGN-001 -> TASK-001
`,
      );

      const parsed = createParsedFile({ sections });

      const relations = generateRelations(parsed);

      expect(relations.some((r) => r.target === "REQ-001")).toBe(true);
      expect(relations.some((r) => r.target === "DESIGN-001")).toBe(true);
    });
  });

  describe("quality thresholds", () => {
    it("ensures minimum relations", () => {
      const parsed = createParsedFile({
        entityType: "session",
        relativePath: "sessions/test.md",
      });

      const relations = generateRelations(parsed);

      expect(relations.length).toBeGreaterThanOrEqual(2);
    });

    it("limits maximum relations", () => {
      const parsed = createParsedFile({
        content: `
See [[A]] [[B]] [[C]] [[D]] [[E]] [[F]] [[G]] [[H]] [[I]] [[J]]
plus ADR-001 ADR-002 ADR-003 REQ-001 REQ-002
`,
      });

      const relations = generateRelations(parsed);

      expect(relations.length).toBeLessThanOrEqual(5);
    });

    it("deduplicates relations", () => {
      const parsed = createParsedFile({
        content: "[[ADR-001]] mentioned again [[ADR-001]] and ADR-001.",
        originalFrontmatter: { related: ["ADR-001"] },
      });

      const relations = generateRelations(parsed);

      const adr001Count = relations.filter(
        (r) => r.target === "ADR-001",
      ).length;
      expect(adr001Count).toBe(1);
    });
  });
});

describe("formatRelationsMarkdown", () => {
  it("formats relations as markdown", () => {
    const relations = [
      { type: "implements" as const, target: "REQ-001" },
      { type: "relates_to" as const, target: "ADR-015" },
    ];

    const markdown = formatRelationsMarkdown(relations);

    expect(markdown).toContain("## Relations");
    expect(markdown).toContain("- implements [[REQ-001]]");
    expect(markdown).toContain("- relates_to [[ADR-015]]");
  });

  it("includes context when present", () => {
    const relations = [
      {
        type: "part_of" as const,
        target: "Session Logs",
        context: "Container folder",
      },
    ];

    const markdown = formatRelationsMarkdown(relations);

    expect(markdown).toContain("(Container folder)");
  });

  it("provides default when empty", () => {
    const markdown = formatRelationsMarkdown([]);

    expect(markdown).toContain("## Relations");
    expect(markdown).toContain("[[Documentation]]");
  });
});
