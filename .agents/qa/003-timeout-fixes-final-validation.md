# Final QA Validation: Timeout Fixes

**Feature**: Fix EOF errors during batch embedding operations
**Date**: 2026-01-19
**Validator**: QA Agent

## Validation Summary

| Gate | Status | Blocking |
|------|--------|----------|
| Code Verification | [PASS] | Yes |
| Build Verification | [PASS] | Yes |
| Functional Test | [FAIL] | Yes |

## 1. Code Verification

### Timeout Values

| Layer | File | Line | Value | Status |
|-------|------|------|-------|--------|
| HTTP Client | apps/tui/client/http.go | 38 | 10 min | [PASS] |
| Inter-chunk delay | apps/mcp/src/tools/embed/index.ts | 23 | 200ms | [PASS] |
| Ollama Config | apps/mcp/src/config/ollama.ts | 15-17 | 600000ms (10 min) | [PASS] |
| Ollama Client | apps/mcp/src/services/ollama/client.ts | 18 | 600000ms (10 min) | [PASS] |

**Evidence**:

```go
// apps/tui/client/http.go:38
httpClient: &http.Client{
    Timeout: 10 * time.Minute,
},
```

```typescript
// apps/mcp/src/tools/embed/index.ts:23
const OLLAMA_REQUEST_DELAY_MS = 200;
```

```typescript
// apps/mcp/src/config/ollama.ts:15-17
export const ollamaConfig: OllamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  timeout: parseInt(process.env.OLLAMA_TIMEOUT ?? "600000", 10),
};
```

```typescript
// apps/mcp/src/services/ollama/client.ts:18
this.timeout = config.timeout ?? 600000; // 10 minutes
```

**Result**: All timeout values are correct as specified.

## 2. Build Verification

### TypeScript Build

```bash
cd apps/mcp && npm run build
```

**Output**:

```
Bundled 628 modules in 68ms
  index.js  2.23 MB  (entry point)
```

**Status**: [PASS] - No TypeScript errors.

### Plugin Reinstall

```bash
make reinstall-plugin-full
```

**Status**: [PASS] - Plugin reinstalled successfully.

### MCP Server Restart

```bash
brain mcp restart
```

**Output**:

```
🧠 Brain MCP stopped (PID 48604)
🧠 Brain MCP started (PID 50699)
```

**Status**: [PASS] - Server restarted successfully.

## 3. Functional Test

### Test Command

```bash
brain embed --project brain --limit 5
```

### Expected Result

- Command completes without EOF errors
- 5 notes processed successfully
- Embeddings stored in database

### Actual Result

```
Error: embedding generation failed: Post "http://127.0.0.1:8765/mcp":
net/http: HTTP/1.x transport connection broken: unexpected EOF
```

**Status**: [FAIL]

### Server Status Post-Failure

```bash
brain mcp status
```

**Output**:

```
Brain MCP: running (uptime: 31s, sessions: 1, memory: 0MB)
```

**Observation**: MCP server is still running after the error. The connection is being closed mid-request, not from a server crash.

## Root Cause Analysis

### Issue Type

The EOF error is **not** from an Ollama timeout. The error occurs at the HTTP transport layer between the TUI client and MCP server.

### Error Signature

```
net/http: HTTP/1.x transport connection broken: unexpected EOF
```

This error occurs when:

1. Client sends HTTP request to server
2. Server accepts request and starts processing
3. Connection closes before server sends complete response

### Hypothesis

The @hono/mcp StreamableHTTPTransport may have its own timeout or connection handling that differs from the configured timeouts. The embedding operation:

1. TUI → HTTP POST to MCP server (Go client: 10 min timeout) ✓
2. MCP server → calls embed tool handler
3. Embed handler → calls Ollama multiple times (200ms delay between chunks)
4. **Connection closes prematurely before MCP server sends response**

### Evidence

- Go HTTP client timeout: 10 minutes ✓
- Ollama client timeout: 10 minutes ✓
- Inter-chunk delay: 200ms ✓
- Server still running after error ✓
- Error occurs at HTTP layer, not Ollama layer

