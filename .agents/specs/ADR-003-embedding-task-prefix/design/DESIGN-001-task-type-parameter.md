---
type: design
id: DESIGN-001
title: TaskType parameter flow through embedding pipeline
status: draft
priority: P0
related:
  - REQ-001
  - REQ-002
  - REQ-003
adr: ADR-003
created: 2026-01-20
updated: 2026-01-20
author: spec-generator
tags:
  - embedding
  - task-type
  - parameter-flow
---

# DESIGN-001: TaskType Parameter Flow Through Embedding Pipeline

## Requirements Addressed

- REQ-001: Task type enum for embedding prefixes
- REQ-002: Apply task-appropriate prefix to embedding text
- REQ-003: Backward compatibility with default task type

## Design Overview

This design adds TaskType parameter to OllamaClient embedding methods and updates two call sites to specify appropriate task types. The implementation is minimal because ADR-002 already established the pattern for batch embeddings.

**Key Principle**: TaskType flows from call site → OllamaClient → Ollama API with prefix application centralized in OllamaClient.

**Scope**: This is a quick fix (20 minutes estimated effort) building on ADR-002 foundation. The design focuses on parameter propagation and prefix application without introducing architectural complexity.

## Component Architecture

### Component 1: TaskType Definition

**Purpose**: Provide type-safe enumeration of valid task types.

**Responsibilities**:

- Define valid task type values
- Enable TypeScript compile-time validation
- Document task type semantics

**Interface**:

```typescript
/**
 * Task types for Nomic AI embeddings.
 *
 * Required by nomic-embed-text model to contextualize embeddings.
 * See: https://www.nomic.ai/blog/posts/nomic-embed-text-v1
 */
export type TaskType = "search_document" | "search_query";
```

**File Location**: `apps/mcp/src/services/ollama/client.ts` (top of file)

---

### Component 2: OllamaClient.generateEmbedding Update

**Purpose**: Add TaskType parameter to single-text embedding method.

**Current Signature**:

```typescript
async generateEmbedding(
  text: string,
  model: string = "nomic-embed-text"
): Promise<number[]>
```

**New Signature**:

```typescript
async generateEmbedding(
  text: string,
  taskType: TaskType = "search_document",
  model: string = "nomic-embed-text"
): Promise<number[]>
```

