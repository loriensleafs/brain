# Architect Review: ADR-002 Embedding Performance Optimization

**Reviewer**: Architect
**Date**: 2026-01-19
**Phase**: Independent Review (Phase 1 of adr-review)
**ADR**: `/Users/peter.kloss/Dev/brain/.agents/architecture/ADR-002-embedding-performance-optimization.md`

## Structural Compliance (MADR 4.0)

| Section | Status | Notes |
|---------|--------|-------|
| YAML frontmatter | [PASS] | Contains status, date, decision-makers, consulted, informed |
| Context and Problem Statement | [PASS] | Clear problem articulation with quantified evidence |
| Decision Drivers | [PASS] | 5 drivers, measurable targets |
| Considered Options | [PASS] | 3 options evaluated |
| Decision Outcome | [PASS] | Clear selection with justification |
| Consequences | [PASS] | Good/bad/neutral documented |
| Confirmation | [PASS] | 4 verification methods specified |
| Pros and Cons | [PASS] | Each option analyzed |
| Implementation Plan | [PASS] | Phased with effort estimates |
| More Information | [PASS] | Related docs and external refs |

**Structural Score**: 10/10 sections complete

## Strengths

1. **Strong evidence base**: Analysis documents 025 and 026 provide quantified data (100% overhead from delays, 13x potential improvement)

2. **Clear before/after architecture**: ASCII diagrams effectively communicate the transformation from sequential+delay to concurrent+batch

3. **API documentation included**: Ollama `/api/embed` request/response formats documented with TypeScript interfaces

4. **Timeout cascade analysis**: All 4 timeout layers identified and analyzed with specific recommendations per layer

5. **Error handling strategy defined**: All-or-nothing batch failure model with note-level retry logic

6. **Performance estimates quantified**: Tables with specific timing projections (700 notes: 600s to 46s)

7. **Rollback plan included**: Clear indicators and steps for reverting if issues arise

## Weaknesses/Gaps

### P0 - Blocking Issues

| Issue | Priority | Description |
|-------|----------|-------------|
| No chunk size validation | P0 | ADR mentions Ollama batch API accepts arrays but does not specify max batch size. What happens if a note has 100 chunks? Could exceed Ollama memory limits |
| No memory pressure analysis | P0 | Concurrent processing of 4 notes means up to 4 * N chunks in flight. No analysis of memory consumption on Ollama side or MCP server |
| Missing error categorization | P0 | "Retryable errors" mentioned but not defined. Which HTTP codes retry? What about Ollama-specific errors like "model not found"? |

### P1 - Important Issues

| Issue | Priority | Description |
|-------|----------|-------------|
| Concurrency limit hardcoded | P1 | `CONCURRENCY_LIMIT = 4` matches OLLAMA_NUM_PARALLEL default but should be configurable. ADR mentions env var but not in implementation plan |
| No observability additions | P1 | Phase 3 lists "Add embedding metrics" but no specification of what metrics, where stored, how exposed |
| Circuit breaker underspecified | P1 | "Optional" P2 item but no design. If failure rate exceeds 50%, what state machine? How long pause? |
| Batch delay removal risk | P1 | Analysis 026 notes BATCH_DELAY_MS was added "speculatively" but also notes "no evidence Ollama needs recovery." Should have validation test before removal |

### P2 - Documentation Issues

| Issue | Priority | Description |
|-------|----------|-------------|
| Types file location | P2 | States "Add to types.ts" but multiple types.ts files exist in codebase. Should specify full path |
| Phase effort estimates inconsistent | P2 | Phase 0: 30 min, Phase 1: 2 hours, but Phase 4 "Testing" includes unit + integration covering all phases |
| External reference file paths | P2 | References analysis docs with full absolute paths containing username. Should use relative paths |

## Scope Concerns

**Question: Should this ADR be split?**

The ADR addresses three related but distinct changes:

1. **API migration** (`/api/embeddings` to `/api/embed`)
2. **Concurrency model** (sequential to p-limit concurrent)
3. **Timeout optimization** (10 min to 60s)

**Recommendation**: Keep as single ADR. These changes are tightly coupled. Timeout changes depend on batch API performance. Concurrency depends on batch API reducing per-chunk overhead. Splitting would create artificial boundaries.

**Scope assessment**: [PASS] - Scope is appropriate for single decision.

## Questions Requiring Clarification

1. **What is the maximum chunk count per note observed in real data?**
   - If notes have 50+ chunks, batching all chunks in one request may exceed Ollama limits
   - Recommendation: Add chunk batching with configurable max (e.g., 32 chunks per request)

2. **How will partial progress be communicated during long operations?**
   - Current code logs progress every 10 notes
   - Batch API removes per-chunk visibility
   - Recommendation: Add note-level progress emission

3. **What happens if p-limit dependency breaks Bun compatibility?**
   - Analysis 025 states "pure JS" but no verification test
   - Recommendation: Add integration test verifying p-limit works in Bun before implementation

4. **Should EMBEDDING_CONCURRENCY be dynamic based on system load?**
   - Hardcoded 4 may be suboptimal on high-end systems or constrained on low-end
   - Recommendation: Start static, document tuning guidance, consider adaptive P3

## Alignment with Existing ADRs

| ADR | Alignment Status | Notes |
|-----|-----------------|-------|
| ADR-001 (Search Service) | Not Applicable | Search abstraction is orthogonal to embedding generation |
| ADR-016 (Session Protocol) | Not Applicable | Session workflow enforcement unrelated |

**No conflicts detected** with existing architectural decisions.

## Technical Debt Implications

| Debt Type | Direction | Description |
|-----------|-----------|-------------|
| **Delay constants** | Reduced | Removes OLLAMA_REQUEST_DELAY_MS and BATCH_DELAY_MS magic numbers |
| **API version debt** | Reduced | Migrates from deprecated single-text endpoint |
| **Configuration debt** | Neutral | Adds p-limit but removes delay parameters |
| **Test debt** | Increased (temporary) | Requires new tests for batch API; old tests may need updates |

**Net impact**: Positive. This ADR reduces more debt than it creates.

## Reversibility Assessment

| Criterion | Status | Notes |
|-----------|--------|-------|
| Rollback capability | [PASS] | Can revert to single-text API without data loss |
| Vendor lock-in | [PASS] | p-limit is MIT-licensed, pure JS, replaceable |
| Exit strategy | [PASS] | Documented: "Revert embed tool to use generateEmbedding" |
| Data migration | [PASS] | No schema changes; embeddings remain compatible |

## Blocking Concerns Summary

**P0 Count**: 3
**P1 Count**: 4
**P2 Count**: 3

**Blocking recommendation**: Resolve P0 items before approval.

### Required P0 Resolutions

1. **Add chunk batch size limit**: Document max chunks per API call (recommend 32) with overflow handling
2. **Add memory pressure section**: Estimate memory consumption for concurrent scenario; add safeguard if needed
3. **Define retryable errors**: Explicitly list HTTP codes (5xx, ECONNRESET) and Ollama errors that trigger retry

## Recommendations

1. **Add chunk batching within notes**: For notes with many chunks, batch at 32 chunks max per API call

2. **Make concurrency configurable from day 1**: `EMBEDDING_CONCURRENCY` env var in Phase 0 prerequisites

3. **Add validation test before delay removal**: Confirm Ollama stability without delays on test corpus

4. **Specify metrics schema**: Define what Phase 3 metrics look like (embed_total, embed_duration_seconds histogram, embed_failures_total)

5. **Fix absolute paths**: Replace `/Users/peter.kloss/...` with relative paths in More Information section

---

**Review Status**: [BLOCKED]
**Next Step**: Return to ADR author for P0 resolution

**Handoff**: Once P0 items resolved, route to critic for multi-agent validation per adr-review protocol.
