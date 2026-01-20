---
type: requirement
id: REQ-002
title: Concurrency control with p-limit for resource protection
status: draft
priority: P0
category: non-functional
epic: EPIC-ADR-002-implementation
related:
  - ADR-002
  - REQ-001
created: 2026-01-19
updated: 2026-01-19
author: spec-generator
tags:
  - concurrency
  - p-limit
  - resource-management
  - backpressure
---

# REQ-002: Concurrency Control with p-limit for Resource Protection

## Requirement Statement

WHEN processing multiple notes concurrently for embedding generation,
THE SYSTEM SHALL limit concurrent operations to a maximum of 4 simultaneous note-level embedding requests using the p-limit library
SO THAT Ollama server resource exhaustion is prevented while maximizing throughput.

## Context

The current implementation processes notes sequentially with artificial delays to prevent overwhelming the Ollama server. Analysis 026 identified that these delays add 100% overhead (434 seconds delay vs 175 seconds work for 700 notes).

Removing delays without concurrency control would create unbounded parallelism:
- 700 notes processed simultaneously → massive memory consumption
- Ollama server default `OLLAMA_NUM_PARALLEL=4` → server rejects excess requests with 500 errors
- No backpressure mechanism → request queue grows unbounded

The solution uses p-limit to cap concurrency at 4 simultaneous operations, matching Ollama's default parallel processing capacity. This provides backpressure without guessing delays.

## Acceptance Criteria

- [ ] p-limit dependency added to package.json (`bun add p-limit`)
- [ ] EMBEDDING_CONCURRENCY environment variable defined (default: 4)
- [ ] Concurrency value bounded: min 1, max 16, default 4
- [ ] Embed tool creates p-limit instance with configured concurrency
- [ ] Note processing wrapped in `limit(() => processNote())` calls
- [ ] Promise.allSettled used to process all notes concurrently
- [ ] Failed notes logged with reason but do not block other notes
- [ ] Successful notes stored to database immediately after embedding
- [ ] Artificial delays removed: OLLAMA_REQUEST_DELAY_MS deleted
- [ ] Batch delays removed: BATCH_DELAY_MS deleted
- [ ] Concurrency limit logged at tool invocation for observability
- [ ] Memory pressure monitored every 100 notes (heap usage logged)

## Rationale

Concurrency control with p-limit provides optimal throughput while preventing resource exhaustion:

**Without Concurrency Control (Sequential)**:
- 700 notes × 260ms per note = 182,000ms = 3 minutes
- Single-threaded, no parallelism benefit

**Without Concurrency Control (Unbounded Parallel)**:
- 700 simultaneous requests → Ollama overwhelmed
- 500 errors, memory exhaustion, unpredictable behavior

**With p-limit Concurrency (4 concurrent)**:
- 700 notes / 4 concurrent = 175 batches
- 175 batches × 260ms = 45,500ms = 46 seconds
- 4x throughput improvement from parallelism
- No resource exhaustion (backpressure applied)

Combined with batch API (REQ-001), total improvement: 10 minutes → 46 seconds = 13x faster.

**Why 4 concurrent?**
- Matches Ollama default `OLLAMA_NUM_PARALLEL=4`
- Allows users to tune via `EMBEDDING_CONCURRENCY` environment variable
- Conservative default prevents overwhelming typical hardware

## Dependencies

- p-limit npm package (4.3kB, zero dependencies, Bun compatible)
- Bun runtime with native Promise support
- Ollama server with `OLLAMA_NUM_PARALLEL` configuration
- REQ-001: Batch API integration (provides per-note batching)

## Related Artifacts

- ADR-002: Embedding Performance Optimization: Batch API Migration with Concurrency Control
- Analysis 026: Timeout Changes Performance Review
- REQ-001: Batch API migration
- DESIGN-002: p-limit concurrency architecture
