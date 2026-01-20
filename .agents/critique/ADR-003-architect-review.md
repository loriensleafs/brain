# Architect Review: ADR-003 Embedding Quality Task Prefix Specification

**Reviewer**: Architect Agent
**Date**: 2026-01-19
**ADR**: ADR-003-embedding-task-prefix.md
**Status**: proposed

---

## Verdict

**[ACCEPT]**

ADR-003 is a well-structured, architecturally coherent decision that correctly separates a quality/correctness concern from the performance optimization in ADR-002.

---

## Structural Assessment

### MADR 4.0 Template Compliance

| Section | Present | Quality | Notes |
|---------|---------|---------|-------|
| Frontmatter (status, date, decision-makers) | Yes | Good | Proper YAML format with consulted/informed |
| Context and Problem Statement | Yes | Excellent | Evidence-based with Analysis 030 citation |
| Decision Drivers | Yes | Good | 6 drivers covering quality, correctness, compatibility |
| Considered Options | Yes | Good | 3 options with clear distinctions |
| Decision Outcome | Yes | Excellent | Explicit rationale with SOLID principle reference |
| Consequences | Yes | Excellent | Balanced good/bad/neutral assessment |
| Confirmation | Yes | Excellent | 5 concrete verification methods |
| Pros and Cons of Options | Yes | Excellent | Code examples for each option |
| Implementation Plan | Yes | Excellent | Phased with effort estimates |
| Validation Requirements | Yes | Excellent | 4 P-level requirements with code/command examples |
| Reversibility Assessment | Yes | Good | All 5 checkboxes addressed |
| Vendor Lock-in Assessment | Yes | Excellent | Lock-in indicators and exit strategy |
| More Information | Yes | Good | Related ADRs and external references |

**Structural Score**: 98/100

**Minor Gap**: The Team Agreement section shows "pending multi-agent review" which is correct for proposed status, but should be updated after adr-review completes.

### Completeness Verification

```text
[PASS] Problem statement is clear and specific
[PASS] Decision drivers trace to requirements (Analysis 030)
[PASS] At least two genuine alternatives considered (3 options)
[PASS] Pros/cons are balanced and evidence-based
[PASS] Justification references decision drivers (DRY, single responsibility)
[PASS] Consequences include both positive and negative (6 good, 2 bad, 1 neutral)
[PASS] Confirmation method is actionable (unit tests, integration tests, quality comparison)
[PASS] Status reflects current state (proposed)
[PASS] Related ADRs are linked (ADR-001, ADR-002)
[PASS] Reversibility assessment completed
```

---

## Architectural Coherence

### Alignment with System Design

**[PASS]** The decision aligns with the Brain system's architecture:

1. **Single Point of Change**: Adding prefix in `OllamaClient.generateEmbedding` follows the centralized API client pattern already established in the codebase.

2. **Layered Architecture**: The change is internal to the OllamaClient layer. Callers (embedding service, search service) remain unchanged, preserving abstraction boundaries.

3. **Configuration Strategy**: Option A (hardcoded) is appropriate for current single-use-case. The ADR correctly identifies Option C as the evolution path when multiple task types emerge.

### Pattern Consistency

**[PASS]** The decision follows established patterns:

| Pattern | ADR-003 Alignment |
|---------|-------------------|
| Centralized API clients | Prefix logic in OllamaClient, not call sites |
| Configuration via code first | Hardcoded default with environment variable path for future |
| Evidence-based decisions | Cites Analysis 030 with quantified estimates |
| Zero-cost improvements | 0% performance impact, 15-25% quality gain |

### Separation of Concerns

**[PASS]** ADR-003 correctly separates from ADR-002:

| Concern | ADR-002 | ADR-003 |
|---------|---------|---------|
| Focus | Performance optimization | Quality/correctness |
| Mechanism | Batch API, concurrency | Task prefix |
| Metrics | Throughput (13x improvement) | Semantic quality (15-25%) |
| Rollback criteria | Performance regression | Quality degradation |

This separation enables:
- Independent implementation timelines
- Independent validation criteria
- Independent rollback decisions

---

## Cross-ADR Coordination

### Relationship with ADR-002

**[PASS]** ADR-003 explicitly addresses coordination with ADR-002:

1. **Compatibility Statement** (line 29): "Must work with current single-text API and future batch API (ADR-002)"

2. **Implementation Coordination** (lines 49, 245-262): Batch API inherits prefix pattern:
   ```typescript
   const prefixedTexts = texts.map(t => `search_document: ${t}`);
   ```

3. **Cross-Reference** (lines 319-321): Links to ADR-002 in "Related ADRs" section

4. **Validation Requirement 3** (lines 243-262): Explicit batch API compatibility test

**Architecture Decision**: The `adr-002-task-prefix-placement.md` analysis document correctly justified this separation. The architect's prior analysis (that document) determined ADR-003 should be separate due to:
- Different concern (quality vs. performance)
- Different validation (semantic coherence vs. throughput)
- Different rollback criteria

### Relationship with ADR-001

**[PASS]** ADR-003 correctly identifies the dependency:

> "ADR-001: Search Service Abstraction - Search quality depends on embedding quality"

The task prefix improves embedding quality, which flows through to search quality. This is a correct architectural observation.

### Relationship with ADR-016

**[NEUTRAL]** No direct relationship. ADR-016 covers session protocol enforcement, which is orthogonal to embedding quality. No cross-reference needed.

### Dependencies

| Direction | ADR | Relationship |
|-----------|-----|--------------|
| ADR-003 depends on | None | Standalone quality fix |
| ADR-002 depends on | ADR-003 | Batch API should carry forward task prefix |
| ADR-001 benefits from | ADR-003 | Search quality improved by embedding quality |

