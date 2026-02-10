---
title: SESSION-2026-02-10_05-composable-rules-and-release-pipeline
type: session
status: COMPLETE
permalink: sessions/session-2026-02-10-05-composable-rules-and-release-pipeline
tags:
- session
- '2026-02-10'
- composable-rules
- release
- templates
- restructure
---

# SESSION-2026-02-10_05 Composable Rules and Release Pipeline

**Status:** COMPLETE
**Branch:** main
**Starting Commit:** ac4539a docs(session): finalize adapter migration session note with full format alignment
**Ending Commit:** 610ba90 feat: set up release-please + GoReleaser release pipeline
**Objective:** Implement composable rules for orchestrator/AGENTS.md/bootstrap, restructure templates/, fix Cursor adapter gaps, simplify Makefile, and set up release pipeline.

---

## Acceptance Criteria

- [x] [requirement] Composable rules implemented for orchestrator (43 files, 49% dedup) #composable
- [x] [requirement] Composable rules implemented for AGENTS.md (55 files, 80% shared) #composable
- [x] [requirement] Composable rules implemented for bootstrap (11 files) #composable
- [x] [requirement] Go composition engine built and wired into adapters (64 tests) #engine
- [x] [requirement] Cursor adapter generates agents, skills, commands (not just .mdc rules) #cursor-fix
- [x] [requirement] templates/ directory restructure (configs/, rules/, sections/) #restructure
- [x] [requirement] Makefile simplified to single `make` command #build
- [x] [requirement] Release pipeline: release-please + GoReleaser + curl installer #release
- [x] [requirement] ADR-006 for release workflow decisions #adr
- [x] [requirement] Session note kept current #session

---

## Key Decisions

- [decision] Composable rules use sections/ (not rules/) to avoid confusion with .cursor/rules/ and .claude/rules/ #naming
- [decision] templates/instructions renamed to templates/rules for composable instruction content #naming
- [decision] brain.config.json and mcp.json moved to templates/configs/ #structure
- [decision] hooks/ moved into templates/ (install-time content, not runtime) #structure
- [decision] Cursor natively supports agents, skills, and commands -- adapter updated accordingly #cursor
- [decision] TransformSkills and TransformCommands are shared functions (identical for both tools) #shared
- [decision] Makefile does one thing: build + install CLI locally #simplification
- [decision] release-please + GoReleaser for zero-friction release automation per [[ADR-006-release-workflow-and-distribution]] #release
- [decision] curl installer for end-user distribution #distribution

## Work Log

- [x] [outcome] Moved canonical content into templates/ directory (daecf93) #restructure
- [x] [outcome] Fixed Cursor adapter to generate agents, skills, commands (06c585c) #cursor-fix
- [x] [outcome] Decomposed bootstrap into composable rules (3aab85c) linking to [[TASK-003-move-canonical-commands]] #composable
- [x] [outcome] Decomposed AGENTS.md into 55 composable files (918ea05) #composable
- [x] [outcome] Decomposed orchestrator into 43 composable files, 49% dedup (d36db46) #composable
- [x] [outcome] Built Go composition engine with 28 tests (a147af1) #engine
- [x] [outcome] Renamed rules/ to sections/ in composable structure (20d9454) #naming
- [x] [outcome] Renamed templates/instructions to templates/rules (b252e59) #naming
- [x] [outcome] Moved configs to templates/configs/ (3990fde) #structure
- [x] [outcome] Simplified Makefile to single make command (7cce76a) #build
- [x] [outcome] Added curl installer and GitHub Actions release workflow (b30a531) #release
- [x] [outcome] Replaced build:tui with build:cli in package.json (a8464a4) #build
- [x] [outcome] Created ADR-006 for release workflow decisions (802b3e5) #adr
- [x] [outcome] Set up release-please + GoReleaser pipeline (610ba90) #release

## Commits

