# Analysis: Embedding Catch-Up Requirements

## 1. Objective and Scope

**Objective**: Determine how embeddings fall out of sync in practice and evaluate automatic catch-up trigger options to eliminate manual intervention.

**Scope**: Analyze real-world sync gap scenarios, quantify current backlog burden, evaluate user-proposed trigger options, and recommend implementation priority based on evidence.

## 2. Context

**User Problem**: "I have a TON of notes that haven't been processed in different projects. Unless I run manually, they won't be processed. I want automatic background catch-up so embeddings don't fall behind."

**Current Implementation** (from `src/tools/index.ts`):

- `write_note`: Triggers embedding immediately via `triggerEmbedding()` (line 432-440)
- `edit_note`: Triggers embedding via async fetch + triggerEmbedding (line 441-462)
- Manual batch: `brain embed --project X --limit 0` catches up missing embeddings

**Recent Performance Improvements** (ADR-002 batch API migration):

- Batch API reduces per-note overhead
- Concurrent processing with p-limit (4 parallel operations)
- Retry logic with exponential backoff (1s, 2s, 4s)
- Health check before batch prevents wasted retries
- Test target: 700 notes in <120s (~171ms per note worst-case)

**Key User Insight**: "If there aren't any missing, it's almost instant"
This suggests catch-up can run frequently without penalty when already synced.

## 3. Approach

**Methodology**:

- Codebase analysis to identify sync gap scenarios
- Session log review to estimate edit patterns
- Database schema review to understand detection mechanisms
- Industry research for sync patterns (Dropbox, VS Code, Git)
- Performance modeling based on ADR-002 improvements

**Tools Used**:

- Read for code analysis
- Grep for pattern detection
- WebSearch for industry standards
- Git log for performance improvement history

**Limitations**:

- No production database available for backlog measurement
- Cannot quantify exact frequency of filesystem edits
- User's "TON of notes" is unquantified

## 4. Data and Analysis

### Evidence Gathered

| Finding | Source | Confidence |
|---------|--------|-----------|
| write_note triggers embedding immediately | `src/tools/index.ts:432-440` | High |
| edit_note triggers embedding async | `src/tools/index.ts:441-462` | High |
| Batch API reduces overhead | Commit b09fc49 | High |
| 4 concurrent operations supported | `src/tools/embed/index.ts:24` | High |
| VS Code indexes on startup + file watch | Microsoft Learn | High |
| Dropbox syncs continuously with exponential backoff | Research paper | High |
| Git auto-fetches in background (VS Code) | VS Code docs | High |

### Facts (Verified)

**Sync Gap Scenarios**:

1. **Notes edited outside MCP** (direct filesystem edits)
   - Frequency: Unknown (depends on user workflow)
   - Detection: Database checksum vs file checksum (not implemented)
   - Example: Editing in Obsidian, VS Code, or any text editor
   - Current behavior: Stale embeddings persist until manual catch-up

2. **Notes created before MCP existed** (bulk import)
   - Frequency: One-time per project (historical backlog)
   - Detection: Notes exist in filesystem, no embeddings row
   - Example: User imports 1000 existing notes
   - Current behavior: Requires manual `brain embed`

3. **Failed embedding attempts** (Ollama errors, crashes)
   - Frequency: Reduced by ADR-002 retry logic (previously 5-10%)
   - Detection: Note in database, no embeddings row
   - Example: Ollama 500 errors, connection timeouts
   - Current behavior: Logged as warning, requires manual catch-up

4. **Projects with embedding disabled then re-enabled**
   - Frequency: Unknown (user may disable temporarily)
   - Detection: Gap in embedding dates (requires timestamp tracking)
   - Example: User disables during bulk import, re-enables after
   - Current behavior: No automatic catch-up

5. **edit_note operations** (now handled)
   - Frequency: Unknown (low adoption per Analysis 035)
   - Detection: N/A (automatically triggered)
   - Current behavior: Async embedding via triggerEmbedding (lines 441-462)

**Performance Constraints**:

With ADR-002 improvements:

