---
title: TASK-008-port-brain-hooks-to-js-ts
type: task
status: complete
feature-ref: FEAT-001
effort-estimate-human: 16h
effort-estimate-ai: 8h
milestone: phase-1
tags:
- task
- phase-1
- hooks
- port
- go-to-ts
permalink: features/feat-001-cross-platform-portability/tasks/task-008-port-brain-hooks-to-js-ts
---

# TASK-008 Port brain-hooks Go Binary to JS/TS

## Description

- [fact] Port 8 hook subcommands from `apps/claude-plugin/cmd/hooks/` to JS/TS scripts in `hooks/scripts/` #port
- [fact] Port: session-start (670 LOC), user-prompt (87 LOC), pre-tool-use (57 LOC), stop (87 LOC), detect-scenario (60 LOC), load-skills (229 LOC), analyze (453 LOC), validate-session (77 LOC) #scope
- [fact] Port Go shared package dependencies: packages/utils (project resolution) and packages/validation (scenario detection, session validation) to TS equivalents #dependencies
- [fact] Port 2,669 LOC of Go test code (session_start_test.go, gate_check_test.go, project_resolve_test.go) to TS tests #testing
- [fact] Create `hooks/claude-code.json` mapping Claude Code's 4 hook events to scripts #config
- [fact] Archive Go source (do not delete until TS port validated) #safety

## Definition of Done

- [x] [requirement] All 8 hook subcommands work identically in JS/TS #parity
- [x] [requirement] hooks/claude-code.json maps all Claude Code events correctly #config
- [x] [requirement] Hook scripts executable via Node.js without compilation #portable
- [x] [requirement] Go shared package functionality ported to TS #dependencies
- [x] [requirement] Test coverage equivalent to Go tests (2,669 LOC) #testing
- [x] [requirement] Go binary archived but not deleted #safety

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 3 (Human-Led) |
| Human Estimate | 16h |
| AI-Assisted Estimate | 8h |
| Rationale | 3,673 LOC source + 2,669 LOC tests + shared Go package dependencies; highest-risk single task |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-001-create-root-level-directory-scaffold]]
- enables [[TASK-013-remove-apps-claude-plugin]]
- enables [[TASK-018-build-hook-normalization-shim]]
- satisfies [[REQ-001-canonical-content-extraction]]
- satisfies [[REQ-003-hook-normalization]]
- traces_to [[DESIGN-002-hook-normalization-layer]]
