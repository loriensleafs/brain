---
name: exploring-knowledge-graph
description: Guidance for deep knowledge graph traversal across Brain memory notes, entities, and relationships. Use when needing comprehensive context before planning, investigating connections between concepts, or answering "what do you know about X" questions.
license: MIT
agents:
  - analyst
  - memory
model: claude-sonnet-4-5
metadata:
  version: 2.0.0
---

# Exploring the Knowledge Graph

Brain stores knowledge as an interconnected graph: notes link to other notes via wikilink relations, observations capture categorized facts, and semantic search with depth traversal reveals context that simple queries miss.

## Triggers

| Trigger Phrase | Operation |
|----------------|-----------|
| `what do you know about X` | Full knowledge graph traversal |
| `how do I explore the knowledge graph` | Graph exploration workflow |
| `how are these concepts connected` | Relation traversal via depth parameter |
| `give me comprehensive context on X` | Deep multi-phase exploration |
| `map out related knowledge for X` | Note discovery and relation linking |

---

## When to Explore

Explore the knowledge graph when:

- Starting complex work that spans multiple topics
- User asks "what do you know about X"
- Planning requires understanding existing decisions/patterns
- Investigating how concepts connect across projects
- Need comprehensive context, not just top search results

## Exploration Phases

Track visited note identifiers to prevent cycles. Execute phases sequentially.

### Phase 1: Semantic Entry Point

```python
mcp__plugin_brain_brain__search({
  "query": "<topic>",
  "mode": "semantic",
  "limit": 10
})
```

Collect: primary note results with titles, permalinks, and content previews.

### Phase 2: Expand Note Details

For key notes from Phase 1, get full content including observations and relations:

```python
mcp__plugin_brain_brain__read_note({
  "identifier": "<note title or permalink>"
})
```

Extract: observations (categorized facts), relations (wikilinks to other notes), tags.

### Phase 3: Graph Traversal via Depth Search

Use the depth parameter to traverse the knowledge graph through relations:

```python
mcp__plugin_brain_brain__search({
  "query": "<topic>",
  "mode": "semantic",
  "depth": 2,
  "limit": 10
})
```

Depth levels:
- `depth: 1` - Direct relations (1-hop connections)
- `depth: 2` - Relations of relations (2-hop connections)
- `depth: 3` - Deep traversal (3-hop connections, use sparingly)

### Phase 4: Folder Discovery

Discover related notes by browsing semantic folders:

```python
mcp__plugin_brain_brain__list_directory({
  "dir_name": "decisions",
  "depth": 2
})
```

Key folders to explore: `decisions/`, `analysis/`, `sessions/`, `specs/`, `planning/`, `skills/`

### Phase 5: Synthesize

Group findings by type and present structured results.

## Presenting Results

Group findings by type:

**Notes**: Primary (direct matches) -> Related (via depth traversal) -> Folder-discovered

**Observations**: Key facts, decisions, and insights extracted from notes

**Relations**: Wikilink connections between notes showing how concepts relate

**Graph Summary**: Total notes found, key themes, relation patterns, suggested follow-up queries

## Depth Control

- **Shallow** (phases 1-2): Quick context, ~5-15 notes
- **Medium** (phases 1-4): Include graph traversal and folder discovery
- **Deep** (all phases): Full graph traversal with synthesis

Match depth to task complexity. Start shallow, go deeper if context insufficient.

## When to Use

Use this skill when:

- Starting complex work spanning multiple topics
- User asks "what do you know about X"
- Planning requires understanding existing decisions and patterns
- Investigating how concepts connect across projects

Use [curating-memories](../curating-memories/SKILL.md) instead when:

- Updating, editing, or linking specific notes
- Cleaning up duplicate or stale content

---

## Anti-Patterns

| Avoid | Why | Instead |
|-------|-----|---------|
| Running all 5 phases for simple queries | Wastes tokens on unnecessary traversal | Start shallow (phases 1-2), go deeper only if needed |
| Not tracking visited identifiers | Causes infinite cycles in graph traversal | Maintain a visited set, skip already-seen notes |
| Using depth:3 on broad queries | Exponential blowup on dense graphs | Start with depth:1, increase only if needed |
| Skipping folder discovery when notes reference unknown entities | Misses cross-domain connections | Check list_directory for related folders |
| Presenting raw results without grouping | Overwhelming and unstructured | Group by type: notes, observations, relations |

---

## Verification

After graph exploration:

- [ ] Entry point search returned relevant results
- [ ] No cycles encountered (visited identifiers tracked)
- [ ] Depth matched task complexity (shallow/medium/deep)
- [ ] Results grouped by type for readability
- [ ] Follow-up queries identified if context was insufficient

---

## Efficiency Tips

- Start with `depth: 1` and increase only if needed
- Use `folder` parameter to scope searches to specific domains
- Skip Phase 4 if Phase 3 already found sufficient related notes
- Stop expanding when hitting diminishing returns
