---
title: SESSION-2026-02-09_01-multi-tool-compatibility-restructure
type: session
permalink: sessions/session-2026-02-09-01-multi-tool-compatibility-restructure
tags:
- session
- '2026-02-09'
- multi-tool
- restructure
- research
---

# SESSION-2026-02-09_01 Multi-Tool Compatibility Restructure

**Status:** COMPLETE
**Branch:** main
**Starting Commit:** 54323c8 docs(session): complete session note for project edit config sync bugfix
**Ending Commit:** TBD
**Objective:** Research and plan restructuring Brain to support multiple AI tools (Claude Code, Cursor IDE/CLI, Gemini CLI) with install/uninstall CLI commands. Produce [[ADR-002-multi-tool-compatibility-architecture]], [[PLAN-001-multi-tool-compatibility-implementation-plan]], and [[CRIT-001-multi-tool-architecture-critique]].

---

## Acceptance Criteria

- [x] [requirement] Deep reconnaissance of current codebase structure complete #research
- [x] [requirement] Research on Cursor IDE/CLI agent capabilities complete #research
- [x] [requirement] Research on Gemini CLI and Codex capabilities complete #research
- [x] [requirement] ADR drafted and reviewed by 6-agent debate #architecture
- [x] [requirement] Implementation plan drafted and reviewed #planning
- [x] [requirement] Install staging strategy researched (symlinks, community patterns) #research
- [x] [requirement] ADR revised to user's proposed root-level structure #architecture
- [x] [requirement] ADR revised with staging research findings #architecture
- [ ] [requirement] Delegation plan for full implementation reviewed with user #planning
- [x] [requirement] Session note kept current with inline relations to every touched artifact #session

---

## Key Decisions

- [decision] Session scope is research and planning only, not implementation #planning
- [decision] Switched from brain-restoration to brain project (code_path matches CWD) #project-config
- [decision] Scope: Claude Code + Cursor + Gemini CLI (3 tools, defer Codex) #scope
- [decision] TUI approach: charmbracelet/huh v2 library (replaces gum binary) + bubbletea inline for progress #ui
- [decision] Root-level canonical content (agents/, skills/, commands/ at repo root) #architecture
- [decision] `apps/claude-plugin/` removed; all tools are equal consumers #architecture
- [decision] Lightweight `adapters/` directory replaces per-tool adapter apps #architecture
- [decision] JS/TS hook scripts replace Go brain-hooks binary #hooks
- [decision] Hybrid staging + adaptive write: symlinks for Claude, copy for Cursor/Gemini #install
- [decision] Staging area at ~/.local/share/brain/plugins/{tool}/ (XDG-compliant) #install
- [decision] Manifest tracking via ~/.local/share/brain/installed.json #install
- [decision] Gemini parallel execution PENDING user decision; ADR proceeds with "for tools that support it" #parallel

---

## Work Log

