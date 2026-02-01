/**
 * Tests for migrate-agents handler
 *
 * Verifies embedding trigger integration after successful writes.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";

// Import modules to spy on
import * as clientModule from "../../../proxy/client";
import * as embeddingModule from "../../../services/embedding/triggerEmbedding";
import * as resolveModule from "../../../project/resolve";

import { handler } from "../index";

describe("migrate-agents handler", () => {
  let tempDir: string;
  let mockCallTool: ReturnType<typeof vi.fn>;
  let getBasicMemoryClientSpy: ReturnType<typeof vi.spyOn>;
  let triggerEmbeddingSpy: ReturnType<typeof vi.spyOn>;
  let resolveProjectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Create temp directory with test file
    tempDir = path.join("/tmp", `migrate-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Create a test markdown file
    const testContent = `---
title: Test Note
type: skill
---

# Test Note

## Summary

This is a test note for migration.

## Details

Some detailed content here.
`;
    await fs.writeFile(path.join(tempDir, "test-note.md"), testContent);

    // Setup mock callTool
    mockCallTool = vi.fn(() =>
      Promise.resolve({
        content: [{ text: "Note written successfully" }],
        isError: false,
      })
    );

    // Spy on getBasicMemoryClient
    getBasicMemoryClientSpy = vi.spyOn(clientModule, "getBasicMemoryClient").mockResolvedValue({
      callTool: mockCallTool,
    } as any);

    // Spy on triggerEmbedding
    triggerEmbeddingSpy = vi.spyOn(embeddingModule, "triggerEmbedding").mockImplementation(() => {});

    // Spy on resolveProject
    resolveProjectSpy = vi.spyOn(resolveModule, "resolveProject").mockReturnValue("test-project");
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });

    // Restore spies
    getBasicMemoryClientSpy.mockRestore();
    triggerEmbeddingSpy.mockRestore();
    resolveProjectSpy.mockRestore();
  });

  describe("embedding trigger", () => {
    test("calls triggerEmbedding after successful write_note", async () => {
      const result = await handler({
        source_path: tempDir,
        project: "test-project",
        dry_run: false,
      });

      // Verify write_note was called
      expect(mockCallTool).toHaveBeenCalled();
      const callArgs = mockCallTool.mock.calls[0][0];
      expect(callArgs.name).toBe("write_note");

      // Verify triggerEmbedding was called
      expect(triggerEmbeddingSpy).toHaveBeenCalledTimes(1);

      // Verify it was called with target and content
      const embedArgs = triggerEmbeddingSpy.mock.calls[0];
      expect(embedArgs[0]).toContain("test-note");
      expect(embedArgs[1]).toContain("Test Note");
    });

    test("does not call triggerEmbedding in dry_run mode", async () => {
      const result = await handler({
        source_path: tempDir,
        project: "test-project",
        dry_run: true,
      });

      // Verify write_note was NOT called
      expect(mockCallTool).not.toHaveBeenCalled();

      // Verify triggerEmbedding was NOT called
      expect(triggerEmbeddingSpy).not.toHaveBeenCalled();
    });

    test("does not call triggerEmbedding when write_note fails", async () => {
      // Make write_note fail
      mockCallTool.mockImplementation(() =>
        Promise.resolve({
          content: [{ text: "Error: write failed" }],
          isError: true,
        })
      );

      const result = await handler({
        source_path: tempDir,
        project: "test-project",
        dry_run: false,
      });

      // Verify triggerEmbedding was NOT called
      expect(triggerEmbeddingSpy).not.toHaveBeenCalled();
    });

    test("calls triggerEmbedding for each successfully migrated file", async () => {
      // Create a second test file
      const secondContent = `# Second Note

## Content

More content here.
`;
      await fs.writeFile(path.join(tempDir, "second-note.md"), secondContent);

      const result = await handler({
        source_path: tempDir,
        project: "test-project",
        dry_run: false,
      });

      // Verify triggerEmbedding was called twice (once per file)
      expect(triggerEmbeddingSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("migration output", () => {
    test("reports success when files are migrated", async () => {
      const result = await handler({
        source_path: tempDir,
        project: "test-project",
        dry_run: false,
      });

      expect(result.isError).toBeUndefined();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("SUCCESS");
      expect(text).toContain("**Files Migrated:** 1");
    });

    test("reports preview mode correctly in dry_run", async () => {
      const result = await handler({
        source_path: tempDir,
        project: "test-project",
        dry_run: true,
      });

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Migration Preview");
      expect(text).toContain("dry run");
    });
  });
});
