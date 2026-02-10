---
title: ADR-006-release-workflow-and-distribution
type: note
permalink: decisions/adr-006-release-workflow-and-distribution
tags:
- decision
- release
- ci-cd
- distribution
- goreleaser
---

# ADR-006: Release Workflow and Distribution

## Status

**Proposed** (2026-02-10)

## Context

Brain is a Go CLI + TypeScript MCP server monorepo managed with bun and turbo. The Go CLI binary requires cross-compilation for four targets: darwin/amd64, darwin/arm64, linux/amd64, and linux/arm64. Distribution to end users is via a curl installer (`install.sh`) that downloads pre-built binaries from GitHub Releases.

The project already uses conventional commits and lefthook for git hooks, providing a structured commit history suitable for automated changelog generation.

Previously, no release automation existed. The user evaluated Atlassian Changesets but found it unsuitable for a Go + TypeScript monorepo due to its JavaScript-only orientation and per-PR changeset file requirement.

## Decision

Adopt a three-tool release pipeline: **release-please** for versioning, **GoReleaser** for compilation, and a **curl installer** (`install.sh`) for distribution.

### 1. release-please (Google) for version management

release-please watches the main branch for conventional commits, automatically opens and updates a Release PR containing the version bump and generated CHANGELOG.md. Merging the Release PR creates a git tag and GitHub Release with the changelog body.

### 2. GoReleaser (free edition) for Go binary cross-compilation

GoReleaser triggers on the git tag created by release-please. It cross-compiles the Go CLI for all four targets, generates SHA256 checksums, and uploads the artifacts to the GitHub Release.

### 3. curl installer (install.sh) for end-user distribution

A shell script fetches the latest GitHub Release via the API, detects the user's OS and architecture, downloads the correct binary, and installs it to ~/.local/bin.

### 4. Makefile and package.json for local development only

`make` and `bun run build:cli` build and install the CLI locally. Neither is involved in the release pipeline.

### Workflow

```text
Developer pushes conventional commits to main
        |
        v
release-please opens/updates Release PR (version bump + CHANGELOG.md)
        |
        v  (developer merges PR)
release-please creates git tag + GitHub Release with changelog
        |
        v
GoReleaser triggers on tag, cross-compiles 4 binaries, uploads to release
        |
        v
End user: curl -fsSL .../install.sh | sh  -->  downloads correct binary
```

## Alternatives Considered

### Changesets (Atlassian)
JS/TS only. No Go support. Requires changeset files per PR (developer friction). Conventional commits already encode version intent.

### semantic-release
No native monorepo support. Monorepo plugin abandoned since 2022. Overkill for non-npm publishing.

### GoReleaser Pro
Paid ($100+/yr). Unnecessary when release-please handles versioning free. Can adopt later if independent versioning needed.

### release-it
No native monorepo. No Go support. Better for single-package JS projects.

### knope
Immature (~500 stars). Biome adopted then abandoned it.

### standard-version
Deprecated. Maintainers recommend release-please as successor.

## Consequences

### Positive
- Zero developer friction (conventional commits already enforced)
- Automated changelogs from commit messages
- Reliable Go cross-compilation with SHA256 checksums
- Both tools free and actively maintained (Google + 15.6k star GoReleaser)
- curl installer is industry standard pattern

### Negative
- Two tools to configure (release-please + GoReleaser)
- GoReleaser free does not support monorepo tag prefixes (single version for now)
- curl installer requires maintenance for new OS/arch targets

## Observations

- [decision] release-please + GoReleaser selected for zero-friction release automation #release #ci-cd
- [decision] curl installer (install.sh) for end-user binary distribution #distribution
- [decision] Makefile scoped to local development only, not part of release pipeline #build
- [fact] GoReleaser free does not support monorepo tag prefixes; single version accepted #constraint
- [fact] Six alternatives evaluated and rejected #alternatives
- [insight] Conventional commits already enforced by lefthook, making release-please zero-friction #developer-experience
- [constraint] Go CLI requires cross-compilation for 4 targets #build

## Relations

- relates_to [[ADR-002-cross-platform-plugin-architecture]]
- relates_to [[FEAT-001-cross-platform-portability]]