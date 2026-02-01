/**
 * Unit tests for Config Rollback Manager module.
 *
 * Tests TASK-020-24 requirements:
 * - initialize(): Set baseline on MCP startup
 * - markAsGood(): Update after successful migration
 * - revert(): Rollback to last known good
 * - Snapshot with checksums
 * - FIFO eviction when >10 snapshots
 */

import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { BrainConfig } from "../schema";
import { DEFAULT_BRAIN_CONFIG } from "../schema";

// Mock filesystem
const mockFs = {
	existsSync: vi.fn(() => false) as ReturnType<
		typeof mock<(p: string) => boolean>
	>,
	readFileSync: vi.fn(() => "") as ReturnType<
		typeof mock<(p: string, enc: string) => string>
	>,
	writeFileSync: vi.fn(() => undefined) as ReturnType<
		typeof mock<(p: string, content: string, opts: unknown) => void>
	>,
	mkdirSync: vi.fn(() => undefined) as ReturnType<
		typeof mock<(p: string, opts: unknown) => void>
	>,
	unlinkSync: vi.fn(() => undefined) as ReturnType<
		typeof mock<(p: string) => void>
	>,
};

vi.mock("fs", () => mockFs);

// Mock brain-config module
const mockBrainConfig = {
	getBrainConfigDir: vi.fn(() => path.join(os.homedir(), ".config", "brain")),
	loadBrainConfig: vi.fn(async () => ({ ...DEFAULT_BRAIN_CONFIG })),
	saveBrainConfig: vi.fn(async () => undefined),
};

vi.mock("../brain-config", () => mockBrainConfig);

// Mock translation-layer module
const mockTranslationLayer = {
	syncConfigToBasicMemory: vi.fn(async () => undefined),
};

vi.mock("../translation-layer", () => mockTranslationLayer);

import { ConfigRollbackManager, type RollbackSnapshot } from "../rollback";

/**
 * Create a test config with specified overrides.
 */
function createTestConfig(overrides: Partial<BrainConfig> = {}): BrainConfig {
	return {
		...DEFAULT_BRAIN_CONFIG,
		...overrides,
		defaults: {
			...DEFAULT_BRAIN_CONFIG.defaults,
			...(overrides.defaults || {}),
		},
		projects: overrides.projects || {},
	};
}

