---
name: Recording Conversations Guide
description: "Guide for capturing discussions in memory. Covers what to record, templates, and building on past conversations."
mimeType: text/markdown
priority: 0.8
---

# Recording Conversations

**Capturing conversations in memory enables long-term context and knowledge accumulation.**

## What to Record

**Good candidates for recording**:

### 1. Decisions and Rationales

```python
await write_note(
    title="Decision: GraphQL vs REST",
    content="""# Decision: GraphQL vs REST

## Context
User asked about API architecture choice.

## Decision
Chose GraphQL for new features, maintain REST for legacy.

## Observations
- [decision] GraphQL for flexibility and performance #api
- [requirement] Mobile app needs efficient data loading #mobile
- [fact] REST API has 50K existing clients #legacy
- [insight] Hybrid approach minimizes migration risk #strategy

## Relations
- implements [[API Modernization Plan]]
- affects [[Mobile Development]]
""",
    folder="decisions",
    project="main"
)
```

### 2. Important Discoveries

```python
await write_note(
    title="Discovery: Database Performance Issue",
    content="""# Discovery: Database Performance Issue

## Observations
- [problem] Login queries taking 2-3 seconds #performance
- [insight] Missing index on users.email column #database
- [solution] Added index, login now <100ms #fix
- [technique] Used EXPLAIN ANALYZE to identify bottleneck #debugging

## Relations
- relates_to [[User Authentication]]
- caused_by [[Database Schema Migration]]
""",
    folder="troubleshooting",
    project="main"
)
```

### 3. Action Items and Plans

```python
await write_note(
    title="Plan: API v2 Migration",
    content="""# Plan: API v2 Migration

## Observations
- [plan] Phased migration over 3 months #roadmap
- [action] Create GraphQL schema this week #task
- [action] Implement parallel APIs next month #task
- [decision] Deprecate v1 after 6-month notice #timeline

## Relations
- implements [[API Modernization Strategy]]
- requires [[GraphQL Schema Design]]
""",
    folder="planning",
    project="main"
)
```

## Building on Past Conversations

**Reference previous discussions**:

```python
# 1. Search for related past conversations
past = await search(
    query="API authentication",
    types=["conversation", "decision"],
    project="main"
)

# 2. Build context
context = await build_context(
    url=f"memory://{past['results'][0]['permalink']}",
    depth=2,
    timeframe="30d",
    project="main"
)

# 3. Link new note to previous
await write_note(
    title="Refresh Token Implementation",
    content="""# Refresh Token Implementation

## Relations
- builds_on [[Conversation: API Authentication]]
- implements [[JWT Authentication Decision]]
""",
    folder="implementation",
    project="main"
)
```
