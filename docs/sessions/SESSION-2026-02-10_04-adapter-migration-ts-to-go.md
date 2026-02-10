---
title: SESSION-2026-02-10_04-adapter-migration-ts-to-go
type: session
permalink: sessions/session-2026-02-10-04-adapter-migration-ts-to-go
tags:
- session
- '2026-02-10'
- adapters
- migration
- go
- cross-platform
---

# SESSION-2026-02-10_04 Adapter Migration TS to Go

**Status:** IN_PROGRESS
**Branch:** main
**Objective:** Migrate TS adapters to Go in `apps/tui/internal/adapters/`. Adapters are CLI concerns (install-time transforms) and belong in Go where the entire CLI lives. Update ADR-002, FEAT-001, and implement Go adapters for Claude Code and Cursor.

---

## Acceptance Criteria

- [ ] [requirement] ADR-002 updated to reflect Go adapter decision #adr
- [ ] [requirement] FEAT-001 updated with adapter migration tasks #planning
- [ ] [requirement] Go Claude Code adapter implemented in apps/tui/internal/adapters/ #implementation
- [ ] [requirement] Go Cursor adapter implemented in apps/tui/internal/adapters/ #implementation
- [ ] [requirement] CLI wired to use Go adapters, bun subprocess removed #integration

---

## Key Decisions

- [decision] Moving TS adapters to Go in apps/tui/internal/adapters/ #adapters #reversal
- [decision] Adapters are CLI concerns (install-time transforms: frontmatter injection, file placement, JSON merge) not runtime concerns #adapters
- [decision] 4 TS files that Go shells out to is inconsistent when the entire CLI is Go #consistency
- [decision] What stays TS: MCP server (apps/mcp/), hook scripts (hooks/scripts/) -- these are runtime, not install-time #scope

## Work Log

- [ ] Update ADR-002 to reflect Go adapter decision
- [ ] Update FEAT-001 with adapter migration tasks
- [ ] Write Go Claude Code adapter
- [ ] Write Go Cursor adapter
- [ ] Wire Go adapters into CLI and remove bun subprocess

## Observations

- [fact] Previous decision in ADR-002 r6 was TS-only adapters with Go CLI shelling out to bun #history
- [insight] CLI consistency argument: adapters do install-time transforms, not runtime logic. Go is the right language for CLI internals #architecture
- [fact] Transform logic (frontmatter injection, file placement, JSON merge) is straightforward Go -- no complex parsing that would benefit from TS ecosystem #complexity
- [insight] Removing bun subprocess from install path simplifies the install experience and removes a runtime dependency #simplification

## Relations

- continues [[SESSION-2026-02-10_03-cross-platform-implementation-phase-3]]
- implements [[ADR-002-cross-platform-plugin-architecture]]
- relates_to [[FEAT-001-cross-platform-portability]]