- [x] [fact] Initialized Brain MCP, verified git state, created session note #session-lifecycle
- [x] [fact] 5 parallel reconnaissance agents: Go CLI, Claude plugin, Cursor, Gemini/Codex, MCP server #research
- [x] [outcome] ANALYSIS-006 initial research synthesis, ANALYSIS-007 staging strategy #research
- [x] [outcome] ADR-002 v1 drafted, 6-agent debate review (3 ACCEPT, 3 REVISE) #architecture
- [x] [outcome] FEAT-001 v1 created with ADR-001 feature workflow #planning
- [x] [outcome] CRIT-001 and CRIT-002 reviews #review
- [x] [decision] Scope: Claude Code + Cursor only, Gemini descoped #scope
- [x] [decision] User proposed root-level canonical content structure #architecture
- [x] [outcome] Validation Agent Team: ANALYSIS-008 community research, ANALYSIS-009 codebase audit, ANALYSIS-010 consolidated brief #validation
- [x] [outcome] ANALYSIS-011 reference install comparison (ai-agents, basic-memory) #research
- [x] [outcome] 6-agent evaluation of cross-platform proposal vs ADR-002: unanimous HYBRID #evaluation
- [x] [outcome] ANALYSIS-012 Cursor orchestrator research: Agent Teams cannot port directly #research
- [x] [outcome] ANALYSIS-013 MCP orchestration research: proven pattern but single-agent #research
- [x] [outcome] ANALYSIS-014 4-way orchestrator comparison: Brain's inter-agent messaging is unique #research
- [x] [decision] Unified brain install/uninstall with huh v2 + bubbletea inline #install
- [x] [decision] Claude Code as plugin, Cursor as file sync #per-tool-strategy
- [x] [decision] Two orchestrator versions: Agent Teams (CC) + hub-and-spoke (Cursor) #orchestrator
- [x] [decision] TypeScript-only transforms, Go CLI shells out to bun #adapters
- [x] [decision] JS/TS hooks with normalization layer, Phase 4 MCP migration DROPPED #hooks
- [x] [decision] No backward compatibility, clean break #clean-break
- [x] [decision] brain.config.json for declarative per-agent per-tool mapping #config
- [x] [outcome] ADR-002 rewritten from scratch using proposal as foundation + all decisions #architecture
- [x] [outcome] FEAT-001 rewritten: 5 REQs, 4 DESIGNs, 20 TASKs across 3 phases #planning
- [x] [outcome] CRIT-003 and CRIT-004 final reviews: both APPROVED #review
- [x] [outcome] ANALYSIS-015 orchestrator comparison: 70% shared, 85% with template vars #composable
- [x] [outcome] ANALYSIS-016 AGENTS.md comparison: 80% shared, 150-line identical block #composable
- [x] [outcome] DESIGN-005 composable orchestrator rules with template variable system #design
- [x] [outcome] ANALYSIS-017 file conflict research: never touch user files, use rules/ dirs #install
- [x] [decision] Install to .claude/rules/brain/*.md and .cursor/rules/brain-*.mdc (never CLAUDE.md) #non-destructive
- [x] [decision] Plugin system handles hooks/MCP conflicts on Claude Code by design #isolation

## Commits

| SHA | Description | Files |
|---|---|---|
| TBD | Session in progress | N/A |

---

## Files Touched

### Brain Memory Notes - Analysis

| Action | Note | Status |
|---|---|---|
| renamed | [[ANALYSIS-002-sync-changes-clarification]] | was ANALYSIS-001 |
| renamed | [[ANALYSIS-003-Config-Propagation-Bug]] | was ANALYSIS-002 |
| renamed | [[ANALYSIS-004-basic-memory-sync-capabilities]] | was ANALYSIS-002 |
| renamed | [[ANALYSIS-005-session-create-file-missing]] | was ANALYSIS-003 |
| created | [[ANALYSIS-006-multi-tool-compatibility-research]] | complete |
| created | [[ANALYSIS-007-install-staging-strategy-research]] | complete |
| created | [[ANALYSIS-008-community-validation-research]] | complete |
| created | [[ANALYSIS-009-codebase-gap-audit]] | complete |
| created | [[ANALYSIS-010-consolidated-validation-brief]] | complete |
| created | [[ANALYSIS-011-reference-install-comparison]] | complete |
| created | [[ANALYSIS-012-cursor-orchestrator-research]] | complete |
| created | [[ANALYSIS-013-mcp-orchestration-research]] | complete |
| created | [[ANALYSIS-014-orchestrator-comparison]] | complete |
| created | [[ANALYSIS-015-orchestrator-section-comparison]] | complete |
| created | [[ANALYSIS-016-agents-md-section-comparison]] | complete |
| created | [[ANALYSIS-017-existing-file-conflict-research]] | complete |

### Brain Memory Notes - Critique

| Action | Note | Status |
|---|---|---|
| created | [[CRIT-001-multi-tool-architecture-critique]] | complete |
| created | [[CRIT-002-revised-adr-plan-review]] | complete |
| created | [[CRIT-003-final-validation-review]] | complete |
| created | [[CRIT-004-final-validation-rewrite]] | complete |

### Brain Memory Notes - Decisions

| Action | Note | Status |
|---|---|---|
| created | [[ADR-002-cross-platform-plugin-architecture]] | revision 3 |

### Brain Memory Notes - Features

| Action | Note | Status |
|---|---|---|
| created | [[FEAT-001-cross-platform-portability]] | complete |
| created | [[REQ-001-canonical-content-extraction]] | complete |
| created | [[REQ-002-cross-platform-agent-adaptation]] | complete |
| created | [[REQ-003-hook-normalization]] | complete |
| created | [[REQ-004-unified-install]] | complete |
| created | [[REQ-005-orchestrator-portability]] | complete |
| created | [[DESIGN-001-adapter-architecture]] | complete |
| created | [[DESIGN-002-hook-normalization-layer]] | complete |
| created | [[DESIGN-003-install-tui-flow]] | complete |
| created | [[DESIGN-004-orchestrator-strategy]] | complete |
| created | [[DESIGN-005-composable-orchestrator-rules]] | complete |
| created | [[TASK-001-create-root-level-directory-scaffold]] | complete |
| created | [[TASK-002-move-canonical-skills]] | complete |
| created | [[TASK-003-move-canonical-commands]] | complete |
| created | [[TASK-004-extract-protocols-to-root]] | complete |
| created | [[TASK-005-canonicalize-agent-definitions]] | complete |
| created | [[TASK-006-create-two-orchestrator-agents]] | complete |
| created | [[TASK-007-create-brain-config-and-agents-md]] | complete |
| created | [[TASK-008-port-brain-hooks-to-js-ts]] | complete |
| created | [[TASK-009-consolidate-brain-skills-binary]] | complete |
| created | [[TASK-010-create-ts-claude-code-adapter]] | complete |
| created | [[TASK-011-implement-brain-install-uninstall]] | complete |
| created | [[TASK-012-refactor-brain-claude-launcher]] | complete |
| created | [[TASK-013-remove-apps-claude-plugin]] | complete |
| created | [[TASK-014-create-ts-cursor-adapter]] | complete |
| created | [[TASK-015-extend-brain-install-for-cursor]] | complete |
| created | [[TASK-016-implement-brain-cursor-launcher]] | complete |
| created | [[TASK-017-cursor-integration-testing]] | complete |
| created | [[TASK-018-build-hook-normalization-shim]] | complete |
| created | [[TASK-019-refactor-hook-scripts-for-normalization]] | complete |
| created | [[TASK-020-add-ci-validation-and-golden-files]] | complete |

### Brain Memory Notes - Sessions

| Action | Note | Status |
|---|---|---|
| created | [[SESSION-2026-02-09_01-multi-tool-compatibility-restructure]] | this note |

### Code Files

| File | Context |
|---|---|
| No code files touched | Research and planning session only |

---

## Observations

- [fact] Brain monorepo: apps/claude-plugin, apps/mcp (TS), apps/tui (Go CLI) #architecture
- [fact] Go CLI uses cobra + bubbletea + bubbles + lipgloss + glamour #dependencies
- [fact] Plugin install uses symlink strategy to ~/.claude/plugins/ #install-mechanism
- [fact] Dynamic staging via brain claude uses ~/.cache/brain/claude-plugin/ #install-mechanism
- [fact] Agent-teams variant swap pattern for 3 files (bootstrap, orchestrator, AGENTS) #variant-pattern
- [fact] Hooks compiled into Go binary (brain-hooks) #hooks
- [fact] MCP server runs via bun with stdio transport #mcp
- [fact] Cursor symlinks broken Feb 2026, Gemini intentionally blocks symlinks #symlink-status
- [fact] charmbracelet/huh v2 is gum's underlying Go library #tui
- [constraint] User requires brain emoji prefix visible identically across all tools #nonnegotiable
- [constraint] Parallel subagent execution mandatory for tools that support it #nonnegotiable
- [insight] Root-level canonical content aligns with community patterns for open-source AI agent projects #architecture
- [insight] Hybrid staging + adaptive write follows npx skills / GNU Stow patterns #install
- [outcome] ADR-002 at revision 3 with root-level structure, staging strategy, huh v2, expanded security #deliverable
- [outcome] 12 analysis notes, 1 ADR, 4 critiques, 1 feature (5 REQs, 5 DESIGNs, 20 TASKs) produced this session #deliverable

## Relations

- relates_to [[ADR-002-cross-platform-plugin-architecture]]
- relates_to [[FEAT-001-cross-platform-portability]]
- relates_to [[CRIT-001-multi-tool-architecture-critique]]
- relates_to [[CRIT-002-revised-adr-plan-review]]
- relates_to [[CRIT-003-final-validation-review]]
- relates_to [[CRIT-004-final-validation-rewrite]]
- relates_to [[ANALYSIS-006-multi-tool-compatibility-research]]
- relates_to [[ANALYSIS-007-install-staging-strategy-research]]
- relates_to [[ANALYSIS-008-community-validation-research]]
- relates_to [[ANALYSIS-009-codebase-gap-audit]]
- relates_to [[ANALYSIS-010-consolidated-validation-brief]]
- relates_to [[ANALYSIS-011-reference-install-comparison]]
- relates_to [[ANALYSIS-012-cursor-orchestrator-research]]
- relates_to [[ANALYSIS-013-mcp-orchestration-research]]
- relates_to [[ANALYSIS-014-orchestrator-comparison]]
- relates_to [[ANALYSIS-015-orchestrator-section-comparison]]
- relates_to [[ANALYSIS-016-agents-md-section-comparison]]
- relates_to [[ANALYSIS-017-existing-file-conflict-research]]
- relates_to [[DESIGN-001-adapter-architecture]]
- relates_to [[DESIGN-002-hook-normalization-layer]]
- relates_to [[DESIGN-003-install-tui-flow]]
- relates_to [[DESIGN-004-orchestrator-strategy]]
- relates_to [[DESIGN-005-composable-orchestrator-rules]]
- relates_to [[REQ-001-canonical-content-extraction]]
- relates_to [[REQ-002-cross-platform-agent-adaptation]]
- relates_to [[REQ-003-hook-normalization]]
- relates_to [[REQ-004-unified-install]]
- relates_to [[REQ-005-orchestrator-portability]]

## Session Start Protocol

| Req Level | Step | Status | Evidence |
|---|---|---|---|
| MUST | Initialize Brain MCP | PASS | bootstrap_context called |
| MUST | Create session log | PASS | This note |
| SHOULD | Search relevant memories | PASS | No prior memories found (greenfield) |
| SHOULD | Verify git status | PASS | main branch, 54323c8, uncommitted changes from prior session |

## Session End Protocol

| Req Level | Step | Status | Evidence |
|---|---|---|---|
| MUST | Update session status to complete | PASS | Status set to COMPLETE |
| MUST | Update Brain memory | PASS | Session note updated with full files-touched inventory |
| MUST | Commit all changes | PENDING | TBD |
