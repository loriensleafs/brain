---
name: Best Practices Guide
description: "Comprehensive guidelines for effective knowledge management. Covers structure, naming, categories, relations, and tagging strategies."
mimeType: text/markdown
priority: 0.8
---

# Best Practices

**Guidelines for effective knowledge management.**

## 1. Knowledge Structure

**Every note should have**:
- Clear, descriptive title
- 3-5 observations minimum
- 2-3 relations minimum
- Appropriate categories and tags

## 2. Search Before Creating

**Always search first**:

```python
existing = await search(query="topic name", project="main")

if existing["total"] > 0:
    # Update existing instead of creating duplicate
    await edit_note(
        identifier=existing["results"][0]["permalink"],
        operation="append",
        content=new_information,
        project="main"
    )
else:
    await write_note(...)
```

## 3. Use Exact Entity Titles in Relations

**Wrong**:
```markdown
- relates_to [[auth system]]  # Won't match "Authentication System"
```

**Right**:
```python
results = await search(query="Authentication System", project="main")
exact_title = results["results"][0]["title"]
content = f"## Relations\n- relates_to [[{exact_title}]]"
```

## 4. Meaningful Categories

**Use semantic categories**:
- `[decision]` for choices made
- `[fact]` for objective information
- `[technique]` for methods
- `[requirement]` for needs
- `[insight]` for realizations
- `[problem]` for issues
- `[solution]` for resolutions

**Not generic categories** like `[note]`, `[info]`, `[misc]`

## 5. Descriptive Relation Types

**Use meaningful relation types**:
- `implements` for implementation
- `requires` for dependencies
- `part_of` for hierarchy
- `extends` for enhancement

**Not generic**: Avoid overusing `relates_to`

## 6. Progressive Elaboration

**Build knowledge over time**:
```python
# Session 1: Create foundation
await write_note(title="Topic", content="Basic structure", ...)

# Session 2: Add details
await edit_note(identifier="Topic", operation="append", content="More info", ...)

# Session 3: Add relations
await edit_note(identifier="Topic", operation="append", content="Relations", ...)
```

## 7. Consistent Naming

**Folder structure**:
- specs/ - Specifications
- decisions/ - Decision records
- meetings/ - Meeting notes
- conversations/ - AI conversations
- docs/ - Documentation

## 8. Incremental Updates

**Prefer editing over rewriting**:
```python
# Good: Incremental update
await edit_note(identifier="Note", operation="append", content="New info", ...)

# Avoid: Complete rewrite (unless necessary)
```

## 9. Tagging Strategy

**Use tags strategically**:
- Technology: #python #fastapi
- Domain: #auth #security
- Status: #wip #completed
- Priority: #urgent #important

**Not too many**: 3-5 tags per observation
