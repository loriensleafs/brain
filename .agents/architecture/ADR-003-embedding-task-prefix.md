---
status: proposed
date: 2026-01-19
decision-makers: [architect]
consulted: [analyst, implementer]
informed: [qa, devops]
---

# Embedding Quality: Task Prefix Specification for nomic-embed-text

## Context and Problem Statement

The current embedding implementation sends raw text to the nomic-embed-text model without task instruction prefixes. According to Nomic AI documentation, nomic-embed-text requires task prefixes (e.g., "search_document:", "search_query:") to properly contextualize embeddings and optimize semantic quality.

Evidence from Analysis 030 and multi-agent review:
- Current implementation in `client.ts:35` sends raw text without prefix
- Nomic documentation explicitly requires task instructions for optimal quality
- Brain has TWO distinct use cases requiring different prefixes:
  - Document embedding (embed tool): requires "search_document:" prefix
  - Query embedding (search service): requires "search_query:" prefix
- Quality improvement: Required by vendor specification for optimal quality (exact improvement varies by use case)
- Performance impact: 0% (string concatenation overhead is negligible)

How should we implement task prefixes for the nomic-embed-text embedding model to support both document and query embeddings without breaking existing functionality?

## Decision Drivers

* **Correctness**: Must support both "search_document:" (for embeddings) and "search_query:" (for search queries) as required by Nomic AI specification
* **Quality**: Embedding quality improves per vendor specification (exact improvement varies by use case)
* **Zero cost**: No performance overhead from string concatenation
* **Compatibility**: Must work with current single-text API and future batch API (ADR-002)
* **Type Safety**: Prevent wrong task type from being used
* **Maintainability**: Easy to understand and modify if task types change

## Considered Options

* **Option A**: Add prefix in OllamaClient.generateEmbedding (centralized)
* **Option B**: Add prefix at call site in embedding/generateEmbedding.ts (decentralized)
* **Option C**: Configurable prefix via environment variable or parameter

## Decision Outcome

Chosen option: **Option C - Configurable task type via parameter with type safety**, because it correctly supports both document embedding ("search_document:") and query embedding ("search_query:") use cases, prevents wrong task type usage through TypeScript enums, and ensures compliance with Nomic AI vendor specifications.

### Consequences

* Good, because supports both document and query embeddings with correct prefixes
* Good, because type-safe (enum prevents typos and wrong task types)
* Good, because zero performance cost (string concatenation is O(n) but negligible)
* Good, because follows Nomic AI vendor specifications correctly
* Good, because embedding quality improves per vendor specification
* Good, because future batch API migration (ADR-002) inherits same pattern
* Good, because explicit task type makes intent clear at call sites
* Bad, because adds parameter complexity (mitigated by sensible default)
* Neutral, because requires callers to specify task type (but prevents embedding/query mismatch defect)

### Confirmation

Implementation verified through:
1. Unit tests for OllamaClient.generateEmbedding with both "search_document" and "search_query" task types
2. Integration test verifying embed tool uses "search_document:" prefix
3. Integration test verifying search service uses "search_query:" prefix
4. Visual inspection of generated embeddings in database
5. Search quality comparison using sample queries (before/after prefix)
6. Type safety verification (enum prevents invalid task types)
7. Compatibility verification with batch API migration plan (ADR-002)

## Pros and Cons of the Options

### Option A: Add prefix in OllamaClient (centralized) - REJECTED

**Implementation** (`client.ts`):

