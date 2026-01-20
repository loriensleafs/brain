---
type: requirement
id: REQ-004
title: Performance target of 5x minimum improvement
status: implemented
priority: P0
category: non-functional
epic: EPIC-ADR-002-implementation
related:
  - ADR-002
  - REQ-001
  - REQ-002
  - REQ-003
created: 2026-01-19
updated: 2026-01-19
author: spec-generator
tags:
  - performance
  - benchmark
  - validation
  - acceptance-criteria
---

# REQ-004: Performance Target of 5x Minimum Improvement

## Requirement Statement

WHEN embedding a corpus of 700 notes with an average of 3 chunks per note,
THE SYSTEM SHALL complete embedding generation in less than 2 minutes (120 seconds)
SO THAT a minimum 5x improvement over the baseline 10-minute performance is achieved.

## Context

The current embedding system processes 700 notes in approximately 10 minutes (600 seconds). ADR-002 estimates a 13x improvement (600s → 46s) based on theoretical analysis:

- Batch API: 2x improvement (eliminate HTTP overhead)
- Remove delays: 2x improvement (eliminate 100% artificial overhead)
- Concurrency (4x): 4x improvement (parallel processing)
- Combined: 2 × 2 × 4 = 16x theoretical maximum

Conservative estimate accounting for overhead: 13x improvement → 46 seconds target.

This requirement sets a minimum acceptance threshold of 5x improvement (120 seconds) to ensure:

- Implementation delivers measurable value
- Edge cases and variance don't cause failure
- Rollback threshold is clear (if <5x, revert)

## Acceptance Criteria

- [ ] Baseline measurement captured before implementation
- [ ] Baseline: `time brain embed --project brain --limit 100` recorded
- [ ] Baseline: `time brain embed --project brain --limit 700` recorded
- [ ] Post-implementation: Same commands re-run with new code
- [ ] Post-implementation timing: 700 notes ≤ 120 seconds (5x improvement minimum)
- [ ] Post-implementation timing: 700 notes ≤ 60 seconds (10x improvement target)
- [ ] Post-implementation timing: 700 notes ≤ 46 seconds (13x improvement stretch goal)
- [ ] Benchmarking tool added: `brain benchmark embed --notes N --iterations M`
- [ ] Benchmark results logged with: start time, end time, notes processed, failures, average time per note
- [ ] Performance regression test added to CI (fails if 700 notes takes >120s)
- [ ] Measurement methodology documented in ADR-002 validation section

## Rationale

Setting a conservative 5x minimum threshold ensures:

**Risk Mitigation**:

- Theoretical analysis may overestimate (no network latency, perfect batching)
- Edge cases may increase variance (large notes, slow Ollama responses)
- Real-world conditions differ from idealized calculations

**Clear Success Criteria**:

- 5x improvement: PASS (measurable value delivered)
- 3x improvement: CONDITIONAL (investigate bottlenecks, consider rollback)
- 1x improvement: FAIL (rollback, re-analyze)

**Validation Methodology**:

```bash
# Baseline (before implementation)
time brain embed --project brain --limit 700 > baseline.log

# Post-implementation
time brain embed --project brain --limit 700 > optimized.log

# Compare
baseline_time=$(grep "Elapsed" baseline.log | awk '{print $2}')
optimized_time=$(grep "Elapsed" optimized.log | awk '{print $2}')
improvement=$(echo "$baseline_time / $optimized_time" | bc -l)

if [ "$improvement" -lt 5 ]; then
  echo "FAIL: Only ${improvement}x improvement, minimum 5x required"
  exit 1
fi
```

**Performance Targets**:

| Threshold | Time (700 notes) | Improvement | Verdict |
|-----------|-----------------|-------------|---------|
| Baseline | 600s (10 min) | 1x | Current state |
| Minimum | 120s (2 min) | 5x | PASS threshold |
| Target | 60s (1 min) | 10x | Expected result |
| Stretch | 46s | 13x | Theoretical maximum |

## Dependencies

- REQ-001: Batch API migration (2x improvement)
- REQ-002: Concurrency control (4x improvement)
- REQ-003: Timeout optimization (no performance impact, but enables fail-fast)
- Ollama server with nomic-embed-text model loaded
- Brain corpus with 700+ notes for benchmarking
- Timing measurement tool (bash `time`, Go time.Now(), etc.)

## Related Artifacts

- ADR-002: Embedding Performance Optimization: Batch API Migration with Concurrency Control
- Analysis 025: Embedding Performance Research (API comparison)
- Analysis 027: Embedding Performance Final Findings (validation methodology)
