---
title: ADR-007 Worktree-Aware Project Resolution
type: decision
permalink: decisions/adr-007-worktree-aware-project-resolution
tags:
- adr
- worktree
- project-resolution
- accepted
---

# ADR-007 Worktree-Aware Project Resolution

## Status: ACCEPTED

## Context

Brain project resolution uses CWD matching against configured code_paths. When a user works in a git worktree (a separate checkout of the same repo at a different filesystem path), CWD matching fails because the worktree path differs from the configured code_path.

## Decision

Enhance CWD matching (level 5 in the resolution hierarchy) with git worktree detection as a fallback. When direct path matching fails, detect if CWD is inside a git worktree and map back to the main repo path for project identification.

The effectiveCwd from worktree detection is applied at the **MCP server layer** as a runtime override for that session's basic-memory API calls. Static basic-memory config stays unchanged (still points to main repo docs/). The translation layer is NOT modified. For CODE mode sessions in worktrees, the MCP server uses `effectiveCwd + "/docs"` when calling basic-memory APIs.

A two-level opt-out mechanism provides escape hatches:
- Per-project config: `disableWorktreeDetection: boolean` (default: false) in ProjectConfig schema
- Global env var: `BRAIN_DISABLE_WORKTREE_DETECTION=1` always disables, overrides config
- Priority: env var (if set, always wins) > per-project config > default (enabled)

## Consequences

### Internal API Changes

- `matchCwdToProject` internal return type changes from `string | null` to `CwdMatchResult` across all 3 implementations (TypeScript, Go, Bun hooks)
- `resolveProject` public API continues returning `string | null` for backward compatibility
- New `resolveProjectWithContext` function exposes full worktree context for callers that need it

### Zero External Breaking Changes

Every existing public API behavior is preserved. New behavior only activates when CWD is inside a worktree that was previously unmatched. The internal return type change is NOT exposed through public APIs.

### Config Schema Addition

A single boolean field `disableWorktreeDetection` is added to the ProjectConfig schema in `packages/validation/schemas/config/brain-config.schema.json`. This is backward compatible (defaults to false, missing field = enabled).

### Implementation Requirements (from P1 review)

- Fast pre-check: verify `.git` file/directory existence before spawning git subprocess
- Security: validate effectiveCwd through `path-validator.ts` before use
- Observability: log at DEBUG level when worktree detection activates, succeeds, or fails; include elapsed time for performance monitoring

## Observations

- [decision] Worktree detection is a fallback within CWD matching, not a new resolution level or memories_mode #architecture
- [decision] CODE mode uses worktree-local docs/ via MCP-level runtime override; DEFAULT and CUSTOM modes are unchanged #memories
- [decision] MCP server overrides memories path at request time using effectiveCwd; static basic-memory config stays unchanged #runtime-override
- [decision] Translation layer (resolveMemoriesPath) is NOT modified; override happens at MCP server layer after resolution #simplicity
- [decision] Two-level opt-out: per-project disableWorktreeDetection boolean + global BRAIN_DISABLE_WORKTREE_DETECTION env var #escape-hatch
- [decision] Config schema gets ONE addition: disableWorktreeDetection boolean in ProjectConfig (backward compatible, default false) #config
- [decision] Single git rev-parse invocation fetches common-dir, git-dir, and bare status; 3-second timeout #performance
- [decision] Graceful degradation: if git unavailable or too old, behavior is identical to today #compatibility
- [decision] Internal return type change (string|null to CwdMatchResult) is NOT exposed through public resolveProject API #backward-compatible
- [fact] Three implementations must be updated in sync: TypeScript, Go, Bun hooks #implementation

## Relations

- implements [[DESIGN-001 Git Worktree Project Resolution]]
- relates_to [[ANALYSIS-019 Project Resolution Codebase Research]]
- relates_to [[ANALYSIS-020 Git Worktree Internals Research]]
- relates_to [[ANALYSIS-021 Community Worktree Practices Research]]
- reviewed_by [[CRIT-005 ADR-007 Debate Log]]