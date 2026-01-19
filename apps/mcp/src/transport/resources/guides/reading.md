---
name: Reading and Navigation Guide
description: "Guide to reading notes by identifier, memory:// URLs, pagination, and directory browsing."
mimeType: text/markdown
priority: 0.7
---

# Reading and Navigation

**Reading notes and navigating the knowledge graph is fundamental to building context.**

## Reading by Identifier

**Read by title**:

```python
# Simple title
note = await read_note(
    identifier="Authentication System",
    project="main"
)

# Title in specific folder
note = await read_note(
    identifier="specs/Authentication System",
    project="main"
)
```

**Read by permalink**:

```python
note = await read_note(
    identifier="authentication-system",
    project="main"
)
```

## Reading by memory:// URL

**URL formats**:

```python
# By title
note = await read_note(
    identifier="memory://Authentication System",
    project="main"
)

# By folder and title
note = await read_note(
    identifier="memory://specs/Authentication System",
    project="main"
)

# Wildcards for folder contents
notes = await read_note(
    identifier="memory://specs/*",
    project="main"
)
```

## Pagination

**For long notes, use pagination**:

```python
# First page
page1 = await read_note(
    identifier="Long Document",
    page=1,
    page_size=10,
    project="main"
)

# Second page
page2 = await read_note(
    identifier="Long Document",
    page=2,
    page_size=10,
    project="main"
)
```

## Directory Browsing

**List directory contents**:

```python
# List top-level folders
root = await list_directory(
    dir_name="/",
    project="main"
)

# List specific folder
specs = await list_directory(
    dir_name="specs",
    project="main"
)

# Recursive listing
all_files = await list_directory(
    dir_name="/",
    depth=3,
    project="main"
)

# Filter by pattern
markdown_files = await list_directory(
    dir_name="docs",
    file_name_glob="*.md",
    project="main"
)
```
