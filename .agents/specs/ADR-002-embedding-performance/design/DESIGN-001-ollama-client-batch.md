---
type: design
id: DESIGN-001
title: Ollama client batch API integration
status: draft
priority: P0
related:
  - REQ-001
adr: ADR-002
created: 2026-01-19
updated: 2026-01-19
author: spec-generator
tags:
  - ollama
  - batch-api
  - client-integration
---

# DESIGN-001: Ollama Client Batch API Integration

## Requirements Addressed

- REQ-001: Batch API migration for embedding generation

## Design Overview

This design adds batch embedding support to the existing OllamaClient class by introducing a new `generateBatchEmbeddings` method that uses the `/api/embed` endpoint. The design maintains backward compatibility with the existing single-text `generateEmbedding` method while providing a more efficient batch interface.

The batch API integration follows these principles:
1. **Single responsibility**: OllamaClient handles HTTP communication with Ollama
2. **Index alignment**: Output embeddings array indices match input text indices
3. **Error handling**: All-or-nothing failure (entire batch succeeds or fails)
4. **Type safety**: TypeScript interfaces for request/response validation
5. **Backward compatibility**: Existing single-text method remains functional

## Component Architecture

### Component 1: OllamaClient Batch Method

**Purpose**: Provide batch embedding generation via Ollama `/api/embed` endpoint.

**Responsibilities**:
- Accept array of text strings as input
- Send POST request to `/api/embed` with batch payload
- Parse batch response and return embeddings array
- Validate response array length matches input array length
- Handle empty input (return empty array without API call)
- Apply timeout using AbortSignal
- Throw OllamaError on API errors

**Interface**:

```typescript
class OllamaClient {
  /**
   * Generate embeddings for multiple texts in a single request.
   * Uses the /api/embed endpoint which supports batch input.
   *
   * @param texts - Array of texts to embed
   * @param model - Ollama model name (default: nomic-embed-text)
   * @returns Array of embedding vectors (same order as input)
   * @throws OllamaError on API errors or timeouts
   */
  async generateBatchEmbeddings(
    texts: string[],
    model: string = "nomic-embed-text"
  ): Promise<number[][]>;
}
```

**Implementation**:

```typescript
export class OllamaClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = "http://localhost:11434", timeout: number = 60000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  async generateBatchEmbeddings(
    texts: string[],
    model: string = "nomic-embed-text"
  ): Promise<number[][]> {
    // Empty input optimization
    if (texts.length === 0) {
      return [];
    }

    // Build request payload
    const payload = {
      model,
      input: texts,
      truncate: true,  // Truncate to model context length
    };

    // Send batch request with timeout
    const response = await fetch(`${this.baseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeout),
    });

    // Handle HTTP errors
    if (!response.ok) {
      const errorText = await response.text();
      throw new OllamaError(
        `Ollama batch embed error: ${response.status} - ${errorText}`,
        response.status
      );
    }

    // Parse response
    const data = (await response.json()) as BatchEmbedResponse;

    // Validate response alignment
    if (data.embeddings.length !== texts.length) {
      throw new OllamaError(
        `Embedding count mismatch: expected ${texts.length}, got ${data.embeddings.length}`,
        500
      );
    }

    return data.embeddings;
  }

  // Existing single-text method (deprecated but maintained for compatibility)
  async generateEmbedding(
    text: string,
    model: string = "nomic-embed-text"
  ): Promise<number[]> {
    // Delegate to batch method with single-element array
    const [embedding] = await this.generateBatchEmbeddings([text], model);
    return embedding;
  }
}
```

---

### Component 2: Type Definitions

**Purpose**: Define TypeScript interfaces for batch API request/response.

**Responsibilities**:
- Document Ollama batch API contract
- Enable TypeScript type checking
- Provide IDE autocomplete

**Interface**:

```typescript
/**
 * Request payload for Ollama /api/embed endpoint
 */
interface BatchEmbedRequest {
  /** Model name (e.g., "nomic-embed-text") */
  model: string;

  /** Array of texts to embed */
  input: string[];

  /** Truncate texts to model context length (default: true) */
  truncate?: boolean;

  /** Model options */
  options?: {
    /** Context window size */
    num_ctx?: number;
  };

  /** How long to keep model in memory (e.g., "5m") */
  keep_alive?: string;
}

/**
 * Response structure from Ollama /api/embed endpoint
 */
interface BatchEmbedResponse {
  /** Model used for embedding */
  model: string;

  /** Array of embedding vectors, one per input text */
  embeddings: number[][];
}

/**
 * Custom error class for Ollama API errors
 */
