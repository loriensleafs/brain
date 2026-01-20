---
type: task
id: TASK-004
title: Add tests for catch-up trigger
status: complete
priority: P1
complexity: S
estimate: 1.5h
related:
  - DESIGN-001
  - REQ-001
  - REQ-002
  - REQ-003
blocked_by:
  - TASK-003
blocks: []
assignee: implementer
created: 2026-01-20
updated: 2026-01-20
author: spec-generator
tags:
  - testing
  - unit-tests
---

# TASK-004: Add Tests for Catch-up Trigger

## Design Context

- DESIGN-001: Bootstrap context catch-up trigger architecture

## Objective

Create comprehensive unit tests for catch-up trigger functionality covering query logic, batch processing, and integration behavior.

## Scope

**In Scope**:

- Unit tests for `findNotesWithoutEmbeddings`
- Unit tests for `triggerBatchEmbeddings`
- Integration tests for `triggerCatchUpIfNeeded`
- Mock dependencies (basic-memory client, vector database)

**Out of Scope**:

- End-to-end tests with real Ollama (covered by existing embedding tests)
- Performance benchmarking (manual testing)

## Acceptance Criteria

- [ ] Test file created at `src/tools/bootstrap-context/__tests__/catchupTrigger.test.ts`
- [ ] Tests cover findNotesWithoutEmbeddings query logic
- [ ] Tests cover triggerBatchEmbeddings batch processing
- [ ] Tests cover triggerCatchUpIfNeeded integration
- [ ] Tests use mocks for external dependencies
- [ ] All tests pass with `bun test`
- [ ] Code coverage > 90% for catchupTrigger.ts

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/tools/bootstrap-context/__tests__/catchupTrigger.test.ts` | Create | Unit tests for catch-up trigger |

## Implementation Notes

**Test Structure**:

```typescript
import { describe, it, expect, mock, beforeEach } from "bun:test";
import {
  findNotesWithoutEmbeddings,
  triggerBatchEmbeddings,
  triggerCatchUpIfNeeded,
} from "../catchupTrigger";

describe("findNotesWithoutEmbeddings", () => {
  beforeEach(() => {
    // Reset mocks
  });

  it("returns empty array when all notes have embeddings", async () => {
    // Mock basic-memory with 3 notes
    // Mock brain_embeddings with 3 entity_ids
    // Expect: []
  });

  it("returns all notes when no embeddings exist", async () => {
    // Mock basic-memory with 3 notes
    // Mock brain_embeddings with 0 entity_ids
    // Expect: [note1, note2, note3]
  });

  it("returns correct set difference for mixed case", async () => {
    // Mock basic-memory with 5 notes
    // Mock brain_embeddings with 3 entity_ids
    // Expect: [note4, note5]
  });

  it("handles basic-memory query failure gracefully", async () => {
    // Mock basic-memory to throw error
    // Expect: []
  });

  it("handles database query failure gracefully", async () => {
    // Mock brain_embeddings to throw error
    // Expect: []
  });
});

describe("triggerBatchEmbeddings", () => {
  it("invokes triggerEmbedding for each note with content", async () => {
    // Mock basic-memory readNote
    // Mock triggerEmbedding
    // Verify triggerEmbedding called 3 times
  });

  it("skips notes without content", async () => {
    // Mock note with null content
    // Verify triggerEmbedding not called for that note
  });

  it("continues batch when individual read fails", async () => {
    // Mock readNote to throw for note2
    // Verify triggerEmbedding called for note1 and note3
  });

  it("logs batch start and completion events", async () => {
    // Mock logger
    // Verify logger.info called with batch start/complete
  });

  it("returns immediately (fire-and-forget)", () => {
    // Call triggerBatchEmbeddings
    // Verify returns synchronously (no await)
  });
});

describe("triggerCatchUpIfNeeded", () => {
  it("triggers batch when missing embeddings detected", async () => {
    // Mock findNotesWithoutEmbeddings to return [note1, note2]
    // Mock triggerBatchEmbeddings
    // Verify triggerBatchEmbeddings called with [note1, note2]
  });

  it("does not trigger when no missing embeddings", async () => {
    // Mock findNotesWithoutEmbeddings to return []
    // Mock triggerBatchEmbeddings
    // Verify triggerBatchEmbeddings NOT called
  });

  it("logs query failure without throwing", async () => {
    // Mock findNotesWithoutEmbeddings to throw
    // Verify logger.warn called
    // Verify no exception thrown
  });
});
```

**Mock Strategy**:

```typescript
// Mock basic-memory client
const mockClient = {
  listNotes: mock(() => Promise.resolve([
    { permalink: "note1" },
    { permalink: "note2" },
  ])),
  readNote: mock(({ identifier }) => Promise.resolve({
    content: `Content for ${identifier}`,
  })),
};

// Mock vector database
const mockDb = {
  query: mock((sql) => ({
    all: () => [
      { entity_id: "note1" },
    ],
  })),
  close: mock(() => {}),
};

// Mock dependencies
mock.module("../../proxy/client", () => ({
  getBasicMemoryClient: () => Promise.resolve(mockClient),
}));

mock.module("../../db/connection", () => ({
  createVectorConnection: () => mockDb,
}));

mock.module("../../services/embedding/triggerEmbedding", () => ({
  triggerEmbedding: mock(() => {}),
}));
```

## Testing Requirements

**Unit Test Coverage**:

- [ ] findNotesWithoutEmbeddings: empty result case
- [ ] findNotesWithoutEmbeddings: all missing case
- [ ] findNotesWithoutEmbeddings: partial missing case
- [ ] findNotesWithoutEmbeddings: error handling
- [ ] triggerBatchEmbeddings: successful batch
- [ ] triggerBatchEmbeddings: skip empty content
- [ ] triggerBatchEmbeddings: continue on failure
- [ ] triggerBatchEmbeddings: logging
- [ ] triggerCatchUpIfNeeded: trigger when needed
- [ ] triggerCatchUpIfNeeded: skip when not needed
- [ ] triggerCatchUpIfNeeded: error isolation

**Test Execution**:

```bash
# Run tests
bun test src/tools/bootstrap-context/__tests__/catchupTrigger.test.ts

# Coverage
bun test --coverage src/tools/bootstrap-context/__tests__/catchupTrigger.test.ts
```

## Dependencies

- TASK-001 (query implementation)
- TASK-002 (batch trigger implementation)
- TASK-003 (integration)
- Bun test framework
- Mock utilities
