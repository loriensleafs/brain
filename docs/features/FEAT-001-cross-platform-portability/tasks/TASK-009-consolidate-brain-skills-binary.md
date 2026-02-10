---
title: TASK-009-consolidate-brain-skills-binary
type: task
status: todo
feature-ref: FEAT-001
effort-estimate-human: 3h
effort-estimate-ai: 1h
milestone: phase-1
tags:
- task
- phase-1
- skills
- port
permalink: features/feat-001-cross-platform-portability/tasks/task-009-consolidate-brain-skills-binary-1
---

# TASK-009 Consolidate brain-skills Go Binary

## Description

- [fact] Determine strategy for brain-skills binary (3 commands: incoherence, decision-critic, fix-fences; 627 LOC) #decision
- [fact] Each Go command has a Python equivalent in skills/; consolidate to Python-only or port to JS/TS #consolidation
- [fact] Update SKILL.md files to reference correct script paths after consolidation #references
- [fact] Archive Go source (do not delete until consolidation validated) #safety

## Definition of Done

- [ ] [requirement] brain-skills binary no longer required for skill execution #no-binary
- [ ] [requirement] All 3 skill workflows (incoherence, decision-critic, fix-fences) work via Python or JS/TS #functional
- [ ] [requirement] SKILL.md files reference correct script paths #references
- [ ] [requirement] Go source archived but not deleted #safety

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 1 (AI-Dominant) |
| Human Estimate | 3h |
| AI-Assisted Estimate | 1h |
| Rationale | Python equivalents already exist; consolidation is primarily removing Go binary and updating references |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-002-move-canonical-skills]]
- enables [[TASK-013-remove-apps-claude-plugin]]
- satisfies [[REQ-001-canonical-content-extraction]]