**Implementation**:

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
    body: JSON.stringify({ model, prompt: prefixedText }),
    signal: AbortSignal.timeout(this.timeout),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new OllamaError(
      `Ollama embed error: ${response.status} - ${errorText}`,
      response.status
    );
  }

  const data = (await response.json()) as { embedding: number[] };
  return data.embedding;
}
```

**Key Changes**:

1. Add `taskType` parameter with default value
2. Construct `prefixedText` using template literal
3. Pass `prefixedText` instead of raw `text` to API

**File Location**: `apps/mcp/src/services/ollama/client.ts`

---

### Component 3: OllamaClient.generateBatchEmbeddings Update (Coordination)

**Purpose**: Verify batch method already has TaskType parameter from ADR-002.

**Expected Signature (from ADR-002)**:

```typescript
async generateBatchEmbeddings(
  texts: string[],
  taskType: TaskType = "search_document",
  model: string = "nomic-embed-text"
): Promise<number[][]>
```

**Coordination Requirement**: ADR-002 implementation MUST have included TaskType parameter. This design assumes that requirement was met during ADR-002 implementation.

**Verification**:

- [ ] Check `apps/mcp/src/services/ollama/client.ts` for taskType parameter
- [ ] Verify prefix application: `texts.map(t => \`${taskType}: ${t}\`)`

If TaskType parameter is missing from batch method, implementer MUST add it following the same pattern as single-text method.

---

### Component 4: Embed Tool Call Site Update

**Purpose**: Specify "search_document" task type for note content embedding.

**Current Code** (`apps/mcp/src/tools/embed/index.ts`):

```typescript
// Location varies based on ADR-002 implementation
// May be single calls or batch call
const embedding = await ollamaClient.generateEmbedding(chunk.text);
```

**New Code**:

```typescript
const embedding = await ollamaClient.generateEmbedding(
  chunk.text,
  "search_document"  // Explicit for clarity
);
```

**Rationale**: Even though "search_document" is the default, explicit specification improves code clarity and prevents confusion if defaults change.

**File Location**: `apps/mcp/src/tools/embed/index.ts`

---

### Component 5: Search Service Call Site Update

**Purpose**: Specify "search_query" task type for user search queries.

**Current Code** (`apps/mcp/src/services/search/index.ts` around line 388):

```typescript
const queryEmbedding = await ollamaClient.generateEmbedding(query);
```

**New Code**:

```typescript
const queryEmbedding = await ollamaClient.generateEmbedding(
  query,
  "search_query"  // Critical: different from document embedding
);
```

**Rationale**: This is the PRIMARY reason for ADR-003. Query embeddings require different prefix than document embeddings to achieve semantic asymmetry per Nomic AI specification.

**File Location**: `apps/mcp/src/services/search/index.ts`

---

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Type definition** | TypeScript union type | Compile-time validation, zero runtime cost |
| **Default value** | "search_document" | Matches majority use case (embed tool) |
| **Parameter order** | taskType before model | Frequently changed (taskType) before rarely changed (model) |
| **Prefix format** | `${taskType}: ${text}` | Matches Nomic AI specification exactly |
| **Coordination** | Reuse ADR-002 pattern | Consistency between single and batch APIs |

## Data Flow Diagram

```
┌─────────────────┐
│  Embed Tool     │
│  (documents)    │
└────────┬────────┘
         │ "search_document"
         ▼
┌─────────────────────────────┐
│  OllamaClient               │
│  .generateEmbedding()       │
│  - Accepts taskType param   │
│  - Applies prefix           │
│  - Sends to Ollama          │
└─────────────────────────────┘
         │ "search_document: {text}"
         ▼
┌─────────────────┐
│  Ollama API     │
│  /api/embeddings│
└─────────────────┘

┌─────────────────┐
│  Search Service │
│  (queries)      │
└────────┬────────┘
         │ "search_query"
         ▼
┌─────────────────────────────┐
│  OllamaClient               │
│  .generateEmbedding()       │
│  - Accepts taskType param   │
│  - Applies prefix           │
│  - Sends to Ollama          │
└─────────────────────────────┘
         │ "search_query: {query}"
         ▼
┌─────────────────┐
│  Ollama API     │
│  /api/embeddings│
└─────────────────┘
```

## Security Considerations

- **Input validation**: TaskType restricted by TypeScript union type (no runtime validation needed)
- **Injection risk**: None (task type values are hardcoded literals)
- **Error messages**: Do not expose text content in error messages
- **Prefix overhead**: Negligible (string concatenation is O(n) but text is already in memory)

## Testing Strategy

### Unit Tests

**File**: `apps/mcp/src/services/ollama/__tests__/client.test.ts`

```typescript
describe("OllamaClient.generateEmbedding with taskType", () => {
  it("should include search_document prefix", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
    });
    global.fetch = mockFetch;

    const client = new OllamaClient();
    await client.generateEmbedding("test text", "search_document");

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.prompt).toBe("search_document: test text");
  });

  it("should include search_query prefix", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
    });
    global.fetch = mockFetch;

    const client = new OllamaClient();
    await client.generateEmbedding("test query", "search_query");

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.prompt).toBe("search_query: test query");
  });

  it("should default to search_document when taskType omitted", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
    });
    global.fetch = mockFetch;

    const client = new OllamaClient();
    await client.generateEmbedding("test text"); // No taskType

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.prompt).toBe("search_document: test text");
  });
});
```

### Integration Tests

**File**: `apps/mcp/src/services/embedding/__tests__/integration.test.ts`

```typescript
describe("Embedding Integration with TaskType", () => {
  it("embed tool uses search_document task type", async () => {
    // Test that embed tool correctly specifies document task type
    // Requires spy on OllamaClient.generateEmbedding
  });

  it("search service uses search_query task type", async () => {
    // Test that search service correctly specifies query task type
    // Requires spy on OllamaClient.generateEmbedding
  });
});
```

## Implementation Complexity

**Estimated Effort**: 20 minutes

**Breakdown**:

- Add TaskType definition: 2 minutes
- Update generateEmbedding signature: 3 minutes
- Update prefix application logic: 5 minutes
- Update embed tool call site: 3 minutes
- Update search service call site: 3 minutes
- Add unit tests: 4 minutes (3 test cases)

**Complexity**: XS (trivial change building on ADR-002 foundation)

## Open Questions

None. Design is straightforward parameter addition with default value for backward compatibility.

## ADR-002 Coordination

**Assumption**: ADR-002 implementation included TaskType parameter in generateBatchEmbeddings per coordination requirement.

**If TaskType missing from batch method**:

1. Implementer MUST add taskType parameter to generateBatchEmbeddings
2. Follow same pattern: `taskType: TaskType = "search_document"`
3. Apply prefix to each text: `texts.map(t => \`${taskType}: ${t}\`)`
4. Update tests to verify batch prefix application

**Coordination Evidence Required**: Point to ADR-002 implementation commit showing TaskType parameter in batch method.
