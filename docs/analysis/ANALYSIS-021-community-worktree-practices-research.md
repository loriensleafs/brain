---
title: ANALYSIS-021 Community Worktree Practices Research
type: note
permalink: analysis/analysis-021-community-worktree-practices-research
tags:
- analysis
- worktree
- community
- detection
- patterns
---

# ANALYSIS-021 Community Worktree Practices Research

## Observations

- [fact] VS Code has built-in worktree support via git.detectWorktrees setting; auto-detects worktree folders and shows them in Source Control view; background agents in VS Code 1.107+ use dedicated worktrees per session for isolation #vscode #detection
- [fact] VS Code extensions (git-worktrees, git-worktree-manager) wrap git worktree commands with interactive UIs; each worktree appears as a separate repository in Source Control Repositories view #vscode #extensions
- [fact] CodeRabbit git-worktree-runner uses adapter pattern for editor/AI tool integration; stores config in git config layers (local/.gtrconfig/global); resolves worktrees by branch name, not path #coderabbit #pattern
- [fact] ccswarm (Claude Code multi-agent) uses git worktrees as fundamental isolation mechanism; each agent gets its own worktree; manages lifecycle (create/list/remove/prune) automatically #ccswarm #pattern
- [fact] ccpm (Claude Code Project Management) maps epics to worktrees; treats worktrees as temporary execution environments that converge back via clean merge; maintains project identity through shared .claude/context/ directory #ccpm #pattern
- [fact] incident.io pattern: standardized ~/projects/worktrees/ directory structure; auto-discovers existing worktrees; branch naming with user prefix for accountability #incidentio #pattern
- [fact] Obsidian-git plugin FAILS with worktrees because simple-git library expects .git directory not .git file (worktrees use .git file pointing to bare repo); workaround requires explicit --git-dir and --work-tree flags #obsidian #failure
- [fact] JetBrains IntelliJ recognizes worktrees as valid git repos natively but has no built-in management; relies on third-party plugins for create/remove operations #jetbrains #detection
- [fact] Zed editor added git worktree creation action and picker; has ZED_WORKTREE_ROOT variable for tasks; still working on full multi-root support #zed #detection
- [fact] basic-memory has NO git awareness or worktree detection; project resolution uses explicit registration (project add) with path matching; no CWD-to-git-repo resolution #basic-memory #gap
- [fact] Common detection pattern across tools: git rev-parse --git-common-dir returns shared git data dir; git rev-parse --git-dir returns per-worktree dir; difference indicates a linked worktree #detection #git
- [insight] Three distinct community approaches to worktree project identity: (1) git-common-dir matching (shared repo identity), (2) explicit registration with path arrays, (3) convention-based directory naming #patterns #design
- [insight] Tools that FAIL with worktrees almost always fail because they check for .git directory instead of using git rev-parse; the fix is always to use git plumbing commands #antipattern #detection
- [insight] AI agent tooling (VS Code background agents, Cursor, ccswarm, ccpm) is the PRIMARY driver of worktree adoption in 2025-2026; knowledge management tools lag behind #trend #ai
- [decision] A new GIT memories_mode is NOT needed; enhancing CODE mode or adding worktree-aware CWD matching in the existing resolution hierarchy is more consistent with community patterns #design #recommendation

## Analysis: New GIT Mode vs Enhancing Existing Resolution

### Arguments FOR a new GIT memories_mode

- Clean semantic separation of "git-aware" behavior
- Could include git remote URL matching for distributed setups
- Would not change behavior of existing CODE mode users

### Arguments AGAINST (recommended approach)

- Community tools treat worktrees as transparent - same project, different checkout
- Adding a mode creates configuration burden for a common scenario
- git-common-dir matching can be added to CWD resolution (level 5) without new mode
- Multiple tools (VS Code, IntelliJ, Zed) handle worktrees without requiring user config changes
- The problem is CWD matching fails, not that the mode system is wrong

### Recommended Approach

Enhance CWD matching (level 5 in resolution hierarchy) to detect worktrees:

1. When CWD does not match any code_path, check if CWD is in a git worktree
2. If yes, resolve git-common-dir to find the main worktree path
3. Match that main path against configured code_paths
4. This is invisible to users - worktrees "just work" without config changes

## Relations

- relates_to [[ANALYSIS-001 Project Resolution Codebase Research]]
- relates_to [[FEAT-002 Git Worktree Support]]
- relates_to [[ADR-020 Configuration Architecture]]