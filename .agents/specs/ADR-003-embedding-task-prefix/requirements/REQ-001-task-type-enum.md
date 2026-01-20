---
type: requirement
id: REQ-001
title: Task type enum for embedding prefixes
status: draft
priority: P0
category: functional
epic: EPIC-ADR-003-implementation
related:
  - ADR-003
created: 2026-01-20
updated: 2026-01-20
author: spec-generator
tags:
  - embedding
  - task-type
  - nomic
---

# REQ-001: Task Type Enum for Embedding Prefixes

## Requirement Statement

THE SYSTEM SHALL support "search_document" and "search_query" task types
SO THAT embeddings are contextualized according to Nomic AI vendor specifications.

## Context

Nomic AI documentation for nomic-embed-text requires task instruction prefixes to optimize embedding quality:

- Document embedding: `search_document:` prefix for content being indexed
- Query embedding: `search_query:` prefix for search queries

Current implementation sends raw text without prefixes, violating vendor specifications.

Brain MCP has two distinct use cases:

1. **Embed tool** (`apps/mcp/src/tools/embed/index.ts`): Embeds note content for indexing
2. **Search service** (`apps/mcp/src/services/search/index.ts`): Embeds user queries for search

These require different task types to achieve proper semantic asymmetry.

## Acceptance Criteria

- [ ] TaskType defined as TypeScript union type: `"search_document" | "search_query"`
- [ ] TaskType used in OllamaClient.generateEmbedding signature
- [ ] TaskType used in OllamaClient.generateBatchEmbeddings signature (already implemented in ADR-002)
- [ ] Invalid task types prevented by TypeScript type system
- [ ] Documentation comment explains Nomic AI requirement
- [ ] Code comment includes link to Nomic AI documentation

## Rationale

Type-safe enum prevents runtime errors from typos or incorrect task types. Using TypeScript union types instead of string enum provides:

- Compile-time validation (prevents invalid values)
- IDE autocomplete for valid task types
- Self-documenting code (valid values visible in type definition)
- Zero runtime overhead (types erased during compilation)

Alternative considered: String parameter without type constraint. Rejected because it allows invalid values like "document", "query", "search", causing silent quality degradation.

## Dependencies

- TypeScript compiler for union type support
- Existing OllamaClient class in `apps/mcp/src/services/ollama/client.ts`
- ADR-002 implementation (batch method already has TaskType parameter)

## Related Artifacts

- ADR-003: Embedding Quality: Task Prefix Specification for nomic-embed-text
- REQ-002: Prefix application to embedding text
- DESIGN-001: TaskType parameter flow through embedding pipeline
