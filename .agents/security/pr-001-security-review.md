# PR #1 Security Review

**PR**: feat: embedding optimization (59x perf) + auto-sync triggers
**Branch**: `feat/embedding-optimization-and-auto-sync`
**Date**: 2026-01-20
**Reviewer**: Security Agent

## Verdict

**[APPROVED]**

No security vulnerabilities identified. All changes follow secure coding practices.

## Executive Summary

PR #1 introduces embedding system optimizations with batch API migration, concurrency control via p-limit, timeout reductions, task prefix additions, and auto-embedding triggers. Security review confirms:

- Input validation properly enforced via TypeScript enum pattern
- No data exposure through task prefixes or logging
- External API calls use appropriate timeouts and error handling
- p-limit dependency has no known CVEs
- Concurrency controls bounded with proper error isolation
- SQL operations use parameterized queries preventing injection

## Input Validation

### TaskType Enum

**Status**: [PASS]

The `TaskType` is defined as a TypeScript union literal type:

```typescript
// apps/mcp/src/services/ollama/types.ts:38
export type TaskType = "search_document" | "search_query";
```

**Analysis**:

- Compile-time enforcement prevents arbitrary values
- Only two valid values: `"search_document"` and `"search_query"`
- Used consistently in `OllamaClient.generateEmbedding()` and `generateBatchEmbeddings()`
- Default value `"search_document"` is safe

**Risk Score**: 1/10 (minimal - type system enforces constraints)

### Batch API Inputs

**Status**: [PASS]

The `generateBatchEmbeddings` method in `apps/mcp/src/services/ollama/client.ts`:

- Validates empty input array (line 57-59): returns `[]` without API call
- Validates response array length matches input (lines 84-89): throws `OllamaError` on mismatch
- Uses `JSON.stringify` for request body - proper escaping

**Risk Score**: 2/10 (low - validation present, no injection vectors)

### Concurrency Limits

**Status**: [PASS]

Concurrency bounds defined in `apps/mcp/src/tools/embed/index.ts`:

```typescript
const CONCURRENCY_LIMIT = 4;        // Matches Ollama OLLAMA_NUM_PARALLEL default
const MAX_CHUNKS_PER_BATCH = 32;    // Prevents memory exhaustion
const LARGE_BATCH_WARNING_THRESHOLD = 500;  // User warning for large operations
```

**Analysis**:

- Bounded concurrency (4) prevents resource exhaustion
- Batch size limit (32 chunks) prevents memory issues
- Warning threshold (500) provides user awareness
- p-limit enforces these constraints at runtime

**Risk Score**: 2/10 (low - well-bounded with explicit limits)

## Data Exposure

### Task Prefixes

**Status**: [PASS]

Task prefix implementation in `apps/mcp/src/services/ollama/client.ts:62`:

```typescript
const prefixedTexts = texts.map(t => `${taskType}: ${t}`);
```

**Analysis**:

- Prefixes use controlled enum values (`search_document` or `search_query`)
- User cannot inject arbitrary prefixes
- Prefix format follows Nomic embedding specification
- No sensitive data introduced by prefixing

**Risk Score**: 1/10 (minimal - controlled vocabulary only)

### Embeddings Content

**Status**: [PASS]

Embeddings are numeric vectors (768 floats) that:

- Contain no directly readable text
- Cannot be easily reversed to original content
- Are stored locally in SQLite database
- Transmitted only to local Ollama instance (localhost:11434)

**Risk Score**: 2/10 (low - embeddings are one-way transformations)

### Logging Analysis

**Status**: [PASS]

Reviewed logging in affected files:

| Location | Log Content | Sensitive Data |
|----------|-------------|----------------|
| `embed/index.ts` | Note counts, chunk counts, project name | None |
| `catchupTrigger.ts` | Project name, counts, generic errors | None |
| `search/index.ts` | Query text, result counts | Query text (acceptable) |
| `ollama/client.ts` | None (no logging) | N/A |

**Analysis**:

- Error messages use `error.message` only, not stack traces
- No note content logged
- No embedding vectors logged
- Project names and counts are not sensitive

**Risk Score**: 1/10 (minimal - appropriate logging hygiene)

## External API Security

### Ollama API Configuration

**Status**: [PASS]

Configuration in `apps/mcp/src/config/ollama.ts`:

```typescript
export const ollamaConfig: OllamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  timeout: parseInt(process.env.OLLAMA_TIMEOUT ?? "60000", 10),
};
```

**Timeout Analysis**:

| Timeout | Value | Assessment |
|---------|-------|------------|
| Default | 60s | Reasonable for batch operations |
| Health check | 5s | Appropriate for quick checks |
| Configurable | Yes | Allows tuning via OLLAMA_TIMEOUT env |

**Risk Assessment**:

- 60s timeout prevents indefinite hangs
- AbortSignal.timeout used (native browser/Node API)
- Short enough to fail fast, long enough for legitimate operations
- Connection to localhost only by default

**Risk Score**: 2/10 (low - appropriate timeout strategy)

### Error Message Handling

**Status**: [PASS]

Error handling in `apps/mcp/src/services/ollama/client.ts`:

```typescript
if (!response.ok) {
  throw new OllamaError(
    `Ollama API error: ${response.status}`,
    response.status
  );
}
```

**Analysis**:

- Only HTTP status code exposed (not response body)
- No internal paths or configuration leaked
- Custom OllamaError class with controlled message format

**Risk Score**: 1/10 (minimal - clean error handling)

## Dependency Security

### p-limit@7.2.0

**Status**: [PASS]

