---
title: TASK-002-move-canonical-skills
type: task
status: complete
feature-ref: FEAT-001
effort-estimate-human: 2h
effort-estimate-ai: 0.5h
milestone: phase-1
tags:
- task
- phase-1
- skills
- extraction
permalink: features/feat-001-cross-platform-portability/tasks/task-002-move-canonical-skills
---

# TASK-002 Move Canonical Skills

## Description

- [fact] Move 27 skill directories from `apps/claude-plugin/skills/` to `skills/` at repo root #extraction
- [fact] Skills use Open Agent Skills standard (SKILL.md); zero content transformation needed #portability
- [fact] Include all `references/`, `resources/`, `templates/`, `scripts/`, `assets/` subdirectories #completeness
- [fact] Remove `skills/CLAUDE.md` (Claude-specific skill dev guide) or make it tool-neutral #cleanup

## Definition of Done

- [x] [requirement] All 27 skill directories at `skills/` with SKILL.md format intact #skills
- [x] [requirement] All scripts (.py, .ps1, .ts) and reference files preserved #completeness
- [x] [requirement] No Claude-specific skill development guides remain #portability

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 1 (AI-Dominant) |
| Human Estimate | 2h |
| AI-Assisted Estimate | 0.5h |
| Rationale | Skills are the most portable content; move is mechanical with no transformation |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-001-create-root-level-directory-scaffold]]
- enables [[TASK-009-consolidate-brain-skills-binary]]
- enables [[TASK-010-create-ts-claude-code-adapter]]
- satisfies [[REQ-001-canonical-content-extraction]]
