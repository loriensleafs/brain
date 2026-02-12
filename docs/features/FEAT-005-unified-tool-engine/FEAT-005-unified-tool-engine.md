---
title: FEAT-005 Unified Tool Engine
type: feature
status: in-progress
source-refs:
- ADR-009
permalink: features/feat-005-unified-tool-engine/feat-005-unified-tool-engine
---

# FEAT-005 Unified Tool Engine

## Context

Config-driven tool engine for the [[Brain TUI]] installer: replace per-tool adapter files (`claude.go`, `cursor.go`) and per-tool installer targets (`claudecode.go`, `cursor.go`) with a single generic engine parameterized by YAML configuration. The current architecture duplicates six-phase transform logic (agents, skills, commands, rules, hooks, MCP) across two adapter files (1,571 lines) and two installer target files (791 lines) -- 2,362 lines of per-tool Go code that is 80% identical. The remaining 20% reduces to five parameterizable axes: frontmatter fields, file extension, prefix behavior, merge strategy, and placement strategy. ADR-009 proposes replacing all per-tool code with a `ToolConfig` YAML schema and a generic transform engine, reducing new-tool effort from ~1,000 lines of Go to ~30 lines of YAML. Builds on ADR-008's registry-based installer architecture (registry, pipeline, executor, manifest are retained unchanged).

## Scope

### In Scope

- [requirement] `ToolConfig` YAML schema defining per-tool parameters (frontmatter, extensions, prefix, merge, placement) #config #p1
- [requirement] `tools.config.yaml` file with Claude Code and Cursor tool definitions #config #p1
- [requirement] Generic `TransformAll` function replacing `TransformClaudeCodeFromSource` and `CursorTransformFromSource` #engine #p1
- [requirement] Config parsing and validation with fail-fast on invalid config #config #p1
- [requirement] Placement strategy abstraction (marketplace, copy_and_merge) #placement #p1
- [requirement] Single `GenericTarget` replacing `claudecode.go` and `cursor.go` installer targets #installer #p1
- [requirement] Three install scopes (global, plugin, project) per tool configuration #scopes #p1
- [requirement] Build-time version constant replacing hardcoded "2.0.0" string #versioning #p1
- [requirement] Golden-file parity tests validating engine output matches existing adapter output byte-for-byte #testing #p1
- [requirement] Shared code migration: `shared.go`, `compose.go`, `source.go` relocated from `adapters/` to `engine/` #migration #p1
- [requirement] Deletion of per-tool adapter files after parity validation #cleanup #p2

### Out of Scope

- [decision] New tool additions (Windsurf, Cline, Codex) deferred to post-engine validation #deferred
- [decision] Changes to registry, pipeline, executor, or manifest internals (retained from ADR-008) #out-of-scope
- [decision] Changes to template content or canonical agent/skill/command definitions #out-of-scope
- [decision] Runtime plugin loading or dynamic tool registration #rejected
- [decision] Code generation approach for per-tool files #rejected
- [decision] Changes to `brain.config.json` schema (tool config is separate YAML) #out-of-scope

## Phases

- Phase 1: Foundation (TASK-001 through TASK-003) #config #engine
- Phase 2: Engine Implementation (TASK-004 through TASK-006) #transform #placement #installer
- Phase 3: Validation and Migration (TASK-007 through TASK-010) #testing #migration #cleanup

## Effort Summary

| Estimate Type | Effort |
|---|---|
| Human estimate | 32 hours |
| AI-Dominant estimate | ~8 hours |
| AI-Assisted estimate | ~16 hours |

### Task Detail

| Task | Tier | Human | AI-Dominant | AI-Assisted |
|---|---|---|---|---|
| TASK-001 ToolConfig Schema and YAML Parsing | T2 | 4h | 1h | 2h |
| TASK-002 Build-Time Version Constant | T1 | 1h | 0.25h | 0.5h |
| TASK-003 Relocate Shared Code to Engine Package | T1 | 2h | 0.5h | 1h |
| TASK-004 Generic Transform Engine | T3 | 8h | 2h | 4h |
| TASK-005 Placement Strategy Abstraction | T2 | 4h | 1h | 2h |
| TASK-006 GenericTarget Installer | T2 | 4h | 1h | 2h |
| TASK-007 Golden-File Parity Tests | T2 | 3h | 0.75h | 1.5h |
| TASK-008 Three Install Scopes | T2 | 3h | 0.75h | 1.5h |
| TASK-009 Integration Tests | T2 | 2h | 0.5h | 1h |
| TASK-010 Per-Tool Code Deletion | T1 | 1h | 0.25h | 0.5h |

## Success Criteria