**No conflicts detected.**

---

## Issues Identified

| ID | Priority | Issue | Recommendation |
|----|----------|-------|----------------|
| A1 | P2 | Hardcoded prefix assumes all embeddings are documents | Acceptable for current use case. Document that `search_query:` prefix needed for query embeddings when search-time embedding is implemented. |
| A2 | P2 | Implementation Plan line 197 mentions updating .env.example but task prefix is hardcoded, not configurable | Remove Phase 3 .env.example update or clarify it documents the model requirement, not a config variable. |
| A3 | P2 | External link to Nomic docs (line 326) may become stale | Consider adding archive.org link or extracting relevant specification text into ADR. |

### Issue Details

**A1 - Document vs. Query Prefix**

The ADR acknowledges this in line 52: "Neutral, because caller cannot override task type (may need configurable option later)"

However, when search queries are embedded (not just documents), they should use `search_query:` prefix per Nomic specification. This future concern is not fully documented.

**Recommendation**: Add to "Phase 4: Future Extensibility" section:

```markdown
When implementing query-time embedding for search, add:
- `search_query:` prefix for queries
- New method or parameter to `OllamaClient.generateEmbedding`
- See Nomic documentation for asymmetric retrieval requirements
```

**A2 - .env.example Clarification**

Phase 3 (lines 177-180) mentions updating .env.example to "document Nomic AI specification link." This is documentation, not configuration. The language could be clearer.

**Current**:
```markdown
1. **Update .env.example**
   - Add comment explaining task prefix requirement
   - Document Nomic AI specification link
```

**Suggested**:
```markdown
1. **Update documentation**
   - Add comment to client.ts explaining task prefix requirement
   - Document Nomic AI specification link in README or CONTRIBUTING
```

**A3 - External Link Durability**

Line 326 links to `https://www.nomic.ai/blog/posts/nomic-embed-text-v1`. Blog posts can move or be deleted.

**Recommendation**: Either:
1. Add archived version link
2. Extract relevant specification text into ADR (preferred for archival purposes)

---

## Architectural Strengths

1. **Evidence-Based**: ADR cites specific line numbers (`client.ts:35`), quantified estimates (15-25%), and references Analysis 030.

2. **Zero-Cost Principle**: Identifies improvement path with zero performance overhead. This is excellent architectural judgment.

3. **Future-Proof Design**: Phase 4 identifies Option C migration path when complexity increases.

4. **Vendor Lock-in Awareness**: Correctly identifies low lock-in level and provides exit strategy.

5. **Coordination Planning**: Explicit compatibility requirements with ADR-002 batch API.

---

## Domain Model Alignment

| Domain Concept | Current | After ADR-003 | Status |
|----------------|---------|---------------|--------|
| Document Embedding | Raw text to vector | Task-prefixed text to vector | Aligned with model spec |
| Embedding Quality | Undefined metric | Nomic spec compliance | Improved |
| OllamaClient Contract | Text in, vector out | Unchanged (prefix internal) | Maintained |

**Ubiquitous Language**: Introduces "task prefix" as domain concept. This aligns implementation with upstream model requirements.

---

## Abstraction Consistency

| Layer | Before | After | Consistency |
|-------|--------|-------|-------------|
| OllamaClient | Text to embedding | Text to embedding (prefix internal) | Maintained |
| Embedding Service | Note to chunks to embeddings | No change | Maintained |
| Search Service | Query to results | No change | Maintained |

**Interface Stability**: [PASS] Public interfaces unchanged. Internal improvement only.

---

## Final Recommendation

**Accept as-is with P2 documentation improvements tracked separately.**

The ADR is architecturally sound, well-structured, and correctly separated from ADR-002. The identified issues are minor documentation clarifications (P2) that do not affect the decision validity.

### Acceptance Conditions

| Condition | Status |
|-----------|--------|
| MADR 4.0 compliance | [PASS] |
| Architectural coherence | [PASS] |
| Cross-ADR coordination | [PASS] |
| P0 issues | None |
| P1 issues | None |
| P2 issues | 3 (tracked, not blocking) |

### Post-Acceptance Actions

1. **During Implementation**: Address A2 by clarifying Phase 3 scope (documentation vs. configuration)
2. **Future Work**: Track A1 (query prefix) as future enhancement when search-time embedding is implemented
3. **Maintenance**: Consider A3 (link durability) during next documentation update

---

## Comparison Summary

| Criterion | ADR-003 | Benchmark |
|-----------|---------|-----------|
| Template compliance | 98% | 95%+ expected |
| Options considered | 3 | 2 minimum |
| Evidence citations | 4 (Analysis 030, code lines, Nomic docs, ADR-002) | 2 minimum |
| Consequences documented | 9 (6 good, 2 bad, 1 neutral) | 3 minimum |
| Reversibility addressed | Complete | Required |
| Vendor lock-in assessed | Complete | Required |

**ADR-003 exceeds architectural standards.**

---

## Architect Sign-Off

**Verdict**: [ACCEPT]

**Rationale**: ADR-003 demonstrates sound architectural judgment by correctly separating a quality/correctness concern from performance optimization, providing comprehensive implementation guidance, and ensuring compatibility with related architectural decisions. The decision is reversible, has low vendor lock-in, and follows established patterns.

**Recommendation**: Proceed to multi-agent adr-review for consensus validation.

---

*Review completed: 2026-01-19*
*Reviewer: Architect Agent*
*Review duration: ~15 minutes*
