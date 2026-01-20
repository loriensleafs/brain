# Implementation Plan: ADR-002 Batch API Migration

**Created**: 2026-01-19
**Status**: Ready for Implementation
**ADR**: [ADR-002-embedding-performance-optimization.md](../architecture/ADR-002-embedding-performance-optimization.md)
**Spec Directory**: [.agents/specs/ADR-002-embedding-performance/](../specs/ADR-002-embedding-performance/)
**Target**: 13x performance improvement (600s → 46s for 700 notes)

## Executive Summary

This plan implements ADR-002 by migrating from Ollama's single-text `/api/embeddings` endpoint to the batch `/api/embed` endpoint with p-limit concurrency control. The implementation eliminates 100% artificial delay overhead, reduces HTTP request count by 67%, and introduces concurrent note processing. The changes target 13x throughput improvement while maintaining backward compatibility and reliability.

**Key Changes**:
- Migrate to batch API with `generateBatchEmbeddings` method
- Add p-limit dependency for concurrency control (4 concurrent notes)
- Remove 200ms inter-chunk delays (100% overhead elimination)
- Reduce timeouts (Ollama: 600s → 60s, Go: 10min → 5min)

**Coordination**: ADR-003 (task prefix) implements AFTER ADR-002 completes. The batch API implementation must accept TaskType parameter in `generateBatchEmbeddings` for future compatibility.

## Milestones

### Milestone 1: Prerequisites and Setup
**Tasks**: TASK-003
**Effort**: 30 minutes
**Blocking**: TASK-002

**Deliverables**:
- [ ] p-limit package installed via `bun add p-limit`
- [ ] package.json updated with p-limit dependency
- [ ] bun.lock updated with lockfile entry
- [ ] Verification: Import test succeeds

**Acceptance Criteria**:
- Package version: latest stable (~5.0.0)
- Zero vulnerabilities in dependency tree
- TypeScript types included
- `import pLimit from 'p-limit'` compiles successfully

**Risks**:
- Package incompatibility with Bun (low - already tested in analysis)
- Network issues during installation (retry strategy: use cached registry)

**Rationale**: p-limit must be installed before TASK-002 can import concurrency control utilities.

---

### Milestone 2: Batch API Core Changes
**Tasks**: TASK-001, TASK-002
**Effort**: 5 hours
**Depends On**: Milestone 1 (TASK-003)

**Deliverables**:
- [ ] OllamaClient.generateBatchEmbeddings method added
- [ ] BatchEmbedRequest and BatchEmbedResponse types defined
- [ ] Embed tool refactored to use batch API
- [ ] OLLAMA_REQUEST_DELAY_MS constant removed
- [ ] BATCH_DELAY_MS constant removed
- [ ] processNotesWithConcurrency implemented
- [ ] processNoteWithBatchEmbedding implemented
- [ ] EMBEDDING_CONFIG with concurrency limit

**Acceptance Criteria**:

**TASK-001 (OllamaClient)**:
- Method signature: `async generateBatchEmbeddings(texts: string[], model?: string): Promise<number[][]>`
- Empty input optimization (returns `[]` without API call)
- Request to `/api/embed` with `{ model, input: string[], truncate: true }`
- Response parsing for `embeddings: number[][]`
- Index alignment validation (output[i] = embedding for input[i])
- AbortSignal.timeout applied
- OllamaError thrown on HTTP errors with status code
- Existing `generateEmbedding` delegates to batch method

**TASK-002 (Embed Tool)**:
- Sequential processing loop removed
- All `await sleep()` calls deleted
- Concurrent processing via `processNotesWithConcurrency`
- Progress logging (concurrency config, note count)
- Result logging (total, successful, failed)
- Tool response: `{ success: boolean, embedded: number, failed: number }`

**ADR-003 Coordination**:
- `generateBatchEmbeddings` MUST accept TaskType parameter for future compatibility
- Parameter: `taskType: TaskType = "search_document"`
- Implementation: Prefix each text with `${taskType}: ${text}`
- Rationale: When ADR-003 implements task prefix, batch API will be ready

**Risks**:
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Ollama version missing `/api/embed` | Low | High | Add version check in TASK-001 with clear error message |
| Embedding count mismatch | Medium | High | Validation in `generateBatchEmbeddings` throws OllamaError |
| Partial batch failures | Medium | Medium | Note-level error handling, retry with exponential backoff |
| Memory exhaustion from large batches | Low | Medium | MAX_CHUNKS_PER_BATCH = 32 limit |

