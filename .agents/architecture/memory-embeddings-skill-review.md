# Architecture Review: /memory-embeddings Skill Proposal

**Reviewer**: Architect Agent
**Date**: 2026-01-19
**Verdict**: ALTERNATIVE APPROACH

---

## Pattern Fit Assessment

**Finding**: Poor fit for diagnostic-fixer pattern.

**Rationale**:

session-log-fixer is a **deterministic fixer** that applies known template patches to protocol violations:

- Input: CI failure with exact missing requirement identified
- Fix: Copy template section from SESSION-PROTOCOL.md (100% deterministic)
- Verification: Validation script confirms compliance
- Complexity: Low (template copying, no decision-making)

memory-embeddings would be a **runtime error handler** dealing with non-deterministic API failures:

- Input: Runtime Ollama API errors (4xx/5xx status codes)
- Fix: Retry logic, rate limiting, circuit breakers (requires runtime decision-making)
- Verification: Re-run embedding generation (success not guaranteed)
- Complexity: High (error categorization, backoff calculation, resource management)

**Pattern Mismatch Evidence**:

| Characteristic | session-log-fixer | memory-embeddings |
|----------------|-------------------|-------------------|
| Error Detection | CI deterministic validation | Runtime API responses |
| Fix Type | Template copying | Retry with backoff |
| Decision Logic | None (apply template) | Complex (classify error, calculate delay) |
| Success Rate | 100% (deterministic) | Variable (depends on Ollama health) |
| Idempotency | Yes (same input = same output) | No (timing-dependent) |

**Conclusion**: session-log-fixer is a document repair tool. memory-embeddings would be a runtime resilience handler. These are fundamentally different patterns.

---

## Separation of Concerns Analysis

**Where Error Handling Should Live**:

### Option A: In Service Layer (RECOMMENDED)

**Location**: `apps/mcp/src/services/embedding/generateEmbedding.ts`

**Rationale**:

1. **Automatic resilience** - Every caller benefits from retry logic without manual intervention
2. **Fail-fast principle** - Errors surface at the right abstraction level
3. **Single Responsibility** - Embedding service owns embedding generation AND resilience
4. **Already implemented** - Analysis 025 identified retry logic already exists but is not used consistently

**Evidence from codebase**:

```typescript
// generateEmbedding.ts already has retry logic (lines 74-101)
for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
  try {
    return await client.generateEmbedding(text, "nomic-embed-text");
  } catch (error) {
    if (!isRetryableError(error)) {
      throw error;  // Fail fast on 4xx
    }
    await sleep(delay);
  }
}
```

**What's missing**: Error classification, circuit breaker, connection pooling (see Analysis 025 recommendations).

### Option B: In Skill (NOT RECOMMENDED)

**Rationale for rejection**:

1. **Reactive not preventive** - Fixes errors after they occur instead of preventing them
2. **User-invoked** - Requires manual detection and invocation
3. **Duplicate logic** - Service layer still needs error handling; skill would duplicate it
4. **Wrong abstraction** - Skills are for workflows, not infrastructure resilience
5. **No skill precedent** - No existing brain skills manage runtime service failures

**Skill catalog evidence** (23 existing skills):

- session-log-fixer: Fixes documentation protocol violations (deterministic)
- pr-comment-responder: Orchestrates PR comment workflow (multi-step)
- adr-review: Multi-agent ADR validation (orchestration)
- SkillForge: Skill creation and evolution (meta-workflow)

**None manage runtime service failures**. Infrastructure resilience is not a skill pattern.

### Option C: Both (OVER-ENGINEERED)

**Rationale for rejection**:

If service layer has proper resilience (retry, circuit breaker, rate limiting), what edge cases would skill address?

**Proposed skill use cases**:

1. "Retry failed embeddings" - Service layer already retries (MAX_RETRIES = 3)
2. "Batch processing failures" - Already handled by queue processor (`retry.ts`)
3. "Manual intervention after service exhaustion" - This is an operational problem, not a skill problem

**Conclusion**: If service layer is fixed per Analysis 025 recommendations, skill has no unique value.

---

## Progressive Disclosure Evaluation

**Proposed Structure**:

- SKILL.md - Main workflow
- references/error-categorization.md - Retry vs fix vs skip
- references/fix-patterns.md - Diagnostic fixes for 4xx errors
- references/performance-tuning.md - Batch/concurrency optimization
- references/troubleshooting.md - Common issues

