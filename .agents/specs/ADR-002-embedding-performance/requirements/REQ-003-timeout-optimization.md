---
type: requirement
id: REQ-003
title: Timeout optimization with fail-fast error reporting
status: draft
priority: P1
category: non-functional
epic: EPIC-ADR-002-implementation
related:
  - ADR-002
  - REQ-001
  - REQ-002
created: 2026-01-19
updated: 2026-01-19
author: spec-generator
tags:
  - timeout
  - error-handling
  - fail-fast
  - observability
---

# REQ-003: Timeout Optimization with Fail-Fast Error Reporting

## Requirement Statement

WHEN an embedding operation exceeds the expected completion time,
THE SYSTEM SHALL fail fast with a 60-second timeout and provide actionable error messages indicating the specific operation and note that failed
SO THAT users can diagnose issues quickly instead of waiting for 10-minute timeouts.

## Context

The current implementation uses 10-minute timeouts everywhere:
- Ollama client: 600,000ms (10 minutes)
- Go HTTP client: 10 minutes
- Bun idleTimeout: 0 (disabled, correct)

With batch API and concurrency, a single note with 3 chunks completes in ~100-200ms. The 10-minute timeout is 3000x longer than needed and masks failures:
- User waits 10 minutes to learn of an error
- No indication of which note or operation failed
- Timeout errors are indistinguishable from network errors

Analysis 026 calculated right-sized timeouts:
- Single batch embedding: 100-200ms
- Per-note with read/store: 260ms
- 700 notes with concurrency 4: 45.5 seconds
- Safety margin (2x): 91 seconds
- Recommended: 60 seconds per-request, 5 minutes for CLI

## Acceptance Criteria

- [ ] Ollama client timeout reduced from 600,000ms to 60,000ms (60 seconds)
- [ ] Go HTTP client timeout reduced from 10 minutes to 5 minutes
- [ ] Bun idleTimeout remains 0 (disabled) to support long MCP operations
- [ ] Health check timeout remains 5 seconds (unchanged)
- [ ] Timeout errors include note identifier and operation context
- [ ] Timeout errors differentiated from network errors (error codes)
- [ ] .env.example updated with OLLAMA_TIMEOUT documentation
- [ ] Timeout value configurable via OLLAMA_TIMEOUT environment variable
- [ ] Default timeout documented in code comments with rationale
- [ ] Error messages include retry suggestion for transient failures
- [ ] Timeout exceeded logs include elapsed time for debugging

## Rationale

Right-sized timeouts improve user experience and system reliability:

**Current State (10-minute timeout)**:
- Single note fails → user waits 10 minutes to see error
- Error message: "Request timeout" (no context)
- Difficult to diagnose: network issue? Ollama crash? Bad note content?

**After Optimization (60-second timeout)**:
- Single note fails → user sees error in 60 seconds
- Error message: "Embedding timeout for note 'feature-authentication.md' after 60s (expected <1s)"
- Clear diagnosis: specific note, expected vs actual time, retry suggestion

**Performance Impact**:
- 700 notes with 4 concurrent = 45.5 seconds expected
- 60-second timeout per-request allows 30% safety margin
- 5-minute CLI timeout handles 3000+ notes (13x current corpus)

**Fail-Fast Benefits**:
- Faster feedback loop for users
- Clearer error messages with context
- Reduced resource consumption (don't wait 10 minutes for known failures)
- Better observability (timeout vs network vs server error)

## Dependencies

- REQ-001: Batch API (provides fast embedding baseline)
- REQ-002: Concurrency control (enables predictable completion times)
- Ollama server stability (timeout assumes server responds within 1 second)
- Go HTTP client in apps/tui/client/http.go
- Bun HTTP transport in apps/mcp/src/transport/http.ts

## Related Artifacts

- ADR-002: Embedding Performance Optimization: Batch API Migration with Concurrency Control
- Analysis 026: Timeout Changes Performance Review
- DESIGN-003: Timeout cascade architecture
