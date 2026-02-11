---
title: ANALYSIS-023-case-insensitive-fs-note-rename-bug
type: analysis
permalink: analysis/analysis-023-case-insensitive-fs-note-rename-bug
tags:
- bug
- filesystem
- macos
- brain-mcp
- data-loss
---

# ANALYSIS-023 Case-Insensitive FS Note Rename Bug

## Problem

On macOS (APFS default: case-insensitive), using Brain MCP delete_note after a case-only rename causes data loss. The filesystem treats `CRIT-005-adr-007-debate-log.md` and `CRIT-005-ADR-007-debate-log.md` as the same file.

## Root Cause

- [fact] macOS APFS is case-insensitive by default #filesystem
- [problem] move_note rejects case-only renames because source and destination resolve to same path #brain-mcp
- [problem] Using delete_note to clean up old database entries after manual mv deletes the actual file since FS treats both cases as same path #data-loss
- [solution] For case-only renames: use filesystem mv via temp file, then let database sync catch up. Never use delete_note for cleanup. #workaround

## Impact

- [outcome] Two critique files (CRIT-005, CRIT-009) were deleted and had to be recreated from conversation context #data-loss
- [risk] Any agent performing case-only renames on macOS will hit this #recurring

## Recommended Fix

- [solution] Brain MCP move_note should handle case-only renames via two-step mv (source -> temp -> destination) #enhancement
- [solution] Brain MCP delete_note should compare real filesystem paths before deletion to prevent case-insensitive collisions #enhancement

## Relations

- relates_to [[ADR-007 Worktree-Aware Project Resolution]]
- caused_by [[CRIT-005-ADR-007-debate-log]] (data loss during rename)