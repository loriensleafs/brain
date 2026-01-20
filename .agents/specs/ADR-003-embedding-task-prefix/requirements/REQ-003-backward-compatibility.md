---
type: requirement
id: REQ-003
title: Backward compatibility with default task type
status: implemented
priority: P0
category: non-functional
epic: EPIC-ADR-003-implementation
related:
  - ADR-003
  - REQ-001
  - REQ-002
created: 2026-01-20
updated: 2026-01-20
author: spec-generator
tags:
  - embedding
  - backward-compatibility
  - defaults
---

# REQ-003: Backward Compatibility with Default Task Type

## Requirement Statement

WHEN taskType parameter is omitted from generateEmbedding or generateBatchEmbeddings calls,
THE SYSTEM SHALL default to "search_document" task type
SO THAT existing code continues functioning without modification.

## Context

Adding TaskType parameter to embedding methods is a breaking change. To minimize migration effort and maintain backward compatibility, a sensible default is required.

Analysis of current usage:

- **Embed tool**: Generates embeddings for note content (document embedding)
- **Search service**: Generates embeddings for queries (query embedding)

Since the embed tool processes more text (700+ notes with 3 chunks each = 2100+ chunks) versus search service (1 query per search), "search_document" is the more common use case.

Default parameter pattern in TypeScript:

```typescript
async generateEmbedding(
  text: string,
  taskType: TaskType = "search_document",  // Default
  model: string = "nomic-embed-text"
): Promise<number[]>
```

This allows gradual migration: update high-priority call sites (search service) first, defer low-risk updates.

## Acceptance Criteria

- [ ] generateEmbedding has default: `taskType: TaskType = "search_document"`
- [ ] generateBatchEmbeddings has default: `taskType: TaskType = "search_document"`
- [ ] Calling without taskType uses "search_document" prefix
- [ ] Test verifies default parameter behavior
- [ ] JSDoc comment documents default value and rationale
- [ ] No breaking changes to existing callers (calls without taskType compile)

## Rationale

Default parameter approach provides:

- **Backward compatibility**: Existing code compiles without changes
- **Gradual migration**: Update critical call sites first (search service), defer others
- **Sensible default**: "search_document" matches majority use case (embed tool)
- **Opt-in specificity**: Callers can override when semantics require (search service)

Alternative considered: Required parameter (no default). Rejected because it forces immediate updates to all callers, increasing implementation risk and effort.

## Dependencies

- REQ-001: TaskType enum defined
- REQ-002: Prefix application implemented

## Related Artifacts

- ADR-003: Embedding Quality: Task Prefix Specification for nomic-embed-text
- DESIGN-001: TaskType parameter flow through embedding pipeline
