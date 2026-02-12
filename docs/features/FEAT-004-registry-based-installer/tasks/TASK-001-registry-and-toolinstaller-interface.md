---
title: TASK-001 Registry and ToolInstaller Interface
type: task
status: pending
feature-ref: FEAT-004
effort: S
permalink: features/feat-004-registry-based-installer/tasks/task-001-registry-and-toolinstaller-interface
---

# TASK-001 Registry and ToolInstaller Interface

## Description

Create the `ToolInstaller` interface, optional lifecycle interfaces (`Provisioner`, `Validator`, `Cleaner`), and the global registry with `Register()`, `Get()`, and `All()` functions at `internal/installer/registry.go`. The registry uses a package-level map and follows the `database/sql` register-on-init pattern. Duplicate slug registration panics to prevent silent conflicts.

## Definition of Done

- [ ] [requirement] File `internal/installer/registry.go` created #acceptance
- [ ] [requirement] `ToolInstaller` interface with all 8 methods defined #acceptance
- [ ] [requirement] `Provisioner`, `Validator`, `Cleaner` optional interfaces defined #acceptance
- [ ] [requirement] `Register()` stores installer by Name() slug #acceptance
- [ ] [requirement] `Register()` panics on duplicate slug #acceptance
- [ ] [requirement] `Get()` returns installer and ok bool #acceptance
- [ ] [requirement] `All()` returns sorted slice of all registered installers #acceptance
- [ ] [requirement] Unit tests for register, get, all, duplicate panic #acceptance

## Observations

- [fact] Status: PENDING #status
- [fact] Effort: S #effort
- [task] Foundation task; all targets depend on this interface existing #sequencing
- [technique] Package-level map with no mutex; registration happens during init() before any concurrent access #concurrency
- [constraint] Must match the interface defined in ADR-008 exactly #contract
- [fact] File location: `apps/tui/internal/installer/registry.go` #location

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | S |
| Human Effort | 2 hours |
| AI-Dominant Effort | 0.5 hours |
| AI Tier | Tier 1 (AI-Dominant) |
| AI Multiplier | 4x |
| AI Effort | 0.5 hours |
| Rationale | Interface and registry are well-defined in ADR-008; AI generates boilerplate with high confidence |

## Relations

- part_of [[FEAT-004 Registry-Based Installer]]
- implements [[REQ-001 ToolInstaller Interface and Registry]]
- implements [[DESIGN-001 Registry and Pipeline Architecture]]
- enables [[TASK-006 Claude Code Target]]
- enables [[TASK-007 Cursor Target]]
- enables [[TASK-009 Install Command Rewrite]]
