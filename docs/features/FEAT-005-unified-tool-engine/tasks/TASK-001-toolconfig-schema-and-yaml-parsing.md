---
title: TASK-001 ToolConfig Schema and YAML Parsing
type: task
status: proposed
feature-ref: FEAT-005
effort: M
permalink: features/feat-005-unified-tool-engine/tasks/task-001-toolconfig-schema-and-yaml-parsing
---

# TASK-001 ToolConfig Schema and YAML Parsing

## Description

Define the `ToolConfig` Go struct hierarchy in `internal/engine/config.go`, implement YAML parsing for `tools.config.yaml`, and add startup validation that fails fast on invalid config. Create the initial `tools.config.yaml` with Claude Code and Cursor definitions matching their current Go-encoded behavior.

## Definition of Done

- [ ] [requirement] `ToolConfig` struct defined with YAML struct tags in `internal/engine/config.go` #acceptance
- [ ] [requirement] `AgentConfig`, `RuleConfig`, `ConfigFileConfig`, `ManifestConfig`, `DetectionConfig` sub-types defined #acceptance
- [ ] [requirement] `LoadToolConfigs(path string)` function parses YAML and returns typed config #acceptance
- [ ] [requirement] `ValidateToolConfig` checks all 11 validation rules from REQ-001 #acceptance
- [ ] [requirement] `tools.config.yaml` created at `apps/tui/tools.config.yaml` #acceptance
- [ ] [requirement] Claude Code config entries match behavior in existing `claude.go` and `claudecode.go` #acceptance
- [ ] [requirement] Cursor config entries match behavior in existing `cursor.go` and `targets/cursor.go` #acceptance
- [ ] [requirement] Unit tests cover valid config parsing, each validation rule, and error messages #acceptance
- [ ] [requirement] Invalid config causes clear error message with field path #acceptance

## Observations

- [fact] Status: PROPOSED #status
- [fact] Effort: M #effort
- [task] Foundation task; must complete before engine implementation can reference config types #sequencing
- [constraint] Config values must be mechanically verified against existing Go code constants #parity
- [technique] YAML struct tags enable direct unmarshaling without manual field mapping #implementation

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | M |
| Human Effort | 4 hours |
| AI-Dominant Effort | 1 hour |
| AI Tier | Tier 2 (AI-Capable) |
| AI Multiplier | 2x |
| AI Effort | 2 hours |
| Rationale | Struct definitions and YAML parsing are straightforward; extracting exact field values from existing Go code requires careful cross-referencing |

## Relations

- part_of [[FEAT-005 Unified Tool Engine]]
- implements [[REQ-001 Tool Configuration Schema]]
- implements [[DESIGN-002 Config Schema Detail]]
- enables [[TASK-004 Generic Transform Engine]]
- enables [[TASK-005 Placement Strategy Abstraction]]
- enables [[TASK-006 GenericTarget Installer]]
