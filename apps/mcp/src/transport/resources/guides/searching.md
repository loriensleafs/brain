---
name: Search and Context Building Guide
description: "REQUIRED READING before complex searches or building context. Covers search strategies, filtering, and context building with depth control."
mimeType: text/markdown
priority: 0.9
---

# Search and Discovery

**Search is the primary way to discover relevant knowledge.**

## Basic Search

**Simple text search**:

```python
results = await search(
    query="authentication",
    project="main"
)
```

## Advanced Search

**Filter by entity type**:

```python
# Search only specifications
specs = await search(
    query="authentication",
    types=["spec"],
    project="main"
)

# Search decisions and meetings
decisions = await search(
    query="api design",
    types=["decision", "meeting"],
    project="main"
)
```

**Date filtering**:

```python
recent = await search(
    query="api",
    after_date="2025-01-01",
    project="main"
)
```

## Search Strategies

**Broad to narrow**:

```python
# Start broad
all_auth = await search(query="authentication", project="main")

# Narrow down
jwt_auth = await search(
    query="JWT authentication",
    types=["spec", "decision"],
    project="main"
)
```

---

# Building Context

**Context building enables conversation continuity by traversing the knowledge graph.**

## Basic Context Building

```python
context = await build_context(
    url="memory://Authentication System",
    project="main"
)
# Returns: root entity, related entities, connection paths
```

## Depth Control

**Shallow context (depth=1)**: Only immediate connections

```python
shallow = await build_context(
    url="memory://Authentication System",
    depth=1,
    project="main"
)
```

**Deep context (depth=2+)**: Multiple levels of connections

```python
deep = await build_context(
    url="memory://Authentication System",
    depth=2,
    project="main"
)
```

## Timeframe Filtering

```python
# Last 7 days
recent = await build_context(
    url="memory://Authentication System",
    timeframe="7d",
    project="main"
)

# Last month
last_month = await build_context(
    url="memory://Project Planning",
    timeframe="30 days",
    project="main"
)
```
