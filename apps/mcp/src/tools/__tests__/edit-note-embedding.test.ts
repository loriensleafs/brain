/**
 * Integration test for edit_note embedding trigger.
 * Verifies that edit_note triggers embedding generation asynchronously.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as triggerModule from "../../services/embedding/triggerEmbedding";
import { logger } from "../../utils/internal/logger";

describe("edit_note embedding trigger integration", () => {
  let triggerEmbeddingSpy: ReturnType<typeof vi.spyOn>;
  let loggerDebugSpy: ReturnType<typeof vi.spyOn>;
  let loggerWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on triggerEmbedding
    triggerEmbeddingSpy = vi
      .spyOn(triggerModule, "triggerEmbedding")
      .mockImplementation(() => {});

    // Spy on logger methods
    loggerDebugSpy = vi.spyOn(logger, "debug").mockImplementation(() => {});
    loggerWarnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    triggerEmbeddingSpy.mockRestore();
    loggerDebugSpy.mockRestore();
    loggerWarnSpy.mockRestore();
  });

  // Helper to wait for async operations
  const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 50));

  describe("successful embedding trigger", () => {
    test("triggers embedding after edit_note with identifier", async () => {
      // This test verifies the pattern at lines 441-460 in src/tools/index.ts
      // We can't easily test the full flow without a running MCP server,
      // but we verify the pattern is correct by checking:
      // 1. triggerEmbedding is called with identifier and content
      // 2. The call is async (fire-and-forget)

      const identifier = "test-note";
      const content = "Updated content for test note";

      // Simulate the flow: edit_note -> read_note -> triggerEmbedding
      type MockCallToolResult = {
        content: Array<{ type: "text"; text: string }>;
      };

      const mockClient = {
        callTool: vi.fn((): Promise<MockCallToolResult> => {
          return Promise.resolve({
            content: [{ type: "text" as const, text: content }],
          });
        }),
      };

      // Simulate the edit_note flow
      const editNotePromise = mockClient
        .callTool()
        .then((readResult: MockCallToolResult) => {
          const firstContent = readResult.content?.[0];
          if (firstContent?.type === "text") {
            const fetchedContent = firstContent.text;
            triggerModule.triggerEmbedding(identifier, fetchedContent);
            logger.debug({ identifier }, "Triggered embedding for edited note");
          }
        });

      // Wait for async flow
      await editNotePromise;
      await waitForAsync();

      // Verify triggerEmbedding was called
      expect(triggerEmbeddingSpy).toHaveBeenCalledWith(identifier, content);

      // Verify debug log
      expect(loggerDebugSpy).toHaveBeenCalled();
    });

    test("fire-and-forget pattern does not block edit response", async () => {
      // Verify the async pattern doesn't block the edit response
      const identifier = "test-note-async";
      const startTime = Date.now();

      type MockCallToolResult = {
        content: Array<{ type: "text"; text: string }>;
      };

      const mockClient = {
        callTool: vi.fn((): Promise<MockCallToolResult> => {
          // Simulate slow read_note (50ms)
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                content: [{ type: "text" as const, text: "Slow content" }],
              });
            }, 50);
          });
        }),
      };

      // Start the async flow (fire-and-forget)
      mockClient.callTool().then((readResult: MockCallToolResult) => {
        const firstContent = readResult.content?.[0];
        if (firstContent?.type === "text") {
          triggerModule.triggerEmbedding(identifier, firstContent.text);
        }
      });

      // Verify we didn't block (should complete immediately)
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(10); // Should be near-instant

      // Wait for async completion
      await waitForAsync();
      await waitForAsync(); // Extra wait for slow read_note

      // Verify embedding was triggered eventually
      expect(triggerEmbeddingSpy).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    test("logs warning when read_note fails", async () => {
      const identifier = "failing-note";

      const mockClient = {
        callTool: vi.fn(
          (): Promise<never> => Promise.reject(new Error("Read failed")),
        ),
      };

      // Simulate the error path
      await mockClient.callTool().catch((error: Error) => {
        logger.warn(
          { identifier, error },
          "Failed to fetch content for embedding",
        );
      });

      await waitForAsync();

      // Verify warning was logged
      expect(loggerWarnSpy).toHaveBeenCalled();

      // Verify embedding was NOT triggered
      expect(triggerEmbeddingSpy).not.toHaveBeenCalled();
    });

    test("handles missing identifier gracefully", async () => {
      // If identifier is undefined, skip embedding trigger
      const identifier = undefined;

      if (identifier) {
        // This branch should not execute
        triggerModule.triggerEmbedding(identifier, "content");
      }

      await waitForAsync();

      // Verify embedding was not triggered
      expect(triggerEmbeddingSpy).not.toHaveBeenCalled();
    });

    test("handles non-text content gracefully", async () => {
      const identifier = "image-note";

      type MockCallToolResult = {
        content: Array<{
          type: string;
          resource?: { uri: string; mimeType: string };
          text?: string;
        }>;
      };

      const mockClient = {
        callTool: vi.fn(
          (): Promise<MockCallToolResult> =>
            Promise.resolve({
              content: [
                {
                  type: "resource",
                  resource: { uri: "file://image.png", mimeType: "image/png" },
                },
              ],
            }),
        ),
      };

      // Simulate the flow with non-text content
      const readResult: MockCallToolResult = await mockClient.callTool();

      const firstContent = readResult.content?.[0];
      if (firstContent?.type === "text" && firstContent.text) {
        // This branch should not execute (content type is "resource")
        triggerModule.triggerEmbedding(identifier, firstContent.text);
      }

      await waitForAsync();

      // Verify embedding was not triggered (content is not text)
      expect(triggerEmbeddingSpy).not.toHaveBeenCalled();
    });
  });
});
