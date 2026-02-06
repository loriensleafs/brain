---
title: SESSION-2026-02-06_02-project-edit-config-sync-bugfix
type: session
permalink: sessions/session-2026-02-06-02-project-edit-config-sync-bugfix
tags:
- session
- '2026-02-06'
- bugfix
- config-sync
- project-edit
---

# SESSION Project Edit Config Sync Bugfix

**Status:** IN_PROGRESS
**Branch:** main
**Starting Commit:** aec5142 Fast and diryt commit.
**Objective:** Fix 3 bugs in project edit flow: CLI --memories-path flag ignored without --code-path, edit_project MCP tool not syncing to v2 config, and remove legacy edit_project in favor of config_update_project

---

## Acceptance Criteria

- [ ] `brain projects oncall --memories-path CODE` updates memories mode without requiring --code-path
- [ ] CLI uses [[config_update_project]] instead of legacy [[edit_project]]
- [ ] Legacy edit_project MCP tool removed from tool registration
- [ ] Both config files stay in sync after edits
- [ ] code_path is optional for project edits (memory-only projects supported)
- [ ] Session note kept current with inline relations to every touched artifact

---

## Verification Checklist

- [ ] Session start protocol complete
- [ ] Work completed
- [ ] Session end protocol complete

---

## Session Start Protocol (BLOCKING)

| Req Level | Step | Status | Evidence |
|---|---|---|---|
| MUST | Initialize Brain MCP | [x] | bootstrap_context returned brain project context |
| MUST | Create session log | [x] | This note created |
| SHOULD | Search relevant memories | [x] | Found 3 open sessions, related SESSION-2026-02-05_01 |
| SHOULD | Verify git status | [x] | main branch, aec5142, 1 modified file |

---

## Key Decisions

- [decision] Remove legacy edit_project MCP tool entirely instead of fixing it #remove-legacy
- [decision] Switch CLI to use config_update_project which already handles v2 config sync #config-sync
- [decision] Make code_path optional; memories_path is the required field (memory-only projects valid) #schema-change

---

## Bug Analysis (Reconnaissance)

### Bug 1: CLI --memories-path silently ignored

- Location: `apps/tui/cmd/projects.go:202`
- `runProjectsRoot` only calls `editProject` when `projectsCodePath != ""`
- Passing `--memories-path CODE` alone falls through to display mode

### Bug 2: MCP schema requires code_path

- Location: `apps/mcp/src/tools/projects/edit/schema.ts:82`
- `required: ["name", "code_path"]` prevents memories-only edits

### Bug 3: edit_project doesn't sync v2 config

- `setCodePath()` writes ONLY to legacy `~/.basic-memory/brain-config.json`
- v2 config at `~/.config/brain/config.json` never updated
- `config_update_project` already handles this correctly

---

## Work Log

- [x] [fact] Reconnaissance complete: identified 3 bugs in project edit flow #bug-analysis
- [x] [fact] Found config_update_project already exists with correct v2 sync #existing-tool
- [x] [complete] Fix CLI to use config_update_project and handle --memories-path standalone #cli
- [x] [complete] Remove legacy edit_project tool from MCP registration #mcp
- [x] [complete] Update error messages in create_project referencing config_update_project #mcp
- [x] [complete] Code review by 4 parallel analysts: all PASS #review
- [x] [complete] QA validation: all tests pass, all 5 acceptance criteria PASS #qa
- [x] [complete] 3 atomic commits: f8a5651 (bugfix), d6b901b (agent config), 7bbf6ce (agent-teams) #git

## Files Touched

### Brain Memory Notes

| Action | Note | Status |
|---|---|---|
| created | [[SESSION-2026-02-06_02-project-edit-config-sync-bugfix]] | IN_PROGRESS |

### Code Files (to be modified)

| File | Context |
|---|---|
| apps/tui/cmd/projects.go | CLI edit flow: flag check + switch to config_update_project |
| apps/mcp/src/tools/index.ts | Remove edit_project registration |
| apps/mcp/src/tools/projects/index.ts | Remove editProject export |
| apps/mcp/src/tools/projects/edit/ | Remove entire directory (legacy tool) |
| apps/mcp/src/tools/projects/create/index.ts | Update error messages |

---

## Observations

- [fact] Session initialized for project edit config sync bugfix #session-lifecycle
- [insight] Two competing tools exist: edit_project (legacy, broken sync) and config_update_project (v2, correct) #technical-debt
- [insight] config_update_project already has optional code_path and proper v2 config handling #existing-solution
- [fact] Previous session SESSION-2026-02-05_01 was also about config sync bugs #pattern

## Relations

- relates_to [[SESSION-2026-02-05_01-config-sync-and-session-create-bug-fixes]]
- relates_to [[ANALYSIS-001-sync-changes-clarification]]
