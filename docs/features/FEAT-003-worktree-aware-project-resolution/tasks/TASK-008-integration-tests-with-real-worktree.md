---
title: TASK-008 Integration Tests with Real Worktree
type: task
status: complete
feature-ref: FEAT-003
effort: S
permalink: features/feat-003-worktree-aware-project-resolution/tasks/task-008-integration-tests-with-real-worktree
---

# TASK-008 Integration Tests with Real Worktree

## Description

Create integration tests that verify the full worktree-to-memory resolution pipeline using real git worktree fixtures. Tests create actual git repositories with linked worktrees and verify that project resolution and memory operations work correctly end-to-end across CODE mode, DEFAULT mode, opt-out, and nested CWD scenarios.

## Definition of Done

- [x] [requirement] Test fixture setup creates a real git repo with at least one linked worktree #acceptance
- [x] [requirement] Test verifies project resolution from within a linked worktree CWD #acceptance
- [x] [requirement] Test verifies CODE mode memories path points to worktree-local docs/ #acceptance
- [x] [requirement] Test verifies DEFAULT mode memories path is unchanged #acceptance
- [x] [requirement] Test verifies opt-out disables worktree detection #acceptance
- [x] [requirement] Test verifies security validation rejects crafted paths #acceptance
- [x] [requirement] Test verifies graceful degradation when git is unavailable #acceptance
- [x] [requirement] Fixture teardown removes all created repos and worktrees #acceptance
- [x] [requirement] Tests pass in CI environment #acceptance

## Observations

- [fact] Status: COMPLETE #status
- [fact] Effort: S #effort
- [task] End-to-end validation of the full pipeline #verification
- [technique] Use temp directories for isolation; clean up on teardown #test-hygiene
- [constraint] Requires git installed in CI environment #ci-requirement
- [risk] Worktree creation in CI may have permission issues on some platforms #platform
- [fact] git worktree add is fast (no network, local operation) #performance

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | S |
| Human Effort | 2 hours |
| AI-Dominant Effort | 0.5 hours |
| AI Tier | Tier 2 (AI-Accelerated) |
| AI Multiplier | 2x |
| AI Effort | 1 hour |
| Rationale | Integration test scaffolding with real git worktree fixtures; git operations are well-documented and AI generates test boilerplate efficiently |

## Relations

- part_of [[FEAT-003 Worktree-Aware Project Resolution]]
- validates [[REQ-001 Worktree Detection via Git Common Dir]]
- validates [[REQ-002 MCP Runtime Memories Path Override]]
- validates [[REQ-005 Security Validation of Effective CWD]]
- depends_on [[TASK-005 Add Worktree Fallback to matchCwdToProject]]
- depends_on [[TASK-006 MCP Server Runtime Override]]
