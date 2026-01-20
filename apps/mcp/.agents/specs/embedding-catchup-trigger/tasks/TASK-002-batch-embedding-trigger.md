---
type: task
id: TASK-002
title: Implement batch embedding trigger
status: todo
priority: P0
complexity: S
estimate: 1h
related:
  - DESIGN-001
  - REQ-002
  - REQ-003a
  - REQ-003b
blocked_by:
  - TASK-001
blocks:
  - TASK-003
assignee: implementer
created: 2026-01-20
updated: 2026-01-20
author: spec-generator
tags:
  - batch-processing
  - fire-and-forget
---

# TASK-002: Implement Batch Embedding Trigger

## Design Context

- DESIGN-001: Bootstrap context catch-up trigger architecture

## Objective

Implement fire-and-forget batch embedding processor that reads note content and invokes existing `triggerEmbedding` infrastructure for each note.

## Scope

**In Scope**:

- Batch processing function accepting array of note permalinks
- Read note content from basic-memory
- Invoke `triggerEmbedding` for each note
- Structured logging for batch progress (REQ-003a, REQ-003b)

**Out of Scope**:

- Integration with bootstrap_context (TASK-003)
- Parallel processing (sequential only for simplicity)
- Retry logic (handled by existing triggerEmbedding)

## Acceptance Criteria

### Core Functionality

- [ ] Function `triggerBatchEmbeddings(noteIds: string[])` accepts array of permalinks
- [ ] Reads note content from basic-memory for each note
- [ ] Invokes `triggerEmbedding(noteId, content)` for each note
- [ ] Fire-and-forget pattern (does not await completion, does not throw)
- [ ] Handles read failures gracefully (skip note, continue batch)

### Logging Requirements (REQ-003a, REQ-003b)

Implement these log events with structured fields:

- [ ] Trigger event with count and project (REQ-003a)
  - `logger.info({ count: noteIds.length, project }, "Starting batch embedding catch-up")`
- [ ] Start event with timestamp (REQ-003a)
  - Captured by Promise chain start
- [ ] Progress updates per batch (REQ-003b)
  - `logger.debug({ total, processed, skipped }, "Batch processing stats")`
- [ ] Completion event with stats (REQ-003b)
  - `logger.info({ count: noteIds.length, processed, skipped, duration }, "Batch embedding catch-up complete")`
- [ ] Error event with failure details (REQ-003b)
  - `logger.warn({ count: noteIds.length, error }, "Batch embedding catch-up failed")`
- [ ] Individual note failures logged (REQ-003b)
  - `logger.warn({ noteId, error }, "Failed to read note for embedding")`

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/tools/bootstrap-context/catchupTrigger.ts` | Modify | Add triggerBatchEmbeddings function |

## Implementation Notes

**Batch Trigger Function**:

```typescript
import { getBasicMemoryClient } from "../../proxy/client";
import { triggerEmbedding } from "../../services/embedding/triggerEmbedding";
import { logger } from "../../utils/internal/logger";

export function triggerBatchEmbeddings(noteIds: string[], project: string): void {
  if (noteIds.length === 0) {
    return;
  }

  // REQ-003a: Trigger event logging
  logger.info(
    { count: noteIds.length, project },
    "Starting batch embedding catch-up"
  );

  processBatch(noteIds, project)
    .then((stats) => {
      // REQ-003b: Completion event logging
      logger.info(
        { count: noteIds.length, processed: stats.processed, skipped: stats.skipped, project },
        "Batch embedding catch-up complete"
      );
    })
    .catch((error) => {
      // REQ-003b: Error event logging
      logger.warn(
        { count: noteIds.length, error, project },
        "Batch embedding catch-up failed"
      );
    });
}

async function processBatch(noteIds: string[], project: string): Promise<{ processed: number; skipped: number }> {
  const client = await getBasicMemoryClient();
  let processed = 0;
  let skipped = 0;

  for (const noteId of noteIds) {
    try {
      const note = await client.readNote({ identifier: noteId });
      if (note?.content) {
        triggerEmbedding(noteId, note.content);
        processed++;
      } else {
        skipped++;
        logger.debug({ noteId, project }, "Note has no content, skipping");
      }
    } catch (error) {
      skipped++;
      // REQ-003b: Individual failure logging
      logger.warn({ noteId, error, project }, "Failed to read note for embedding");
    }
  }

  // REQ-003b: Progress logging
  logger.debug(
    { total: noteIds.length, processed, skipped, project },
    "Batch processing stats"
  );

  return { processed, skipped };
}
```

**Key Design Decisions**:

- **Sequential Processing**: Simple, predictable. Ollama handles rate limiting internally.
- **Skip on Read Failure**: Continue batch even if individual note read fails.
- **Fire-and-Forget triggerEmbedding**: Existing pattern handles retries and error logging.
- **Structured Logging**: All log events include project context for traceability.

## Testing Requirements

- [ ] Test invokes triggerEmbedding for each note with content
- [ ] Test skips notes without content
- [ ] Test continues batch when individual read fails
- [ ] Test logs batch start event (REQ-003a)
- [ ] Test logs batch completion event (REQ-003b)
- [ ] Test logs batch stats (processed/skipped counts) (REQ-003b)
- [ ] Test logs individual failures (REQ-003b)
- [ ] Test returns immediately (fire-and-forget)

## Dependencies

- TASK-001 (provides noteIds input)
- basic-memory client (`getBasicMemoryClient`, `readNote`)
- Existing `triggerEmbedding` service
- Logger utility
