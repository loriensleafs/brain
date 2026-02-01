/**
 * Unit tests for markdown utilities
 */

import { describe, expect, test } from "bun:test";
import { extractFrontmatter, extractTitle } from "../markdown";

describe("extractTitle", () => {
	test("extracts title from frontmatter", () => {
		const content = `---
title: My Document Title
author: Test Author
---

# Some Heading

Content here.`;

		expect(extractTitle(content)).toBe("My Document Title");
	});

	test("falls back to H1 heading when no frontmatter title", () => {
		const content = `---
author: Test Author
---

# My H1 Heading

Content here.`;

		expect(extractTitle(content)).toBe("My H1 Heading");
	});

	test("handles quoted frontmatter title", () => {
		const content = `---
title: "Quoted Title: With Special Chars"
---

Content here.`;

		expect(extractTitle(content)).toBe("Quoted Title: With Special Chars");
	});

	test("returns null when no title or H1 exists", () => {
		const content = `---
author: Test Author
---

## Only H2 Heading

Content here.`;

		expect(extractTitle(content)).toBeNull();
	});

	test("returns null for malformed content", () => {
		const invalidContent = `---
title: "Unclosed quote
---`;

		expect(extractTitle(invalidContent)).toBeNull();
	});

	test("trims whitespace from title", () => {
		const content = `---
title: "  Padded Title  "
---`;

		expect(extractTitle(content)).toBe("Padded Title");
	});

	test("handles content with no frontmatter", () => {
		const content = `# Just a Heading

Some content without frontmatter.`;

		expect(extractTitle(content)).toBe("Just a Heading");
	});
});

describe("extractFrontmatter", () => {
	test("extracts all frontmatter fields", () => {
		const content = `---
title: My Document
author: Test Author
tags:
  - typescript
  - testing
published: true
count: 42
---

Content here.`;

		const frontmatter = extractFrontmatter(content);

		expect(frontmatter.title).toBe("My Document");
		expect(frontmatter.author).toBe("Test Author");
		expect(frontmatter.tags).toEqual(["typescript", "testing"]);
		expect(frontmatter.published).toBe(true);
		expect(frontmatter.count).toBe(42);
	});

	test("returns empty object when no frontmatter exists", () => {
		const content = `# Just a heading

No frontmatter here.`;

		expect(extractFrontmatter(content)).toEqual({});
	});

	test("returns empty object on malformed frontmatter", () => {
		const invalidContent = `---
title: "Unclosed quote
author: Test
---`;

		expect(extractFrontmatter(invalidContent)).toEqual({});
	});

	test("handles various YAML types", () => {
		const content = `---
string: "value"
number: 123
float: 45.67
boolean: true
null_value: null
array: [1, 2, 3]
object:
  nested: "value"
---`;

		const frontmatter = extractFrontmatter(content);

		expect(frontmatter.string).toBe("value");
		expect(frontmatter.number).toBe(123);
		expect(frontmatter.float).toBe(45.67);
		expect(frontmatter.boolean).toBe(true);
		expect(frontmatter.null_value).toBeNull();
		expect(frontmatter.array).toEqual([1, 2, 3]);
		expect(frontmatter.object).toEqual({ nested: "value" });
	});

	test("handles empty frontmatter block", () => {
		const content = `---
---

Content here.`;

		expect(extractFrontmatter(content)).toEqual({});
	});
});
