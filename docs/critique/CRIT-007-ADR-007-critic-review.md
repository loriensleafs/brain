---
title: CRIT-007 ADR-007 Critic Review
type: note
permalink: critique/crit-007-adr-007-critic-review-1-1
tags:
- critique
- adr-007
- worktree
- review
---

# CRIT-007 ADR-007 Critic Review

## Review Summary

**Verdict: ACCEPT WITH CONDITIONS (Disagree and Commit on P1 items)**

ADR-007 is architecturally sound. The "worktree detection as CWD fallback" approach is the right call -- it avoids config schema bloat and matches community patterns. However, the design has gaps that will cause implementation friction and could produce silent incorrect behavior if not addressed.

## P0 Issues (Must Fix Before Implementation)

### P0-1: Translation Layer Has No Path to Receive effectiveCwd

The design says `resolveMemoriesPath` in `translation-layer.ts` should accept an optional `effectiveCwd` parameter. But `resolveMemoriesPath` is called from `translateBrainToBasicMemory` (line 283-316 of translation-layer.ts), which iterates over projects from the Brain config object. This function has no concept of CWD, no concept of "which project is currently being resolved for a request", and no mechanism to pass effectiveCwd.

The translation layer runs at config sync time (when Brain config changes), not at request time. It pre-resolves all memories paths for all projects and writes them to basic-memory config. There is no request context available.

**The design conflates two different operations**: (1) static config translation (happens once per config change) and (2) runtime resolution (happens per MCP tool call). effectiveCwd only exists at runtime. The translation layer is a static operation.

**Fix required**: The effectiveCwd override must happen at the MCP server level, AFTER the translation layer has done its static work. When the MCP server resolves a tool call, it should check if the resolution was via worktree, and if so, override the memories_path at that point -- not in the translation layer.

### P0-2: basic-memory Config Cannot Represent Per-Request Path Overrides

basic-memory's config.json maps project names to single static paths: `{ "brain": "/path/to/memories" }`. When a worktree is detected at runtime, the CODE mode memories path should be `{worktree_root}/docs` instead of `{code_path}/docs`. But basic-memory reads its config once and serves from those paths.

The design does not address how basic-memory will be told to use a different path for one specific request. This is a fundamental architectural gap.

**Options**:
1. Override at the Brain MCP layer before forwarding to basic-memory (intercept and rewrite)
2. Add dynamic path override support to basic-memory's API
3. Accept that DEFAULT and CUSTOM modes share memories across worktrees, and CODE mode simply cannot work correctly with the current basic-memory architecture

The design needs to explicitly specify which approach is taken.

## P1 Issues (Should Fix Before Implementation)

### P1-1: Bun Hooks Hierarchy Divergence

The Bun hooks implementation (`project-resolve.ts`) has a different resolution hierarchy than TypeScript and Go. It includes `BM_ACTIVE_PROJECT` (legacy, line 83) that the other two implementations do not have. It also lacks level 2 (Brain CLI active project via `brain config get active-project`).

Adding worktree detection to all three implementations without first aligning the hierarchy creates a maintenance hazard. When a bug is found in one, the fix path differs across implementations.

**Fix**: Either align the hierarchies first, or at minimum document the intentional divergence and ensure the worktree fallback is inserted at the same semantic position in all three.

### P1-2: No Symlink Resolution Before git rev-parse

The design mentions "path.normalize + fs.realpathSync resolve symlinks before matching" as an edge case handler. But the actual source code (`project-resolver.ts`, line 109) uses `normalize(cwd)` only -- `realpathSync` is NOT called. The Go implementation uses `filepath.Clean` (line 199), which also does not resolve symlinks.

If CWD is a symlink to a worktree directory (common in macOS with /private/tmp, or user-created symlinks), `git rev-parse` will operate on the real path, but the path comparison against `code_path` will use the symlinked path. This causes a mismatch.

**Fix**: Either resolve symlinks on both CWD and code_path before comparison, or document that symlinked CWD is not supported and will fall through to "no match".

### P1-3: 3-Second Timeout Is Too Long for Interactive UX

The design specifies a 3-second timeout for `git rev-parse`. Project resolution happens on every MCP tool call. In the common case where a user is NOT in a worktree and NOT in a git repo, the git command will fail quickly (well under 100ms). But on network-mounted filesystems (NFS, SSHFS) or when git is configured with a network-dependent credential helper, the command may take close to 3 seconds before timing out.

