---
title: FEAT-003 Worktree-Aware Project Resolution
type: feature
status: complete
source-refs:
- ADR-007
permalink: features/feat-003-worktree-aware-project-resolution/feat-003-worktree-aware-project-resolution
---

# FEAT-003 Worktree-Aware Project Resolution

## Context

Worktree-aware project resolution for the [[Brain MCP]] server: git worktree detection via `git rev-parse --git-common-dir`, runtime memories path override for CODE mode sessions, two-level opt-out mechanism, and cross-language parity across TypeScript, Go, and Bun hooks. Builds on the CWD matching (level 5) resolution hierarchy established in the project resolution chain. ADR-007 was ACCEPTED after a 6-agent review with 2 Accept and 4 Disagree-and-Commit votes. The design enhances CWD matching with git worktree detection as a fallback -- when direct path matching fails, the system detects if CWD is inside a git worktree and maps back to the main repo path for project identification.

## Scope

### In Scope

- [requirement] Config schema update to add `disableWorktreeDetection` boolean #config #p1
- [requirement] `detectWorktreeMainPath` function in TypeScript using `git rev-parse --git-common-dir` #detection #p1
- [requirement] `detectWorktreeMainPath` function in Go with identical behavior #detection #p1
- [requirement] `detectWorktreeMainPath` function in Bun hooks with identical behavior #detection #p1
- [requirement] Worktree fallback integration into `matchCwdToProject` in all 3 implementations #integration #p1
- [requirement] MCP server runtime override for CODE mode worktree sessions (`effectiveCwd`) #runtime #p1
- [requirement] Cross-language parity tests validating identical behavior across TS/Go/Bun #testing #p1
- [requirement] Integration tests with real git worktree fixtures #testing #p1
- [requirement] Security validation of `effectiveCwd` paths preventing path traversal #security #p1
- [requirement] Observability logging at DEBUG level for worktree detection #observability #p1

### Out of Scope

- [decision] New `GIT` memories_mode (rejected per [[ANALYSIS-021 Community Worktree Practices Research]]) #rejected
- [decision] Modification of the translation layer (`resolveMemoriesPath`) #out-of-scope
- [decision] Changes to basic-memory config format (single static path per project) #out-of-scope
- [decision] Worktree lifecycle management (create/remove/prune) #out-of-scope
- [decision] Remote URL-based project matching #deferred
- [decision] Symlink-based worktree alternatives #out-of-scope

## Phases

- Phase 1: Foundation (TASK-001 through TASK-004) #config #detection
- Phase 2: Integration (TASK-005 through TASK-006) #integration #runtime
- Phase 3: Validation (TASK-007 through TASK-008) #testing

## Effort Summary

| Estimate Type | Effort |
|---|---|
| Human estimate | 24 hours |
| AI-Dominant estimate | ~6 hours |
| AI-Assisted estimate | ~12 hours |

### Task Detail

| Task | Tier | Human | AI-Dominant | AI-Assisted |
|---|---|---|---|---|
| TASK-001 Config Schema Update | T1 | 2h | 0.5h | 1h |
| TASK-002 TS detectWorktreeMainPath | T2 | 4h | 1h | 2h |
| TASK-003 Go detectWorktreeMainPath | T2 | 4h | 1h | 2h |
| TASK-004 Bun detectWorktreeMainPath | T2 | 3h | 0.75h | 1.5h |
| TASK-005 matchCwdToProject Fallback | T2 | 4h | 1h | 2h |
| TASK-006 MCP Runtime Override | T2 | 3h | 0.75h | 1.5h |
| TASK-007 Cross-Language Parity Tests | T2 | 2h | 0.5h | 1h |
| TASK-008 Integration Tests | T2 | 2h | 0.5h | 1h |

## Success Criteria

- [x] [requirement] Users in git worktrees are automatically matched to the correct project without config changes #detection
- [x] [requirement] CODE mode sessions in worktrees use the worktree-local `docs/` directory for memories #runtime
- [x] [requirement] DEFAULT and CUSTOM mode behavior is unchanged for worktree users #compatibility
- [x] [requirement] Opt-out works at both per-project (`disableWorktreeDetection`) and global (`BRAIN_DISABLE_WORKTREE_DETECTION`) levels #opt-out
- [x] [requirement] All 3 implementations (TypeScript, Go, Bun hooks) produce identical behavior #parity
- [x] [requirement] Non-worktree users experience zero performance impact (fast `.git` pre-check exits early) #performance
- [x] [requirement] Missing or old git gracefully degrades to current behavior #graceful-degradation
- [x] [requirement] Security validation prevents path traversal via `effectiveCwd` #security

