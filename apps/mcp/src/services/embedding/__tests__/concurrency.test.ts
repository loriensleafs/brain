/**
 * Concurrency control tests for embedding service.
 * Tests p-limit behavior and concurrent note processing patterns.
 */

import pLimit from "p-limit";
import { describe, expect, test } from "vitest";

/**
 * Helper to track concurrent execution watermark
 */
interface ConcurrencyTracker {
	current: number;
	max: number;
}

/**
 * Sleep helper for simulating async work
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("p-limit concurrency control", () => {
	test("limits concurrent operations to specified value", async () => {
		const limit = pLimit(4);
		const tracker: ConcurrencyTracker = { current: 0, max: 0 };
		const items = Array.from({ length: 10 }, (_, i) => i);

		const processItem = async (item: number) => {
			tracker.current++;
			tracker.max = Math.max(tracker.max, tracker.current);
			await sleep(10);
			tracker.current--;
			return item * 2;
		};

		const results = await Promise.all(
			items.map((item) => limit(() => processItem(item))),
		);

		expect(results).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
		expect(tracker.max).toBeLessThanOrEqual(4);
		expect(tracker.max).toBeGreaterThan(1); // Should use parallelism
	});

	test("handles failures without blocking other operations", async () => {
		const limit = pLimit(4);
		const items = Array.from({ length: 10 }, (_, i) => i);

		const processItem = async (item: number) => {
			await sleep(5);
			if (item === 3 || item === 7) {
				throw new Error(`Failed on item ${item}`);
			}
			return item;
		};

		const results = await Promise.allSettled(
			items.map((item) => limit(() => processItem(item))),
		);

		const fulfilled = results.filter((r) => r.status === "fulfilled");
		const rejected = results.filter((r) => r.status === "rejected");

		expect(fulfilled).toHaveLength(8);
		expect(rejected).toHaveLength(2);
	});

	test("processes all items even with some failures", async () => {
		const limit = pLimit(4);
		const items = Array.from({ length: 20 }, (_, i) => i);
		let processedCount = 0;

		const processItem = async (item: number) => {
			await sleep(2);
			processedCount++;
			if (item % 5 === 0 && item !== 0) {
				throw new Error(`Failed on ${item}`);
			}
			return item;
		};

		await Promise.allSettled(
			items.map((item) => limit(() => processItem(item))),
		);

		expect(processedCount).toBe(20); // All items attempted
	});

	test("respects concurrency limit with varying task durations", async () => {
		const limit = pLimit(3);
		const tracker: ConcurrencyTracker = { current: 0, max: 0 };
		const items = Array.from({ length: 15 }, (_, i) => i);

		const processItem = async (item: number) => {
			tracker.current++;
			tracker.max = Math.max(tracker.max, tracker.current);
			// Varying durations: 5ms, 10ms, 15ms
			await sleep(5 + (item % 3) * 5);
			tracker.current--;
			return item;
		};

		await Promise.all(items.map((item) => limit(() => processItem(item))));

		expect(tracker.max).toBe(3);
	});
});

describe("concurrent note processing patterns", () => {
	test("simulates embed tool concurrent pattern", async () => {
		const CONCURRENCY_LIMIT = 4;
		const limit = pLimit(CONCURRENCY_LIMIT);
		const notes = Array.from({ length: 20 }, (_, i) => `note-${i}`);
		const errors: string[] = [];
		const tracker: ConcurrencyTracker = { current: 0, max: 0 };

		const processNote = async (notePath: string) => {
			tracker.current++;
			tracker.max = Math.max(tracker.max, tracker.current);

			try {
				await sleep(10);

				// Simulate 10% failure rate
				if (notePath.endsWith("-5") || notePath.endsWith("-15")) {
					throw new Error(`Failed to process ${notePath}`);
				}

				tracker.current--;
				return { success: true, chunks: 3 };
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				errors.push(`${notePath}: ${msg}`);
				tracker.current--;
				return { success: false, chunks: 0 };
			}
		};

		const results = await Promise.allSettled(
			notes.map((notePath) => limit(async () => processNote(notePath))),
		);

		// Aggregate results like embed tool does
		let processed = 0;
		let failed = 0;

		for (const result of results) {
			if (result.status === "fulfilled" && result.value.success) {
				processed++;
			} else {
				failed++;
			}
		}

		expect(processed).toBe(18);
		expect(failed).toBe(2);
		expect(errors).toHaveLength(2);
		expect(tracker.max).toBeLessThanOrEqual(CONCURRENCY_LIMIT);
	});

	test("handles empty note list", async () => {
		const limit = pLimit(4);
		const notes: string[] = [];

		const results = await Promise.allSettled(
			notes.map((note) => limit(async () => ({ note, success: true }))),
		);

		expect(results).toHaveLength(0);
	});

	test("handles single note", async () => {
		const limit = pLimit(4);
		const notes = ["single-note"];
		const tracker: ConcurrencyTracker = { current: 0, max: 0 };

		const processNote = async (note: string) => {
			tracker.current++;
			tracker.max = Math.max(tracker.max, tracker.current);
			await sleep(5);
			tracker.current--;
			return { note, success: true };
		};

		const results = await Promise.allSettled(
			notes.map((note) => limit(() => processNote(note))),
		);

		expect(results).toHaveLength(1);
		expect(results[0].status).toBe("fulfilled");
		expect(tracker.max).toBe(1);
	});

	test("measures performance improvement with concurrency", async () => {
		const TASK_DURATION = 20; // ms per task
		const TASK_COUNT = 12;
		const CONCURRENCY = 4;

		// Sequential baseline
		const sequentialStart = Date.now();
		for (let i = 0; i < TASK_COUNT; i++) {
			await sleep(TASK_DURATION);
		}
		const sequentialTime = Date.now() - sequentialStart;

		// Concurrent with p-limit
		const limit = pLimit(CONCURRENCY);
		const concurrentStart = Date.now();
		await Promise.all(
			Array.from({ length: TASK_COUNT }, () =>
				limit(async () => {
					await sleep(TASK_DURATION);
				}),
			),
		);
		const concurrentTime = Date.now() - concurrentStart;

		// Concurrent should be ~4x faster (with some tolerance for overhead)
		const expectedConcurrentTime = (TASK_COUNT / CONCURRENCY) * TASK_DURATION;
		expect(concurrentTime).toBeLessThan(sequentialTime);
		expect(concurrentTime).toBeLessThan(expectedConcurrentTime * 1.3); // 30% tolerance
	});
});

describe("error handling and resilience", () => {
	test("continues processing after errors", async () => {
		const limit = pLimit(4);
		const items = Array.from({ length: 10 }, (_, i) => i);
		const successfulItems: number[] = [];
		const failedItems: number[] = [];

		const processItem = async (item: number) => {
			await sleep(5);
			if (item % 3 === 0) {
				failedItems.push(item);
				throw new Error(`Item ${item} failed`);
			}
			successfulItems.push(item);
			return item;
		};

		await Promise.allSettled(
			items.map((item) => limit(() => processItem(item))),
		);

		expect(successfulItems).toHaveLength(6);
		expect(failedItems).toHaveLength(4);
		expect(successfulItems.concat(failedItems).sort((a, b) => a - b)).toEqual(
			items,
		);
	});

	test("collects error messages for failed operations", async () => {
		const limit = pLimit(4);
		const items = ["item1", "item2", "item3", "item4"];
		const errors: string[] = [];

		const processItem = async (item: string) => {
			await sleep(5);
			if (item === "item2" || item === "item4") {
				throw new Error(`Processing failed for ${item}`);
			}
			return { item, success: true };
		};

		const results = await Promise.allSettled(
			items.map((item) =>
				limit(async () => {
					try {
						return await processItem(item);
					} catch (error) {
						const msg = error instanceof Error ? error.message : String(error);
						errors.push(`${item}: ${msg}`);
						throw error;
					}
				}),
			),
		);

		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
		expect(errors).toHaveLength(2);
		expect(errors[0]).toContain("item2");
		expect(errors[1]).toContain("item4");
	});
});

describe("resource management", () => {
	test("prevents resource exhaustion with high item count", async () => {
		const limit = pLimit(4);
		const tracker: ConcurrencyTracker = { current: 0, max: 0 };
		const items = Array.from({ length: 100 }, (_, i) => i);

		const processItem = async (item: number) => {
			tracker.current++;
			tracker.max = Math.max(tracker.max, tracker.current);
			await sleep(1);
			tracker.current--;
			return item;
		};

		await Promise.all(items.map((item) => limit(() => processItem(item))));

		// Even with 100 items, max concurrent should be 4
		expect(tracker.max).toBe(4);
	});

	test("completes all work when limit exceeds item count", async () => {
		const limit = pLimit(10); // Limit higher than item count
		const tracker: ConcurrencyTracker = { current: 0, max: 0 };
		const items = Array.from({ length: 5 }, (_, i) => i);

		const processItem = async (item: number) => {
			tracker.current++;
			tracker.max = Math.max(tracker.max, tracker.current);
			await sleep(10);
			tracker.current--;
			return item;
		};

		const results = await Promise.all(
			items.map((item) => limit(() => processItem(item))),
		);

		expect(results).toEqual([0, 1, 2, 3, 4]);
		expect(tracker.max).toBe(5); // All ran concurrently
	});
});
