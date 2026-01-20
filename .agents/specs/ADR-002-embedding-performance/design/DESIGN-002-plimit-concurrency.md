---
type: design
id: DESIGN-002
title: p-limit concurrency control architecture
status: draft
priority: P0
related:
  - REQ-002
  - DESIGN-001
adr: ADR-002
created: 2026-01-19
updated: 2026-01-19
author: spec-generator
tags:
  - concurrency
  - p-limit
  - backpressure
  - resource-management
---

# DESIGN-002: p-limit Concurrency Control Architecture

## Requirements Addressed

- REQ-002: Concurrency control with p-limit for resource protection

## Design Overview

This design implements note-level concurrency control using the p-limit library to prevent Ollama server resource exhaustion. The architecture processes multiple notes concurrently while limiting simultaneous operations to match Ollama's `OLLAMA_NUM_PARALLEL` capacity.

Key design principles:

1. **Note-level concurrency**: Each note processed independently with chunk-level batching
2. **Backpressure via p-limit**: Queue-based concurrency limiting without artificial delays
3. **Fail-isolated**: One note's failure does not block other notes
4. **Configurable limits**: Environment variable for tuning concurrency
5. **Observable**: Progress and memory metrics logged for monitoring

## Component Architecture

### Component 1: Concurrency Configuration

**Purpose**: Define and validate concurrency limits from environment variables.

**Responsibilities**:

- Read EMBEDDING_CONCURRENCY environment variable
- Validate concurrency value (min 1, max 16)
- Provide default value (4) matching Ollama defaults
- Log configured concurrency at tool startup

**Implementation**:

```typescript
/**
 * Configuration for embedding concurrency control
 */
export const EMBEDDING_CONFIG = {
  /**
   * Maximum concurrent note-level embedding operations.
   * Matches Ollama's OLLAMA_NUM_PARALLEL default.
   *
   * Configurable via EMBEDDING_CONCURRENCY environment variable.
   * Valid range: 1-16 (bounded to prevent resource exhaustion)
   */
  CONCURRENCY: Math.min(
    Math.max(1, parseInt(process.env.EMBEDDING_CONCURRENCY ?? '4', 10)),
    16
  ),

  /**
   * Maximum chunks per batch request.
   * Prevents oversized payloads that could exceed limits.
   */
  MAX_CHUNKS_PER_BATCH: 32,

  /**
   * Memory logging interval (every N notes).
   */
  MEMORY_LOG_INTERVAL: 100,
};

// Log configuration at startup
logger.info({
  concurrency: EMBEDDING_CONFIG.CONCURRENCY,
  maxChunksPerBatch: EMBEDDING_CONFIG.MAX_CHUNKS_PER_BATCH,
}, 'Embedding configuration loaded');
```

**File Location**: `apps/mcp/src/services/embedding/config.ts`

---

### Component 2: p-limit Integration

**Purpose**: Apply concurrency limiting to note processing operations.

**Responsibilities**:

- Create p-limit instance with configured concurrency
- Wrap note processing in limit() calls
- Return Promise.allSettled for all notes
- Collect successful and failed results

**Implementation**:

```typescript
import pLimit from 'p-limit';
import { EMBEDDING_CONFIG } from './config';

/**
 * Process notes concurrently with p-limit backpressure.
 *
 * @param notes - Array of note identifiers to process
 * @param processNote - Function that processes a single note
 * @returns Results with successful and failed notes
 */
export async function processNotesWithConcurrency(
  notes: string[],
  processNote: (note: string) => Promise<ProcessResult>
): Promise<BatchProcessResult> {
  // Create p-limit instance
  const limit = pLimit(EMBEDDING_CONFIG.CONCURRENCY);

  // Track progress
  let processedCount = 0;

  // Wrap each note in limit()
  const tasks = notes.map((note) =>
    limit(async () => {
      try {
        const result = await processNote(note);
        processedCount++;

        // Log memory usage periodically
        if (processedCount % EMBEDDING_CONFIG.MEMORY_LOG_INTERVAL === 0) {
          const mem = process.memoryUsage();
          logger.info({
            processed: processedCount,
            total: notes.length,
            heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
            rssMB: Math.round(mem.rss / 1024 / 1024),
          }, 'Embedding progress checkpoint');
        }

        return result;
      } catch (error) {
        logger.error({ note, error }, 'Note processing failed');
        return {
          note,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );

  // Wait for all notes to complete (or fail)
  const results = await Promise.allSettled(tasks);

  // Aggregate results
  const successful = results
    .filter((r): r is PromiseFulfilledResult<ProcessResult> => r.status === 'fulfilled' && r.value.success)
    .map((r) => r.value);

  const failed = results
    .filter((r): r is PromiseFulfilledResult<ProcessResult> =>
      (r.status === 'fulfilled' && !r.value.success) || r.status === 'rejected'
    )
    .map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : { note: 'unknown', success: false, error: String(r.reason) }
    );

  return {
    successful,
    failed,
    total: notes.length,
    successCount: successful.length,
    failureCount: failed.length,
  };
}

interface ProcessResult {
  note: string;
  success: boolean;
  error?: string;
  embeddingCount?: number;
}

interface BatchProcessResult {
  successful: ProcessResult[];
  failed: ProcessResult[];
  total: number;
  successCount: number;
  failureCount: number;
}
```

