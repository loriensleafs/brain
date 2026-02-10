---
title: REQ-001-canonical-content-extraction
type: requirement
status: draft
feature-ref: FEAT-001
tags:
- requirement
- extraction
- phase-1
permalink: features/feat-001-cross-platform-portability/requirements/req-001-canonical-content-extraction
---

# REQ-001 Canonical Content Extraction

## Requirement Statement

- [requirement] All tool-agnostic content (agents, skills, commands, protocols, hooks) SHALL be extracted from `apps/claude-plugin/` to root-level directories #extraction
- [requirement] After extraction, `apps/claude-plugin/` SHALL be removed entirely #removal
- [requirement] No broken references to `apps/claude-plugin/` SHALL remain in the codebase #cleanup
- [requirement] All Brain content SHALL use the `🧠` emoji prefix in filenames for namespacing (e.g., `🧠-memory/SKILL.md`, `🧠-orchestrator.md`, `🧠-start-session.md`) #naming

## Acceptance Criteria

- [ ] [requirement] AC-01: 25 agent definitions exist at `agents/` (23 portable specialists + 2 tool-specific orchestrators) #agents
- [ ] [requirement] AC-02: 27 skill directories exist at `skills/` with Open Agent Skills SKILL.md format #skills
- [ ] [requirement] AC-03: 9 command files exist at `commands/` in canonical Markdown #commands
- [ ] [requirement] AC-04: Protocol files exist at `protocols/` with tool-neutral content #protocols
- [ ] [requirement] AC-05: AGENTS.md exists at repo root as universal instruction file #instructions
- [ ] [requirement] AC-06: `apps/claude-plugin/` directory no longer exists #removal
- [ ] [requirement] AC-07: No broken references to `apps/claude-plugin/` remain in codebase #cleanup
- [ ] [requirement] AC-08: No Go binary required for hook or skill execution #no-binary
- [ ] [requirement] AC-09: All Brain content filenames use `🧠` emoji prefix (skills, agents, commands, rules, hooks) #naming

## Observations

- [fact] Skills use Open Agent Skills standard; zero content transformation needed #portability
- [fact] Commands are Markdown format; zero transformation for Claude Code and Cursor #portability
- [fact] Agent frontmatter needs the most transformation (Claude-specific to canonical) #effort
- [fact] Protocols (174KB) are deeply Claude-specific; need content decomposition #effort
- [fact] Two Go binaries (brain-hooks 3,673 LOC, brain-skills 627 LOC) need JS/TS porting #effort
- [decision] All Brain content uses 🧠 emoji prefix in filenames for immediate identification in tool listings #naming

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- derives_from [[ADR-002 Cross-Platform Plugin Architecture]]
- leads_to [[REQ-002-cross-platform-agent-adaptation]]
