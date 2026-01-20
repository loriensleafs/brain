---
type: task
id: TASK-001
title: Add TaskType enum and update OllamaClient signatures
status: todo
priority: P0
complexity: XS
estimate: 10m
related:
  - DESIGN-001
  - REQ-001
  - REQ-002
  - REQ-003
blocked_by: []
blocks:
  - TASK-002
  - TASK-003
assignee: implementer
created: 2026-01-20
updated: 2026-01-20
author: spec-generator
tags:
  - ollama
  - task-type
  - implementation
---

# TASK-001: Add TaskType Enum and Update OllamaClient Signatures

## Design Context

- DESIGN-001: TaskType parameter flow through embedding pipeline

## Objective

Define TaskType union type and add taskType parameter to OllamaClient.generateEmbedding method with default value for backward compatibility.

## Scope

**In Scope**:

- Add `export type TaskType = "search_document" | "search_query";` definition
- Update generateEmbedding signature with taskType parameter
- Apply prefix to text before API call: `${taskType}: ${text}`
- Add JSDoc comment explaining Nomic AI requirement
- Add code comment with link to Nomic AI documentation
- Verify generateBatchEmbeddings already has taskType parameter (ADR-002 coordination)

**Out of Scope**:

- Call site updates (TASK-002)
- Test additions (TASK-003)
- Performance optimization

## Acceptance Criteria

- [ ] TaskType defined at top of `apps/mcp/src/services/ollama/client.ts`
- [ ] JSDoc comment on TaskType references Nomic AI documentation
- [ ] generateEmbedding signature: `async generateEmbedding(text: string, taskType: TaskType = "search_document", model: string = "nomic-embed-text"): Promise<number[]>`
- [ ] Prefix application: `const prefixedText = \`${taskType}: ${text}\`;`
- [ ] prefixedText used in API request body instead of raw text
- [ ] Code comment above prefix line: `// Apply task prefix as required by Nomic AI specification`
- [ ] TypeScript compilation succeeds
- [ ] No linting errors
- [ ] Verification: generateBatchEmbeddings has taskType parameter (from ADR-002)

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/src/services/ollama/client.ts` | Modify | Add TaskType, update generateEmbedding |

## Implementation Notes

**TaskType Definition (top of file)**:

```typescript
/**
 * Task types for Nomic AI embeddings.
 *
 * Required by nomic-embed-text model to contextualize embeddings.
 * - search_document: For content being indexed
 * - search_query: For search queries
 *
 * @see https://www.nomic.ai/blog/posts/nomic-embed-text-v1
 */
export type TaskType = "search_document" | "search_query";
```

**generateEmbedding Update**:

```typescript
async generateEmbedding(
  text: string,
  taskType: TaskType = "search_document",
  model: string = "nomic-embed-text"
): Promise<number[]> {
  // Apply task prefix as required by Nomic AI specification
  const prefixedText = `${taskType}: ${text}`;

  const response = await fetch(`${this.baseUrl}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: prefixedText }),  // Changed: prefixedText instead of text
    signal: AbortSignal.timeout(this.timeout),
  });

  // ... rest of method unchanged
}
```

**Coordination Check**:

Verify generateBatchEmbeddings already has this pattern from ADR-002:

```typescript
async generateBatchEmbeddings(
  texts: string[],
  taskType: TaskType = "search_document",
  model: string = "nomic-embed-text"
): Promise<number[][]> {
  // Prefix each text with task type
  const prefixedTexts = texts.map(t => `${taskType}: ${t}`);
  // ...
}
```

If missing, add following same pattern as single-text method.

## Testing Requirements

Tests are covered in TASK-003. Local verification before commit:

1. TypeScript compilation: `bun run typecheck`
2. Linting: `bun run lint`
3. Manual test: Start MCP server and verify embed command works

## Dependencies

- Existing OllamaClient class structure
- TypeScript 5.x for union type support
- ADR-002 implementation (batch method coordination)

## Related Tasks

- TASK-002: Update call sites (depends on this task)
- TASK-003: Add unit tests (validates this task)
