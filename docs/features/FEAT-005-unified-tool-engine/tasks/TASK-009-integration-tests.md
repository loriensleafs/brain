---
title: TASK-009 Integration Tests
type: task
status: proposed
feature-ref: FEAT-005
effort: S
permalink: features/feat-005-unified-tool-engine/tasks/task-009-integration-tests
---

# TASK-009 Integration Tests

## Description

Create end-to-end integration tests that exercise the full install pipeline through the engine: config loading, transform, placement, and manifest writing. Tests use temporary directories to verify that `brain install` produces the correct file structure for each tool and scope combination. Tests verify install, uninstall, and is-installed flows.

## Definition of Done

- [ ] [requirement] Integration test for Claude Code full install flow (marketplace placement) #acceptance
- [ ] [requirement] Integration test for Cursor full install flow (copy_and_merge placement) #acceptance
- [ ] [requirement] Integration test for uninstall flow (files removed, manifest cleaned) #acceptance
- [ ] [requirement] Integration test for is-installed detection (both detection types) #acceptance
- [ ] [requirement] Tests use temporary directories (no real ~/.claude or ~/.cursor modification) #acceptance
- [ ] [requirement] Tests verify file structure in output directory matches expected layout #acceptance
- [ ] [requirement] Tests verify manifest content (file list or marketplace metadata) #acceptance

## Observations

- [fact] Status: PROPOSED #status
- [fact] Effort: S #effort
- [task] End-to-end validation of the full pipeline #scope
- [constraint] Must not modify real tool config directories; use temp dirs #safety
- [technique] Temporary directory fixtures with embedded test templates #testing
- [fact] Complements golden-file tests (TASK-007) which validate transform output; integration tests validate placement and manifest #complementary

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | S |
| Human Effort | 2 hours |
| AI-Dominant Effort | 0.5 hours |
| AI Tier | Tier 2 (AI-Capable) |
| AI Multiplier | 2x |
| AI Effort | 1 hour |
| Rationale | Integration test patterns are established in existing golden_test.go; main work is wiring the full pipeline through temp directories |

## Relations

- part_of [[FEAT-005 Unified Tool Engine]]
- implements [[DESIGN-001 Engine Architecture]]
- depends_on [[TASK-006 GenericTarget Installer]]
- depends_on [[TASK-007 Golden-File Parity Tests]]
- enables [[TASK-010 Per-Tool Code Deletion]]
