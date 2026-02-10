---
title: FEAT-001 Cross-Platform Portability
type: feature
status: draft
source-refs:
- ADR-002
permalink: features/feat-001-cross-platform-portability/feat-001-cross-platform-portability
---

# FEAT-001 Cross-Platform Portability

## Context

- [fact] Brain currently exists as a Claude Code plugin with tight coupling in `apps/claude-plugin/` (25 agents, 27 skills, 9 commands, 174KB instructions, 2 Go binaries) #current-state
- [fact] Claude Code and Cursor have converged on nearly identical extensibility: commands, skills (Open Agent Skills), agents, MCP, hooks #convergence
- [fact] 85% of Brain content needs zero transformation (skills, commands, MCP config are format-identical across tools) #portability
- [fact] Content must live in one canonical root-level location with TS adapter transforms at install time per [[ADR-002 Cross-Platform Plugin Architecture]] #architecture

## Scope

### In Scope

- [fact] Root-level canonical content extraction from `apps/claude-plugin/` (agents, skills, commands, protocols, hooks) #extraction
- [fact] TS adapters (`adapters/`) for agent frontmatter transforms and hook config generation #adapters
- [fact] JS/TS hook scripts with normalization layer replacing Go brain-hooks binary (8 cmds, 3,673 LOC) #hooks
- [fact] JS/TS or Python consolidation of brain-skills binary (3 cmds, 627 LOC) #skills-port
- [fact] Two orchestrator agents: Agent Teams for Claude Code, Task tool hub-and-spoke for Cursor #orchestrator
- [fact] `brain install` / `brain uninstall` with huh v2 multiselect + bubbletea inline progress #cli
- [fact] Claude Code installed as plugin (symlinks), Cursor installed as file sync (copies) #install
- [fact] Non-destructive install: never modify user's existing CLAUDE.md, AGENTS.md, hooks config, or MCP config #non-destructive
- [fact] All Brain content uses `🧠` emoji prefix for namespacing (agents, skills, commands, rules, hooks) #naming
- [fact] Claude Code: plugin isolation handles namespacing; instructions via `.claude/rules/🧠-*.md` #claude-install
- [fact] Cursor: 🧠-prefixed file placement + JSON merge with manifest for hooks and MCP config #cursor-install
- [fact] Instructions delivered as composable rules (not monolithic AGENTS.md) per [[DESIGN-005-composable-orchestrator-rules]] #composable
- [fact] `brain.config.json` for declarative per-agent per-tool mapping #config
- [fact] `protocols/` at repo root for tool-neutral instruction content #protocols
- [fact] `brain claude` and `brain cursor` launch wrappers #launchers
- [fact] CI validation with golden file snapshots for adapter output #ci

### Out of Scope

- [constraint] Gemini CLI support (descoped per ADR-002; re-evaluate when Gemini extension model stabilizes) #deferred
- [constraint] Codex CLI support (minimal extensibility surface) #deferred
- [constraint] `apps/mcp/` MCP server changes (already tool-agnostic) #unchanged
- [constraint] `packages/utils/` and `packages/validation/` changes (except TS equivalents for hook port) #unchanged
- [constraint] Backward compatibility with `brain plugin install` or old `apps/claude-plugin/` structure #clean-break

## Phases

- [fact] Phase 1: Extract and Canonicalize -- move content to root, create brain.config.json, port Go binaries to JS/TS, create TS adapters, implement brain install/uninstall, refactor brain claude, remove apps/claude-plugin/. HIGH risk. #phase-1
- [fact] Phase 2: Add Cursor Target -- create Cursor adapter, generate .cursor/ output, extend brain install for Cursor, implement brain cursor launcher. MEDIUM risk. #phase-2
- [fact] Phase 3: Hook Normalization -- build normalize.ts shim, refactor hooks to use normalized events, generate per-tool hook configs, add CI validation. MEDIUM risk. #phase-3

## Effort Summary

| Estimate Type | Effort |
|:--|:--|
| Human estimate | 50-80 hours |
| AI-Assisted estimate | 25-45 hours |

### Task Detail

