---
title: SESSION-2026-02-10_06-embed-upgrade-install
type: session
status: COMPLETE
permalink: sessions/session-2026-02-10-06-embed-upgrade-install
tags:
- session
- '2026-02-10'
- go-embed
- self-update
- install
---

# SESSION-2026-02-10_06 Embed Templates, Upgrade Command, Install Improvements

**Status:** COMPLETE

**Branch:** feat/embed-upgrade-install

**Starting Commit:** 04d4472 docs: add ANALYSIS-018 CLI self-update research and update session note

**Ending Commit:** 86aa756 docs(session): mark embed-upgrade-install session as complete

**Objective:** Embed templates in Go binary via go:embed, implement brain upgrade self-update, fix version ldflags, add install detection.

---

## Acceptance Criteria

- [x] [requirement] go:embed templates so brain install works from anywhere #go-embed
- [x] [requirement] Fix version ldflags mismatch (main.version vs cmd.Version) #version-fix
- [x] [requirement] brain upgrade command using creativeprojects/go-selfupdate #self-update
- [x] [requirement] brain upgrade --check for version check without download #version-check
- [x] [requirement] brain install detects existing install, prompts to update/skip #install-check
- [x] [requirement] Session note kept current #session

---

## Key Decisions

- [decision] Makefile `embed` target copies templates/ into apps/tui/embedded/ to work around go:embed path constraint (can only embed files within/below module directory) #go-embed
- [decision] TemplateSource abstraction accepts either filesystem paths or embedded fs.FS, enabling --dev flag for local development #architecture
- [decision] creativeprojects/go-selfupdate chosen for upgrade command per [[ANALYSIS-018-cli-self-update-research]] #self-update
- [decision] Install detection checks for .claude/rules/ and .cursor/rules/ containing brain-prefixed files #install-check
- [decision] brain upgrade targets loriensleafs/brain GitHub Releases with checksum verification #distribution

## Work Log

- [x] [outcome] Fixed version ldflags from main.version to cmd.Version (0b5b5cf) #version-fix
- [x] [outcome] Added go-selfupdate dependency and brain upgrade command (671b450) #self-update
- [x] [outcome] Created TemplateSource abstraction and embedded templates via go:embed (4fc4ea1) #go-embed
- [x] [outcome] Added Go adapters for Claude and Cursor with composition engine (4fc4ea1) #go-embed
- [x] [outcome] Added install detection with user prompts (d877fba) #install-check
- [x] [outcome] Created PR #4 for feat/embed-upgrade-install branch #release

## Commits

| SHA | Description | Files |
|---|---|---|
| 0b5b5cf | fix(release): correct version ldflags path in GoReleaser config | 1 |
| 671b450 | feat(cli): add brain upgrade command with go-selfupdate | 3 |
| 4fc4ea1 | feat(tui): embed templates in binary via go:embed for portable install | 12 |
| d877fba | feat(tui): detect existing Brain installation before install | 1 |
| 8c8efb5 | docs(session): add session note for embed/upgrade/install work | 2 |
| 86aa756 | docs(session): mark embed-upgrade-install session as complete | 1 |

---

## Files Touched

### Brain Memory Notes

| Action | Note | Status |
|---|---|---|
| created | [[SESSION-2026-02-10_06-embed-upgrade-install]] | this note |

### Code Files

| File | Context |
|---|---|
| .goreleaser.yml | Fixed ldflags path to cmd.Version |
| Makefile | Added embed target for copying templates |
| apps/tui/.gitignore | Ignore embedded/templates/ (copied at build) |
| apps/tui/cmd/claude.go | Updated to use TemplateSource abstraction |
| apps/tui/cmd/cursor.go | Updated to use TemplateSource abstraction |
| apps/tui/cmd/install.go | Embedded templates, --dev flag, install detection |
| apps/tui/cmd/upgrade.go | New brain upgrade command with go-selfupdate |
| apps/tui/embedded/embed.go | go:embed directive for templates/ |
| apps/tui/go.mod | Added go-selfupdate and transitive deps |
| apps/tui/go.sum | Updated checksums |
| apps/tui/internal/adapters/claude.go | Full Claude Code Go adapter with TemplateSource |
| apps/tui/internal/adapters/compose.go | Composition engine for composable rules |
| apps/tui/internal/adapters/cursor.go | Full Cursor Go adapter with TemplateSource |
| apps/tui/internal/adapters/shared.go | Shared types, YAML parsing, file discovery |
| apps/tui/internal/adapters/source.go | TemplateSource abstraction (filesystem or embedded fs.FS) |

---

## Observations

- [fact] Continuing from [[SESSION-2026-02-10_05-composable-rules-and-release-pipeline]] #continuity
- [fact] Research in [[ANALYSIS-018-cli-self-update-research]] recommends creativeprojects/go-selfupdate #reference
- [fact] Version ldflags targeted main.version but variable is cmd.Version in root.go #bug
- [insight] go:embed can only embed files within or below the Go module directory, requiring a Makefile copy step #go-embed
- [technique] TemplateSource interface abstracts over real filesystem and embedded fs.FS for portable adapters #architecture
- [outcome] 17 files changed, +1614/-68 lines across 6 commits #scope
- [outcome] PR #4 created targeting main branch #release

## Relations

- continues [[SESSION-2026-02-10_05-composable-rules-and-release-pipeline]]
- implements [[ADR-006-release-workflow-and-distribution]]
- relates_to [[ANALYSIS-018-cli-self-update-research]]

---

## Session Start Protocol

| Req Level | Step | Status | Evidence |
|---|---|:---:|---|
| MUST | Initialize Brain MCP | ✅ | bootstrap_context called |
| MUST | Create session log | ✅ | This note |
| SHOULD | Search relevant memories | ✅ | ANALYSIS-018 loaded |
| SHOULD | Verify git status | ✅ | main branch, 04d4472, clean |

## Session End Protocol

| Req Level | Step | Status | Evidence |
|---|---|:---:|---|
| MUST | Update session status to complete | ✅ | Status set to COMPLETE |
| MUST | Update Brain memory | ✅ | Session note fully updated |
| MUST | Run markdownlint | ✅ | Ran before commit |
| MUST | Commit all changes | ✅ | 86aa756 + final commit |
