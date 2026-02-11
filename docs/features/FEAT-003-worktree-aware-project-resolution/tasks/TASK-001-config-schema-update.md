---
title: TASK-001 Config Schema Update
type: task
status: complete
feature-ref: FEAT-003
effort: S
permalink: features/feat-003-worktree-aware-project-resolution/tasks/task-001-config-schema-update
---

# TASK-001 Config Schema Update

## Description

Add `disableWorktreeDetection` boolean field to the Brain config schema and ProjectConfig type definitions. This enables the per-project opt-out mechanism specified in REQ-003. Field is optional with default value `false`, ensuring backward compatibility with existing configs.

## Definition of Done

- [x] [requirement] `disableWorktreeDetection` added to `brain-config.schema.json` under `ProjectConfig` properties #acceptance
- [x] [requirement] Field is optional with default value `false` #acceptance
- [x] [requirement] Field type is `boolean` #acceptance
- [x] [requirement] TypeScript type definitions updated to include the new field #acceptance
- [x] [requirement] Go struct tags updated to include the new field #acceptance
- [x] [requirement] Schema validation passes with and without the field present #acceptance
- [x] [requirement] Existing configs without the field continue to work (backward compatible) #acceptance

## Observations

- [fact] Status: COMPLETE #status
- [fact] Effort: S #effort
- [task] Foundation task with no blockers; must complete before detection code references the config field #sequencing
- [constraint] Field must be backward compatible (optional, default false) #compatibility
- [fact] Config schema is v2.0.0 at ~/.config/brain/config.json #location

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | S |
| Human Effort | 1 hour |
| AI-Dominant Effort | 0.25 hours |
| AI Tier | Tier 1 (AI-Dominant) |
| AI Multiplier | 3x |
| AI Effort | 0.33 hours |
| Rationale | Schema and type definition updates are straightforward; AI can generate field additions, struct tags, and validation rules with high confidence |

## Relations

- part_of [[FEAT-003 Worktree-Aware Project Resolution]]
- implements [[REQ-003 Two-Level Opt-Out Mechanism]]
- enables [[TASK-002 Implement detectWorktreeMainPath TypeScript]]
- enables [[TASK-003 Implement detectWorktreeMainPath Go]]
- enables [[TASK-004 Implement detectWorktreeMainPath Bun Hooks]]
