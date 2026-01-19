---
name: Writing Knowledge Guide
description: "REQUIRED READING before creating decision records, meeting notes, or specs. Complete guide to note creation, observation writing, and templates."
mimeType: text/markdown
priority: 0.9
---

# Writing Knowledge

**Creating rich, well-structured notes is fundamental to building a useful knowledge graph.**

## Basic Note Creation

**Minimal note**:

```python
await write_note(
    title="Quick Note",
    content="# Quick Note\n\nSome basic content.",
    folder="notes",
    project="main"
)
```

**Well-structured note**:

```python
await write_note(
    title="Database Design Decisions",
    content="""# Database Design Decisions

## Context
Documenting our database architecture choices for the authentication system.

## Observations
- [decision] PostgreSQL chosen over MySQL for better JSON support #database
- [technique] Using UUID primary keys instead of auto-increment #design
- [requirement] Must support multi-tenant data isolation #security
- [fact] Expected load is 10K requests/minute #performance
- [insight] UUID keys enable easier horizontal scaling #scalability

## Relations
- implements [[Authentication System Spec]]
- requires [[Database Infrastructure]]
- relates_to [[API Design]]
""",
    folder="architecture",
    tags=["database", "design", "authentication"],
    project="main"
)
```

## Effective Observation Writing

**Good observations are**:
- **Specific**: Avoid vague statements
- **Categorized**: Use appropriate category
- **Tagged**: Add relevant tags
- **Atomic**: One fact per observation
- **Contextual**: Include enough detail

**Examples**:

**Poor observations**:
```markdown
- [fact] We use a database
- [idea] Security is important
- [decision] Made some changes
```

**Good observations**:
```markdown
- [fact] PostgreSQL 14 database runs on AWS RDS with 16GB RAM #infrastructure
- [decision] Implemented rate limiting at 100 requests/minute per user #security
- [technique] Using bcrypt with cost factor 12 for password hashing #cryptography
```

## Note Templates

### Decision Record

```python
await write_note(
    title="Decision: Use GraphQL for API",
    content="""# Decision: Use GraphQL for API

## Context
Evaluating API architecture for new product features.

## Decision
Adopt GraphQL instead of REST for our API layer.

## Observations
- [decision] GraphQL chosen for flexible client queries #api
- [requirement] Frontend needs to minimize round trips #performance
- [technique] Apollo Server for GraphQL implementation #technology
- [insight] GraphQL reduced API calls by 60% in prototype #metrics

## Rationale
- Type safety reduces runtime errors
- Single endpoint simplifies deployment
- Built-in schema documentation

## Consequences
- Team needs GraphQL training
- More complex caching strategy

## Relations
- implements [[API Architecture Plan]]
- requires [[GraphQL Schema Design]]
- affects [[Frontend Development]]
""",
    folder="decisions",
    tags=["decision", "api", "graphql"],
    note_type="decision",
    project="main"
)
```

### Meeting Notes

```python
await write_note(
    title="API Review Meeting 2025-01-15",
    content="""# API Review Meeting 2025-01-15

## Attendees
- Alice (Backend Lead)
- Bob (Frontend Lead)

## Observations
- [decision] Finalized GraphQL schema for user endpoints #api
- [action] Bob to implement Apollo client integration by Friday #task
- [problem] Rate limiting causing issues in staging #bug
- [insight] GraphQL subscriptions reduce polling load significantly #performance

## Action Items
- [ ] Implement rate limiting improvements (Alice)
- [ ] Apollo client setup (Bob)

## Relations
- relates_to [[API Architecture Plan]]
- follows_up [[API Planning Meeting 2025-01-08]]
""",
    folder="meetings",
    tags=["meeting", "api", "team"],
    note_type="meeting",
    project="main"
)
```

### Technical Specification

```python
await write_note(
    title="User Authentication Spec",
    content="""# User Authentication Spec

## Overview
Specification for user authentication system using JWT tokens.

## Observations
- [requirement] Support email/password and OAuth authentication #auth
- [requirement] JWT tokens expire after 24 hours #security
- [technique] Use RS256 algorithm for token signing #cryptography
- [decision] Store refresh tokens in HTTP-only cookies #security

## Technical Details

### Authentication Flow
1. User submits credentials
2. Server validates against database
3. Generate JWT access token
4. Return tokens to client

## Relations
- implemented_by [[Authentication Service]]
- requires [[User Database Schema]]
- part_of [[Security Architecture]]
""",
    folder="specs",
    tags=["spec", "auth", "security"],
    note_type="spec",
    project="main"
)
```
