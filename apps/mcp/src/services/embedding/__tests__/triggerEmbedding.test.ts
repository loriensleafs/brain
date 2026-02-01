/**
 * Unit tests for triggerEmbedding function.
 * Tests fire-and-forget behavior, success storage, and error handling.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as connectionModule from "../../../db/connection";
import * as schemaModule from "../../../db/schema";
import * as vectorsModule from "../../../db/vectors";
import { logger } from "../../../utils/internal/logger";
import { triggerEmbedding } from "../triggerEmbedding";

describe("triggerEmbedding", () => {
	const originalFetch = globalThis.fetch;
	let mockDb: { close: ReturnType<typeof vi.fn> };
	let storeChunkedEmbeddingsSpy: ReturnType<typeof vi.spyOn>;
	let createVectorConnectionSpy: ReturnType<typeof vi.spyOn>;
	let ensureEmbeddingTablesSpy: ReturnType<typeof vi.spyOn>;
	let loggerDebugSpy: ReturnType<typeof vi.spyOn>;
	let loggerWarnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		// Create mock database
		mockDb = { close: vi.fn(() => {}) };

		// Spy on storeChunkedEmbeddings
		storeChunkedEmbeddingsSpy = vi
			.spyOn(vectorsModule, "storeChunkedEmbeddings")
			.mockReturnValue(1);

		// Spy on createVectorConnection
		createVectorConnectionSpy = vi
			.spyOn(connectionModule, "createVectorConnection")
			.mockReturnValue(mockDb as any);

		// Spy on ensureEmbeddingTables
		ensureEmbeddingTablesSpy = vi
			.spyOn(schemaModule, "ensureEmbeddingTables")
			.mockImplementation(() => {});

		// Spy on logger methods
		loggerDebugSpy = vi.spyOn(logger, "debug").mockImplementation(() => {});
		loggerWarnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		storeChunkedEmbeddingsSpy.mockRestore();
		createVectorConnectionSpy.mockRestore();
		ensureEmbeddingTablesSpy.mockRestore();
		loggerDebugSpy.mockRestore();
		loggerWarnSpy.mockRestore();
	});

	// Helper to create mock fetch response
	const mockFetchSuccess = (embedding: number[]) => {
		globalThis.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ embedding }),
			} as Response),
		) as unknown as typeof fetch;
	};

	// Helper to wait for async operations
	const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 50));

	describe("successful embedding", () => {
		test("calls generateEmbedding with content", async () => {
			const mockEmbedding = Array.from({ length: 768 }, () => 0.5);
			mockFetchSuccess(mockEmbedding);

			triggerEmbedding("note-123", "Test content");
			await waitForAsync();

			// Verify fetch was called (generateEmbedding uses fetch internally)
			expect(globalThis.fetch).toHaveBeenCalled();
		});

		test("calls storeChunkedEmbeddings on success", async () => {
			const mockEmbedding = Array.from({ length: 768 }, () => 0.5);
			mockFetchSuccess(mockEmbedding);

			triggerEmbedding("note-123", "Test content");
			await waitForAsync();

			expect(storeChunkedEmbeddingsSpy).toHaveBeenCalled();
		});

		test("logs debug message on success", async () => {
			const mockEmbedding = Array.from({ length: 768 }, () => 0.5);
			mockFetchSuccess(mockEmbedding);

			triggerEmbedding("note-123", "Test content");
			await waitForAsync();

			// The log message now includes chunk count
			expect(loggerDebugSpy).toHaveBeenCalled();
		});

		test("closes database connection after storing", async () => {
			const mockEmbedding = Array.from({ length: 768 }, () => 0.5);
			mockFetchSuccess(mockEmbedding);

			triggerEmbedding("note-123", "Test content");
			await waitForAsync();

			expect(mockDb.close).toHaveBeenCalled();
		});
	});

	describe("fire-and-forget behavior", () => {
		test("does not throw on failure", () => {
			globalThis.fetch = vi.fn(() =>
				Promise.reject(new Error("Network error")),
			) as unknown as typeof fetch;

			// Should not throw - fire and forget
			expect(() => triggerEmbedding("note-123", "Test content")).not.toThrow();
		});

		test("logs warning on failure", async () => {
			globalThis.fetch = vi.fn(() =>
				Promise.reject(new Error("Connection refused")),
			) as unknown as typeof fetch;

			triggerEmbedding("note-123", "Test content");
			await waitForAsync();

			expect(loggerWarnSpy).toHaveBeenCalledWith(
				"Embedding failed for note note-123: Connection refused",
			);
		});

		test("does not call storeChunkedEmbeddings when generateEmbedding fails", async () => {
			globalThis.fetch = vi.fn(() =>
				Promise.reject(new Error("API error")),
			) as unknown as typeof fetch;

			triggerEmbedding("note-123", "Test content");
			await waitForAsync();

			expect(storeChunkedEmbeddingsSpy).not.toHaveBeenCalled();
		});
	});

	describe("empty content handling", () => {
		test("does not store embedding for empty content", async () => {
			// generateEmbedding returns null for empty content
			triggerEmbedding("note-123", "");
			await waitForAsync();

			expect(storeChunkedEmbeddingsSpy).not.toHaveBeenCalled();
		});

		test("does not store embedding for whitespace-only content", async () => {
			triggerEmbedding("note-123", "   \n\t  ");
			await waitForAsync();

			expect(storeChunkedEmbeddingsSpy).not.toHaveBeenCalled();
		});
	});
});
