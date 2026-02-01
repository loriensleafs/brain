/**
 * Unit tests for checkOllamaHealth.
 * Tests health check logic with mocked fetch.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "../../../utils/internal/logger";
import { checkOllamaHealth } from "../checkHealth";

// Helper to create a typed mock for fetch
const createFetchMock = (impl: () => unknown) => {
  const mockFn = vi.fn(impl);
  return mockFn as unknown as typeof fetch;
};

describe("checkOllamaHealth", () => {
  const originalFetch = globalThis.fetch;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(logger, "warn");
    infoSpy = vi.spyOn(logger, "info");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  test("returns false when Ollama is unreachable", async () => {
    globalThis.fetch = createFetchMock(() => {
      throw new Error("Connection refused");
    });

    const result = await checkOllamaHealth();

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      "Ollama not available. Semantic search disabled.",
    );
    expect(warnSpy).toHaveBeenCalledWith("Start Ollama with: ollama serve");
  });

  test("returns false when Ollama returns non-OK response", async () => {
    globalThis.fetch = createFetchMock(() =>
      Promise.resolve({ ok: false, status: 500 } as Response),
    );

    const result = await checkOllamaHealth();

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      "Ollama not available. Semantic search disabled.",
    );
  });

  test("returns false when nomic-embed-text model not found", async () => {
    let callCount = 0;
    globalThis.fetch = createFetchMock(() => {
      callCount++;
      // First call is healthCheck, second is tags check
      if (callCount === 1) {
        return Promise.resolve({ ok: true, status: 200 } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            models: [{ name: "llama2" }, { name: "mistral" }],
          }),
      } as Response);
    });

    const result = await checkOllamaHealth();

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith("nomic-embed-text model not found.");
    expect(warnSpy).toHaveBeenCalledWith("Run: ollama pull nomic-embed-text");
  });

  test("returns false when models list is empty", async () => {
    let callCount = 0;
    globalThis.fetch = createFetchMock(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: true, status: 200 } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ models: [] }),
      } as Response);
    });

    const result = await checkOllamaHealth();

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith("nomic-embed-text model not found.");
  });

  test("returns false when tags request fails", async () => {
    let callCount = 0;
    globalThis.fetch = createFetchMock(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: true, status: 200 } as Response);
      }
      throw new Error("Network error");
    });

    const result = await checkOllamaHealth();

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith("Failed to check Ollama models.");
  });

  test("returns true when healthy and nomic-embed-text is available", async () => {
    let callCount = 0;
    globalThis.fetch = createFetchMock(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: true, status: 200 } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            models: [
              { name: "llama2" },
              { name: "nomic-embed-text:latest" },
              { name: "mistral" },
            ],
          }),
      } as Response);
    });

    const result = await checkOllamaHealth();

    expect(result).toBe(true);
    expect(infoSpy).toHaveBeenCalledWith(
      "Ollama health check passed. Semantic search enabled.",
    );
  });

  test("returns true when nomic-embed-text is available with version tag", async () => {
    let callCount = 0;
    globalThis.fetch = createFetchMock(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: true, status: 200 } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            models: [{ name: "nomic-embed-text:v1.5" }],
          }),
      } as Response);
    });

    const result = await checkOllamaHealth();

    expect(result).toBe(true);
  });

  test("logs warning not error when unavailable", async () => {
    globalThis.fetch = createFetchMock(() => {
      throw new Error("Connection refused");
    });

    await checkOllamaHealth();

    // Verify warn was called (not error)
    expect(warnSpy).toHaveBeenCalled();
  });
});