```typescript
async generateEmbedding(
  text: string,
  model: string = "nomic-embed-text"
): Promise<number[]> {
  // Add task prefix for nomic-embed-text as required by Nomic AI docs
  const prefixedText = `search_document: ${text}`;

  const response = await fetch(`${this.baseUrl}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: prefixedText }),
    signal: AbortSignal.timeout(this.timeout),
  });

  // ... rest of implementation
}
```

* Good, because single point of change (DRY principle)
* Good, because all callers benefit automatically (no missed call sites)
* Good, because clear ownership (OllamaClient knows Ollama API requirements)
* **FATAL DEFECT**: Hardcodes "search_document:" but search service at `search/index.ts:388` uses `generateEmbedding(query)` which requires "search_query:" prefix
* **FATAL DEFECT**: Cannot differentiate between document and query embeddings, causing semantic mismatch
* Bad, because violates vendor specification for query embeddings
* **REJECTED**: This option causes query embedding defect identified in multi-agent review

### Option B: Add prefix at call site in generateEmbedding.ts (decentralized)

**Implementation** (`embedding/generateEmbedding.ts`):

```typescript
export async function generateEmbedding(
  text: string,
  client: OllamaClient
): Promise<number[]> {
  // Add task prefix for document embedding
  const prefixedText = `search_document: ${text}`;
  return client.generateEmbedding(prefixedText);
}
```

* Good, because caller controls task type (semantic flexibility)
* Good, because OllamaClient remains task-agnostic
* Good, because different callers could use different task types
* Bad, because multiple call sites to update (current: 1, future: 2+ with batch API)
* Bad, because risk of missed call sites (prefix forgotten in new code)
* Neutral, because appropriate if we need multiple task types (clustering, classification)

### Option C: Configurable task type via parameter with type safety - CHOSEN

**Implementation** (`client.ts`):

```typescript
// Type-safe task type enum
type TaskType = "search_document" | "search_query";

