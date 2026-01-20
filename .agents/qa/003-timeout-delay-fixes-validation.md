# Test Report: Timeout and Delay Fixes for MCP EOF Errors

**Date**: 2026-01-19
**Feature**: MCP connection timeout and delay improvements
**Session**: 2026-01-19-session-15

## Objective

Validate fixes implemented to address MCP connection EOF errors during embedding generation.

**Acceptance Criteria**:

1. HTTP client timeout increased to 10 minutes
2. Inter-chunk delay set to 200ms
3. Embedding generation completes without EOF errors

**Changes Under Test**:

- `/Users/peter.kloss/Dev/brain/apps/tui/client/http.go:38` - HTTP client timeout
- `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/embed/index.ts:23` - Inter-chunk delay

## Approach

**Test Types**: Code review, build verification, functional testing
**Environment**: Local development (macOS, Go 1.x, Bun, Ollama)
**Data Strategy**: Live embedding test with `--limit 5`

## Results

### Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Code Reviews | 2/2 | 2 | [PASS] |
| Build Tests | 2/2 | 2 | [PASS] |
| Functional Tests | 0/1 | 1 | [FAIL] |
| Line Coverage | N/A | N/A | N/A |
| Branch Coverage | N/A | N/A | N/A |
| Execution Time | 45s | <10min | [PASS] |

### Test Results by Category

| Test | Category | Status | Notes |
|------|----------|--------|-------|
| HTTP timeout code review | Code Review | [PASS] | Line 38: `Timeout: 10 * time.Minute` |
| Delay code review | Code Review | [PASS] | Line 23: `const OLLAMA_REQUEST_DELAY_MS = 200` |
| Go TUI build | Build | [PASS] | 21MB binary created |
| MCP build | Build | [PASS] | 628 modules bundled |
| Embedding generation | Functional | [FAIL] | EOF error persists |

## Discussion

### Risk Areas

| Area | Risk Level | Rationale |
|------|------------|-----------|
| Ollama client timeout | **High** | Root cause of EOF errors not addressed |
| HTTP client timeout | Low | Correctly implemented |
| Inter-chunk delay | Low | Correctly implemented |

### Coverage Gaps

| Gap | Reason | Priority |
|-----|--------|----------|
| Ollama client timeout not increased | Missing from original fix scope | **P0** |
| No environment variable override tested | Not in acceptance criteria | P1 |
| No stress test (>100 notes) | Limited to 5 notes | P2 |

### Root Cause Analysis

Investigation revealed **three** timeout layers affecting embedding operations:

| Layer | Component | Location | Default | Status |
|-------|-----------|----------|---------|--------|
| 1 | HTTP Client | `apps/tui/client/http.go:38` | 30s → **10min** | ✓ Fixed |
| 2 | Inter-chunk Delay | `apps/mcp/src/tools/embed/index.ts:23` | N/A → **200ms** | ✓ Fixed |
| 3 | **Ollama Client** | **`apps/mcp/src/config/ollama.ts:15`** | **30s** | **✗ Not Fixed** |

**Critical Finding**: The Ollama client uses `AbortSignal.timeout(this.timeout)` (see `apps/mcp/src/services/ollama/client.ts:36`) to abort requests after 30 seconds. When embedding generation takes longer than 30 seconds, the Ollama client aborts the HTTP request, causing the EOF error.

**Evidence**:

1. Server health check: OK (connection can be established)
2. Error timing: Occurs during long-running operations, not at startup
3. Error message: "unexpected EOF" (connection broken mid-stream, not refused)
4. Code inspection: `AbortSignal.timeout(this.timeout)` aborts at 30 seconds
5. Configuration: `OLLAMA_TIMEOUT` defaults to 30000ms

**Impact**: All EOF errors observed in previous sessions likely caused by this 30-second Ollama timeout, not the HTTP client timeout that was increased.

## Recommendations

### Immediate Actions (P0)

1. **Increase Ollama client timeout** to match HTTP client timeout:
   - Change `apps/mcp/src/config/ollama.ts:15` from `30000` to `600000` (10 minutes)
   - OR: Set `OLLAMA_TIMEOUT=600000` environment variable
   - Rationale: Batch embedding operations routinely exceed 30 seconds

2. **Re-validate embedding test** after Ollama timeout fix:
   - Command: `brain embed --project brain --limit 5`
   - Expected: No EOF errors
   - Acceptance: 5 notes embedded successfully

### Follow-up Actions (P1)

1. **Document timeout configuration** in README or configuration guide:
   - All three timeout layers (HTTP, delay, Ollama)
   - Environment variable overrides
   - Recommended values for large batches

2. **Add timeout validation** to CI or pre-commit:
   - Verify Ollama timeout >= HTTP client timeout
   - Prevent regression to 30-second default

### Future Improvements (P2)

1. **Add stress test** for large batches:
   - Test with `--limit 100` or `--limit 0` (all notes)
   - Measure actual embedding time vs timeout thresholds
   - Validate no resource exhaustion

2. **Consider dynamic timeout** based on batch size:
   - Calculate timeout from: `base_timeout + (notes * avg_time_per_note)`
   - Prevent unnecessary long waits for small batches

## Verdict

**Status**: [FAIL]
**Confidence**: High
**Rationale**: Code changes validated successfully (HTTP timeout, inter-chunk delay), but functional test fails due to unaddressed Ollama client timeout (30s). Root cause identified with high confidence. Fix required before embedding feature can be considered stable.

### Blocking Issues

| Issue | Severity | Resolution Required |
|-------|----------|---------------------|
| Ollama client timeout too short | P0 | Increase `OLLAMA_TIMEOUT` to 600000ms (10 minutes) |

### Next Steps

1. Increase Ollama client timeout to 10 minutes
2. Re-run validation with same test case
3. If pass: Approve for merge
4. If fail: Further investigation required