3 seconds of added latency on every tool call is unacceptable for interactive use. The design says "only invoked on CWD mismatch", which is true, but that is exactly the worktree case AND the "not a configured project" case. Users working in unconfigured directories will pay this penalty on every call.

**Fix**: Reduce timeout to 500ms. git rev-parse on local repos typically completes in <10ms. 500ms handles slow disks with margin. If a git command takes >500ms, the repo is too slow for interactive tooling anyway.

### P1-4: Race Condition on Worktree docs/ Directory

The design says "directory creation happens at write time" for worktree docs/ that doesn't exist yet. But basic-memory may attempt to read/list from the directory before any writes happen. If the user runs `mcp__plugin_brain_brain__search` as their first operation in a worktree, will basic-memory return an error because the docs/ directory does not exist?

**Fix**: Document the expected behavior. Confirm that basic-memory handles missing project directories gracefully (returns empty results rather than errors).

## P2 Issues (Track for Follow-up)

### P2-1: No Observability for Worktree Resolution

When worktree detection activates, there is no logging or user-visible signal. If resolution produces a wrong result (e.g., matches the wrong project because two projects share a git common-dir), the user has no way to diagnose it.

**Recommendation**: Add structured logging at info level when worktree fallback activates: `"Worktree detected: CWD={cwd}, mainPath={mainPath}, resolvedProject={name}"`.

### P2-2: Detached HEAD Worktrees and Bare Repo Worktrees Not Tested

The design claims "Detached HEAD: Worktree detection works (HEAD state irrelevant to --git-common-dir)" and "Bare repository: returns null". These are stated as facts but no integration tests are specified for these scenarios. `--is-bare-repository` behavior in linked worktrees of bare repos (e.g., `git worktree add` from a bare clone) is different from standalone bare repos.

**Recommendation**: Add explicit integration test cases for: (1) worktree created from bare repo, (2) worktree in detached HEAD state, (3) worktree with orphan branch.

### P2-3: Multiple Projects From Same Repo Edge Case

The design says "Main worktree path matches the deepest code_path (existing best-match logic)". But the worktree fallback does an exact match against `normalizedMain === projectPath` (design section 5.2), not a prefix match. If two projects are configured with nested paths within the same repo (e.g., `code_path: /repo` and `code_path: /repo/packages/sub`), and the user works in a worktree, the worktree's mainPath resolves to `/repo`, which will match the parent project but NOT the nested one. The user loses the nested project resolution they had in the main worktree.

**Recommendation**: Use the same prefix-matching + deepest-match logic in the worktree fallback as in direct matching.

### P2-4: No Migration or Version Gating

The design introduces a new return type (`CwdMatchResult`) and modifies internal function signatures across three implementations. There is no version gate or feature flag. If the change introduces a regression, there is no way to disable worktree detection without reverting the code.

**Recommendation**: Consider a `BRAIN_DISABLE_WORKTREE_DETECTION=1` env var escape hatch for users who encounter issues.

## Strengths

- **No config schema changes**: Users don't need to reconfigure anything. This is the right choice.
- **Single git invocation**: Fetching three values in one subprocess call is efficient.
- **Graceful degradation**: Every failure mode (git not found, git too old, bare repo, timeout) falls through to existing behavior. No new failure modes are introduced.
- **Correct use of git plumbing**: `rev-parse --git-common-dir` is the right tool for this. It is stable, documented, and used by major editors.
- **Backward compatibility table**: The explicit before/after table in the design document is valuable for review.

## Observations

- [decision] ACCEPT WITH CONDITIONS: P0 items must be addressed in the design before implementation begins #review #adr-007
- [risk] Translation layer conflation: static config sync vs runtime resolution are different operations; effectiveCwd only exists at runtime #architecture #gap
- [risk] 3-second timeout is too long for interactive use; 500ms recommended #performance #ux
- [risk] Symlink paths are not resolved in current code despite design claims #accuracy #edge-case
- [insight] The three implementations already have hierarchy divergence (Bun has BM_ACTIVE_PROJECT, lacks Brain CLI level) #maintenance #debt
- [fact] No existing parity tests for project resolution; only naming patterns and session status have parity coverage #testing #gap

## Relations

- relates_to [[ADR-007 Worktree-Aware Project Resolution]]
- relates_to [[DESIGN-001 Git Worktree Project Resolution]]
- relates_to [[ANALYSIS-019 Project Resolution Codebase Research]]