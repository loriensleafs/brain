---
title: REQ-005 Cursor Target
type: requirement
status: pending
feature-ref: FEAT-004
permalink: features/feat-004-registry-based-installer/requirements/req-005-cursor-target
---

# REQ-005 Cursor Target

## Requirement Statement

The system MUST implement a Cursor target as a self-contained `ToolInstaller` implementation. Cursor follows the same dotfile conventions as Claude Code (commands in `.cursor/commands/`, rules in `.cursor/rules/`, MCP config in `.cursor/mcp.json`) but without marketplace registration. The target self-registers via `init()` and builds its own install pipeline.

### Install Pipeline Steps

```text
1. Clean previous install
   - Action: remove existing Brain files from ~/.cursor/
   - Undo: restore from backup
   - Condition: Brain files exist in target

2. Run adapter transforms
   - Action: execute adapter transforms from TemplateSource to Cursor config dir
   - Undo: remove output files
   - Condition: output dir does not exist or is stale

3. Merge MCP config
   - Action: merge Brain MCP settings into .cursor/mcp.json using json-patch
   - Undo: remove Brain keys from mcp.json using sjson
   - Condition: Brain MCP settings not already present

4. Write install manifest
   - Action: write manifest file recording installed components
   - Undo: remove manifest file
   - Condition: manifest does not exist or version differs
```

### Target Details

| Attribute | Value |
|---|---|
| Name() | `"cursor"` |
| DisplayName() | `"Cursor"` |
| ConfigDir() | `~/.cursor` |
| AdapterTarget() | `"cursor"` |
| Implements | `ToolInstaller` (no optional interfaces needed) |

## Acceptance Criteria

- [ ] [requirement] Cursor struct implements ToolInstaller interface #acceptance
- [ ] [requirement] Self-registers via init() in targets package #acceptance
- [ ] [requirement] IsToolInstalled() detects Cursor presence on disk #acceptance
- [ ] [requirement] IsBrainInstalled() detects existing Brain content in Cursor config #acceptance
- [ ] [requirement] Install() builds and executes a 4-step pipeline #acceptance
- [ ] [requirement] Uninstall() removes Brain content from Cursor config #acceptance
- [ ] [requirement] MCP config merge uses RFC 7396 (evanphx/json-patch) at arbitrary depth #acceptance
- [ ] [requirement] All pipeline steps have Undo and Condition functions #acceptance
- [ ] [requirement] Golden-file tests verify install output matches expected structure #acceptance

## Observations

- [requirement] Cursor target is simpler than Claude Code (no marketplace registration) #complexity
- [fact] Cursor follows identical dotfile conventions to Claude Code #convergence
- [technique] MCP config merge is the primary difference from simple file copy #json-ops
- [constraint] Must not modify non-Brain keys in existing .cursor/mcp.json #safety
- [insight] Cursor target validates the extensibility claim: one file, one init(), one import #proof-point

## Relations

- part_of [[FEAT-004 Registry-Based Installer]]
- implements [[ADR-008 Registry-Based Installer Architecture]]
- depends_on [[REQ-001 ToolInstaller Interface and Registry]]
- depends_on [[REQ-002 Step Pipeline with Rollback]]
- depends_on [[REQ-003 Library Adoptions]]
- relates_to [[TASK-007 Cursor Target]]
