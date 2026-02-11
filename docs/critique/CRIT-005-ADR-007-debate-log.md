---
title: CRIT-005-ADR-007-debate-log
type: critique
permalink: critique/crit-005-adr-007-debate-log
tags:
- adr-review
- debate-log
- worktree
- project-resolution
---

# CRIT-005 ADR-007 Debate Log

## ADR Under Review

[[ADR-007 Worktree-Aware Project Resolution]]

## Review Panel

| Agent | Role | Vote |
|:--|:--|:--|
| review-architect | Structure, governance, coherence | Disagree-and-Commit |
| review-critic | Gaps, risks, stress-testing | D&C (conditional) |
| review-contrarian | Challenge assumptions, alternatives | D&C (conditional) |
| review-security | Threat models, security trade-offs | D&C (conditional) |
| review-analyst | Evidence, feasibility, cross-platform | Accept |
| review-advisor | Strategic value, priority, scope | Accept |

## Consensus

**Result: 2 Accept, 4 D&C — consensus reached (no Blocks).**

4 P0 issues identified, all resolved in ADR revision.

## P0 Issues (BLOCKING — all resolved)

- [problem] P0-1: Translation layer has no runtime path for effectiveCwd. resolveMemoriesPath is called at config sync time, not request time. RESOLVED: MCP-level runtime override instead. #architecture #resolved
- [problem] P0-2: basic-memory config maps project names to single static paths. No mechanism for per-request path overrides. RESOLVED: MCP server overrides at request time, static config unchanged. #architecture #resolved
- [problem] P0-3: No opt-out mechanism. RESOLVED: Per-project disableWorktreeDetection config + BRAIN_DISABLE_WORKTREE_DETECTION env var. #usability #resolved
- [problem] P0-4: ADR claims zero breaking changes but internal API changes. RESOLVED: Reworded to zero external breaking changes. #documentation #resolved

## P1 Issues (Consensus — raised by 2+ agents)

- [risk] Fast pre-check (.git exists?) before spawning git subprocess to avoid unnecessary calls on non-git dirs #performance
- [risk] Validate effectiveCwd through path-validator.ts before using for memories path derivation #security
- [risk] Bun hooks resolution hierarchy already diverges from TypeScript and Go implementations #parity
- [risk] Logging and observability when worktree fallback activates or fails #debugging
- [risk] Worktree-local CODE mode docs/ lifecycle: temporary worktrees lose memories on deletion #data-loss
- [risk] Cross-language parity test infrastructure for worktree scenarios does not exist yet #testing
- [risk] TOCTOU gap between worktree detection and memories write #security

## P2 Issues (Tracked)

- [insight] ADR lacks explicit Consequences section
- [insight] Missing relation to existing config architecture ADRs
- [insight] Git version floor 2.31.0 not communicated to users
- [insight] Symlink resolution timing (before or after detection) unspecified
- [insight] 3-second timeout value not justified
- [insight] No telemetry for adoption tracking
- [insight] Array code_path alternative dismissed without rigorous comparison

## Individual Reviews

| Agent | Brain Note |
|:--|:--|
| architect | [[CRIT-008-ADR-007-architect-review]] |
| critic | [[CRIT-007-ADR-007-critic-review]] |
| contrarian | [[CRIT-006-ADR-007-contrarian-review]] |
| security | [[SEC-001-adr-007-worktree-security-review]] |
| analyst | [[ANALYSIS-022-adr-007-analyst-review]] |
| advisor | [[CRIT-009-ADR-007-strategic-advisor-review]] |

## Observations

- [decision] Consensus reached via 2 Accept + 4 D&C, no Blocks #review-outcome
- [fact] Core architectural gap identified: static config translation vs runtime resolution #architecture
- [fact] 6 agents independently flagged translation layer integration as a design gap #convergence
- [insight] The opt-out mechanism and pre-check are low-cost additions that address real risk #pragmatic
- [insight] All 4 P0s resolved in ADR revision before moving to ACCEPTED status #process
- [problem] macOS case-insensitive FS caused data loss during note rename, requiring recreation #tooling-bug

## Relations

- reviews [[ADR-007 Worktree-Aware Project Resolution]]
- relates_to [[DESIGN-001-git-worktree-project-resolution]]
- contains [[CRIT-008-ADR-007-architect-review]]
- contains [[CRIT-007-ADR-007-critic-review]]
- contains [[CRIT-006-ADR-007-contrarian-review]]
- contains [[SEC-001-adr-007-worktree-security-review]]
- contains [[ANALYSIS-022-adr-007-analyst-review]]
- contains [[CRIT-009-ADR-007-strategic-advisor-review]]