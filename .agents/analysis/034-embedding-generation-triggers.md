# Embedding Generation Triggers Analysis

**Analysis ID**: 034  
**Date**: 2026-01-20  
**Analyst**: analyst agent  
**Status**: [COMPLETE]

## 1. Objective and Scope

**Objective**: Determine when embeddings are automatically generated in the Brain MCP system.

**User Question**: "Embeddings get generated when the brain mcp starts up as well as when notes are created or edited right?"

**Scope**: Investigation of all automatic embedding generation triggers in the codebase (server startup, note creation, note editing, and manual tools).

## 2. Context

The Brain MCP server uses Ollama with the `nomic-embed-text` model to generate 768-dimension vector embeddings for semantic search. Understanding when embeddings are generated helps determine whether manual intervention is needed to keep embeddings up to date.

## 3. Approach

**Methodology**: Code analysis of embedding generation code paths

**Tools Used**:
- Grep searches for embedding-related functions
- File reads of key modules (index.ts, tools/index.ts, triggerEmbedding.ts, embed tool)
- Analysis of Inngest events for workflow-based triggers

**Limitations**: Did not verify runtime behavior through testing; relied on static code analysis.

## 4. Data and Analysis

### Evidence Gathered

| Finding | Source | Confidence |
|---------|--------|-----------|
| Server startup initializes tables but does NOT generate embeddings | `src/index.ts:31-38` | High |
| `write_note` automatically triggers embedding (fire-and-forget) | `src/tools/index.ts:432-440` | High |
| `edit_note` does NOT trigger embedding (explicitly skipped) | `src/tools/index.ts:441-445` | High |
| Manual tool `generate_embeddings` exists for batch processing | `src/tools/embed/index.ts` | High |
| No Inngest workflows for embedding automation | `src/inngest/workflows/` listing | High |

### Facts (Verified)

**Trigger 1: MCP Server Startup**
- **Status**: [FAIL] - Does NOT generate embeddings
- **Evidence**: `src/index.ts` lines 31-38
- **Mechanism**: Only creates database table structure (`createEmbeddingsTable(db)`), does not generate embeddings for existing notes
- **Code**:
  ```typescript
  // Initialize embeddings table for semantic search
  try {
    const db = createVectorConnection();
    createEmbeddingsTable(db);
    db.close();
    logger.info("Embeddings table initialized");
  } catch (error) {
    logger.warn({ error }, "Failed to initialize embeddings table - semantic search disabled");
  }
  ```

**Trigger 2: Note Creation (write_note)**
- **Status**: [PASS] - Automatically triggers embedding
- **Evidence**: `src/tools/index.ts` lines 429-440
- **Mechanism**: Fire-and-forget async embedding generation after successful write
- **Code**:
  ```typescript
  if (name === "write_note") {
    const title = resolvedArgs.title as string | undefined;
    const folder = resolvedArgs.folder as string | undefined;
    const content = resolvedArgs.content as string | undefined;
    if (title && content) {
      const permalink = folder ? `${folder}/${title}` : title;
      triggerEmbedding(permalink, content);
      logger.debug({ permalink }, "Triggered embedding for new note");
    }
  }
  ```
- **Implementation**: `src/services/embedding/triggerEmbedding.ts`
  - Chunks content automatically if it exceeds token limits (~2000 chars per chunk with 15% overlap)
  - Does not block note creation (fire-and-forget pattern)
  - Failures are logged but do not fail the write operation

**Trigger 3: Note Edit (edit_note)**
- **Status**: [FAIL] - Does NOT trigger embedding
- **Evidence**: `src/tools/index.ts` lines 441-445
- **Mechanism**: Explicitly skipped with TODO comment
- **Code**:
  ```typescript
  } else if (name === "edit_note") {
    // For edit_note, we'd need to fetch the full content after edit
    // For now, skip - batch embed can catch up
    logger.debug("Skipping embedding trigger for edit_note");
  }
  ```
- **Rationale**: Would require fetching full content after edit to regenerate embedding
- **Workaround**: Batch embedding tool can catch up later

**Trigger 4: Manual (generate_embeddings tool)**
- **Status**: [PASS] - Available for manual/batch processing
- **Evidence**: `src/tools/embed/index.ts`
- **Mechanism**: User or agent explicitly calls the tool
- **Parameters**:
  - `project`: Project name (auto-resolved if not specified)
  - `force`: Regenerate all embeddings (default: false, only missing)
  - `limit`: Max notes to process (default: 100, use 0 for all)
