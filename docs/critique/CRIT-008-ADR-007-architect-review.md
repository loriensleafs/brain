---
title: CRIT-013 ADR-007 Architect Review
type: note
permalink: critique/crit-008-adr-007-architect-review-1-1-1-1
tags:
- critique
- adr-review
- architecture
- worktree
---

# CRIT-013 ADR-007 Architect Review

## Review Scope

Architectural review of ADR-007 (Worktree-Aware Project Resolution) evaluating structure, governance, coherence with existing resolution hierarchy, cross-language parity, and the effectiveCwd pattern.

## Observations

- [fact] ADR-007 follows correct structure: Context, Decision, Observations, Relations with PROPOSED status #structure #compliant
- [insight] The decision to add worktree detection as a fallback within CWD matching (level 5) rather than a new resolution level preserves the existing 6-level hierarchy and avoids config schema migration #architecture #coherent
- [decision] effectiveCwd pattern is architecturally sound: enriches internal return type without breaking public API (resolveProject still returns string|null) #backward-compatible
- [fact] The ADR correctly identifies all three implementations that must be updated in sync: TypeScript, Go, Bun hooks #cross-language
- [insight] The translation layer (apps/mcp/src/config/translation-layer.ts) resolveMemoriesPath currently takes only projectConfig and defaultMemoriesLocation; adding effectiveCwd parameter is a clean extension, not a refactor #integration
- [risk] The ADR says "no config schema changes" but the CwdMatchResult return type IS a schema change internal to the resolution module; callers of resolveProjectFromCwd that expect string will break in Go (type change) #P1
- [insight] DESIGN-001 proposes resolveProjectWithContext as a new export while keeping resolveProject as a wrapper -- this is proper facade pattern and maintains backward compatibility #architecture
- [fact] The Bun hooks implementation uses Bun.spawn (async), while TypeScript uses execSync (sync) and Go uses exec.Command (sync-capable); DESIGN-001 accounts for this divergence #cross-language
- [risk] The 3-second timeout for git rev-parse could add noticeable latency on first resolution when CWD does not match any project and is not a git repo; git exits fast on non-git dirs so this is acceptable in practice #performance
- [insight] The ADR does not address what happens when basic-memory config is synced for a worktree-resolved project in CODE mode: translateBrainToBasicMemory always uses code_path, not effectiveCwd, so the synced config will point to main repo docs/ not worktree docs/ #P1

## Findings

### P0 (Must Resolve -- BLOCKING)

None identified.

### P1 (Resolve OR Defer with Issue -- BLOCKING)

**P1-1: Translation layer sync gap for CODE mode worktrees**

The translation layer (`apps/mcp/src/config/translation-layer.ts:153-242`) calls `resolveMemoriesPath(projectName, projectConfig, defaultMemoriesLocation)` using `projectConfig.code_path` for CODE mode. This translation runs at config write time, not at resolution time. When a worktree session resolves via effectiveCwd, the basic-memory config will still point to `{code_path}/docs` (main repo), not `{effectiveCwd}/docs` (worktree).

This means basic-memory's file watcher and sync would target the main repo's docs/ even when a Claude session is operating in a worktree. The MCP server would need to override the memories path at runtime using the resolution context, bypassing the static basic-memory config.

**Resolution**: The design must explicitly document how worktree-resolved CODE mode memories paths flow through to basic-memory at runtime. Options: (a) the MCP server overrides the path at runtime when worktree is detected (preferred), (b) the translation layer is invoked per-session with effectiveCwd context. Either way, this gap must be addressed in the ADR or design before implementation.

**P1-2: Go return type change breaks callers**

The Go function `matchCwdToProjectWithConfig` currently returns `string`. DESIGN-001 proposes changing this to `*CwdMatchResult`. While this is internal, the function is exported (uppercase in Go) and used by `ResolveProjectFromCwd`. The return type change propagates to all callers. In TypeScript, the public API is preserved via wrapper, but the Go design does not show an equivalent compatibility wrapper.

**Resolution**: Add explicit Go backward-compatibility strategy in the design. The pattern should mirror TypeScript: keep `matchCwdToProjectWithConfig` returning `string`, add `matchCwdToProjectWithContextConfig` returning `*CwdMatchResult`.

### P2 (Document -- Non-blocking)

**P2-1: ADR lacks explicit Consequences section**

Standard ADR format is Context / Decision / Consequences. The ADR has Context and Decision but uses Observations instead of Consequences. While Observations capture the same information, the missing Consequences section means tradeoffs are not explicitly called out (e.g., added git subprocess dependency, increased resolution latency on miss).

**P2-2: Missing cross-reference to ADR-020**

The source code in all three resolver files references ADR-020 for configuration architecture. ADR-007 should explicitly state its relationship to ADR-020 in the Relations section since it modifies behavior governed by ADR-020's resolution hierarchy.

**P2-3: Parity test gap noted but not scoped**

The design mentions cross-language parity tests in `packages/validation/src/__tests__/parity/` but existing parity tests cover naming patterns and session status validators, not project resolution. The new worktree parity tests would be the first resolution-related parity tests. This is fine but should be noted as new test infrastructure, not an addition to existing tests.

**P2-4: git version requirement not in ADR**

The design requires git >= 2.31.0 for `--path-format=absolute`. This is mentioned in the design and analysis but not in the ADR's observations. Since git 2.31.0 is from March 2021, this is a reasonable requirement, but the ADR should capture it as a constraint for traceability.

## Vote

**Disagree-and-Commit** (conditional on P1 resolution)

The architecture is sound. The decision to enhance CWD matching rather than add a new resolution level is correct. The effectiveCwd pattern maintains clean separation. However, the two P1 issues (translation layer sync gap and Go return type change) must be either resolved or deferred with tracked issues before implementation begins. I commit to the approach once these are addressed.

## Relations

- relates_to [[ADR-007 Worktree-Aware Project Resolution]]
- relates_to [[DESIGN-001 Git Worktree Project Resolution]]
- relates_to [[ANALYSIS-019 Project Resolution Codebase Research]]
- relates_to [[ADR-020 Configuration Architecture]]