**Rollback Plan**:
- Revert `embed/index.ts` to use `generateEmbedding` (single-text API)
- Re-add delays if Ollama resource exhaustion occurs
- Indicators for rollback: Ollama 500 error rate >5%, throughput <5x baseline

---

### Milestone 3: Optimization and Validation
**Tasks**: TASK-004, TASK-005
**Effort**: 5 hours
**Depends On**: Milestone 2 (TASK-001, TASK-002)

**Deliverables**:
- [ ] Ollama client timeout reduced to 60s
- [ ] Go HTTP client timeout reduced to 5min
- [ ] .env.example updated with timeout documentation
- [ ] OllamaError enhanced with context (note, chunks, elapsed, timeout)
- [ ] OllamaError.isRetryable() method added
- [ ] OllamaError.toUserMessage() method added
- [ ] Unit tests for batch method
- [ ] Unit tests for concurrency control
- [ ] Unit tests for timeout behavior
- [ ] Integration test: 100 real notes
- [ ] Integration test: 700 notes performance validation
- [ ] Code coverage >80% for new code

**Acceptance Criteria**:

**TASK-004 (Timeouts)**:
- OLLAMA_CONFIG.TIMEOUT default = 60000ms (was 600000ms)
- HTTPClientTimeout constant = 5 minutes (was 10 minutes)
- Timeout validation: minimum 1000ms, warning if >300000ms
- OllamaError context includes: note, chunks, elapsed, expected, timeout
- Retryable errors: 5xx, 408
- Non-retryable errors: 4xx (except 408)

