# Security Review: ADR-003 - Embedding Task Prefix Specification

**Review Date**: 2026-01-19
**Reviewer**: Security Agent
**ADR Status**: Proposed
**Implementation Status**: Pre-implementation

---

## Verdict

**APPROVED** with recommendations

---

## Security Assessment

Overall security posture: **LOW RISK**

The proposed change adds a static string prefix ("search_document: ") to user-provided text before sending to a local Ollama server. The change is minimal, localized to a single function (`OllamaClient.generateEmbedding`), and operates within an existing data flow that already sends raw text to the embedding model.

**Risk Score**: 2/10 (Low)

Key mitigating factors:
- Local network only (localhost:11434 default)
- No authentication credentials in data flow
- Prefix is static, not user-controlled
- No external network communication
- No persistent storage of prefixed text

---

## Threat Analysis

### STRIDE Assessment

| Threat | Category | Likelihood | Impact | Risk | Mitigation |
|--------|----------|------------|--------|------|------------|
| Prefix injection via note content | Tampering | Low | Low | Low | Static prefix prepended, not parsed |
| Prefixed text logged insecurely | Info Disclosure | Low | Medium | Low | Logger does not log text content |
| SSRF via OLLAMA_BASE_URL | Spoofing | Low | Medium | Low | Environment variable, not user input |
| Denial of service via large text | DoS | Medium | Low | Low | Existing timeout protection (600s) |

### Detailed Threat Analysis

#### T1: Prefix Injection via Note Content

**Attack Vector**: Malicious note content could attempt to override or manipulate the task prefix.

**Analysis**:
- Prefix is prepended via string concatenation: `"search_document: " + text`
- Nomic model processes this as a single string, not as commands
- Embedding models do not parse or execute prefixes, they embed the entire string
- No evidence of instruction injection vulnerabilities in nomic-embed-text

**Evidence**: The code at `client.ts:75` shows simple string concatenation:
```typescript
const prefixedText = `search_document: ${text}`;
```

**Risk Level**: Low
**Mitigation**: None required. String concatenation is safe here.

#### T2: Sensitive Data Exposure in Embeddings

**Attack Vector**: Notes containing sensitive information (passwords, API keys, PII) become embedded with the prefix, potentially exposing data.

**Analysis**:
- This is NOT a new risk introduced by ADR-003
- The current implementation already sends raw note content to Ollama
- Adding "search_document: " prefix does not increase data exposure
- Embeddings are stored locally in SQLite, not transmitted externally

**Current Data Flow** (unchanged by ADR-003):
```
Note Content -> Chunking -> Ollama (localhost) -> Embedding Vector -> SQLite
```

**Risk Level**: Low (pre-existing, not introduced by this change)
**Mitigation**: Document existing data handling. Consider future note-level opt-out.

#### T3: Logging of Sensitive Content

**Attack Vector**: Prefixed text could be logged, exposing sensitive note content.

**Findings**:
- `generateEmbedding.ts` logs retry attempts with status codes, NOT text content
- `logger.warn()` logs: `{ attempt, maxRetries, delay, statusCode }` only
- `logger.error()` logs: `{ maxRetries, lastError: lastError?.message }` only
- `client.ts` does not contain any logging
- Pino logger writes to file (`~/.basic-memory/brain.log`)

**Evidence** from `generateEmbedding.ts:89-97`:
```typescript
logger.warn(
  {
    attempt: attempt + 1,
    maxRetries: MAX_RETRIES,
    delay,
    statusCode,  // No text content logged
  },
  "Ollama server error, retrying with backoff"
);
```

**Risk Level**: Low
**Mitigation**: None required. Text content is not logged.

#### T4: SSRF via Ollama Base URL

**Attack Vector**: If `OLLAMA_BASE_URL` can be set to an external server, note content could be exfiltrated.

**Analysis**:
- `OLLAMA_BASE_URL` is an environment variable (not user input)
- Default is `localhost:11434`
- Environment variables are admin-controlled
- No runtime URL modification is possible

**Evidence** from `config/ollama.ts:16`:
```typescript
baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
```

**Risk Level**: Low (requires admin access to exploit)
**Mitigation**: Document that OLLAMA_BASE_URL should only point to trusted endpoints.

---

## Data Protection

### Content Exposure Assessment

| Stage | Data | Exposure Risk | Notes |
|-------|------|---------------|-------|
| Input | Raw note content | Unchanged | Already exposed pre-ADR-003 |
| Prefixing | "search_document: " + content | Unchanged | Local memory only |
| API Request | Prefixed text to Ollama | Unchanged | localhost default |
| Storage | Embedding vector | Unchanged | Float arrays, not reversible |
| Chunk Storage | `chunk_text` column | Unchanged | SQLite, already stores text |

