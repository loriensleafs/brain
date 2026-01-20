---
type: design
id: DESIGN-001
title: Bootstrap context catch-up trigger architecture
status: implemented
priority: P0
related:
  - REQ-001
  - REQ-002
  - REQ-003a
  - REQ-003b
adr: null
created: 2026-01-20
updated: 2026-01-20
author: spec-generator
tags:
  - embeddings
  - bootstrap-context
  - architecture
---

# DESIGN-001: Bootstrap Context Catch-up Trigger Architecture

## Requirements Addressed

- REQ-001: Missing embedding detection on session start
- REQ-002: Asynchronous catch-up processing trigger
- REQ-003a: Log catch-up trigger events
- REQ-003b: Log catch-up completion events

## Design Overview

Add automatic embedding catch-up to bootstrap_context tool using fire-and-forget pattern. When user starts a session, system queries for notes lacking embeddings and triggers background processing if any found.

**Key Design Decisions**:

1. **Query Strategy**: Two-phase check (count first, then full query)
2. **Integration Point**: End of bootstrap_context after context building
3. **Processing Pattern**: Reuse existing triggerEmbedding infrastructure
4. **Error Handling**: Non-blocking (log warnings, do not throw)
5. **Observability**: Structured logging for trigger and completion events

## Component Architecture

### Component 1: Missing Embeddings Query

**Purpose**: Identify notes in basic-memory lacking brain_embeddings entries

**Responsibilities**:

- Query basic-memory for all note permalinks
- Query brain_embeddings for existing entity_ids
- Return set difference (notes without embeddings)
- Optimize for zero-result case (count check first)

**Interface**:

```typescript
async function findNotesWithoutEmbeddings(
  project: string
): Promise<string[]> {
  // 1. Query basic-memory for all notes
  // 2. Query brain_embeddings for entity_ids
  // 3. Return notes missing from embeddings
}
```

**Performance Optimization**:

```typescript
// Phase 1: Count check (fast path)
const embeddingCount = db.query("SELECT COUNT(*) FROM brain_embeddings").get();
if (embeddingCount === 0) {
  // No embeddings at all - return early or process all notes
}

// Phase 2: Full query only if needed
```

**Logging** (REQ-003a):

```typescript
logger.debug({ project, count: missingNotes.length, queryTime }, "Missing embeddings query complete");
```

### Component 2: Catch-up Trigger

**Purpose**: Fire-and-forget batch embedding processing

**Responsibilities**:

- Accept array of note permalinks
- Read note content from basic-memory
- Invoke existing triggerEmbedding for each note
- Log progress and failures (REQ-003a, REQ-003b)

**Interface**:

```typescript
function triggerBatchEmbeddings(noteIds: string[], project: string): void {
  // Fire-and-forget Promise chain
  processBatch(noteIds, project)
    .then(stats => logger.info({ processed: stats.processed, failed: stats.failed, project }))
    .catch(error => logger.warn({ error, project }, "Batch embedding failed"));
}
```

**Reuse Pattern**: Leverage existing `triggerEmbedding` for individual notes

```typescript
async function processBatch(noteIds: string[], project: string): Promise<{ processed: number; skipped: number }> {
  for (const noteId of noteIds) {
    const content = await readNoteContent(noteId); // basic-memory
    triggerEmbedding(noteId, content); // Existing fire-and-forget
  }
}
```

**Logging Events** (REQ-003a, REQ-003b):

- **Trigger** (REQ-003a): `logger.info({ count, project }, "Starting batch embedding catch-up")`
- **Progress** (REQ-003b): `logger.debug({ total, processed, skipped, project }, "Batch processing stats")`
- **Completion** (REQ-003b): `logger.info({ count, processed, skipped, project }, "Batch embedding catch-up complete")`
- **Error** (REQ-003b): `logger.warn({ count, error, project }, "Batch embedding catch-up failed")`
- **Individual Failures** (REQ-003b): `logger.warn({ noteId, error, project }, "Failed to read note for embedding")`

### Component 3: Bootstrap Context Integration

**Purpose**: Hook catch-up trigger into session start

**Modification Location**: `src/tools/bootstrap-context/index.ts`

**Integration Point**: After context building, before return

```typescript
// Existing context building...
const structuredContent = buildStructuredOutput({ ... });
setCachedContext(cacheOptions, structuredContent);

// NEW: Trigger catch-up if needed (fire-and-forget)
triggerCatchUpIfNeeded(project);

// Return immediately (do not await catch-up)
return { content: [...] };
```

**Implementation**:

```typescript
function triggerCatchUpIfNeeded(project: string): void {
  findNotesWithoutEmbeddings(project)
    .then(missingNotes => {
      if (missingNotes.length > 0) {
        // REQ-003a: Trigger event logging
        logger.info({ project, count: missingNotes.length }, "Triggering embedding catch-up");
        triggerBatchEmbeddings(missingNotes, project);
      } else {
        logger.debug({ project }, "No missing embeddings, skipping catch-up");
      }
    })
    .catch(error => {
      logger.warn({ project, error }, "Catch-up query failed");
    });
}
```

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Query approach | Two-phase (count then full) | Optimize for zero-result case |
| Integration point | End of bootstrap_context | After context built, before return |
| Processing pattern | Reuse triggerEmbedding | Proven fire-and-forget pattern |
| Error handling | Non-blocking (log only) | Session start must never fail |
| Batch processing | Sequential (no parallelism) | Simple, predictable, Ollama handles rate limiting |
| Logging strategy | Structured events with context | Enables programmatic analysis and debugging |

## Security Considerations

- Query limited to project scope (no cross-project access)
- basic-memory client already authenticated (no new attack surface)
- Fire-and-forget prevents DOS via long-running requests

## Testing Strategy

**Unit Tests**:

- `findNotesWithoutEmbeddings` returns correct set difference
- Count optimization prevents unnecessary full query
- `triggerBatchEmbeddings` invokes triggerEmbedding for each note
- Error handling logs warnings without throwing
- **Logging tests** (REQ-003a, REQ-003b):
  - Trigger event logged when catch-up starts
  - Completion event logged when batch finishes
  - Error event logged when batch fails
  - Individual failure events logged for each failed note

**Integration Tests**:

- bootstrap_context returns without blocking on catch-up
- Catch-up trigger fires when missing embeddings detected
- Catch-up does not fire when all notes have embeddings
- Catch-up failure does not cause bootstrap_context failure

**Performance Tests**:

- Query overhead < 100ms for typical project (100-500 notes)
- bootstrap_context response time unchanged when no missing embeddings

## Open Questions

None. Design is straightforward reuse of existing patterns.

## Implementation Notes

**File Changes**:

1. `src/tools/bootstrap-context/index.ts` - Add triggerCatchUpIfNeeded call
2. `src/tools/bootstrap-context/catchupTrigger.ts` - New file with findNotesWithoutEmbeddings and triggerBatchEmbeddings
3. `src/tools/bootstrap-context/__tests__/catchupTrigger.test.ts` - New test file

**Estimated Effort**: 4 hours

- Query implementation: 1 hour
- Batch trigger implementation: 1 hour
- Integration: 0.5 hours
- Tests: 1.5 hours