| SHA | Description | Files |
|---|---|---|
| daecf93 | refactor: move canonical content into templates/ directory | 211 |
| 06c585c | fix: Cursor adapter now generates agents, skills, and commands | 4 |
| 3aab85c | refactor(commands): decompose bootstrap into composable rules | 11 |
| 918ea05 | refactor(templates): decompose AGENTS.md into composable instruction rules | 55+ |
| d36db46 | refactor(plugin): decompose orchestrator into composable rules | 43+ |
| a147af1 | feat: implement composable rules with Go composition engine | 5 |
| 20d9454 | refactor: rename rules/ to sections/ in composable structure | 71 |
| b252e59 | refactor: rename templates/instructions to templates/rules | 59 |
| 3990fde | refactor: move brain.config.json and mcp.json to templates/configs/ | 7 |
| 7cce76a | refactor: simplify Makefile to just build + install brain CLI | 2 |
| b30a531 | feat: add curl installer and GitHub Actions release workflow | 2 |
| a8464a4 | refactor: replace build:tui with build:cli in package.json | 1 |
| 802b3e5 | docs: add ADR-006 release workflow and distribution | 1 |
| 610ba90 | feat: set up release-please + GoReleaser release pipeline | 4 |

---

## Files Touched

### Brain Memory Notes

| Action | Note | Status |
|---|---|---|
| created | [[SESSION-2026-02-10_05-composable-rules-and-release-pipeline]] | this note |
| created | [[ADR-006-release-workflow-and-distribution]] | proposed |

### Code Files

| File | Context |
|---|---|
| templates/ (all content moved here) | Restructured from root-level dirs |
| templates/agents/orchestrator/ (43 files) | Decomposed orchestrator |
| templates/rules/ (55 files) | Decomposed AGENTS.md instructions |
| templates/commands/bootstrap/ (11 files) | Decomposed bootstrap |
| templates/configs/brain.config.json | Moved from root |
| templates/configs/mcp.json | Moved from root |
| apps/tui/internal/adapters/compose.go | New composition engine |
| apps/tui/internal/adapters/compose\_test.go | 28 composition tests |
| apps/tui/internal/adapters/claude.go | Wired composition + shared skills/commands |
| apps/tui/internal/adapters/cursor.go | Added agents/skills/commands + composition |
| apps/tui/internal/adapters/shared.go | Updated paths to templates/ |
| Makefile | Simplified to single make command |
| package.json | build:cli replaces build:tui, removed stale workspace |
| install.sh | New curl installer |
| .goreleaser.yml | New GoReleaser config |
| .github/workflows/release.yml | release-please + GoReleaser pipeline |
| release-please-config.json | New release-please config |
| .release-please-manifest.json | Version manifest (v0.1.0) |

---

## Observations

- [fact] Composable rules reduced orchestrator from 4413 lines to 2228 (49% dedup) #composable
- [fact] AGENTS.md decomposed into 39 shared + 8 claude + 8 cursor sections #composable
- [fact] 64 Go adapter tests pass including 28 new composition tests #testing
- [insight] sections/ naming avoids confusion with tool-specific rules/ directories #naming
- [insight] Cursor supports agents, skills, and commands natively -- initial adapter was too conservative #cursor
- [outcome] Complete release pipeline: conventional commits -> release-please PR -> GoReleaser binaries -> curl install #release

## Relations

- continues [[SESSION-2026-02-10_04-adapter-migration-ts-to-go]]
- implements [[FEAT-001-cross-platform-portability]]
- implements [[ADR-002-cross-platform-plugin-architecture]]
- implements [[ADR-006-release-workflow-and-distribution]]
- relates_to [[DESIGN-005-composable-orchestrator-rules]]
- relates_to [[ANALYSIS-015-orchestrator-section-comparison]]
- relates_to [[ANALYSIS-016-agents-md-section-comparison]]

---

## Session Start Protocol

| Req Level | Step | Status | Evidence |
|---|---|:---:|---|
| MUST | Initialize Brain MCP | ✅ | bootstrap_context called |
| MUST | Create session log | ✅ | This note (backfilled) |
| SHOULD | Search relevant memories | ✅ | Prior sessions loaded |
| SHOULD | Verify git status | ✅ | main branch, clean working tree |

## Session End Protocol

| Req Level | Step | Status | Evidence |
|---|---|:---:|---|
| MUST | Update session status to complete | ✅ | Status set to COMPLETE |
| MUST | Update Brain memory | ✅ | Session note finalized |
| MUST | Run markdownlint | ✅ | Pre-existing issues only |
| MUST | Commit all changes | ✅ | See commits table |


## Next Session Work Items

- [pending] Embed templates in Go binary via go:embed so brain install works from anywhere #go-embed
- [pending] brain install: check for existing install, prompt to update/skip #install-check
- [pending] brain upgrade: self-update mechanism (check GitHub Releases for newer version, download + replace binary) #self-update
- [pending] Research on CLI self-update patterns in progress (bun upgrade, gh upgrade, go-selfupdate library) #research