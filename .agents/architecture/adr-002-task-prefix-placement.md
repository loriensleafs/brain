# ADR-002 Task Prefix Placement Decision

**Date**: 2026-01-19
**Architect**: Claude Code Architect Agent
**Context**: User proposes adding "search_document:" task prefix fix to ADR-002

## Question

Should the "search_document:" task prefix fix be added to ADR-002 (Embedding Performance Optimization)?

## Analysis

### Scope Alignment Assessment

**ADR-002 Title**: "Embedding Performance Optimization: Batch API Migration with Concurrency Control"

**ADR-002 Focus**: Performance optimization through:

1. Batch API migration (`/api/embeddings` → `/api/embed`)
2. Concurrency control (p-limit)
3. Delay removal
4. Timeout reduction

**Task Prefix Fix**:

- **Purpose**: Correctness/quality (not performance)
- **Impact**: 15-25% embedding quality improvement per Analysis 030
- **Mechanism**: Proper model usage (required by nomic-embed-text specification)
- **Performance**: Zero performance cost

### Architectural Concerns

**[CONCERN 1] Scope Creep**

ADR-002 is titled "Performance Optimization" but task prefix is a quality/correctness fix. Adding it creates semantic drift where the ADR's title no longer accurately represents its scope.

**[CONCERN 2] Decision Rationale Clarity**

ADR-002 was "accepted" by 6-agent consensus based on performance justification. Adding a quality fix post-consensus blurs the decision rationale - was it accepted for performance, quality, or both?

**[CONCERN 3] Implementation Coupling**

The task prefix fix touches the same file (`client.ts`) as batch migration, creating temptation to bundle changes. This violates atomic commit principles and makes rollback more complex.

**[CONCERN 4] API Compatibility**

Task prefix works for BOTH APIs:

- Current: `/api/embeddings` with `prompt: "search_document: " + text`
- New: `/api/embed` with `input: ["search_document: " + text1, ...]`

This suggests it's orthogonal to the batch migration decision.

### Precedent Analysis

**Related Concerns from ADR-002 Debate**:

From consensus record (lines 7-8):

- `consensus: 4-accept-2-disagree-and-commit`
- Decision focused on performance tradeoffs, not quality

**Phase Structure in ADR-002**:

Phases 0-4 are organized around batch migration:

- Phase 0: Prerequisites (dependency, version check)
- Phase 1: Core batch API changes
- Phase 2: Timeout optimization
- Phase 3: Monitoring
- Phase 4: Testing

No phase is dedicated to "correctness fixes" or "quality improvements."

### Discovered During Implementation vs. Part of Decision

**Discovery Context**: Analysis 030 (markdown sanitization research) identified missing task prefix as separate P0 issue.

**Timing**: Discovered after ADR-002 acceptance, during performance optimization research.

**Relationship**: Adjacent concern (embedding quality) discovered while investigating performance, not a performance optimization itself.

## Recommendation

**NO - Create Separate ADR**

### Rationale

1. **Architectural Separation**: Quality/correctness concerns should be distinct from performance optimizations to maintain clear decision boundaries.

2. **Title Accuracy**: ADR-002's title explicitly states "Performance Optimization." Adding non-performance changes creates semantic debt.

3. **Atomic Decisions**: Each ADR should address a single architectural decision. Bundling quality + performance creates two decisions under one ADR number.

4. **Independent Lifecycle**: Task prefix can be implemented independently (works with current API), has different rollback criteria (quality degradation vs. performance regression), and different validation requirements.

5. **Consensus Integrity**: The 6-agent consensus was based on performance justification. Adding quality fixes post-consensus circumvents the review process.

## Alternative Approach

### Create ADR-003: Embedding Quality - Task Prefix Requirement

**Proposed Title**: "Embedding Quality: Implement nomic-embed-text Task Prefix Specification"

**Scope**:

