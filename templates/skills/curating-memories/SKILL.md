---
name: curating-memories
description: Guidance for maintaining memory quality through curation. Covers updating outdated notes, marking obsolete content, and linking related knowledge. Use when notes need modification, when new information supersedes old, or when building knowledge graph connections.
license: MIT
agents:
  - memory
model: claude-sonnet-4-5
metadata:
  version: 2.0.0
---

# Curating Memories

Active curation keeps the knowledge base accurate and connected. Outdated notes pollute search results and reduce effectiveness.

## Triggers

| Trigger Phrase | Operation |
|----------------|-----------|
| `how do I update a memory` | edit_note with append/replace_section |
| `how do I mark a memory obsolete` | edit_note to add obsolescence marker |
| `how do I link related memories` | edit_note to add relation wikilinks |
| `how do I deduplicate memories` | Curation workflow: search, analyze, merge |
| `how do I clean up stale memories` | Identify and mark obsolete outdated content |

---

## When to Update a Note

Use `edit_note` when:

- Information needs correction or clarification
- Content needs refinement or additional observations
- Relations to other notes need to be added
- A section needs replacement with updated content

```python
# Append new observations to a note
mcp__plugin_brain_brain__edit_note({
  "identifier": "<note title or permalink>",
  "operation": "append",
  "content": "\n- [fact] Updated information about this topic #tag"
})

# Replace a specific section
mcp__plugin_brain_brain__edit_note({
  "identifier": "<note title or permalink>",
  "operation": "replace_section",
  "heading": "Observations",
  "content": "## Observations\n\n- [decision] Revised approach selected #architecture\n- [fact] New constraint discovered #constraint"
})

# Find and replace specific content
mcp__plugin_brain_brain__edit_note({
  "identifier": "<note title or permalink>",
  "operation": "find_replace",
  "content": "old content",
  "replacement": "new content"
})
```

## When to Mark Obsolete

Mark a note obsolete when:

- Note is outdated or contradicted by newer information
- Decision has been reversed or superseded
- Referenced code/feature no longer exists
- Note was created in error

```python
# Add obsolescence marker via append
mcp__plugin_brain_brain__edit_note({
  "identifier": "<note title or permalink>",
  "operation": "append",
  "content": "\n\n## Status\n\n- [decision] OBSOLETE: Superseded by new architecture decision #obsolete\n\n## Relations\n\n- supersedes [[New Decision Note Title]]"
})
```

For notes that should be fully removed:

```python
mcp__plugin_brain_brain__delete_note({
  "identifier": "<note title or permalink>"
})
```

## When to Link Notes

Use `edit_note` to add relations when:

- Concepts are related but not connected via wikilinks
- Building explicit knowledge graph structure
- Connecting decisions to their implementations
- Relating patterns across projects

```python
# Add relations to an existing note
mcp__plugin_brain_brain__edit_note({
  "identifier": "<note title or permalink>",
  "operation": "append",
  "content": "\n- relates_to [[Target Note Title]]\n- implements [[ADR-015 Auth Strategy]]"
})
```

Relations are expressed as wikilinks in the Relations section. Valid relation types: `implements`, `depends_on`, `relates_to`, `extends`, `part_of`, `inspired_by`, `contains`, `pairs_with`, `supersedes`, `leads_to`, `caused_by`.

## Curation Workflow

When creating new notes, check impact on existing knowledge:

### Step 1: Search for Related Notes

```python
mcp__plugin_brain_brain__search({
  "query": "<topic of new note>",
  "mode": "semantic",
  "limit": 5
})
```

### Step 2: Analyze Each Result

For each existing note, determine action:

| Situation | Action |
|-----------|--------|
| Existing note is still accurate | Add relation wikilink to it |
| Existing note has minor gaps | Edit it with edit_note (append) |
| Existing note is now wrong | Mark obsolete, create new note |
| Existing note is partially valid | Create new note, add relations between both |

### Step 3: Execute Curation Plan

Present plan to user before executing:

```text
Curation plan:
- Create: "New Authentication Approach" in decisions/
- Mark obsolete: "Old Auth Pattern" (superseded)
- Add relation: New note -> "Security Requirements" note

Proceed? (y/n)
```

### Step 4: Execute and Report

After user confirms:

1. Create new note via `write_note`
2. Mark obsolete notes via `edit_note` (append obsolescence marker)
3. Add relations via `edit_note` (append wikilinks)
4. Report results with all changes made

## Signs of Poor Curation

Watch for these indicators:

- Multiple similar notes on same topic (deduplicate)
- Notes referencing deleted code (mark obsolete)
- Contradictory notes (resolve conflict)
- Orphaned notes with no relations (consider linking or removing)

---

## When to Use

Use this skill when:

- Existing notes need correction or updated content
- New information supersedes an older note
- Building explicit relations between related knowledge
- Duplicate notes need consolidation
- Referenced code or features no longer exist

Use [exploring-knowledge-graph](../exploring-knowledge-graph/SKILL.md) instead when:

- Traversing relations for comprehensive context
- Investigating cross-project connections

---

## Process

1. Search for the target note using `mcp__plugin_brain_brain__search`
2. Read the note using `mcp__plugin_brain_brain__read_note`
3. Evaluate whether the note needs editing, linking, or marking obsolete
4. Apply the appropriate curation operation via `edit_note`, `write_note`, or `delete_note`
5. Verify the change took effect

---

## Anti-Patterns

| Avoid | Why | Instead |
|-------|-----|---------|
| Deleting notes without checking relations | Breaks wikilinks in other notes | Mark obsolete first, check for incoming relations |
| Creating duplicates of existing notes | Pollutes search results | Search first, edit existing if found |
| Linking everything to everything | Dilutes relationship signal | Link only semantically meaningful connections |
| Skipping user confirmation on curation plans | May obsolete valuable content | Present plan and wait for approval |
| Ignoring orphaned notes | Degrades search quality over time | Periodically review and cull disconnected notes |

---

## Verification

After curation operations:

- [ ] Updated notes reflect accurate current state
- [ ] Obsolete notes have clear reason documented
- [ ] New relations use valid relation types and wikilink format
- [ ] No duplicate notes remain on the same topic
- [ ] Curation changes were confirmed by user before execution
