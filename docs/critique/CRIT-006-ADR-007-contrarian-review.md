---
title: CRIT-003 ADR-007 Contrarian Review
type: note
permalink: critique/crit-006-adr-007-contrarian-review-1-1
tags:
- critique
- contrarian
- worktree
- adr-review
---

# CRIT-003 ADR-007 Contrarian Review

## Observations

- [insight] ADR-007 introduces implicit git dependency into a tool that currently has zero git awareness, crossing a fundamental architectural boundary #architecture #risk
- [decision] The "no config changes" design hides complexity rather than removing it; users cannot inspect, override, or disable worktree behavior #transparency
- [insight] Three-implementation synchronization (TypeScript, Go, Bun) for git subprocess logic is a permanent maintenance tax that compounds over time #maintenance
- [problem] Implicit detection creates a "spooky action at a distance" failure mode where git state changes silently alter Brain project resolution #debugging
- [insight] The simpler alternative of allowing code_path to be an array was dismissed without rigorous comparison; it solves 80% of the use case with 20% of the complexity #alternatives
- [risk] Worktree detection adds subprocess spawning to every failed CWD match, impacting resolution latency for ALL non-matching paths, not just worktree users #performance
- [insight] Community analysis shows AI agent tooling is the primary driver; this is a narrow audience that could be served by explicit configuration rather than implicit detection #scope

## P0 Issues (Blocking)

### P0-1: No Opt-Out Mechanism

The ADR provides no way to disable worktree detection. If it causes unexpected behavior (resolving to the wrong project, performance issues with network-mounted repos), users have no escape hatch. Every runtime behavior change should have a corresponding configuration toggle. The ADR's own "graceful degradation" section acknowledges failure modes but offers no user-controlled mitigation.

**Recommendation**: Add a `worktree_detection: boolean` config field (default: true) or a per-project override. This contradicts the "no config changes" design but is necessary for production safety.

### P0-2: Return Type Breaking Change Underestimated

Changing `matchCwdToProject` from `string | null` to `CwdMatchResult` is a structural change to an internal API shared across three implementations and consumed by the translation layer. The ADR claims backward compatibility by wrapping the new type, but this adds a `resolveProjectWithContext` function that callers must opt into. Any caller that uses `matchCwdToProject` directly (tests, future code) must now understand the enriched return type. This is not "zero breaking changes" as claimed.

**Recommendation**: Acknowledge this as an internal API change and document the migration path for existing callers.

## P1 Issues (Significant)

### P1-1: Subprocess Cost on Every CWD Mismatch

The design states git is "only invoked on CWD mismatch." But CWD mismatch is the COMMON case for non-worktree users who open terminals in directories not under any configured project. Every such case now spawns a git subprocess (with 3-second timeout). For users with many projects on network mounts, this adds measurable latency to every Brain operation.

The "single invocation" optimization is good, but the issue is frequency, not per-call cost.

**Recommendation**: Add a fast pre-check (e.g., does `.git` file or directory exist in CWD or any parent?) before spawning git. This avoids the subprocess entirely for non-git directories.

### P1-2: Simpler Alternative Not Rigorously Evaluated

The ADR and ANALYSIS-021 dismiss `code_path` as an array (or `additional_paths`) without quantitative comparison. Consider:

| Criterion | ADR-007 (implicit detection) | Array code_path |
|-----------|------------------------------|-----------------|
| Config changes | None | Yes (schema change) |
| Git dependency | Yes (new) | No |
| User control | None (implicit) | Full (explicit) |
| Maintenance | 3 implementations + git logic | Schema + validation |
| Non-git repos | Not supported | Supported |
| Debugging | Must understand git internals | Path matching (existing) |
| Worktree auto-discovery | Yes | No (manual) |

The only clear win for implicit detection is "auto-discovery." The array approach wins on every other criterion. Auto-discovery is a convenience, not a requirement.

**Recommendation**: Present both alternatives with explicit trade-off analysis. If implicit detection is chosen, document why auto-discovery outweighs the costs listed above.

### P1-3: Non-Git VCS Excluded by Design

The ADR is titled "Worktree-Aware" but is actually "Git-Worktree-Aware." Mercurial shares, SVN working copies, and Jujutsu colocated repos have analogous multi-checkout patterns. The design is git-specific by construction, creating technical debt if Brain ever needs to support other VCS worktree equivalents. The array approach would handle all VCS neutrally.

### P1-4: CODE Mode Worktree-Local docs/ Creates Fragmentation

The design says CODE mode will use `{worktree_root}/docs/` instead of `{code_path}/docs/`. This means each worktree gets isolated memories. But worktrees are often temporary (feature branch work). When the worktree is deleted, those memories are lost. There is no merge strategy, no warning, no backup mechanism for worktree-local docs.

DEFAULT mode (shared memories) is arguably the correct behavior for worktrees. The ADR should explicitly address the lifecycle of worktree-local memories.

## P2 Issues (Minor)

### P2-1: Git Version Floor Not Validated

The design requires git >= 2.31.0 for `--path-format=absolute` but does not specify how to communicate this requirement to users. Graceful fallback is good, but silent failure (worktrees stop resolving with no feedback) is a support burden.

### P2-2: Testing Relies on Real Git Operations

The testing strategy requires creating real git repos and worktrees in CI. This adds CI complexity and fragility. Mock-based testing would be more reliable but requires the git subprocess call to be injectable, which is not shown in the design.

### P2-3: Naming Inconsistency

The ADR is numbered ADR-007 but found in memory under multiple identifiers (ADR-007, ADR-021). This suggests namespace confusion during creation that should be resolved.

## Vote

**Disagree and Commit (D&C)** with conditions:

The core problem (worktrees break CWD matching) is real and worth solving. The proposed solution is sound engineering but makes unnecessary trade-offs by rejecting explicit configuration. I would accept the ADR if:

1. [P0-1] An opt-out mechanism is added (config toggle)
2. [P1-1] A fast pre-check avoids subprocess spawning for non-git directories
3. [P1-2] The trade-off analysis vs. array code_path is documented explicitly in the ADR, not just implicitly dismissed
4. [P1-4] The lifecycle of worktree-local CODE mode memories is addressed (what happens on worktree deletion?)

Without these, the ADR optimizes for the happy path while creating operational blind spots.

## Relations

- relates_to [[ADR-007 Worktree-Aware Project Resolution]]
- relates_to [[DESIGN-001 Git Worktree Project Resolution]]
- relates_to [[ANALYSIS-019 Project Resolution Codebase Research]]
- relates_to [[ANALYSIS-021 Community Worktree Practices Research]]