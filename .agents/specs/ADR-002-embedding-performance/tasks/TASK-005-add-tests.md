---
type: task
id: TASK-005
title: Add unit and integration tests for batch embedding
status: todo
priority: P0
complexity: M
estimate: 4h
related:
  - DESIGN-001
  - DESIGN-002
  - DESIGN-003
  - REQ-001
  - REQ-002
  - REQ-003
  - REQ-004
blocked_by:
  - TASK-001
  - TASK-002
  - TASK-004
blocks: []
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
author: spec-generator
tags:
  - testing
  - unit-tests
  - integration-tests
  - validation
---

# TASK-005: Add Unit and Integration Tests for Batch Embedding

## Design Context

- DESIGN-001: Ollama client batch API integration
- DESIGN-002: p-limit concurrency control architecture
- DESIGN-003: Timeout cascade architecture with fail-fast errors

## Objective

Create comprehensive unit and integration tests for the batch embedding implementation, covering OllamaClient batch method, concurrency control, timeout behavior, and end-to-end embedding pipeline.

## Scope

**In Scope**:
- Unit tests for OllamaClient.generateBatchEmbeddings
- Unit tests for concurrency control (p-limit behavior)
- Unit tests for timeout error handling
- Unit tests for OllamaError context and retry logic
- Integration test: 100 real notes with Ollama
- Integration test: Timeout enforcement
- Performance baseline measurement (for REQ-004 validation)

**Out of Scope**:
- Load testing (>1000 notes) - P2 enhancement
- Circuit breaker tests - P2 enhancement
- Memory leak tests - P2 enhancement

## Acceptance Criteria

- [ ] Test file created: `apps/mcp/src/services/ollama/__tests__/client.test.ts`
- [ ] Test file created: `apps/mcp/src/services/embedding/__tests__/concurrency.test.ts`
- [ ] Test file created: `apps/mcp/src/services/embedding/__tests__/integration.test.ts`
- [ ] Test file created: `apps/mcp/src/services/embedding/__tests__/timeout.test.ts`
- [ ] All unit tests pass: `bun test`
- [ ] All integration tests pass (requires Ollama): `bun test --integration`
- [ ] Code coverage >80% for new code
- [ ] No test flakiness (tests pass 10 consecutive runs)
- [ ] Performance baseline documented in test output

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/src/services/ollama/__tests__/client.test.ts` | Create | OllamaClient batch method tests |
| `apps/mcp/src/services/embedding/__tests__/concurrency.test.ts` | Create | Concurrency control tests |
| `apps/mcp/src/services/embedding/__tests__/timeout.test.ts` | Create | Timeout behavior tests |
| `apps/mcp/src/services/embedding/__tests__/integration.test.ts` | Create | End-to-end integration tests |

## Implementation Notes

### Test Suite 1: OllamaClient Batch Method

**File**: `apps/mcp/src/services/ollama/__tests__/client.test.ts`

```typescript
import { describe, it, expect, jest } from 'bun:test';
import { OllamaClient, OllamaError } from '../client';

describe('OllamaClient.generateBatchEmbeddings', () => {
  it('should send batch request to /api/embed', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'nomic-embed-text',
        embeddings: [[1, 2, 3], [4, 5, 6]],
      }),
    });
    global.fetch = mockFetch;

    const client = new OllamaClient();
    const result = await client.generateBatchEmbeddings(['text1', 'text2']);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/embed',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: 'nomic-embed-text',
          input: ['text1', 'text2'],
          truncate: true,
        }),
      })
    );
    expect(result).toEqual([[1, 2, 3], [4, 5, 6]]);
  });

  it('should handle empty input', async () => {
    const client = new OllamaClient();
    const result = await client.generateBatchEmbeddings([]);
    expect(result).toEqual([]);
  });

  it('should throw OllamaError on HTTP error', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal server error',
    });
    global.fetch = mockFetch;

    const client = new OllamaClient();
    await expect(
      client.generateBatchEmbeddings(['text'])
    ).rejects.toThrow(OllamaError);
  });

  it('should throw OllamaError on embedding count mismatch', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'nomic-embed-text',
        embeddings: [[1, 2, 3]],
      }),
    });
    global.fetch = mockFetch;

    const client = new OllamaClient();
    await expect(
      client.generateBatchEmbeddings(['text1', 'text2'])
    ).rejects.toThrow('Embedding count mismatch');
  });

  it('should delegate single-text method to batch', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'nomic-embed-text',
        embeddings: [[1, 2, 3]],
      }),
    });
    global.fetch = mockFetch;

    const client = new OllamaClient();
    const result = await client.generateEmbedding('text');

    expect(result).toEqual([1, 2, 3]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"input":["text"]'),
      })
    );
  });
});
```

### Test Suite 2: Concurrency Control

**File**: `apps/mcp/src/services/embedding/__tests__/concurrency.test.ts`

```typescript
import { describe, it, expect } from 'bun:test';
import { processNotesWithConcurrency } from '../concurrency';
import { EMBEDDING_CONFIG } from '../config';

