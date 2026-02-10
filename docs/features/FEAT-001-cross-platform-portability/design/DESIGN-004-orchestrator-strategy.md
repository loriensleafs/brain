---
title: DESIGN-004-orchestrator-strategy
type: design
status: implemented
feature-ref: FEAT-001
req-refs:
- REQ-005
tags:
- design
- orchestrator
- agent-teams
- cursor
permalink: features/feat-001-cross-platform-portability/design/design-004-orchestrator-strategy-1
---

# DESIGN-004 Orchestrator Strategy

## Summary

Two orchestrator agents matching each tool's native parallel execution model. Same specialist agents underneath.

## Technical Approach

- [decision] Two separate orchestrator files, not one unified file with adapter transforms #two-files
- [decision] Specialist agents are identical across tools; only frontmatter differs #portable

### Claude Code Orchestrator (orchestrator-claude.md)

Uses Agent Teams:

- Spawns teammates via Task tool with team_name
- Manages shared task list (TaskCreate/Update/List/Get)
- Inter-agent messaging via SendMessage (any-to-any)
- Delegation mode (Shift+Tab)
- Debate/challenge patterns between teammates

### Cursor Orchestrator (orchestrator-cursor.md)

Uses Task tool hub-and-spoke:

- Spawns background subagents (is_background: true)
- Parent reads results when subagents complete
- No inter-subagent messaging (Cursor limitation)
- No shared task list (Cursor limitation)
- File-based state via working directory

### brain.config.json Routing

```json
{
  "orchestrator-claude": {
    "claude-code": { "model": "opus", ... },
    "cursor": null
  },
  "orchestrator-cursor": {
    "claude-code": null,
    "cursor": { "description": "Central coordinator for multi-agent workflows" }
  }
}
```

## Trade-offs Considered

- [decision] Two files vs one with adapter overlay: two files is simpler, each tool gets exactly what it needs #tradeoff
- [fact] Brain's inter-agent communication (SendMessage, shared TaskList) is unique; no other tool provides this #differentiation

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- satisfies [[REQ-005-orchestrator-portability]]
- traces_to [[ADR-002 Cross-Platform Plugin Architecture]]
- traces_to [[ANALYSIS-012-cursor-orchestrator-research]]
- traces_to [[ANALYSIS-014-orchestrator-comparison]]
