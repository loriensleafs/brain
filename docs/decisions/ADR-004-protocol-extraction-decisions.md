---
title: ADR-004-protocol-extraction-decisions
type: decision
permalink: decisions/adr-004-protocol-extraction-decisions
tags:
- decision
- protocols
- extraction
- phase-1
---

# ADR-004-protocol-extraction-decisions

## Observations

- [decision] Removed 94 Claude-specific references across 174KB of protocol content #extraction
- [fact] Tool-neutral protocols total 2355 lines vs 3421 original lines (69% ratio) #metrics
- [decision] Replaced Task(subagent_type=...) with generic "invoke agent" language #portability
- [decision] Replaced Skill(skill=...) with "use memory tools" language #portability
- [decision] Replaced mcp__plugin_brain_brain__* with "brain search/write/edit" shorthand #portability
- [decision] Removed .claude/ and .agents/ path references; adapter injects at install time #adapters
- [decision] Replaced Mermaid diagrams with text flow notation (tool-neutral rendering) #portability
- [fact] Worktree isolation and steering system sections removed as Claude Code-specific #scope
- [insight] Agent catalog and workflow patterns are 100% tool-neutral already #portability
- [decision] Model tier mapping uses generic "fast/standard" instead of "sonnet/opus" #portability

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- satisfies [[REQ-001-canonical-content-extraction]]
- enables [[ADR-005-config-and-agents-md-decisions]]
