---
name: using-brain-memory
description: Guidance for using Brain semantic memory effectively. Applies Zettelkasten atomic note principles with observations and relations. Use when deciding whether to query or create notes, structuring note content, or understanding the semantic knowledge graph.
license: MIT
agents:
  - memory
  - context-retrieval
metadata:
  version: 1.0.0
  model: claude-sonnet-4-5
---

# Using Brain Memory

Brain is a semantic knowledge graph built from markdown files using Zettelkasten (atomic note) principles. Files are the source of truth. This skill guides effective memory usage.

## Core Principles

- **Local-First**: Plain text markdown files on user's computer
- **Files are Truth**: Database is derived state, files are source of truth
- **Persistent**: Knowledge survives across sessions
- **Semantic**: Observations and relations create a navigable knowledge graph

## When to Query Memory

Query memory proactively when:

- Starting work on a project (check for existing context)
- User references past work, decisions, or discussions
- Encountering a problem that may have been solved before
- Implementing patterns that may already be documented
- Needing context about preferences or approaches

Use `mcp__plugin_brain_brain__search_notes` with:

- `query`: Natural language search terms
- Optional filters: `category`, `tags`, `project`

### Getting Recent Notes

To see what's been recorded recently:

```
mcp__plugin_brain_brain__list_notes({
  "limit": 10,
  "project": "project-name"
})
```

This is useful when:

- Starting a session on a project you haven't worked on recently
- Reviewing what was captured in previous conversations
- Getting a quick overview of project knowledge

## When to Create Notes

Create notes for knowledge worth preserving:

- Important decisions with rationale
- Technical patterns or approaches
- Architectural choices
- Preferences and workflows
- Project milestones
- Solutions to non-trivial problems
- Bug investigations and root causes

Do NOT create notes for:

- Temporary context (current file paths, transient issues)
- Common knowledge available elsewhere
- Trivial or throwaway information
- Content that changes frequently

## Atomic Note Principles

Each note must pass the atomicity test:

1. Can you understand it at first glance?
2. Can you title it in 5-50 words?
3. Does it represent ONE concept/fact/decision?

### Note Structure

| Component | Purpose |
|-----------|---------|
| Title | Short, searchable phrase |
| Category | Type: analysis, research, decision, feature, bug, pattern |
| Observations | Atomic facts about the topic |
| Relations | Links to other notes (bidirectional) |
| Tags | For categorization and filtering |
| Context | Additional markdown content |

### Observations

Observations are atomic facts within a note. Each observation should:

- State ONE fact, insight, or finding
- Be self-contained and understandable
- Use clear, specific language

Example observations:

```
- "Uses JWT with httponly cookies for session management"
- "Performance degrades above 1000 concurrent connections"
- "Decided against GraphQL due to caching complexity"
```

### Relations

Relations connect notes semantically:

- `relates_to`: General connection between topics
- `depends_on`: Technical or logical dependency
- `implements`: Implementation of a design/spec
- `supersedes`: Replaces an older note
- `references`: Cites or mentions another note

## Query Before Create

Always check for existing notes before creating:

```
mcp__plugin_brain_brain__search_notes({
  "query": "<topic of potential new note>"
})
```

If similar note exists:

- Use `edit_note` with `append` operation to add new observations
- Or create new note with `supersedes` relation if replacing
- Or add `relates_to` relation for connected topics

## Progressive Knowledge Building

Build knowledge incrementally:

1. **Search** for existing note on topic
2. **Append** new observations to existing note
3. **Create** new note only if topic is truly distinct
4. **Link** related notes via relations

Use `mcp__plugin_brain_brain__edit_note` with operations:

- `append`: Add to end (most common for new observations)
- `prepend`: Add to beginning (for urgent updates)
- `find_replace`: Replace specific text
- `replace_section`: Replace markdown section by heading

## Announcing Memory Operations

When creating a note, announce:

```
Saved to memory: "[title]"
   Category: [category]
   Tags: [tags]
   Relations: [linked note titles]
```

When querying, summarize:

```
Found X notes about [topic]:
- [Note 1]: [brief insight]
- [Note 2]: [brief insight]
```

## Content Organization

Notes are organized by:

- **Category**: analysis, research, decision, feature, bug, pattern, spec, etc.
- **Project**: Optional project scope
- **Tags**: Cross-cutting categorization

Example directory structure:

```
notes/
├── analysis/
│   └── topic-slug/
│       └── overview.md
├── decisions/
│   └── decision-slug.md
├── features/
│   └── feature-slug/
│       └── overview.md
└── patterns/
    └── pattern-name.md
```

---

## Tool Quick Reference

### Note Tools

| Tool | Purpose |
|------|---------|
| `mcp__plugin_brain_brain__search_notes` | Semantic search across notes |
| `mcp__plugin_brain_brain__read_note` | Read note by identifier |
| `mcp__plugin_brain_brain__write_note` | Create new note |
| `mcp__plugin_brain_brain__edit_note` | Incremental edit (append, prepend, replace) |
| `mcp__plugin_brain_brain__list_notes` | List notes with filters |

**Full schemas**: See [TOOL_REFERENCE.md](TOOL_REFERENCE.md) for complete parameter details and examples.
