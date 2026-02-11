---
title: ANALYSIS-020 Git Worktree Internals Research
type: note
permalink: analysis/analysis-020-git-worktree-internals-research
tags:
- worktree
- git
- detection
- research
---

# ANALYSIS-020 Git Worktree Internals Research

## Observations

- [fact] In a secondary worktree, `.git` is a FILE (not directory) containing `gitdir: /path/to/main/.git/worktrees/<name>` #worktree #detection
- [fact] `git rev-parse --git-common-dir` returns the SAME `.git` directory for ALL worktrees of a repo - this is the most reliable shared identity signal #worktree #identity
- [fact] `git rev-parse --git-dir` returns different paths: `.git` for main, `/main/.git/worktrees/<name>` for secondary #worktree #detection
- [technique] Detection algorithm: compare absolute `--git-common-dir` with absolute `--git-dir` - if equal, main worktree; if different, secondary worktree #detection #algorithm
- [technique] To find main worktree path from any worktree: `dirname(git rev-parse --path-format=absolute --git-common-dir)` strips `.git` to get main worktree root #resolution #path
- [fact] `git worktree list --porcelain` returns machine-parseable output; first entry is ALWAYS the main worktree #parsing
- [fact] `git remote get-url origin` returns the SAME URL from any worktree - confirms repo identity across worktrees #identity #remote
- [fact] `--path-format=absolute` flag requires git >= 2.31.0 (March 2021) - safe to require for modern tooling #compatibility
- [fact] Bare repos return `is-bare-repository=true` and `show-toplevel` fails with fatal error - must handle as edge case #bare-repo
- [fact] Worktree metadata stored in `main/.git/worktrees/<name>/` with files: commondir, gitdir, HEAD, index, refs #internals
- [insight] The `commondir` file in worktree metadata contains relative path `../..` back to the main `.git` directory #internals

## Relations

- relates_to [[ANALYSIS-001 Project Resolution Codebase Research]]
- implements [[FEAT-002 Feature Workflow]]