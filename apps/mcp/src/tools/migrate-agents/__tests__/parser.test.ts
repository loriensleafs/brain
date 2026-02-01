/**
 * Tests for parser module
 */

import { describe, expect, it } from "vitest";
import {
	getTargetFolder,
	parseAgentFile,
	parseListItems,
	parseMarkdownTable,
	parseSections,
} from "../parser";

describe("parseAgentFile", () => {
	it("parses file with frontmatter", () => {
		const content = `---
title: Test Document
type: decision
status: implemented
---

# Test Document

## Context

This is the context.

## Decision

We decided to do X.
`;

		const result = parseAgentFile(
			content,
			"/path/to/.agents/architecture/ADR-001-test.md",
			"/path/to/.agents",
		);

		expect(result.title).toBe("Test Document");
		expect(result.entityType).toBe("decision");
		expect(result.originalFrontmatter.status).toBe("implemented");
		expect(result.sections.has("Context")).toBe(true);
		expect(result.sections.has("Decision")).toBe(true);
	});

	it("extracts title from H1 when no frontmatter", () => {
		const content = `# My Session Log

## Objective

Test the system.
`;

		const result = parseAgentFile(
			content,
			"/path/to/.agents/sessions/2025-01-01-session-01.md",
			"/path/to/.agents",
		);

		expect(result.title).toBe("My Session Log");
		expect(result.entityType).toBe("session");
	});

	it("detects entity type from filename patterns", () => {
		const content = "# ADR-015 Auth Strategy\n\nSome content.";

		const result = parseAgentFile(
			content,
			"/path/to/.agents/ADR-015-auth-strategy.md",
			"/path/to/.agents",
		);

		expect(result.entityType).toBe("decision");
	});

	it("detects session from directory", () => {
		const content = "# Session 44\n\nSome content.";

		const result = parseAgentFile(
			content,
			"/path/to/.agents/sessions/2025-12-20-session-44.md",
			"/path/to/.agents",
		);

		expect(result.entityType).toBe("session");
		expect(result.relativePath).toBe("sessions/2025-12-20-session-44.md");
	});

	it("detects requirement from directory", () => {
		const content = "# REQ-001\n\nRequirement content.";

		const result = parseAgentFile(
			content,
			"/path/to/.agents/specs/requirements/REQ-001-login.md",
			"/path/to/.agents",
		);

		expect(result.entityType).toBe("requirement");
	});
});

describe("parseSections", () => {
	it("parses multiple heading levels", () => {
		const content = `# Title

Intro text.

## Section One

Content one.

### Subsection

Subsection content.

## Section Two

Content two.
`;

		const sections = parseSections(content);

		expect(sections.has("Section One")).toBe(true);
		expect(sections.has("Subsection")).toBe(true);
		expect(sections.has("Section Two")).toBe(true);
		expect(sections.get("Section One")).toContain("Content one");
	});

	it("captures intro before first heading", () => {
		const content = `Some intro text before headings.

# First Heading

Content.
`;

		const sections = parseSections(content);

		expect(sections.has("_intro")).toBe(true);
		expect(sections.get("_intro")).toContain("intro text");
	});
});

describe("parseListItems", () => {
	it("parses unordered list items", () => {
		const content = `
- First item
- Second item
* Third item
`;

		const items = parseListItems(content);

		expect(items).toHaveLength(3);
		expect(items[0]).toBe("First item");
		expect(items[1]).toBe("Second item");
		expect(items[2]).toBe("Third item");
	});

	it("parses ordered list items", () => {
		const content = `
1. First numbered
2. Second numbered
3. Third numbered
`;

		const items = parseListItems(content);

		expect(items).toHaveLength(3);
		expect(items[0]).toBe("First numbered");
	});

	it("handles mixed list types", () => {
		const content = `
- Unordered
1. Ordered
- Another unordered
`;

		const items = parseListItems(content);

		expect(items).toHaveLength(3);
	});
});

describe("parseMarkdownTable", () => {
	it("parses table rows", () => {
		const content = `
| Key | Value |
|-----|-------|
| name | test |
| status | active |
`;

		const table = parseMarkdownTable(content);

		// parseMarkdownTable extracts key-value pairs from table cells
		expect(table.get("name")).toBe("test");
		expect(table.get("status")).toBe("active");
	});

	it("skips header separator row", () => {
		const content = `
| Header1 | Header2 |
|---------|---------|
| data1 | data2 |
`;

		const table = parseMarkdownTable(content);

		// Should not include the separator row
		expect(table.has("---")).toBe(false);
		expect(table.get("data1")).toBe("data2");
	});
});

describe("getTargetFolder", () => {
	it("maps sessions directory", () => {
		expect(getTargetFolder("session", "sessions")).toBe("sessions");
	});

	it("maps architecture to decisions", () => {
		expect(getTargetFolder("decision", "architecture")).toBe("decisions");
	});

	it("maps specs/requirements", () => {
		expect(getTargetFolder("requirement", "specs/requirements")).toBe(
			"specs/requirements",
		);
	});

	it("handles nested paths", () => {
		expect(getTargetFolder("requirement", "specs/requirements/auth")).toBe(
			"specs/requirements",
		);
	});

	it("falls back to entity type", () => {
		expect(getTargetFolder("analysis", "unknown")).toBe("analysis");
	});
});
