---
type: task
id: TASK-003
title: Add unit tests for task type prefix application
status: todo
priority: P0
complexity: XS
estimate: 5m
related:
  - DESIGN-001
  - REQ-001
  - REQ-002
  - REQ-003
blocked_by:
  - TASK-001
  - TASK-002
blocks: []
assignee: implementer
created: 2026-01-20
updated: 2026-01-20
author: spec-generator
tags:
  - testing
  - unit-tests
  - ollama
---

# TASK-003: Add Unit Tests for Task Type Prefix Application

## Design Context

- DESIGN-001: TaskType parameter flow through embedding pipeline

## Objective

Add three unit tests to verify task type prefix application in OllamaClient.generateEmbedding: "search_document" prefix, "search_query" prefix, and default behavior.

## Scope

**In Scope**:

- Test 1: Verify "search_document:" prefix applied
- Test 2: Verify "search_query:" prefix applied
- Test 3: Verify default parameter uses "search_document"

**Out of Scope**:

- Integration tests (manual verification sufficient for quick fix)
- Batch embedding tests (already covered by ADR-002)
- Performance benchmarking

## Acceptance Criteria

- [ ] Three new test cases added to `apps/mcp/src/services/ollama/__tests__/client.test.ts`
- [ ] Test 1: `should include search_document prefix`
- [ ] Test 2: `should include search_query prefix`
- [ ] Test 3: `should default to search_document when taskType omitted`
- [ ] All tests pass: `bun test client.test.ts`
- [ ] Test coverage for prefix application logic

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/src/services/ollama/__tests__/client.test.ts` | Modify | Add 3 test cases |

## Implementation Notes

Add the following tests to the existing test suite:

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
    await client.generateEmbedding("test text"); // No taskType parameter

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.prompt).toBe("search_document: test text");
  });
});
```

## Testing Requirements

Run tests to verify implementation:

```bash
# Run specific test file
bun test apps/mcp/src/services/ollama/__tests__/client.test.ts

# Run all tests
bun test
```

Expected output:

```
✓ OllamaClient.generateEmbedding with taskType
  ✓ should include search_document prefix
  ✓ should include search_query prefix
  ✓ should default to search_document when taskType omitted
```

## Dependencies

- TASK-001: TaskType enum and signature updates (required)
- TASK-002: Call site updates (validates integration)
- Existing test infrastructure (Jest/Bun test)

## Related Tasks

- TASK-001: Add TaskType enum (validates signature)
- TASK-002: Update call sites (integration validation)
