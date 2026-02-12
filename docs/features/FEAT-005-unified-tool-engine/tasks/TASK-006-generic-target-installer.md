---
title: TASK-006 GenericTarget Installer
type: task
status: proposed
feature-ref: FEAT-005
effort: M
permalink: features/feat-005-unified-tool-engine/tasks/task-006-generic-target-installer
---

# TASK-006 GenericTarget Installer

## Description

Implement the `GenericTarget` struct in `internal/installer/targets/generic.go` that replaces both `ClaudeCodeTarget` and `CursorTarget`. The `GenericTarget` implements the existing `ToolInstaller` interface from `registry.go`, composing the engine's `TransformAll` with a `PlacementStrategy` driven by `ToolConfig`. Wire up automatic registration of all tools from `tools.config.yaml` at startup.

## Definition of Done

- [ ] [requirement] `GenericTarget` struct defined in `internal/installer/targets/generic.go` #acceptance
- [ ] [requirement] Implements `ToolInstaller` interface: Name, DisplayName, ConfigDir, AdapterTarget, Install, Uninstall, IsInstalled #acceptance
- [ ] [requirement] `Install` method: clean, transform, place, write manifest #acceptance
- [ ] [requirement] `Uninstall` method removes placed files using manifest data #acceptance
- [ ] [requirement] `IsInstalled` uses `tool.Detection` config for tool-specific detection #acceptance
- [ ] [requirement] Startup code loads `tools.config.yaml`, validates, and registers all tools with registry #acceptance
- [ ] [requirement] `pipeline.Execute` used for rollback-safe installation steps #acceptance
- [ ] [requirement] Unit tests cover install, uninstall, and is-installed for both tool configs #acceptance

## Observations

- [fact] Status: PROPOSED #status
- [fact] Effort: M #effort
- [task] Unification point: composes engine transform + placement strategy + config into single target #architecture
- [constraint] Must implement existing ToolInstaller interface without modification #compatibility
- [fact] Registry.Register() and pipeline.Execute() from ADR-008 are used unchanged #retention
- [technique] Detection config replaces hardcoded IsInstalled logic in per-tool targets #config-driven

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | M |
| Human Effort | 4 hours |
| AI-Dominant Effort | 1 hour |
| AI Tier | Tier 2 (AI-Capable) |
| AI Multiplier | 2x |
| AI Effort | 2 hours |
| Rationale | Composition of previously built components; the interface contract is well-defined and the pipeline pattern is established |

## Relations

- part_of [[FEAT-005 Unified Tool Engine]]
- implements [[REQ-004 GenericTarget Installer]]
- implements [[DESIGN-001 Engine Architecture]]
- depends_on [[TASK-004 Generic Transform Engine]]
- depends_on [[TASK-005 Placement Strategy Abstraction]]
- enables [[TASK-007 Golden-File Parity Tests]]
- enables [[TASK-009 Integration Tests]]
- extends [[ADR-008 Registry-Based Installer Architecture]]
