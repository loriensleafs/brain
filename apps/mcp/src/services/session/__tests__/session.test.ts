/**
 * Integration tests for Session Service
 *
 * Tests:
 * - getSession/setSession operations
 * - Mode changes and history tracking
 * - File cache sync for hooks
 * - Session lifecycle management
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Test state directory to avoid polluting real state
const TEST_STATE_DIR = path.join(os.tmpdir(), "brain-session-test");

describe("Session Service", () => {
  let originalXdgState: string | undefined;
  let originalSessionId: string | undefined;

  beforeEach(() => {
    // Save original env vars
    originalXdgState = process.env.XDG_STATE_HOME;
    originalSessionId = process.env.BRAIN_SESSION_ID;

    // Set test state directory
    process.env.XDG_STATE_HOME = TEST_STATE_DIR;

    // Clean up test directory
    if (fs.existsSync(TEST_STATE_DIR)) {
      fs.rmSync(TEST_STATE_DIR, { recursive: true, force: true });
    }
  });

  afterEach(async () => {
    // Restore original env vars
    if (originalXdgState !== undefined) {
      process.env.XDG_STATE_HOME = originalXdgState;
    } else {
      delete process.env.XDG_STATE_HOME;
    }

    if (originalSessionId !== undefined) {
      process.env.BRAIN_SESSION_ID = originalSessionId;
    } else {
      delete process.env.BRAIN_SESSION_ID;
    }

    // Clean up test directory
    if (fs.existsSync(TEST_STATE_DIR)) {
      fs.rmSync(TEST_STATE_DIR, { recursive: true, force: true });
    }

    // Clear module cache to reset singleton state
    // Note: In bun, we need to re-import to get fresh state
  });

  describe("getStateDir", () => {
    test("uses XDG_STATE_HOME when set", async () => {
      const { getStateDir } = await import("../index");

      const stateDir = getStateDir();
      expect(stateDir).toBe(path.join(TEST_STATE_DIR, "brain"));
    });

    test("defaults to ~/.local/state/brain when XDG_STATE_HOME not set", async () => {
      delete process.env.XDG_STATE_HOME;

      // Need fresh import
      const mod = await import("../index");
      const stateDir = mod.getStateDir();

      expect(stateDir).toBe(path.join(os.homedir(), ".local", "state", "brain"));
    });
  });

  describe("createDefaultSessionState", () => {
    test("creates state with analysis mode as default", async () => {
      const { createDefaultSessionState, DEFAULT_MODE } = await import("../index");

      const state = createDefaultSessionState("test-session-123");

      expect(state.sessionId).toBe("test-session-123");
      expect(state.currentMode).toBe(DEFAULT_MODE);
      expect(state.currentMode).toBe("analysis");
      expect(state.modeHistory).toHaveLength(1);
      expect(state.modeHistory[0].mode).toBe("analysis");
      expect(state.activeFeature).toBeUndefined();
      expect(state.activeTask).toBeUndefined();
      expect(state.updatedAt).toBeDefined();
    });

    test("mode history includes initial entry with timestamp", async () => {
      const { createDefaultSessionState } = await import("../index");

      const before = new Date().toISOString();
      const state = createDefaultSessionState("test-session");
      const after = new Date().toISOString();

      expect(state.modeHistory).toHaveLength(1);
      expect(state.modeHistory[0].mode).toBe("analysis");
      expect(state.modeHistory[0].timestamp >= before).toBe(true);
      expect(state.modeHistory[0].timestamp <= after).toBe(true);
    });
  });

  describe("initSession", () => {
    test("creates unique session ID", async () => {
      const { initSession, clearCurrentSessionId } = await import("../index");

      clearCurrentSessionId();
      const sessionId = initSession();

      expect(sessionId).toBeDefined();
      expect(sessionId.length).toBeGreaterThan(0);
      // UUID format check
      expect(sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    test("creates session directory with meta.json", async () => {
      const { initSession, getSessionPath, clearCurrentSessionId } = await import(
        "../index"
      );

      clearCurrentSessionId();
      const sessionId = initSession();
      const sessionDir = getSessionPath(sessionId);
      const metaPath = path.join(sessionDir, "meta.json");

      expect(fs.existsSync(sessionDir)).toBe(true);
      expect(fs.existsSync(metaPath)).toBe(true);

      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      expect(meta.pid).toBe(process.pid);
      expect(meta.startedAt).toBeDefined();
      expect(meta.lastActivity).toBeDefined();
    });

    test("sets BRAIN_SESSION_ID env var", async () => {
      const { initSession, clearCurrentSessionId } = await import("../index");

      clearCurrentSessionId();
      delete process.env.BRAIN_SESSION_ID;

      const sessionId = initSession();

      expect(process.env.BRAIN_SESSION_ID).toBeDefined();
      expect(String(process.env.BRAIN_SESSION_ID)).toEqual(sessionId);
    });

    test("returns same session ID on subsequent calls", async () => {
      const { initSession, clearCurrentSessionId } = await import("../index");

      clearCurrentSessionId();
      const first = initSession();
      const second = initSession();

      expect(first).toBe(second);
    });
  });

  describe("getSession / setSession", () => {
    test("getSession returns default state for new session", async () => {
      const { initSession, getSession, clearCurrentSessionId } = await import(
        "../index"
      );

      clearCurrentSessionId();
      initSession();
      const state = getSession();

      expect(state).not.toBeNull();
      expect(state!.currentMode).toBe("analysis");
      expect(state!.modeHistory).toHaveLength(1);
    });

    test("setSession updates mode and adds to history", async () => {
      const { initSession, getSession, setSession, clearCurrentSessionId } =
        await import("../index");

      clearCurrentSessionId();
      initSession();

      const updated = setSession({ mode: "coding" });

      expect(updated).not.toBeNull();
      expect(updated!.currentMode).toBe("coding");
      expect(updated!.modeHistory).toHaveLength(2);
      expect(updated!.modeHistory[0].mode).toBe("analysis");
      expect(updated!.modeHistory[1].mode).toBe("coding");

      // Verify via getSession
      const retrieved = getSession();
      expect(retrieved!.currentMode).toBe("coding");
    });

    test("setSession updates task", async () => {
      const { initSession, setSession, clearCurrentSessionId } = await import(
        "../index"
      );

      clearCurrentSessionId();
      initSession();

      const updated = setSession({ task: "Implementing feature X" });

      expect(updated).not.toBeNull();
      expect(updated!.activeTask).toBe("Implementing feature X");
    });

    test("setSession updates feature", async () => {
      const { initSession, setSession, clearCurrentSessionId } = await import(
        "../index"
      );

      clearCurrentSessionId();
      initSession();

      const updated = setSession({ feature: "user-auth" });

      expect(updated).not.toBeNull();
      expect(updated!.activeFeature).toBe("user-auth");
    });

    test("setSession clears task when feature changes", async () => {
      const { initSession, setSession, clearCurrentSessionId } = await import(
        "../index"
      );

      clearCurrentSessionId();
      initSession();

      // Set initial task and feature
      setSession({ task: "Task A", feature: "feature-1" });

      // Change feature - task should be cleared
      const updated = setSession({ feature: "feature-2" });

      expect(updated!.activeFeature).toBe("feature-2");
      expect(updated!.activeTask).toBeUndefined();
    });

    test("setSession can update multiple fields at once", async () => {
      const { initSession, setSession, clearCurrentSessionId } = await import(
        "../index"
      );

      clearCurrentSessionId();
      initSession();

      const updated = setSession({
        mode: "planning",
        task: "Design review",
        feature: "payment-flow",
      });

      expect(updated!.currentMode).toBe("planning");
      expect(updated!.activeTask).toBe("Design review");
      expect(updated!.activeFeature).toBe("payment-flow");
    });

    test("setSession does not add duplicate mode history entry for same mode", async () => {
      const { initSession, setSession, getSession, clearCurrentSessionId } =
        await import("../index");

      clearCurrentSessionId();
      initSession();

      // Try to set the same mode again
      setSession({ mode: "analysis" });

      const state = getSession();
      expect(state!.modeHistory).toHaveLength(1); // Should still be 1, not 2
    });

    test("getSession returns null when no current session", async () => {
      const { getSession, clearCurrentSessionId } = await import("../index");

      clearCurrentSessionId();
      const state = getSession();

      expect(state).toBeNull();
    });

    test("setSession returns null when no current session", async () => {
      const { setSession, clearCurrentSessionId } = await import("../index");

      clearCurrentSessionId();
      const result = setSession({ mode: "coding" });

      expect(result).toBeNull();
    });
  });

  describe("File Cache Sync", () => {
    test("initSession syncs initial state to file cache", async () => {
      const { initSession, getStateDir, clearCurrentSessionId } = await import(
        "../index"
      );

      clearCurrentSessionId();
      const sessionId = initSession();
      const cachePath = path.join(getStateDir(), "session.json");

      expect(fs.existsSync(cachePath)).toBe(true);

      const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      expect(cached.mode).toBe("analysis");
      expect(cached.sessionId).toBe(sessionId);
    });

    test("setSession syncs updated state to file cache", async () => {
      const { initSession, setSession, getStateDir, clearCurrentSessionId } =
        await import("../index");

      clearCurrentSessionId();
      initSession();

      setSession({
        mode: "coding",
        task: "Implementation",
        feature: "new-feature",
      });

      const cachePath = path.join(getStateDir(), "session.json");
      const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8"));

      expect(cached.mode).toBe("coding");
      expect(cached.task).toBe("Implementation");
      expect(cached.feature).toBe("new-feature");
    });

    test("file cache contains hook-readable format", async () => {
      const { initSession, setSession, getStateDir, clearCurrentSessionId } =
        await import("../index");

      clearCurrentSessionId();
      const sessionId = initSession();
      setSession({ mode: "planning", task: "Design", feature: "api-v2" });

      const cachePath = path.join(getStateDir(), "session.json");
      const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8"));

      // Verify structure matches what hooks expect
      expect(cached).toHaveProperty("mode");
      expect(cached).toHaveProperty("sessionId");
      expect(cached).toHaveProperty("updatedAt");
      expect(cached.mode).toBe("planning");
      expect(cached.sessionId).toBe(sessionId);
    });
  });

  describe("Mode History", () => {
    test("tracks full mode transition history", async () => {
      const { initSession, setSession, getSession, clearCurrentSessionId } =
        await import("../index");

      clearCurrentSessionId();
      initSession();

      setSession({ mode: "planning" });
      setSession({ mode: "coding" });
      setSession({ mode: "analysis" });

      const state = getSession();
      expect(state!.modeHistory).toHaveLength(4);
      expect(state!.modeHistory.map((h) => h.mode)).toEqual([
        "analysis",
        "planning",
        "coding",
        "analysis",
      ]);
    });

    test("getRecentModeHistory returns last N entries", async () => {
      const {
        initSession,
        setSession,
        getSession,
        getRecentModeHistory,
        clearCurrentSessionId,
      } = await import("../index");

      clearCurrentSessionId();
      initSession();

      // Create more than 5 entries
      setSession({ mode: "planning" });
      setSession({ mode: "coding" });
      setSession({ mode: "analysis" });
      setSession({ mode: "planning" });
      setSession({ mode: "coding" });
      setSession({ mode: "disabled" });

      const state = getSession();
      const recent = getRecentModeHistory(state!, 3);

      expect(recent).toHaveLength(3);
      // History: analysis, planning, coding, analysis, planning, coding, disabled
      // Last 3: planning, coding, disabled
      expect(recent.map((h) => h.mode)).toEqual(["planning", "coding", "disabled"] as const);
    });

    test("each history entry has timestamp", async () => {
      const { initSession, setSession, getSession, clearCurrentSessionId } =
        await import("../index");

      clearCurrentSessionId();
      initSession();

      const before = new Date().toISOString();
      setSession({ mode: "coding" });
      const after = new Date().toISOString();

      const state = getSession();
      const lastEntry = state!.modeHistory[state!.modeHistory.length - 1];

      expect(lastEntry.timestamp >= before).toBe(true);
      expect(lastEntry.timestamp <= after).toBe(true);
    });
  });

  describe("Immutable State Helpers", () => {
    test("withModeChange creates new state object", async () => {
      const { createDefaultSessionState, withModeChange } = await import(
        "../index"
      );

      const original = createDefaultSessionState("test-session");
      const updated = withModeChange(original, "coding");

      expect(original).not.toBe(updated);
      expect(original.currentMode).toBe("analysis");
      expect(updated.currentMode).toBe("coding");
    });

    test("withFeatureChange creates new state with cleared task", async () => {
      const {
        createDefaultSessionState,
        withTaskChange,
        withFeatureChange,
      } = await import("../index");

      let state = createDefaultSessionState("test-session");
      state = withTaskChange(state, "Task 1");
      state = withFeatureChange(state, "new-feature");

      expect(state.activeFeature).toBe("new-feature");
      expect(state.activeTask).toBeUndefined();
    });

    test("withTaskChange creates new state with task", async () => {
      const { createDefaultSessionState, withTaskChange } = await import(
        "../index"
      );

      const original = createDefaultSessionState("test-session");
      const updated = withTaskChange(original, "New Task");

      expect(original).not.toBe(updated);
      expect(original.activeTask).toBeUndefined();
      expect(updated.activeTask).toBe("New Task");
    });
  });

  describe("Serialization", () => {
    test("serializeSessionState produces valid JSON", async () => {
      const { createDefaultSessionState, serializeSessionState } = await import(
        "../index"
      );

      const state = createDefaultSessionState("test-session");
      const json = serializeSessionState(state);

      expect(() => JSON.parse(json)).not.toThrow();

      const parsed = JSON.parse(json);
      expect(parsed.sessionId).toBe("test-session");
      expect(parsed.currentMode).toBe("analysis");
    });

    test("deserializeSessionState parses valid JSON", async () => {
      const {
        createDefaultSessionState,
        serializeSessionState,
        deserializeSessionState,
      } = await import("../index");

      const original = createDefaultSessionState("test-session");
      original.activeFeature = "feature-x";
      original.activeTask = "task-y";

      const json = serializeSessionState(original);
      const restored = deserializeSessionState(json);

      expect(restored).not.toBeNull();
      expect(restored!.sessionId).toBe(original.sessionId);
      expect(restored!.currentMode).toBe(original.currentMode);
      expect(restored!.activeFeature).toBe("feature-x");
      expect(restored!.activeTask).toBe("task-y");
    });

    test("deserializeSessionState returns null for invalid JSON", async () => {
      const { deserializeSessionState } = await import("../index");

      const result = deserializeSessionState("not valid json");

      expect(result).toBeNull();
    });

    test("deserializeSessionState returns null for invalid structure", async () => {
      const { deserializeSessionState } = await import("../index");

      const invalidStructures = [
        JSON.stringify({ foo: "bar" }), // Missing required fields
        JSON.stringify({ sessionId: 123 }), // Wrong type for sessionId
        JSON.stringify({ sessionId: "test", currentMode: 123 }), // Wrong type for mode
        JSON.stringify({ sessionId: "test", currentMode: "analysis" }), // Missing modeHistory
      ];

      for (const json of invalidStructures) {
        const result = deserializeSessionState(json);
        expect(result).toBeNull();
      }
    });
  });

  describe("Session Cleanup", () => {
    test("cleanupSession removes session directory", async () => {
      const { initSession, getSessionPath, cleanupSession, clearCurrentSessionId } =
        await import("../index");

      clearCurrentSessionId();
      const sessionId = initSession();
      const sessionDir = getSessionPath(sessionId);

      expect(fs.existsSync(sessionDir)).toBe(true);

      await cleanupSession();

      expect(fs.existsSync(sessionDir)).toBe(false);
    });

    test("cleanupSession clears env var", async () => {
      const { initSession, cleanupSession, clearCurrentSessionId } = await import(
        "../index"
      );

      clearCurrentSessionId();
      initSession();

      expect(process.env.BRAIN_SESSION_ID).toBeDefined();

      await cleanupSession();

      expect(process.env.BRAIN_SESSION_ID).toBeUndefined();
    });
  });

  describe("MODE_DESCRIPTIONS", () => {
    test("has descriptions for all modes", async () => {
      const { MODE_DESCRIPTIONS } = await import("../index");

      expect(MODE_DESCRIPTIONS.analysis).toBeDefined();
      expect(MODE_DESCRIPTIONS.planning).toBeDefined();
      expect(MODE_DESCRIPTIONS.coding).toBeDefined();
      expect(MODE_DESCRIPTIONS.disabled).toBeDefined();

      // Verify they are non-empty strings
      expect(MODE_DESCRIPTIONS.analysis.length).toBeGreaterThan(0);
      expect(MODE_DESCRIPTIONS.planning.length).toBeGreaterThan(0);
      expect(MODE_DESCRIPTIONS.coding.length).toBeGreaterThan(0);
      expect(MODE_DESCRIPTIONS.disabled.length).toBeGreaterThan(0);
    });
  });
});
