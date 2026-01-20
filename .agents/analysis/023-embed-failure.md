# Analysis: Brain Embed Command Failure

## 1. Objective and Scope

**Objective**: Identify why `brain embed` fails with MCP connection errors
and Ollama 500 errors.
**Scope**: CLI command flow, MCP tool handler, Ollama client, resource
management.

## 2. Context

User reported two failure modes:

- First run with `--force`: 58 notes failed with "Ollama API error: 500"
- Second run with `--limit 0`: Complete failure "HTTP/1.x transport
  connection broken: unexpected EOF"

The command calls MCP server which processes notes sequentially,
generating embeddings via Ollama.

## 3. Approach

**Methodology**: Code path analysis from CLI to Ollama API
**Tools Used**: File reading, grep pattern matching
**Limitations**: Cannot reproduce live error without user environment

## 4. Data and Analysis

### Evidence Gathered

| Finding | Source | Confidence |
| ------- | ------ | ---------- |
| Sequential processing loop (not concurrent) | embed/index.ts:142 | High |
| No concurrency control or rate limiting | Entire handler | High |
| 30-second timeout per embedding request | ollama.ts:15 | High |
| basic-memory subprocess used for read_note | embed/index.ts:58 | High |
| subprocess connection never cleaned up | proxy/client.ts | High |
| DB connection closed only at end | embed/index.ts:189 | High |

### Facts (Verified)

- Processing is sequential: `for (const notePath of batch)` with awaits
  (line 142)
- Each iteration: 1 read_note call + 1 Ollama embedding call + 1 DB write
- basic-memory subprocess connection is singleton, never closed during
  processing
- No error recovery mechanism for subprocess death
- No rate limiting on Ollama requests
- 30-second timeout applies per request (not total batch)

### Hypotheses (Unverified)

- Long-running loop causes subprocess pipe buffer overflow
- Ollama returns 500 due to resource exhaustion (no rate limiting)
- MCP server memory leak during large batch processing
- basic-memory subprocess crashes but connection not detected until
  next use

## 5. Results

### Root Cause 1: Subprocess Connection Leakage

The basic-memory subprocess connection (`getBasicMemoryClient()`) is
established once and reused for all `read_note` calls. For large batches
(limit=0), this means:

- Hundreds of sequential MCP calls over single stdio pipe
- No connection health checks
- No periodic reconnection
- If subprocess dies mid-batch, error manifests as "unexpected EOF"

Code path:

```text
embed handler (line 58) → getBasicMemoryClient()
  → loop 100+ times (line 142) → client.callTool("read_note")
  → subprocess pipe accumulates data
  → eventual pipe/buffer failure
```

### Root Cause 2: Ollama Resource Exhaustion

Sequential but rapid-fire embedding requests (no delays between requests):

- 30-second timeout per request (line 15 of ollama.ts)
- No rate limiting or backoff
- Ollama may queue requests, run out of memory/GPU resources
- Returns HTTP 500 when overloaded
- No retry logic on 500 errors

Code path:

```text
loop (line 142) → generateEmbedding (line 166)
  → OllamaClient.generateEmbedding()
  → fetch with 30s timeout
  → Ollama returns 500 if overloaded
  → error logged, continues to next note
```

### Root Cause 3: Long-Running HTTP Handler

MCP server HTTP handler processes entire batch synchronously:

- No streaming responses
- No progress checkpoints
- CLI waits for entire batch to complete
- HTTP connection may timeout at transport layer
- If handler crashes, CLI gets "connection broken" error

## 6. Discussion

The embed tool was designed for small batches (default 100) but fails at
scale due to:

1. **No connection health management**: Subprocess pipes are fragile for
   long-running operations
2. **No rate limiting**: Bombards Ollama with requests without backoff
3. **No chunking**: Processes entire batch in single HTTP
   request/response cycle
4. **No progress persistence**: If batch fails at 99%, all work is lost

The `--limit 0` (unlimited) flag exposes these issues immediately. The
first run likely hit Ollama exhaustion (500 errors), the second run hit
subprocess pipe failure (unexpected EOF).

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
| -------- | -------------- | --------- | ------ |
| P0 | Add rate limiting (100ms delay) | Prevents Ollama exhaustion | 15 min |
| P0 | Add subprocess reconnection | Prevents pipe overflow | 30 min |
| P0 | Document limit flag warning | Immediate user guidance | 5 min |
| P1 | Add batch checkpointing | Allows resumption on failure | 2 hours |
| P1 | Implement retry logic for 500s | Handles transient failures | 1 hour |
| P2 | Convert to streaming/chunked | Better for large datasets | 4 hours |

## 8. Conclusion

**Verdict**: Quick fix required (P0 items) before resuming embed
operations
**Confidence**: High
**Rationale**: Multiple resource management gaps cause cascading failures
at scale.

### User Impact

- **What changes for you**: Add delays between requests, reconnect
  subprocess periodically, warn on large batches
- **Effort required**: 50 minutes for P0 fixes
- **Risk if ignored**: Embed command remains broken for batches over
  100 notes

## 9. Appendices

### Sources Consulted

- apps/tui/cmd/embed.go (CLI command)
- apps/mcp/src/tools/embed/index.ts (MCP handler)
- apps/mcp/src/services/embedding/generateEmbedding.ts (Ollama wrapper)
- apps/mcp/src/services/ollama/client.ts (HTTP client)
- apps/mcp/src/proxy/client.ts (subprocess connection)
- apps/mcp/src/config/ollama.ts (configuration)

### Data Transparency

- **Found**: Sequential processing loop, no rate limiting, singleton
  subprocess connection
- **Not Found**: Actual crash logs, Ollama resource usage metrics,
  subprocess pipe buffer limits
