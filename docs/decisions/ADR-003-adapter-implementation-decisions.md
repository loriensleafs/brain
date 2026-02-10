---
title: ADR-003-adapter-implementation-decisions
type: decision
permalink: decisions/adr-003-adapter-implementation-decisions
tags:
- adapter
- install
- claude-code
- implementation
---

# ADR-003-adapter-implementation-decisions

## Observations

- [decision] TS adapter uses minimal YAML parser instead of full yaml library to avoid dependencies #adapter
- [decision] sync.ts supports --json flag for Go CLI consumption (structured output) #cli-integration
- [decision] sync.ts supports --dry-run for previewing what would be generated #developer-experience
- [decision] Claude Code install uses two-stage: adapter writes to staging dir, then symlinks to plugin dirs #staging
- [decision] Install manifest stored at ~/.cache/brain/manifest-{tool}.json for deterministic uninstall #manifest
- [decision] brain claude launcher runs fresh adapter staging on every launch for always-current content #freshness
- [decision] Agent Teams variant swap done by direct symlink replacement after adapter staging #variant-swap
- [fact] Old brain plugin install/uninstall commands removed, replaced by brain install/uninstall #cleanup
- [fact] Old findPluginSource() and variantSwaps removed from claude.go #cleanup
- [fact] plugin.go retained as utility file for symlinkPluginContent, symlinkDir, registerMarketplace #shared-utils
- [insight] huh v0.8.0 works well for interactive CLI forms in Go, integrates cleanly with existing bubbletea usage #tooling

## Relations

- implements [[TASK-010-create-ts-claude-code-adapter]]
- implements [[TASK-011-implement-brain-install-uninstall]]
- implements [[TASK-012-refactor-brain-claude-launcher]]
- traces_to [[ADR-002-cross-platform-plugin-architecture]]
- traces_to [[DESIGN-001-adapter-architecture]]