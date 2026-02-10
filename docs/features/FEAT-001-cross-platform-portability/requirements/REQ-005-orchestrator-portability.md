---
title: REQ-005-orchestrator-portability
type: requirement
status: implemented
feature-ref: FEAT-001
tags:
- requirement
- orchestrator
- agent-teams
- cursor
permalink: features/feat-001-cross-platform-portability/requirements/req-005-orchestrator-portability
---

# REQ-005 Orchestrator Portability

## Requirement Statement

- [requirement] Two orchestrator agents SHALL exist: one for Claude Code (Agent Teams), one for Cursor (Task tool) #two-versions
- [requirement] All specialist agents SHALL be portable across both tools with identical body content #portable
- [requirement] Only frontmatter SHALL differ between tool-specific agent output #frontmatter-only

## Acceptance Criteria

- [x] [requirement] AC-01: orchestrator-claude.md uses Agent Teams APIs (Teammate, SendMessage, TaskCreate) #claude
- [x] [requirement] AC-02: orchestrator-cursor.md uses Task tool hub-and-spoke pattern (is_background subagents) #cursor
- [x] [requirement] AC-03: Specialist agents (architect, implementer, analyst, qa, etc.) have identical body content across tools #portable
- [x] [requirement] AC-04: brain.config.json maps orchestrator-claude to Claude Code only, orchestrator-cursor to Cursor only #config

## Observations

- [fact] Claude Code Agent Teams provides inter-agent messaging (SendMessage), shared task list, delegation mode #unique
- [fact] Cursor subagents have no inter-agent messaging; parent-only hub-and-spoke #limitation
- [fact] Brain's inter-agent communication is unique across all examined tools (ANALYSIS-014) #differentiation

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- derives_from [[ADR-002 Cross-Platform Plugin Architecture]]
- depends_on [[REQ-002-cross-platform-agent-adaptation]]
