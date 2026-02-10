import { describe, expect, it } from "vitest";
import {
  brainPrefix,
  parseFrontmatter,
  parseSimpleYaml,
  serializeYaml,
  withFrontmatter,
} from "../shared.js";

describe("parseSimpleYaml", () => {
  it("parses scalar strings", () => {
    const result = parseSimpleYaml("name: architect\nmodel: opus");
    expect(result).toEqual({ name: "architect", model: "opus" });
  });

  it("parses quoted strings", () => {
    const result = parseSimpleYaml('color: "#7B68EE"');
    expect(result).toEqual({ color: "#7B68EE" });
  });

  it("parses booleans", () => {
    const result = parseSimpleYaml("enabled: true\ndisabled: false");
    expect(result).toEqual({ enabled: true, disabled: false });
  });

  it("parses numbers", () => {
    const result = parseSimpleYaml("timeout: 10\nweight: 0.5");
    expect(result).toEqual({ timeout: 10, weight: 0.5 });
  });

  it("parses null values", () => {
    const result = parseSimpleYaml("value: null\nother: ~");
    expect(result).toEqual({ value: null, other: null });
  });

  it("parses inline arrays", () => {
    const result = parseSimpleYaml("tools: [Read, Write, Edit]");
    expect(result).toEqual({ tools: ["Read", "Write", "Edit"] });
  });

  it("parses block arrays", () => {
    const yaml = "tools:\n  - Read\n  - Write\n  - Edit";
    const result = parseSimpleYaml(yaml);
    expect(result).toEqual({ tools: ["Read", "Write", "Edit"] });
  });

  it("parses mixed content", () => {
    const yaml = [
      "name: architect",
      'color: "#7B68EE"',
      "model: opus",
      "tools:",
      "  - Read",
      "  - Grep",
      "skills:",
      "  - memory",
      "  - adr-creation",
    ].join("\n");

    const result = parseSimpleYaml(yaml);
    expect(result).toEqual({
      name: "architect",
      color: "#7B68EE",
      model: "opus",
      tools: ["Read", "Grep"],
      skills: ["memory", "adr-creation"],
    });
  });

  it("skips comments and empty lines", () => {
    const yaml = "# comment\nname: test\n\n# another\nmodel: opus";
    const result = parseSimpleYaml(yaml);
    expect(result).toEqual({ name: "test", model: "opus" });
  });
});

describe("parseFrontmatter", () => {
  it("parses frontmatter and body", () => {
    const input = "---\nname: test\nmodel: opus\n---\n\n# Test Agent\n\nBody here.";
    const { frontmatter, body } = parseFrontmatter(input);
    expect(frontmatter).toEqual({ name: "test", model: "opus" });
    expect(body).toBe("# Test Agent\n\nBody here.");
  });

  it("returns empty frontmatter for no frontmatter", () => {
    const input = "# Just a heading\n\nSome content.";
    const { frontmatter, body } = parseFrontmatter(input);
    expect(frontmatter).toEqual({});
    expect(body).toBe(input);
  });

  it("handles frontmatter with arrays", () => {
    const input = "---\nname: impl\ntools:\n  - Read\n  - Write\n---\n\nBody.";
    const { frontmatter, body } = parseFrontmatter(input);
    expect(frontmatter).toEqual({ name: "impl", tools: ["Read", "Write"] });
    expect(body).toBe("Body.");
  });
});

describe("serializeYaml", () => {
  it("serializes scalar values", () => {
    const result = serializeYaml({ name: "test", model: "opus" });
    expect(result).toBe("name: test\nmodel: opus");
  });

  it("serializes arrays as block style", () => {
    const result = serializeYaml({ tools: ["Read", "Write"] });
    expect(result).toBe("tools:\n  - Read\n  - Write");
  });

  it("quotes strings with special characters", () => {
    const result = serializeYaml({ color: "#7B68EE" });
    expect(result).toBe('color: "#7B68EE"');
  });

  it("skips null and undefined values", () => {
    const result = serializeYaml({ a: "yes", b: null, c: undefined });
    expect(result).toBe("a: yes");
  });

  it("skips empty arrays", () => {
    const result = serializeYaml({ name: "test", tools: [] });
    expect(result).toBe("name: test");
  });

  it("serializes booleans and numbers", () => {
    const result = serializeYaml({ enabled: true, timeout: 10 });
    expect(result).toBe("enabled: true\ntimeout: 10");
  });
});

describe("withFrontmatter", () => {
  it("wraps body with frontmatter", () => {
    const result = withFrontmatter({ name: "test" }, "# Body\n\nContent.");
    expect(result).toBe("---\nname: test\n---\n\n# Body\n\nContent.");
  });

  it("returns just body when frontmatter is empty", () => {
    const result = withFrontmatter({}, "# Body\n\nContent.");
    expect(result).toBe("# Body\n\nContent.");
  });
});

describe("brainPrefix", () => {
  it("adds brain emoji prefix", () => {
    expect(brainPrefix("architect")).toBe("\u{1F9E0}-architect");
  });

  it("does not double-prefix", () => {
    expect(brainPrefix("\u{1F9E0}-architect")).toBe("\u{1F9E0}-architect");
  });
});
