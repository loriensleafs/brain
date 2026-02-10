---
permalink: sessions/session-2026-02-10-06-embed-upgrade-install
---

---

title: SESSION-2026-02-10_06-embed-upgrade-install

type: session

status: IN_PROGRESSpermalink: sessions/session-2026-02-10-06-embed-upgrade-install

tags:

- session
- '2026-02-10'
- go-embed
- self-update
- install

---

# SESSION-2026-02-10_06 Embed Templates, Upgrade Command, Install Improvements

**Status:** IN_PROGRESS

**Branch:** feat/embed-upgrade-install

**Starting Commit:** 04d4472 docs: add ANALYSIS-018 CLI self-update research and update session note

**Ending Commit:** TBD

**Objective:** Embed templates in Go binary via go:embed, implement brain upgrade self-update, fix version ldflags, add install detection.

---

## Acceptance Criteria

- [ ] [requirement] go:embed templates so brain install works from anywhere #go-embed
- [ ] [requirement] Fix version ldflags mismatch (main.version vs cmd.Version) #version-fix
- [ ] [requirement] brain upgrade command using creativeprojects/go-selfupdate #self-update
- [ ] [requirement] brain upgrade --check for version check without download #version-check
- [ ] [requirement] brain install detects existing install, prompts to update/skip #install-check
- [ ] [requirement] Session note kept current #session

---

## Key Decisions

(Decisions made during this session will be recorded here.)

## Work Log

- [ ] [pending] Fix version ldflags mismatch #version-fix
- [ ] [pending] Embed templates via go:embed #go-embed
- [ ] [pending] Add go-selfupdate dependency #self-update
- [ ] [pending] Implement brain upgrade command #self-update
- [ ] [pending] Implement brain upgrade --check #version-check
- [ ] [pending] Add install detection to brain install #install-check

## Commits

| SHA | Description | Files |
| --- | ----------- | ----- |

---

## Files Touched

### Brain Memory Notes

| Action  | Note                                            | Status    |
| ------- | ----------------------------------------------- | --------- |
| created | [[SESSION-2026-02-10_06-embed-upgrade-install]] | this note |

### Code Files

| File | Context |
| ---- | ------- |

---

## Observations

- [fact] Continuing from [[SESSION-2026-02-10_05-composable-rules-and-release-pipeline]] #continuity
- [fact] Research in [[ANALYSIS-018-cli-self-update-research]] recommends creativeprojects/go-selfupdate #reference
- [fact] Version ldflags targets main.version but variable is cmd.Version in root.go #bug

## Relations

- continues [[SESSION-2026-02-10_05-composable-rules-and-release-pipeline]]
- implements [[ADR-006-release-workflow-and-distribution]]
- relates_to [[ANALYSIS-018-cli-self-update-research]]

---

## Session Start Protocol

| Req Level | Step                     | Status | Evidence                    |
| --------- | ------------------------ | :----: | --------------------------- |
| MUST      | Initialize Brain MCP     |   ✅   | bootstrap_context called    |
| MUST      | Create session log       |   ✅   | This note                   |
| SHOULD    | Search relevant memories |   ✅   | ANALYSIS-018 loaded         |
| SHOULD    | Verify git status        |   ✅   | main branch, 04d4472, clean |

## Session End Protocol

| Req Level | Step                              | Status | Evidence |
| --------- | --------------------------------- | :----: | -------- |
| MUST      | Update session status to complete |        |          |
| MUST      | Update Brain memory               |        |          |
| MUST      | Run markdownlint                  |        |          |
| MUST      | Commit all changes                |        |          |
