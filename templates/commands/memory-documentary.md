---
description: Generate evidence-based documentary reports by searching across all memory systems
argument-hint: <topic>
allowed-tools: mcp__plugin_brain_brain__*, mcp__context7__*, WebSearch, Grep, Glob, Read, Skill
model: opus
---

# Memory Documentary

ultrathink

Generate evidence-based documentary reports by searching across all memory systems.

## Usage

```bash
/memory-documentary [topic]
```

## Arguments

- `topic` (required): The subject to analyze across memory systems

## Examples

```bash
/memory-documentary "recurring frustrations"
/memory-documentary "coding patterns not codified"
/memory-documentary "evolution of thinking on testing"
/memory-documentary "decisions I second-guessed"
```

## Execution

This command invokes the memory-documentary skill which:

1. Searches Brain MCP for relevant memories and knowledge graph connections
2. Searches docs/ directory artifacts
3. Searches GitHub issues (open and closed)
4. Searches GitHub pull requests (open and closed)
5. Generates documentary-style report with full evidence chains
6. Updates memories with discovered meta-patterns

## Output

Report saved to Brain `analysis/` folder

## Related Commands

- `/memory-search` - Simple memory search
- `/memory-explore` - Knowledge graph traversal