| Task | Phase | Tier | Human | AI-Assisted |
|:--|:--|:--|:--|:--|
| TASK-001 Create Root-Level Directory Scaffold | 1 | T1 | 2h | 0.5h |
| TASK-002 Move Canonical Skills | 1 | T1 | 2h | 0.5h |
| TASK-003 Move Canonical Commands | 1 | T1 | 1h | 0.5h |
| TASK-004 Extract Protocols to Root | 1 | T2 | 6h | 2h |
| TASK-005 Canonicalize Agent Definitions | 1 | T2 | 8h | 3h |
| TASK-006 Create Two Orchestrator Agents | 1 | T3 | 8h | 4h |
| TASK-007 Create brain.config.json and AGENTS.md | 1 | T2 | 4h | 2h |
| TASK-008 Port brain-hooks to JS/TS | 1 | T3 | 16h | 8h |
| TASK-009 Consolidate brain-skills Binary | 1 | T1 | 3h | 1h |
| TASK-010 Create TS Claude Code Adapter | 1 | T2 | 6h | 3h |
| TASK-011 Implement brain install and uninstall | 1 | T3 | 10h | 5h |
| TASK-012 Refactor brain claude Launcher | 1 | T1 | 3h | 1h |
| TASK-013 Remove apps/claude-plugin and Old Commands | 1 | T1 | 3h | 1h |
| TASK-014 Create TS Cursor Adapter | 2 | T2 | 6h | 3h |
| TASK-015 Extend brain install for Cursor | 2 | T1 | 3h | 1h |
| TASK-016 Implement brain cursor Launcher | 2 | T1 | 3h | 1h |
| TASK-017 Cursor Integration Testing | 2 | T2 | 6h | 3h |
| TASK-018 Build Hook Normalization Shim | 3 | T2 | 6h | 3h |
| TASK-019 Refactor Hook Scripts for Normalization | 3 | T2 | 6h | 3h |
| TASK-020 Add CI Validation and Golden Files | 3 | T1 | 4h | 2h |

## Success Criteria

- [ ] [requirement] All canonical content at repo root (agents/, skills/, commands/, protocols/, hooks/) #structure
- [ ] [requirement] `apps/claude-plugin/` removed entirely #removal
- [ ] [requirement] `brain install` detects and installs to Claude Code and Cursor #install
- [ ] [requirement] `brain uninstall` cleanly removes from either tool #uninstall
- [ ] [requirement] Claude Code orchestrator uses Agent Teams; Cursor orchestrator uses Task tool hub-and-spoke #orchestrator
- [ ] [requirement] All specialist agents portable across both tools (identical body, different frontmatter) #portability
- [ ] [requirement] Hook scripts work on both tools via normalization layer #hooks
- [ ] [requirement] CI validates adapter output via golden file snapshots #ci
- [ ] [requirement] No Go binary required for hook or skill execution #no-binary

## Artifact Status

### Requirements

- [ ] [requirement] [[REQ-001-canonical-content-extraction]] #status-draft
- [ ] [requirement] [[REQ-002-cross-platform-agent-adaptation]] #status-draft
- [ ] [requirement] [[REQ-003-hook-normalization]] #status-draft
- [ ] [requirement] [[REQ-004-unified-install]] #status-draft
- [ ] [requirement] [[REQ-005-orchestrator-portability]] #status-draft

### Designs

- [ ] [design] [[DESIGN-001-adapter-architecture]] #status-draft
- [ ] [design] [[DESIGN-002-hook-normalization-layer]] #status-draft
- [ ] [design] [[DESIGN-003-install-tui-flow]] #status-draft
- [ ] [design] [[DESIGN-004-orchestrator-strategy]] #status-draft
- [ ] [design] [[DESIGN-005-composable-orchestrator-rules]] #status-draft

### Tasks

