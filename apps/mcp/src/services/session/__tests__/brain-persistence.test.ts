/**
 * Unit Tests for Brain Session Persistence
 *
 * Tests:
 * - saveSession writes to fixed Brain note path
 * - loadSession reads and returns session state
 * - loadSession returns null for missing session
 * - deleteSession writes tombstone
 * - saveAgentContext writes to correct path
 * - Round-trip: save then load session
 * - Error handling for Brain MCP unavailable
 */

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, expect, test, vi } from "vitest";
import type { AgentInvocation } from "../types";
import { createDefaultSessionState } from "../types";

// Mock client for Brain MCP
function createMockClient(noteStore: Map<string, string> = new Map()): Client {
  return {
    callTool: vi.fn(
      async ({
        name,
        arguments: args,
      }: {
        name: string;
        arguments: Record<string, unknown>;
      }) => {
        if (name === "write_note") {
          const path = args.path as string;
          const content = args.content as string;
          noteStore.set(path, content);
          return { content: [{ type: "text", text: "OK" }] };
        }

        if (name === "read_note") {
          const identifier = args.identifier as string;
          const content = noteStore.get(identifier);
          if (!content) {
            throw new Error(`Note not found: ${identifier}`);
          }
          return { content: [{ type: "text", text: content }] };
        }

        throw new Error(`Unknown tool: ${name}`);
      },
    ),
  } as unknown as Client;
}

// Mock client that throws errors
function createFailingClient(): Client {
  return {
    callTool: vi.fn(async () => {
      throw new Error("Brain MCP unavailable");
    }),
  } as unknown as Client;
}

