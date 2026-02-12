---
title: FEAT-004 Registry-Based Installer
type: feature
status: in-progress
source-refs:
- ADR-008
permalink: features/feat-004-registry-based-installer/feat-004-registry-based-installer
---

# FEAT-004 Registry-Based Installer

## Context

Registry-based installer architecture for the Brain TUI: replaces the monolithic `apps/tui/cmd/install.go` (1,588 lines, 6 switch dispatch sites) with a registry pattern using `init()`-based self-registration, five library adoptions replacing hand-rolled implementations, a step pipeline with reverse-order rollback, and parallel multi-tool execution via `errgroup`. [[ADR-008 Registry-Based Installer Architecture]] was ACCEPTED, specifying a clean-break rewrite with no backwards compatibility layer. Research across 5 AI coding tools (Claude Code, Cursor, Windsurf, Cline, Copilot) confirms that plugin systems have converged on nearly identical patterns, making the adapter job 80% file placement and 20% tool-specific transform.

## Scope

### In Scope

- [requirement] `ToolInstaller` interface and registry with `Register()`, `Get()`, `All()` functions #registry #p1
- [requirement] Optional lifecycle interfaces: `Provisioner`, `Validator`, `Cleaner` via type assertion #registry #p1
- [requirement] Claude Code target implementing `ToolInstaller` with marketplace registration #targets #p1
- [requirement] Cursor target implementing `ToolInstaller` #targets #p1
- [requirement] Step pipeline with reverse-order rollback compensation on failure #pipeline #p1
- [requirement] Condition guards on pipeline steps for idempotent re-runs #pipeline #p1
- [requirement] Parallel multi-tool execution via `errgroup.WithContext` #concurrency #p1
- [requirement] Buffered output per tool to prevent interleaving during parallel installs #concurrency #p1
- [requirement] Adoption of otiai10/copy for recursive directory copy #libraries #p1
- [requirement] Adoption of tidwall/gjson for path-based JSON reads #libraries #p1
- [requirement] Adoption of tidwall/sjson for path-based JSON set/delete #libraries #p1
- [requirement] Adoption of evanphx/json-patch for RFC 7396 JSON Merge Patch #libraries #p1
- [requirement] Adoption of adrg/xdg for XDG Base Directory resolution #libraries #p1
- [requirement] Config-driven target activation from `brain.config.json` targets section #config #p2
- [requirement] Golden-file tests for each target comparing output against checked-in expected files #testing #p1

### Out of Scope

- [decision] Windsurf, Cline, Copilot targets (deferred to future PRs; adding them is the point of the registry) #deferred
- [decision] Backwards compatibility layer for old install.go (ADR-008 specifies clean break) #out-of-scope
- [decision] Changes to the adapter/template system (TemplateSource preserved as-is) #out-of-scope
- [decision] Changes to the TUI form/selection UI (huh forms preserved as-is) #out-of-scope
- [decision] Config migration tooling for brain.config.json targets section #deferred

## Phases

- Phase 1: Foundation (TASK-001 through TASK-004) #registry #pipeline #libraries
- Phase 2: Targets (TASK-005 through TASK-007) #targets #integration
- Phase 3: Orchestration (TASK-008 through TASK-009) #concurrency #cmd
- Phase 4: Validation (TASK-010) #testing

## Effort Summary

| Estimate Type | Effort |
|---|---|
| Human estimate | 32 hours |
| AI-Dominant estimate | ~8 hours |
| AI-Assisted estimate | ~16 hours |

### Task Detail

| Task | Tier | Human | AI-Dominant | AI-Assisted |
|---|---|---|---|---|
| TASK-001 Registry and ToolInstaller Interface | T1 | 2h | 0.5h | 1h |
| TASK-002 Step Pipeline with Rollback | T1 | 2h | 0.5h | 1h |
| TASK-003 Library Integration otiai10/copy | T1 | 2h | 0.5h | 1h |
| TASK-004 Library Integration tidwall/gjson and sjson | T2 | 3h | 0.75h | 1.5h |
| TASK-005 Library Integration evanphx/json-patch and adrg/xdg | T2 | 3h | 0.75h | 1.5h |
| TASK-006 Claude Code Target | T2 | 4h | 1h | 2h |
| TASK-007 Cursor Target | T2 | 3h | 0.75h | 1.5h |
| TASK-008 Parallel Multi-Tool Execution | T2 | 4h | 1h | 2h |
| TASK-009 Install Command Rewrite | T3 | 5h | 1.25h | 2.5h |
| TASK-010 Golden-File and Integration Tests | T2 | 4h | 1h | 2h |

## Success Criteria

