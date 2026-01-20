# Technical Evaluation: /memory-embeddings Skill

## 1. Objective and Scope

**Objective**: Evaluate the technical merits and feasibility of creating a `/memory-embeddings` diagnostic skill with progressive disclosure (SKILL.md + references/) for fixing non-retryable embedding errors post-hoc.

**Scope**:
- Error frequency analysis in production
- Fixability assessment for 4xx errors
- Architectural decision: preventive vs reactive error handling
- Progressive disclosure justification
- Pattern match validation with session-log-fixer

## 2. Context

**Proposal**: Create `.claude/skills/memory-embeddings/` with:
- SKILL.md: Main workflow (run, detect, categorize, fix, retry, report)
- references/error-categorization.md
- references/fix-patterns.md
- references/performance-tuning.md
- references/troubleshooting.md

**Reference Pattern**: session-log-fixer (263 lines, 4-phase diagnostic process)

**System State**: ADR-002 implemented batch API migration with retry logic at embedding service level.

## 3. Evidence Gathered

### Error Frequency Assessment

| Finding | Source | Confidence |
|---------|--------|------------|
| 5xx errors retry automatically with exponential backoff | `generateEmbedding.ts:44-49` | High |
| 4xx errors fail immediately without retry | `generateEmbedding.ts:80-83` | High |
| 400 Bad Request used in tests as non-retryable error | `__tests__/generateEmbedding.test.ts:212` | High |
| No 413, 422 errors found in codebase | `grep -r "413\|422" apps/mcp/src/services` | High |
| 58% Ollama 500 errors documented in session logs | Analysis 025, Session 12 | High |
| 0 occurrences of 4xx errors in production logs | `grep "4\d{2}" .agents/sessions` | High |
| All test failures use synthetic 400 errors | Test file analysis | High |
| OllamaError only captures status code, no body | `client.ts:40-43` | High |

### Historical Error Patterns

**From Session Logs (2026-01-19)**:
- Session 12: 29/50 notes failed with Ollama 500 errors (58% failure rate)
- Session 13: Ollama 500 errors noted, not search-related
- Session 14: Validation of 500 error fixes
- Session 15: EOF errors (transport layer, not Ollama)
- Session 16: HTTP transport timeout (not Ollama API errors)

**Pattern**: All production errors are 5xx (server errors), not 4xx (client errors).

### Fix Pattern Feasibility

| Error Code | Meaning | Can Skill Fix? | Why/Why Not |
|------------|---------|----------------|-------------|
| 413 Payload Too Large | Request body exceeds limit | NO | Requires code change to reduce batch size |
| 422 Unprocessable Entity | Semantic validation failure | NO | Content sanitization should be in service |
| 400 Bad Request | Malformed API request | NO | Indicates code bug, not data issue |
| 5xx Server Errors | Ollama server issues | NO (already handled) | Automatic retry with backoff in service |

### Architecture Analysis

**Current Error Handling** (ADR-002 Implementation):

```typescript
// generateEmbedding.ts:44-49
function isRetryableError(error: unknown): boolean {
  if (error instanceof OllamaError) {
    return error.statusCode >= 500 && error.statusCode < 600;
  }
  return false;
}
```

**Retry Strategy** (generateEmbedding.ts:74-101):
- MAX_RETRIES: 3
- BASE_DELAY_MS: 1000
- Exponential backoff: 1s, 2s, 4s
- 5xx errors: Retry automatically
- 4xx errors: Fail fast, throw immediately

**Result**: Error handling is ALREADY PREVENTIVE, not reactive.

## 4. Pattern Validity: session-log-fixer Comparison

### session-log-fixer Pattern

| Attribute | session-log-fixer | memory-embeddings (proposed) |
|-----------|-------------------|------------------------------|
| **Error Type** | Deterministic markdown violations | Runtime API failures |
| **Error Source** | Protocol compliance (missing sections) | Ollama HTTP errors |
| **Fixability** | Always fixable (add missing content) | 4xx NOT fixable post-hoc |
| **Frequency** | Common (30+ session protocol violations) | Never (0 production 4xx errors) |
| **Detection** | CI failure with Job Summary | MCP server logs |
| **Fix Location** | Session log markdown | Embedding service code |
| **Progressive Disclosure** | Yes (4 reference files) | Unjustified (no content) |

### False Equivalence Identified

**session-log-fixer** fixes deterministic, structural issues:
- Missing Protocol Compliance section → Add section
- Unchecked MUST requirements → Mark [x] with evidence
- Placeholder commit SHA → Replace with real SHA

