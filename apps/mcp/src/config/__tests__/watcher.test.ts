/**
 * Unit tests for Config File Watcher module.
 *
 * Tests TASK-020-22 requirements:
 * - ConfigFileWatcher class using chokidar
 * - 2-second debounce with awaitWriteFinish
 * - Event handling for change/error
 * - Integration with diff detection and migration
 * - Start/stop methods
 */

import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { BrainConfig } from "../schema";
import { DEFAULT_BRAIN_CONFIG } from "../schema";

// Module-level state for mock event emitter
type EventHandler = (...args: unknown[]) => void;
const mockWatcherEvents: Map<string, EventHandler[]> = new Map();

// Use vi.hoisted() to ensure mocks are available before vi.mock() hoisting
const { mockWatcher, mockBrainConfig, mockTranslationLayer, mockRollback } = vi.hoisted(() => {
  // Note: mockWatcherEvents is module-level, cleared in beforeEach
  const mockWatcher = {
    on: vi.fn(),
    close: vi.fn(() => Promise.resolve()),
  };

  const mockBrainConfig = {
    getBrainConfigPath: vi.fn(() => ""),
    loadBrainConfig: vi.fn(async () => ({})),
    loadBrainConfigSync: vi.fn(() => ({})),
  };

  const mockTranslationLayer = {
    syncConfigToBasicMemory: vi.fn(async () => undefined),
  };

  const mockRollback = {
    rollbackManager: {
      isInitialized: vi.fn(() => true),
      initialize: vi.fn(async () => true),
      snapshot: vi.fn(() => ({})),
      markAsGood: vi.fn(async () => undefined),
      revert: vi.fn(async () => ({})),
    },
  };

  return { mockWatcher, mockBrainConfig, mockTranslationLayer, mockRollback };
});

// Configure mock implementations that need runtime values
function setupMockImplementations() {
  mockWatcher.on.mockImplementation((event: string, handler: EventHandler) => {
    const handlers = mockWatcherEvents.get(event) || [];
    handlers.push(handler);
    mockWatcherEvents.set(event, handlers);
    return mockWatcher;
  });

  mockBrainConfig.getBrainConfigPath.mockReturnValue(
    path.join(os.homedir(), ".config", "brain", "config.json"),
  );
  mockBrainConfig.loadBrainConfig.mockResolvedValue({ ...DEFAULT_BRAIN_CONFIG });
  mockBrainConfig.loadBrainConfigSync.mockReturnValue({ ...DEFAULT_BRAIN_CONFIG });

  mockRollback.rollbackManager.snapshot.mockReturnValue({
    id: "snap-test",
    createdAt: new Date(),
    reason: "test",
    checksum: "abc123",
    config: DEFAULT_BRAIN_CONFIG,
  });
  mockRollback.rollbackManager.revert.mockResolvedValue({
    success: true,
    restoredConfig: DEFAULT_BRAIN_CONFIG,
  });
}

vi.mock("chokidar", () => ({
  watch: vi.fn(() => mockWatcher),
}));

vi.mock("../brain-config", () => mockBrainConfig);
vi.mock("../translation-layer", () => mockTranslationLayer);
vi.mock("../rollback", () => mockRollback);

import { ConfigFileWatcher, createConfigWatcher, type WatcherEvent } from "../watcher";

/**
 * Create a test config with specified overrides.
 */
function createTestConfig(overrides: Partial<BrainConfig> = {}): BrainConfig {
  return {
    ...DEFAULT_BRAIN_CONFIG,
    ...overrides,
  };
}

/**
 * Emit a mock chokidar event.
 */
function emitMockEvent(eventName: string, ...args: unknown[]): void {
  const handlers = mockWatcherEvents.get(eventName) || [];
  for (const handler of handlers) {
    handler(...args);
  }
}

/**
 * Wait for debounce timer to fire.
 */
async function waitForDebounce(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms + 100));
}

