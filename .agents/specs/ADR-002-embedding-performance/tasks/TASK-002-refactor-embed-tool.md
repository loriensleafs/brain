---
type: task
id: TASK-002
title: Refactor embed tool to use batch API
status: todo
priority: P0
complexity: M
estimate: 3h
related:
  - DESIGN-001
  - DESIGN-002
  - REQ-001
  - REQ-002
blocked_by:
  - TASK-001
blocks:
  - TASK-005
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
author: spec-generator
tags:
  - embed-tool
  - batch-api
  - refactoring
---

# TASK-002: Refactor Embed Tool to Use Batch API

## Design Context

- DESIGN-001: Ollama client batch API integration
- DESIGN-002: p-limit concurrency control architecture

## Objective

Refactor the embed tool to use the new `generateBatchEmbeddings` method instead of sequential single-text calls, eliminating artificial delays and enabling concurrent processing.

## Scope

**In Scope**:
- Replace sequential `generateEmbedding` calls with `generateBatchEmbeddings`
- Remove OLLAMA_REQUEST_DELAY_MS constant and all delay logic
- Remove BATCH_DELAY_MS constant and all batch delay logic
- Integrate `processNotesWithConcurrency` from DESIGN-002
- Update note processing to use `processNoteWithBatchEmbedding`
- Add progress logging every 100 notes
- Add result aggregation (successful/failed notes)
- Update tool response format

**Out of Scope**:
- p-limit integration implementation (provided by DESIGN-002 code)
- Timeout configuration (handled in TASK-004)
- Chunk batch size limits (provided by DESIGN-002 config)
- Unit tests (handled in TASK-005)

## Acceptance Criteria

- [ ] File `apps/mcp/src/tools/embed/index.ts` refactored
- [ ] Sequential processing loop removed
- [ ] OLLAMA_REQUEST_DELAY_MS constant deleted
- [ ] BATCH_DELAY_MS constant deleted
- [ ] All `await sleep()` calls removed
- [ ] Import `processNotesWithConcurrency` from `services/embedding/concurrency`
- [ ] Import `processNoteWithBatchEmbedding` from `services/embedding/processNote`
- [ ] Tool handler uses concurrent processing: `await processNotesWithConcurrency(notes, processNote)`
- [ ] Progress logging included: concurrency config, note count
- [ ] Result logging included: total, successful, failed
- [ ] Failed notes logged with error details
- [ ] Tool response includes: `{ success: boolean, embedded: number, failed: number }`
- [ ] TypeScript compilation succeeds
- [ ] No linting errors

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/src/tools/embed/index.ts` | Modify | Refactor to use batch API and concurrency |
| `apps/mcp/src/services/embedding/concurrency.ts` | Create | Concurrency control logic (from DESIGN-002) |
| `apps/mcp/src/services/embedding/processNote.ts` | Create | Note processing pipeline (from DESIGN-002) |
| `apps/mcp/src/services/embedding/config.ts` | Create | Embedding configuration (from DESIGN-002) |

## Implementation Notes

### Step 1: Create Supporting Files

Create the three new files from DESIGN-002:

1. **config.ts**: EMBEDDING_CONFIG with concurrency, batch size, memory logging
2. **concurrency.ts**: processNotesWithConcurrency with p-limit integration
3. **processNote.ts**: processNoteWithBatchEmbedding with batch API usage

These files provide the infrastructure for the embed tool refactor.

### Step 2: Refactor Embed Tool

**Current Implementation (Remove)**:
```typescript
// OLD: Sequential with delays
for (const batch of batches) {
  for (const note of batch) {
    const chunks = chunkText(note.content);
    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.text);
      await sleep(OLLAMA_REQUEST_DELAY_MS);  // REMOVE
    }
    await storeEmbeddings(note, embeddings);
  }
  await sleep(BATCH_DELAY_MS);  // REMOVE
}
```

**New Implementation**:
```typescript
import { processNotesWithConcurrency } from '../../services/embedding/concurrency';
import { processNoteWithBatchEmbedding } from '../../services/embedding/processNote';
import { EMBEDDING_CONFIG } from '../../services/embedding/config';
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

### Step 3: Verify Removal of Delays

Search codebase for:
- `OLLAMA_REQUEST_DELAY_MS` (should be 0 results after removal)
- `BATCH_DELAY_MS` (should be 0 results after removal)
- `await sleep` in embedding code (should be 0 results after removal)

## Testing Requirements

- [ ] Manual test: `brain embed --project brain --limit 10`
- [ ] Manual test: `brain embed --project brain --limit 100`
- [ ] Verify logs show concurrent processing
- [ ] Verify memory logging appears every 100 notes
- [ ] Verify failed notes logged separately
- [ ] Verify response format matches spec

Automated testing is covered in TASK-005.

## Dependencies

- TASK-001: generateBatchEmbeddings method must exist
- p-limit package installed (`bun add p-limit`)
- Existing chunking logic in `services/embedding/chunking.ts`
- Existing database storage in `db/vectors.ts`

## Related Tasks

- TASK-001: Add batch method (prerequisite)
- TASK-003: Add p-limit dependency (can be done in parallel)
- TASK-005: Add tests (validates this task)
