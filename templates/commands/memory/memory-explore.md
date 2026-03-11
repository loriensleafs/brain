---
description: Deep exploration of Brain knowledge graph with entity traversal and relation expansion.
argument-hint: <starting-query>
allowed-tools:
  - mcp__plugin_brain_brain__*
model: opus
---

# Memory Explore

Perform deep knowledge graph traversal using Brain MCP.

**Query**: $ARGUMENTS

## Exploration Strategy

Use Brain MCP tools to explore the knowledge graph deeply:

### Phase 1 - Semantic Entry

```text
mcp__plugin_brain_brain__search({
  "query": "{user query}",
  "mode": "semantic",
  "limit": 10,
  "depth": 2
})
```

Collect all primary results and related entities via relations.

### Phase 2 - Expand Entity Details

For each primary result, read the full note:

```text
mcp__plugin_brain_brain__read_note({
  "identifier": "<note identifier>"
})
```

Extract: relations, observations, tags, and linked entities.

### Phase 3 - Directory Discovery

Browse related folders to find connected content:

```text
mcp__plugin_brain_brain__list_directory({
  "dir_name": "<relevant folder>",
  "depth": 2
})
```

### Phase 4 - Relation Traversal

For each discovered relation, follow wikilinks to connected entities:

```text
mcp__plugin_brain_brain__read_note({
  "identifier": "<linked entity title>"
})
```

### Phase 5 - Broader Search

If initial results are sparse, try keyword and hybrid search modes:

```text
mcp__plugin_brain_brain__search({
  "query": "{broader query terms}",
  "mode": "keyword",
  "limit": 10
})
```

## Output Format

Present results clearly:

```text
## Notes Found

**Primary (N):**
- [Title] - brief content snippet...

**Related via Relations (N):**
- [Title] - connection type...

**Discovered via Traversal (N):**
- [Title] - discovered via [relation]...

## Knowledge Graph Summary
- Total: X notes, Y relations
- Key themes: [identified clusters]
- Suggested follow-up: /memory-explore "[related query]"
```

## If Results Are Sparse

Suggest:

- Broader search terms
- Different folder scope
- Creating new memory notes to build the graph
