---
title: ADR-005-config-and-agents-md-decisions
type: decision
permalink: decisions/adr-005-config-and-agents-md-decisions
tags:
- decision
- config
- instructions
- phase-1
---

# ADR-005-config-and-agents-md-decisions

## Observations

- [decision] brain.config.json uses null values for tool exclusion (orchestrator-claude: cursor=null, orchestrator-cursor: claude-code=null) #config
- [fact] 26 total agents: 24 portable (both tools) + 2 tool-specific orchestrators #agents
- [decision] Model assignments: opus for most agents, sonnet for retrospective/skillbook/janitor/devops/pr-comment-responder (matching AGENT-SYSTEM.md model table) #models
- [fact] AGENTS.md at repo root is 200 lines, composing tool-neutral content from protocols/ #instructions
- [decision] AGENTS.md references protocols/ files via links rather than duplicating content #dry
- [fact] brain.config.json populated with all 23 skills, 9 commands, 3 protocols, and hooks config #completeness
- [insight] The config structure allows adapters to read agent mappings and generate tool-specific output at install time #architecture

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- satisfies [[REQ-001-canonical-content-extraction]]
- satisfies [[REQ-002-cross-platform-agent-adaptation]]
- depends_on [[ADR-004-protocol-extraction-decisions]]
