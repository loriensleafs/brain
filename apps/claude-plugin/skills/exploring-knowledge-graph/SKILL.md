---
name: exploring-knowledge-graph
description: Guidance for deep knowledge graph traversal across notes, observations, and relations. Use when needing comprehensive context before planning, investigating connections between concepts, or answering "what do you know about X" questions.
license: MIT
agents:
  - memory
  - context-retrieval
  - analyst
metadata:
version: 1.0.0
model: claude-sonnet-4-5
---

# Exploring the Knowledge Graph

Brain stores knowledge as an interconnected graph: notes link to other notes via relations, observations capture key facts, and semantic search connects related concepts. Deep exploration reveals context that simple queries miss.

## When to Explore

Explore the knowledge graph when:
- Starting complex work that spans multiple topics
- User asks "what do you know about X"
- Planning requires understanding existing decisions/patterns
- Investigating how concepts connect across projects
- Need comprehensive context, not just top search results

## Exploration Phases

Track visited notes to prevent cycles. Execute phases sequentially.

### Phase 1: Semantic Entry Point
```python
# Brain MCP - search for related notes
mcp__plugin_brain_brain__search_notes({
  "query": "<topic>",
  "limit": 10
})
```

Collect: matching notes with their titles and permalinks.

### Phase 2: Expand Note Details
For key notes, get full content:
```python
# Brain MCP - read note details
mcp__plugin_brain_brain__read_note({
  "identifier": "note-title-or-permalink"
})
```

Extract: observations, relations, `[[wiki-links]]` to other notes.

### Phase 3: Follow Relations
For notes with relations, traverse the graph:
```python
# Read each related note
mcp__plugin_brain_brain__read_note({
  "identifier": "related-note-title"
})
```

Relation types: depends_on, implements, relates_to, supersedes, etc.

### Phase 4: Folder-Based Discovery
Search within specific knowledge folders:
```python
# Search within a folder
mcp__plugin_brain_brain__search_notes({
  "query": "<topic>",
  "folder": "analysis"  # or "research", "decisions", "features"
})
```

### Phase 5: Entity-Linked Notes (If Forgetful MCP Available)
For richer entity management, use Forgetful if available:
```python
# Optional: If Forgetful MCP available
# execute_forgetful_tool("get_entity_memories", {"entity_id": <id>})
```

## Presenting Results

Group findings by type:

**Notes**: Primary (direct matches) → Related (via relations) → Folder-grouped

**Observations**: Key facts extracted from notes

**Relations**: How notes connect (depends_on, implements, relates_to)

**Graph Summary**: Total notes found, key themes, suggested follow-up queries

## Depth Control

- **Shallow** (phases 1-2): Quick context, ~5-15 notes
- **Medium** (phases 1-3): Include related notes via relations
- **Deep** (all phases): Full graph traversal, comprehensive context

Match depth to task complexity. Start shallow, go deeper if context insufficient.

## Efficiency Tips

- Use folder filters to scope exploration to relevant areas
- Follow `[[wiki-links]]` in note content for explicit connections
- Stop expanding when hitting diminishing returns
- Use observations to quickly extract key facts without reading full content