describe('processNotesWithConcurrency', () => {
  it('should limit concurrent operations', async () => {
    const notes = Array.from({ length: 10 }, (_, i) => `note-${i}`);
    const activeCount = { current: 0, max: 0 };

    const processNote = async (note: string) => {
      activeCount.current++;
      activeCount.max = Math.max(activeCount.max, activeCount.current);
      await sleep(10);
      activeCount.current--;
      return { note, success: true };
    };

    await processNotesWithConcurrency(notes, processNote);

    expect(activeCount.max).toBeLessThanOrEqual(EMBEDDING_CONFIG.CONCURRENCY);
  });

  it('should handle failures gracefully', async () => {
    const notes = ['note1', 'note2', 'note3'];
    const processNote = async (note: string) => {
      if (note === 'note2') throw new Error('Simulated failure');
      return { note, success: true };
    };

    const result = await processNotesWithConcurrency(notes, processNote);

    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(1);
    expect(result.failed[0].note).toBe('note2');
  });

  it('should process all notes even if some fail', async () => {
    const notes = Array.from({ length: 20 }, (_, i) => `note-${i}`);
    const processNote = async (note: string) => {
      if (note === 'note-5' || note === 'note-15') {
        throw new Error('Simulated failure');
      }
      return { note, success: true };
    };

    const result = await processNotesWithConcurrency(notes, processNote);

    expect(result.total).toBe(20);
    expect(result.successCount).toBe(18);
    expect(result.failureCount).toBe(2);
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### Test Suite 3: Timeout Behavior

**File**: `apps/mcp/src/services/embedding/__tests__/timeout.test.ts`

```typescript
import { describe, it, expect, jest } from 'bun:test';
import { OllamaClient, OllamaError } from '../../ollama/client';

describe('Timeout Behavior', () => {
  it('should timeout after configured duration', async () => {
    const mockFetch = jest.fn().mockImplementation(() =>
      new Promise((resolve) => setTimeout(resolve, 100000))
    );
    global.fetch = mockFetch;

    const client = new OllamaClient('http://localhost:11434', 1000);

    await expect(
      client.generateBatchEmbeddings(['test'])
    ).rejects.toThrow(/timeout/i);
  });

  it('should include context in timeout error', async () => {
    const mockFetch = jest.fn().mockImplementation(() =>
      new Promise((resolve) => setTimeout(resolve, 100000))
    );
    global.fetch = mockFetch;

    const client = new OllamaClient('http://localhost:11434', 1000);

    try {
      await client.generateBatchEmbeddings(['text1', 'text2']);
      throw new Error('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(OllamaError);
      expect((error as OllamaError).context?.chunks).toBe(2);
      expect((error as OllamaError).context?.timeout).toBe(1000);
    }
  });

  it('should identify retryable errors', () => {
    const error500 = new OllamaError('Server error', 500);
    const error408 = new OllamaError('Timeout', 408);
    const error400 = new OllamaError('Bad request', 400);

    expect(error500.isRetryable()).toBe(true);
    expect(error408.isRetryable()).toBe(true);
    expect(error400.isRetryable()).toBe(false);
  });
});
```

### Test Suite 4: Integration Tests

**File**: `apps/mcp/src/services/embedding/__tests__/integration.test.ts`

```typescript
import { describe, it, expect } from 'bun:test';
import { OllamaClient } from '../../ollama/client';
import { processNotesWithConcurrency } from '../concurrency';
import { processNoteWithBatchEmbedding } from '../processNote';

describe('Integration Tests', () => {
  it('should generate batch embeddings from real Ollama', async () => {
    const client = new OllamaClient();
    const texts = ['hello world', 'test embedding', 'batch API works'];

    const embeddings = await client.generateBatchEmbeddings(texts);

    expect(embeddings).toHaveLength(3);
    expect(embeddings[0]).toHaveLength(768); // nomic-embed-text dimension
    expect(embeddings[1]).toHaveLength(768);
    expect(embeddings[2]).toHaveLength(768);
  });

  it('should process 100 notes concurrently within expected time', async () => {
    const notes = Array.from({ length: 100 }, (_, i) => `test-note-${i}`);
    const ollamaClient = new OllamaClient();

    const startTime = Date.now();
    const result = await processNotesWithConcurrency(
      notes,
      (note) => processNoteWithBatchEmbedding(note, ollamaClient)
    );
    const elapsed = Date.now() - startTime;

    expect(result.total).toBe(100);
    expect(elapsed).toBeLessThan(30000); // 30 seconds for 100 notes
    console.log(`Performance: ${elapsed}ms for ${result.total} notes`);
  });

  it('should complete 700 notes within 5 minutes', async () => {
    const notes = Array.from({ length: 700 }, (_, i) => `test-note-${i}`);
    const ollamaClient = new OllamaClient();

    const startTime = Date.now();
    const result = await processNotesWithConcurrency(
      notes,
      (note) => processNoteWithBatchEmbedding(note, ollamaClient)
    );
    const elapsed = Date.now() - startTime;

    expect(result.total).toBe(700);
    expect(elapsed).toBeLessThan(5 * 60 * 1000); // 5 minutes
    expect(elapsed).toBeLessThan(2 * 60 * 1000); // Target: 2 minutes (5x improvement)

    console.log(`Performance: ${elapsed}ms for ${result.total} notes`);
    console.log(`Improvement factor: ${(10 * 60 * 1000) / elapsed}x`);
  });
});
```

## Testing Requirements

### Unit Tests
- [ ] All unit tests pass
- [ ] Mock-based tests do not require Ollama
- [ ] Tests are deterministic (no flakiness)
- [ ] Error cases covered (HTTP errors, timeouts, mismatches)
- [ ] Edge cases covered (empty input, single item)

### Integration Tests
- [ ] Ollama server running with nomic-embed-text model
- [ ] 100-note test completes <30 seconds
- [ ] 700-note test completes <120 seconds (5x minimum)
- [ ] Performance metrics logged to console
- [ ] Tests clean up test data after completion

### Performance Validation
- [ ] Baseline measurement documented (before optimization)
- [ ] Post-optimization measurement shows ≥5x improvement
- [ ] Performance regression test added to CI

## Dependencies

- TASK-001: Batch method must be implemented
- TASK-002: Embed tool must be refactored
- TASK-003: p-limit must be installed
- TASK-004: Timeouts must be reduced
- Ollama server running locally with nomic-embed-text model
- Bun test runner

## Related Tasks

- TASK-001: Add batch method (tested by this task)
- TASK-002: Refactor embed tool (tested by this task)
- TASK-003: Add p-limit (behavior validated by concurrency tests)
- TASK-004: Reduce timeouts (timeout tests validate configuration)

## Performance Baseline

Before running tests, capture baseline performance:

```bash
# Baseline (before optimization)
time brain embed --project brain --limit 700 > baseline.log

# Expected: ~600 seconds (10 minutes)
```

After implementation, compare:

```bash
# Optimized (after implementation)
time brain embed --project brain --limit 700 > optimized.log

# Expected: <120 seconds (2 minutes) for 5x minimum
# Target: ~46 seconds (13x improvement)
```