async generateEmbedding(
  text: string,
  taskType: TaskType = "search_document",
  model: string = "nomic-embed-text"
): Promise<number[]> {
  // Add task prefix as required by Nomic AI specification
  const prefixedText = `${taskType}: ${text}`;

  const response = await fetch(`${this.baseUrl}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: prefixedText }),
    signal: AbortSignal.timeout(this.timeout),
  });

  // ... rest of implementation
}
```

**Call Sites**:

```typescript
// Embed tool (document embedding)
await client.generateEmbedding(chunk.text, "search_document");

// Search service (query embedding)
await client.generateEmbedding(query, "search_query");
```

* Good, because supports both document and query embeddings correctly
* Good, because type-safe (TypeScript union type prevents invalid values)
* Good, because explicit semantic intent at call sites
* Good, because prevents query embedding defect (wrong prefix)
* Good, because future-proof for additional task types (clustering, classification)
* Good, because default parameter ("search_document") handles most common case
* Good, because complies with Nomic AI vendor specification
* Neutral, because adds one parameter (mitigated by sensible default)
* **CHOSEN**: This option correctly addresses both use cases identified in multi-agent review

## Implementation Plan

### Phase 1: Core Change (P0) - 20 minutes

1. **Add TaskType enum and update OllamaClient.generateEmbedding**
   - File: `apps/mcp/src/services/ollama/client.ts`
   - Add `type TaskType = "search_document" | "search_query";`
   - Add `taskType: TaskType` parameter (default: "search_document")
   - Construct prefixed text: `const prefixedText = \`${taskType}: ${text}\`;`
   - Document in JSDoc comment why task type is required
   - Add code comment with link to Nomic AI docs

2. **Update call sites**
   - Embed tool (`apps/mcp/src/tools/embed/index.ts`): Pass "search_document"
   - Search service (`apps/mcp/src/services/search/index.ts`): Pass "search_query"

3. **Add unit tests**
   - File: `apps/mcp/src/services/ollama/__tests__/client.test.ts`
   - Test 1: Verify "search_document:" prefix for document embeddings
   - Test 2: Verify "search_query:" prefix for query embeddings
   - Test 3: Verify default parameter uses "search_document"

### Phase 2: Validation (P0) - 30 minutes

1. **Integration tests**
   - File: `apps/mcp/src/services/embedding/__tests__/integration.test.ts`
   - Test 1: Verify embed tool generates embeddings with "search_document:" prefix
   - Test 2: Verify search service generates embeddings with "search_query:" prefix
   - Test 3: Compare embedding vectors for same text with different task types (should differ)

2. **Visual verification**
   - Query database for chunk_text column
   - Verify embeddings were generated with correct prefixes
   - Run sample searches to confirm query/document asymmetry works correctly

### Phase 3: Documentation (P1) - 15 minutes

1. **Update .env.example**
   - Add comment explaining task type requirement
   - Document Nomic AI specification link

2. **Update ADR-002 coordination**
   - Note that batch API will use same TaskType parameter
   - Show batch implementation example with task types
   - Add cross-reference to ADR-003

### Phase 4: Batch API Coordination (P1) - When ADR-002 implemented

When implementing batch API, inherit task type pattern:

```typescript
async generateBatchEmbeddings(
  texts: string[],
  taskType: TaskType = "search_document",
  model: string = "nomic-embed-text"
): Promise<number[][]> {
  // Prefix each text with task type
  const prefixedTexts = texts.map(t => `${taskType}: ${t}`);
  // ... rest of batch implementation
}
```

## Validation Requirements

### 1. Correctness Verification (P0)

**Requirement**: Verify both document and query task types are sent to Ollama API correctly.

**Method**:
```typescript
// Unit test 1: Document embedding
test('generateEmbedding includes search_document prefix', async () => {
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
  });
  global.fetch = mockFetch;

  await client.generateEmbedding('test text', 'search_document');

  const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
  expect(requestBody.prompt).toBe('search_document: test text');
});

// Unit test 2: Query embedding
test('generateEmbedding includes search_query prefix', async () => {
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
  });
  global.fetch = mockFetch;

  await client.generateEmbedding('test query', 'search_query');

  const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
  expect(requestBody.prompt).toBe('search_query: test query');
});

// Unit test 3: Default parameter
test('generateEmbedding defaults to search_document', async () => {
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
  });
  global.fetch = mockFetch;

  await client.generateEmbedding('test text'); // No task type specified

  const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
  expect(requestBody.prompt).toBe('search_document: test text');
});
```

**Success Criteria**: All three tests pass, verifying correct prefixes for documents, queries, and defaults.

### 2. Call Site Verification (P0)

**Requirement**: Verify embed tool and search service use correct task types.

**Method**:
```typescript
// Integration test 1: Embed tool
test('embed tool uses search_document task type', async () => {
  const spy = jest.spyOn(client, 'generateEmbedding');

  await embedNote('test note content');

  expect(spy).toHaveBeenCalledWith(
    expect.any(String),
    'search_document'
  );
});

// Integration test 2: Search service
test('search service uses search_query task type', async () => {
  const spy = jest.spyOn(client, 'generateEmbedding');

  await search('test query');

  expect(spy).toHaveBeenCalledWith(
    'test query',
    'search_query'
  );
});
```

**Success Criteria**: Both tests pass, verifying correct task types at call sites.

### 3. Quality Improvement Verification (P1)

**Requirement**: Confirm embedding quality improves with task prefixes.

**Method**:
```bash
# Compare search results before/after
brain search "authentication patterns" --limit 5 > before.txt
# Apply prefix change and re-embed
brain embed --project brain --force
brain search "authentication patterns" --limit 5 > after.txt
diff before.txt after.txt
```

**Success Criteria**:
- Search results are more semantically relevant (manual review)
- Document/query asymmetry produces better matches per Nomic specification

### 4. Batch API Compatibility (P1)

**Requirement**: Verify task type pattern works with batch API (ADR-002).

**Method**:
```typescript
// Batch API should use same TaskType parameter
async generateBatchEmbeddings(
  texts: string[],
  taskType: TaskType = "search_document",
  model: string = "nomic-embed-text"
): Promise<number[][]> {
  // Prefix each text with task type
  const prefixedTexts = texts.map(t => `${taskType}: ${t}`);

  const response = await fetch(`${this.baseUrl}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: prefixedTexts }),
    signal: AbortSignal.timeout(this.timeout),
  });
  // ...
}
```

**Success Criteria**: Batch API implementation (when added) uses same TaskType enum and parameter pattern.

### 5. Performance Impact (P2)

**Requirement**: Verify zero performance regression from string concatenation.

**Method**:
```bash
# Benchmark embedding generation
time brain embed --project brain --limit 100 > before.log
# Apply prefix change
time brain embed --project brain --limit 100 > after.log
# Compare timing (should be <1% difference)
```

**Success Criteria**: Total time difference <1% (within noise margin).

## Reversibility Assessment

- [x] **Rollback capability**: Changes can be rolled back without data loss (embeddings can be regenerated)
- [x] **Vendor lock-in**: No new vendor lock-in (already using nomic-embed-text)
- [x] **Exit strategy**: Can remove prefix if switching embedding models
- [x] **Legacy impact**: Existing embeddings remain valid (no migration needed)
- [x] **Data migration**: Reversing requires re-embedding all notes (~5 min for 700 notes post-ADR-002)

## Vendor Lock-in Assessment

**Dependency**: nomic-embed-text embedding model (already in use)
**Lock-in Level**: Low

### Lock-in Indicators
- [x] Proprietary APIs without standards-based alternatives (task prefix is Nomic-specific)
- [ ] Data formats that require conversion to export (embeddings are standard float arrays)
- [ ] Licensing terms that restrict migration (Nomic is open source)
- [x] Integration depth that increases switching cost (task prefix hardcoded)
- [ ] Team training investment (no training required)

### Exit Strategy
**Trigger conditions**: If switching to different embedding model (e.g., OpenAI, Cohere)
**Migration path**:
1. Remove task prefix from OllamaClient
2. Re-embed all notes with new model
3. Update model name in config
**Estimated effort**: 1 hour code change + 5 minutes re-embedding (post-ADR-002 optimization)
**Data export**: Embeddings stored in SQLite, easily queryable and exportable

### Accepted Trade-offs
Task prefix is Nomic-specific, but switching cost is low (1 hour + re-embedding). Benefit of vendor-specified quality improvement outweighs vendor-specific API usage. If switching models, removing prefix is trivial (TaskType parameter removed, callers unchanged).

## More Information

### Related Analysis Documents

- `.agents/analysis/030-markdown-sanitization-for-embeddings.md` - Task prefix research and quality analysis

### Related ADRs

- ADR-002: Embedding Performance Optimization - Batch API migration will inherit task prefix pattern
- ADR-001: Search Service Abstraction - Search quality depends on embedding quality

### External References

- [Nomic Embed Text v1 Documentation](https://www.nomic.ai/blog/posts/nomic-embed-text-v1) - Task prefix requirements
- [Ollama Embedding API](https://docs.ollama.com/capabilities/embeddings) - API format specification

### Team Agreement

**Consensus**: Pending (multi-agent review in progress)

**P0 Issues Identified in Initial Review**:
1. **Query Embedding Defect** (Critic): Option A hardcoded "search_document:" but search service requires "search_query:" prefix
   - Resolution: Changed decision from Option A to Option C with TaskType parameter
2. **Unfounded Quality Claim** (Analyst + Independent-Thinker): "15-25% quality improvement" lacked supporting evidence
   - Resolution: Replaced with factual language: "Required by vendor specification for optimal quality"

**Design Changes from Initial Review**:
- Decision changed from Option A (centralized hardcoded) to Option C (configurable with type safety)
- Implementation now uses `TaskType = "search_document" | "search_query"` enum
- Call sites must specify task type explicitly (embed tool vs search service)
- Validation expanded to test both document and query prefixes

**Review Timeline**:
- ADR created: 2026-01-19
- Initial review: 2026-01-19 (P0 issues identified)
- Revision: 2026-01-19 (P0 issues addressed)
- Next: Re-review round (adr-review skill)
- Implementation: After ADR acceptance
