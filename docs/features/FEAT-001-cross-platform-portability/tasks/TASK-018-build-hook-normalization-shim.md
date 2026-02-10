---
title: TASK-018-build-hook-normalization-shim
type: task
status: complete
feature-ref: FEAT-001
effort-estimate-human: 6h
effort-estimate-ai: 3h
milestone: phase-3
tags:
- task
- phase-3
- hooks
- normalization
permalink: features/feat-001-cross-platform-portability/tasks/task-018-build-hook-normalization-shim-1
---

# TASK-018 Build Hook Normalization Shim

## Description

- [fact] Create `hooks/scripts/normalize.ts` that detects platform from stdin JSON event shape #normalization
- [fact] Implement NormalizedHookEvent interface (platform, event, sessionId, workspaceRoot, payload) #interface
- [fact] Platform detection: Cursor events have hook_event_name field; Claude Code events do not #detection
- [fact] Handle different blocking semantics (CC Stop blocks, Cursor stop is info-only) #blocking
- [fact] Unit tests for normalization across both platforms #testing

## Definition of Done

- [x] [requirement] normalize.ts correctly detects Claude Code vs Cursor from stdin JSON #detection
- [x] [requirement] NormalizedHookEvent produced for all mapped event types #normalization
- [x] [requirement] Platform-specific blocking semantics documented and handled #blocking
- [x] [requirement] Unit tests cover both platforms and all event types #testing

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 2 (AI-Assisted) |
| Human Estimate | 6h |
| AI-Assisted Estimate | 3h |
| Rationale | JSON schema analysis for platform detection; normalization logic is well-defined by ADR-002 hook mapping table |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-008-port-brain-hooks-to-js-ts]]
- blocked_by [[TASK-017-cursor-integration-testing]]
- enables [[TASK-019-refactor-hook-scripts-for-normalization]]
- satisfies [[REQ-003-hook-normalization]]
- traces_to [[DESIGN-002-hook-normalization-layer]]
