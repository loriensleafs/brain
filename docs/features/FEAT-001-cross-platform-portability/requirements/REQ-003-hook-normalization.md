---
title: REQ-003-hook-normalization
type: requirement
status: draft
feature-ref: FEAT-001
tags:
- requirement
- hooks
- normalization
- phase-3
permalink: features/feat-001-cross-platform-portability/requirements/req-003-hook-normalization-1
---

# REQ-003 Hook Normalization

## Requirement Statement

- [requirement] JS/TS hook scripts SHALL replace both Go binaries (brain-hooks, brain-skills) #replacement
- [requirement] A normalization shim (normalize.ts) SHALL detect platform from event JSON shape and normalize to common format #normalization
- [requirement] Per-tool JSON configs SHALL map tool-specific event names to shared scripts #config
- [requirement] Hook scripts SHALL be executable via Node.js without compilation #portable

## Acceptance Criteria

- [ ] [requirement] AC-01: All 8 brain-hooks subcommands work identically in JS/TS #parity
- [ ] [requirement] AC-02: normalize.ts correctly detects Claude Code vs Cursor from stdin JSON #detection
- [ ] [requirement] AC-03: hooks/claude-code.json maps Claude Code events to scripts #config
- [ ] [requirement] AC-04: hooks/cursor.json maps Cursor events to scripts #config
- [ ] [requirement] AC-05: Hook scripts handle different blocking semantics (CC Stop blocks, Cursor stop is info-only) #blocking

## Observations

- [fact] Claude Code has 4 hook events; Cursor has 7+ hook events; event names differ #divergence
- [fact] Both tools pass JSON to stdin and read JSON from stdout for blocking hooks #compatible
- [fact] Some events exist only in one tool (SessionStart: CC only; beforeReadFile: Cursor only) #asymmetric

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- derives_from [[ADR-002 Cross-Platform Plugin Architecture]]
- depends_on [[REQ-001-canonical-content-extraction]]
