---
title: TASK-002 Build-Time Version Constant
type: task
status: proposed
feature-ref: FEAT-005
effort: S
permalink: features/feat-005-unified-tool-engine/tasks/task-002-build-time-version-constant
---

# TASK-002 Build-Time Version Constant

## Description

Create `internal/version/version.go` with a build-time injectable `Version` variable defaulting to "dev". Replace the hardcoded `"2.0.0"` in `cmd/install.go` with `version.Version`. Update GoReleaser and Makefile to set the version from the release tag via `-ldflags`.

## Definition of Done

- [ ] [requirement] `internal/version/version.go` exists with `var Version = "dev"` #acceptance
- [ ] [requirement] Hardcoded "2.0.0" in `cmd/install.go` replaced with `version.Version` import #acceptance
- [ ] [requirement] GoReleaser `.goreleaser.yml` updated with `-ldflags` version injection #acceptance
- [ ] [requirement] Makefile updated with VERSION variable and LDFLAGS #acceptance
- [ ] [requirement] `go build` without ldflags produces binary reporting "dev" version #acceptance
- [ ] [requirement] `go build -ldflags "-X .../version.Version=1.2.3"` produces binary reporting "1.2.3" #acceptance

## Observations

- [fact] Status: PROPOSED #status
- [fact] Effort: S #effort
- [task] Independent foundation task with no blockers #sequencing
- [fact] Hardcoded "2.0.0" exists at cmd/install.go:367 #location
- [technique] Standard Go ldflags pattern for build-time version injection #implementation

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | S |
| Human Effort | 1 hour |
| AI-Dominant Effort | 0.25 hours |
| AI Tier | Tier 1 (AI-Dominant) |
| AI Multiplier | 3x |
| AI Effort | 0.33 hours |
| Rationale | Standard Go pattern; AI can generate version.go, update ldflags in Makefile/GoReleaser, and replace the hardcoded string with high confidence |

## Relations

- part_of [[FEAT-005 Unified Tool Engine]]
- implements [[REQ-006 Build-Time Version Constant]]
- relates_to [[ADR-006 Release Workflow and Distribution]]
