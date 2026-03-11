/**
 * Tests for validate_slash_command.ts.
 *
 * Covers all 5 validation categories:
 * 1. Frontmatter validation
 * 2. Argument validation
 * 3. Security validation
 * 4. Length validation
 * 5. Lint validation (structural tests only)
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { validateSlashCommand } from "../scripts/validate_slash_command";
import { resolve } from "path";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(resolve(tmpdir(), "slash-cmd-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeTestFile(name: string, content: string): string {
  const filePath = resolve(tmpDir, name);
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

describe("Frontmatter Validation", () => {
  test("fails when frontmatter missing", async () => {
    const f = writeTestFile("no-frontmatter.md", "# Command without frontmatter\n");
    const { blockingCount, violations } = await validateSlashCommand(f, true);
    expect(blockingCount).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes("Missing YAML frontmatter"))).toBe(true);
  });

  test("fails when description missing", async () => {
    const f = writeTestFile("no-desc.md", "---\nargument-hint: <arg>\n---\nCommand\n");
    const { blockingCount, violations } = await validateSlashCommand(f, true);
    expect(blockingCount).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes("Missing 'description'"))).toBe(true);
  });

  test("passes with trigger description", async () => {
    const f = writeTestFile(
      "valid-trigger.md",
      "---\ndescription: Use when Claude needs to analyze code patterns\n---\nAnalyze the codebase\n",
    );
    const { blockingCount } = await validateSlashCommand(f, true);
    expect(blockingCount).toBe(0);
  });

  test("passes with generate description", async () => {
    const f = writeTestFile(
      "valid-gen.md",
      "---\ndescription: Generate a summary report\n---\nContent\n",
    );
    const { blockingCount } = await validateSlashCommand(f, true);
    expect(blockingCount).toBe(0);
  });

  test("passes with research description", async () => {
    const f = writeTestFile(
      "valid-research.md",
      "---\ndescription: Research best practices\n---\nContent\n",
    );
    const { blockingCount } = await validateSlashCommand(f, true);
    expect(blockingCount).toBe(0);
  });

  test("warns with non-trigger description", async () => {
    const f = writeTestFile(
      "non-trigger.md",
      "---\ndescription: This is a command for testing\n---\nContent\n",
    );
    const { blockingCount, warningCount, violations } = await validateSlashCommand(f, true);
    expect(blockingCount).toBe(0);
    expect(warningCount).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes("Description should start with action verb"))).toBe(
      true,
    );
  });
});

describe("Argument Validation", () => {
  test("fails when arguments used without hint", async () => {
    const f = writeTestFile(
      "missing-hint.md",
      "---\ndescription: Use when testing arguments\n---\nProcess $ARGUMENTS\n",
    );
    const { blockingCount, violations } = await validateSlashCommand(f, true);
    expect(blockingCount).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes("uses arguments but no 'argument-hint'"))).toBe(true);
  });

  test("passes when hint matches usage", async () => {
    const f = writeTestFile(
      "valid-args.md",
      "---\ndescription: Use when processing input\nargument-hint: <input-data>\n---\nProcess $ARGUMENTS\n",
    );
    const { blockingCount } = await validateSlashCommand(f, true);
    expect(blockingCount).toBe(0);
  });

  test("fails with positional args without hint", async () => {
    const f = writeTestFile(
      "positional.md",
      "---\ndescription: Use when testing positional args\n---\nFirst: $1\nSecond: $2\n",
    );
    const { blockingCount } = await validateSlashCommand(f, true);
    expect(blockingCount).toBeGreaterThan(0);
  });

  test("warns when hint exists but unused", async () => {
    const f = writeTestFile(
      "unused-hint.md",
      "---\ndescription: Use when testing unused hints\nargument-hint: <unused>\n---\nNo arguments used here\n",
    );
    const { warningCount, violations } = await validateSlashCommand(f, true);
    expect(warningCount).toBeGreaterThan(0);
    expect(
      violations.some((v) => v.includes("argument-hint") && v.includes("doesn't use arguments")),
    ).toBe(true);
  });
});

describe("Security Validation", () => {
  test("fails when bash has no allowed-tools", async () => {
    const f = writeTestFile(
      "bash-no-tools.md",
      "---\ndescription: Use when running git commands\n---\nExecute: !git status\n",
    );
    const { blockingCount, violations } = await validateSlashCommand(f, true);
    expect(blockingCount).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes("bash execution") && v.includes("allowed-tools"))).toBe(
      true,
    );
  });

  test("fails with overly permissive wildcard", async () => {
    const f = writeTestFile(
      "bad-wildcard.md",
      "---\ndescription: Use when running commands\nallowed-tools: [*]\n---\nExecute: !git status\n",
    );
    const { blockingCount, violations } = await validateSlashCommand(f, true);
    expect(blockingCount).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes("overly permissive wildcard"))).toBe(true);
  });

  test("passes with scoped mcp wildcard", async () => {
    const f = writeTestFile(
      "scoped-mcp.md",
      "---\ndescription: Use when using MCP tools\nallowed-tools: [mcp__*]\n---\nExecute: !mcp__brain__search\n",
    );
    const { blockingCount } = await validateSlashCommand(f, true);
    expect(blockingCount).toBe(0);
  });

  test("passes with explicit tool list", async () => {
    const f = writeTestFile(
      "explicit-tools.md",
      "---\ndescription: Use when running specific tools\nallowed-tools: [Bash, Read, Write]\n---\nExecute: !git status\n",
    );
    const { blockingCount } = await validateSlashCommand(f, true);
    expect(blockingCount).toBe(0);
  });
});

describe("Length Validation", () => {
  test("warns when over 200 lines", async () => {
    const header = "---\ndescription: Use when testing long files\n---\n";
    const lines = Array.from({ length: 250 }, (_, i) => `Line ${i}`).join("\n");
    const f = writeTestFile("long-file.md", header + lines);
    const { warningCount, violations } = await validateSlashCommand(f, true);
    expect(warningCount).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes(">200") && v.includes("Consider converting"))).toBe(
      true,
    );
  });

  test("no warning under 200 lines", async () => {
    const f = writeTestFile(
      "normal-file.md",
      "---\ndescription: Use when testing normal files\n---\nNormal content\n",
    );
    const { violations } = await validateSlashCommand(f, true);
    expect(violations.some((v) => v.includes(">200"))).toBe(false);
  });
});

describe("Exit Code Behavior", () => {
  test("passes valid command", async () => {
    const f = writeTestFile(
      "valid.md",
      "---\ndescription: Use when testing valid commands\n---\nValid command content\n",
    );
    const { blockingCount } = await validateSlashCommand(f, true);
    expect(blockingCount).toBe(0);
  });

  test("fails blocking violation", async () => {
    const f = writeTestFile("blocking.md", "No frontmatter at all\n");
    const { blockingCount } = await validateSlashCommand(f, true);
    expect(blockingCount).toBeGreaterThan(0);
  });

  test("passes warning only", async () => {
    const f = writeTestFile(
      "warning-only.md",
      "---\ndescription: This description does not start with action verb\n---\nWarning only content\n",
    );
    const { blockingCount, warningCount } = await validateSlashCommand(f, true);
    expect(blockingCount).toBe(0);
    expect(warningCount).toBeGreaterThan(0);
  });

  test("fails for missing file", async () => {
    const { blockingCount } = await validateSlashCommand("/nonexistent/file.md", true);
    expect(blockingCount).toBeGreaterThan(0);
  });
});
