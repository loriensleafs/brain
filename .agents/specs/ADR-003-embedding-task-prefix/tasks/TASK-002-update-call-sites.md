---
type: task
id: TASK-002
title: Update embed tool and search service call sites
status: todo
priority: P0
complexity: XS
estimate: 5m
related:
  - DESIGN-001
  - REQ-002
blocked_by:
  - TASK-001
blocks:
  - TASK-003
assignee: implementer
created: 2026-01-20
updated: 2026-01-20
author: spec-generator
tags:
  - embed-tool
  - search-service
  - call-site
---

# TASK-002: Update Embed Tool and Search Service Call Sites

## Design Context

- DESIGN-001: TaskType parameter flow through embedding pipeline

## Objective

Update the two OllamaClient.generateEmbedding call sites to explicitly specify task types: "search_document" for embed tool and "search_query" for search service.

## Scope

**In Scope**:

- Update embed tool to pass "search_document" task type
- Update search service to pass "search_query" task type
- Add comments explaining task type choice

**Out of Scope**:

- Batch embedding call sites (already updated in ADR-002)
- Test updates (TASK-003)
- Performance optimization

## Acceptance Criteria

- [ ] Embed tool (`apps/mcp/src/tools/embed/index.ts`) uses `"search_document"`
- [ ] Search service (`apps/mcp/src/services/search/index.ts`) uses `"search_query"`
- [ ] Comments explain why each task type is chosen
- [ ] TypeScript compilation succeeds
- [ ] No linting errors
- [ ] No other call sites found (verified via grep)

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/src/tools/embed/index.ts` | Modify | Add "search_document" task type |
| `apps/mcp/src/services/search/index.ts` | Modify | Add "search_query" task type |

## Implementation Notes

### Embed Tool Update

**Location**: `apps/mcp/src/tools/embed/index.ts`

**Current Code** (find the generateEmbedding call):

```typescript
const embedding = await ollamaClient.generateEmbedding(chunk.text);
```

**New Code**:

```typescript
// Use search_document task type for content being indexed
const embedding = await ollamaClient.generateEmbedding(
  chunk.text,
  "search_document"
);
```

### Search Service Update

**Location**: `apps/mcp/src/services/search/index.ts` (around line 388)

**Current Code**:

```typescript
const queryEmbedding = await ollamaClient.generateEmbedding(query);
```

**New Code**:

```typescript
// Use search_query task type for user search queries
// This is critical for proper semantic matching with document embeddings
const queryEmbedding = await ollamaClient.generateEmbedding(
  query,
  "search_query"
);
```

### Verification

Search for other call sites:

```bash
# Find all generateEmbedding calls
grep -r "generateEmbedding" apps/mcp/src --include="*.ts" | grep -v "test" | grep -v "node_modules"
```

Expected results: Only the two call sites above (embed tool and search service).

## Testing Requirements

Manual testing before commit:

1. **Embed test**: Run `brain embed --project brain --limit 1`
   - Verify no errors
   - Check database for chunk_text with "search_document:" prefix

2. **Search test**: Run `brain search "authentication" --limit 3`
   - Verify search returns results
   - Verify no errors in logs

Unit tests covered in TASK-003.

## Dependencies

- TASK-001: TaskType enum defined and signatures updated
- Existing embed tool implementation
- Existing search service implementation

## Related Tasks

- TASK-001: Add TaskType enum (required before this task)
- TASK-003: Add unit tests (validates this task)
