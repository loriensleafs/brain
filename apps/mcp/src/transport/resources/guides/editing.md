---
name: Editing Notes Guide
description: "REQUIRED READING before modifying existing notes. Complete guide to append, prepend, find_replace, and replace_section operations."
mimeType: text/markdown
priority: 0.9
---

# Editing Notes

**Edit existing notes incrementally without rewriting entire content.**

## Edit Operations

**Available operations**:
- `append`: Add to end of note
- `prepend`: Add to beginning
- `find_replace`: Replace specific text
- `replace_section`: Replace markdown section

## Append Content

**Add to end of note**:

```python
await edit_note(
    identifier="Authentication System",
    operation="append",
    content="""

## New Section

Additional information discovered.

## Observations
- [fact] New security requirement identified #security
""",
    project="main"
)
```

## Prepend Content

**Add to beginning of note**:

```python
await edit_note(
    identifier="Meeting Notes",
    operation="prepend",
    content="""## Update

Important development since meeting.

---

""",
    project="main"
)
```

## Find and Replace

**Replace specific text**:

```python
await edit_note(
    identifier="API Documentation",
    operation="find_replace",
    find_text="http://api.example.com",
    content="https://api.example.com",
    expected_replacements=3,
    project="main"
)
```

## Replace Section

**Replace markdown section by heading**:

```python
await edit_note(
    identifier="Project Status",
    operation="replace_section",
    section="## Current Status",
    content="""## Current Status

Project completed successfully.

All milestones achieved ahead of schedule.
""",
    project="main"
)
```

## Adding Observations Incrementally

```python
await edit_note(
    identifier="API Design",
    operation="append",
    content="""
- [insight] GraphQL reduces API calls by 60% #performance
- [decision] Implement query complexity limiting #security
- [action] Document schema changes weekly #documentation
""",
    project="main"
)
```

## Adding Relations

```python
await edit_note(
    identifier="Authentication System",
    operation="append",
    content="""
- integrates_with [[OAuth Provider]]
- requires [[Rate Limiting Service]]
""",
    project="main"
)
```
