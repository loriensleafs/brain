---
title: TASK-004-extract-protocols-to-root
type: task
status: complete
feature-ref: FEAT-001
effort-estimate-human: 6h
effort-estimate-ai: 2h
milestone: phase-1
tags:
- task
- phase-1
- protocols
- extraction
permalink: features/feat-001-cross-platform-portability/tasks/task-004-extract-protocols-to-root
---

# TASK-004 Extract Protocols to Root

## Description

- [fact] Move protocol files from `apps/claude-plugin/instructions/protocols/` to root `protocols/` #extraction
- [fact] Files: AGENT-SYSTEM.md (48KB), AGENT-INSTRUCTIONS.md (19KB), SESSION-PROTOCOL.md (39KB) #scope
- [fact] Audit protocol content for Claude-specific references (52 total across 174KB instruction system) #audit
- [fact] Separate tool-neutral content (agent personas, workflow patterns, quality standards) from tool-specific content (Agent Teams APIs, tool paths, MCP tool names) #decomposition
- [fact] Tool-specific content handled by adapter injection at install time #adapters

## Definition of Done

- [x] [requirement] Protocol files exist at root `protocols/` with tool-neutral content #structure
- [x] [requirement] Tool-specific sections identified and documented for adapter injection #adaptation
- [x] [requirement] No broken references to `apps/claude-plugin/instructions/protocols/` #cleanup

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 2 (AI-Assisted) |
| Human Estimate | 6h |
| AI-Assisted Estimate | 2h |
| Rationale | Content decomposition requires analysis of 174KB across 5 files; Claude-specific refs need identification |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-001-create-root-level-directory-scaffold]]
- enables [[TASK-007-create-brain-config-and-agents-md]]
- satisfies [[REQ-001-canonical-content-extraction]]
