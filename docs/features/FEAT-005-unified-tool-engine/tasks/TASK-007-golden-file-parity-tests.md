---
title: TASK-007 Golden-File Parity Tests
type: task
status: proposed
feature-ref: FEAT-005
effort: M
permalink: features/feat-005-unified-tool-engine/tasks/task-007-golden-file-parity-tests
---

# TASK-007 Golden-File Parity Tests

## Description

Create golden-file comparison tests that validate the engine's `TransformAll` output matches the existing per-tool adapter output byte-for-byte. Reuse or extend the existing `targets/golden_test.go` framework to test the engine path. These tests are the parity gate: old per-tool code cannot be deleted until every golden test passes through the engine.

## Definition of Done

- [ ] [requirement] Golden-file tests compare engine output for Claude Code config against existing golden files #acceptance
- [ ] [requirement] Golden-file tests compare engine output for Cursor config against existing golden files #acceptance
- [ ] [requirement] Tests cover all six content types: agents, skills, commands, rules, hooks, MCP #acceptance
- [ ] [requirement] Tests cover composable directory output (commands with _order.yaml) #acceptance
- [ ] [requirement] Tests cover both direct-write and merge strategy outputs #acceptance
- [ ] [requirement] Tests reuse existing golden-file test infrastructure from `golden_test.go` #acceptance
- [ ] [requirement] Byte-level comparison (not semantic); whitespace and ordering must match #acceptance
- [ ] [requirement] Test failure output shows diff between expected and actual for debugging #acceptance

## Observations

- [fact] Status: PROPOSED #status
- [fact] Effort: M #effort
- [task] Critical validation gate; blocks TASK-010 (per-tool code deletion) #sequencing
- [fact] Existing golden_test.go at targets/golden_test.go provides test infrastructure #reuse
- [constraint] Byte-identical output is non-negotiable; semantic equivalence is insufficient #parity
- [risk] Frontmatter field ordering or whitespace differences may cause false failures requiring engine adjustments #debugging

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | M |
| Human Effort | 3 hours |
| AI-Dominant Effort | 0.75 hours |
| AI Tier | Tier 2 (AI-Capable) |
| AI Multiplier | 2x |
| AI Effort | 1.5 hours |
| Rationale | Test infrastructure exists; main work is wiring engine output through the comparison framework and debugging any parity differences |

## Relations

- part_of [[FEAT-005 Unified Tool Engine]]
- implements [[DESIGN-001 Engine Architecture]]
- depends_on [[TASK-004 Generic Transform Engine]]
- depends_on [[TASK-006 GenericTarget Installer]]
- enables [[TASK-010 Per-Tool Code Deletion]]
