---
description: Search memories semantically using Brain MCP with multiple search modes for improved results. Use when retrieving specific knowledge or verifying memory existence.
argument-hint: <search-query>
allowed-tools:
  - mcp__plugin_brain_brain__*
---

# Memory Search

Search the Brain knowledge graph for relevant memory notes.

## Your Task

Perform a semantic search using `mcp__plugin_brain_brain__search` with the user's query.

**Query**: $ARGUMENTS

## Search Parameters

Use these parameters for the search:

```text
mcp__plugin_brain_brain__search({
  "query": "<user's search query>",
  "mode": "semantic",
  "limit": 10
})
```

If the query targets a specific domain, add folder filtering:

```text
mcp__plugin_brain_brain__search({
  "query": "<user's search query>",
  "folder": "decisions",
  "limit": 10
})
```

## Response Format

Present results clearly:

1. **Summary**: Brief overview of what was found (or "No relevant notes found")
2. **Primary Results**: For each note show:
   - Title
   - Key content snippet
   - Tags
   - Relations to other notes if relevant
3. **Suggestions**: If results seem incomplete, suggest refining the query or trying a different search mode

## Search Modes

If semantic search returns insufficient results, try:

- **keyword**: `"mode": "keyword"` for exact term matching
- **hybrid**: `"mode": "hybrid"` for combined semantic + keyword

## Example

User: `/memory-search authentication patterns`

You search and respond:

```text
Found 3 notes about authentication patterns:

1. **ADR-012 JWT Authentication**
   JWT middleware using httponly cookies for security...
   Tags: security, authentication
   Relations: implements [[REQ-003 Auth Requirements]]

2. **SKILL-005 OAuth2 Patterns**
   OAuth2 authorization code flow with PKCE...
   Tags: oauth, security, patterns

3. **ANALYSIS-008 Auth Performance**
   Token validation latency analysis...
   Tags: performance, authentication

Related: [[ADR-015 Session Management]]
```
