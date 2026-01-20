# Test Report: Chunked Embeddings Implementation

**Date**: 2026-01-19
**Feature**: Chunked embeddings for long document support
**Tester**: QA Agent
**Status**: [BLOCKED]

## Objective

Validate the chunked embeddings implementation works correctly for:

1. TypeScript compilation
2. Database schema migration
3. Embedding generation with chunking
4. Semantic search with deduplication
5. Long note handling (>9000 chars)

## Approach

**Test Strategy**: Sequential validation following provided steps
**Environment**: Local development (macOS, Ollama, Brain MCP)
**Test Data**: Brain project notes (751 total)

## Results

### Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| TypeScript Compilation | 0 errors | 0 | [PASS] |
| Schema Migration | Success | Success | [PASS] |
| Embeddings Generated | 28 | 50 | [FAIL] |
| Search Results | 0 | >0 | [FAIL] |
| Long Notes Tested | 0 | >1 | [BLOCKED] |

### Test Results by Category

#### Compilation & Schema

| Test | Category | Status | Notes |
|------|----------|--------|-------|
| TypeScript compilation | Build | [PASS] | No errors |
| Schema migration | Database | [PASS] | Old table dropped, new schema created |
| Chunk metadata columns | Database | [PASS] | chunk_id, chunk_index, total_chunks, chunk_text present |

#### Embedding Generation

| Test | Category | Status | Notes |
|------|----------|--------|-------|
| Batch processing | Generation | [PARTIAL] | 21/50 processed, 29 failed |
| Chunk storage | Generation | [PASS] | Successfully stored with metadata |
| Error handling | Generation | [FAIL] | Ollama 500 errors block 58% of notes |

#### Search Functionality

| Test | Category | Status | Notes |
|------|----------|--------|-------|
| Semantic search basic | Search | [FAIL] | Returns zero results |
| Threshold handling | Search | [FAIL] | No results even at threshold 0.01 |
| Deduplication | Search | [UNTESTED] | Cannot test without working search |

## Discussion

### Risk Areas

| Area | Risk Level | Rationale |
|------|------------|-----------|
| Semantic search | Critical | SQL bug makes feature completely non-functional |
| Ollama stability | High | 58% failure rate blocks full validation |
| Chunking logic | Low | Code appears correct, but untested with long notes |

### Coverage Gaps

| Gap | Reason | Priority |
|-----|--------|----------|
| Long note chunking | No long notes embedded successfully | P0 |
| Multi-chunk deduplication | Need working search + long notes | P0 |
| Chunk boundary handling | No long notes to test | P1 |
| Performance with chunks | Need larger corpus | P2 |

## Issues Found

### P0: Semantic Search SQL Bug (BLOCKING)

**Location**: `apps/mcp/src/db/vectors.ts:213-226`
**Type**: Implementation bug
**Severity**: P0 - Critical

**Description**: The `semanticSearchChunked` function uses a SQL query that references a SELECT clause alias in the WHERE clause, which is invalid SQL.

**Failing Query**:

```typescript
SELECT
  chunk_id,
  entity_id,
  vec_distance_cosine(embedding, ?) as distance
FROM brain_embeddings
WHERE distance <= ?  -- ❌ Cannot reference alias
```

**Evidence**:

1. Direct SQL test confirms WHERE clause with alias returns zero results
2. Same query without WHERE returns expected results
3. COUNT(*) with inline calculation works

**Impact**:

- Semantic search returns zero results for all queries
- Feature is completely non-functional
- Blocks validation of deduplication and chunking

**Recommended Fix**:

```typescript
// Option 1: Inline calculation (simpler, performs duplicate calculation)
const rows = db.query(`
  SELECT
    chunk_id,
    entity_id,
    chunk_index,
    total_chunks,
    chunk_text,
    vec_distance_cosine(embedding, ?) as distance
  FROM brain_embeddings
  WHERE vec_distance_cosine(embedding, ?) <= ?
  ORDER BY distance ASC
  LIMIT ?
`).all(embeddingArr, embeddingArr, maxDistance, limit);

// Option 2: Subquery (cleaner SQL, may have performance overhead)
const rows = db.query(`
  SELECT * FROM (
    SELECT
      chunk_id,
      entity_id,
      chunk_index,
      total_chunks,
      chunk_text,
      vec_distance_cosine(embedding, ?) as distance
    FROM brain_embeddings
  )
  WHERE distance <= ?
  ORDER BY distance ASC
  LIMIT ?
`).all(embeddingArr, maxDistance, limit);
```

**Testing Required**:

- Unit test for `semanticSearchChunked` with known embeddings
- Integration test for search tool end-to-end
- Performance test to compare Option 1 vs Option 2

### P1: Ollama 500 Errors During Batch Processing

**Scope**: Affects 58% of notes (29/50 in test batch)
**Type**: Integration issue
**Severity**: P1 - High

**Description**: Consistent Ollama API 500 errors during batch embedding generation prevent full validation.

**Evidence**:

- Direct Ollama API test succeeds (single embedding generation works)
- Batch processing shows 58% failure rate
- Not correlated with note length (both short and long notes fail)
- Ollama is running and responding to health checks

**Symptoms**:

```
Errors:
  - decisions/adr-0001-mode-management: Ollama API error: 500
  - decisions/adr-0002-brain-semantic: Ollama API error: 500
  - critique/adr-015-debate-log-round-1: Ollama API error: 500
```

**Possible Causes**:

1. Rate limiting: 100ms delay between calls insufficient
2. Resource exhaustion: Ollama running out of memory during batch
3. Request payload issues: Certain content triggers errors
4. Model loading issues: Model unloading/reloading between requests

**Recommended Investigation**:

1. Check Ollama server logs for specific error details
2. Increase delay between requests (test 500ms, 1000ms)
3. Reduce batch size (test with BATCH_SIZE=10 instead of 50)
4. Test with individual failing notes to isolate payload issues
5. Monitor Ollama memory usage during batch processing

**Impact**:

- Cannot generate embeddings for 58% of corpus
- Blocks validation of chunking for long notes
- Reduces test coverage significantly

### P2: Unable to Validate Long Note Chunking

**Reason**: No long notes successfully embedded
**Type**: Coverage gap
**Severity**: P2 - Medium

**Description**: All 28 successfully embedded notes are single-chunk. Cannot verify chunking works correctly for notes exceeding 2000 characters.

**Evidence**:

```
Top 10 notes by chunk count:
  - specs/active-project-selection-design: 1 chunks (total: 1)
  - research/ai-cli-auto-context: 1 chunks (total: 1)
  ...all single chunk...
```

**Impact**:

- Primary feature (chunking for long documents) not validated
- Cannot test deduplication across multiple chunks
- Cannot verify chunk boundary handling

**Dependency**: Blocked by P1 (Ollama errors)

**Recommended Next Steps**:

1. Fix P0 and P1
2. Identify notes >2000 chars in corpus
3. Target embedding generation on long notes specifically
4. Verify chunk_index, total_chunks metadata correct
5. Test search returns appropriate chunk snippets

## Recommendations

### Immediate Actions (Block PR/Deployment)

1. **Fix semantic search SQL bug (P0)**
   - Implement one of the recommended query rewrites
   - Add unit test for `semanticSearchChunked`
   - Add integration test for search tool
   - Verify fix with direct SQL testing

2. **Investigate Ollama 500 errors (P1)**
   - Capture Ollama server logs during failure
   - Test with increased delays and smaller batches
   - Isolate failing notes for payload analysis

3. **Add test coverage**
   - Unit tests for chunking functions
   - Integration tests for semantic search
   - Mock Ollama responses for reliable CI testing

### Follow-Up Actions (After P0/P1 Fixed)

1. **Validate chunking thoroughly**
   - Generate embeddings for all notes
   - Verify long notes produce multiple chunks
   - Test deduplication with multi-chunk notes
   - Validate chunk boundaries and overlaps

2. **Performance testing**
   - Benchmark query performance with subquery vs inline
   - Test search latency with larger corpus
   - Verify deduplication performance

3. **Documentation**
   - Update README with chunking details
   - Document schema migration process
   - Add troubleshooting guide for Ollama issues

## Verdict

**Status**: [BLOCKED]
**Confidence**: High
**Rationale**:

The chunking implementation code appears structurally sound (TypeScript compiles, schema migrated successfully, storage functions work), but critical bugs prevent functional validation:

1. **P0 semantic search bug** completely blocks search functionality
2. **P1 Ollama errors** prevent embedding generation coverage
3. **P2 no long notes** prevents validating the primary feature (chunking)

Cannot approve for merge until P0 is fixed and validated. P1 should be investigated before claiming feature complete. P2 is blocked by P1.

## Artifacts

- Session log: `.agents/sessions/2026-01-19-session-12-chunked-embeddings-validation.md`
- Migration script: `apps/mcp/migrate-embeddings.ts`
- Test scripts: `apps/mcp/test-search.ts`, `apps/mcp/debug-search.ts`, etc.
- Database: `~/.basic-memory/memory.db` (brain_embeddings table)
