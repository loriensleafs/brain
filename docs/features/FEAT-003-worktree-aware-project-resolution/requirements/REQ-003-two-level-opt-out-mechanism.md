---
title: REQ-003 Two-Level Opt-Out Mechanism
type: requirement
status: complete
feature-ref: FEAT-003
permalink: features/feat-003-worktree-aware-project-resolution/requirements/req-003-two-level-opt-out-mechanism
---

# REQ-003 Two-Level Opt-Out Mechanism

## Requirement Statement

The system MUST provide a two-level opt-out mechanism for worktree detection to ensure users have escape hatches if the feature causes problems:

### Level 1: Per-Project Config

- Field: `disableWorktreeDetection: boolean` in `ProjectConfig` schema
- Default: `false` (worktree detection enabled)
- Location: `~/.config/brain/config.json` under `projects.<name>`
- Behavior: When `true`, worktree detection is skipped for that specific project

### Level 2: Global Environment Variable

- Variable: `BRAIN_DISABLE_WORKTREE_DETECTION=1`
- Behavior: When set to `"1"`, worktree detection is disabled for ALL projects
- Overrides per-project config (env var always wins when set)

### Priority Resolution

```text
1. Check env var BRAIN_DISABLE_WORKTREE_DETECTION
   - If "1": DISABLED (return immediately, skip all detection)
2. Check per-project config disableWorktreeDetection
   - If true: DISABLED for this project
3. Default: ENABLED
```

## Acceptance Criteria

- [x] [requirement] Per-project disableWorktreeDetection: true prevents worktree detection for that project #acceptance
- [x] [requirement] BRAIN_DISABLE_WORKTREE_DETECTION=1 env var disables detection globally #acceptance
- [x] [requirement] Env var takes priority over per-project config when set #acceptance
- [x] [requirement] Missing disableWorktreeDetection field defaults to false (enabled) #acceptance
- [x] [requirement] Missing or empty env var does not disable detection #acceptance
- [x] [requirement] Opt-out is checked BEFORE spawning any git subprocess (zero cost when disabled) #acceptance
- [x] [requirement] Config schema validates disableWorktreeDetection as optional boolean #acceptance

## Observations

- [requirement] Two levels provide granular control without over-engineering #design
- [decision] Env var always wins when set, providing a quick global kill switch #priority
- [insight] Opt-out checked before subprocess spawn means zero performance cost when disabled #optimization
- [constraint] Config field must be backward compatible (optional, defaults to false) #compatibility
- [fact] P0-3 from the debate log identified missing opt-out as a blocking issue #provenance

## Relations

- part_of [[FEAT-003 Worktree-Aware Project Resolution]]
- implements [[ADR-007 Worktree-Aware Project Resolution]]
- relates_to [[CRIT-005 ADR-007 Debate Log]]
- relates_to [[TASK-001 Config Schema Update]]
