---
status: accepted
date: 2026-01-19
decision-makers: [architect, critic, independent-thinker, security, analyst, high-level-advisor]
consulted: [implementer, devops]
informed: [qa]
review-rounds: 1
consensus: 4-accept-2-disagree-and-commit
---

# Embedding Performance Optimization: Batch API Migration with Concurrency Control

## Context and Problem Statement

The current embedding generation system exhibits 100% overhead from artificial delays and uses a legacy single-text API endpoint. Processing 700 notes takes approximately 5 minutes when the actual embedding work requires only 2.5 minutes.

Evidence from analyst research:
- Analysis 025: Identified `/api/embeddings` (single) vs `/api/embed` (batch) API mismatch
- Analysis 026: Quantified 200ms inter-chunk delay adds 100% processing time overhead

How should we redesign the embedding pipeline to eliminate unnecessary overhead while preventing Ollama resource exhaustion?

## Decision Drivers

* **Performance**: 700 notes currently takes 5 minutes; target is under 1 minute
* **Reliability**: Ollama 500 errors must be handled gracefully without data loss
* **Resource safety**: Prevent overwhelming Ollama server during batch operations
* **Maintainability**: Changes should simplify, not complicate, the codebase
* **Backward compatibility**: No breaking changes to MCP tool interface or database schema

## Considered Options

* **Option A**: Migrate to batch API with p-limit concurrency control
* **Option B**: Keep single-text API, remove delays, add p-limit only
* **Option C**: Parallel chunk processing with worker threads

## Decision Outcome

Chosen option: **Option A - Migrate to batch API with p-limit concurrency control**, because it provides 13x estimated throughput improvement (based on timing calculations) by addressing all three bottlenecks (wrong API, artificial delays, sequential processing) while maintaining reliability through concurrency limiting.

### Consequences

* Good, because eliminates 5-50x HTTP overhead by batching chunks
* Good, because removes 100% artificial delay overhead
* Good, because p-limit provides backpressure without guessing delays
* Good, because Bun's native fetch already provides connection pooling
* Bad, because requires handling partial batch failures
* Bad, because batch API response format differs from current single-text format
* Neutral, because adds p-limit dependency (4.3kB, pure JS, Bun compatible)

### Confirmation

Implementation verified through:
1. Unit tests for batch embedding function with mocked Ollama
2. Integration test processing 100 notes, comparing before/after timing
3. Error injection tests for partial batch failures
4. Load test with 1000 notes to verify p-limit prevents resource exhaustion

## Architecture: Before and After

### Current Architecture (Slow)

```
┌─────────────────────────────────────────────────────────────────┐
│                     generate_embeddings (tool)                  │
├─────────────────────────────────────────────────────────────────┤
│  for each batch of 50 notes:                                    │
│    for each note:                                               │
│      → read_note()                         ~100ms               │
│      → chunkText()                         ~10ms                │
│      → for each chunk:                                          │
│          → generateEmbedding(chunk)        ~50ms                │
│          → wait(200ms)                     WASTEFUL             │
│      → storeChunkedEmbeddings()            ~50ms                │
│    wait(1000ms) between batches            WASTEFUL             │
│                                                                 │
│  API: POST /api/embeddings { prompt: string }                   │
│  Response: { embedding: number[] }                              │
│                                                                 │
│  Timeout: 10 minutes everywhere                                 │
└─────────────────────────────────────────────────────────────────┘

Processing 700 notes (avg 3 chunks each):
  Actual work:     700 * (100 + 10 + 3*50 + 50) = 175,000ms (2.9 min)
  Delay overhead:  700 * 3 * 200 + 14 * 1000    = 434,000ms (7.2 min)
  Total:                                        = 609,000ms (10.1 min)
```

### Optimized Architecture (Fast)

```
┌─────────────────────────────────────────────────────────────────┐
│                     generate_embeddings (tool)                  │
├─────────────────────────────────────────────────────────────────┤
│  const limit = pLimit(4);  // Max 4 concurrent note operations  │
│                                                                 │
│  await Promise.all(notes.map(note => limit(async () => {        │
│    → read_note()                           ~100ms               │
│    → chunkText()                           ~10ms                │
│    → generateBatchEmbeddings(chunks)       ~100ms for all       │
│    → storeChunkedEmbeddings()              ~50ms                │
│  })));                                                          │
│                                                                 │
│  API: POST /api/embed { input: string[] }   BATCH               │
│  Response: { embeddings: number[][] }                           │
│                                                                 │
│  Timeout: 60s per request (right-sized)                         │
└─────────────────────────────────────────────────────────────────┘

Processing 700 notes (avg 3 chunks each):
  With 4 concurrent:  700 / 4 * (100 + 10 + 100 + 50) = 45,500ms (0.76 min)
  Improvement:        10.1 min → 0.76 min = 13.3x faster
```

