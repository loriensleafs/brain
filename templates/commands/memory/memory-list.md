---
description: List recent memory notes from Brain with optional folder filtering.
argument-hint: [folder-name]
allowed-tools:
  - mcp__plugin_brain_brain__*
---

# List Memory Notes

Show memory notes from Brain, optionally filtered by folder.

## Your Task

List memory notes using `mcp__plugin_brain_brain__list_directory`.

**Arguments**: $ARGUMENTS

## Parameters

Parse the arguments for:

- **Folder**: If user mentions a folder name (e.g., "decisions", "sessions", "analysis"), use that as `dir_name`
- **Depth**: Default depth of 2 for browsing

Default: `mcp__plugin_brain_brain__list_directory({ "depth": 2 })`

## Response Format

Present notes in a clean, scannable format:

```text
Memory Notes (folder: [folder or root]):

decisions/
  - ADR-001-initial-architecture.md
  - ADR-002-auth-strategy.md

sessions/
  - SESSION-2026-01-15_01-auth-refactor.md
  - SESSION-2026-01-16_01-api-design.md

analysis/
  - ANALYSIS-001-performance-review.md
```

## Optional Enhancements

If the user asks for more detail on any note, use `mcp__plugin_brain_brain__read_note` to retrieve full content.

## Examples

**Basic usage:**

```text
/memory-list
```

Returns top-level directory listing across all folders.

**With folder filter:**

```text
/memory-list decisions
```

Lists all notes in the `decisions/` folder.

**Deep listing:**

```text
/memory-list specs
```

Lists notes in the `specs/` folder with nested structure.