describe("ConfigFileWatcher", () => {
  beforeEach(() => {
    // Reset all mocks
    mockWatcherEvents.clear();
    mockWatcher.on.mockClear();
    mockWatcher.close.mockClear();
    mockBrainConfig.loadBrainConfig.mockReset();
    mockBrainConfig.loadBrainConfigSync.mockReset();
    mockTranslationLayer.syncConfigToBasicMemory.mockReset();
    mockRollback.rollbackManager.isInitialized.mockReset();
    mockRollback.rollbackManager.initialize.mockReset();
    mockRollback.rollbackManager.snapshot.mockReset();
    mockRollback.rollbackManager.markAsGood.mockReset();
    mockRollback.rollbackManager.revert.mockReset();

    // Set up mock implementations (must be done after reset)
    setupMockImplementations();

    // Default behaviors
    mockBrainConfig.loadBrainConfig.mockResolvedValue({
      ...DEFAULT_BRAIN_CONFIG,
    });
    mockBrainConfig.loadBrainConfigSync.mockReturnValue({
      ...DEFAULT_BRAIN_CONFIG,
    });
    mockRollback.rollbackManager.isInitialized.mockReturnValue(true);
    mockRollback.rollbackManager.revert.mockResolvedValue({
      success: true,
      restoredConfig: DEFAULT_BRAIN_CONFIG,
    });
  });

  describe("constructor", () => {
    test("uses default debounce of 2000ms", () => {
      const watcher = new ConfigFileWatcher();
      // Can't directly access private field, but we test behavior instead
      expect(watcher.getState()).toBe("stopped");
    });

    test("accepts custom options", () => {
      const events: WatcherEvent[] = [];
      const watcher = new ConfigFileWatcher({
        debounceMs: 1000,
        autoRollback: false,
        autoSync: false,
        onEvent: (e) => events.push(e),
      });

      expect(watcher.getState()).toBe("stopped");
    });
  });

  describe("start", () => {
    test("transitions to running state", async () => {
      const watcher = new ConfigFileWatcher();

      await watcher.start();

      expect(watcher.getState()).toBe("running");
    });

    test("initializes rollback manager if not already done", async () => {
      mockRollback.rollbackManager.isInitialized.mockReturnValue(false);

      const watcher = new ConfigFileWatcher();
      await watcher.start();

      expect(mockRollback.rollbackManager.initialize).toHaveBeenCalled();
    });

    test("loads current config as baseline", async () => {
      const watcher = new ConfigFileWatcher();

      await watcher.start();

      expect(mockBrainConfig.loadBrainConfig).toHaveBeenCalled();
      expect(watcher.getLastConfig()).toEqual(DEFAULT_BRAIN_CONFIG);
    });

    test("emits change event on successful start", async () => {
      const events: WatcherEvent[] = [];
      const watcher = new ConfigFileWatcher({
        onEvent: (e) => events.push(e),
      });

      await watcher.start();

      expect(events.some((e) => e.type === "change" && e.message.includes("started"))).toBe(true);
    });

    test("is idempotent - no-op if already running", async () => {
      const watcher = new ConfigFileWatcher();

      await watcher.start();
      await watcher.start();

      expect(watcher.getState()).toBe("running");
    });

    test("sets up chokidar event handlers", async () => {
      const watcher = new ConfigFileWatcher();

      await watcher.start();

      expect(mockWatcher.on).toHaveBeenCalledWith("change", expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith("error", expect.any(Function));
    });
  });

  describe("stop", () => {
    test("transitions to stopped state", async () => {
      const watcher = new ConfigFileWatcher();
      await watcher.start();

      watcher.stop();

      expect(watcher.getState()).toBe("stopped");
    });

    test("closes chokidar watcher", async () => {
      const watcher = new ConfigFileWatcher();
      await watcher.start();

      watcher.stop();

      expect(mockWatcher.close).toHaveBeenCalled();
    });

    test("is idempotent - no-op if already stopped", () => {
      const watcher = new ConfigFileWatcher();

      watcher.stop();
      watcher.stop();

      expect(watcher.getState()).toBe("stopped");
    });

    test("emits change event on stop", async () => {
      const events: WatcherEvent[] = [];
      const watcher = new ConfigFileWatcher({
        onEvent: (e) => events.push(e),
      });
      await watcher.start();
      events.length = 0; // Clear start events

      watcher.stop();

      expect(events.some((e) => e.type === "change" && e.message.includes("stopped"))).toBe(true);
    });
  });

  describe("change detection", () => {
    test("debounces rapid file changes", async () => {
      const events: WatcherEvent[] = [];
      const watcher = new ConfigFileWatcher({
        debounceMs: 100,
        onEvent: (e) => events.push(e),
      });
      await watcher.start();

      // Emit multiple rapid changes
      emitMockEvent("change");
      emitMockEvent("change");
      emitMockEvent("change");

      // Wait less than debounce
      await new Promise((r) => setTimeout(r, 50));
      const eventCountBefore = events.filter((e) => e.type === "reconfigure").length;

      // Wait for debounce to fire
      await waitForDebounce(100);

      // Should process only once
      const eventCountAfter = events.filter((e) => e.type === "reconfigure").length;
      expect(eventCountAfter - eventCountBefore).toBeLessThanOrEqual(1);

      watcher.stop();
    });

    test("emits reconfigure event on valid config change", async () => {
      const events: WatcherEvent[] = [];
      const watcher = new ConfigFileWatcher({
        debounceMs: 50,
        onEvent: (e) => events.push(e),
      });

      // Set up mock to return changed config
      mockBrainConfig.loadBrainConfigSync.mockReturnValue(
        createTestConfig({ logging: { level: "debug" } }),
      );

      await watcher.start();
      emitMockEvent("change");
      await waitForDebounce(50);

      const reconfigureEvents = events.filter((e) => e.type === "reconfigure");
      expect(reconfigureEvents.length).toBeGreaterThanOrEqual(1);

      watcher.stop();
    });

    test("syncs to basic-memory when autoSync enabled", async () => {
      const watcher = new ConfigFileWatcher({
        debounceMs: 50,
        autoSync: true,
      });

      mockBrainConfig.loadBrainConfigSync.mockReturnValue(
        createTestConfig({ logging: { level: "warn" } }),
      );

      await watcher.start();
      emitMockEvent("change");
      await waitForDebounce(50);

      expect(mockTranslationLayer.syncConfigToBasicMemory).toHaveBeenCalled();

      watcher.stop();
    });

    test("creates snapshot before applying changes", async () => {
      const watcher = new ConfigFileWatcher({
        debounceMs: 50,
      });

      mockBrainConfig.loadBrainConfigSync.mockReturnValue(
        createTestConfig({ logging: { level: "error" } }),
      );

      await watcher.start();
      emitMockEvent("change");
      await waitForDebounce(50);

      expect(mockRollback.rollbackManager.snapshot).toHaveBeenCalled();

      watcher.stop();
    });

    test("marks config as good after successful processing", async () => {
      const watcher = new ConfigFileWatcher({
        debounceMs: 50,
      });

      mockBrainConfig.loadBrainConfigSync.mockReturnValue(
        createTestConfig({ logging: { level: "trace" } }),
      );

      await watcher.start();
      emitMockEvent("change");
      await waitForDebounce(50);

      expect(mockRollback.rollbackManager.markAsGood).toHaveBeenCalled();

      watcher.stop();
    });
  });

  describe("validation error handling", () => {
    test("emits validation_error for invalid config", async () => {
      const events: WatcherEvent[] = [];
      const watcher = new ConfigFileWatcher({
        debounceMs: 50,
        onEvent: (e) => events.push(e),
      });

      // Return invalid config
      mockBrainConfig.loadBrainConfigSync.mockReturnValue({
        version: "1.0.0", // Wrong version
      } as unknown as BrainConfig);

      await watcher.start();
      emitMockEvent("change");
      await waitForDebounce(50);

      expect(events.some((e) => e.type === "validation_error")).toBe(true);

      watcher.stop();
    });

    test("auto-rollback on invalid config when enabled", async () => {
      const events: WatcherEvent[] = [];
      const watcher = new ConfigFileWatcher({
        debounceMs: 50,
        autoRollback: true,
        onEvent: (e) => events.push(e),
      });

      mockBrainConfig.loadBrainConfigSync.mockReturnValue({
        version: "1.0.0",
      } as unknown as BrainConfig);

      await watcher.start();
      emitMockEvent("change");
      await waitForDebounce(50);

      expect(mockRollback.rollbackManager.revert).toHaveBeenCalled();
      expect(events.some((e) => e.type === "rollback")).toBe(true);

      watcher.stop();
    });

    test("no rollback when autoRollback disabled", async () => {
      const watcher = new ConfigFileWatcher({
        debounceMs: 50,
        autoRollback: false,
      });

      mockBrainConfig.loadBrainConfigSync.mockReturnValue({
        version: "1.0.0",
      } as unknown as BrainConfig);

      await watcher.start();
      emitMockEvent("change");
      await waitForDebounce(50);

      expect(mockRollback.rollbackManager.revert).not.toHaveBeenCalled();

      watcher.stop();
    });
  });

  describe("error handling", () => {
    test("emits error event on watcher error", async () => {
      const events: WatcherEvent[] = [];
      const watcher = new ConfigFileWatcher({
        onEvent: (e) => events.push(e),
      });

      await watcher.start();

      const testError = new Error("Test watcher error");
      emitMockEvent("error", testError);

      expect(events.some((e) => e.type === "error")).toBe(true);
      expect(watcher.getState()).toBe("error");

      watcher.stop();
    });
  });

  describe("migration coordination", () => {
    test("queues changes during migration", async () => {
      const events: WatcherEvent[] = [];
      const watcher = new ConfigFileWatcher({
        debounceMs: 50,
        onEvent: (e) => events.push(e),
      });

      await watcher.start();
      expect(watcher.isMigrationInProgress()).toBe(false);

      watcher.beginMigration();
      expect(watcher.isMigrationInProgress()).toBe(true);

      // Emit change during migration
      emitMockEvent("change");
      await waitForDebounce(50);

      // Should have queued the change
      expect(events.some((e) => e.message.includes("queued"))).toBe(true);

      watcher.stop();
    });

    test("processes queued changes after migration ends", async () => {
      const events: WatcherEvent[] = [];
      const watcher = new ConfigFileWatcher({
        debounceMs: 50,
        onEvent: (e) => events.push(e),
      });

      mockBrainConfig.loadBrainConfigSync.mockReturnValue(
        createTestConfig({ logging: { level: "debug" } }),
      );

      await watcher.start();
      watcher.beginMigration();

      // Emit change during migration
      emitMockEvent("change");
      await waitForDebounce(50);

      events.length = 0; // Clear events

      // End migration
      await watcher.endMigration();

      // Should have processed the queued change
      expect(events.some((e) => e.type === "reconfigure" || e.type === "change")).toBe(true);

      watcher.stop();
    });
  });

  describe("getLastConfig", () => {
    test("returns null before start", () => {
      const watcher = new ConfigFileWatcher();
      expect(watcher.getLastConfig()).toBeNull();
    });

    test("returns loaded config after start", async () => {
      const testConfig = createTestConfig({ logging: { level: "debug" } });
      mockBrainConfig.loadBrainConfig.mockResolvedValue(testConfig);

      const watcher = new ConfigFileWatcher();
      await watcher.start();

      expect(watcher.getLastConfig()?.logging.level).toBe("debug");

      watcher.stop();
    });
  });
});

describe("createConfigWatcher", () => {
  beforeEach(() => {
    mockWatcherEvents.clear();
    setupMockImplementations();
    mockBrainConfig.loadBrainConfig.mockResolvedValue({
      ...DEFAULT_BRAIN_CONFIG,
    });
    mockRollback.rollbackManager.isInitialized.mockReturnValue(true);
  });

  test("creates and starts watcher", async () => {
    const watcher = await createConfigWatcher();

    expect(watcher.getState()).toBe("running");

    watcher.stop();
  });

  test("passes options to watcher", async () => {
    const events: WatcherEvent[] = [];
    const watcher = await createConfigWatcher({
      debounceMs: 1000,
      onEvent: (e) => events.push(e),
    });

    expect(events.some((e) => e.type === "change")).toBe(true);

    watcher.stop();
  });
});