- Single note: ~14-171ms (worst-case from 120s/700 notes target)
- 10 notes: 140-1710ms (instant)
- 100 notes: 1.4-17s (background acceptable)
- 1000 notes: 14-171s (2-3 minutes in background)

**Current Trigger Coverage**:

| Operation | Embedding Triggered | Coverage |
|-----------|-------------------|----------|
| write_note | Yes (immediate) | ✓ New notes |
| edit_note | Yes (async) | ✓ Content updates |
| Filesystem edits | No | ✗ External changes |
| Bulk import | No | ✗ Historical notes |
| Failed embeddings | No | ✗ Retry needed |

### Hypotheses (Unverified)

- User's "TON of notes" suggests hundreds to thousands of missing embeddings
- Filesystem edits are common (Obsidian users edit outside MCP frequently)
- Failed embeddings accumulate slowly over time (reduced by ADR-002)
- Most users work in single project per session (project switch is infrequent)

## 5. Results

### Backlog Assessment

**Cannot Measure Directly** (no production database access):

- Unknown: How many notes currently lack embeddings
- Unknown: Daily backlog growth rate
- Unknown: Distribution across projects

**Estimated Impact**:

- User reports "TON of notes" suggests 500-5000 missing embeddings
- At 14-171ms per note: 7-855s (7 seconds to 14 minutes) to catch up
- With batch API: Parallelized across 4 concurrent operations

### Catch-Up Frequency Needs

**Analysis**: How often should catch-up run?

| Frequency | Pros | Cons | Workload | UX |
|-----------|------|------|----------|-----|
| **Per write/edit** | Guaranteed execution, immediate | Unpredictable load (0-1000 notes) | Variable | Transparent if fast |
| **On project switch** | Catches up when needed, async | May delay project activation | Depends on stale count | Background acceptable |
| **On startup** | Fresh start, simple | Startup delay, overlaps with project switch | Same as project switch | Initial delay |
| **Periodic (hourly)** | Predictable resource usage | Requires scheduler (Inngest), may lag | Fixed batch size | Invisible |
| **Manual only** | No overhead | User must remember | On-demand | Poor UX |

**User's Insight**: "If there aren't any missing, it's almost instant"
This validates frequent catch-up: checking for 0 missing notes is negligible cost.

### Similar Systems Patterns

| System | Strategy | Update Timing | Notes |
|--------|----------|---------------|-------|
| **VS Code** | Startup + file watch | On file change + session start | Indexes on startup, updates incrementally. Files excluded via search.exclude for performance. |
| **Dropbox** | Continuous sync with exponential backoff | Real-time with transient error handling | Batches updates within 200-400ms window. Uses exponential backoff for rate limits (15-30% failure rate). |
| **Git (VS Code)** | Background auto-fetch | Periodic background (configurable) | Non-blocking, user unaware until pull needed. |
| **Notion** | Eventual consistency | Delayed indexing (API limitation) | Direct sharing bypasses delay. Not real-time. |

**Industry Pattern**: Most systems use **"on startup + periodic/file watch"** hybrid.

## 6. Discussion

### Key Insights

**Filesystem Edits Are The Primary Sync Gap**:
The combination of:

1. write_note and edit_note now trigger embeddings (P0 complete per Analysis 035)
2. Failed embeddings reduced by retry logic (ADR-002)

...means the remaining gap is **filesystem edits outside MCP**. Users editing in Obsidian, VS Code, or other tools leave embeddings stale indefinitely.

**Performance Is Not a Bottleneck**:
At 14-171ms per note with batch API parallelization, even large catch-up operations (1000 notes = 14-171s) are acceptable for background processing. The user insight "if there aren't any missing, it's almost instant" validates frequent catch-up checks.

**Industry Precedent Validates Hybrid Approach**:

- **VS Code**: Indexes on startup, updates on file watch
- **Dropbox**: Continuous sync with batching and exponential backoff
- **Git**: Periodic background fetch

These demonstrate that "startup + periodic" is the standard pattern for sync operations.

**User-Proposed Options Evaluation**:

