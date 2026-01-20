---
type: task
id: TASK-001
title: Add generateBatchEmbeddings method to OllamaClient
status: todo
priority: P0
complexity: S
estimate: 2h
related:
  - DESIGN-001
  - REQ-001
blocked_by: []
blocks:
  - TASK-002
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
author: spec-generator
tags:
  - ollama
  - batch-api
  - implementation
---

# TASK-001: Add generateBatchEmbeddings Method to OllamaClient

## Design Context

- DESIGN-001: Ollama client batch API integration

## Objective

Add a new `generateBatchEmbeddings` method to the OllamaClient class that uses the Ollama `/api/embed` batch endpoint to generate embeddings for multiple texts in a single HTTP request.

## Scope

**In Scope**:

- Add `generateBatchEmbeddings(texts: string[], model?: string): Promise<number[][]>` method
- Request uses `/api/embed` endpoint with `input: string[]` field
- Response parsing for `embeddings: number[][]` field
- Index alignment validation (output[i] corresponds to input[i])
- Empty input optimization (return empty array without API call)
- Timeout via AbortSignal
- Error handling with OllamaError class
- Update existing `generateEmbedding` to delegate to batch method

**Out of Scope**:

- Concurrency control (handled in TASK-003)
- Timeout configuration changes (handled in TASK-004)
- Embed tool refactoring (handled in TASK-002)
- Integration tests (handled in TASK-005)

## Acceptance Criteria

- [ ] File `apps/mcp/src/services/ollama/client.ts` updated
- [ ] Method signature: `async generateBatchEmbeddings(texts: string[], model: string = "nomic-embed-text"): Promise<number[][]>`
- [ ] Empty input returns `[]` without API call
- [ ] Request payload: `{ model: string, input: string[], truncate: true }`
- [ ] POST request to `${baseUrl}/api/embed`
- [ ] AbortSignal.timeout applied with `this.timeout` value
- [ ] Response type assertion: `data as BatchEmbedResponse`
- [ ] Embedding count validation: `data.embeddings.length === texts.length`
- [ ] Throw OllamaError on HTTP errors with status code
- [ ] Throw OllamaError on embedding count mismatch
- [ ] Existing `generateEmbedding` method delegates to `generateBatchEmbeddings`
- [ ] TypeScript compilation succeeds
- [ ] No linting errors

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/src/services/ollama/client.ts` | Modify | Add generateBatchEmbeddings method |
| `apps/mcp/src/services/ollama/types.ts` | Modify | Add BatchEmbedRequest and BatchEmbedResponse interfaces |

## Implementation Notes

Follow the implementation in DESIGN-001 Component 1 exactly. Key points:

1. **Empty input optimization**:

```typescript
if (texts.length === 0) {
  return [];
}
```

1. **Request structure**:

```typescript
const payload = {
  model,
  input: texts,
  truncate: true,
};
```

1. **Index alignment validation**:

```typescript
if (data.embeddings.length !== texts.length) {
  throw new OllamaError(
    `Embedding count mismatch: expected ${texts.length}, got ${data.embeddings.length}`,
    500
  );
}
```

1. **Backward compatibility**:

```typescript
async generateEmbedding(text: string, model: string = "nomic-embed-text"): Promise<number[]> {
  const [embedding] = await this.generateBatchEmbeddings([text], model);
  return embedding;
}
```

## Testing Requirements

- [ ] Unit test: Empty input returns empty array
- [ ] Unit test: Single text batching
- [ ] Unit test: Multiple texts batching
- [ ] Unit test: HTTP error handling
- [ ] Unit test: Embedding count mismatch error
- [ ] Unit test: Timeout behavior
- [ ] Unit test: Backward compatibility (generateEmbedding delegates)

Testing is covered in TASK-005, but implementer should verify locally before committing.

## Dependencies

- Ollama server version 0.1.26+ with `/api/embed` endpoint
- Bun runtime with fetch API
- Existing OllamaClient class structure
- Existing OllamaError class

## Related Tasks

- TASK-002: Refactor embed tool to use batch API (depends on this task)
- TASK-005: Add unit and integration tests (validates this task)
