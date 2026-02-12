---
title: TASK-005 Library Integration json-patch-xdg
type: task
status: pending
feature-ref: FEAT-004
effort: M
permalink: features/feat-004-registry-based-installer/tasks/task-005-library-integration-json-patch-xdg
---

# TASK-005 Library Integration json-patch-xdg

## Description

Integrate `evanphx/json-patch` for RFC 7396 JSON Merge Patch (replacing the 2-level `jsonMerge` function, ~57 lines) and `adrg/xdg` for XDG Base Directory resolution (replacing 15+ hardcoded `filepath.Join(home, ".config", ...)` constructions). For xdg, override `ConfigHome` to `~/.config` on macOS to match Brain's convention.

## Definition of Done

- [ ] [requirement] `evanphx/json-patch` added to `go.mod` #acceptance
- [ ] [requirement] `adrg/xdg` added to `go.mod` #acceptance
- [ ] [requirement] `jsonMerge` function replaced with `jsonpatch.MergePatch` #acceptance
- [ ] [requirement] All hardcoded XDG path constructions replaced with `xdg.ConfigHome`, `xdg.CacheHome`, `xdg.DataHome` #acceptance
- [ ] [requirement] XDG ConfigHome overridden to `~/.config` on macOS #acceptance
- [ ] [requirement] Old jsonMerge function removed #acceptance
- [ ] [requirement] Tests verify arbitrary-depth JSON merge (3+ levels) #acceptance
- [ ] [requirement] Tests verify nested MCP config merge (the known 2-level bug scenario) #acceptance
- [ ] [requirement] Tests verify XDG path resolution on macOS and Linux #acceptance

## Observations

- [fact] Status: PENDING #status
- [fact] Effort: M #effort
- [task] Two distinct library integrations in one task; related by replacing hardcoded patterns #scope
- [fact] evanphx/json-patch: 1,200 stars, 2,673 importers, BSD-3 license #provenance
- [fact] adrg/xdg: 951 stars, 800+ importers, MIT license #provenance
- [technique] RFC 7396 semantics: objects merge recursively, scalars overwrite, null deletes #standard
- [risk] XDG ConfigHome override must happen early in initialization before any path resolution #initialization-order
- [insight] json-patch fixes a known production bug where nested MCP configs break during merge #correctness

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | M |
| Human Effort | 3 hours |
| AI-Dominant Effort | 0.75 hours |
| AI Tier | Tier 2 (AI-Accelerated) |
| AI Multiplier | 2x |
| AI Effort | 1.5 hours |
| Rationale | Two library integrations; json-patch is straightforward but XDG override requires careful initialization ordering and platform-specific testing |

## Relations

- part_of [[FEAT-004 Registry-Based Installer]]
- implements [[REQ-003 Library Adoptions]]
- enables [[TASK-006 Claude Code Target]]
- enables [[TASK-007 Cursor Target]]
- enables [[TASK-009 Install Command Rewrite]]