- **Features**:
  - Processes notes concurrently (4 parallel operations matching Ollama default)
  - Uses batch API for multiple chunks
  - Warns for large batches (>500 notes)
  - Skips notes with existing embeddings unless `force=true`

**Trigger 5: Inngest Workflows**
- **Status**: [FAIL] - No workflow-based automation
- **Evidence**: `src/inngest/workflows/` directory listing (no embedding-related workflows)
- **Mechanism**: None implemented

### Hypotheses (Unverified)

- Future enhancement may add automatic embedding on `edit_note` (comment suggests this is planned)
- Queue-based retry mechanism for failed embeddings is planned (comments in `triggerEmbedding.ts` mention TASK-2-6)

## 5. Results

Embedding generation is triggered in **1 of 2** scenarios the user asked about:

1. **Server Startup**: [FAIL] - Only initializes database tables, does not generate embeddings
2. **Note Creation**: [PASS] - Automatically triggers fire-and-forget embedding generation
3. **Note Editing**: [FAIL] - Explicitly skipped (not triggered)

The system relies on:
- Automatic embedding on `write_note`
- Manual batch processing via `generate_embeddings` tool to catch up on `edit_note` changes and any missed writes

## 6. Discussion

The current implementation has a coverage gap for `edit_note` operations. This means:

**When Embeddings Stay Fresh**:
- New notes created via `write_note` get embeddings immediately
- Search results include newly created notes without manual intervention

**When Embeddings Go Stale**:
- Notes modified via `edit_note` retain old embeddings
- Search results for edited notes reflect pre-edit content until batch embedding runs
- Deleted content may still appear in search results

**Design Rationale**:
- Fire-and-forget pattern prevents blocking note operations on slow embedding generation
- `edit_note` skips embedding to avoid fetching full content (performance trade-off)
- Batch tool provides catch-up mechanism

**Impact of Gap**:
- Low for write-heavy workflows (most content added via `write_note`)
- Medium for edit-heavy workflows (content frequently updated)
- Mitigated by periodic batch runs

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
|----------|----------------|-----------|--------|
| P0 | Document embedding behavior in user-facing docs | Users need to understand when manual batch is needed | Low |
| P1 | Add periodic batch embedding (daily cron via Inngest) | Ensures embeddings stay fresh without manual intervention | Medium |
| P2 | Trigger embedding on `edit_note` | Closes coverage gap completely | Medium |
| P2 | Implement retry queue for failed embeddings | Prevents silent failures from creating permanent gaps | High |

**P1 Recommendation Details**:
Create an Inngest scheduled workflow that runs `generate_embeddings` nightly with parameters:
- `force=false` (only process missing/stale)
- `limit=0` (process all)
- Consider project-scoped batches to spread load

## 8. Conclusion

**Verdict**: PARTIALLY CORRECT  
**Confidence**: High  
**Rationale**: User's assumption about server startup is incorrect (only table initialization), but note creation trigger is correct. The critical gap is that `edit_note` does not trigger embedding.

### User Impact

**What changes for you**:
- Notes created with `write_note` get embeddings automatically
- Notes edited with `edit_note` require manual batch embedding to update search results
- Server restart does not regenerate embeddings

**Effort required**:
- Run `generate_embeddings` tool periodically after heavy editing sessions
- Consider running with `limit=0` nightly if search freshness is critical

**Risk if ignored**:
- Search results reflect stale content for edited notes
- Deleted information may still appear in search
- New information added via edits won't be discoverable via semantic search

## 9. Appendices

### Sources Consulted

- `apps/mcp/src/index.ts` - Server startup initialization
- `apps/mcp/src/tools/index.ts` - Tool registration and proxying
- `apps/mcp/src/services/embedding/triggerEmbedding.ts` - Fire-and-forget embedding
- `apps/mcp/src/tools/embed/index.ts` - Batch embedding tool
- `apps/mcp/src/inngest/workflows/` - Workflow directory listing

### Data Transparency

**Found**:
- Automatic embedding on `write_note` (fire-and-forget)
- Explicit skip of embedding on `edit_note`
- Manual batch tool with concurrency controls
- Table initialization at startup (not embedding generation)

**Not Found**:
- Automated periodic embedding workflows
- Edit-triggered embedding generation
- Retry queue for failed embeddings (planned per comments)