### Gaps

| Gap | Impact | Resolution Needed |
|-----|--------|-------------------|
| @hono/mcp transport timeout | Unknown default timeout may be < 10 min | Investigate transport configuration |
| Bun.serve timeout | Bun may have default connection timeout | Check Bun server configuration |
| SSE stream handling | Streaming response may timeout differently | Verify SSE keep-alive |

## Issues Found

| Issue | Priority | Category | Description |
|-------|----------|----------|-------------|
| HTTP transport EOF | P0 | Blocker | Connection closes before response sent |
| Transport timeout unknown | P1 | Gap | @hono/mcp timeout not configured |
| Bun server timeout unknown | P1 | Gap | Bun.serve may have implicit timeout |

**Issue Summary**: P0: 1, P1: 2, Total: 3

## Recommendations

### Immediate Actions

1. **Investigate @hono/mcp StreamableHTTPTransport**
   - Check if transport has configurable timeout
   - Review transport source for connection handling
   - Add explicit timeout configuration if available

2. **Check Bun.serve configuration**
   - Review Bun documentation for default timeouts
   - Add explicit connection timeout in `Bun.serve()` options
   - Consider adding keep-alive headers

3. **Add diagnostic logging**
   - Log when embed tool starts processing
   - Log when embed tool completes processing
   - Log when response is sent to client
   - This will identify where the connection closes

### Alternative Approaches

1. **Switch to non-streaming response** for long-running operations
   - SSE streaming may not be appropriate for batch embedding
   - Use standard JSON response with explicit timeout headers

2. **Add progress callbacks** to keep connection alive
   - Send periodic SSE events during embedding generation
   - Prevents idle timeout on long operations

3. **Implement chunked processing at HTTP layer**
   - Break large batch into multiple HTTP requests
   - Each request processes subset of notes
   - Prevents single request from exceeding any timeout

## Verdict

**Status**: [BLOCKED]

**Blocking Issues**: 1 (P0 HTTP transport EOF)

**Rationale**: While all timeout values are correctly configured, the functional test fails with an EOF error at the HTTP transport layer. The issue is not with Ollama timeouts but with the HTTP connection between TUI and MCP server closing prematurely.

### Fixes Required

1. **Investigate and configure @hono/mcp transport timeout**
   - Check transport source code for timeout configuration
   - Add explicit timeout if configurable
   - File: `apps/mcp/src/transport/http.ts`

2. **Configure Bun server timeout**
   - Add explicit connection timeout to `Bun.serve()` options
   - File: `apps/mcp/src/transport/http.ts:173`

3. **Add diagnostic logging**
   - Log embed tool lifecycle events
   - Identify exact point of connection closure

4. **Retest with diagnostics enabled**
   - Run `brain embed --project brain --limit 5`
   - Analyze logs to determine exact failure point

### If Blocked

Return to orchestrator with blocking issues. Do NOT proceed to PR creation.

**Next Steps**: Route to implementer or architect to resolve HTTP transport timeout configuration.

## Evidence

### Test Command Output

```
$ brain embed --project brain --limit 5
Generating embeddings for project: brain
   Mode: missing only
   Limit: 5 notes

Error: embedding generation failed: Post "http://127.0.0.1:8765/mcp":
net/http: HTTP/1.x transport connection broken: unexpected EOF
```

### Server Status

```
$ brain mcp status
Brain MCP: running (uptime: 31s, sessions: 1, memory: 0MB)
```

### Code Changes Verified

All three timeout layers have been modified as specified:

1. ✓ HTTP client: 10 minutes
2. ✓ Inter-chunk delay: 200ms
3. ✓ Ollama client: 10 minutes (both config and fallback)

Build succeeds with no TypeScript errors.

---

**Conclusion**: The timeout fixes are implemented correctly at the code level, but an additional timeout exists at the HTTP transport layer that was not initially identified. This transport-level timeout is causing the EOF error before Ollama timeouts can occur.

**Recommendation**: Investigate @hono/mcp and Bun.serve timeout configuration before claiming the fix is complete.
