---
type: requirement
id: REQ-002
title: Asynchronous catch-up processing trigger
status: draft
priority: P0
category: functional
epic: embedding-catchup-trigger
related:
  - REQ-001
created: 2026-01-20
updated: 2026-01-20
author: spec-generator
tags:
  - embeddings
  - async
  - fire-and-forget
---

# REQ-002: Asynchronous Catch-up Processing Trigger

## Requirement Statement

WHEN missing embeddings are detected during session start
THE SYSTEM SHALL trigger batch embedding processing asynchronously
SO THAT session initialization is not blocked by embedding generation

## Context

Embedding generation for hundreds of notes could take minutes to hours depending on:

- Note count and content size
- Ollama server load and model performance
- Network conditions

Blocking session start for this duration violates user expectations (sub-second response time).

## Acceptance Criteria

- [ ] Catch-up trigger uses fire-and-forget pattern (does not await completion)
- [ ] Bootstrap_context returns to user within normal response time (50-200ms overhead max)
- [ ] Catch-up processing continues in background after bootstrap_context completes
- [ ] Catch-up trigger only fires when missing embeddings count > 0
- [ ] Catch-up failure does not cause bootstrap_context failure
- [ ] Catch-up trigger logs start event with note count

## Rationale

**Fire-and-Forget Pattern**: Existing pattern from `triggerEmbedding` for note create/update events

- Proven non-blocking behavior
- Graceful error handling (log warning, do not throw)
- Natural retry (next session if current fails)

**User Experience**: Session start must remain responsive regardless of background processing load.

## Dependencies

- REQ-001 (missing embedding detection)
- Existing `triggerEmbedding` infrastructure
- `generateChunkedEmbeddings` service

## Related Artifacts

- DESIGN-001: Bootstrap context catch-up trigger architecture
- `src/services/embedding/triggerEmbedding.ts` (existing pattern)