**TASK-005 (Tests)**:
- Empty input returns empty array
- Single text batching works
- Multiple texts batching works
- HTTP error handling
- Embedding count mismatch error
- Timeout behavior
- Concurrency limit enforcement (max 4 concurrent)
- Failure handling (partial failures don't block others)
- 100 notes complete <30 seconds
- 700 notes complete <120 seconds (5x minimum), <60s target (10x)

**Performance Validation**:
- Capture baseline before implementation: `time brain embed --project brain --limit 700`
- Measure after implementation
- **Minimum**: 5x improvement (600s → 120s)
- **Target**: 13x improvement (600s → 46s)

**Risks**:
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Test flakiness | Medium | Medium | 10 consecutive runs required for pass |
| Ollama server unavailable | Medium | High | Integration tests marked as optional in CI |
| Performance target missed | Low | Medium | Rollback plan documented, delays can be reduced further |
| False positive timeout errors | Low | Medium | Adaptive timeout or configurable via env var |

---

## Dependency Graph

```text
TASK-003 (p-limit install)
    |
    v
TASK-001 (Batch method) -----> TASK-002 (Refactor embed tool)
                                    |
                                    v
                            TASK-004 (Timeouts) -----> TASK-005 (Tests)
```

**Critical Path**: TASK-003 → TASK-001 → TASK-002 → TASK-005 (8.5 hours)

**Parallel Opportunities**:
- TASK-004 (timeouts) can be done in parallel with TASK-002 (no dependency)
- TASK-003 (install) can be done while reading TASK-001 specs

## Risk Register

| Risk ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---------|------|------------|--------|------------|-------|
| R001 | Ollama version lacks `/api/embed` | Low | High | Add version check with clear error message in TASK-001 | implementer |
| R002 | Embedding count mismatch (output[i] ≠ input[i]) | Medium | High | Validation in `generateBatchEmbeddings`, throw OllamaError | implementer |
| R003 | Ollama resource exhaustion from concurrency | Medium | Medium | p-limit at 4 concurrent (matches OLLAMA_NUM_PARALLEL) | implementer |
| R004 | Memory pressure from large batch sizes | Low | Medium | MAX_CHUNKS_PER_BATCH = 32 limit | implementer |
| R005 | Performance target missed (<5x improvement) | Low | Medium | Analyze bottlenecks, reduce delays further, rollback if needed | implementer |
| R006 | Test flakiness | Medium | Medium | Require 10 consecutive passes, fix non-deterministic tests | implementer |
| R007 | Partial batch failures lose data | Medium | High | Note-level retry with exponential backoff (1s, 2s, 4s) | implementer |
| R008 | Breaking changes to database schema | Low | High | No schema changes in this ADR (verified) | implementer |
| R009 | ADR-003 coordination failure | Low | Medium | Add TaskType parameter to batch method NOW for compatibility | implementer |

## Execution Sequence

### Phase 0: Prerequisites (30 min)

1. **TASK-003: Add p-limit dependency**
   - **Why first**: Required by TASK-002 concurrency implementation
   - **Commands**:
     ```bash
     cd apps/mcp
     bun add p-limit
     grep p-limit package.json  # Verify
     ```
   - **Validation**: Import test succeeds
   - **Output**: package.json updated, bun.lock committed

2. **Verify Ollama version**
   - **Why**: Batch API requires Ollama 0.1.26+
   - **Commands**:
     ```bash
     ollama --version
     curl -X POST http://localhost:11434/api/embed \
       -H "Content-Type: application/json" \
       -d '{"model": "nomic-embed-text", "input": ["test"]}'
     ```
   - **Validation**: Ollama returns embeddings array
   - **If fails**: Document incompatibility, block implementation

---

### Phase 1: Core Changes (5 hours)

3. **TASK-001: Add generateBatchEmbeddings to OllamaClient** (2h)
   - **Why now**: Batch method must exist before embed tool refactor
   - **Files**:
     - `apps/mcp/src/services/ollama/client.ts` (modify)
     - `apps/mcp/src/services/ollama/types.ts` (modify - add BatchEmbedRequest/Response)
   - **Implementation**:
     - Add `generateBatchEmbeddings(texts: string[], taskType: TaskType = "search_document", model?: string): Promise<number[][]>`
     - Empty input optimization: `if (texts.length === 0) return [];`
     - Prefix texts with task type: `const prefixedTexts = texts.map(t => \`${taskType}: ${t}\`);`
     - POST to `/api/embed` with `{ model, input: prefixedTexts, truncate: true }`
     - Validate `data.embeddings.length === texts.length`
     - Update `generateEmbedding` to delegate: `const [embedding] = await this.generateBatchEmbeddings([text], taskType, model);`
   - **ADR-003 Coordination**: TaskType parameter added NOW for future compatibility
   - **Validation**: Local test with single text, multiple texts

4. **TASK-002: Refactor embed tool to use batch API** (3h)
   - **Why now**: Depends on TASK-001 batch method
   - **Files**:
     - `apps/mcp/src/tools/embed/index.ts` (modify)
     - `apps/mcp/src/services/embedding/concurrency.ts` (create)
     - `apps/mcp/src/services/embedding/processNote.ts` (create)
     - `apps/mcp/src/services/embedding/config.ts` (create)
   - **Implementation**:
     - Create `EMBEDDING_CONFIG` with `CONCURRENCY = 4`, `MAX_CHUNKS_PER_BATCH = 32`, `MEMORY_LOG_INTERVAL = 100`
     - Create `processNotesWithConcurrency(notes, processNote)` using p-limit
     - Create `processNoteWithBatchEmbedding(note, ollamaClient)` that:
       - Reads note, chunks text
       - Calls `ollamaClient.generateBatchEmbeddings(chunks.map(c => c.text), "search_document")`
       - Stores embeddings via `storeChunkedEmbeddings`
     - Refactor embed tool handler to use `processNotesWithConcurrency`
     - **DELETE**: OLLAMA_REQUEST_DELAY_MS constant
     - **DELETE**: BATCH_DELAY_MS constant
     - **DELETE**: All `await sleep()` calls
   - **Validation**:
     ```bash
     brain embed --project brain --limit 10
     # Verify logs show concurrent processing
     # Verify no delay-related code in codebase
     ```

---

### Phase 2: Optimization (1 hour)

5. **TASK-004: Reduce timeouts for fail-fast errors** (1h)
   - **Why now**: Can be done in parallel with TASK-002, improves error UX
   - **Files**:
     - `apps/mcp/src/config/ollama.ts` (modify)
     - `apps/tui/client/http.go` (modify)
     - `apps/mcp/.env.example` (modify)
     - `apps/mcp/src/services/ollama/types.ts` (modify)
   - **Implementation**:
     - Update `OLLAMA_CONFIG.TIMEOUT` from 600000 to 60000
     - Add timeout validation: minimum 1000ms, warning if >300000ms
     - Update `HTTPClientTimeout` from 10min to 5min in Go client
     - Add timeout documentation to `.env.example`
     - Enhance OllamaError with context field: `{ note, chunks, elapsed, expected, timeout }`
     - Add `OllamaError.isRetryable()` method (5xx and 408 = true, 4xx = false)
     - Add `OllamaError.toUserMessage()` method with formatted context
   - **Validation**: Config loads with new timeout, error messages include context

---

### Phase 3: Validation (4 hours)

6. **TASK-005: Add unit and integration tests** (4h)
   - **Why last**: Tests validate all prior tasks
   - **Files**:
     - `apps/mcp/src/services/ollama/__tests__/client.test.ts` (create)
     - `apps/mcp/src/services/embedding/__tests__/concurrency.test.ts` (create)
     - `apps/mcp/src/services/embedding/__tests__/timeout.test.ts` (create)
     - `apps/mcp/src/services/embedding/__tests__/integration.test.ts` (create)
   - **Test Coverage**:
     - **Unit**: Batch method, concurrency control, timeout behavior, error handling
     - **Integration**: 100 real notes (<30s), 700 real notes (<120s minimum)
     - **Performance**: Baseline measurement, 5x minimum validation
   - **Validation**:
     ```bash
     bun test  # All unit tests
     bun test --integration  # Requires Ollama running

     # Performance baseline
     time brain embed --project brain --limit 700 > baseline.log
     # Expected: ~600s (10 min)

     # After optimization
     time brain embed --project brain --limit 700 > optimized.log
     # Minimum: <120s (5x improvement)
     # Target: ~46s (13x improvement)
     ```

---

## Validation Checkpoints

### Checkpoint 1: Prerequisites Complete
**When**: After TASK-003
**Verify**:
- [ ] p-limit in package.json
- [ ] bun.lock committed
- [ ] `import pLimit from 'p-limit'` compiles
- [ ] Ollama version ≥0.1.26 confirmed

**Gate**: MUST PASS before TASK-001

---

### Checkpoint 2: Batch Method Functional
**When**: After TASK-001
**Verify**:
- [ ] `generateBatchEmbeddings` method exists
- [ ] Empty input returns `[]`
- [ ] Single text batching works
- [ ] Multiple texts batching works
- [ ] Index alignment validated
- [ ] OllamaError thrown on failures
- [ ] TaskType parameter present (ADR-003 compatibility)

**Gate**: MUST PASS before TASK-002

---

### Checkpoint 3: Embed Tool Refactored
**When**: After TASK-002
**Verify**:
- [ ] Sequential loops removed
- [ ] OLLAMA_REQUEST_DELAY_MS deleted
- [ ] BATCH_DELAY_MS deleted
- [ ] All `await sleep()` calls removed
- [ ] Concurrent processing via p-limit
- [ ] Progress logging present
- [ ] Tool response format correct

**Manual Test**:
```bash
brain embed --project brain --limit 10
# Expected: <5 seconds, logs show concurrency
```

**Gate**: MUST PASS before TASK-005

---

### Checkpoint 4: Timeouts Optimized
**When**: After TASK-004
**Verify**:
- [ ] Ollama timeout = 60000ms
- [ ] Go timeout = 5min
- [ ] .env.example documented
- [ ] OllamaError context includes: note, chunks, elapsed, timeout
- [ ] Retryable errors identified correctly

**Manual Test**:
```typescript
// Trigger timeout error
const client = new OllamaClient('http://localhost:11434', 1000);
await client.generateBatchEmbeddings(['test']); // Should timeout
// Verify error message includes context
```

**Gate**: SHOULD PASS before deployment

---

### Checkpoint 5: Tests Passing
**When**: After TASK-005
**Verify**:
- [ ] All unit tests pass
- [ ] All integration tests pass (Ollama running)
- [ ] Code coverage >80%
- [ ] No test flakiness (10 consecutive runs)
- [ ] Performance baseline documented

**Gate**: MUST PASS before merge

---

### Checkpoint 6: Performance Validation (BLOCKING)
**When**: After all tasks complete
**Verify**:
- [ ] Baseline captured (before optimization)
- [ ] Optimized performance measured
- [ ] Improvement ≥5x (MINIMUM)
- [ ] Improvement ≥10x (TARGET)

**Failure Action**: If <5x improvement, analyze bottlenecks:
1. Check Ollama server performance (CPU, memory)
2. Verify concurrency limit = 4
3. Verify delays removed
4. Check batch size (should be chunked per note)
5. If persistent, ROLLBACK

**Gate**: MUST PASS before claiming completion

---

## Rollback Plan

### Trigger Conditions
Execute rollback if ANY of the following occur:
- Ollama 500 error rate >5%
- Embedding throughput <5x baseline
- Memory pressure on Ollama server
- Data integrity issues (embeddings missing/incorrect)
- Test failures persist after 2 debugging attempts

### Rollback Steps

#### Immediate (15 minutes)
1. **Revert embed tool**:
   ```bash
   git checkout HEAD~1 apps/mcp/src/tools/embed/index.ts
   ```
2. **Re-add delays** if needed:
   ```typescript
   const OLLAMA_REQUEST_DELAY_MS = 200;  // Temporary
   ```
3. **Deploy hotfix**

#### Short-term (1 hour)
1. **Full revert**:
   ```bash
   git revert <commit-sha>
   ```
2. **Revert timeout changes** if causing issues:
   ```bash
   git checkout HEAD~1 apps/mcp/src/config/ollama.ts
   git checkout HEAD~1 apps/tui/client/http.go
   ```
3. **Remove p-limit dependency**:
   ```bash
   cd apps/mcp
   bun remove p-limit
   ```

#### Long-term (Post-mortem)
1. **Root cause analysis**:
   - Why did performance target miss?
   - What caused reliability issues?
   - Were assumptions incorrect?
2. **Update ADR-002 with findings**
3. **Revise implementation plan**
4. **Re-attempt with mitigations**

### Rollback Verification
After rollback:
- [ ] Embedding generation succeeds
- [ ] Error rate returns to baseline
- [ ] Performance acceptable (even if slower)
- [ ] No data loss

---

## Success Criteria

### Implementation Complete When:
- [ ] All 5 tasks (TASK-001 through TASK-005) marked complete
- [ ] All 6 validation checkpoints passed
- [ ] Code coverage >80% for new code
- [ ] All tests passing (unit + integration)
- [ ] Performance validation shows ≥5x improvement (MINIMUM)
- [ ] No P0/P1 issues in code review
- [ ] Documentation updated (.env.example, ADR-002)
- [ ] Commits follow atomic commit standards
- [ ] PR approved by QA agent

### Performance Targets:
| Metric | Baseline | Minimum (5x) | Target (13x) | Measured |
|--------|----------|--------------|--------------|----------|
| 100 notes | 85s | 17s | 7s | ___ |
| 700 notes | 600s (10min) | 120s (2min) | 46s | ___ |
| HTTP requests | 2100 | 700 | 700 | ___ |
| Delay overhead | 52% | 0% | 0% | ___ |

### Quality Gates:
- [ ] No regressions in existing functionality
- [ ] Backward compatibility maintained (no breaking changes)
- [ ] Database schema unchanged
- [ ] ADR-003 coordination verified (TaskType parameter present)
- [ ] Security review passed (no new vulnerabilities)
- [ ] Error handling improved (context in errors)

---

## Coordination with ADR-003

**Relationship**: ADR-003 (task prefix) implements AFTER ADR-002 completes.

**Coordination Points**:

1. **Batch Method Signature** (MUST DO NOW):
   - Add TaskType parameter: `taskType: TaskType = "search_document"`
   - Implementation: Prefix texts with `${taskType}: ${text}`
   - Rationale: When ADR-003 implements task prefix, batch API is ready

2. **Call Sites** (ADR-003 RESPONSIBILITY):
   - Embed tool: `client.generateBatchEmbeddings(chunks, "search_document")`
   - Search service: `client.generateBatchEmbeddings([query], "search_query")`

3. **Testing** (ADR-003 RESPONSIBILITY):
   - Verify prefixes applied correctly
   - Verify document/query asymmetry

**Implementation Order**:
```text
ADR-002 (batch API + TaskType parameter)
    ↓
ADR-003 (task prefix usage at call sites)
```

**Blocking**: ADR-002 does NOT block on ADR-003. TaskType parameter added defensively for future compatibility.

---

## Related Documentation

- **ADR-002**: [.agents/architecture/ADR-002-embedding-performance-optimization.md](../architecture/ADR-002-embedding-performance-optimization.md)
- **ADR-003**: [.agents/architecture/ADR-003-embedding-task-prefix.md](../architecture/ADR-003-embedding-task-prefix.md)
- **Spec Directory**: [.agents/specs/ADR-002-embedding-performance/](../specs/ADR-002-embedding-performance/)
- **Analysis 025**: [.agents/analysis/025-embedding-performance-research.md](../analysis/025-embedding-performance-research.md)
- **Analysis 026**: [.agents/analysis/026-timeout-changes-performance-review.md](../analysis/026-timeout-changes-performance-review.md)
- **Analysis 027**: [.agents/analysis/027-embedding-performance-final-findings.md](../analysis/027-embedding-performance-final-findings.md)

---

## Questions or Blockers

### For Implementer
- Verify Ollama version ≥0.1.26 before starting
- Test batch API availability before TASK-001
- Monitor memory usage during integration tests

### For QA
- Ensure Ollama server running for integration tests
- Capture baseline performance before optimization
- Validate performance regression tests in CI

### For Orchestrator
- Route to implementer for execution
- Route to qa for validation after implementation
- Route to critic if performance target missed
