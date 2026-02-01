/**
 * Unit tests for retry logic with exponential backoff.
 * Tests processWithRetry and processEmbeddingQueue functions.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as connectionModule from "../../../db/connection";
import * as schemaModule from "../../../db/schema";
import * as vectorsModule from "../../../db/vectors";
import { logger } from "../../../utils/internal/logger";
import * as queueModule from "../queue";
import {
	BASE_DELAY_MS,
	MAX_RETRIES,
	processEmbeddingQueue,
	processWithRetry,
} from "../retry";

describe("retry", () => {
	const originalFetch = globalThis.fetch;
	let mockDb: { close: ReturnType<typeof vi.fn> };
	let storeChunkedEmbeddingsSpy: ReturnType<typeof vi.spyOn>;
	let createVectorConnectionSpy: ReturnType<typeof vi.spyOn>;
	let ensureEmbeddingTablesSpy: ReturnType<typeof vi.spyOn>;
	let loggerInfoSpy: ReturnType<typeof vi.spyOn>;
	let loggerWarnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		mockDb = { close: vi.fn(() => {}) };
		storeChunkedEmbeddingsSpy = vi
			.spyOn(vectorsModule, "storeChunkedEmbeddings")
			.mockReturnValue(1);
		createVectorConnectionSpy = vi
			.spyOn(connectionModule, "createVectorConnection")
			.mockReturnValue(mockDb as any);
		ensureEmbeddingTablesSpy = vi
			.spyOn(schemaModule, "ensureEmbeddingTables")
			.mockImplementation(() => {});
		loggerInfoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
		loggerWarnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		storeChunkedEmbeddingsSpy.mockRestore();
		createVectorConnectionSpy.mockRestore();
		ensureEmbeddingTablesSpy.mockRestore();
		loggerInfoSpy.mockRestore();
		loggerWarnSpy.mockRestore();
	});

	const mockFetchSuccess = (embedding: number[]) => {
		globalThis.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ embedding }),
			} as Response),
		) as unknown as typeof fetch;
	};

	const mockFetchFailure = () => {
		globalThis.fetch = vi.fn(() =>
			Promise.reject(new Error("API error")),
		) as unknown as typeof fetch;
	};

	describe("constants", () => {
		test("MAX_RETRIES is 3", () => {
			expect(MAX_RETRIES).toBe(3);
		});

		test("BASE_DELAY_MS is 1000", () => {
			expect(BASE_DELAY_MS).toBe(1000);
		});
	});

	describe("processWithRetry", () => {
		test("succeeds on first try and returns true", async () => {
			const mockEmbedding = Array.from({ length: 768 }, () => 0.5);
			mockFetchSuccess(mockEmbedding);

			const result = await processWithRetry("note-123", "Test content", 0);

			expect(result).toBe(true);
			expect(storeChunkedEmbeddingsSpy).toHaveBeenCalled();
		});

		test("returns true for empty content (null embedding)", async () => {
			// generateEmbedding returns null for empty content
			const result = await processWithRetry("note-123", "", 0);

			expect(result).toBe(true);
			expect(storeChunkedEmbeddingsSpy).not.toHaveBeenCalled();
		});

		test("returns false after max retries exceeded", async () => {
			mockFetchFailure();

			const result = await processWithRetry(
				"note-123",
				"Test content",
				MAX_RETRIES,
			);

			expect(result).toBe(false);
			expect(loggerWarnSpy).toHaveBeenCalledWith(
				`Max retries (${MAX_RETRIES}) exceeded for note note-123`,
			);
			expect(storeChunkedEmbeddingsSpy).not.toHaveBeenCalled();
		});

		test("returns false on API error and logs retry attempt", async () => {
			mockFetchFailure();

			const startTime = Date.now();
			const result = await processWithRetry("note-123", "Test content", 0);
			const elapsed = Date.now() - startTime;

			expect(result).toBe(false);
			expect(loggerWarnSpy).toHaveBeenCalledWith(
				`Retry 1/${MAX_RETRIES} for note note-123. Next in ${BASE_DELAY_MS}ms`,
			);
			// Verify delay was applied (at least 900ms to account for timing variance)
			expect(elapsed).toBeGreaterThanOrEqual(900);
		});

		test("closes database connection after successful store", async () => {
			const mockEmbedding = Array.from({ length: 768 }, () => 0.5);
			mockFetchSuccess(mockEmbedding);

			await processWithRetry("note-123", "Test content", 0);

			expect(mockDb.close).toHaveBeenCalled();
		});
	});

	describe("exponential backoff", () => {
		test("applies 1s delay on first retry (attempt 0)", async () => {
			mockFetchFailure();

			const startTime = Date.now();
			await processWithRetry("note-123", "Test content", 0);
			const elapsed = Date.now() - startTime;

			// 1s delay with 100ms tolerance
			expect(elapsed).toBeGreaterThanOrEqual(900);
			expect(elapsed).toBeLessThan(1200);
		});

		test("applies 2s delay on second retry (attempt 1)", async () => {
			mockFetchFailure();

			const startTime = Date.now();
			await processWithRetry("note-123", "Test content", 1);
			const elapsed = Date.now() - startTime;

			// 2s delay with 100ms tolerance
			expect(elapsed).toBeGreaterThanOrEqual(1900);
			expect(elapsed).toBeLessThan(2200);
		});

		test("applies 4s delay on third retry (attempt 2)", async () => {
			mockFetchFailure();

			const startTime = Date.now();
			await processWithRetry("note-123", "Test content", 2);
			const elapsed = Date.now() - startTime;

			// 4s delay with 100ms tolerance
			expect(elapsed).toBeGreaterThanOrEqual(3900);
			expect(elapsed).toBeLessThan(4200);
		});
	});

	describe("processEmbeddingQueue", () => {
		let dequeueSpy: ReturnType<typeof vi.spyOn>;
		let markProcessedSpy: ReturnType<typeof vi.spyOn>;
		let incrementAttemptsSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			dequeueSpy = vi.spyOn(queueModule, "dequeueEmbedding");
			markProcessedSpy = vi
				.spyOn(queueModule, "markEmbeddingProcessed")
				.mockImplementation(() => {});
			incrementAttemptsSpy = vi
				.spyOn(queueModule, "incrementAttempts")
				.mockImplementation(() => {});
		});

		afterEach(() => {
			dequeueSpy.mockRestore();
			markProcessedSpy.mockRestore();
			incrementAttemptsSpy.mockRestore();
		});

		test("returns zero counts for empty queue", async () => {
			dequeueSpy.mockReturnValue(null);

			const result = await processEmbeddingQueue(async () => "content");

			expect(result).toEqual({ processed: 0, failed: 0 });
		});

		test("processes all items in queue", async () => {
			const mockEmbedding = Array.from({ length: 768 }, () => 0.5);
			mockFetchSuccess(mockEmbedding);

			// Return two items then null
			let callCount = 0;
			dequeueSpy.mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					return {
						id: 1,
						noteId: "note-1",
						createdAt: "",
						attempts: 0,
						lastError: null,
					};
				}
				if (callCount === 2) {
					return {
						id: 2,
						noteId: "note-2",
						createdAt: "",
						attempts: 0,
						lastError: null,
					};
				}
				return null;
			});

			const result = await processEmbeddingQueue(async () => "content");

			expect(result).toEqual({ processed: 2, failed: 0 });
			expect(markProcessedSpy).toHaveBeenCalledTimes(2);
		});

		test("marks item as failed when content cannot be fetched", async () => {
			dequeueSpy.mockReturnValueOnce({
				id: 1,
				noteId: "note-1",
				createdAt: "",
				attempts: 0,
				lastError: null,
			});
			dequeueSpy.mockReturnValueOnce(null);

			const result = await processEmbeddingQueue(async () => null);

			expect(result).toEqual({ processed: 0, failed: 1 });
			expect(loggerWarnSpy).toHaveBeenCalledWith(
				"Could not fetch content for note note-1",
			);
			expect(markProcessedSpy).toHaveBeenCalledWith(1);
		});

		test("removes item from queue after max retries", async () => {
			dequeueSpy.mockReturnValueOnce({
				id: 1,
				noteId: "note-1",
				createdAt: "",
				attempts: MAX_RETRIES,
				lastError: "previous error",
			});
			dequeueSpy.mockReturnValueOnce(null);

			const result = await processEmbeddingQueue(async () => "content");

			expect(result).toEqual({ processed: 0, failed: 1 });
			expect(loggerWarnSpy).toHaveBeenCalledWith(
				`Removing note note-1 from queue after ${MAX_RETRIES} failures`,
			);
			expect(markProcessedSpy).toHaveBeenCalledWith(1);
		});

		test("increments attempts on retry failure", async () => {
			mockFetchFailure();

			dequeueSpy.mockReturnValueOnce({
				id: 1,
				noteId: "note-1",
				createdAt: "",
				attempts: 0,
				lastError: null,
			});
			dequeueSpy.mockReturnValueOnce(null);

			await processEmbeddingQueue(async () => "content");

			expect(incrementAttemptsSpy).toHaveBeenCalledWith(1, "Retry failed");
			expect(markProcessedSpy).not.toHaveBeenCalled();
		});

		test("processes mixed success and failure items", async () => {
			const mockEmbedding = Array.from({ length: 768 }, () => 0.5);

			// First call succeeds, second fails with max retries
			let callCount = 0;
			dequeueSpy.mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					mockFetchSuccess(mockEmbedding);
					return {
						id: 1,
						noteId: "note-1",
						createdAt: "",
						attempts: 0,
						lastError: null,
					};
				}
				if (callCount === 2) {
					return {
						id: 2,
						noteId: "note-2",
						createdAt: "",
						attempts: MAX_RETRIES,
						lastError: null,
					};
				}
				return null;
			});

			const result = await processEmbeddingQueue(async () => "content");

			expect(result).toEqual({ processed: 1, failed: 1 });
		});
	});
});