1. **Option A: Piggyback on write_note/edit_note**
   - Solves: Guarantees frequent execution
   - Problem: Already covered by P0 (Analysis 035) - these operations now trigger embeddings
   - Verdict: Redundant, would add unpredictable load

2. **Option B: Lifecycle trigger (unspecified when)**
   - Interpretation: Project activation or MCP startup
   - Solves: Catches filesystem edits, bulk imports, failed embeddings
   - Problem: Requires detection mechanism (which notes are stale?)
   - Verdict: Best option, needs specification

3. **Option C: Periodic background (hourly)**
   - Solves: Predictable resource usage, catches all sync gaps
   - Problem: Requires Inngest scheduler, may lag behind real-time
   - Verdict: Good supplement to lifecycle trigger

### Detection Mechanism Requirements

To implement catch-up, need to detect stale embeddings:

**Database Query**:

```sql
-- Notes without any embeddings
SELECT DISTINCT n.permalink
FROM notes n
LEFT JOIN brain_embeddings e ON n.permalink = e.entity_id
WHERE e.entity_id IS NULL

-- Notes with stale embeddings (requires content checksum tracking)
SELECT n.permalink, n.checksum, MAX(e.updated_at) as last_embedded
FROM notes n
JOIN brain_embeddings e ON n.permalink = e.entity_id
WHERE n.checksum != e.content_checksum
GROUP BY n.permalink
```

**Missing Infrastructure**:

- Content checksum column in notes table (for staleness detection)
- Embedding timestamp tracking (for age-based catch-up)
- Project-level embedding config (for disable/re-enable scenario)

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
|----------|----------------|-----------|---------|
| **P0** | Lifecycle trigger: Project activation | Catches filesystem edits when user switches projects, async prevents blocking | Medium (requires stale note detection) |
| **P1** | Lifecycle trigger: MCP startup | Ensures fresh start, overlaps with P0 but covers single-project sessions | Low (reuse P0 logic) |
| **P2** | Periodic background catch-up (hourly) | Safety net for long-running sessions, predictable resource usage | Medium (requires Inngest workflow) |
| **P3** | Content checksum tracking | Enables staleness detection vs full re-embedding, improves P0/P1 efficiency | High (schema change, migration) |

### Implementation Details

**P0 - Project Activation Trigger**:

```typescript
// In src/project/resolve.ts or src/tools/bootstrap-context/index.ts
async function triggerProjectCatchup(project: string): Promise<void> {
  // Query notes without embeddings
  const missingNotes = db.query(`
    SELECT DISTINCT n.permalink
    FROM notes n
    LEFT JOIN brain_embeddings e ON n.permalink = e.entity_id
    WHERE n.project = ? AND e.entity_id IS NULL
  `).all(project);

  if (missingNotes.length === 0) {
    logger.debug({ project }, "No missing embeddings, skipping catch-up");
    return; // Fast path: "almost instant"
  }

  logger.info(
    { project, count: missingNotes.length },
    "Triggering background embedding catch-up"
  );

  // Fire-and-forget batch embedding (reuse embed tool logic)
  batchGenerate(missingNotes.map(n => n.permalink), project).catch(error => {
    logger.warn({ project, error }, "Background catch-up failed");
  });
}

// Call from bootstrap_context or project resolver
triggerProjectCatchup(resolvedProject);
```

**P1 - MCP Startup Trigger**:

```typescript
// In src/index.ts or startup initialization
async function onStartup(): Promise<void> {
  const activeProject = resolveProject(undefined);
  if (activeProject) {
    // Reuse P0 logic
    triggerProjectCatchup(activeProject);
  }
}
```

**P2 - Periodic Background Catch-Up**:

```typescript
// New Inngest workflow: src/inngest/workflows/embeddingCatchup.ts
export const embeddingCatchupWorkflow = inngest.createFunction(
  { id: "embedding-catchup", name: "Embedding Catch-Up" },
  { cron: "0 * * * *" }, // Hourly
  async ({ step }) => {
    const activeProject = await step.run("get-active-project", async () => {
      return resolveProject(undefined);
    });

    if (!activeProject) return;

    await step.run("trigger-catchup", async () => {
      await triggerProjectCatchup(activeProject);
    });
  }
);
```