- [ ] [task] [[TASK-001-create-root-level-directory-scaffold]] #status-todo
- [ ] [task] [[TASK-002-move-canonical-skills]] #status-todo
- [ ] [task] [[TASK-003-move-canonical-commands]] #status-todo
- [ ] [task] [[TASK-004-extract-protocols-to-root]] #status-todo
- [ ] [task] [[TASK-005-canonicalize-agent-definitions]] #status-todo
- [ ] [task] [[TASK-006-create-two-orchestrator-agents]] #status-todo
- [ ] [task] [[TASK-007-create-brain-config-and-agents-md]] #status-todo
- [ ] [task] [[TASK-008-port-brain-hooks-to-js-ts]] #status-todo
- [ ] [task] [[TASK-009-consolidate-brain-skills-binary]] #status-todo
- [ ] [task] [[TASK-010-create-ts-claude-code-adapter]] #status-todo
- [ ] [task] [[TASK-011-implement-brain-install-uninstall]] #status-todo
- [ ] [task] [[TASK-012-refactor-brain-claude-launcher]] #status-todo
- [ ] [task] [[TASK-013-remove-apps-claude-plugin]] #status-todo
- [ ] [task] [[TASK-014-create-ts-cursor-adapter]] #status-todo
- [ ] [task] [[TASK-015-extend-brain-install-for-cursor]] #status-todo
- [ ] [task] [[TASK-016-implement-brain-cursor-launcher]] #status-todo
- [ ] [task] [[TASK-017-cursor-integration-testing]] #status-todo
- [ ] [task] [[TASK-018-build-hook-normalization-shim]] #status-todo
- [ ] [task] [[TASK-019-refactor-hook-scripts-for-normalization]] #status-todo
- [ ] [task] [[TASK-020-add-ci-validation-and-golden-files]] #status-todo

## Observations

- [decision] Root-level canonical content; no packages/plugin-content/ or apps/claude-plugin/ #architecture
- [decision] TS-only adapters; Go CLI shells out to bun at install time #adapters
- [decision] Two orchestrator agents matching each tool's native parallel model #orchestrator
- [decision] brain.config.json with explicit per-agent per-tool values (no abstract model tiers) #config
- [decision] Clean break from old structure; no backward compatibility #clean-break
- [decision] Claude Code + Cursor only; Gemini descoped #scope
- [decision] All Brain content uses 🧠 emoji prefix universally (skills, agents, commands, rules, hooks) #naming
- [decision] Non-destructive install: never modify user's existing instruction, hook, or MCP files #non-destructive
- [decision] Claude Code uses plugin isolation; Cursor uses 🧠-prefixed file placement + JSON merge with manifest #per-tool-install
- [decision] Instructions delivered as composable rules, not monolithic AGENTS.md #composable
- [fact] 85% of content needs zero transformation #portability
- [fact] Skills use Open Agent Skills standard; zero adaptation needed #portability
- [fact] brain-hooks Go binary: 8 cmds, 3,673 LOC source + 2,669 LOC tests #scope
- [fact] brain-skills Go binary: 3 cmds, 627 LOC with Python equivalents in skills/ #scope
- [fact] Instructions/protocols: 174KB, deeply Claude-specific, need decomposition #scope
- [risk] brain-hooks port is highest-risk single workstream; 3,673 LOC + shared Go package deps #hook-port
- [risk] 22 of 25 agents have Claude-specific refs (298 total); canonicalization nontrivial #agents
- [insight] This feature restructures the entire plugin architecture; zero feature dependencies #critical-path

## Relations

- derives_from [[ADR-002 Cross-Platform Plugin Architecture]]
- implements [[ANALYSIS-006-multi-tool-compatibility-research]]
- implements [[ANALYSIS-009-codebase-gap-audit]]
- depends_on [[ANALYSIS-010 Consolidated Validation Brief]]
- relates_to [[REQ-001-canonical-content-extraction]]
- relates_to [[REQ-002-cross-platform-agent-adaptation]]
- relates_to [[REQ-003-hook-normalization]]
- relates_to [[REQ-004-unified-install]]
- relates_to [[REQ-005-orchestrator-portability]]
- relates_to [[DESIGN-001-adapter-architecture]]
- relates_to [[DESIGN-002-hook-normalization-layer]]
- relates_to [[DESIGN-003-install-tui-flow]]
- relates_to [[DESIGN-004-orchestrator-strategy]]
- relates_to [[DESIGN-005-composable-orchestrator-rules]]
