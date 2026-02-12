---
title: TASK-008 Three Install Scopes
type: task
status: proposed
feature-ref: FEAT-005
effort: M
permalink: features/feat-005-unified-tool-engine/tasks/task-008-three-install-scopes
---

# TASK-008 Three Install Scopes

## Description

Implement the three install scopes (global, plugin, project) with CLI flag support and config-driven defaults. Add a `--scope` flag to the `brain install` command that overrides the tool's `default_scope`. Scope resolution expands `~` and resolves project-relative paths. Validate that the specified scope exists in the tool's `Scopes` map.

## Definition of Done

- [ ] [requirement] `--scope` CLI flag added to `brain install` command #acceptance
- [ ] [requirement] Default scope read from `tool.DefaultScope` when no flag provided #acceptance
- [ ] [requirement] Scope path resolved from `tool.Scopes[scope]` #acceptance
- [ ] [requirement] `~` expansion works in scope paths #acceptance
- [ ] [requirement] Project scope resolves relative to current working directory #acceptance
- [ ] [requirement] Error message when scope not found in tool's Scopes map #acceptance
- [ ] [requirement] Install writes to correct directory for each scope #acceptance
- [ ] [requirement] Tests cover global, plugin, and project scopes for Claude Code config #acceptance
- [ ] [requirement] Tests cover global and project scopes for Cursor config #acceptance

## Observations

- [fact] Status: PROPOSED #status
- [fact] Effort: M #effort
- [task] CLI change plus scope resolution logic #scope
- [constraint] Not all tools support all scopes; validation against per-tool Scopes map required #validation
- [fact] Current code supports only one install location per tool #limitation
- [technique] Scope resolution is pure path computation; engine and placement are scope-agnostic #separation

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | M |
| Human Effort | 3 hours |
| AI-Dominant Effort | 0.75 hours |
| AI Tier | Tier 2 (AI-Capable) |
| AI Multiplier | 2x |
| AI Effort | 1.5 hours |
| Rationale | CLI flag wiring is straightforward; scope resolution is pure path logic; testing requires verifying output locations |

## Relations

- part_of [[FEAT-005 Unified Tool Engine]]
- implements [[REQ-005 Three Install Scopes]]
- depends_on [[TASK-001 ToolConfig Schema and YAML Parsing]]
- depends_on [[TASK-006 GenericTarget Installer]]
