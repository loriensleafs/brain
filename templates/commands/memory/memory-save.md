---
description: Save current context as a structured memory note in Brain.
argument-hint: [optional guidance for what to save]
allowed-tools:
  - mcp__plugin_brain_brain__*
---

# Save Memory

Create a structured memory note from the current conversation context using Brain MCP.

## Your Task

1. Analyze the conversation for the key insight/decision/pattern to capture
2. Check for existing related notes that might be affected
3. Create the note with proper structure

**User guidance**: $ARGUMENTS

## Pre-Creation: Check for Existing Notes

Before creating, search for related notes:

```text
mcp__plugin_brain_brain__search({
  "query": "<topic of new note>",
  "limit": 5
})
```

Analyze results to determine if the new note would:

- **Supersede** an existing note (create new with `supersedes` relation)
- **Update** an existing note (use `mcp__plugin_brain_brain__edit_note` instead)
- **Complement** existing notes (create new with `relates_to` relations)

## Entity Type Selection

Choose the appropriate entity type based on content:

| Content Type | Entity Type | Folder | Prefix |
|-------------|-------------|--------|--------|
| Architecture decision | decision | decisions/ | ADR- |
| Technical analysis | analysis | analysis/ | ANALYSIS- |
| Feature planning | feature | planning/ | FEATURE- |
| Session summary | session | sessions/ | SESSION- |
| Security finding | security | security/ | SEC- |
| Learned pattern | skill | skills/ | SKILL- |

## Note Structure Requirements

Every note must have:

- **Title**: ALL CAPS prefix + descriptive name (e.g., `ADR-019 Memory Governance`)
- **Observations**: 3-10 categorized facts using `[fact]`, `[decision]`, `[technique]`, etc.
- **Relations**: 2-8 wikilinks to related entities

## Process

1. **Search** existing notes on the topic
2. **Analyze** if this is new knowledge, an update, or supersedes existing
3. **Draft** a note following structure requirements
4. **Present** the draft with curation plan:

   ```text
   Existing notes found:
   - "Previous auth decision" - will be superseded

   Ready to save this note:

   Title: [proposed title]
   Entity Type: [type]
   Folder: [folder]
   Content: [proposed content with observations and relations]

   Curation actions:
   - Create new note
   - Add supersedes relation to existing note

   Confirm? (y/n/edit)
   ```

5. **Execute** the curation plan after user confirms using:

   ```text
   mcp__plugin_brain_brain__write_note({
     "title": "<title>",
     "content": "<structured content>",
     "folder": "<folder>"
   })
   ```

6. **Report** the result

## Quality Thresholds

| Element | Min | Max |
|---------|-----|-----|
| Observations | 3 | 10 |
| Relations | 2 | 8 |
| Tags | 2 | 5 |

## If Content is Too Large

If the concept requires extensive documentation:

1. Create a primary note with key observations
2. Create additional related notes for sub-topics
3. Link them via relations

## Example

User: `/memory-save`

You search existing notes, find related content, and propose:

```text
Found 2 related notes:
- "ADR-005 Plugin Strategy" - OUTDATED by this decision
- "ADR-003 MCP Scope" - Related context

Ready to save this note:

Title: ADR-019 Two-Plugin Architecture
Entity Type: decision
Folder: decisions/
Content:
---
title: ADR-019 Two-Plugin Architecture
type: decision
tags: [architecture, plugin, mcp]
---

# ADR-019 Two-Plugin Architecture

## Observations

- [decision] Two-plugin approach selected: standalone + orchestrator #architecture
- [fact] Claude Code handles duplicate MCP configs via scope hierarchy #mcp
- [technique] Separate concerns between memory and orchestration #design

## Relations

- supersedes [[ADR-005 Plugin Strategy]]
- relates_to [[ADR-003 MCP Scope]]

Curation actions:
- Create new note in decisions/
- Supersedes relation links to ADR-005

Confirm? (y/n/edit)
```