**Assessment**: 4 reference files are **not justified**.

**Comparison with session-log-fixer**:

| Reference File | Purpose | Justification |
|----------------|---------|---------------|
| common-fixes.md | Copy-paste ready fixes for specific validation failures | High reuse (10+ failure types) |
| template-sections.md | Session Start/End protocol tables | High reuse (2 templates × 10+ fields) |
| ci-debugging-patterns.md | Advanced job-level diagnostics | Edge cases (non-standard failures) |

Each session-log-fixer reference serves a **distinct, high-reuse purpose**.

**Proposed memory-embeddings references overlap significantly**:

- error-categorization.md: Classify 4xx vs 5xx → 20 lines max, belongs in SKILL.md
- fix-patterns.md: Retry logic → Already in service layer, not user-facing
- performance-tuning.md: Batch size, delays → Configuration, not skill workflow
- troubleshooting.md: Common issues → Overlaps with error-categorization

**Verdict**: 1 reference file max (troubleshooting.md for Ollama-specific issues). Rest belongs in SKILL.md or service layer documentation.

---

## Alternative Architectures

### Alternative 1: Service Layer Enhancement (RECOMMENDED)

**Approach**: Implement Analysis 025 recommendations directly in embedding service.

**Changes**:

1. **Add retry with error classification** (generateEmbedding.ts):
   - Already partially implemented (lines 74-101)
   - Missing: Error classification (4xx vs 5xx), circuit breaker
   - Effort: 2 hours

2. **Connection pooling** (generateEmbedding.ts):
   - Reuse single OllamaClient instance (already implemented, lines 21-32)
   - Effort: Complete (no additional work)

3. **Rate limiting** (embed tool):
   - Increase delay from 100ms to 200-500ms
   - Effort: 5 minutes

4. **Health check before batch** (embed tool):
   - Add pre-flight Ollama health check
   - Already implemented (lines 135-155)
   - Effort: Complete (no additional work)

**Outcome**: 58% failure rate → 5-10% failure rate (transient errors only). No skill needed.

**Effort**: 2-3 hours total (Analysis 025 P0/P1 recommendations).

### Alternative 2: CLI Flag Enhancement

**Approach**: Add `--retry` flag to brain CLI embed command.

**Example**:

```bash
brain embed --retry 3 --delay 500ms --on-error skip
```

**Rationale**:

- Users already invoke `brain embed` for batch generation
- Flags provide runtime control without new skill
- Simpler mental model (single command, not skill workflow)

**Effort**: 1 hour (add CLI argument parsing).

**Trade-off**: Less sophisticated than service-layer resilience (flag must be remembered).

### Alternative 3: Operational Runbook (SIMPLEST)

**Approach**: Document Ollama failure troubleshooting in Brain MCP user guide.

**Location**: `apps/mcp/docs/troubleshooting/embedding-failures.md`

**Contents**:

1. Verify Ollama is running: `ollama serve`
2. Check model is loaded: `ollama list`
3. Monitor Ollama logs: `journalctl -u ollama -f`
4. Adjust concurrency in embed tool (code change, not user-facing)

**Rationale**:

- Embedding failures are operational issues, not workflow issues
- Users don't fix infrastructure problems with skills
- Documentation is sufficient for rare edge cases

**Effort**: 30 minutes.

**When appropriate**: If service layer fixes reduce failure rate to <5%.

---

## ADR Gap Analysis

**ADR Search Result**: No ADR-002 found in `/apps/mcp/docs/architecture/`.

**Implication**: Embedding service architecture is undocumented.

**Gaps**:

1. **No retry policy documented** - MAX_RETRIES, backoff strategy, error classification
2. **No resilience patterns documented** - Circuit breaker, rate limiting, connection pooling
3. **No failure mode analysis** - What happens when Ollama crashes, runs out of memory, etc.
4. **No observability strategy** - How to diagnose embedding failures in production

**Recommendation**: Create ADR-002 documenting embedding service resilience architecture.

**Scope**:

- Retry policy (attempts, backoff, error classification)
- Connection management (pooling, keep-alive, timeout)
- Rate limiting (delay between requests, batch size)
- Circuit breaker (threshold, recovery)
- Monitoring and alerting

**Effort**: 2 hours.

**Benefit**: Establishes architectural principles. Skill would be tactical band-aid without architectural foundation.

---

## Design Concerns

### 1. Skill as Workaround for Service Deficiency

