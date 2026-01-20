---
type: requirement
id: REQ-002
title: Apply task-appropriate prefix to embedding text
status: implemented
priority: P0
category: functional
epic: EPIC-ADR-003-implementation
related:
  - ADR-003
  - REQ-001
created: 2026-01-20
updated: 2026-01-20
author: spec-generator
tags:
  - embedding
  - prefix
  - nomic
---

# REQ-002: Apply Task-Appropriate Prefix to Embedding Text

## Requirement Statement

WHEN generating embeddings for text,
THE SYSTEM SHALL prepend the task type prefix ("search_document:" or "search_query:") to the text before sending to Ollama API
SO THAT embeddings are optimized according to Nomic AI vendor specifications.

## Context

Nomic AI nomic-embed-text model requires task instruction prefixes for optimal embedding quality. The model uses these prefixes to contextualize embeddings based on intended use:

- `search_document:` - For content being indexed (symmetric embedding)
- `search_query:` - For search queries (asymmetric embedding with document)

Without prefixes, embeddings lack semantic context and quality degrades per vendor specification.

Current implementation in `apps/mcp/src/services/ollama/client.ts` line 35 sends raw text:

```typescript
body: JSON.stringify({ model, prompt: text })
```

This violates Nomic AI specification for task prefix requirement.

## Acceptance Criteria

- [ ] Text prefixed with `${taskType}:` format before API request
- [ ] Embed tool uses "search_document:" prefix for note content
- [ ] Search service uses "search_query:" prefix for user queries
- [ ] Prefix applied in OllamaClient.generateEmbedding method
- [ ] Prefix applied to each text in OllamaClient.generateBatchEmbeddings method
- [ ] Original text preserved (no mutation of input parameter)
- [ ] Prefix construction: template literal `${taskType}: ${text}`
- [ ] Whitespace handling: Single space after colon

## Rationale

Centralizing prefix application in OllamaClient ensures:

- Single point of change (DRY principle)
- All callers benefit automatically
- Prefix format consistency across single and batch APIs
- Clear ownership (OllamaClient knows Ollama/Nomic requirements)

Alternative considered: Apply prefix at call sites (embed tool, search service). Rejected because it increases risk of missed call sites and prefix format inconsistency.

## Dependencies

- REQ-001: TaskType enum must be defined
- OllamaClient.generateEmbedding method signature updated
- OllamaClient.generateBatchEmbeddings method signature updated (ADR-002)

## Related Artifacts

- ADR-003: Embedding Quality: Task Prefix Specification for nomic-embed-text
- REQ-001: Task type enum for embedding prefixes
- DESIGN-001: TaskType parameter flow through embedding pipeline
- Analysis 030: Markdown sanitization for embeddings (task prefix research)