**File Location**: `apps/mcp/src/services/embedding/concurrency.ts`

---

### Component 3: Note Processing Pipeline

**Purpose**: Process individual notes with batch embedding and error handling.

**Responsibilities**:

- Read note content from database
- Chunk note text
- Generate batch embeddings for all chunks
- Store embeddings in database
- Handle errors gracefully (return failed result, don't throw)

**Implementation**:

```typescript
import { OllamaClient } from '../ollama/client';
import { chunkText } from './chunking';
import { storeChunkedEmbeddings } from '../../db/vectors';
import { readNote } from '../../db';

/**
 * Process a single note: read, chunk, embed, store.
 *
 * @param noteIdentifier - Note to process
 * @param ollamaClient - Ollama client for embeddings
 * @returns Process result with success/failure status
 */
export async function processNoteWithBatchEmbedding(
  noteIdentifier: string,
  ollamaClient: OllamaClient
): Promise<ProcessResult> {
  const startTime = Date.now();

  try {
    // Read note content
    const note = await readNote(noteIdentifier);
    if (!note) {
      return {
        note: noteIdentifier,
        success: false,
        error: 'Note not found',
      };
    }

    // Chunk note text
    const chunks = chunkText(note.content);

    if (chunks.length === 0) {
      return {
        note: noteIdentifier,
        success: true,
        embeddingCount: 0,
      };
    }

    // Handle large notes: split into sub-batches if needed
    const maxBatchSize = EMBEDDING_CONFIG.MAX_CHUNKS_PER_BATCH;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += maxBatchSize) {
      const chunkBatch = chunks.slice(i, i + maxBatchSize);
      const texts = chunkBatch.map(c => c.text);

      const embeddings = await ollamaClient.generateBatchEmbeddings(texts);
      allEmbeddings.push(...embeddings);
    }

    // Validate embedding count
    if (allEmbeddings.length !== chunks.length) {
      return {
        note: noteIdentifier,
        success: false,
        error: `Embedding count mismatch: expected ${chunks.length}, got ${allEmbeddings.length}`,
      };
    }

    // Map embeddings to chunks
    const chunkEmbeddings = chunks.map((chunk, i) => ({
      chunkIndex: chunk.chunkIndex,
      totalChunks: chunk.totalChunks,
      chunkStart: chunk.start,
      chunkEnd: chunk.end,
      chunkText: chunk.text,
      embedding: allEmbeddings[i],
    }));

    // Store in database
    await storeChunkedEmbeddings(noteIdentifier, chunkEmbeddings);

    const elapsed = Date.now() - startTime;
    logger.debug({
      note: noteIdentifier,
      chunks: chunks.length,
      elapsed,
    }, 'Note processed successfully');

    return {
      note: noteIdentifier,
      success: true,
      embeddingCount: chunks.length,
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error({
      note: noteIdentifier,
      elapsed,
      error,
    }, 'Note processing failed');

    return {
      note: noteIdentifier,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

**File Location**: `apps/mcp/src/services/embedding/processNote.ts`

---

### Component 4: Embed Tool Integration

**Purpose**: Integrate concurrency-controlled processing into embed tool.

**Current Implementation** (removed):

```typescript
// OLD: Sequential with artificial delays
for (const batch of batches) {
  for (const note of batch) {
    await processNote(note);
    await sleep(OLLAMA_REQUEST_DELAY_MS);
  }
  await sleep(BATCH_DELAY_MS);
}
```

**New Implementation**:

```typescript
import { processNotesWithConcurrency } from '../../services/embedding/concurrency';
import { processNoteWithBatchEmbedding } from '../../services/embedding/processNote';
import { OllamaClient } from '../../services/ollama/client';

export const embedTool = {
  async handler(args: EmbedArgs) {
    const notes = await getNotes(args.project, args.limit);
    const ollamaClient = new OllamaClient();

    logger.info({
      notes: notes.length,
      concurrency: EMBEDDING_CONFIG.CONCURRENCY,
    }, 'Starting concurrent embedding generation');

    // Process notes concurrently with p-limit
    const result = await processNotesWithConcurrency(
      notes,
      (note) => processNoteWithBatchEmbedding(note, ollamaClient)
    );

    // Report results
    logger.info({
      total: result.total,
      successful: result.successCount,
      failed: result.failureCount,
    }, 'Embedding generation complete');

    if (result.failed.length > 0) {
      logger.warn({
        failed: result.failed.map(f => ({ note: f.note, error: f.error })),
      }, 'Some notes failed to embed');
    }

    return {
      success: result.failureCount === 0,
      embedded: result.successCount,
      failed: result.failureCount,
    };
  },
};
```

**File Location**: `apps/mcp/src/tools/embed/index.ts`

---

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Concurrency library** | p-limit | Lightweight (4.3kB), zero dependencies, Bun compatible, queue-based backpressure |
| **Concurrency level** | Note-level, not chunk-level | Simpler error isolation, easier progress tracking, aligns with storage atomicity |
| **Default concurrency** | 4 simultaneous notes | Matches Ollama `OLLAMA_NUM_PARALLEL=4` default |
| **Failure handling** | Promise.allSettled | One note's failure doesn't block others, collect all results |
| **Progress tracking** | Log every 100 notes | Balance observability and log volume |
| **Memory monitoring** | Periodic heap/RSS logging | Detect memory leaks or pressure early |

## Security Considerations

- **Concurrency bounds**: Max 16 prevents unbounded parallelism
- **Batch size limits**: Max 32 chunks per batch prevents memory exhaustion
- **Error isolation**: Failed notes don't expose content in logs
- **Resource limits**: Concurrency tuned to match server capacity

## Testing Strategy

### Unit Tests

**File**: `apps/mcp/src/services/embedding/__tests__/concurrency.test.ts`

```typescript
describe("processNotesWithConcurrency", () => {
  it("should process notes concurrently with limit", async () => {
    const notes = ["note1", "note2", "note3", "note4", "note5"];
    const activeCount = { current: 0, max: 0 };

    const processNote = async (note: string) => {
      activeCount.current++;
      activeCount.max = Math.max(activeCount.max, activeCount.current);
      await sleep(10);
      activeCount.current--;
      return { note, success: true };
    };

    const result = await processNotesWithConcurrency(notes, processNote);

    expect(result.successCount).toBe(5);
    expect(activeCount.max).toBeLessThanOrEqual(EMBEDDING_CONFIG.CONCURRENCY);
  });

  it("should handle failures gracefully", async () => {
    const notes = ["note1", "note2", "note3"];
    const processNote = async (note: string) => {
      if (note === "note2") {
        throw new Error("Simulated failure");
      }
      return { note, success: true };
    };

    const result = await processNotesWithConcurrency(notes, processNote);

    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(1);
    expect(result.failed[0].note).toBe("note2");
  });
});
```

### Integration Tests

**File**: `apps/mcp/src/services/embedding/__tests__/integration.test.ts`

```typescript
describe("Concurrent Embedding Integration", () => {
  it("should process 100 notes concurrently", async () => {
    const notes = Array.from({ length: 100 }, (_, i) => `note-${i}`);
    const ollamaClient = new OllamaClient();

    const startTime = Date.now();
    const result = await processNotesWithConcurrency(
      notes,
      (note) => processNoteWithBatchEmbedding(note, ollamaClient)
    );
    const elapsed = Date.now() - startTime;

    expect(result.successCount).toBe(100);
    expect(elapsed).toBeLessThan(30000);  // Should complete in <30s with concurrency
  });
});
```

## Open Questions

- **Dynamic concurrency**: Should concurrency adjust based on Ollama server load? (No, keep simple)
- **Circuit breaker**: Should we pause on high failure rate? (P2, optional enhancement)
- **Progress events**: Should we emit progress events for UI? (Not needed for CLI, defer)
