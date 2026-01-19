# Brain Tool Reference

Complete reference for Brain MCP tools. Call directly via the MCP tool interface.

---

## Note Tools

### mcp__plugin_brain_brain__search_notes
Semantic search across notes.

**Required:**
- `query` (str): Natural language search

**Optional:**
- `category` (str): Filter by category
- `tags` (List[str]): Filter by tags
- `project` (str): Filter by project
- `limit` (int): Max results

**Returns:** List of matching notes with relevance scores

```python
mcp__plugin_brain_brain__search_notes({
  "query": "authentication patterns",
  "category": "pattern",
  "limit": 5
})
```

---

### mcp__plugin_brain_brain__read_note
Read a markdown note by title or permalink.

**Required:**
- `identifier` (str): Note title or permalink

**Optional:**
- `project` (str): Project scope
- `page` (int): Page number for pagination (default 1)
- `page_size` (int): Items per page (default 10)

**Returns:** Complete note content with observations and relations

```python
mcp__plugin_brain_brain__read_note({
  "identifier": "jwt-authentication-pattern"
})
```

---

### mcp__plugin_brain_brain__write_note
Create a new note with observations and relations.

**Required:**
- `title` (str): Note title
- `category` (str): Note category (analysis, research, decision, feature, bug, pattern, spec)

**Optional:**
- `observations` (List[str]): Atomic facts about the topic
- `relations` (List[dict]): Links to other notes
- `tags` (List[str]): Categorization tags
- `content` (str): Additional markdown content
- `project` (str): Project scope
- `status` (str): Note status

**Returns:** Created note details

```python
mcp__plugin_brain_brain__write_note({
  "title": "JWT Authentication Pattern",
  "category": "pattern",
  "observations": [
    "Uses httponly cookies for session management",
    "Refresh tokens stored server-side",
    "Access tokens expire in 15 minutes"
  ],
  "relations": [
    {"target": "api-security-decisions", "type": "implements"},
    {"target": "session-management", "type": "relates_to"}
  ],
  "tags": ["security", "auth", "jwt"],
  "project": "my-api"
})
```

---

### mcp__plugin_brain_brain__edit_note
Edit an existing note incrementally without rewriting entire content.

**Preferred over write_note for adding information to existing topics.**

**Required:**
- `identifier` (str): Note title or permalink
- `operation` (str): Edit operation type
- `content` (str): Content to add/replace

**Optional:**
- `project` (str): Project scope
- `find_text` (str): Text to find (for find_replace)
- `section` (str): Section heading (for replace_section)
- `expected_replacements` (int): Expected replacement count (default 1)

**Operations:**
- `append`: Add to end (most common - use for new observations/relations)
- `prepend`: Add to beginning (for urgent updates)
- `find_replace`: Replace specific text
- `replace_section`: Replace markdown section by heading

```python
# Append new observation
mcp__plugin_brain_brain__edit_note({
  "identifier": "jwt-authentication-pattern",
  "operation": "append",
  "content": "\n- Added rate limiting to refresh endpoint"
})

# Replace a section
mcp__plugin_brain_brain__edit_note({
  "identifier": "jwt-authentication-pattern",
  "operation": "replace_section",
  "section": "## Implementation Notes",
  "content": "## Implementation Notes\n\nUpdated implementation details..."
})
```

---

### mcp__plugin_brain_brain__list_notes
List notes with optional filtering.

**Optional:**
- `category` (str): Filter by category
- `project` (str): Filter by project
- `tags` (List[str]): Filter by tags
- `limit` (int): Max results
- `offset` (int): Pagination offset

**Returns:** List of note summaries

```python
mcp__plugin_brain_brain__list_notes({
  "category": "decision",
  "project": "my-api",
  "limit": 10
})
```

---

## Relation Types

Relations connect notes semantically. Use these types:

| Type | Description | Example |
|------|-------------|---------|
| `relates_to` | General connection | Pattern relates to architecture |
| `depends_on` | Technical/logical dependency | Feature depends on spec |
| `implements` | Implementation of design | Code implements spec |
| `supersedes` | Replaces older note | New decision supersedes old |
| `references` | Cites or mentions | Analysis references decision |
| `child_of` | Hierarchical parent-child | Task is child of feature |
| `blocks` | Blocking dependency | Bug blocks feature |
| `caused_by` | Causal relationship | Issue caused by change |

---

## Note Categories

Standard categories for organizing notes:

| Category | Purpose |
|----------|---------|
| `analysis` | Investigation and research findings |
| `research` | Deep exploration of topics |
| `decision` | Architectural and design decisions |
| `feature` | Feature planning and tracking |
| `bug` | Bug investigation and fixes |
| `pattern` | Reusable patterns and practices |
| `spec` | Specifications and requirements |
| `testing` | Test plans and validation |

---

## Progressive Knowledge Building Pattern

Build knowledge incrementally using edit_note:

```python
# 1. Search for existing note on topic
mcp__plugin_brain_brain__search_notes({
  "query": "authentication"
})

# 2. If found, append new observations
mcp__plugin_brain_brain__edit_note({
  "identifier": "existing-auth-note",
  "operation": "append",
  "content": "\n## New Findings\n\n- Discovery 1\n- Discovery 2"
})

# 3. Only create new note if topic is truly distinct
mcp__plugin_brain_brain__write_note({
  "title": "New Distinct Topic",
  "category": "analysis",
  "observations": ["Initial observation"],
  "relations": [
    {"target": "existing-auth-note", "type": "relates_to"}
  ]
})
```

---

## Observation Guidelines

Observations are atomic facts within a note. Each observation should:

**DO:**
- State ONE fact, insight, or finding
- Be self-contained and understandable
- Use clear, specific language
- Include quantifiable data when available

**DON'T:**
- Combine multiple facts in one observation
- Use vague language like "improved" without specifics
- Include temporary/transient information
- Duplicate observations across notes

**Examples:**
```
Good:
- "Response time reduced from 450ms to 120ms after adding index"
- "Uses JWT with httponly cookies for session management"
- "Decided against GraphQL due to caching complexity"

Bad:
- "Made things faster" (vague)
- "Auth stuff" (not atomic)
- "Currently debugging issue X" (transient)
```
