---
title: SESSION-2026-02-10_agent-canonicalization
type: session
permalink: sessions/session-2026-02-10-agent-canonicalization
tags:
- session
- canonicalization
- agents
- cross-platform
---

# Agent Canonicalization Session

## Observations

- [decision] Strip all YAML frontmatter from canonical agent files; frontmatter values (name, model, memory, color, tools, skills) move to brain.config.json at install time #frontmatter
- [decision] Rename "## Claude Code Tools" sections to "## Available Tools" with generic descriptions #portability
- [decision] Replace mcp__plugin_brain_brain__* function call syntax with "Brain memory tools" generic descriptions #tool-neutral
- [decision] Replace Skill(skill="brain:memory") invocations with "Use Brain memory tools" or "Save to Brain memory" #skill-references
- [decision] Replace "As a subagent" with "As a delegated agent" throughout all agents #delegation-language
- [decision] Orchestrator files are NOT canonicalized to a single portable version; they get two variants because their delegation models are fundamentally different #orchestrator-variants
- [fact] 24 specialist agents canonicalized at agents/ directory; 2 orchestrator variants created as orchestrator-claude.md and orchestrator-cursor.md #file-count
- [fact] Total 26 agent files in agents/ directory after TASK-005 and TASK-006 #total
- [insight] Brain MCP tool names (mcp__plugin_brain_brain__*) work cross-platform but their invocation syntax is tool-specific; canonical agents describe operations generically #cross-platform
- [technique] Used Python script for batch frontmatter stripping and regex-based reference replacement across 15 files simultaneously #automation

## Relations

- implements [[TASK-005-canonicalize-agent-definitions]]
- implements [[TASK-006-create-two-orchestrator-agents]]
- part_of [[FEAT-001 Cross-Platform Portability]]
- relates_to [[DESIGN-005-composable-orchestrator-rules]]