class OllamaError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "OllamaError";
  }
}
```

**File Location**: `apps/mcp/src/services/ollama/types.ts`

---

### Component 3: Embedding Tool Refactor

**Purpose**: Update embed tool to use batch API instead of sequential calls.

**Current Implementation**:
```typescript
// OLD: Sequential single-text calls
for (const chunk of chunks) {
  const embedding = await ollamaClient.generateEmbedding(chunk.text);
  results.push({ ...chunk, embedding });
  await sleep(OLLAMA_REQUEST_DELAY_MS);  // Artificial delay
}
```

**New Implementation**:
```typescript
// NEW: Single batch call per note
const chunkTexts = chunks.map(c => c.text);
const embeddings = await ollamaClient.generateBatchEmbeddings(chunkTexts);

// Map embeddings back to chunks
const results = chunks.map((chunk, i) => ({
  ...chunk,
  embedding: embeddings[i],
}));
```

**File Location**: `apps/mcp/src/tools/embed/index.ts`

---

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **API endpoint** | `/api/embed` (batch) | Supports array input, reduces HTTP overhead |
| **Backward compatibility** | Maintain `generateEmbedding` | Existing code continues working, gradual migration |
| **Error handling** | All-or-nothing | Ollama batch API doesn't support partial failures |
| **Index alignment** | Output[i] = input[i] | Ollama guarantees alignment, simplifies mapping |
| **Empty input handling** | Return empty array | Avoid unnecessary API call |
| **Timeout strategy** | AbortSignal.timeout() | Native browser/Bun API, no external dependencies |

## Security Considerations

- **Input validation**: Batch size limits prevent memory exhaustion (see DESIGN-002)
- **Timeout enforcement**: Prevents indefinite hangs
- **Error messages**: Do not expose sensitive data (note content excluded from errors)
- **Model parameter**: Default model hardcoded, custom models allowed but logged

## Testing Strategy

### Unit Tests

**File**: `apps/mcp/src/services/ollama/__tests__/client.test.ts`

```typescript
describe("OllamaClient.generateBatchEmbeddings", () => {
  it("should send batch request to /api/embed", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "nomic-embed-text",
        embeddings: [[1, 2, 3], [4, 5, 6]],
      }),
    });
    global.fetch = mockFetch;

    const client = new OllamaClient();
    const result = await client.generateBatchEmbeddings(["text1", "text2"]);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:11434/api/embed",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          model: "nomic-embed-text",
          input: ["text1", "text2"],
          truncate: true,
        }),
      })
    );
    expect(result).toEqual([[1, 2, 3], [4, 5, 6]]);
  });

  it("should handle empty input", async () => {
    const client = new OllamaClient();
    const result = await client.generateBatchEmbeddings([]);
    expect(result).toEqual([]);
  });

  it("should throw OllamaError on HTTP error", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal server error",
    });
    global.fetch = mockFetch;

    const client = new OllamaClient();
    await expect(
      client.generateBatchEmbeddings(["text"])
    ).rejects.toThrow(OllamaError);
  });

  it("should throw OllamaError on embedding count mismatch", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "nomic-embed-text",
        embeddings: [[1, 2, 3]],  // Only 1 embedding, expected 2
      }),
    });
    global.fetch = mockFetch;

    const client = new OllamaClient();
    await expect(
      client.generateBatchEmbeddings(["text1", "text2"])
    ).rejects.toThrow("Embedding count mismatch");
  });

  it("should apply timeout", async () => {
    const mockFetch = jest.fn().mockImplementation(() => {
      return new Promise((resolve) => setTimeout(resolve, 100000));
    });
    global.fetch = mockFetch;

    const client = new OllamaClient("http://localhost:11434", 1000);
    await expect(
      client.generateBatchEmbeddings(["text"])
    ).rejects.toThrow("timeout");
  });
});
```

### Integration Tests

**File**: `apps/mcp/src/services/ollama/__tests__/integration.test.ts`

```typescript
describe("OllamaClient Integration", () => {
  it("should generate batch embeddings from real Ollama", async () => {
    const client = new OllamaClient();
    const texts = ["hello world", "test embedding", "batch API works"];

    const embeddings = await client.generateBatchEmbeddings(texts);

    expect(embeddings).toHaveLength(3);
    expect(embeddings[0]).toHaveLength(768);  // nomic-embed-text dimension
    expect(embeddings[1]).toHaveLength(768);
    expect(embeddings[2]).toHaveLength(768);
  });
});
```

## Open Questions

- **Batch size limits**: Should we impose a maximum batch size? (Addressed in DESIGN-002)
- **Model warming**: Should we keep model in memory with `keep_alive`? (Not needed for continuous workload)
- **Retry logic**: Should batch failures be retried? (Addressed at note level, not batch level)
