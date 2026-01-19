---
name: Moving and Organizing Guide
description: "REQUIRED READING before moving, reorganizing, or archiving notes. Guide to folder structure and relation preservation during moves."
mimeType: text/markdown
priority: 0.7
---

# Moving and Organizing

**Organize notes by moving them between folders while maintaining knowledge graph integrity.**

## Basic Move

**Move to new folder**:

```python
await move_note(
    identifier="API Documentation",
    destination_path="docs/api/api-documentation.md",
    project="main"
)
```

## Organizing Knowledge

**Create folder structure**:

```python
# Move specs
await move_note("Authentication Spec", "specs/auth/authentication.md", project="main")
await move_note("API Spec", "specs/api/api-spec.md", project="main")

# Move decisions
await move_note("Decision: OAuth", "decisions/oauth-decision.md", project="main")

# Move meetings
await move_note("API Review 2025-01-15", "meetings/2025/01/api-review.md", project="main")
```

**Folder hierarchy**:

```
project/
├── specs/
│   ├── auth/
│   └── api/
├── decisions/
├── meetings/
│   └── 2025/
├── conversations/
└── learnings/
```

## Preserving Relations

**Relations are automatically updated**:

```python
# Before move:
# Note A -> relates_to [[Note B]]
# Note B (folder: root)

# Move Note B
await move_note(
    identifier="Note B",
    destination_path="subfolder/note-b.md",
    project="main"
)

# After move:
# Note A -> relates_to [[Note B]]  <- relation still works!
# Note B (folder: subfolder)
```

## Archiving

**Move to archive folder**:

```python
await move_note(
    identifier="Deprecated Feature",
    destination_path="archive/deprecated/deprecated-feature.md",
    project="main"
)
```
