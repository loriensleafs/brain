---
type: design
id: DESIGN-003
title: Timeout cascade architecture with fail-fast errors
status: implemented
priority: P1
related:
  - REQ-003
  - REQ-004
adr: ADR-002
created: 2026-01-19
updated: 2026-01-19
author: spec-generator
tags:
  - timeout
  - error-handling
  - observability
  - fail-fast
---

# DESIGN-003: Timeout Cascade Architecture with Fail-Fast Errors

## Requirements Addressed

- REQ-003: Timeout optimization with fail-fast error reporting
- REQ-004: Performance target of 5x minimum improvement (timeout validation)

## Design Overview

This design optimizes the timeout cascade across all system layers to enable fast failure detection while supporting the performance target. The architecture reduces excessive timeouts (10 minutes → 60 seconds for Ollama operations) while maintaining appropriate timeouts for long-running operations (Bun MCP server).

Key design principles:

1. **Right-sized timeouts**: Match timeout to expected operation duration
2. **Fail-fast**: Detect failures quickly with actionable error messages
3. **Context preservation**: Timeout errors include operation details (note, chunk count, elapsed time)
4. **Layered defense**: Multiple timeout layers prevent cascade failures
5. **Configurable**: Environment variables allow tuning for different environments

## Component Architecture

### Component 1: Timeout Layer Definitions

**Purpose**: Define appropriate timeout values for each system layer.

**Current State (Before Optimization)**:

| Layer | Location | Timeout | Issue |
|-------|----------|---------|-------|
| Bun idleTimeout | `apps/mcp/src/transport/http.ts` | 0 (disabled) | Correct (MCP needs long operations) |
| Go HTTP Client | `apps/tui/client/http.go` | 10 min | 13x longer than needed (700 notes = 46s) |
| Ollama Client | `apps/mcp/src/config/ollama.ts` | 10 min | 6000x longer than needed (batch = 100ms) |
| Health Check | `apps/mcp/src/services/ollama/client.ts` | 5s | Correct (quick failure detection) |

**Optimized State (After Implementation)**:

| Layer | Location | New Timeout | Rationale |
|-------|----------|-------------|-----------|
| Bun idleTimeout | `apps/mcp/src/transport/http.ts` | 0 (disabled) | KEEP - Required for long MCP tool operations |
| Go HTTP Client | `apps/tui/client/http.go` | 5 min | Handles 3000+ notes (13x current corpus) |
| Ollama Client | `apps/mcp/src/config/ollama.ts` | 60s | Batch embedding = 100ms, 600x safety margin |
| Health Check | `apps/mcp/src/services/ollama/client.ts` | 5s | KEEP - Quick ping validation |

**Timeout Calculation**:

```typescript
/**
 * Timeout calculations based on empirical measurements
 */
const TIMEOUT_CALCULATIONS = {
  // Single embedding operation
  SINGLE_EMBEDDING_MS: 50,  // 15-50ms observed

  // Batch embedding (avg 3 chunks per note)
  BATCH_EMBEDDING_MS: 100,  // 3 chunks × 50ms = 150ms, use 100ms conservative

  // Note processing (read + chunk + embed + store)
  PER_NOTE_MS: 260,  // 100ms read + 10ms chunk + 100ms embed + 50ms store

  // 700 notes with concurrency 4
  FULL_CORPUS_MS: (700 / 4) * 260,  // 45,500ms = 45.5 seconds

  // Safety margins
  OLLAMA_SAFETY_MARGIN: 600,  // 60s / 100ms = 600x margin
  CLI_SAFETY_MARGIN: 6.5,     // 5 min / 46s = 6.5x margin
};
```

---

### Component 2: Ollama Client Timeout Configuration

**Purpose**: Reduce Ollama client timeout from 10 minutes to 60 seconds.

**Responsibilities**:

- Read OLLAMA_TIMEOUT environment variable
- Apply timeout using AbortSignal
- Provide sensible default (60 seconds)
- Document timeout in code and .env.example

**Implementation**:

```typescript
// apps/mcp/src/config/ollama.ts

/**
 * Ollama client configuration with right-sized timeouts
 */
export const OLLAMA_CONFIG = {
  /**
   * Base URL for Ollama server.
   * Configurable via OLLAMA_BASE_URL environment variable.
   */
  BASE_URL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',

  /**
   * Request timeout in milliseconds.
   *
   * Default: 60 seconds (60000ms)
   * - Single batch embedding: ~100ms (avg 3 chunks per note)
   * - Per-note processing: ~260ms (read + chunk + embed + store)
   * - Safety margin: 600x expected duration
   *
   * Configurable via OLLAMA_TIMEOUT environment variable.
   *
   * Previous value: 600,000ms (10 minutes) - 6000x longer than needed
   */
  TIMEOUT: parseInt(process.env.OLLAMA_TIMEOUT ?? '60000', 10),

  /**
   * Health check timeout in milliseconds.
   *
   * Default: 5 seconds (5000ms)
   * Health checks should fail fast to detect server unavailability.
   *
   * Configurable via OLLAMA_HEALTH_TIMEOUT environment variable.
   */
  HEALTH_TIMEOUT: parseInt(process.env.OLLAMA_HEALTH_TIMEOUT ?? '5000', 10),

  /**
   * Default embedding model.
   */
  DEFAULT_MODEL: 'nomic-embed-text',
};

// Validate timeout ranges
if (OLLAMA_CONFIG.TIMEOUT < 1000) {
  throw new Error('OLLAMA_TIMEOUT must be at least 1000ms (1 second)');
}

if (OLLAMA_CONFIG.TIMEOUT > 300000) {
  console.warn('OLLAMA_TIMEOUT > 5 minutes may mask failures. Consider reducing.');
}
```

**OllamaClient Usage**:

```typescript
export class OllamaClient {
  private baseUrl: string;
  private timeout: number;

  constructor(
    baseUrl: string = OLLAMA_CONFIG.BASE_URL,
    timeout: number = OLLAMA_CONFIG.TIMEOUT
  ) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_CONFIG.DEFAULT_MODEL,
          input: texts,
        }),
        signal: AbortSignal.timeout(this.timeout),  // Apply timeout
      });

      const elapsed = Date.now() - startTime;

      if (!response.ok) {
        throw new OllamaError(
          `Batch embed failed after ${elapsed}ms: ${response.status}`,
          response.status
        );
      }

      const data = await response.json();
      logger.debug({ elapsed, chunks: texts.length }, 'Batch embedding completed');
      return data.embeddings;

    } catch (error) {
      const elapsed = Date.now() - startTime;

      // Enhanced timeout error with context
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new OllamaError(
          `Batch embedding timeout after ${elapsed}ms (limit: ${this.timeout}ms, chunks: ${texts.length}, expected: <1s)`,
          408  // HTTP 408 Request Timeout
        );
      }

      throw error;
    }
  }
}
```

---

### Component 3: Go HTTP Client Timeout Reduction

**Purpose**: Reduce Go CLI HTTP client timeout from 10 minutes to 5 minutes.

**Responsibilities**:

- Apply timeout to all Brain CLI HTTP requests
- Handle timeout errors gracefully
- Report timeout with context (operation, elapsed time)

**Implementation**:

```go
// apps/tui/client/http.go

import (
  "context"
  "net/http"
  "time"
)

const (
  // HTTP client timeout for Brain CLI operations.
  //
  // Default: 5 minutes (300 seconds)
  // - 700 notes with concurrency 4: 45.5 seconds expected
  // - 3000 notes with concurrency 4: 195 seconds expected
  // - Safety margin: 6.5x current corpus, 1.5x for 3000 notes
  //
  // Previous value: 10 minutes - 13x longer than needed for 700 notes
  HTTPClientTimeout = 5 * time.Minute

  // Health check timeout for connectivity validation.
  //
  // Default: 5 seconds
  // Quick failure detection for server unavailability.
  HealthCheckTimeout = 5 * time.Second
)

// NewHTTPClient creates an HTTP client with right-sized timeout.
func NewHTTPClient() *http.Client {
  return &http.Client{
    Timeout: HTTPClientTimeout,
    Transport: &http.Transport{
      MaxIdleConns:        100,
      MaxIdleConnsPerHost: 10,
      IdleConnTimeout:     90 * time.Second,
    },
  }
}

// NewHealthCheckClient creates an HTTP client for health checks.
func NewHealthCheckClient() *http.Client {
  return &http.Client{
    Timeout: HealthCheckTimeout,
  }
}

// DoWithTimeout performs HTTP request with explicit context timeout.
func DoWithTimeout(
  client *http.Client,
  req *http.Request,
  timeout time.Duration,
) (*http.Response, error) {
  ctx, cancel := context.WithTimeout(req.Context(), timeout)
  defer cancel()

  req = req.WithContext(ctx)
  startTime := time.Now()

  resp, err := client.Do(req)
  elapsed := time.Since(startTime)

  // Enhanced timeout error with context
  if err != nil {
    if ctx.Err() == context.DeadlineExceeded {
      return nil, fmt.Errorf(
        "request timeout after %v (limit: %v, url: %s)",
        elapsed,
        timeout,
        req.URL.String(),
      )
    }
    return nil, err
  }

  return resp, nil
}
```

---

### Component 4: Error Context Enhancement

**Purpose**: Enrich timeout errors with actionable context for debugging.

**Responsibilities**:

- Include operation details (note identifier, chunk count)
- Include timing details (elapsed time, expected time, timeout limit)
- Differentiate timeout from network errors
- Provide retry suggestions for transient failures

**Implementation**:

```typescript
/**
 * Enhanced error class for Ollama operations with context
 */
export class OllamaError extends Error {
  constructor(
    message: string,
    public status: number,
    public context?: {
      note?: string;
      chunks?: number;
      elapsed?: number;
      expected?: number;
      timeout?: number;
    }
  ) {
    super(message);
    this.name = 'OllamaError';
  }

  /**
   * Check if error is retryable (5xx errors, network errors)
   */
  isRetryable(): boolean {
    // 5xx errors: server issues, retry
    if (this.status >= 500 && this.status < 600) {
      return true;
    }

    // 408 timeout: could be transient, retry
    if (this.status === 408) {
      return true;
    }

    // 4xx errors: client errors, don't retry
    return false;
  }

  /**
   * Format error for user display
   */
  toUserMessage(): string {
    let message = this.message;

    if (this.context) {
      const { note, chunks, elapsed, expected, timeout } = this.context;

      if (note) {
        message += `\nNote: ${note}`;
      }

      if (chunks !== undefined) {
        message += `\nChunks: ${chunks}`;
      }

      if (elapsed !== undefined && timeout !== undefined) {
        message += `\nTiming: ${elapsed}ms elapsed, ${timeout}ms limit`;
        if (expected !== undefined) {
          message += `, ${expected}ms expected`;
        }
      }

      if (this.isRetryable()) {
        message += '\n\nThis error may be transient. Retry the operation.';
      }
    }

    return message;
  }
}
```

**Usage in Note Processing**:

```typescript
export async function processNoteWithBatchEmbedding(
  noteIdentifier: string,
  ollamaClient: OllamaClient
): Promise<ProcessResult> {
  const startTime = Date.now();

  try {
    const note = await readNote(noteIdentifier);
    const chunks = chunkText(note.content);
    const embeddings = await ollamaClient.generateBatchEmbeddings(
      chunks.map(c => c.text)
    );

    // ... store embeddings ...

    return { note: noteIdentifier, success: true };

  } catch (error) {
    const elapsed = Date.now() - startTime;

    if (error instanceof OllamaError) {
      // Add context to error
      error.context = {
        ...error.context,
        note: noteIdentifier,
        chunks: chunks?.length,
        elapsed,
      };

      logger.error({
        note: noteIdentifier,
        status: error.status,
        retryable: error.isRetryable(),
        message: error.toUserMessage(),
      }, 'Note processing failed');
    }

    return {
      note: noteIdentifier,
      success: false,
      error: error instanceof OllamaError ? error.toUserMessage() : String(error),
    };
  }
}
```

---

### Component 5: .env.example Documentation

**Purpose**: Document timeout configuration in .env.example for users.

**Implementation**:

```bash
# .env.example

# ===== Ollama Configuration =====

# Ollama server base URL
# Default: http://localhost:11434
OLLAMA_BASE_URL=http://localhost:11434

# Ollama request timeout (milliseconds)
# Default: 60000 (60 seconds)
#
# Right-sized for batch embedding operations:
# - Single batch: ~100ms (avg 3 chunks)
# - Per-note: ~260ms (read + chunk + embed + store)
# - 700 notes: ~45s with concurrency 4
#
# Increase if:
# - Processing very large notes (>10k tokens)
# - Ollama server is slow or overloaded
# - Using slower embedding models
#
# Decrease if:
# - Want faster failure detection
# - Running on fast hardware
OLLAMA_TIMEOUT=60000

# Ollama health check timeout (milliseconds)
# Default: 5000 (5 seconds)
#
# Health checks should fail fast to detect server unavailability.
OLLAMA_HEALTH_TIMEOUT=5000

# ===== Embedding Concurrency =====

# Maximum concurrent embedding operations
# Default: 4 (matches OLLAMA_NUM_PARALLEL)
#
# Increase if:
# - Ollama server has high OLLAMA_NUM_PARALLEL value
# - Hardware can handle more concurrency
#
# Decrease if:
# - Experiencing Ollama 500 errors
# - Memory pressure on Ollama server
EMBEDDING_CONCURRENCY=4
```

---

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Ollama timeout** | 60 seconds | 600x safety margin, fails fast vs 10 minutes |
| **CLI timeout** | 5 minutes | Handles 3000+ notes, 6.5x current corpus |
| **Bun idle timeout** | Disabled (0) | Required for long MCP tool operations |
| **Health check timeout** | 5 seconds | Quick failure detection, unchanged |
| **Error context** | Note identifier, chunks, timing | Enables debugging, actionable messages |
| **Retry suggestion** | For 5xx and 408 errors | Helps users recover from transients |

## Security Considerations

- **Timeout bounds**: Prevent indefinite hangs (DoS vector)
- **Error messages**: Do not expose note content, only metadata
- **Configuration**: Validate timeout ranges on startup
- **Resource exhaustion**: Combined with concurrency limits (DESIGN-002)

## Testing Strategy

### Unit Tests

**File**: `apps/mcp/src/services/ollama/__tests__/timeout.test.ts`

```typescript
describe("OllamaClient Timeout", () => {
  it("should timeout after configured duration", async () => {
    const mockFetch = jest.fn().mockImplementation(() =>
      new Promise((resolve) => setTimeout(resolve, 100000))  // Never resolves
    );
    global.fetch = mockFetch;

    const client = new OllamaClient("http://localhost:11434", 1000);

    await expect(
      client.generateBatchEmbeddings(["test"])
    ).rejects.toThrow(/timeout/i);
  });

  it("should include context in timeout error", async () => {
    const mockFetch = jest.fn().mockImplementation(() =>
      new Promise((resolve) => setTimeout(resolve, 100000))
    );
    global.fetch = mockFetch;

    const client = new OllamaClient("http://localhost:11434", 1000);

    try {
      await client.generateBatchEmbeddings(["test1", "test2"]);
      fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(OllamaError);
      expect(error.message).toContain("chunks: 2");
      expect(error.message).toContain("limit: 1000ms");
    }
  });
});
```

### Integration Tests

**File**: `apps/mcp/src/services/embedding/__tests__/timeout-integration.test.ts`

```typescript
describe("Timeout Integration", () => {
  it("should complete 700 notes within 5 minutes", async () => {
    const notes = Array.from({ length: 700 }, (_, i) => `note-${i}`);
    const ollamaClient = new OllamaClient();

    const startTime = Date.now();
    const result = await processNotesWithConcurrency(
      notes,
      (note) => processNoteWithBatchEmbedding(note, ollamaClient)
    );
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(5 * 60 * 1000);  // 5 minutes CLI timeout
    expect(result.successCount).toBe(700);
  });
});
```

## Open Questions

- **Adaptive timeouts**: Should timeout adjust based on note size? (No, keep simple, use fixed timeout)
- **Timeout telemetry**: Should we track timeout frequency for monitoring? (P2, optional enhancement)