| Factor | Assessment |
|--------|------------|
| **Maintainer** | sindresorhus (highly reputable) |
| **License** | MIT (compatible) |
| **CVEs** | 0 (checked NVD, npm audit) |
| **Dependencies** | 1 (yocto-queue@1.2.1) |
| **Maintenance** | Active (published 3 months ago) |
| **Popularity** | 999 stars, widely used |
| **npm audit** | 0 vulnerabilities found |

**Note**: p-limit already existed on main branch at same version. This PR does not introduce a new dependency.

**Risk Score**: 1/10 (minimal - established, secure package)

### yocto-queue@1.2.1 (transitive)

**Status**: [PASS]

- Same maintainer (sindresorhus)
- Zero dependencies
- Minimal attack surface (queue data structure)

**Risk Score**: 1/10 (minimal)

## Concurrency Safety

### p-limit Usage Pattern

**Status**: [PASS]

Implementation in `apps/mcp/src/tools/embed/index.ts`:

```typescript
const concurrencyLimit = pLimit(CONCURRENCY_LIMIT);
const results = await Promise.allSettled(
  batch.map(notePath =>
    concurrencyLimit(async () => {
      // Note processing logic
    })
  )
);
```

**Analysis**:

| Aspect | Assessment |
|--------|------------|
| Race conditions | None - each note processed independently |
| Shared state | No mutable shared state between operations |
| Error isolation | Promise.allSettled isolates failures |
| Resource cleanup | Database connections closed in finally |

**Error Isolation**:

```typescript
// Each note's error is captured, not propagated
errors.push(`${notePath}: ${msg}`);
return { success: false, chunks: 0 };
```

**Resource Cleanup**:

```typescript
// Database properly closed
db.close();
```

**Risk Score**: 2/10 (low - proper concurrent programming patterns)

### Fire-and-Forget Patterns

**Status**: [PASS]

Auto-embed triggers use fire-and-forget safely:

1. **bootstrap_context catchup** (`catchupTrigger.ts:157`):
   ```typescript
   triggerCatchupEmbedding(project).catch((error) => {
     logger.error({ project, error }, "Catch-up embedding trigger failed");
   });
   ```

2. **edit_note trigger** (`tools/index.ts:446`):
   ```typescript
   client.callTool({ ... }).then(...).catch((error: Error) => {
     logger.warn({ identifier, error }, "Failed to fetch content");
   });
   ```

**Analysis**:

- All fire-and-forget calls have `.catch()` handlers
- Errors logged but do not crash main operation
- No unhandled promise rejections

**Risk Score**: 2/10 (low - proper async error handling)

## Code Injection Risks

### Task Prefix Injection

**Status**: [PASS]

Potential injection point analyzed:

```typescript
// Line 62 in ollama/client.ts
const prefixedTexts = texts.map(t => `${taskType}: ${t}`);
```

**Analysis**:

- `taskType` is typed as `TaskType = "search_document" | "search_query"`
- TypeScript compiler rejects non-literal values
- Runtime: Only these two string values can reach this code path
- Template literal concatenation, not command execution

**Attack Vector Assessment**:

| Vector | Possible | Reason |
|--------|----------|--------|
| Shell injection | No | No shell execution |
| SQL injection | No | Different code path, parameterized |
| Prompt injection | No | Embedding model, not instruction-following |

**Risk Score**: 1/10 (minimal - type system prevents injection)

### SQL Injection

**Status**: [PASS]

All database operations in `apps/mcp/src/db/vectors.ts` use parameterized queries:

```typescript
// Line 60 - DELETE
db.run("DELETE FROM brain_embeddings WHERE entity_id = ?", [entityId]);

// Lines 62-68 - INSERT
const stmt = db.prepare(`INSERT INTO brain_embeddings (...) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
stmt.run(chunkId, arr, entityId, ...);

// Lines 123-124 - SELECT
.all(entityId) as Array<...>;
```

**Analysis**:

- All user-controlled values passed as parameters
- No string concatenation in SQL queries
- Prepared statements used consistently

**Risk Score**: 1/10 (minimal - proper parameterization)

## Issues Found

| ID | Severity | Issue | Mitigation |
|----|----------|-------|------------|
| None | - | No security issues identified | N/A |

## Additional Observations

### Positive Security Patterns

1. **Defense in depth**: Multiple validation layers (TypeScript types, runtime checks, API validation)
2. **Fail-fast timeouts**: 60s default prevents resource exhaustion
3. **Error isolation**: Promise.allSettled prevents cascade failures
4. **Minimal logging**: No sensitive data in logs
5. **Local-only by default**: Ollama connects to localhost

### Boundary Analysis

| Boundary | Type | Protection |
|----------|------|------------|
| User input to TaskType | Trust | TypeScript enum |
| Note content to Ollama | Data | JSON serialization |
| Ollama response to DB | Data | Dimension validation |
| Search query to vector | Data | OllamaClient abstraction |

## Recommendation

**[APPROVED]**

This PR may proceed to merge. No security concerns identified. The implementation follows security best practices:

- Type-safe input validation
- Parameterized database queries
- Bounded concurrency with proper error handling
- Appropriate timeout configuration
- Clean error messages without information leakage
- No new vulnerable dependencies

## Verification Checklist

- [x] Input validation reviewed (TaskType enum, batch inputs, concurrency limits)
- [x] Data exposure assessed (task prefixes, embeddings, logging)
- [x] External API security verified (timeouts, error handling)
- [x] Dependency security checked (p-limit CVEs, license)
- [x] Concurrency safety analyzed (p-limit usage, error isolation)
- [x] Code injection risks evaluated (task prefix, SQL)

---

**Signature**: Security Agent | 2026-01-20