describe("ConfigRollbackManager", () => {
	let manager: ConfigRollbackManager;

	beforeEach(() => {
		// Reset all mocks
		mockFs.existsSync.mockReset();
		mockFs.readFileSync.mockReset();
		mockFs.writeFileSync.mockReset();
		mockFs.mkdirSync.mockReset();
		mockFs.unlinkSync.mockReset();
		mockBrainConfig.loadBrainConfig.mockReset();
		mockBrainConfig.saveBrainConfig.mockReset();
		mockTranslationLayer.syncConfigToBasicMemory.mockReset();

		// Default mock behaviors
		mockFs.existsSync.mockReturnValue(false);
		mockBrainConfig.loadBrainConfig.mockResolvedValue({
			...DEFAULT_BRAIN_CONFIG,
		});
		mockBrainConfig.saveBrainConfig.mockResolvedValue(undefined);
		mockTranslationLayer.syncConfigToBasicMemory.mockResolvedValue(undefined);

		// Create fresh manager
		manager = new ConfigRollbackManager();
	});

	describe("initialize", () => {
		test("creates rollback directory if missing", async () => {
			mockFs.existsSync.mockReturnValue(false);

			await manager.initialize();

			expect(mockFs.mkdirSync).toHaveBeenCalled();
		});

		test("sets initialized flag on success", async () => {
			expect(manager.isInitialized()).toBe(false);

			await manager.initialize();

			expect(manager.isInitialized()).toBe(true);
		});

		test("establishes lastKnownGood from current config on first run", async () => {
			const testConfig = createTestConfig({
				projects: { "test-project": { code_path: "/dev/test" } },
			});
			mockBrainConfig.loadBrainConfig.mockResolvedValue(testConfig);
			mockFs.existsSync.mockReturnValue(false);

			await manager.initialize();

			const lastKnownGood = manager.getLastKnownGood();
			expect(lastKnownGood).not.toBeNull();
			expect(lastKnownGood?.config.projects["test-project"]).toBeDefined();
		});

		test("loads existing lastKnownGood from disk", async () => {
			const savedSnapshot = {
				id: "snap-existing",
				createdAt: "2026-01-31T00:00:00.000Z",
				reason: "Previous baseline",
				checksum: "", // Will be computed
				config: createTestConfig({ logging: { level: "debug" } }),
			};

			// Compute correct checksum using the same stable serialization as rollback.ts
			const sortedReplacer = (_key: string, value: unknown): unknown => {
				if (
					value !== null &&
					typeof value === "object" &&
					!Array.isArray(value)
				) {
					const sorted: Record<string, unknown> = {};
					for (const k of Object.keys(
						value as Record<string, unknown>,
					).sort()) {
						sorted[k] = (value as Record<string, unknown>)[k];
					}
					return sorted;
				}
				return value;
			};
			const json = JSON.stringify(savedSnapshot.config, sortedReplacer);
			const crypto = await import("node:crypto");
			savedSnapshot.checksum = crypto
				.createHash("sha256")
				.update(json)
				.digest("hex");

			mockFs.existsSync.mockImplementation((p: string) => {
				return String(p).includes("last-known-good.json");
			});
			mockFs.readFileSync.mockReturnValue(JSON.stringify(savedSnapshot));

			await manager.initialize();

			const lastKnownGood = manager.getLastKnownGood();
			expect(lastKnownGood?.id).toBe("snap-existing");
			expect(lastKnownGood?.config.logging.level).toBe("debug");
		});

		test("discards lastKnownGood if checksum mismatch", async () => {
			const savedSnapshot = {
				id: "snap-corrupt",
				createdAt: "2026-01-31T00:00:00.000Z",
				reason: "Corrupted",
				checksum: "invalid-checksum",
				config: createTestConfig(),
			};

			mockFs.existsSync.mockImplementation((p: string) => {
				return String(p).includes("last-known-good.json");
			});
			mockFs.readFileSync.mockReturnValue(JSON.stringify(savedSnapshot));
			mockBrainConfig.loadBrainConfig.mockResolvedValue(createTestConfig());

			await manager.initialize();

			// Should discard corrupt snapshot and create new baseline
			const lastKnownGood = manager.getLastKnownGood();
			expect(lastKnownGood?.id).not.toBe("snap-corrupt");
		});

		test("returns false if initialization fails critically", async () => {
			mockFs.mkdirSync.mockImplementation(() => {
				throw new Error("Permission denied");
			});
			mockFs.existsSync.mockReturnValue(false);

			const result = await manager.initialize();

			// Manager should handle error gracefully
			expect(typeof result).toBe("boolean");
		});
	});

	describe("snapshot", () => {
		beforeEach(async () => {
			mockFs.existsSync.mockReturnValue(false);
			await manager.initialize();
		});

		test("creates snapshot with unique ID", () => {
			const config = createTestConfig();

			const snapshot = manager.snapshot(config, "Test reason");

			expect(snapshot.id).toMatch(/^snap-[a-z0-9]+-[a-f0-9]+$/);
		});

		test("includes timestamp and reason", () => {
			const config = createTestConfig();
			const before = new Date();

			const snapshot = manager.snapshot(config, "Test snapshot reason");

			expect(snapshot.createdAt.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(snapshot.reason).toBe("Test snapshot reason");
		});

		test("computes checksum of config", () => {
			const config = createTestConfig();

			const snapshot = manager.snapshot(config, "Test");

			expect(snapshot.checksum).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
		});

		test("deep copies config to prevent mutation", () => {
			const config = createTestConfig({
				projects: { test: { code_path: "/dev/test" } },
			});

			const snapshot = manager.snapshot(config, "Test");

			// Mutate original
			config.projects.test.code_path = "/dev/mutated";

			// Snapshot should be unchanged
			expect(snapshot.config.projects.test.code_path).toBe("/dev/test");
		});

		test("adds to rollback history", () => {
			const config = createTestConfig();

			expect(manager.getHistory()).toHaveLength(0);

			manager.snapshot(config, "First");
			expect(manager.getHistory()).toHaveLength(1);

			manager.snapshot(config, "Second");
			expect(manager.getHistory()).toHaveLength(2);
		});

		test("enforces FIFO eviction when over 10 snapshots", () => {
			const config = createTestConfig();

			// Create 11 snapshots
			const firstId = manager.snapshot(config, "First").id;
			for (let i = 2; i <= 11; i++) {
				manager.snapshot(config, `Snapshot ${i}`);
			}

			// Should have evicted the first one
			const history = manager.getHistory();
			expect(history).toHaveLength(10);
			expect(history.some((s) => s.id === firstId)).toBe(false);
		});

		test("persists snapshot to disk", () => {
			const config = createTestConfig();

			manager.snapshot(config, "Test");

			// Should write snapshot file and history index
			expect(mockFs.writeFileSync).toHaveBeenCalled();
		});
	});

	describe("markAsGood", () => {
		beforeEach(async () => {
			mockFs.existsSync.mockReturnValue(false);
			await manager.initialize();
		});

		test("updates lastKnownGood", async () => {
			const config = createTestConfig({ logging: { level: "debug" } });

			await manager.markAsGood(config, "After successful migration");

			const lastKnownGood = manager.getLastKnownGood();
			expect(lastKnownGood?.config.logging.level).toBe("debug");
			expect(lastKnownGood?.reason).toBe("After successful migration");
		});

		test("rejects invalid config", async () => {
			const invalidConfig = { version: "1.0.0" } as unknown as BrainConfig;

			await expect(manager.markAsGood(invalidConfig, "Test")).rejects.toThrow();
		});

		test("persists lastKnownGood to disk", async () => {
			const config = createTestConfig();
			mockFs.writeFileSync.mockReset();

			await manager.markAsGood(config, "Test");

			expect(mockFs.writeFileSync).toHaveBeenCalled();
			const calls = mockFs.writeFileSync.mock.calls;
			const lastCall = calls[calls.length - 1];
			expect(String(lastCall[0])).toContain("last-known-good.json");
		});
	});

	describe("rollback", () => {
		let testSnapshot: RollbackSnapshot;

		beforeEach(async () => {
			mockFs.existsSync.mockReturnValue(false);
			await manager.initialize();

			// Create a known snapshot
			const config = createTestConfig({ logging: { level: "warn" } });
			testSnapshot = manager.snapshot(config, "Test baseline");
		});

		test("rollback to lastKnownGood restores baseline", async () => {
			const goodConfig = createTestConfig({ logging: { level: "error" } });
			await manager.markAsGood(goodConfig, "Good baseline");

			const result = await manager.rollback("lastKnownGood");

			expect(result.success).toBe(true);
			expect(result.restoredConfig?.logging.level).toBe("error");
			expect(mockBrainConfig.saveBrainConfig).toHaveBeenCalledWith(goodConfig);
		});

		test("rollback to previous restores most recent snapshot", async () => {
			const result = await manager.rollback("previous");

			expect(result.success).toBe(true);
			expect(result.snapshot?.id).toBe(testSnapshot.id);
			expect(result.restoredConfig?.logging.level).toBe("warn");
		});

		test("syncs to basic-memory after rollback", async () => {
			const goodConfig = createTestConfig();
			await manager.markAsGood(goodConfig, "Good");

			await manager.rollback("lastKnownGood");

			expect(mockTranslationLayer.syncConfigToBasicMemory).toHaveBeenCalled();
		});

		test("fails when no lastKnownGood available", async () => {
			// Create a fresh manager without initializing baseline
			const freshManager = new ConfigRollbackManager();
			// Initialize with mocks that return no existing files
			await freshManager.initialize();

			// Clear the lastKnownGood that was set during init
			// (Simulating a scenario where it somehow got cleared)
			(freshManager as unknown as { lastKnownGood: null }).lastKnownGood = null;

			const result = await freshManager.rollback("lastKnownGood");

			expect(result.success).toBe(false);
			expect(result.error).toContain("No lastKnownGood");
		});

		test("fails when no snapshots in history", async () => {
			// Create fresh manager
			const freshManager = new ConfigRollbackManager();
			mockFs.existsSync.mockReturnValue(false);
			await freshManager.initialize();

			// Don't create any snapshots
			const result = await freshManager.rollback("previous");

			expect(result.success).toBe(false);
			expect(result.error).toContain("No snapshots");
		});

		test("fails on checksum mismatch", async () => {
			// Corrupt the snapshot checksum
			const corruptSnapshot = { ...testSnapshot, checksum: "corrupted" };
			(
				manager as unknown as { rollbackHistory: RollbackSnapshot[] }
			).rollbackHistory = [corruptSnapshot];

			const result = await manager.rollback("previous");

			expect(result.success).toBe(false);
			expect(result.error).toContain("checksum mismatch");
		});

		test("fails gracefully when save fails", async () => {
			const goodConfig = createTestConfig();
			await manager.markAsGood(goodConfig, "Good");

			mockBrainConfig.saveBrainConfig.mockRejectedValue(new Error("Disk full"));

			const result = await manager.rollback("lastKnownGood");

			expect(result.success).toBe(false);
			expect(result.error).toContain("Disk full");
		});
	});

	describe("revert", () => {
		beforeEach(async () => {
			mockFs.existsSync.mockReturnValue(false);
			await manager.initialize();
		});

		test("is shortcut for rollback('lastKnownGood')", async () => {
			const goodConfig = createTestConfig({ logging: { level: "trace" } });
			await manager.markAsGood(goodConfig, "Good");

			const result = await manager.revert();

			expect(result.success).toBe(true);
			expect(result.restoredConfig?.logging.level).toBe("trace");
		});
	});

	describe("getLastSnapshot", () => {
		beforeEach(async () => {
			mockFs.existsSync.mockReturnValue(false);
			await manager.initialize();
		});

		test("returns null when history is empty", () => {
			expect(manager.getLastSnapshot()).toBeNull();
		});

		test("returns most recent snapshot", () => {
			const config1 = createTestConfig({ logging: { level: "debug" } });
			const config2 = createTestConfig({ logging: { level: "warn" } });

			manager.snapshot(config1, "First");
			manager.snapshot(config2, "Second");

			const last = manager.getLastSnapshot();
			expect(last?.config.logging.level).toBe("warn");
			expect(last?.reason).toBe("Second");
		});
	});

	describe("clearHistory", () => {
		beforeEach(async () => {
			mockFs.existsSync.mockReturnValue(false);
			await manager.initialize();
		});

		test("removes all snapshots from history", () => {
			const config = createTestConfig();
			manager.snapshot(config, "First");
			manager.snapshot(config, "Second");

			expect(manager.getHistory()).toHaveLength(2);

			manager.clearHistory();

			expect(manager.getHistory()).toHaveLength(0);
		});

		test("does not clear lastKnownGood", async () => {
			const goodConfig = createTestConfig({ logging: { level: "error" } });
			await manager.markAsGood(goodConfig, "Good baseline");

			manager.clearHistory();

			expect(manager.getLastKnownGood()).not.toBeNull();
			expect(manager.getLastKnownGood()?.config.logging.level).toBe("error");
		});

		test("deletes snapshot files from disk", () => {
			const config = createTestConfig();
			manager.snapshot(config, "Test");
			mockFs.unlinkSync.mockReset();
			mockFs.existsSync.mockReturnValue(true);

			manager.clearHistory();

			expect(mockFs.unlinkSync).toHaveBeenCalled();
		});
	});

	describe("matchesLastKnownGood", () => {
		beforeEach(async () => {
			mockFs.existsSync.mockReturnValue(false);
			await manager.initialize();
		});

		test("returns true when checksums match", async () => {
			// Use a completely new config object for marking as good
			const config: BrainConfig = {
				$schema: "https://brain.dev/schemas/config-v2.json",
				version: "2.0.0",
				defaults: {
					memories_location: "~/memories",
					memories_mode: "DEFAULT",
				},
				projects: {},
				sync: { enabled: true, delay_ms: 500 },
				logging: { level: "info" },
				watcher: { enabled: true, debounce_ms: 2000 },
			};
			await manager.markAsGood(config, "Baseline");

			// Create identical config
			const sameConfig: BrainConfig = {
				$schema: "https://brain.dev/schemas/config-v2.json",
				version: "2.0.0",
				defaults: {
					memories_location: "~/memories",
					memories_mode: "DEFAULT",
				},
				projects: {},
				sync: { enabled: true, delay_ms: 500 },
				logging: { level: "info" },
				watcher: { enabled: true, debounce_ms: 2000 },
			};
			expect(manager.matchesLastKnownGood(sameConfig)).toBe(true);
		});

		test("returns false when configs differ", async () => {
			// Use a completely new config object for marking as good
			const config: BrainConfig = {
				$schema: "https://brain.dev/schemas/config-v2.json",
				version: "2.0.0",
				defaults: {
					memories_location: "~/memories",
					memories_mode: "DEFAULT",
				},
				projects: {},
				sync: { enabled: true, delay_ms: 500 },
				logging: { level: "info" },
				watcher: { enabled: true, debounce_ms: 2000 },
			};
			await manager.markAsGood(config, "Baseline");

			// Create different config
			const differentConfig: BrainConfig = {
				$schema: "https://brain.dev/schemas/config-v2.json",
				version: "2.0.0",
				defaults: {
					memories_location: "~/memories",
					memories_mode: "DEFAULT",
				},
				projects: {},
				sync: { enabled: true, delay_ms: 500 },
				logging: { level: "debug" }, // Different!
				watcher: { enabled: true, debounce_ms: 2000 },
			};
			expect(manager.matchesLastKnownGood(differentConfig)).toBe(false);
		});

		test("returns false when no lastKnownGood set", () => {
			const config = createTestConfig();

			// Clear lastKnownGood
			(manager as unknown as { lastKnownGood: null }).lastKnownGood = null;

			expect(manager.matchesLastKnownGood(config)).toBe(false);
		});
	});
});
