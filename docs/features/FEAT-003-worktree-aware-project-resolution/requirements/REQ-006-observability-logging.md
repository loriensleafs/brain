---
title: REQ-006 Observability Logging
type: requirement
status: complete
feature-ref: FEAT-003
permalink: features/feat-003-worktree-aware-project-resolution/requirements/req-006-observability-logging
---

# REQ-006 Observability Logging

## Requirement Statement

Worktree detection SHOULD log diagnostic information at DEBUG level to aid debugging and performance monitoring. Logging MUST NOT impact performance for non-worktree users and MUST NOT log at INFO or higher level during normal operation.

### Required Log Points

| Event | Level | Fields |
|-------|-------|--------|
| Worktree detection activated | DEBUG | cwd, reason (direct match failed) |
| Fast pre-check: no .git found | DEBUG | cwd |
| Opt-out: disabled by env var | DEBUG | env var name |
| Opt-out: disabled by config | DEBUG | project name |
| Git subprocess started | DEBUG | command, cwd |
| Git subprocess completed | DEBUG | elapsed_ms, exit_code |
| Git subprocess timed out | WARN | cwd, timeout_ms |
| Worktree detected successfully | DEBUG | cwd, mainWorktreePath, elapsed_ms |
| Security validation failed | WARN | cwd, effectiveCwd, reason |
| CODE mode override applied | DEBUG | project, original_path, override_path |

### Performance Constraint

- Log calls MUST be gated behind log-level check to avoid string formatting overhead at non-DEBUG levels
- The fast pre-check exit path (.git not found) MUST produce at most 1 log line

## Acceptance Criteria

- [x] [requirement] All log points from the table above are implemented #acceptance
- [x] [requirement] Normal operation produces no logs above DEBUG level #acceptance
- [x] [requirement] Timeout and security failures produce WARN level logs #acceptance
- [x] [requirement] Elapsed time is included in subprocess completion and detection success logs #acceptance
- [x] [requirement] Log format is consistent across all 3 language implementations #acceptance
- [x] [requirement] Log-level gating prevents performance impact when DEBUG is disabled #acceptance

## Observations

- [requirement] DEBUG level ensures zero noise for normal users while enabling diagnostics #balance
- [decision] Elapsed time logging addresses the P2 observability concern from the debate #provenance
- [constraint] Log-level gating required because string formatting has non-trivial cost in hot paths #performance
- [insight] WARN level reserved for actionable issues: timeouts and security failures #severity
- [fact] P1 from debate log identified logging as a consensus concern across 2+ agents #consensus

## Relations

- part_of [[FEAT-003 Worktree-Aware Project Resolution]]
- implements [[ADR-007 Worktree-Aware Project Resolution]]
- relates_to [[CRIT-005 ADR-007 Debate Log]]
- depends_on [[REQ-001 Worktree Detection via git-common-dir]]
