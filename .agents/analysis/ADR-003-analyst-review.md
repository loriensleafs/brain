# Analyst Review: ADR-003 Embedding Quality Task Prefix

**Date**: 2026-01-19
**Analyst**: Analyst Agent
**ADR**: ADR-003-embedding-task-prefix.md
**Status**: NEEDS EVIDENCE

---

## Verdict

**NEEDS EVIDENCE**

The ADR proposes a valid technical change (adding task prefixes for nomic-embed-text), but the primary supporting claim (15-25% quality improvement) lacks substantiation. The decision is sound but requires evidence revision.

---

## Evidence Assessment

### Claim 1: "nomic-embed-text requires task prefixes"

**Assessment**: [PARTIALLY VERIFIED]

**Evidence Found**:
- HuggingFace documentation states: "the text prompt _must_ include a _task instruction prefix_"
- However, Nomic API documentation states: "default is `search_document` if no `task_type` is provided"

**Discrepancy**: There is a difference between:
1. **Nomic API/SDK usage**: task_type parameter with defaults (does NOT require manual prefix)
2. **Third-party library usage (Transformers, SentenceTransformers, Ollama)**: Requires manual prefix in text

**Implication**: The requirement depends on the interface used. Ollama falls into category 2 (third-party), so prefixes ARE required for proper model behavior.

**Confidence**: High (85%) that prefix is required when using Ollama.

### Claim 2: "15-25% quality improvement"

**Assessment**: [NOT SUBSTANTIATED]

**Evidence Search Results**:
- Nomic documentation: No quality percentage mentioned
- HuggingFace model card: No percentage improvement mentioned
- Analysis 030 (cited source): Provides the claim but no external citation
- Web search: No benchmarks comparing prefix vs. no-prefix embedding quality

**Problem**: The 15-25% figure appears to be invented or estimated without empirical basis. Analysis 030 does not cite a source for this claim.

**Quote from ADR-003 line 19**:
> "Quality improvement estimate: 15-25% better semantic coherence"

This is presented as fact but lacks citation.

**Confidence**: Low (20%) - claim appears fabricated.

### Claim 3: "Zero performance cost"

**Assessment**: [VERIFIED]

String concatenation in JavaScript/TypeScript is O(n) and negligible for text lengths in this use case. No evidence suggests measurable overhead.

**Confidence**: High (95%)

---

## Feasibility Analysis

### Technical Implementation

**Assessment**: [PASS]

The proposed implementation is straightforward:

```typescript
const prefixedText = `search_document: ${text}`;
```

**Risks Identified**:

1. **Model-specific hardcoding**: The prefix "search_document:" is specific to nomic-embed-text. If the model changes, the prefix format may need adjustment.

2. **Query embedding gap**: ADR-003 focuses on document embedding (`search_document`) but does not address search queries. The search service should use `search_query:` prefix for queries to maximize retrieval quality.

3. **Batch API compatibility**: Confirmed compatible. The batch API (`/api/embed`) accepts an array of strings, each can be prefixed independently.

### Implementation Effort

ADR claims 15 minutes for core change. This is reasonable:
- 1 line of code change
- 1 unit test addition
- No schema changes
- No API contract changes

---

## Root Cause Validation

### Problem Statement Analysis

**ADR Claim**: "Current implementation sends raw text without task instruction prefixes. According to Nomic AI documentation, nomic-embed-text requires task prefixes."

**Root Cause Assessment**: [PARTIALLY VALID]

The actual problem is nuanced:

1. **For Nomic API users**: task_type parameter has defaults; prefix is optional
2. **For Ollama users**: No task_type parameter exists; prefix in text IS required

Since Brain uses Ollama (not Nomic API directly), the prefix requirement is real but mislabeled. The root cause is:

> "Ollama does not translate the nomic-embed-text task_type parameter, requiring manual text prefixing."

**Recommendation**: Update ADR context to clarify this distinction.

---

## Compatibility Check

### Current API Compatibility

**Status**: [PASS]

Current `/api/embeddings` endpoint accepts:
```json
{ "model": "nomic-embed-text", "prompt": "search_document: text here" }
```

Prefix can be added without API changes.

### Batch API Compatibility (ADR-002)

**Status**: [PASS]

Future `/api/embed` endpoint accepts:
```json
{ "model": "nomic-embed-text", "input": ["search_document: text1", "search_document: text2"] }
```

ADR-002 implementation plan already shows prefix carrying forward (line 218):
```typescript
const prefixedTexts = texts.map(t => `search_document: ${t}`);
```

### Search Query Consideration

**Status**: [WARNING]

ADR-003 addresses document embedding but search service also generates embeddings for queries. For optimal retrieval:
- Documents: `search_document: <text>`
- Queries: `search_query: <query>`

Current search service (`apps/mcp/src/services/search/index.ts`) generates query embeddings. ADR-003 should address this or explicitly defer to future ADR.

---

## Issues Identified

| ID | Priority | Issue | Recommendation |
|----|----------|-------|----------------|
| AN1 | P0 | **Unsubstantiated quality claim**: "15-25% improvement" has no citation or empirical basis | Remove percentage claim or provide benchmark. Change to "improves embedding quality by following model specification" |
| AN2 | P1 | **Misleading requirement language**: Requirement depends on interface (Nomic API vs Ollama) | Clarify that prefix is required specifically for Ollama integration |
| AN3 | P1 | **Query embedding gap**: `search_query:` prefix not addressed for search queries | Add Phase 4 or separate ADR for query prefix implementation |
| AN4 | P2 | **Missing validation metric**: "Visual inspection" and "manual review" are not quantifiable | Define success criteria: e.g., "mean reciprocal rank improves on test queries" |
| AN5 | P2 | **Reversibility wording**: States "existing embeddings remain valid" but quality differs | Clarify: existing embeddings work but may have lower retrieval quality |

---

## Final Recommendation

**Accept with revisions**

The technical decision is sound. Adding task prefixes is the correct approach for using nomic-embed-text through Ollama. However, the ADR requires evidence quality improvements:

### Required Changes (before acceptance)

1. **Remove or revise the 15-25% claim**. Replace with:
   > "Embedding quality improves by following Nomic model specification. The magnitude of improvement is use-case dependent and should be validated through search relevance testing."

2. **Clarify the Ollama-specific requirement**. Add note:
   > "When using nomic-embed-text through the Nomic API, task_type is a parameter with defaults. When using through Ollama, the prefix must be included in the text itself."

3. **Address query embedding**. Either:
   - Add Phase 4 for `search_query:` prefix in search service, OR
   - Explicitly state this is deferred to a future ADR

### Optional Improvements

4. Define quantifiable validation metrics (MRR, precision@k)
5. Add benchmark test comparing retrieval quality before/after

---

## Data Transparency

### Found
- Nomic HuggingFace documentation confirming prefix requirement for third-party libraries
- Nomic API documentation showing task_type parameter defaults
- Ollama API specification showing no task_type parameter support
- ADR-002 batch API compatibility confirmation

### Not Found
- Empirical benchmark showing 15-25% quality improvement
- Any quantified comparison of prefix vs. no-prefix embedding quality
- Documentation of nomic-embed-text behavior without prefix through Ollama

---

## Sources

- [Nomic Embed Text v1.5 HuggingFace](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5) - Task prefix requirements
- [Nomic API Documentation](https://docs.nomic.ai/reference/api/embed-text-v-1-embedding-text-post) - task_type parameter
- Analysis 030: `.agents/analysis/030-markdown-sanitization-for-embeddings.md`
- ADR-002: `.agents/architecture/ADR-002-embedding-performance-optimization.md`