- Add `search_document:` prefix to document embeddings
- Add `search_query:` prefix to query embeddings (future)
- Validate compliance with Nomic model specification

**Decision Drivers**:

- Model specification compliance (Nomic docs require task prefix)
- 15-25% embedding quality improvement (Analysis 030)
- Zero performance cost
- Works with both current and future batch API

**Implementation**:

- Phase 0: Add prefix to current API immediately (quick win)
- Phase 1: Carry forward to batch API during ADR-002 implementation
- No additional dependencies or infrastructure changes

**Why Separate**:

- Different concern (quality vs. performance)
- Different validation (semantic coherence vs. throughput)
- Different rollback criteria (embedding quality degradation vs. performance regression)
- Can be implemented independently of ADR-002

### Implementation Coordination

**Option 1: Sequential (Recommended)**

```text
1. Implement ADR-003 (task prefix) against current API
2. Implement ADR-002 (batch migration), carrying forward task prefix
```

Benefits:

- Immediate quality improvement before performance work
- Simpler rollback (can revert batch migration without losing task prefix)
- Independent validation of each change

**Option 2: Parallel**

```text
1. Implement ADR-003 (task prefix) in current API
2. Implement ADR-002 (batch migration) in parallel branch
3. Merge ADR-002 incorporates ADR-003 changes
```

Benefits:

- Faster overall timeline
- Both improvements delivered together

Risks:

- Merge conflicts in `client.ts`
- Harder to attribute quality changes to task prefix vs. batch API

**Option 3: Coupled (Not Recommended)**

```text
1. Add task prefix as part of ADR-002 Phase 1
```

Drawbacks:

- Violates atomic commit principle
- Makes rollback harder (all-or-nothing)
- Conflates quality and performance validation
- Creates scope creep in ADR-002

## ADR Review Requirement

**YES - ADR-003 Must Trigger adr-review**

Rationale:

1. Creates new ADR file matching `.agents/architecture/ADR-*.md`
2. Architectural decision (model usage pattern affects all embeddings)
3. Quality implications across entire semantic search system
4. Per AGENTS.md Section "ADR Review Requirement (MANDATORY)"

Process:

1. Architect creates ADR-003 draft
2. Returns to orchestrator with MANDATORY routing signal
3. Orchestrator invokes adr-review skill
4. Multi-agent validation completes
5. Orchestrator routes to implementer only after PASS

## Implementation Impact on ADR-002

### Required Coordination

If ADR-003 is accepted and implemented BEFORE ADR-002:

**ADR-002 Phase 1 Update Required**:

Current plan (line 360-363):

```markdown
1. **Add batch embedding method to OllamaClient**
   - File: `src/services/ollama/client.ts`
   - Add `generateBatchEmbeddings(texts: string[]): Promise<number[][]>`
   - Add types to `types.ts`
```

Updated plan:

```markdown
1. **Add batch embedding method to OllamaClient**
   - File: `src/services/ollama/client.ts`
   - Add `generateBatchEmbeddings(texts: string[]): Promise<number[][]>`
   - CARRY FORWARD task prefix from ADR-003 (already in generateEmbedding)
   - Add types to `types.ts`
```

**Code Example for ADR-002 Implementation**:

