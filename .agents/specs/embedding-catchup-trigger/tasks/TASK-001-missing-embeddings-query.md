---
type: task
id: TASK-001
title: Implement missing embeddings query
status: todo
priority: P0
complexity: S
estimate: 1h
related:
  - DESIGN-001
  - REQ-001
blocked_by: []
blocks:
  - TASK-002
assignee: implementer
created: 2026-01-20
updated: 2026-01-20
author: spec-generator
tags:
  - query
  - database
---

# TASK-001: Implement Missing Embeddings Query

## Design Context

- DESIGN-001: Bootstrap context catch-up trigger architecture

## Objective

Implement query to identify notes present in basic-memory but absent from brain_embeddings table. Optimize for zero-result case with count check.

## Scope

**In Scope**:

- Query basic-memory for all note permalinks
- Query brain_embeddings for existing entity_ids
- Return set difference (notes without embeddings)
- Count optimization for fast path

**Out of Scope**:

- Batch processing logic (TASK-002)
- Integration with bootstrap_context (TASK-003)

## Acceptance Criteria

- [ ] Function `findNotesWithoutEmbeddings(project: string)` returns array of note permalinks
- [ ] Query uses basic-memory client to list all notes
- [ ] Query uses vector database to get existing embeddings
- [ ] Returns only notes lacking embeddings (set difference)
- [ ] Count check optimization prevents unnecessary full query when all notes have embeddings
- [ ] Function handles errors gracefully (returns empty array on failure)

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/tools/bootstrap-context/catchupTrigger.ts` | Create | Query and batch trigger functions |

## Implementation Notes

**Query Strategy**:

```typescript
import { getBasicMemoryClient } from "../../proxy/client";
import { createVectorConnection } from "../../db/connection";
import { logger } from "../../utils/internal/logger";

export async function findNotesWithoutEmbeddings(
  project: string
): Promise<string[]> {
  try {
    // Get all notes from basic-memory
    const client = await getBasicMemoryClient();
    const notes = await client.listNotes({ project });
    const notePermalinks = notes.map(n => n.permalink);

    // Get existing embeddings
    const db = createVectorConnection();
    try {
      const embeddedEntities = db
        .query("SELECT DISTINCT entity_id FROM brain_embeddings")
        .all() as Array<{ entity_id: string }>;

      const embeddedSet = new Set(embeddedEntities.map(e => e.entity_id));

      // Return notes without embeddings
      const missing = notePermalinks.filter(p => !embeddedSet.has(p));

      logger.debug(
        { project, total: notePermalinks.length, missing: missing.length },
        "Missing embeddings query complete"
      );

      return missing;
    } finally {
      db.close();
    }
  } catch (error) {
    logger.warn({ project, error }, "Failed to query missing embeddings");
    return [];
  }
}
```

**Count Optimization** (optional enhancement):

```typescript
// Fast path: if no embeddings at all, return all notes
const count = db.query("SELECT COUNT(*) as count FROM brain_embeddings")
  .get() as { count: number };
if (count.count === 0) {
  return notePermalinks; // All notes need embeddings
}
```

## Testing Requirements

- [ ] Test returns empty array when all notes have embeddings
- [ ] Test returns all notes when no embeddings exist
- [ ] Test returns correct set difference for mixed case
- [ ] Test handles basic-memory query failure (returns empty array)
- [ ] Test handles database query failure (returns empty array)
- [ ] Test logs debug event with query results

## Dependencies

- basic-memory MCP client (`getBasicMemoryClient`)
- Vector database connection (`createVectorConnection`)
- Logger utility
