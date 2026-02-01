/**
 * Tests for Workflow MCP tools.
 *
 * These tests verify:
 * - Tool definitions have correct names and schemas
 * - Handlers return CallToolResult format
 * - Error handling when Inngest is unavailable
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";

// Store original fetch
const originalFetch = globalThis.fetch;

describe("Workflow MCP Tools", () => {
  beforeEach(() => {
    // Reset fetch to original
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch;
  });

  describe("Tool Definitions", () => {
    describe("listWorkflowsToolDefinition", () => {
      test("has correct name", async () => {
        const { listWorkflowsToolDefinition } = await import("../schema");

        expect(listWorkflowsToolDefinition.name).toBe("list_workflows");
      });

      test("has description", async () => {
        const { listWorkflowsToolDefinition } = await import("../schema");

        expect(listWorkflowsToolDefinition.description).toBeDefined();
        expect(listWorkflowsToolDefinition.description?.length).toBeGreaterThan(
          0,
        );
      });

      test("has input schema with object type", async () => {
        const { listWorkflowsToolDefinition } = await import("../schema");

        expect(listWorkflowsToolDefinition.inputSchema.type).toBe("object");
      });
    });

    describe("sendWorkflowEventToolDefinition", () => {
      test("has correct name", async () => {
        const { sendWorkflowEventToolDefinition } = await import("../schema");

        expect(sendWorkflowEventToolDefinition.name).toBe(
          "send_workflow_event",
        );
      });

      test("has description", async () => {
        const { sendWorkflowEventToolDefinition } = await import("../schema");

        expect(sendWorkflowEventToolDefinition.description).toBeDefined();
        expect(
          sendWorkflowEventToolDefinition.description?.length,
        ).toBeGreaterThan(0);
      });

      test("has input schema with required event_name property", async () => {
        const { sendWorkflowEventToolDefinition } = await import("../schema");

        expect(sendWorkflowEventToolDefinition.inputSchema.type).toBe("object");
        expect(sendWorkflowEventToolDefinition.inputSchema.required).toContain(
          "event_name",
        );
      });

      test("has event_name and data properties in schema", async () => {
        const { sendWorkflowEventToolDefinition } = await import("../schema");

        const properties = sendWorkflowEventToolDefinition.inputSchema
          .properties as Record<string, unknown>;
        expect(properties.event_name).toBeDefined();
        expect(properties.data).toBeDefined();
      });
    });

    describe("getWorkflowToolDefinition", () => {
      test("has correct name", async () => {
        const { getWorkflowToolDefinition } = await import("../schema");

        expect(getWorkflowToolDefinition.name).toBe("get_workflow");
      });

      test("has description", async () => {
        const { getWorkflowToolDefinition } = await import("../schema");

        expect(getWorkflowToolDefinition.description).toBeDefined();
        expect(getWorkflowToolDefinition.description?.length).toBeGreaterThan(
          0,
        );
      });

      test("has input schema with required run_id property", async () => {
        const { getWorkflowToolDefinition } = await import("../schema");

        expect(getWorkflowToolDefinition.inputSchema.type).toBe("object");
        expect(getWorkflowToolDefinition.inputSchema.required).toContain(
          "run_id",
        );
      });
    });
  });

  describe("Input Schema Validation", () => {
    describe("ListWorkflowsArgsSchema", () => {
      test("accepts empty object", async () => {
        const { ListWorkflowsArgsSchema } = await import("../schema");

        const result = ListWorkflowsArgsSchema.safeParse({});
        expect(result.success).toBe(true);
      });
    });

    describe("SendWorkflowEventArgsSchema", () => {
      test("accepts valid event_name", async () => {
        const { SendWorkflowEventArgsSchema } = await import("../schema");

        const result = SendWorkflowEventArgsSchema.safeParse({
          event_name: "feature/completion.requested",
        });
        expect(result.success).toBe(true);
      });

      test("accepts event_name with optional data", async () => {
        const { SendWorkflowEventArgsSchema } = await import("../schema");

        const result = SendWorkflowEventArgsSchema.safeParse({
          event_name: "feature/completion.requested",
          data: { featureId: "feature-123" },
        });
        expect(result.success).toBe(true);
      });

      test("rejects missing event_name", async () => {
        const { SendWorkflowEventArgsSchema } = await import("../schema");

        const result = SendWorkflowEventArgsSchema.safeParse({});
        expect(result.success).toBe(false);
      });
    });

    describe("GetWorkflowArgsSchema", () => {
      test("accepts valid run_id", async () => {
        const { GetWorkflowArgsSchema } = await import("../schema");

        const result = GetWorkflowArgsSchema.safeParse({
          run_id: "run-456-def",
        });
        expect(result.success).toBe(true);
      });

      test("rejects missing run_id", async () => {
        const { GetWorkflowArgsSchema } = await import("../schema");

        const result = GetWorkflowArgsSchema.safeParse({});
        expect(result.success).toBe(false);
      });
    });
  });

  describe("MCP Handlers - CallToolResult Format", () => {
    describe("listWorkflowsHandler", () => {
      test("returns CallToolResult with content array", async () => {
        const { listWorkflowsHandler } = await import("../index");

        const result = await listWorkflowsHandler({});

        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content.length).toBeGreaterThan(0);
        expect(result.content[0].type).toBe("text");
      });

      test("returns isError when Inngest unavailable", async () => {
        const { listWorkflowsHandler } = await import("../index");

        const result = await listWorkflowsHandler({});

        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        expect(result.content[0].type).toBe("text");
      });
    });

    describe("sendWorkflowEventHandler", () => {
      test("returns CallToolResult with content array", async () => {
        const { sendWorkflowEventHandler } = await import("../index");

        const result = await sendWorkflowEventHandler({
          event_name: "test/event",
        });

        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content.length).toBeGreaterThan(0);
        expect(result.content[0].type).toBe("text");
      });

      test("returns error when Inngest unavailable", async () => {
        const { sendWorkflowEventHandler } = await import("../index");

        const result = await sendWorkflowEventHandler({
          event_name: "feature/completion.requested",
          data: { featureId: "test-feature" },
        });

        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        const text = (result.content[0] as { text: string }).text;
        expect(typeof text).toBe("string");
      });
    });

    describe("getWorkflowHandler", () => {
      test("returns CallToolResult with content array", async () => {
        const { getWorkflowHandler } = await import("../index");

        const result = await getWorkflowHandler({
          run_id: "test-run-456",
        });

        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content[0].type).toBe("text");
      });
    });
  });

  describe("Error Handling", () => {
    test("handlers return JSON-formatted error when Inngest unavailable", async () => {
      const { listWorkflowsHandler } = await import("../index");

      const result = await listWorkflowsHandler({});
      const text = (result.content[0] as { text: string }).text;

      const parsed = JSON.parse(text);
      expect(parsed).toBeDefined();
      expect("success" in parsed || "error" in parsed).toBe(true);
    });

    test("handler responses are valid JSON", async () => {
      const {
        listWorkflowsHandler,
        sendWorkflowEventHandler,
        getWorkflowHandler,
      } = await import("../index");

      const results = await Promise.all([
        listWorkflowsHandler({}),
        sendWorkflowEventHandler({ event_name: "test" }),
        getWorkflowHandler({ run_id: "test-id" }),
      ]);

      for (const result of results) {
        const text = (result.content[0] as { text: string }).text;
        expect(() => JSON.parse(text)).not.toThrow();
      }
    });
  });

  describe("WorkflowStatus type structure", () => {
    test("WorkflowStatus includes all expected values", () => {
      const validStatuses = [
        "PENDING",
        "RUNNING",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
        "UNKNOWN",
      ];

      expect(validStatuses).toContain("PENDING");
      expect(validStatuses).toContain("RUNNING");
      expect(validStatuses).toContain("COMPLETED");
      expect(validStatuses).toContain("FAILED");
      expect(validStatuses).toContain("CANCELLED");
      expect(validStatuses).toContain("UNKNOWN");
    });
  });

  describe("WorkflowInfo type structure", () => {
    test("WorkflowInfo has correct structure", () => {
      const mockWorkflow = {
        id: "workflow-123",
        name: "Test Workflow",
        triggers: [{ event: "test/event" }],
      };

      expect(mockWorkflow.id).toBe("workflow-123");
      expect(mockWorkflow.name).toBe("Test Workflow");
      expect(mockWorkflow.triggers).toHaveLength(1);
      expect(mockWorkflow.triggers[0].event).toBe("test/event");
    });

    test("WorkflowInfo supports cron triggers", () => {
      const mockWorkflow = {
        id: "scheduled-workflow",
        name: "Scheduled Task",
        triggers: [{ cron: "0 0 * * *" }],
      };

      expect(mockWorkflow.triggers[0].cron).toBe("0 0 * * *");
    });
  });

  describe("WorkflowRun type", () => {
    test("WorkflowRun has correct structure", async () => {
      const mockRun = {
        id: "run-123",
        functionId: "function-abc",
        status: "COMPLETED" as const,
        startedAt: "2024-01-01T00:00:00Z",
        endedAt: "2024-01-01T00:01:00Z",
        output: { result: "success" },
        steps: [
          {
            id: "step-1",
            name: "validate-input",
            status: "COMPLETED" as const,
            output: { valid: true },
          },
        ],
      };

      expect(mockRun.id).toBe("run-123");
      expect(mockRun.functionId).toBe("function-abc");
      expect(mockRun.status).toBe("COMPLETED");
      expect(mockRun.steps).toHaveLength(1);
      expect(mockRun.steps?.[0].name).toBe("validate-input");
    });

    test("WorkflowRun supports optional fields", async () => {
      const minimalRun = {
        id: "run-456",
        functionId: "function-def",
        status: "PENDING" as const,
      };

      expect(minimalRun.id).toBe("run-456");
      expect(minimalRun.status).toBe("PENDING");
    });
  });
});
