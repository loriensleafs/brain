---
name: Knowledge Graph Guide
description: "REQUIRED READING before writing ANY note. Covers entities, observations, relations, and forward references."
mimeType: text/markdown
priority: 1.0
---

# Knowledge Graph Fundamentals

**The knowledge graph is built from three core elements: entities, observations, and relations.**

## Entities

**What is an Entity?**
- Any concept, document, or idea represented as a markdown file
- Has a unique title and permalink
- Contains frontmatter metadata
- Includes observations and relations

**Entity Structure**:

```markdown
---
title: Authentication System
permalink: authentication-system
tags: [security, auth, api]
type: note
---

# Authentication System

## Context
Brief description of the entity

## Observations
- [category] Facts about this entity

## Relations
- relation_type [[Other Entity]]
```

**Entity Types**:
- `note`: General knowledge (default)
- `person`: People and contacts
- `project`: Projects and initiatives
- `meeting`: Meeting notes
- `decision`: Documented decisions
- `spec`: Technical specifications

## Observations

**Observations are categorized facts with optional tags.**

**Syntax**: `- [category] content #tag1 #tag2`

**Common Categories**:
- `[fact]`: Objective information
- `[idea]`: Thoughts and concepts
- `[decision]`: Choices made
- `[technique]`: Methods and approaches
- `[requirement]`: Needs and constraints
- `[question]`: Open questions
- `[insight]`: Key realizations
- `[problem]`: Issues identified
- `[solution]`: Resolutions

**Examples**:

```markdown
## Observations
- [decision] Use JWT tokens for authentication #security
- [technique] Hash passwords with bcrypt before storage #best-practice
- [requirement] Support OAuth 2.0 providers (Google, GitHub) #auth
- [fact] Session timeout set to 24 hours #configuration
- [problem] Password reset emails sometimes delayed #bug
- [solution] Implemented retry queue for email delivery #fix
- [insight] 2FA adoption increased security by 40% #metrics
```

**Why Categorize?**:
- Enables semantic search by observation type
- Helps AI understand context and intent
- Makes knowledge more queryable
- Provides structure for analysis

## Relations

**Relations are directional links between entities.**

**Syntax**: `- relation_type [[Target Entity]]`

**Common Relation Types**:
- `relates_to`: General connection
- `implements`: Implementation of spec/design
- `requires`: Dependency relationship
- `extends`: Extension or enhancement
- `part_of`: Hierarchical membership
- `contrasts_with`: Opposite or alternative
- `caused_by`: Causal relationship
- `leads_to`: Sequential relationship

**Examples**:

```markdown
## Relations
- implements [[Authentication Spec v2]]
- requires [[User Database Schema]]
- extends [[Base Security Model]]
- part_of [[API Backend Services]]
- contrasts_with [[API Key Authentication]]
- leads_to [[Session Management]]
```

**Bidirectional Links**:

```markdown
# In "Login Flow" note
## Relations
- part_of [[Authentication System]]

# In "Authentication System" note
## Relations
- includes [[Login Flow]]
```

**Why explicit relation types matter**:
- Enables semantic graph traversal
- AI can understand relationship meaning
- Supports sophisticated context building
- Makes knowledge more navigable

## Forward References

**You can reference entities that don't exist yet:**

```python
# Create note referencing non-existent entity
await write_note(
    title="API Implementation",
    content="""# API Implementation

## Relations
- implements [[API Specification]]
- requires [[Database Models]]
""",
    folder="api",
    project="main"
)
# Creates forward references to "API Specification" and "Database Models"

# Later, create referenced entities - relations auto-resolve!
await write_note(
    title="API Specification",
    content="# API Specification\n...",
    folder="specs",
    project="main"
)
```

**How it works**:
1. Forward reference creates placeholder in knowledge graph
2. When target entity is created, relation is automatically resolved
3. Graph traversal works in both directions
4. No manual linking required