**Problem**: Proposal creates user-facing skill to compensate for missing service-layer resilience.

**Analogy**: Creating a "fix database connection" skill instead of implementing connection pooling.

**Principle Violated**: **Don't expose infrastructure failures as user workflows**.

**Correct Approach**: Fix the infrastructure, not create workarounds.

### 2. Reactive Not Preventive

**Problem**: Skill activates AFTER failures occur.

**Better**: Service layer prevents failures automatically.

**Evidence**: Analysis 025 shows 58% failure rate is due to missing retry logic (95% confidence).

**Conclusion**: Preventive fix (service layer) eliminates need for reactive skill.

### 3. Unclear Success Criteria

**Question**: When would user invoke `/memory-embeddings`?

**Scenarios**:

1. "Embedding failed with 500 error" → Service layer should retry automatically
2. "Batch failed after 3 retries" → Operational issue (Ollama down), not skill-fixable
3. "Want to optimize batch performance" → Configuration, not skill

**None require a skill**. First is service layer, second is ops, third is config.

### 4. No Precedent in Skill Catalog

**23 existing skills** - None manage runtime service failures.

**Skill types identified**:

- Workflow orchestration (pr-comment-responder, adr-review)
- Document generation/fixing (session-log-fixer, SkillForge)
- Knowledge management (memory, curating-memories)
- Code generation (slashcommandcreator, programming-advisor)

**Infrastructure resilience is absent**. This would create a new, questionable pattern.

### 5. Maintenance Burden

**Skill maintenance requires**:

- Keeping error categorization updated as Ollama changes
- Maintaining fix patterns for different Ollama versions
- Testing against Ollama API changes
- Documenting edge cases

**Service layer maintenance requires**:

- Standard retry logic (stable pattern)
- Error classification based on HTTP status (stable)
- Tests covering retry behavior (already exist)

**Verdict**: Service layer is lower maintenance burden.

---

## Verdict

**ALTERNATIVE APPROACH**: Implement Analysis 025 recommendations in service layer instead of creating skill.

**Rationale**:

1. **Pattern mismatch** - Skill pattern is for deterministic document fixes, not runtime resilience
2. **Wrong layer** - Infrastructure resilience belongs in service, not user-facing skill
3. **Analysis 025 already solved this** - Recommendations exist, just need implementation
4. **No unique value** - If service layer is fixed, skill has no use cases
5. **No ADR foundation** - Need architectural principles before tactical tools
6. **No precedent** - Creating new skill category without justification

---

## Specific Architectural Guidance

### Immediate Actions (P0)

1. **Implement Analysis 025 P0 fixes** (2 hours):
   - Add retry with exponential backoff to generateEmbedding (already partially implemented)
   - Add error classification (4xx permanent, 5xx retryable)
   - Verify connection pooling (already implemented)

2. **Measure improvement** (30 minutes):
   - Run batch embedding generation
   - Log failure rate before/after
   - Target: <10% failure rate

3. **If failure rate remains high** (> 10%):
   - Create operational runbook documenting troubleshooting
   - Do NOT create skill

### Medium-Term Actions (P1)

1. **Create ADR-002: Embedding Service Resilience** (2 hours):
   - Document retry policy
   - Document error handling strategy
   - Document rate limiting rationale
   - Document observability approach

2. **Add monitoring** (3 hours):
   - Log retry attempts with statusCode
   - Track success/failure rates
   - Alert on sustained high failure rates

### When to Reconsider Skill

**Only if** all of the following are true:

1. Service layer has proper resilience implemented
2. Failure rate is <5% (unavoidable transient errors only)
3. Users report specific edge cases requiring manual intervention
4. Edge cases are **workflow-related** not **operational**

**Example valid edge case**: "I want to prioritize embedding specific notes first" → Workflow orchestration, appropriate for skill.

**Example invalid edge case**: "Ollama keeps crashing" → Operational issue, not skill-fixable.

---

## Conclusion

**Recommendation**: Reject `/memory-embeddings` skill proposal. Implement Analysis 025 service layer fixes instead.

**Confidence**: High (90%)

**Next Steps**:

1. Route to implementer with Analysis 025 P0 recommendations
2. After implementation, route to qa for verification
3. If failure rate remains high, route to analyst for deeper investigation
4. Do NOT create skill unless service layer fixes fail

**Architectural Principle Reinforced**: Infrastructure resilience belongs in service layer, not user-facing workflows.
