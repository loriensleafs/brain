/**
 * Unit tests for Session State Optimistic Locking
 *
 * Tests:
 * - Version increment on updates
 * - Conflict detection (expected vs actual version)
 * - Retry logic with exponential backoff
 * - VersionConflictError after max retries
 * - Concurrent update simulation
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  updateSessionWithLocking,
  updateSession,
  VersionConflictError,
  InMemorySessionStorage,
  SimulatedConcurrentStorage,
  calculateBackoff,
  incrementVersion,
  applyPartialUpdates,
  BASE_BACKOFF_MS,
  MAX_BACKOFF_MS,
  DEFAULT_MAX_RETRIES,
} from "../locking";
import { createDefaultSessionState } from "../types";

describe("Optimistic Locking", () => {
  let storage: InMemorySessionStorage;

  beforeEach(() => {
    storage = new InMemorySessionStorage();
  });

  describe("calculateBackoff", () => {
    test("returns base delay for attempt 0", () => {
      const delay = calculateBackoff(0);
      // Should be BASE_BACKOFF_MS + jitter (0-20%)
      expect(delay).toBeGreaterThanOrEqual(BASE_BACKOFF_MS);
      expect(delay).toBeLessThanOrEqual(BASE_BACKOFF_MS * 1.2);
    });

    test("doubles delay for each attempt", () => {
      // Run multiple times to account for jitter
      const samples = Array.from({ length: 10 }, () => ({
        a0: calculateBackoff(0),
        a1: calculateBackoff(1),
        a2: calculateBackoff(2),
      }));

      for (const sample of samples) {
        // attempt 1 should be roughly 2x attempt 0 (with jitter)
        expect(sample.a1).toBeGreaterThan(sample.a0);
        // attempt 2 should be roughly 2x attempt 1 (with jitter)
        expect(sample.a2).toBeGreaterThanOrEqual(sample.a1);
      }
    });

    test("caps delay at MAX_BACKOFF_MS", () => {
      // Large attempt number should still be capped
      const delay = calculateBackoff(10);
      expect(delay).toBeLessThanOrEqual(MAX_BACKOFF_MS * 1.2); // Allow for jitter
    });

    test("adds jitter to prevent thundering herd", () => {
      const delays = Array.from({ length: 20 }, () => calculateBackoff(0));
      const uniqueDelays = new Set(delays);
      // With jitter, we should see some variation
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe("incrementVersion", () => {
    test("increments version by 1", () => {
      const state = createDefaultSessionState();
      expect(state.version).toBe(1);

      const updated = incrementVersion(state);
      expect(updated.version).toBe(2);
    });

    test("updates updatedAt timestamp", async () => {
      const state = createDefaultSessionState();
      const originalUpdatedAt = state.updatedAt;

      // Small delay to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 5));
      const updated = incrementVersion(state);

      expect(updated.updatedAt).not.toBe(originalUpdatedAt);
    });

    test("returns new object (immutable)", () => {
      const state = createDefaultSessionState();
      const updated = incrementVersion(state);

      expect(updated).not.toBe(state);
      expect(state.version).toBe(1); // Original unchanged
    });
  });

  describe("applyPartialUpdates", () => {
    test("applies mode change with history", () => {
      const state = createDefaultSessionState();
      const updated = applyPartialUpdates(state, { currentMode: "coding" });

      expect(updated.currentMode).toBe("coding");
      expect(updated.modeHistory).toHaveLength(2);
      expect(updated.modeHistory[1].mode).toBe("coding");
    });

    test("does not add history for same mode", () => {
      const state = createDefaultSessionState();
      // Default mode is analysis
      const updated = applyPartialUpdates(state, { currentMode: "analysis" });

      expect(updated.currentMode).toBe("analysis");
      expect(updated.modeHistory).toHaveLength(1); // No new entry
    });

    test("applies task update", () => {
      const state = createDefaultSessionState();
      const updated = applyPartialUpdates(state, { activeTask: "TASK-001" });

      expect(updated.activeTask).toBe("TASK-001");
    });

    test("applies feature update", () => {
      const state = createDefaultSessionState();
      const updated = applyPartialUpdates(state, {
        activeFeature: "feature-x",
      });

      expect(updated.activeFeature).toBe("feature-x");
    });

    test("applies multiple updates", () => {
      const state = createDefaultSessionState();
      const updated = applyPartialUpdates(state, {
        currentMode: "coding",
        activeTask: "TASK-001",
        activeFeature: "feature-x",
      });

      expect(updated.currentMode).toBe("coding");
      expect(updated.activeTask).toBe("TASK-001");
      expect(updated.activeFeature).toBe("feature-x");
    });

    test("updates updatedAt timestamp", async () => {
      const state = createDefaultSessionState();
      const original = state.updatedAt;

      // Small delay to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 5));
      const updated = applyPartialUpdates(state, { activeTask: "test" });

      expect(updated.updatedAt).not.toBe(original);
    });
  });

  describe("InMemorySessionStorage", () => {
    test("read returns null for missing session", async () => {
      const result = await storage.read();
      expect(result).toBeNull();
    });

    test("write and read round-trips correctly", async () => {
      const state = createDefaultSessionState();
      await storage.write(state);

      const retrieved = await storage.read();
      expect(retrieved).toEqual(state);
    });

    test("read returns deep copy", async () => {
      const state = createDefaultSessionState();
      storage.initialize(state);

      const copy1 = await storage.read();
      const copy2 = await storage.read();

      expect(copy1).not.toBe(copy2);
      expect(copy1).toEqual(copy2);
    });

    test("write stores deep copy", async () => {
      const state = createDefaultSessionState();
      await storage.write(state);

      // Modify original
      state.currentMode = "coding";

      // Retrieved should have original value
      const retrieved = await storage.read();
      expect(retrieved?.currentMode).toBe("analysis");
    });

    test("clear removes session", async () => {
      storage.initialize(createDefaultSessionState());

      storage.clear();

      expect(await storage.read()).toBeNull();
    });
  });

  describe("updateSessionWithLocking", () => {
    test("increments version on successful update", async () => {
      const state = createDefaultSessionState();
      storage.initialize(state);

      await updateSessionWithLocking(
        (current) => ({ ...current, activeTask: "TASK-001" }),
        { storage }
      );

      const updated = await storage.read();
      expect(updated?.version).toBe(2);
      expect(updated?.activeTask).toBe("TASK-001");
    });

    test("throws for non-existent session", async () => {
      await expect(
        updateSessionWithLocking(
          (current) => current,
          { storage }
        )
      ).rejects.toThrow("Session not found");
    });

    test("preserves state fields not in update", async () => {
      const state = createDefaultSessionState();
      state.activeFeature = "existing-feature";
      storage.initialize(state);

      await updateSessionWithLocking(
        (current) => ({ ...current, activeTask: "TASK-001" }),
        { storage }
      );

      const updated = await storage.read();
      expect(updated?.activeFeature).toBe("existing-feature");
    });
  });

  describe("updateSession (partial updates)", () => {
    test("applies partial update with version increment", async () => {
      const state = createDefaultSessionState();
      storage.initialize(state);

      await updateSession(
        { currentMode: "coding" },
        { storage }
      );

      const updated = await storage.read();
      expect(updated?.version).toBe(2);
      expect(updated?.currentMode).toBe("coding");
    });

    test("tracks mode change in history", async () => {
      const state = createDefaultSessionState();
      storage.initialize(state);

      await updateSession(
        { currentMode: "planning" },
        { storage }
      );

      const updated = await storage.read();
      expect(updated?.modeHistory).toHaveLength(2);
      expect(updated?.modeHistory[1].mode).toBe("planning");
    });
  });

  describe("Version Conflict Detection", () => {
    test("detects version mismatch", async () => {
      // Use simulated storage that causes conflict on first write
      const baseStorage = new InMemorySessionStorage();
      baseStorage.initialize(createDefaultSessionState());

      // Conflict on write #1 (simulated concurrent writer modifies after our write)
      const conflictStorage = new SimulatedConcurrentStorage(baseStorage, [1]);

      await expect(
        updateSessionWithLocking(
          (current) => ({ ...current, activeTask: "test" }),
          { storage: conflictStorage, maxRetries: 0 } // No retries
        )
      ).rejects.toThrow(VersionConflictError);
    });

    test("retries on conflict up to maxRetries", async () => {
      const baseStorage = new InMemorySessionStorage();
      baseStorage.initialize(createDefaultSessionState());

      // Cause conflict on first 2 writes, succeed on 3rd
      const conflictStorage = new SimulatedConcurrentStorage(baseStorage, [
        1, 2,
      ]);

      // Should succeed after retries
      await updateSessionWithLocking(
        (current) => ({ ...current, activeTask: "test" }),
        { storage: conflictStorage, maxRetries: 3 }
      );

      const updated = await baseStorage.read();
      expect(updated?.activeTask).toBe("test");
    });

    test("throws VersionConflictError after max retries", async () => {
      const baseStorage = new InMemorySessionStorage();
      baseStorage.initialize(createDefaultSessionState());

      // Cause conflict on every write
      const conflictStorage = new SimulatedConcurrentStorage(baseStorage, [
        1, 2, 3, 4, 5, 6,
      ]);

      try {
        await updateSessionWithLocking(
          (current) => ({ ...current, activeTask: "test" }),
          { storage: conflictStorage, maxRetries: 2 }
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(VersionConflictError);
        const conflictError = error as VersionConflictError;
        expect(conflictError.retryCount).toBe(2);
      }
    });

    test("VersionConflictError contains diagnostic info", async () => {
      const baseStorage = new InMemorySessionStorage();
      baseStorage.initialize(createDefaultSessionState());

      // Always conflict
      const conflictStorage = new SimulatedConcurrentStorage(baseStorage, [
        1, 2, 3, 4,
      ]);

      try {
        await updateSessionWithLocking(
          (current) => ({ ...current }),
          { storage: conflictStorage, maxRetries: 1 }
        );
      } catch (error) {
        expect(error).toBeInstanceOf(VersionConflictError);
        const conflictError = error as VersionConflictError;

        expect(conflictError.expectedVersion).toBeGreaterThan(0);
        expect(conflictError.actualVersion).toBeGreaterThan(0);
        expect(conflictError.retryCount).toBe(1);
        expect(conflictError.message).toContain("Failed after 1 retries");
      }
    });
  });

  describe("Concurrent Update Simulation", () => {
    test("SimulatedConcurrentStorage increments version after specified writes", async () => {
      const baseStorage = new InMemorySessionStorage();
      const state = createDefaultSessionState();
      baseStorage.initialize(state);

      // Conflict on write #1
      const simStorage = new SimulatedConcurrentStorage(baseStorage, [1]);

      // Write 1: should trigger simulated concurrent modification
      const newState = { ...state, version: 2, activeTask: "test" };
      await simStorage.write(newState);

      // Verify base storage has incremented version from simulated concurrent write
      const fromBase = await baseStorage.read();
      expect(fromBase?.version).toBe(3); // Our 2 + simulated concurrent increment
    });

    test("multiple concurrent writers scenario", async () => {
      const baseStorage = new InMemorySessionStorage();
      baseStorage.initialize(createDefaultSessionState());

      // Simulate concurrent writer that conflicts on first write only
      const conflictStorage = new SimulatedConcurrentStorage(baseStorage, [1]);

      await updateSessionWithLocking(
        (current) => ({
          ...current,
          activeTask: "final-task",
          activeFeature: "final-feature",
        }),
        { storage: conflictStorage, maxRetries: 3 }
      );

      const result = await baseStorage.read();
      expect(result?.activeTask).toBe("final-task");
      expect(result?.activeFeature).toBe("final-feature");
      // Version should be incremented multiple times due to conflict and retry
      expect(result?.version).toBeGreaterThan(1);
    });

    test("conflict recovery preserves data integrity", async () => {
      const baseStorage = new InMemorySessionStorage();
      const initial = createDefaultSessionState();
      initial.activeFeature = "preserved-feature";
      baseStorage.initialize(initial);

      // Conflict on first two writes, succeed on third
      const conflictStorage = new SimulatedConcurrentStorage(baseStorage, [
        1, 2,
      ]);

      await updateSessionWithLocking(
        (current) => ({
          ...current,
          activeTask: "new-task",
        }),
        { storage: conflictStorage, maxRetries: 3 }
      );

      const result = await baseStorage.read();
      expect(result?.activeTask).toBe("new-task");
      expect(result?.activeFeature).toBe("preserved-feature");
    });
  });

  describe("Default Configuration", () => {
    test("DEFAULT_MAX_RETRIES is 3", () => {
      expect(DEFAULT_MAX_RETRIES).toBe(3);
    });

    test("uses default maxRetries when not specified", async () => {
      const baseStorage = new InMemorySessionStorage();
      baseStorage.initialize(createDefaultSessionState());

      // Conflict on every write (will exhaust default 3 retries)
      const conflictStorage = new SimulatedConcurrentStorage(baseStorage, [
        1, 2, 3, 4, 5,
      ]);

      try {
        await updateSessionWithLocking(
          (current) => current,
          { storage: conflictStorage } // No maxRetries specified
        );
      } catch (error) {
        expect(error).toBeInstanceOf(VersionConflictError);
        const conflictError = error as VersionConflictError;
        expect(conflictError.retryCount).toBe(DEFAULT_MAX_RETRIES);
      }
    });
  });

  describe("Edge Cases", () => {
    test("handles update function that throws", async () => {
      const state = createDefaultSessionState();
      storage.initialize(state);

      await expect(
        updateSessionWithLocking(
          () => {
            throw new Error("Update function error");
          },
          { storage }
        )
      ).rejects.toThrow("Update function error");

      // Original state should be unchanged
      const unchanged = await storage.read();
      expect(unchanged?.version).toBe(1);
    });

    test("handles rapid sequential updates", async () => {
      const state = createDefaultSessionState();
      storage.initialize(state);

      // Perform multiple sequential updates
      for (let i = 0; i < 5; i++) {
        await updateSession(
          { activeTask: `task-${i}` },
          { storage }
        );
      }

      const final = await storage.read();
      expect(final?.version).toBe(6); // Initial 1 + 5 updates
      expect(final?.activeTask).toBe("task-4");
    });

    test("preserves orchestratorWorkflow through updates", async () => {
      const state = createDefaultSessionState();
      state.orchestratorWorkflow = {
        activeAgent: "analyst",
        workflowPhase: "planning",
        agentHistory: [],
        decisions: [],
        verdicts: [],
        pendingHandoffs: [],
        compactionHistory: [],
        startedAt: new Date().toISOString(),
        lastAgentChange: new Date().toISOString(),
      };
      storage.initialize(state);

      await updateSession(
        { currentMode: "coding" },
        { storage }
      );

      const updated = await storage.read();
      expect(updated?.orchestratorWorkflow).not.toBeNull();
      expect(updated?.orchestratorWorkflow?.activeAgent).toBe("analyst");
    });
  });
});
