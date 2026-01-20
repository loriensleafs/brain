---
name: curating-memories
description: Guidance for maintaining memory quality through curation. Covers updating outdated notes, marking obsolete content, and linking related knowledge. Use when notes need modification, when new information supersedes old, or when building knowledge graph connections.
license: MIT
agents:
  - memory
  - skillbook
metadata:
version: 1.0.0
model: claude-sonnet-4-5
---

# Curating Memories

Active curation keeps the knowledge base accurate and connected. Outdated notes pollute search results and reduce effectiveness.

## When to Update a Note

Use `edit_note` when:

- Information needs correction or clarification
- Content needs refinement
- Observations or relations need updating

```python
# Brain MCP - edit existing note
mcp__plugin_brain_brain__edit_note({
  "identifier": "note-title-or-permalink",
  "operation": "append",  # or "prepend", "find_replace", "replace_section"
  "content": "Updated content..."
})
```

Operations: `append` (add to end), `prepend` (add to start), `find_replace`, `replace_section`.

## When to Mark Obsolete

Mark notes as obsolete when:

- Note is outdated or contradicted by newer information
- Decision has been reversed or superseded
- Referenced code/feature no longer exists
- Note was created in error

```python
# Brain MCP - add obsolete marker to note
mcp__plugin_brain_brain__edit_note({
  "identifier": "note-title-or-permalink",
  "operation": "prepend",
  "content": "**[OBSOLETE]** Superseded by: [[new-note-title]]\n\n---\n\n"
})

# Or delete if no longer needed
mcp__plugin_brain_brain__delete_note({
  "identifier": "note-title-or-permalink"
})
```

Add `[OBSOLETE]` prefix to preserve for reference, or delete if no longer needed.

## When to Link Notes

Use relations when:

- Concepts are related but not caught by search
- Building explicit knowledge graph structure
- Connecting decisions to their implementations
- Relating patterns across topics

```python
# Brain MCP - add relations to existing note
mcp__plugin_brain_brain__edit_note({
  "identifier": "source-note-title",
  "operation": "append",
  "content": "\n\n## Relations\n- relates_to: [[target-note-1]]\n- implements: [[target-note-2]]"
})
```

Use wiki-style `[[note-title]]` links in content for navigation.

## Curation Workflow

When creating new notes, check impact on existing knowledge:

### Step 1: Search Related Notes

```python
# Brain MCP - search for related notes
mcp__plugin_brain_brain__search_notes({
  "query": "<topic of new note>",
  "limit": 5
})
```

### Step 2: Analyze Each Result

For each existing note, determine action:

| Situation | Action |
|-----------|--------|
| Existing note is still accurate | Link to it |
| Existing note has minor gaps | Update it |
| Existing note is now wrong | Mark obsolete, create new |
| Existing note is partially valid | Create new, link both |

### Step 3: Execute Curation Plan

Present plan to user before executing:

```
Curation plan:
- Create: "New authentication approach" in analysis/
- Mark obsolete: "Old auth pattern" (add [OBSOLETE] prefix)
- Link: New note → [[Security requirements]]

Proceed? (y/n)
```

### Step 4: Execute and Report

After user confirms:

1. Create new note with `write_note`
2. Mark obsolete notes with `edit_note` (add [OBSOLETE] prefix)
3. Add relation links in content
4. Report results with all changes made

## Signs of Poor Curation

Watch for these indicators:

- Multiple similar notes on same topic (deduplicate)
- Notes referencing deleted code (mark obsolete)
- Contradictory notes (resolve conflict)
- Orphaned notes with no relations (consider linking or removing)

## Semantic Search

Brain uses semantic search to find related notes. Manual linking via `[[note-title]]` is for:

- Explicit relationships search might miss
- Cross-folder connections
- Non-obvious conceptual links