```typescript
async generateBatchEmbeddings(
  texts: string[],
  model: string = "nomic-embed-text"
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  // Add task prefix per ADR-003 (already implemented in single-text API)
  const prefixedTexts = texts.map(t => `search_document: ${t}`);

  const response = await fetch(`${this.baseUrl}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: prefixedTexts }),
    signal: AbortSignal.timeout(this.timeout),
  });

  // ... rest of implementation
}
```

### No Changes to ADR-002 Decision

Adding task prefix does NOT change:

- Performance estimates (13x improvement still valid)
- Batch API choice
- Concurrency model
- Timeout cascade
- Error handling strategy

The task prefix is a **separate concern** that applies to both current and future APIs.

## Domain Model Alignment

| Domain Concept | Current Representation | With Task Prefix | Alignment Status |
|----------------|----------------------|------------------|------------------|
| Document Embedding | Raw text → vector | Task-prefixed text → vector | **Improved** (spec-compliant) |
| Semantic Search | Vector similarity only | Task-aware vector similarity | **Improved** (model-aware) |
| Embedding Quality | Undefined quality metric | Nomic spec compliance | **Aligned** with upstream model |

**Ubiquitous Language Impact**: Introduces "task prefix" as domain concept, aligning our implementation with Nomic model's expected input format.

## Abstraction Consistency

| Layer | Current Abstraction | Change Impact | Consistency Status |
|-------|--------------------|--------------|--------------------|
| OllamaClient | Text → Embedding | Add prefix internally | **Maintained** (callers unchanged) |
| Embedding Service | Note → Chunks → Embeddings | No change | **Maintained** |
| Search Service | Query → Results | No change | **Maintained** |

**Abstraction Level**: Task prefix is internal to OllamaClient, preserving API contract for callers.

**Interface Stability**: Public interfaces (embed tool, search tool) unchanged. This is an internal quality improvement.

## Reversibility Assessment

### Rollback Capability

```markdown
- [ ] **Rollback capability**: Changes can be rolled back without data loss
      ✓ Task prefix only affects NEW embeddings
      ✓ Existing embeddings remain valid (lower quality but functional)
      ✓ Rolling back removes prefix (reverts to current behavior)

- [ ] **Vendor lock-in**: No new vendor lock-in introduced
      ✓ Task prefix is Nomic model specification, not Ollama lock-in
      ✓ Other embedding models may ignore prefix (graceful degradation)

- [ ] **Exit strategy**: If switching embedding models, prefix can be:
      ✓ Kept (most models ignore unknown prefixes)
      ✓ Removed (single-line change in client.ts)
      ✓ Adapted (replace "search_document:" with model-specific prefix)

- [ ] **Legacy impact**: No impact on existing systems
      ✓ Change is additive (adds prefix, doesn't break existing code)
      ✓ No database schema changes
      ✓ No API contract changes

- [ ] **Data migration**: Reversing this decision does not orphan data
      ✓ Old embeddings (without prefix) still searchable
      ✓ New embeddings (with prefix) backward compatible
      ✓ No data corruption risk
```

**Reversibility Level**: **Low Risk**

Rollback requires single-line change in `client.ts`. No data migration needed.

## Conclusion

**Create ADR-003 as separate architectural decision** for the following reasons:

1. **Scope Separation**: Quality/correctness is distinct from performance optimization
2. **Title Accuracy**: Maintains ADR-002's focus on performance
3. **Atomic Decisions**: Each ADR addresses one concern
4. **Independent Lifecycle**: Can be implemented, validated, and rolled back separately
5. **Consensus Integrity**: Allows proper multi-agent review of quality decision

**Coordination Strategy**: Implement ADR-003 first (15 min), then ADR-002 carries forward task prefix to batch API.

**ADR-002 Impact**: Minimal - Phase 1 implementation carries forward existing task prefix pattern to new batch method. No decision changes required.

## Questions for User

1. **Preference**: Sequential (ADR-003 → ADR-002) or parallel implementation?
2. **Timeline**: Willing to delay ADR-002 by ~1 hour for ADR-003 review + implementation?
3. **Scope**: Should ADR-003 also address query prefixes (`search_query:`) or document-only?

## Next Steps

If user approves separate ADR approach:

1. Architect creates ADR-003 draft
2. Returns to orchestrator with MANDATORY routing for adr-review
3. adr-review skill validates ADR-003
4. Implementer executes ADR-003 (15 min implementation)
5. ADR-002 implementation proceeds with task prefix already in place

**Estimated Additional Timeline**: +1-2 hours for ADR-003 (30 min draft + 30 min review + 15 min implementation + 15 min validation)