- [ ] [requirement] All 6 switch dispatch sites in install.go are eliminated #registry
- [ ] [requirement] Claude Code and Cursor targets install correctly via registry dispatch #targets
- [ ] [requirement] Pipeline rollback restores clean state on any step failure #reliability
- [ ] [requirement] JSON merge works at arbitrary depth (RFC 7396) replacing 2-level limit #correctness
- [ ] [requirement] Parallel install of multiple tools completes without output interleaving #concurrency
- [ ] [requirement] Idempotent re-run skips already-completed steps via Condition guards #idempotency
- [ ] [requirement] Adding a new tool target requires one Go file and one blank import #extensibility
- [ ] [requirement] install.go reduced from 1,588 lines to ~300 lines (cmd orchestration only) #simplicity
- [ ] [requirement] Golden-file tests pass for all targets #testing
- [ ] [requirement] XDG paths resolve correctly on macOS and Linux #cross-platform

## Artifact Status

### Requirements

- [ ] [requirement] [[REQ-001 ToolInstaller Interface and Registry]] #status-pending
- [ ] [requirement] [[REQ-002 Step Pipeline with Rollback]] #status-pending
- [ ] [requirement] [[REQ-003 Library Adoptions]] #status-pending
- [ ] [requirement] [[REQ-004 Claude Code Target]] #status-pending
- [ ] [requirement] [[REQ-005 Cursor Target]] #status-pending
- [ ] [requirement] [[REQ-006 Parallel Multi-Tool Execution]] #status-pending
- [ ] [requirement] [[REQ-007 Config-Driven Target Activation]] #status-pending

### Designs

- [ ] [design] [[DESIGN-001 Registry and Pipeline Architecture]] #status-pending
- [ ] [design] [[DESIGN-002 Target Implementation Guide]] #status-pending

### Tasks

- [ ] [task] [[TASK-001 Registry and ToolInstaller Interface]] #status-pending
- [ ] [task] [[TASK-002 Step Pipeline with Rollback]] #status-pending
- [ ] [task] [[TASK-003 Library Integration otiai10-copy]] #status-pending
- [ ] [task] [[TASK-004 Library Integration tidwall-gjson-sjson]] #status-pending
- [ ] [task] [[TASK-005 Library Integration json-patch-xdg]] #status-pending
- [ ] [task] [[TASK-006 Claude Code Target]] #status-pending
- [ ] [task] [[TASK-007 Cursor Target]] #status-pending
- [ ] [task] [[TASK-008 Parallel Multi-Tool Execution]] #status-pending
- [ ] [task] [[TASK-009 Install Command Rewrite]] #status-pending
- [ ] [task] [[TASK-010 Golden-File and Integration Tests]] #status-pending

## Observations

- [decision] Registry pattern with init()-based self-registration eliminates all 6 switch dispatch sites #architecture
- [decision] Clean-break rewrite; no backwards compatibility layer needed #migration
- [decision] Five libraries adopted to replace hand-rolled implementations with proven solutions #libraries
- [decision] Step pipeline with reverse-order rollback provides atomic install guarantees #reliability
- [decision] Parallel execution via errgroup with buffered output prevents interleaving #concurrency
- [fact] Current install.go is 1,588 lines with 6 switch dispatch locations across 4 functions #codebase
- [fact] AI tool plugin systems converge: skills, rules, MCP config, hooks in dotfiles #research
- [fact] Adding a new tool target drops from ~200 lines across 6 sites to ~80-120 lines in one file #impact
- [insight] The adapter job is 80% file placement, 20% tool-specific transform, making registry a natural fit #architecture
- [constraint] All five libraries must have zero/near-zero transitive deps, MIT/BSD license, active maintenance #selection-criteria
- [risk] Clean break means old and new cannot coexist; must be a single PR #migration

## Relations

- implements [[ADR-008 Registry-Based Installer Architecture]]
- derives_from [[ADR-008 Registry-Based Installer Architecture]]
- contains [[REQ-001 ToolInstaller Interface and Registry]]
- contains [[REQ-002 Step Pipeline with Rollback]]
- contains [[REQ-003 Library Adoptions]]
- contains [[REQ-004 Claude Code Target]]
- contains [[REQ-005 Cursor Target]]
- contains [[REQ-006 Parallel Multi-Tool Execution]]
- contains [[REQ-007 Config-Driven Target Activation]]
- contains [[DESIGN-001 Registry and Pipeline Architecture]]
- contains [[DESIGN-002 Target Implementation Guide]]
- contains [[TASK-001 Registry and ToolInstaller Interface]]
- contains [[TASK-002 Step Pipeline with Rollback]]
- contains [[TASK-003 Library Integration otiai10-copy]]
- contains [[TASK-004 Library Integration tidwall-gjson-sjson]]
- contains [[TASK-005 Library Integration json-patch-xdg]]
- contains [[TASK-006 Claude Code Target]]
- contains [[TASK-007 Cursor Target]]
- contains [[TASK-008 Parallel Multi-Tool Execution]]
- contains [[TASK-009 Install Command Rewrite]]
- contains [[TASK-010 Golden-File and Integration Tests]]
- supersedes [[ADR-003 Adapter Implementation Decisions]]
- extends [[ADR-002 Cross-Platform Plugin Architecture]]
