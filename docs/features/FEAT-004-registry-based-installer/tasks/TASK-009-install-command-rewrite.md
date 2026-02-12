---
title: TASK-009 Install Command Rewrite
type: task
status: pending
feature-ref: FEAT-004
effort: L
permalink: features/feat-004-registry-based-installer/tasks/task-009-install-command-rewrite
---

# TASK-009 Install Command Rewrite

## Description

Rewrite `apps/tui/cmd/install.go` as a thin orchestration layer (~300 lines) that uses the registry, pipeline, and parallel execution infrastructure. The file handles: UI (huh forms for tool selection and confirmation), dependency checking, calling `registry.All()` filtered by config targets, running parallel installs via errgroup, and reporting results. All tool-specific logic is eliminated from this file. This replaces the current 1,588-line monolith.

## Definition of Done

- [ ] [requirement] install.go rewritten to ~300 lines #acceptance
- [ ] [requirement] All 6 switch dispatch sites eliminated #acceptance
- [ ] [requirement] UI layer preserved (huh forms for tool selection) #acceptance
- [ ] [requirement] Dependency checking preserved #acceptance
- [ ] [requirement] Registry.All() called for tool enumeration #acceptance
- [ ] [requirement] Config-driven target filtering applied when config targets section exists #acceptance
- [ ] [requirement] Parallel execution via errgroup for confirmed tools #acceptance
- [ ] [requirement] Per-tool result reporting (success/failure with details) #acceptance
- [ ] [requirement] Blank import of targets package triggers registration #acceptance
- [ ] [requirement] Uninstall command also uses registry dispatch (no switch) #acceptance
- [ ] [requirement] Existing tests updated to match new architecture #acceptance

## Observations

- [fact] Status: PENDING #status
- [fact] Effort: L #effort
- [task] The culmination task; wires everything together and replaces the monolith #integration
- [constraint] UI behavior should be identical from the user's perspective #backward-compatible
- [risk] This is a single PR clean break; old and new cannot coexist #migration
- [technique] Blank import `_ "github.com/peterkloss/brain-tui/internal/installer/targets"` triggers registration #pattern
- [fact] install.go drops from 1,588 lines to ~300 with 0 switch statements #impact

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | L |
| Human Effort | 5 hours |
| AI-Dominant Effort | 1.25 hours |
| AI Tier | Tier 3 (Human-Primary) |
| AI Multiplier | 1.5x |
| AI Effort | 3.33 hours |
| Rationale | Highest integration complexity; must preserve exact UI behavior while completely replacing internals. Human oversight critical for ensuring no behavioral regression |

## Relations

- part_of [[FEAT-004 Registry-Based Installer]]
- implements [[REQ-007 Config-Driven Target Activation]]
- implements [[DESIGN-001 Registry and Pipeline Architecture]]
- depends_on [[TASK-001 Registry and ToolInstaller Interface]]
- depends_on [[TASK-006 Claude Code Target]]
- depends_on [[TASK-007 Cursor Target]]
- depends_on [[TASK-008 Parallel Multi-Tool Execution]]
- validated_by [[TASK-010 Golden-File and Integration Tests]]