- [ ] [requirement] `TransformAll` produces byte-identical output to existing `TransformClaudeCodeFromSource` for Claude Code config #parity
- [ ] [requirement] `TransformAll` produces byte-identical output to existing `CursorTransformFromSource` for Cursor config #parity
- [ ] [requirement] `GenericTarget` passes all existing golden-file tests for both tools #parity
- [ ] [requirement] New tool can be added with YAML-only config change (zero Go code) #extensibility
- [ ] [requirement] All existing `brain install` behavior is preserved (no user-visible changes) #compatibility
- [ ] [requirement] Per-tool adapter Go code (2,362 lines) is deleted after parity validation #cleanup
- [ ] [requirement] Build-time version constant replaces all hardcoded version strings #versioning
- [ ] [requirement] Three install scopes (global, plugin, project) work for both tools #scopes
- [ ] [requirement] Config validation rejects invalid tool definitions at startup #fail-fast

## Artifact Status

### Requirements

- [ ] [requirement] [[REQ-001 Tool Configuration Schema]] #status-proposed
- [ ] [requirement] [[REQ-002 Generic Transform Engine]] #status-proposed
- [ ] [requirement] [[REQ-003 Placement Strategy Abstraction]] #status-proposed
- [ ] [requirement] [[REQ-004 GenericTarget Installer]] #status-proposed
- [ ] [requirement] [[REQ-005 Three Install Scopes]] #status-proposed
- [ ] [requirement] [[REQ-006 Build-Time Version Constant]] #status-proposed

### Designs

- [ ] [design] [[DESIGN-001 Engine Architecture]] #status-proposed
- [ ] [design] [[DESIGN-002 Config Schema Detail]] #status-proposed

### Tasks

- [ ] [task] [[TASK-001 ToolConfig Schema and YAML Parsing]] #status-proposed
- [ ] [task] [[TASK-002 Build-Time Version Constant]] #status-proposed
- [ ] [task] [[TASK-003 Relocate Shared Code to Engine Package]] #status-proposed
- [ ] [task] [[TASK-004 Generic Transform Engine]] #status-proposed
- [ ] [task] [[TASK-005 Placement Strategy Abstraction]] #status-proposed
- [ ] [task] [[TASK-006 GenericTarget Installer]] #status-proposed
- [ ] [task] [[TASK-007 Golden-File Parity Tests]] #status-proposed
- [ ] [task] [[TASK-008 Three Install Scopes]] #status-proposed
- [ ] [task] [[TASK-009 Integration Tests]] #status-proposed
- [ ] [task] [[TASK-010 Per-Tool Code Deletion]] #status-proposed

## Observations

- [decision] Config-driven engine replaces per-tool adapter and installer target Go files #architecture
- [decision] YAML schema captures all per-tool differences: frontmatter, extensions, prefix, merge strategy, placement #config
- [decision] Shared code (shared.go, compose.go, source.go) relocated to engine/ package, not duplicated #migration
- [decision] ADR-008 infrastructure (registry, pipeline, executor, manifest) retained unchanged #continuity
- [decision] Incremental migration: engine alongside old code, golden-file parity, then delete old files #migration
- [fact] Per-tool adapter code totals 1,571 lines (claude.go 877 + cursor.go 694) #codebase
- [fact] Per-tool installer target code totals 791 lines (claudecode.go 225 + cursor.go 566) #codebase
- [fact] Total per-tool Go code to eliminate: 2,362 lines #impact
- [fact] Shared code retained unchanged: shared.go (618), compose.go (483), source.go (107) #codebase
- [insight] Per-tool differences reduce to 5 parameterizable axes: frontmatter fields, file extension, prefix, merge strategy, placement strategy #analysis
- [insight] 80% of per-tool adapter code is identical; the 20% that differs is data, not logic #architecture
- [risk] Incremental migration requires maintaining both old and new code paths temporarily #complexity
- [constraint] Engine output must match existing golden files byte-for-byte before old code removal #parity

## Relations

- implements [[ADR-009 Unified Tool Engine]]
- derives_from [[ADR-009 Unified Tool Engine]]
- contains [[REQ-001 Tool Configuration Schema]]
- contains [[REQ-002 Generic Transform Engine]]
- contains [[REQ-003 Placement Strategy Abstraction]]
- contains [[REQ-004 GenericTarget Installer]]
- contains [[REQ-005 Three Install Scopes]]
- contains [[REQ-006 Build-Time Version Constant]]
- contains [[DESIGN-001 Engine Architecture]]
- contains [[DESIGN-002 Config Schema Detail]]
- contains [[TASK-001 ToolConfig Schema and YAML Parsing]]
- contains [[TASK-002 Build-Time Version Constant]]
- contains [[TASK-003 Relocate Shared Code to Engine Package]]
- contains [[TASK-004 Generic Transform Engine]]
- contains [[TASK-005 Placement Strategy Abstraction]]
- contains [[TASK-006 GenericTarget Installer]]
- contains [[TASK-007 Golden-File Parity Tests]]
- contains [[TASK-008 Three Install Scopes]]
- contains [[TASK-009 Integration Tests]]
- contains [[TASK-010 Per-Tool Code Deletion]]
- extends [[ADR-008 Registry-Based Installer Architecture]]
- relates_to [[ADR-003 Adapter Implementation Decisions]]
- relates_to [[ADR-005 Config and Agents MD Decisions]]
