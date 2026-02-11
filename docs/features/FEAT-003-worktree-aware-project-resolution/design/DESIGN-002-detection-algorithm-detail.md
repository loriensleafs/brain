---
title: DESIGN-002 Detection Algorithm Detail
type: design
status: complete
feature-ref: FEAT-003
permalink: features/feat-003-worktree-aware-project-resolution/design/design-002-detection-algorithm-detail
---

# DESIGN-002 Detection Algorithm Detail

## Summary

Detailed specification of the `detectWorktreeMainPath` function and its integration into the CWD matching pipeline. Covers the algorithm steps, edge cases, error handling, performance characteristics, and cross-language implementation notes.

## Technical Approach

### Algorithm Overview

The detection algorithm uses a 7-step pipeline with early exits at each stage. The fast pre-check avoids spawning a git subprocess for non-git directories. When a linked worktree is detected, the algorithm derives the main worktree path from the git common directory.

### detectWorktreeMainPath Steps

```text
INPUT: cwd (absolute path to current working directory)
OUTPUT: { mainWorktreePath: string, isLinkedWorktree: boolean } | null

STEP 1: Fast Pre-Check
  Walk up from cwd looking for .git file or directory
  IF not found: return null  // Not a git repo
  NOTE: .git as a FILE indicates a possible linked worktree
        .git as a DIRECTORY indicates main worktree or standalone repo

STEP 2: Spawn Git Subprocess
  COMMAND: git rev-parse --path-format=absolute --git-common-dir --git-dir --is-bare-repository
  CWD: set to the input cwd
  TIMEOUT: 3000ms
  ON ERROR: return null  // Git not installed, too old, or failed
  ON TIMEOUT: log WARN, return null

STEP 3: Parse Output
  Split stdout by newline, expect exactly 3 lines:
    commonDir = line[0]  // Shared .git directory (same for all worktrees)
    gitDir    = line[1]  // Per-worktree .git directory
    isBare    = line[2]  // "true" or "false"

STEP 4: Validate
  IF isBare == "true": return null  // Bare repos not supported
  IF lines.length != 3: return null  // Unexpected output format

STEP 5: Compare Paths
  Normalize both commonDir and gitDir (resolve symlinks, trailing slashes)
  IF commonDir == gitDir: return null  // Main worktree, not linked

STEP 6: Derive Main Path
  mainWorktreePath = dirname(commonDir)
  // commonDir is /path/to/main-repo/.git
  // dirname gives /path/to/main-repo

STEP 7: Return Result
  return { mainWorktreePath, isLinkedWorktree: true }
```

### Integration into matchCwdToProject

The worktree fallback activates only when the direct CWD match fails. It checks opt-out settings, runs detection, validates the resolved path, and then reattempts project matching against the main worktree path.

```text
EXISTING matchCwdToProject(cwd, projects):
  FOR each project in projects:
    IF normalize(cwd).startsWith(normalize(project.code_path) + sep):
      return project.name  // Direct match

  // ---- NEW: Worktree Fallback ----
  IF worktreeDetectionDisabled(env, config):
    return null

  result = detectWorktreeMainPath(cwd)
  IF result == null:
    return null

  effectiveCwd = result.mainWorktreePath
  IF !pathValidator.validate(effectiveCwd):
    log WARN "effectiveCwd failed validation"
    return null

  FOR each project in projects:
    IF normalize(effectiveCwd).startsWith(normalize(project.code_path) + sep):
      return { projectName: project.name, effectiveCwd, isWorktreeResolved: true }

  return null
```

### Edge Case Handling

Eight edge cases are handled through graceful degradation -- each returns null on failure, falling through to the existing "no project found" behavior.

| Edge Case | Behavior |
|-----------|----------|
| Nested worktree paths (deep CWD) | Pre-check walks up to find `.git`, git rev-parse resolves from repo root |
| Main worktree user | Step 5 detects commonDir == gitDir, returns null (direct match handles it) |
| Git not installed | Subprocess ENOENT error caught in Step 2, returns null |
| Git version < 2.31.0 | `--path-format=absolute` unrecognized, error caught in Step 2 |
| Network-mounted repository | 3-second timeout prevents blocking, WARN logged |
| Bare repository | Step 4 checks `is-bare-repository=true`, returns null |
| Broken worktree (moved/deleted main) | Subprocess failure or invalid paths caught in Steps 2/3 |
| Symlinked paths | Path normalization in Step 5 resolves symlinks before comparison |

## Interfaces and APIs

### WorktreeDetectionResult

```typescript
interface WorktreeDetectionResult {
  mainWorktreePath: string;
  isLinkedWorktree: boolean;
}

function detectWorktreeMainPath(cwd: string): WorktreeDetectionResult | null;
```

- [decision] Function returns null (not an error) for all non-worktree and failure cases, keeping the caller's logic clean #api
- [requirement] All three implementations (TypeScript, Go, Bun) must return structurally identical results #parity

### Performance Characteristics

| Scenario | Overhead |
|----------|----------|
| Direct CWD match succeeds | Zero (worktree code never runs) |
| Not a git repo | One stat() call for .git check |
| Main worktree | One git subprocess (~5-50ms) |
| Linked worktree | One git subprocess (~5-50ms) + path validation |
| Git not installed | One failed exec attempt (~1ms) |
| Opt-out enabled | One env/config check (microseconds) |

- [technique] Fast pre-check (stat .git) avoids subprocess for non-git directories #performance
- [technique] Subprocess timeout at 3000ms prevents blocking on slow filesystems #performance

## Trade-offs

- [decision] 7-step pipeline with early exits chosen over a simpler 3-step approach to handle all edge cases without special-casing in the caller #trade-off #robustness
- [decision] 3-second subprocess timeout balances interactive responsiveness against network filesystem latency #trade-off #ux
- [decision] Null return for all failure modes (rather than error types) simplifies caller logic at the cost of losing failure reason detail #trade-off #api
- [decision] Symlink resolution in path comparison adds a syscall but prevents false negatives from symlinked repo paths #trade-off #correctness

## Observations

- [design] Algorithm uses 7 steps with early exits at each stage for efficiency #algorithm
- [technique] Fast pre-check (stat .git) avoids subprocess for non-git directories #performance
- [insight] Path comparison (Step 5) is the key differentiator between main and linked worktrees #detection
- [fact] Eight edge cases identified and handled through graceful degradation #robustness
- [constraint] 3-second timeout is the maximum acceptable latency for interactive tool startup #ux

## Relations

- implements [[FEAT-003 Worktree-Aware Project Resolution]]
- satisfies [[REQ-001 Worktree Detection via Git Common Dir]]
- extends [[DESIGN-001 Implementation Plan]]
- informed_by [[ANALYSIS-020 Git Worktree Internals Research]]
- informed_by [[ANALYSIS-021 Community Worktree Practices Research]]
