---
title: ANALYSIS-018-cli-self-update-research
type: note
permalink: analysis/analysis-018-cli-self-update-research
tags:
- analysis
- self-update
- upgrade
- go-selfupdate
- distribution
---

# ANALYSIS-018 CLI Self-Update Research

## Observations

- [decision] Use creativeprojects/go-selfupdate library for binary self-update #self-update
- [decision] Two-tier upgrade: brain upgrade (binary) + brain install (plugins) as separate operations #architecture
- [decision] Version notification on brain --version with 24h cached check #ux
- [fact] go-selfupdate handles cross-platform binary replacement, checksums, rollback #library
- [fact] GoReleaser already produces checksums.txt compatible with go-selfupdate #compatibility
- [fact] Binary naming brain-{os}-{arch} is compatible with go-selfupdate detection #naming
- [fact] Version ldflags mismatch: goreleaser targets main.version but variable is cmd.Version #bug
- [insight] gh CLI deliberately chose NOT to self-update, relying on package managers instead #alternative
- [insight] Separate binary upgrade from plugin upgrade keeps concerns clean #architecture
- [technique] Atomic binary replacement: write temp file + os.Rename() on Unix, rename-aside on Windows #implementation

## Next Steps

- P0: Fix version ldflags mismatch (30 min)
- P0: Add go-selfupdate dependency (1-2 days)
- P1: Implement brain upgrade command
- P1: Implement brain upgrade --check
- P1: Version notification on brain --version
- P2: go:embed templates so brain install works from anywhere

## Relations

- relates_to [[ADR-006-release-workflow-and-distribution]]
- relates_to [[FEAT-001-cross-platform-portability]]