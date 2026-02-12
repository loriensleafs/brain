---
title: TASK-004 Generic Transform Engine
type: task
status: proposed
feature-ref: FEAT-005
effort: XL
permalink: features/feat-005-unified-tool-engine/tasks/task-004-generic-transform-engine
---

# TASK-004 Generic Transform Engine

## Description

Implement the `TransformAll` function in `internal/engine/transform.go` that replaces both `TransformClaudeCodeFromSource` and `CursorTransformFromSource`. The function accepts a `ToolConfig` and produces a `TransformOutput` containing `GeneratedFile` slices for each content type (agents, skills, commands, rules, hooks, MCP). Each phase is parameterized by config rather than hardcoded per-tool logic.

## Definition of Done

- [ ] [requirement] `TransformAll` function defined in `internal/engine/transform.go` #acceptance
- [ ] [requirement] `TransformOutput` struct groups GeneratedFile slices by content type #acceptance
- [ ] [requirement] Agent transform applies only frontmatter fields from `tool.Agents.Frontmatter` #acceptance
- [ ] [requirement] Skill transform applies prefix behavior from `tool.Prefix` #acceptance
- [ ] [requirement] Command transform applies prefix and delegates to compose.go for composable dirs #acceptance
- [ ] [requirement] Rule transform applies `tool.Rules.Extension` and `tool.Rules.ExtraFrontmatter` #acceptance
- [ ] [requirement] Hook transform dispatches on `tool.Hooks.Strategy` (direct, merge, none) #acceptance
- [ ] [requirement] MCP transform dispatches on `tool.MCP.Strategy` (direct, merge, none) #acceptance
- [ ] [requirement] Zero per-tool branching in transform code (all behavior from config) #acceptance
- [ ] [requirement] Unit tests for each phase with both Claude Code and Cursor configs #acceptance
- [ ] [requirement] Output matches existing per-tool adapter output (validated in TASK-007) #acceptance

## Observations

- [fact] Status: PROPOSED #status
- [fact] Effort: XL #effort
- [task] Core engine task; highest complexity and most lines of new code #complexity
- [constraint] Must reuse existing shared utilities (compose.go, source.go) without modification #retention
- [risk] Frontmatter field ordering may differ between config-driven and hardcoded approaches; must match byte-for-byte #parity
- [technique] Each transform phase mirrors the existing adapter structure for migration safety #migration

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | XL |
| Human Effort | 8 hours |
| AI-Dominant Effort | 2 hours |
| AI Tier | Tier 3 (Human-Primary) |
| AI Multiplier | 1.5x |
| AI Effort | 5.33 hours |
| Rationale | Highest complexity; requires understanding all six transform phases, per-tool edge cases, frontmatter ordering, and byte-level parity with existing output |

## Relations

- part_of [[FEAT-005 Unified Tool Engine]]
- implements [[REQ-002 Generic Transform Engine]]
- implements [[DESIGN-001 Engine Architecture]]
- depends_on [[TASK-001 ToolConfig Schema and YAML Parsing]]
- depends_on [[TASK-003 Relocate Shared Code to Engine Package]]
- enables [[TASK-006 GenericTarget Installer]]
- enables [[TASK-007 Golden-File Parity Tests]]
