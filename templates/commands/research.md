---
description: Research external topics, create comprehensive analysis, and incorporate learnings into memory systems
allowed-tools: WebSearch, WebFetch, mcp__plugin_brain_brain__*, Skill
model: opus
---

# Research and Incorporate Command

ultrathink

Research external topics, create comprehensive analysis, and incorporate learnings into memory systems.

## Usage

```text
/research

Topic: {topic name}
Context: {why this matters to the project}
URLs: {optional comma-separated source URLs}
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `Topic` | Yes | Subject to research |
| `Context` | Yes | Why this matters to the project |
| `URLs` | No | Source URLs to fetch and analyze |

## Example

```text
/research

Topic: Chesterton's Fence
Context: Decision-making principle for understanding existing systems before changing them
URLs: https://fs.blog/chestertons-fence/, https://en.wikipedia.org/wiki/G._K._Chesterton
```

## What This Does

1. **Research Phase**: Check existing knowledge, fetch URLs, perform web searches
2. **Analysis Phase**: Write 3000-5000 word analysis to Brain `analysis/` folder
3. **Applicability Phase**: Map integration points with project
4. **Memory Phase**: Create Brain memory notes for decisions, patterns, and atomic learnings
5. **Action Phase**: Create GitHub issue if implementation work identified

## Output

| Artifact | Location |
|----------|----------|
| Analysis document | Brain `analysis/` folder |
| Brain memory notes | Decisions, patterns, and learnings in knowledge graph |
| GitHub issue | Created if implementation work identified |

## Related

- Skill: `.claude/skills/research-and-incorporate/SKILL.md`
- Memory skill: `/memory-search` for retrieving incorporated knowledge
