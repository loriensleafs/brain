---
type: task
id: TASK-004
title: Reduce timeouts for fail-fast error reporting
status: todo
priority: P1
complexity: S
estimate: 1h
related:
  - DESIGN-003
  - REQ-003
blocked_by: []
blocks:
  - TASK-005
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
author: spec-generator
tags:
  - timeout
  - configuration
  - error-handling
---

# TASK-004: Reduce Timeouts for Fail-Fast Error Reporting

## Design Context

- DESIGN-003: Timeout cascade architecture with fail-fast errors

## Objective

Reduce timeout values across all system layers to enable fast failure detection while supporting the performance target. This includes updating Ollama client timeout, Go HTTP client timeout, and documenting configuration in .env.example.

## Scope

**In Scope**:

- Update OLLAMA_CONFIG.TIMEOUT from 600,000ms to 60,000ms
- Update Go HTTP client timeout from 10 minutes to 5 minutes
- Add timeout configuration to .env.example with documentation
- Enhance OllamaError with context (note, chunks, elapsed time)
- Add timeout validation on config load
- Leave Bun idleTimeout at 0 (disabled) - unchanged
- Leave health check timeout at 5s - unchanged

**Out of Scope**:

- Adaptive timeout logic based on note size (keep simple)
- Timeout telemetry/monitoring (P2 enhancement)
- Circuit breaker pattern (P2 enhancement)
- Integration tests (handled in TASK-005)

## Acceptance Criteria

- [ ] File `apps/mcp/src/config/ollama.ts` updated
- [ ] OLLAMA_CONFIG.TIMEOUT default changed from 600000 to 60000
- [ ] OLLAMA_TIMEOUT environment variable documented
- [ ] Timeout validation: minimum 1000ms, warning if >300000ms
- [ ] File `apps/tui/client/http.go` updated
- [ ] HTTPClientTimeout constant changed from 10 minutes to 5 minutes
- [ ] File `.env.example` updated with timeout documentation
- [ ] OllamaError class enhanced with context field
- [ ] Timeout errors include: note, chunks, elapsed, expected, timeout
- [ ] OllamaError.isRetryable() method added
- [ ] OllamaError.toUserMessage() method added
- [ ] TypeScript compilation succeeds
- [ ] Go compilation succeeds
- [ ] No linting errors

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/src/config/ollama.ts` | Modify | Reduce OLLAMA_CONFIG.TIMEOUT to 60000ms |
| `apps/tui/client/http.go` | Modify | Reduce HTTPClientTimeout to 5 minutes |
| `apps/mcp/.env.example` | Modify | Add timeout documentation |
| `apps/mcp/src/services/ollama/types.ts` | Modify | Enhance OllamaError with context |

## Implementation Notes

### Step 1: Update Ollama Config (TypeScript)

Edit `apps/mcp/src/config/ollama.ts`:

```typescript
export const OLLAMA_CONFIG = {
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
   */
  HEALTH_TIMEOUT: parseInt(process.env.OLLAMA_HEALTH_TIMEOUT ?? '5000', 10),

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

### Step 2: Update Go HTTP Client

Edit `apps/tui/client/http.go`:

```go
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
```

### Step 3: Enhance OllamaError

Edit `apps/mcp/src/services/ollama/types.ts`:

```typescript
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

  isRetryable(): boolean {
    // 5xx errors: server issues, retry
    if (this.status >= 500 && this.status < 600) return true;
    // 408 timeout: could be transient, retry
    if (this.status === 408) return true;
    // 4xx errors: client errors, don't retry
    return false;
  }

  toUserMessage(): string {
    let message = this.message;

    if (this.context) {
      const { note, chunks, elapsed, expected, timeout } = this.context;
      if (note) message += `\nNote: ${note}`;
      if (chunks !== undefined) message += `\nChunks: ${chunks}`;
      if (elapsed !== undefined && timeout !== undefined) {
        message += `\nTiming: ${elapsed}ms elapsed, ${timeout}ms limit`;
        if (expected !== undefined) message += `, ${expected}ms expected`;
      }
      if (this.isRetryable()) {
        message += '\n\nThis error may be transient. Retry the operation.';
      }
    }

    return message;
  }
}
```

### Step 4: Update .env.example

Add timeout documentation to `apps/mcp/.env.example`:

```bash
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
EMBEDDING_CONCURRENCY=4
```

### Step 5: Update Timeout Error Handling in OllamaClient

Edit `apps/mcp/src/services/ollama/client.ts`:

```typescript
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
      signal: AbortSignal.timeout(this.timeout),
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      throw new OllamaError(
        `Batch embed failed after ${elapsed}ms: ${response.status}`,
        response.status,
        { chunks: texts.length, elapsed, timeout: this.timeout, expected: 100 }
      );
    }

    return (await response.json()).embeddings;

  } catch (error) {
    const elapsed = Date.now() - startTime;

    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new OllamaError(
        `Batch embedding timeout after ${elapsed}ms`,
        408,
        {
          chunks: texts.length,
          elapsed,
          timeout: this.timeout,
          expected: 100,
        }
      );
    }

    throw error;
  }
}
```

## Testing Requirements

- [ ] Config loads with default 60s timeout
- [ ] Config loads with custom OLLAMA_TIMEOUT from env
- [ ] Config throws error if timeout < 1000ms
- [ ] Config warns if timeout > 300000ms
- [ ] Go client compiles with 5-minute timeout
- [ ] OllamaError.toUserMessage() includes all context fields
- [ ] OllamaError.isRetryable() returns true for 5xx and 408

Testing is covered in TASK-005, but implementer should verify locally.

## Dependencies

- Existing Ollama config structure
- Existing Go HTTP client structure
- TypeScript/Bun runtime
- Go 1.21+ compiler

## Related Tasks

- TASK-001: Add batch method (uses timeout)
- TASK-002: Refactor embed tool (benefits from fast failure)
- TASK-005: Add tests (validates timeout behavior)
