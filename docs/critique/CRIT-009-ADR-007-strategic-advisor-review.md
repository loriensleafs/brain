---
title: CRIT-009-ADR-007-strategic-advisor-review
type: critique
permalink: critique/crit-009-adr-007-strategic-advisor-review
tags:
- adr-review
- strategic
- worktree
- project-resolution
---

# CRIT-009 ADR-007 Strategic Advisor Review

## Vote: ACCEPT

## Strategic Assessment

- [decision] Worktree support aligns with Brain product direction: transparent memory that follows your work #strategy
- [fact] AI-assisted development driving worktree adoption: VS Code background agents, ccswarm, ccpm all use worktrees as isolation primitives #market
- [fact] Brain users running parallel Claude Code sessions in worktrees hit resolution failure today #user-impact
- [decision] Scope is well-calibrated: enhances existing CWD matching, no new memories_mode, no config schema bloat #scope
- [decision] All three language implementations required, not optional: TS-only would cause inconsistent behavior across codepaths #architecture
- [decision] Feature flag not needed: worktree detection is already a fallback that only activates when direct matching fails #design
- [decision] Zero-config transparent detection is strategically sound: community tools with explicit config see lower adoption #adoption
- [insight] This is not a new feature but fixing a gap in the core resolution path #framing
- [risk] P1: Logging and observability gap needs addressing before implementation #observability

## Key Arguments

### Right Problem, Right Time

AI-assisted development is driving worktree adoption hard. ANALYSIS-021 documents VS Code 1.107+ background agents, ccswarm, ccpm all using worktrees. Delaying means every new worktree user discovers a broken experience.

### No Conflicts with Existing ADRs

The 6 existing ADRs cover feature workflow, cross-platform architecture, adapter implementation, protocol extraction, config/agents.md, and release workflow. ADR-007 operates entirely within the project resolution subsystem.

### 3-Language Parity is Architectural, Not Perfectionism

Three identical implementations exist today with cross-language parity tests. Shipping TS-only would mean worktree detection works in MCP server but fails in Bun hooks and Go CLI.

### Zero-Config is the Winning Pattern

ANALYSIS-021 shows tools requiring worktree configuration see lower adoption than transparent detection (VS Code, IntelliJ). Zero support burden: no new config keys to document, no migration path.

## Relations

- reviews [[ADR-007 Worktree-Aware Project Resolution]]
- part_of [[CRIT-005-ADR-007-debate-log]]
- depends_on [[ANALYSIS-021-community-worktree-practices-research]]
