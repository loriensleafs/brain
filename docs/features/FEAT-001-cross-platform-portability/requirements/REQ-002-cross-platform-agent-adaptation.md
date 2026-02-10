---
title: REQ-002-cross-platform-agent-adaptation
type: requirement
status: implemented
feature-ref: FEAT-001
tags:
- requirement
- agents
- adapters
permalink: features/feat-001-cross-platform-portability/requirements/req-002-cross-platform-agent-adaptation-1
---

# REQ-002 Cross-Platform Agent Adaptation

## Requirement Statement

- [requirement] Canonical agent definitions SHALL have tool-neutral body content with no vendor-specific frontmatter #canonical
- [requirement] TS adapters SHALL transform canonical agents into tool-specific output at install time #adapters
- [requirement] brain.config.json SHALL provide explicit per-agent per-tool values (model, tools, description) #config
- [requirement] Agents with `null` for a tool in brain.config.json SHALL be skipped during that tool's install #filtering

## Acceptance Criteria

- [x] [requirement] AC-01: Canonical agents have no vendor-specific YAML frontmatter #frontmatter
- [x] [requirement] AC-02: Claude Code adapter generates valid .claude/agents/ output with model, allowed_tools, skills fields #claude
- [x] [requirement] AC-03: Cursor adapter generates valid .cursor/agents/🧠-*.md output with description field and 🧠 prefix #cursor
- [x] [requirement] AC-04: brain.config.json contains per-agent per-tool mappings for all 25 agents #config
- [x] [requirement] AC-05: Tool-specific orchestrators (orchestrator-claude, orchestrator-cursor) excluded from wrong tool #filtering
- [x] [requirement] AC-06: All generated agent filenames use `🧠-{name}.md` pattern #naming

## Observations

- [fact] 14 of 25 agents need no tool-specific content beyond frontmatter #portability
- [fact] 22 of 25 agents contain Claude-specific refs in body text (298 total) that need canonicalization #effort
- [fact] Orchestrator is most coupled: 85 Claude-specific refs across 2,312 lines #complexity

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- derives_from [[ADR-002 Cross-Platform Plugin Architecture]]
- depends_on [[REQ-001-canonical-content-extraction]]