describe("BrainSessionPersistence", () => {
  describe("saveSession", () => {
    test("writes to fixed Brain note path", async () => {
      const { BrainSessionPersistence } = await import("../brain-persistence");
      const noteStore = new Map<string, string>();
      const mockClient = createMockClient(noteStore);

      const persistence = new BrainSessionPersistence({ client: mockClient });
      const session = createDefaultSessionState();

      await persistence.saveSession(session);

      expect(noteStore.has("sessions/session")).toBe(true);
    });

    test("preserves all session state fields", async () => {
      const { BrainSessionPersistence } = await import("../brain-persistence");
      const noteStore = new Map<string, string>();
      const mockClient = createMockClient(noteStore);

      const persistence = new BrainSessionPersistence({ client: mockClient });
      const session = createDefaultSessionState();
      session.currentMode = "coding";
      session.activeFeature = "my-feature";
      session.activeTask = "my-task";
      session.version = 5;

      await persistence.saveSession(session);

      const storedContent = noteStore.get("sessions/session");
      const parsed = JSON.parse(storedContent!);

      expect(parsed.currentMode).toBe("coding");
      expect(parsed.activeFeature).toBe("my-feature");
      expect(parsed.activeTask).toBe("my-task");
      expect(parsed.version).toBe(5);
    });
  });

  describe("loadSession", () => {
    test("reads and parses session from Brain note", async () => {
      const { BrainSessionPersistence } = await import("../brain-persistence");

      const noteStore = new Map<string, string>();
      const mockClient = createMockClient(noteStore);

      // Pre-populate with session
      const session = createDefaultSessionState();
      noteStore.set("sessions/session", JSON.stringify(session));

      const persistence = new BrainSessionPersistence({ client: mockClient });
      const loaded = await persistence.loadSession();

      expect(loaded).not.toBeNull();
      expect(loaded?.currentMode).toBe("analysis");
    });

    test("returns null for missing session", async () => {
      const { BrainSessionPersistence } = await import("../brain-persistence");
      const noteStore = new Map<string, string>();
      const mockClient = createMockClient(noteStore);

      const persistence = new BrainSessionPersistence({ client: mockClient });
      const loaded = await persistence.loadSession();

      expect(loaded).toBeNull();
    });

    test("returns null for empty note content", async () => {
      const { BrainSessionPersistence } = await import("../brain-persistence");

      // Mock client that returns empty content
      const mockClient = {
        callTool: vi.fn(async () => ({
          content: [{ type: "text", text: "" }],
        })),
      } as unknown as Client;

      const persistence = new BrainSessionPersistence({ client: mockClient });
      const loaded = await persistence.loadSession();

      expect(loaded).toBeNull();
    });

    test("returns null for invalid JSON", async () => {
      const { BrainSessionPersistence } = await import("../brain-persistence");
      const noteStore = new Map<string, string>();
      const mockClient = createMockClient(noteStore);

      // Pre-populate with invalid JSON
      noteStore.set("sessions/session", "not valid json {{{");

      const persistence = new BrainSessionPersistence({ client: mockClient });
      const loaded = await persistence.loadSession();

      expect(loaded).toBeNull();
    });
  });

  describe("deleteSession", () => {
    test("writes tombstone to session note", async () => {
      const { BrainSessionPersistence } = await import("../brain-persistence");
      const noteStore = new Map<string, string>();
      const mockClient = createMockClient(noteStore);

      // Pre-populate with session
      noteStore.set("sessions/session", '{"currentMode":"analysis"}');

      const persistence = new BrainSessionPersistence({ client: mockClient });
      await persistence.deleteSession();

      const tombstone = JSON.parse(noteStore.get("sessions/session")!);
      expect(tombstone.deleted).toBe(true);
      expect(tombstone.deletedAt).toBeDefined();
    });
  });

  describe("saveAgentContext", () => {
    test("writes to correct path", async () => {
      const { BrainSessionPersistence } = await import("../brain-persistence");
      const noteStore = new Map<string, string>();
      const mockClient = createMockClient(noteStore);

      const invocation: AgentInvocation = {
        agent: "implementer",
        startedAt: new Date().toISOString(),
        completedAt: null,
        status: "in_progress",
        input: {
          prompt: "Test prompt",
          context: {},
          artifacts: [],
        },
        output: null,
        handoffFrom: "orchestrator",
        handoffTo: null,
        handoffReason: "Test handoff",
      };

      const persistence = new BrainSessionPersistence({ client: mockClient });
      await persistence.saveAgentContext("implementer", invocation);

      expect(noteStore.has("sessions/agent-implementer")).toBe(true);

      const stored = JSON.parse(noteStore.get("sessions/agent-implementer")!);
      expect(stored.agent).toBe("implementer");
      expect(stored.status).toBe("in_progress");
    });
  });

  describe("loadAgentContext", () => {
    test("loads agent invocation from Brain note", async () => {
      const { BrainSessionPersistence } = await import("../brain-persistence");
      const noteStore = new Map<string, string>();
      const mockClient = createMockClient(noteStore);

      const invocation: AgentInvocation = {
        agent: "analyst",
        startedAt: "2026-01-18T10:00:00Z",
        completedAt: "2026-01-18T10:30:00Z",
        status: "completed",
        input: {
          prompt: "Analyze this",
          context: { key: "value" },
          artifacts: ["/path/to/file"],
        },
        output: {
          artifacts: ["/output/file"],
          summary: "Analysis complete",
          recommendations: ["Do this"],
          blockers: [],
        },
        handoffFrom: null,
        handoffTo: "planner",
        handoffReason: "Analysis done",
      };

      noteStore.set("sessions/agent-analyst", JSON.stringify(invocation));

      const persistence = new BrainSessionPersistence({ client: mockClient });
      const loaded = await persistence.loadAgentContext("analyst");

      expect(loaded).not.toBeNull();
      expect(loaded?.agent).toBe("analyst");
      expect(loaded?.status).toBe("completed");
      expect(loaded?.output?.summary).toBe("Analysis complete");
    });

    test("returns null for missing agent context", async () => {
      const { BrainSessionPersistence } = await import("../brain-persistence");
      const noteStore = new Map<string, string>();
      const mockClient = createMockClient(noteStore);

      const persistence = new BrainSessionPersistence({ client: mockClient });
      const loaded = await persistence.loadAgentContext("qa");

      expect(loaded).toBeNull();
    });
  });

  describe("Round-trip", () => {
    test("save then load preserves session state", async () => {
      const { BrainSessionPersistence } = await import("../brain-persistence");
      const noteStore = new Map<string, string>();
      const mockClient = createMockClient(noteStore);

      const persistence = new BrainSessionPersistence({ client: mockClient });

      // Create session with all fields populated
      const original = createDefaultSessionState();
      original.currentMode = "coding";
      original.activeFeature = "feature-x";
      original.activeTask = "task-y";
      original.version = 42;
      original.modeHistory.push({
        mode: "planning",
        timestamp: "2026-01-18T09:00:00Z",
      });
      original.modeHistory.push({
        mode: "coding",
        timestamp: "2026-01-18T10:00:00Z",
      });

      // Save
      await persistence.saveSession(original);

      // Load
      const loaded = await persistence.loadSession();

      expect(loaded).not.toBeNull();
      expect(loaded?.currentMode).toBe(original.currentMode);
      expect(loaded?.activeFeature).toBe(original.activeFeature);
      expect(loaded?.activeTask).toBe(original.activeTask);
      expect(loaded?.version).toBe(original.version);
      expect(loaded?.modeHistory).toHaveLength(original.modeHistory.length);
    });
  });

  describe("Error Handling", () => {
    test("BrainUnavailableError when client fails to connect", async () => {
      const { BrainSessionPersistence } = await import("../brain-persistence");

      // Create persistence without custom client - will try to use shared client
      // We need to mock the getBasicMemoryClient to fail
      // For this test, use a client that throws
      const failingClient = createFailingClient();
      const persistence = new BrainSessionPersistence({
        client: failingClient,
      });

      // The client will throw when we try to use it
      const session = createDefaultSessionState();

      await expect(persistence.saveSession(session)).rejects.toThrow();
    });

    test("SessionNotFoundError has correct message", async () => {
      const { SessionNotFoundError } = await import("../brain-persistence");

      const error = new SessionNotFoundError();

      expect(error.message).toContain("not found");
      expect(error.name).toBe("SessionNotFoundError");
    });
  });

  describe("Default Persistence Instance", () => {
    test("getDefaultPersistence returns singleton", async () => {
      const { getDefaultPersistence, resetDefaultPersistence } = await import(
        "../brain-persistence"
      );

      resetDefaultPersistence();

      const first = getDefaultPersistence();
      const second = getDefaultPersistence();

      expect(first).toBe(second);
    });

    test("resetDefaultPersistence clears singleton", async () => {
      const { getDefaultPersistence, resetDefaultPersistence } = await import(
        "../brain-persistence"
      );

      const first = getDefaultPersistence();
      resetDefaultPersistence();
      const afterReset = getDefaultPersistence();

      expect(first).not.toBe(afterReset);
    });
  });

  describe("Project Path", () => {
    test("uses process.cwd() by default", async () => {
      const { BrainSessionPersistence } = await import("../brain-persistence");
      const noteStore = new Map<string, string>();
      const mockClient = createMockClient(noteStore);

      const persistence = new BrainSessionPersistence({ client: mockClient });
      const session = createDefaultSessionState();

      await persistence.saveSession(session);

      // Verify callTool was called with process.cwd()
      expect(mockClient.callTool).toHaveBeenCalled();

      // Check the arguments passed to callTool
      const calls = (mockClient.callTool as ReturnType<typeof vi.fn>).mock
        .calls;
      const writeCall = calls.find(
        (c: { name: string; arguments: Record<string, unknown> }[]) =>
          c[0].name === "write_note",
      );
      expect(writeCall).toBeDefined();
      expect(writeCall?.[0].arguments.project).toBe(process.cwd());
    });

    test("uses custom project path when provided", async () => {
      const { BrainSessionPersistence } = await import("../brain-persistence");
      const noteStore = new Map<string, string>();
      const mockClient = createMockClient(noteStore);

      const customPath = "/custom/project/path";
      const persistence = new BrainSessionPersistence({
        client: mockClient,
        projectPath: customPath,
      });
      const session = createDefaultSessionState();

      await persistence.saveSession(session);

      // Check the arguments passed to callTool
      const calls = (mockClient.callTool as ReturnType<typeof vi.fn>).mock
        .calls;
      const writeCall = calls.find(
        (c: { name: string; arguments: Record<string, unknown> }[]) =>
          c[0].name === "write_note",
      );
      expect(writeCall).toBeDefined();
      expect(writeCall?.[0].arguments.project).toBe(customPath);
    });
  });
});
