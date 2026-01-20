# Embedding Catch-up Trigger Specification

**Feature**: Automatic background embedding catch-up on session start
**Effort**: 4 hours
**Status**: Draft
**Created**: 2026-01-20

## Overview

Add automatic embedding catch-up to `bootstrap_context` tool. When user starts a session, system queries for notes lacking embeddings and triggers background batch processing if any found.

**User Problem Solved**: "TON of notes" without embeddings get automatically processed on next session start with zero manual intervention.

## Traceability Chain

```text
REQ-001 (Missing Embedding Detection)
    |
    +-- DESIGN-001 (Bootstrap Context Catch-up Architecture)
            |
            +-- TASK-001 (Missing Embeddings Query)
            +-- TASK-004 (Tests)

REQ-002 (Async Catch-up Trigger)
    |
    +-- DESIGN-001 (Bootstrap Context Catch-up Architecture)
            |
            +-- TASK-002 (Batch Embedding Trigger)
            +-- TASK-003 (Bootstrap Integration)
            +-- TASK-004 (Tests)

REQ-003a (Trigger Event Logging)
    |
    +-- DESIGN-001 (Bootstrap Context Catch-up Architecture)
            |
            +-- TASK-002 (Batch Embedding Trigger - implements logging)
            +-- TASK-004 (Tests - validates logging)

REQ-003b (Completion Event Logging)
    |
    +-- DESIGN-001 (Bootstrap Context Catch-up Architecture)
            |
            +-- TASK-002 (Batch Embedding Trigger - implements logging)
            +-- TASK-004 (Tests - validates logging)
```

## Artifacts

### Requirements (`requirements/`)

| ID | Title | Priority | Category |
|----|-------|----------|----------|
| REQ-001 | Missing embedding detection on session start | P0 | Functional |
| REQ-002 | Asynchronous catch-up processing trigger | P0 | Functional |
| ~~REQ-003~~ | ~~Observability logging for catch-up operations~~ | ~~P1~~ | SUPERSEDED |
| REQ-003a | Log catch-up trigger events | P1 | Non-functional |
| REQ-003b | Log catch-up completion events | P1 | Non-functional |

**Note**: REQ-003 was split into REQ-003a and REQ-003b to fix EARS compliance violation (compound WHEN clause).

### Design (`design/`)

| ID | Title | Status |
|----|-------|--------|
| DESIGN-001 | Bootstrap context catch-up trigger architecture | Draft |

### Tasks (`tasks/`)

| ID | Title | Complexity | Estimate | Blocked By |
|----|-------|------------|----------|------------|
| TASK-001 | Implement missing embeddings query | S | 1h | - |
| TASK-002 | Implement batch embedding trigger | S | 1h | TASK-001 |
| TASK-003 | Integrate catch-up trigger into bootstrap_context | XS | 0.5h | TASK-001, TASK-002 |
| TASK-004 | Add tests for catch-up trigger | S | 1.5h | TASK-003 |

**Total Effort**: 4 hours

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Trigger Point** | Session start (bootstrap_context) | User-initiated, Ollama likely running, natural retry mechanism |
| **Processing Pattern** | Fire-and-forget | Non-blocking, session start remains responsive |
| **Query Strategy** | Two-phase (count then full) | Optimize for zero-result case |
| **Batch Processing** | Sequential (no parallelism) | Simple, predictable, Ollama handles rate limiting |
| **Error Handling** | Non-blocking (log only) | Session start must never fail |
| **Logging Strategy** | Structured events (trigger + completion) | Enables debugging and monitoring |

## Implementation Summary

**New Files**:
- `src/tools/bootstrap-context/catchupTrigger.ts` - Query and batch trigger logic
- `src/tools/bootstrap-context/__tests__/catchupTrigger.test.ts` - Unit tests

**Modified Files**:
- `src/tools/bootstrap-context/index.ts` - Add catch-up trigger invocation

**Integration Point**: After context building, before return (fire-and-forget)

## Dependencies

- basic-memory MCP server (note storage)
- brain_embeddings table (embedding storage)
- Existing `triggerEmbedding` infrastructure
- bootstrap_context tool

## Related Artifacts

- `.agents/analysis/038-catchup-trigger-verdict.md` - Strategic decision (project activation vs cron)
- `.agents/analysis/037-embedding-catchup-requirements.md` - Analyst research (if exists)
- `.agents/architecture/embedding-catchup-architecture.md` - Architect review (if exists)
- ADR-016: Phase 2 integration decisions

## Success Criteria

- [ ] Missing embeddings query executes on session start (< 100ms overhead)
- [ ] Catch-up trigger fires when missing embeddings detected
- [ ] Session start remains responsive (fire-and-forget pattern)
- [ ] Batch processing completes in background
- [ ] Observability logging provides visibility into catch-up progress (REQ-003a, REQ-003b)
- [ ] All tests pass (> 90% coverage)

## Next Steps

1. Implementer: Execute TASK-001 through TASK-004 in sequence
2. QA: Validate implementation against acceptance criteria
3. Retrospective: Extract learnings for future similar enhancements