**Key Finding**: The `chunk_text` column in `brain_embeddings` table stores raw text chunks. This is pre-existing exposure, not introduced by ADR-003.

### Database Schema Risk

The database schema (`db/schema.ts:29`) stores chunk text:
```sql
+chunk_text TEXT
```

This allows snippet display but also stores original content. The prefix is NOT stored in this column (only original text chunks are stored).

**Verification** from `triggerEmbedding.ts:40`:
```typescript
results.push({
  chunkText: chunk.text,  // Original text, not prefixed
  embedding,
});
```

**Conclusion**: Prefixed text is only used for embedding generation, not stored.

---

## Vendor Risk Assessment

### Nomic AI Dependency

| Factor | Assessment | Score |
|--------|------------|-------|
| Maintenance | Active development (2024 updates) | 1 |
| License | Apache 2.0 (permissive) | 1 |
| Security History | No known CVEs for nomic-embed-text | 1 |
| Lock-in Risk | Low - prefix removal is trivial | 2 |
| Integration Depth | Single API call pattern | 1 |
| **Total Risk Score** | **Low** | 1.2/5 |

### Lock-in Analysis

**Current State**: Already using nomic-embed-text model via Ollama.

**ADR-003 Impact**: Adds Nomic-specific task prefix. This is vendor-specific but:
- Prefix is a single string constant
- Removal requires 1 line change
- Re-embedding takes ~5 minutes (post ADR-002 optimization)
- No data format lock-in (embeddings are standard float arrays)

**Exit Strategy** (documented in ADR-003):
1. Remove task prefix from OllamaClient (1 line)
2. Re-embed all notes
3. Update model name if switching providers

**Estimated Exit Cost**: 1 hour code change + 5 minutes re-embedding

---

## Issues Identified

| ID | Priority | Issue | CWE | Recommendation |
|----|----------|-------|-----|----------------|
| S1 | P2 | Chunk text stored in database | CWE-312 | Document data at rest protection |
| S2 | P2 | OLLAMA_BASE_URL accepts any URL | CWE-918 | Add localhost validation warning |
| S3 | P2 | No content filtering before embedding | N/A | Consider opt-out mechanism for sensitive notes |

### S1: Chunk Text Storage (CWE-312)

**Description**: The `chunk_text` column stores original note content in SQLite database.

**Risk**: If database file is accessed, note content is exposed in plaintext.

**Recommendation**:
- Document data protection requirements in deployment guide
- Consider SQLite encryption for sensitive deployments
- This is NOT introduced by ADR-003 but should be documented

### S2: OLLAMA_BASE_URL Validation (CWE-918)

**Description**: Environment variable accepts any URL without validation.

**Risk**: Admin misconfiguration could point to external server.

**Recommendation**:
- Add warning in `.env.example` that URL should be localhost or trusted LAN
- Consider adding URL validation to reject external hosts
- This is NOT introduced by ADR-003 but relevant to embedding security

### S3: Sensitive Note Content

**Description**: All notes are embedded regardless of content sensitivity.

**Risk**: Notes containing secrets, passwords, or PII are processed through embedding pipeline.

**Recommendation**:
- Consider future feature: frontmatter flag to skip embedding
- Document that users should not store secrets in notes
- This is NOT introduced by ADR-003 but relevant to system security

---

## Compliance Implications

None identified. The change:
- Does not modify data retention
- Does not add external data transmission
- Does not change authentication/authorization
- Does not introduce new PII processing

---

## Post-Implementation Verification Requirements

If this ADR is approved and implemented, verify:

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Prefix applied | Unit test | Request body contains "search_document: " |
| Original text preserved in DB | Query brain_embeddings | chunk_text does NOT contain prefix |
| No text in logs | Grep log file | Zero matches for note content |
| Localhost default | Code review | OLLAMA_BASE_URL default is localhost |

---

## Final Recommendation

**APPROVED**

ADR-003 introduces minimal security risk. The change:
1. Does not increase data exposure (same data flow, new prefix)
2. Does not introduce new attack surfaces
3. Does not transmit data externally
4. Does not store prefixed text (only embedding vectors)

The identified issues (S1-S3) are pre-existing concerns unrelated to the task prefix change. They should be tracked separately.

**Conditions**: None required for approval.

**Recommendations** (non-blocking):
1. Add security note to `.env.example` about OLLAMA_BASE_URL
2. Document chunk_text storage in security considerations
3. Track S1-S3 as separate security improvements

---

## Signature

**Security Agent Review**: APPROVED
**Date**: 2026-01-19
**Confidence**: High (90%)
