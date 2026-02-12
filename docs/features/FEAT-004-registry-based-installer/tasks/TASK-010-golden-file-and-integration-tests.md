---
title: TASK-010 Golden-File and Integration Tests
type: task
status: pending
feature-ref: FEAT-004
effort: M
permalink: features/feat-004-registry-based-installer/tasks/task-010-golden-file-and-integration-tests
---

# TASK-010 Golden-File and Integration Tests

## Description

Create golden-file snapshot tests for each target and integration tests for the full install/uninstall pipeline. Golden-file tests compare generated output against checked-in expected files in `testdata/` directories. Integration tests verify: registry dispatch, pipeline rollback, parallel execution, config-driven filtering, and idempotent re-runs. Tests use `otiai10/copy` + temp dirs for isolation.

## Definition of Done

- [ ] [requirement] Golden-file test for Claude Code target #acceptance
- [ ] [requirement] Golden-file test for Cursor target #acceptance
- [ ] [requirement] Golden files in `testdata/claudecode-golden/` and `testdata/cursor-golden/` #acceptance
- [ ] [requirement] `-update` flag regenerates golden files #acceptance
- [ ] [requirement] Integration test: full install then verify output structure #acceptance
- [ ] [requirement] Integration test: install failure triggers rollback, system clean after #acceptance
- [ ] [requirement] Integration test: parallel install of both targets #acceptance
- [ ] [requirement] Integration test: idempotent re-run skips completed steps #acceptance
- [ ] [requirement] Integration test: uninstall removes all Brain content #acceptance
- [ ] [requirement] All tests pass with `go test ./...` #acceptance
- [ ] [requirement] Tests integrated into existing CI pipeline #acceptance

## Observations

- [fact] Status: PENDING #status
- [fact] Effort: M #effort
- [task] Final validation; must pass before the feature is considered complete #quality-gate
- [technique] Golden-file tests catch any output drift automatically without manual assertion updates #testing
- [technique] Temp dirs via t.TempDir() ensure test isolation and automatic cleanup #hygiene
- [constraint] Golden files must be platform-independent (no OS-specific paths in expected output) #portability
- [risk] Golden files need updating when adapter templates change; -update flag handles this #maintenance

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | M |
| Human Effort | 4 hours |
| AI-Dominant Effort | 1 hour |
| AI Tier | Tier 2 (AI-Accelerated) |
| AI Multiplier | 2x |
| AI Effort | 2 hours |
| Rationale | Test scaffolding and golden-file infrastructure; AI generates boilerplate efficiently but test scenarios and golden-file content require human review |

## Relations

- part_of [[FEAT-004 Registry-Based Installer]]
- validates [[REQ-001 ToolInstaller Interface and Registry]]
- validates [[REQ-002 Step Pipeline with Rollback]]
- validates [[REQ-004 Claude Code Target]]
- validates [[REQ-005 Cursor Target]]
- validates [[REQ-006 Parallel Multi-Tool Execution]]
- depends_on [[TASK-006 Claude Code Target]]
- depends_on [[TASK-007 Cursor Target]]
- depends_on [[TASK-008 Parallel Multi-Tool Execution]]
- depends_on [[TASK-009 Install Command Rewrite]]