## Artifact Status

### Requirements

- [x] [requirement] [[REQ-001 Worktree Detection via Git Common Dir]] #status-complete
- [x] [requirement] [[REQ-002 MCP Runtime Memories Path Override]] #status-complete
- [x] [requirement] [[REQ-003 Two-Level Opt-Out Mechanism]] #status-complete
- [x] [requirement] [[REQ-004 Cross-Language Parity]] #status-complete
- [x] [requirement] [[REQ-005 Security Validation of Effective CWD]] #status-complete
- [x] [requirement] [[REQ-006 Observability Logging]] #status-complete

### Designs

- [x] [design] [[DESIGN-001 Implementation Plan]] #status-complete
- [x] [design] [[DESIGN-002 Detection Algorithm Detail]] #status-complete

### Tasks

- [x] [task] [[TASK-001 Config Schema Update]] #status-complete
- [x] [task] [[TASK-002 Implement detectWorktreeMainPath TypeScript]] #status-complete
- [x] [task] [[TASK-003 Implement detectWorktreeMainPath Go]] #status-complete
- [x] [task] [[TASK-004 Implement detectWorktreeMainPath Bun Hooks]] #status-complete
- [x] [task] [[TASK-005 Add Worktree Fallback to matchCwdToProject]] #status-complete
- [x] [task] [[TASK-006 MCP Server Runtime Override]] #status-complete
- [x] [task] [[TASK-007 Cross-Language Parity Tests]] #status-complete
- [x] [task] [[TASK-008 Integration Tests with Real Worktree]] #status-complete

## Observations

- [decision] Worktree detection is a fallback within CWD matching (level 5), not a new resolution level #design #architecture
- [decision] MCP server applies `effectiveCwd` at request time; static config stays unchanged #runtime-override
- [decision] Two-level opt-out: per-project config boolean + global env var #escape-hatch
- [decision] Single `git rev-parse` invocation fetches common-dir, git-dir, and bare status with 3-second timeout #performance
- [fact] Three implementations must be updated in sync: TypeScript, Go, Bun hooks #cross-language
- [constraint] Translation layer is NOT modified; override happens at MCP server layer #simplicity
- [insight] Zero cost for non-worktree users due to fast `.git` pre-check before subprocess spawn #performance
- [risk] Worktree-local CODE mode `docs/` are lost when temporary worktrees are deleted #data-loss
- [insight] AI agent tooling is the primary driver of worktree adoption in 2025-2026 #market
- [fact] ADR-007 received 2 Accept and 4 Disagree-and-Commit votes from the 6-agent review panel #governance

## Relations

- implements [[ADR-007 Worktree-Aware Project Resolution]]
- derives_from [[ADR-007 Worktree-Aware Project Resolution]]
- contains [[REQ-001 Worktree Detection via Git Common Dir]]
- contains [[REQ-002 MCP Runtime Memories Path Override]]
- contains [[REQ-003 Two-Level Opt-Out Mechanism]]
- contains [[REQ-004 Cross-Language Parity]]
- contains [[REQ-005 Security Validation of Effective CWD]]
- contains [[REQ-006 Observability Logging]]
- contains [[DESIGN-001 Implementation Plan]]
- contains [[DESIGN-002 Detection Algorithm Detail]]
- contains [[TASK-001 Config Schema Update]]
- contains [[TASK-002 Implement detectWorktreeMainPath TypeScript]]
- contains [[TASK-003 Implement detectWorktreeMainPath Go]]
- contains [[TASK-004 Implement detectWorktreeMainPath Bun Hooks]]
- contains [[TASK-005 Add Worktree Fallback to matchCwdToProject]]
- contains [[TASK-006 MCP Server Runtime Override]]
- contains [[TASK-007 Cross-Language Parity Tests]]
- contains [[TASK-008 Integration Tests with Real Worktree]]
- informed_by [[ANALYSIS-019 Project Resolution Codebase Research]]
- informed_by [[ANALYSIS-020 Git Worktree Internals Research]]
- informed_by [[ANALYSIS-021 Community Worktree Practices Research]]
- reviewed_by [[CRIT-005 ADR-007 Debate Log]]
