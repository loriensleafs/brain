---
title: TASK-005 Placement Strategy Abstraction
type: task
status: proposed
feature-ref: FEAT-005
effort: M
permalink: features/feat-005-unified-tool-engine/tasks/task-005-placement-strategy-abstraction
---

# TASK-005 Placement Strategy Abstraction

## Description

Implement the `PlacementStrategy` interface in `internal/engine/placement.go` with two concrete implementations: `MarketplacePlacement` (matching existing `claudecode.go` install flow) and `CopyAndMergePlacement` (matching existing `cursor.go` install flow). Each strategy handles file writing, directory creation, and cleanup for its tool type.

## Definition of Done

- [ ] [requirement] `PlacementStrategy` interface defined with `Place` and `Clean` methods #acceptance
- [ ] [requirement] `MarketplacePlacement` writes to marketplace dir and registers in `known_marketplaces.json` #acceptance
- [ ] [requirement] `MarketplacePlacement` generates `plugin.json` and `marketplace.json` #acceptance
- [ ] [requirement] `CopyAndMergePlacement` copies content files to scope directory #acceptance
- [ ] [requirement] `CopyAndMergePlacement` applies RFC 7396 JSON merge for hooks and MCP configs #acceptance
- [ ] [requirement] Both strategies handle missing target directories (create as needed) #acceptance
- [ ] [requirement] Clean removes only Brain-managed files per strategy #acceptance
- [ ] [requirement] Scope path resolution expands `~` to home directory #acceptance
- [ ] [requirement] Unit tests for both strategies with mock filesystem #acceptance
- [ ] [requirement] Behavior matches existing per-tool installer target code #acceptance

## Observations

- [fact] Status: PROPOSED #status
- [fact] Effort: M #effort
- [task] Extracts placement logic from existing per-tool installer targets into strategy interface #refactor
- [constraint] RFC 7396 merge must preserve non-Brain entries in hooks.json and mcp.json #safety
- [fact] Uses existing json-patch library from ADR-008 dependencies #library
- [technique] Strategy pattern separates "what to generate" (engine) from "where to put it" (placement) #design

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | M |
| Human Effort | 4 hours |
| AI-Dominant Effort | 1 hour |
| AI Tier | Tier 2 (AI-Capable) |
| AI Multiplier | 2x |
| AI Effort | 2 hours |
| Rationale | Logic extraction from existing code is well-defined; marketplace registration and RFC 7396 merge are existing patterns to relocate |

## Relations

- part_of [[FEAT-005 Unified Tool Engine]]
- implements [[REQ-003 Placement Strategy Abstraction]]
- implements [[DESIGN-001 Engine Architecture]]
- depends_on [[TASK-001 ToolConfig Schema and YAML Parsing]]
- depends_on [[TASK-003 Relocate Shared Code to Engine Package]]
- enables [[TASK-006 GenericTarget Installer]]
