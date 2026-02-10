---
title: TASK-020-add-ci-validation-and-golden-files
type: task
status: todo
feature-ref: FEAT-001
effort-estimate-human: 4h
effort-estimate-ai: 2h
milestone: phase-3
tags:
- task
- phase-3
- ci
- testing
- golden-files
permalink: features/feat-001-cross-platform-portability/tasks/task-020-add-ci-validation-and-golden-files
---

# TASK-020 Add CI Validation and Golden Files

## Description

- [fact] Create golden file snapshots for Claude Code adapter output #golden-files
- [fact] Create golden file snapshots for Cursor adapter output #golden-files
- [fact] CI check: adapter transforms produce expected output #ci
- [fact] CI check: brain.config.json valid and complete #ci
- [fact] CI check: hook configs valid for both tools #ci
- [fact] CI check: no agent/skill/command files in adapter directories #enforcement

## Definition of Done

- [ ] [requirement] Golden file snapshots committed for both adapters #golden-files
- [ ] [requirement] CI validates adapter output matches golden files #ci
- [ ] [requirement] CI fails on violations #enforcement
- [ ] [requirement] Documentation updated with multi-tool support #documentation

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 1 (AI-Dominant) |
| Human Estimate | 4h |
| AI-Assisted Estimate | 2h |
| Rationale | CI pipeline configuration with well-defined validation checks; golden file generation is mechanical |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-019-refactor-hook-scripts-for-normalization]]