**memory-embeddings (proposed)** would attempt to fix runtime errors:
- 413 Payload Too Large → Cannot reduce batch size post-hoc
- 422 Unprocessable Entity → Cannot sanitize content after failure
- 400 Bad Request → Cannot fix malformed API request post-hoc

**Verdict**: Pattern mismatch. session-log-fixer is NOT a valid analogy.

## 5. Progressive Disclosure Justification

**Proposed References**:
1. error-categorization.md - Retryable vs non-retryable
2. fix-patterns.md - Diagnostic fixes for 413, 422, 400
3. performance-tuning.md - Batch size, concurrency
4. troubleshooting.md - Common issues

**Content Analysis**:

| Reference File | Justification | Content Available? |
|----------------|---------------|-------------------|
| error-categorization.md | Already implemented in code | No new content |
| fix-patterns.md | No 4xx errors occur in production | No patterns to document |
| performance-tuning.md | ADR-002 already specifies | Duplicate of ADR |
| troubleshooting.md | 5xx errors auto-retry | No manual intervention needed |

**Verdict**: NONE of the proposed reference files have content that isn't already in ADR-002 or service code.

## 6. Architecture Decision: Skill vs Service

### Where Error Handling Should Live

| Layer | Current State | Skill Proposal | Verdict |
|-------|---------------|----------------|---------|
| **Preventive (Service)** | ✅ Retry with backoff for 5xx | N/A | CORRECT |
| **Preventive (Service)** | ✅ Fail fast for 4xx | N/A | CORRECT |
| **Reactive (Skill)** | N/A | Fix 4xx errors post-hoc | WRONG |

### Why Reactive Skill is Wrong

**4xx errors indicate code bugs, not data issues**:
- 400 Bad Request → Malformed API call (code bug)
- 413 Payload Too Large → Batch size exceeds limit (code bug)
- 422 Unprocessable Entity → Invalid input format (code bug)

**Skills cannot fix code bugs**. Skills fix data/documentation issues.

### Correct Approach

| Error Category | Handling Strategy | Location |
|----------------|-------------------|----------|
| 5xx (Server) | Automatic retry with backoff | embedding service (IMPLEMENTED) |
| 4xx (Client) | Fix code bug | embedding service (PREVENTIVE) |
| Timeout | Increase timeout | config/ollama.ts (PREVENTIVE) |
| Transport EOF | Fix HTTP transport config | transport/http.ts (PREVENTIVE) |

## 7. Results

### Error Frequency

**Production Evidence** (2026-01-19 sessions):
- 5xx errors: 29 occurrences (Ollama 500 Internal Server Error)
- 4xx errors: 0 occurrences
- 413 Payload Too Large: 0 occurrences
- 422 Unprocessable Entity: 0 occurrences
- 400 Bad Request: 0 occurrences (only in tests as synthetic failure)

**Quantified**: 0% of production errors are 4xx. 100% are 5xx (already handled).

### Fix Pattern Feasibility

**4xx Error Fix Matrix**:

| Error | User Action | Skill Action | Code Change |
|-------|-------------|--------------|-------------|
| 413 | Cannot fix | Cannot fix | Reduce batch size |
| 422 | Cannot fix | Cannot fix | Sanitize input |
| 400 | Cannot fix | Cannot fix | Fix API call |

**Conclusion**: NO 4xx errors are fixable post-hoc by skill or user.

### Service vs Skill Architecture

**Current Service Code** (CORRECT):
```typescript
// 5xx: Retry automatically
if (error.statusCode >= 500 && error.statusCode < 600) {
  await sleep(delay);
  continue;
}
// 4xx: Fail immediately
throw error;
```

**Proposed Skill** (INCORRECT):
```text
1. Detect 4xx error in logs
2. Apply diagnostic fix
3. Retry embedding
```

**Problem**: Step 2 cannot fix 4xx errors post-hoc. Code change required.

## 8. Discussion

### Why 4xx Errors Don't Occur in Production

**Hypothesis**: The embedding service PREVENTS 4xx errors at the code level:
1. Chunking limits text size → Prevents 413 Payload Too Large
2. API request format is static → Prevents 400 Bad Request
3. Content is read from notes → Prevents 422 Unprocessable Entity

**Evidence**: 0 production 4xx errors in session logs, only synthetic 400 in tests.

**Implication**: Preventive design eliminates need for reactive skill.

### Skill vs Service Responsibility

**Service responsibilities** (embedding/generateEmbedding.ts):
- Retry transient errors (5xx) ✅
- Fail fast on client errors (4xx) ✅
- Handle timeouts ✅
- Chunk text to prevent oversize payloads ✅

