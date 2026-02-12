---
title: TASK-003 Library Integration otiai10-copy
type: task
status: pending
feature-ref: FEAT-004
effort: S
permalink: features/feat-004-registry-based-installer/tasks/task-003-library-integration-otiai10-copy
---

# TASK-003 Library Integration otiai10-copy

## Description

Integrate `otiai10/copy` to replace the hand-rolled `copyBrainFiles` and `copyBrainFilesRecursive` functions (~70 lines). Configure the `Skip` function to exclude `.DS_Store`, `.gitkeep`, and `.git` files/directories. Configure `OnDirExists` for merge behavior. Verify cross-platform behavior (symlinks, permissions, timestamps).

## Definition of Done

- [ ] [requirement] `otiai10/copy` added to `go.mod` via `go get` #acceptance
- [ ] [requirement] `copyBrainFiles` and `copyBrainFilesRecursive` replaced with `copy.Copy()` calls #acceptance
- [ ] [requirement] Skip function excludes `.DS_Store`, `.gitkeep`, `.git` #acceptance
- [ ] [requirement] OnDirExists configured for merge behavior #acceptance
- [ ] [requirement] Old copy functions removed #acceptance
- [ ] [requirement] Tests verify recursive copy with skip filters #acceptance
- [ ] [requirement] Tests verify symlink and permission handling #acceptance

## Observations

- [fact] Status: PENDING #status
- [fact] Effort: S #effort
- [task] Replaces ~70 lines of hand-rolled code with a proven library #improvement
- [technique] Skip function receives `os.FileInfo` and source path for flexible filtering #api
- [fact] otiai10/copy: 769 stars, 1,200+ importers, MIT license #provenance
- [constraint] Must handle macOS .DS_Store files that appear in development environments #platform

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | S |
| Human Effort | 2 hours |
| AI-Dominant Effort | 0.5 hours |
| AI Tier | Tier 1 (AI-Dominant) |
| AI Multiplier | 4x |
| AI Effort | 0.5 hours |
| Rationale | Direct library replacement; API mapping is straightforward |

## Relations

- part_of [[FEAT-004 Registry-Based Installer]]
- implements [[REQ-003 Library Adoptions]]
- enables [[TASK-006 Claude Code Target]]
- enables [[TASK-007 Cursor Target]]
