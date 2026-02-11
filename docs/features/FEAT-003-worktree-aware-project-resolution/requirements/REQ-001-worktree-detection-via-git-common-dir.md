---
title: REQ-001 Worktree Detection via git-common-dir
type: requirement
status: complete
feature-ref: FEAT-003
permalink: features/feat-003-worktree-aware-project-resolution/requirements/req-001-worktree-detection-via-git-common-dir
---

# REQ-001 Worktree Detection via git-common-dir

## Requirement Statement

The system MUST implement a `detectWorktreeMainPath` function that detects whether the current working directory is inside a git worktree and returns the main worktree path. Detection MUST use `git rev-parse --path-format=absolute --git-common-dir --git-dir --is-bare-repository` as a single subprocess invocation with a 3-second timeout.

### Detection Algorithm

```text
1. Fast pre-check: verify .git file or directory exists at CWD (or ancestor)
   - If no .git found: return null (not a git repo)
2. Run: git rev-parse --path-format=absolute --git-common-dir --git-dir --is-bare-repository
   - Timeout: 3 seconds
   - If command fails or times out: return null (graceful degradation)
3. Parse output (3 lines):
   - Line 1: commonDir (absolute path to shared .git)
   - Line 2: gitDir (absolute path to per-worktree .git)
   - Line 3: isBare ("true" or "false")
4. If isBare == "true": return null (bare repos not supported)
5. If commonDir == gitDir: return null (main worktree, not a linked worktree)
6. Return dirname(commonDir) as the main worktree path
```

### Return Type

```typescript
interface WorktreeDetectionResult {
  mainWorktreePath: string;  // Absolute path to main worktree root
  isLinkedWorktree: boolean; // true if CWD is in a linked (non-main) worktree
}
// Returns null when not in a linked worktree
```

## Acceptance Criteria

- [x] [requirement] Returns main worktree path when CWD is inside a linked worktree #acceptance
- [x] [requirement] Returns null when CWD is in the main worktree (not a linked worktree) #acceptance
- [x] [requirement] Returns null when CWD is not inside any git repository #acceptance
- [x] [requirement] Returns null when git is not installed or version < 2.31.0 #acceptance
- [x] [requirement] Returns null when git subprocess times out (3-second limit) #acceptance
- [x] [requirement] Returns null for bare repositories #acceptance
- [x] [requirement] Fast pre-check avoids subprocess spawn when .git does not exist #acceptance
- [x] [requirement] Works with nested worktree paths (CWD is a subdirectory of a worktree) #acceptance
- [x] [requirement] Uses --path-format=absolute to avoid relative path ambiguity (requires git >= 2.31.0) #acceptance

## Observations

- [requirement] Single subprocess invocation combines 3 queries for efficiency #performance
- [technique] dirname(commonDir) strips the .git suffix to get the main worktree root #algorithm
- [constraint] 3-second timeout prevents hanging on network-mounted repos or broken git state #reliability
- [fact] --path-format=absolute requires git >= 2.31.0 (March 2021) #compatibility
- [insight] Fast .git pre-check avoids subprocess overhead for non-git directories #optimization
- [fact] Depends on git >= 2.31.0 and ADR-007 acceptance (ACCEPTED) #dependency

## Relations

- part_of [[FEAT-003 Worktree-Aware Project Resolution]]
- implements [[ADR-007 Worktree-Aware Project Resolution]]
- relates_to [[ANALYSIS-020 Git Worktree Internals Research]]
- relates_to [[TASK-007 Cross-Language Parity Tests]]
- relates_to [[TASK-008 Integration Tests With Real Worktree]]
