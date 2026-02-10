---
title: TASK-015-extend-brain-install-for-cursor
type: task
status: todo
feature-ref: FEAT-001
effort-estimate-human: 3h
effort-estimate-ai: 1h
milestone: phase-2
tags:
- task
- phase-2
- install
- cursor
permalink: features/feat-001-cross-platform-portability/tasks/task-015-extend-brain-install-for-cursor-1
---

# TASK-015 Extend brain install for Cursor

## Description

- [fact] Add Cursor to tool detection in brain install (check ~/.cursor/ directory) #detection
- [fact] Cursor install step: run TS adapter, copy 🧠-prefixed files to .cursor/ #install
- [fact] Cursor hooks.json and mcp.json: JSON merge (additive) with manifest tracking for clean uninstall #json-merge
- [fact] NEVER overwrite user's existing Cursor config files; only add 🧠-prefixed Brain entries #non-destructive
- [fact] Update brain uninstall for Cursor removal (remove 🧠-prefixed files + manifest-tracked JSON entries) #uninstall

## Definition of Done

- [ ] [requirement] Cursor appears in brain install multiselect when detected #detection
- [ ] [requirement] Install uses file copy (not symlinks) with 🧠-prefixed filenames #copy
- [ ] [requirement] hooks.json and mcp.json use JSON merge, not overwrite #json-merge
- [ ] [requirement] Install never modifies user's existing Cursor config #non-destructive
- [ ] [requirement] Uninstall removes 🧠-prefixed files and manifest-tracked JSON entries #uninstall

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 1 (AI-Dominant) |
| Human Estimate | 3h |
| AI-Assisted Estimate | 1h |
| Rationale | Extension of existing install flow; Cursor added as second option to established pattern |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-014-create-ts-cursor-adapter]]
- enables [[TASK-016-implement-brain-cursor-launcher]]
- satisfies [[REQ-004-unified-install]]