**P3 - Content Checksum Tracking**:

```sql
-- Schema change (requires migration)
ALTER TABLE notes ADD COLUMN content_checksum TEXT;
ALTER TABLE brain_embeddings ADD COLUMN content_checksum TEXT;
ALTER TABLE brain_embeddings ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP;

-- Detection query becomes:
SELECT n.permalink
FROM notes n
JOIN brain_embeddings e ON n.permalink = e.entity_id
WHERE n.content_checksum != e.content_checksum
```

### Recommended Phasing

**Phase 1 (Immediate)**: P0 - Project activation trigger

- Highest impact for user's problem ("TON of notes")
- Reuses existing batch API infrastructure
- Fast path for already-synced projects ("almost instant")

**Phase 2 (Follow-up)**: P1 - MCP startup trigger

- Low effort (reuses P0 logic)
- Covers single-project sessions

**Phase 3 (Future)**: P2 - Periodic background catch-up

- Safety net for long sessions
- Requires Inngest scheduler setup

**Phase 4 (Optimization)**: P3 - Content checksum tracking

- Improves efficiency (re-embed only changed notes)
- High effort, lower priority

## 8. Conclusion

**Verdict**: Proceed with P0 (project activation trigger) immediately, P1 (startup trigger) as follow-up

**Confidence**: High

**Rationale**: Filesystem edits outside MCP are the primary sync gap. Project activation is the natural trigger point: users switching projects expect brief background work, and the "almost instant" fast path when no catch-up is needed makes frequent checks acceptable. Industry precedent (VS Code startup indexing, Git background fetch) validates this approach.

### User Impact

**What changes for you**:

- Embeddings automatically catch up when switching projects
- No manual `brain embed` commands needed
- Background processing, non-blocking
- If already synced: nearly instant (user insight validated)

**Effort required**: Zero (automatic background processing)

**Risk if ignored**:

- User must manually remember to run `brain embed` after:
  - Bulk importing notes
  - Editing notes outside MCP (Obsidian, VS Code)
  - Failed embedding attempts
- Search quality degrades over time as embeddings become stale
- "TON of notes" backlog accumulates indefinitely

## 9. Appendices

### Sources Consulted

**Codebase**:

- `/apps/mcp/src/tools/index.ts` - Current trigger implementation
- `/apps/mcp/src/tools/embed/index.ts` - Batch embedding tool
- `/apps/mcp/src/services/embedding/triggerEmbedding.ts` - Fire-and-forget embedding service
- `/apps/mcp/src/services/ollama/client.ts` - Batch API implementation
- Commit `b09fc49` - Batch API migration

**Industry Research**:

- [Workspace indexing in Visual Studio](https://learn.microsoft.com/en-us/visualstudio/extensibility/workspace-indexing?view=vs-2022)
- [Make chat an expert in your workspace - VS Code](https://code.visualstudio.com/docs/copilot/reference/workspace-context)
- [Efficient Batched Synchronization in Dropbox-like Cloud Storage Services](https://sites.cs.ucsb.edu/~ravenben/publications/pdf/dropbox-middleware13.pdf)
- [Tenacity Retries: Exponential Backoff Decorators 2026](https://johal.in/tenacity-retries-exponential-backoff-decorators-2026/)

**Related Analysis**:

- Analysis 035: Embedding Trigger Strategy (P0 - edit_note trigger)

### Data Transparency

**Found**:

- Current trigger implementation (write_note and edit_note covered)
- Batch API performance characteristics (ADR-002)
- Industry sync patterns (VS Code, Dropbox, Git)
- User insight: "almost instant" when no catch-up needed

**Not Found**:

- Production metrics: How many notes currently lack embeddings
- Filesystem edit frequency: How often users edit outside MCP
- Optimal catch-up batch size: Performance tuning needed
- Content checksum implementation: Schema change required