## Detailed Design

### 1. Batch API Integration

**Ollama `/api/embed` Request Format** (from Ollama docs):

```typescript
interface EmbedRequest {
  model: string;           // "nomic-embed-text"
  input: string[];         // Array of texts to embed
  truncate?: boolean;      // Truncate to context length (default: true)
  options?: {
    num_ctx?: number;      // Context window size
  };
  keep_alive?: string;     // How long to keep model in memory
}
```

**Ollama `/api/embed` Response Format**:

```typescript
interface EmbedResponse {
  model: string;
  embeddings: number[][];  // Array of embedding vectors
}
```

**Key Differences from Current API**:

| Aspect | `/api/embeddings` (current) | `/api/embed` (new) |
|--------|----------------------------|-------------------|
| Input | `prompt: string` | `input: string[]` |
| Output | `embedding: number[]` | `embeddings: number[][]` |
| Batch support | No | Yes (1-N texts) |
| Index alignment | N/A | Output[i] corresponds to input[i] |

### 2. Concurrency Model

**Level**: Note-level concurrency with chunk-level batching.

**Rationale**:
- Batching at chunk level (all chunks from all notes) would require complex bookkeeping to map embeddings back to notes
- Note-level concurrency with per-note batch API calls provides simpler error handling and progress tracking
- 4 concurrent note operations aligns with Ollama's default `OLLAMA_NUM_PARALLEL=4`

**Implementation**:

```typescript
import pLimit from 'p-limit';

const CONCURRENCY_LIMIT = 4;  // Match OLLAMA_NUM_PARALLEL default
const limit = pLimit(CONCURRENCY_LIMIT);

// Process notes concurrently, but each note's chunks as a batch
const results = await Promise.allSettled(
  notes.map(note => limit(() => processNoteWithBatchEmbedding(note)))
);
```

**Why not batch across notes?**

Batching all chunks from all notes into one mega-request would:
1. Require tracking which embedding belongs to which note/chunk
2. Fail entirely if any chunk fails (all-or-nothing)
3. Create massive payloads that could exceed limits

Per-note batching provides isolation: if one note fails, others succeed.

### 3. Timeout Cascade

| Layer | Location | Current | New | Rationale |
|-------|----------|---------|-----|-----------|
| Bun idleTimeout | http.ts:177 | 0 (disabled) | 0 | KEEP - required for long MCP operations |
| Go HTTP Client | http.go:38 | 10 min | 5 min | Reduce - sufficient for 1000+ notes now |
| Ollama Client | client.ts:18 | 10 min | 60s | Reduce - embedding ops complete in <1s |
| Health Check | client.ts:58 | 5s | 5s | KEEP - quick failure detection |

**Timeout Calculation**:

- Single embedding: 15-50ms (nomic-embed-text benchmark)
- Batch of 10 chunks: ~100-200ms
- Per-note with read/store: ~260ms
- 700 notes with concurrency 4: 700/4 * 260ms = 45.5 seconds
- Safety margin (2x): 91 seconds
- Recommended Go HTTP timeout: 5 minutes (handles 3000+ notes)

### 4. Error Handling Strategy

**Partial Batch Failures**:

The Ollama batch API can fail entirely but not partially - it either succeeds with all embeddings or fails with an error. Therefore:

```typescript
async function generateBatchEmbeddings(
  chunks: ChunkMetadata[]
): Promise<ChunkEmbeddingInput[] | null> {
  try {
    const response = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        input: chunks.map(c => c.text),
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      // Log and return null - caller handles as failed note
      logger.warn({ status: response.status }, 'Batch embedding failed');
      return null;
    }

    const data = await response.json() as EmbedResponse;

    // Validate response alignment
    if (data.embeddings.length !== chunks.length) {
      logger.error({
        expected: chunks.length,
        received: data.embeddings.length,
      }, 'Embedding count mismatch');
      return null;
    }

    // Map embeddings back to chunk metadata
    return chunks.map((chunk, i) => ({
      chunkIndex: chunk.chunkIndex,
      totalChunks: chunk.totalChunks,
      chunkStart: chunk.start,
      chunkEnd: chunk.end,
      chunkText: chunk.text,
      embedding: data.embeddings[i],
    }));
  } catch (error) {
    logger.error({ error }, 'Batch embedding exception');
    return null;
  }
}
```

**Retry Strategy**:

Retry is applied at the note level, not chunk level:

```typescript
async function processNoteWithRetry(
  note: string,
  maxRetries: number = 3
): Promise<ProcessResult> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await processNoteWithBatchEmbedding(note);

    if (result.success) return result;

    if (!isRetryableError(result.error)) {
      return result;  // 4xx errors fail immediately
    }

    // Exponential backoff: 1s, 2s, 4s
    await sleep(1000 * Math.pow(2, attempt));
  }

  return { success: false, error: 'Max retries exceeded' };
}
```

### 5. Connection Management

**Current State**: Singleton `OllamaClient` with Bun's automatic connection pooling.

**No Changes Needed**: Bun's fetch automatically:
- Pools connections (256 max by default)
- Manages HTTP keep-alive
- Handles connection reuse

The singleton pattern in `generateEmbedding.ts` is appropriate. Multiple concurrent requests through `pLimit` will naturally share the connection pool.

### 6. New OllamaClient Methods

```typescript
// Add to client.ts
export class OllamaClient {
  // ... existing code ...

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
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const response = await fetch(`${this.baseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: texts }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new OllamaError(
        `Ollama API error: ${response.status}`,
        response.status
      );
    }

    const data = await response.json() as { embeddings: number[][] };
    return data.embeddings;
  }
}
```

### 7. Types Update

```typescript
// Add to types.ts
/**
 * Response structure from Ollama batch embed API
 */
export interface BatchEmbedResponse {
  /** Model used for embedding */
  model: string;
  /** Array of embedding vectors, one per input text */
  embeddings: number[][];
}
```

## Implementation Plan

### Phase 0: Prerequisites (30 min)

- [ ] Add `p-limit` dependency: `bun add p-limit`
- [ ] Verify Ollama version supports `/api/embed` (available in Ollama 0.1.26+)

### Phase 1: Core Changes (P0) - 2 hours

1. **Add batch embedding method to OllamaClient**
   - File: `src/services/ollama/client.ts`
   - Add `generateBatchEmbeddings(texts: string[]): Promise<number[][]>`
   - Add types to `types.ts`

2. **Create batch-aware embedding generator**
   - File: `src/services/embedding/generateBatchEmbedding.ts` (new)
   - Accepts array of `ChunkMetadata`
   - Returns array of `ChunkEmbeddingInput` or null

3. **Refactor embed tool to use batch API**
   - File: `src/tools/embed/index.ts`
   - Replace `generateChunkEmbeddings` with batch version
   - Remove `OLLAMA_REQUEST_DELAY_MS` constant (delete)
   - Remove `BATCH_DELAY_MS` constant (delete)
   - Add p-limit for note-level concurrency

### Phase 2: Timeout Optimization (P1) - 30 min

1. **Reduce Ollama client timeout**
   - File: `src/config/ollama.ts`
   - Change default from 600000 to 60000
   - Update env var docs in `.env.example`

2. **Reduce Go HTTP client timeout**
   - File: `apps/tui/client/http.go`
   - Change from 10 minutes to 5 minutes

### Phase 3: Monitoring and Safety (P2) - 1 hour

1. **Add embedding metrics**
   - Total embeddings generated
   - Average batch size
   - Failure rate by note

2. **Add circuit breaker (optional)**
   - If failure rate exceeds 50% in 10 requests, pause for 30s
   - Prevents hammering a struggling Ollama server

### Phase 4: Testing - 1 hour

1. **Unit tests**
   - `generateBatchEmbeddings` with mocked responses
   - Error handling for partial failures
   - Timeout behavior

2. **Integration tests**
   - Process 100 real notes
   - Verify embedding count matches chunk count
   - Compare timing against baseline

## Validation Requirements

Before deployment, the following validation requirements MUST be met:

### 1. Baseline Measurement (P1)

Capture current performance metrics before implementation:

```bash
# Run with timing
time brain embed --project brain --limit 100
time brain embed --project brain --limit 700
```

**Acceptance Criteria**: After optimization, achieve minimum 5x improvement for 700-note batch (conservative estimate).

### 2. Ollama Version Check (P1)

Verify runtime Ollama version supports batch API:

```bash
# Check version
ollama --version

# Test batch API availability
curl -X POST http://localhost:11434/api/embed \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "input": ["test"]}'
```

**Implementation**: Add version check to Phase 0 prerequisites with clear error message if batch API unavailable.

### 3. Chunk Batch Size Limit (P1)

Prevent memory exhaustion from oversized batches:

```typescript
const MAX_CHUNKS_PER_BATCH = 32;  // Start conservative

