---
type: requirement
id: REQ-001
title: Batch API migration for embedding generation
status: implemented
priority: P0
category: functional
epic: EPIC-ADR-002-implementation
related:
  - ADR-002
created: 2026-01-19
updated: 2026-01-19
author: spec-generator
tags:
  - embedding
  - ollama
  - batch-api
  - performance
---

# REQ-001: Batch API Migration for Embedding Generation

## Requirement Statement

WHEN generating embeddings for multiple text chunks from a single note,
THE SYSTEM SHALL use the Ollama `/api/embed` batch endpoint with all chunks in a single request
SO THAT HTTP overhead is reduced by 5-50x compared to sequential single-text API calls.

## Context

The current implementation uses the `/api/embeddings` endpoint (singular) which accepts a single text string and returns a single embedding vector. For a note with multiple chunks, this requires N sequential HTTP requests where N is the number of chunks.

Analysis 025 identified:

- Current API: POST `/api/embeddings` with `{ prompt: string }` returns `{ embedding: number[] }`
- Batch API: POST `/api/embed` with `{ input: string[] }` returns `{ embeddings: number[][] }`
- HTTP overhead reduction: 3-10 chunks per note → 3-10x fewer requests
- Average note has 3 chunks → 700 notes = 2100 requests down to 700 requests

The Ollama batch API is available in Ollama 0.1.26+ and provides array-based input/output with guaranteed index alignment.

## Acceptance Criteria

- [ ] OllamaClient class has `generateBatchEmbeddings(texts: string[]): Promise<number[][]>` method
- [ ] Batch method sends POST request to `/api/embed` endpoint
- [ ] Request payload uses `input: string[]` field instead of `prompt: string`
- [ ] Response parsing expects `embeddings: number[][]` instead of `embedding: number[]`
- [ ] Index alignment verified: `embeddings[i]` corresponds to `input[i]`
- [ ] Empty array input returns empty array output without API call
- [ ] Embedding tool uses batch method instead of sequential single-text calls
- [ ] Single-text method `generateEmbedding` deprecated but not removed (backward compatibility)
- [ ] Ollama version check added to prerequisites: minimum 0.1.26 required
- [ ] API timeout applies to entire batch request, not per-chunk

## Rationale

Batch API migration addresses the primary performance bottleneck:

**Current Performance (Sequential)**:

- 700 notes × 3 chunks average = 2100 HTTP requests
- Each request: ~50ms embedding + 50ms HTTP overhead = 100ms total
- Total time: 2100 × 100ms = 210,000ms = 3.5 minutes in HTTP overhead alone

**After Batch API**:

- 700 notes = 700 HTTP requests (one per note with all chunks)
- Each request: ~100ms embedding (3 chunks) + 50ms HTTP overhead = 150ms total
- Total time: 700 × 150ms = 105,000ms = 1.75 minutes
- Improvement: 3.5 min → 1.75 min = 2x faster from API change alone

Combined with concurrency (REQ-002), this enables 13x total improvement.

## Dependencies

- Ollama server version 0.1.26 or higher
- Ollama `/api/embed` endpoint available and functional
- TypeScript/Bun fetch API for HTTP requests
- Existing OllamaClient class in `apps/mcp/src/services/ollama/client.ts`

## Related Artifacts

- ADR-002: Embedding Performance Optimization: Batch API Migration with Concurrency Control
- Analysis 025: Embedding Performance Research
- REQ-002: Concurrency control with p-limit
- DESIGN-001: Ollama client batch integration architecture