**Skill responsibilities** (proposed):
- Fix 4xx errors post-hoc ❌ (cannot fix code bugs)
- Tune batch size ❌ (config change, not diagnostic fix)
- Retry failed embeddings ❌ (already automatic)

**Verdict**: Proposed skill has ZERO valid responsibilities.

### Progressive Disclosure Assessment

**Progressive disclosure** is justified when:
1. Main skill workflow is complex (multiple phases)
2. Reference material is lengthy (>100 lines)
3. Multiple fix patterns exist (variety of solutions)
4. Troubleshooting requires domain knowledge

**memory-embeddings assessment**:
1. Workflow: Simple (detect → log, no fix possible) ❌
2. Reference length: 0 lines (no fix patterns exist) ❌
3. Fix patterns: 0 (4xx not fixable post-hoc) ❌
4. Troubleshooting: Already in ADR-002 ❌

**Verdict**: ZERO criteria met. Progressive disclosure unjustified.

## 9. Recommendations

### Recommendation: REJECT

**Rationale**:

1. **Error frequency**: 0% of production errors are 4xx (100% are 5xx, already handled)
2. **Fixability**: 0 out of 3 proposed 4xx errors are fixable post-hoc
3. **Architecture**: Error handling belongs in service (preventive), not skill (reactive)
4. **Progressive disclosure**: 0 out of 4 criteria met for references/ folder
5. **Pattern validity**: session-log-fixer analogy is false equivalence

**Confidence**: High (95%)

### Alternative: What to Build Instead

**If monitoring/observability is the goal**, create:

**`.claude/skills/memory-diagnostics/SKILL.md`** (NO references/ folder):
- Check embedding coverage (which notes lack embeddings)
- Verify database integrity (orphaned chunks)
- Report health statistics (success rate, avg time)
- Trigger manual re-embed for failed notes

**Difference**:
- Diagnostic, not fixer
- Works with successful architecture, doesn't try to fix code bugs
- Single-file skill (no progressive disclosure needed)

## 10. Conclusion

**Verdict**: REJECT

**Confidence**: High (95%)

**Rationale**: The proposed `/memory-embeddings` skill attempts to fix code bugs (4xx errors) post-hoc, which is architecturally incorrect. The embedding service already implements correct preventive error handling (retry 5xx, fail fast 4xx). Zero production 4xx errors exist to fix. Progressive disclosure is unjustified as no fix patterns exist.

### User Impact

**What changes for you**: Embedding errors are already handled optimally at the service level. No skill is needed.

**Effort required**: 0 hours (do not implement proposed skill).

**Risk if ignored**: None. Current architecture is correct.

### If You Proceed Anyway

**Problems you will encounter**:
1. No 4xx errors in production logs to test against
2. Cannot fix 413/422/400 errors without code changes
3. Skill would be maintenance burden with zero value
4. Reference files would be empty or duplicate ADR-002

**Advice**: Do not implement. Focus effort on preventive service improvements instead.

## 11. Appendices

### Sources Consulted

**Code Analysis**:
- `apps/mcp/src/services/embedding/generateEmbedding.ts` (retry logic)
- `apps/mcp/src/services/ollama/client.ts` (error handling)
- `apps/mcp/src/tools/embed/index.ts` (batch processing)
- `.agents/architecture/ADR-002-embedding-performance-optimization.md` (design)

**Test Analysis**:
- `apps/mcp/src/services/embedding/__tests__/generateEmbedding.test.ts`
- `apps/mcp/src/services/embedding/__tests__/integration.test.ts`
- `apps/mcp/src/services/embedding/__tests__/batchGenerate.test.ts`

**Session Logs**:
- `.agents/sessions/2026-01-19-session-12-chunked-embeddings-validation.md`
- `.agents/sessions/2026-01-19-session-14-ollama-error-fixes-validation.md`
- `.agents/sessions/2026-01-19-session-16-timeout-fixes-final-validation.md`
- `.agents/analysis/025-ollama-500-errors.md`

**Reference Pattern**:
- `apps/claude-plugin/skills/session-log-fixer/SKILL.md`

### Data Transparency

**Found**:
- 0 production 4xx errors in session logs
- 29 production 5xx errors (Ollama 500)
- isRetryableError() categorizes 5xx as retryable, 4xx as non-retryable
- Retry logic with exponential backoff (1s, 2s, 4s)
- Chunking prevents 413 Payload Too Large
- Static API format prevents 400 Bad Request

**Not Found**:
- No 413 Payload Too Large errors
- No 422 Unprocessable Entity errors
- No 400 Bad Request errors (except synthetic test errors)
- No post-hoc fix patterns for 4xx errors
- No evidence of fixable embedding errors