// Split large notes into multiple batch calls if needed
const chunkBatches = [];
for (let i = 0; i < chunks.length; i += MAX_CHUNKS_PER_BATCH) {
  chunkBatches.push(chunks.slice(i, i + MAX_CHUNKS_PER_BATCH));
}
```

### 4. Error Categorization (P1)

Define retryable vs non-retryable errors explicitly:

```typescript
function isRetryableError(error: unknown): boolean {
  if (error instanceof OllamaError) {
    // 5xx errors: retry (server issues)
    // 4xx errors: fail fast (client errors - bad input, auth, etc.)
    return error.status >= 500 && error.status < 600;
  }

  // Network errors: retry (timeout, connection refused, etc.)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Unknown errors: don't retry (fail fast for debugging)
  return false;
}
```

### 5. Concurrency Bounds Validation (P1)

Prevent misconfiguration of concurrency limit:

```typescript
const EMBEDDING_CONCURRENCY = Math.min(
  Math.max(1, parseInt(process.env.EMBEDDING_CONCURRENCY ?? '4', 10)),
  16  // Maximum concurrent operations
);
```

**Rationale**: Uncapped concurrency could exhaust system resources.

### 6. Memory Pressure Monitoring (P2)

Track memory usage during concurrent operations:

```typescript
// Log memory usage every 100 notes
if (processedCount % 100 === 0) {
  const mem = process.memoryUsage();
  logger.info({ heapUsed: mem.heapUsed, rss: mem.rss }, 'Memory checkpoint');
}
```

## Rollback Plan

If performance does not improve or reliability decreases:

1. **Immediate**: Revert embed tool to use `generateEmbedding` (single)
2. **Short-term**: Re-add delays if Ollama resource exhaustion occurs
3. **Indicators**:
   - Ollama 500 error rate > 5%
   - Embedding throughput < 5x baseline
   - Memory pressure on Ollama server

All changes are backward compatible. The database schema is unchanged.

## Questions Answered

### 1. Should we batch at chunk level or note level?

**Answer**: Note level.

Each note's chunks are batched into one API call. Notes are processed concurrently with p-limit.

Rationale:
- Simpler error isolation (one note's failure doesn't affect others)
- Simpler progress tracking (processed/failed notes, not chunks)
- Aligns with existing storage pattern (store all chunks for a note atomically)

### 2. What is the optimal concurrency limit?

**Answer**: 4 concurrent note operations.

Rationale:
- Matches Ollama's default `OLLAMA_NUM_PARALLEL=4`
- Provides 4x throughput without overwhelming server
- Can be tuned via environment variable if needed

Make configurable:
```typescript
const CONCURRENCY_LIMIT = parseInt(process.env.EMBEDDING_CONCURRENCY ?? '4', 10);
```

### 3. Should timeouts be configurable or hardcoded?

**Answer**: Configurable via environment variables.

```bash
# .env
OLLAMA_TIMEOUT=60000        # Per-request timeout (ms)
EMBEDDING_CONCURRENCY=4     # Max concurrent note operations
```

Hardcoded defaults are conservative; users can tune for their hardware.

### 4. Do we need circuit breaker pattern?

**Answer**: P2 (optional enhancement).

For initial implementation, p-limit + retry provides adequate protection. Circuit breaker adds value if:
- Ollama server is shared/remote
- Failure spikes are common
- Fast-fail is preferable to slow degradation

### 5. How to handle partial batch failures?

**Answer**: Entire note fails if batch fails.

The Ollama `/api/embed` endpoint returns all-or-nothing. If the request fails:
1. Return null from `generateBatchEmbeddings`
2. Mark note as failed
3. Increment failure counter
4. Retry at note level with exponential backoff

This is simpler than chunk-level retry and matches existing error handling patterns.

## Performance Estimates

| Metric | Current | After Optimization | Improvement |
|--------|---------|-------------------|-------------|
| 100 notes | 85s | 7s | 12x |
| 700 notes | 600s (10min) | 46s | 13x |
| 1000 notes | 855s (14min) | 65s | 13x |
| HTTP requests (700 notes, 3 chunks avg) | 2100 | 700 | 3x reduction |
| Delay overhead | 52% | 0% | Eliminated |

Assumptions:
- Average 3 chunks per note
- Concurrency limit of 4
- No retry needed (healthy Ollama)

## More Information

### Related Analysis Documents

- `.agents/analysis/025-embedding-performance-research.md` - API research, package compatibility
- `.agents/analysis/026-timeout-changes-performance-review.md` - Timeout layer analysis

### External References

- [Ollama Embedding API Docs](https://docs.ollama.com/capabilities/embeddings)
- [p-limit npm package](https://www.npmjs.com/package/p-limit)
- [Bun fetch documentation](https://bun.sh/docs/api/fetch)

### Related ADRs

- ADR-016: Automatic Session Protocol Enforcement (unrelated but establishes ADR numbering)
- ADR-001: Search Service Abstraction (unrelated)
