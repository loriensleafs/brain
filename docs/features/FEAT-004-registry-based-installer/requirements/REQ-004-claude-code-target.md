---
title: REQ-004 Claude Code Target
type: requirement
status: pending
feature-ref: FEAT-004
permalink: features/feat-004-registry-based-installer/requirements/req-004-claude-code-target
---

# REQ-004 Claude Code Target

## Requirement Statement

The system MUST implement a Claude Code target as a self-contained `ToolInstaller` implementation that handles all Claude Code-specific install, uninstall, and detection logic. The target self-registers via `init()` and encapsulates the install pipeline for Claude Code: cleaning previous installs, running adapter transforms, registering the marketplace in `known_marketplaces.json`, and writing the install manifest.

### Install Pipeline Steps

```text
1. Clean previous install
   - Action: remove existing Brain files from ~/.claude/
   - Undo: restore from backup
   - Condition: Brain files exist in target

2. Run adapter transforms to marketplace directory
   - Action: execute adapter transforms from TemplateSource to output dir
   - Undo: remove output directory
   - Condition: output dir does not exist or is stale

3. Register marketplace in known_marketplaces.json
   - Action: add Brain marketplace entry using sjson
   - Undo: remove entry using sjson
   - Condition: entry not already present (gjson check)

4. Write install manifest
   - Action: write manifest file recording installed components
   - Undo: remove manifest file
   - Condition: manifest does not exist or version differs
```

### Target Details

| Attribute | Value |
|---|---|
| Name() | `"claude-code"` |
| DisplayName() | `"Claude Code"` |
| ConfigDir() | `~/.claude` (via xdg or direct) |
| AdapterTarget() | `"claude-code"` |
| Implements | `ToolInstaller`, `Provisioner` (marketplace setup) |

## Acceptance Criteria

- [ ] [requirement] ClaudeCode struct implements ToolInstaller interface #acceptance
- [ ] [requirement] ClaudeCode struct implements Provisioner for marketplace registration #acceptance
- [ ] [requirement] Self-registers via init() in targets package #acceptance
- [ ] [requirement] IsToolInstalled() detects Claude Code presence on disk #acceptance
- [ ] [requirement] IsBrainInstalled() detects existing Brain content in Claude Code config #acceptance
- [ ] [requirement] Install() builds and executes a 4-step pipeline #acceptance
- [ ] [requirement] Uninstall() removes Brain content and deregisters marketplace #acceptance
- [ ] [requirement] All pipeline steps have Undo functions for rollback #acceptance
- [ ] [requirement] All pipeline steps have Condition functions for idempotent re-run #acceptance
- [ ] [requirement] Golden-file tests verify install output matches expected structure #acceptance

## Observations

- [requirement] Claude Code target is the most complex due to marketplace registration #complexity
- [technique] Marketplace registration uses sjson for set and gjson for detection #json-ops
- [fact] Claude Code config lives at `~/.claude/` with marketplace in `known_marketplaces.json` #paths
- [constraint] Must preserve existing user config; Brain content is additive, not replacing #safety
- [insight] Provisioner interface separates marketplace setup from file install for clarity #separation

## Relations

- part_of [[FEAT-004 Registry-Based Installer]]
- implements [[ADR-008 Registry-Based Installer Architecture]]
- depends_on [[REQ-001 ToolInstaller Interface and Registry]]
- depends_on [[REQ-002 Step Pipeline with Rollback]]
- depends_on [[REQ-003 Library Adoptions]]
- relates_to [[TASK-006 Claude Code Target]]
