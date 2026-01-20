---
status: proposed
date: 2026-01-20
decision-makers: architect
consulted: []
informed: implementer, planner, qa
---

# Embedding Trigger Architecture: Optimal Trigger Points for Automatic Embedding Generation

## Context and Problem Statement

The Brain MCP server currently triggers embedding generation only on `write_note` operations (fire-and-forget). The `edit_note` operation explicitly skips embedding triggers with a comment "For now, skip - batch embed can catch up" (line 444 in tools/index.ts).

User proposes adding automatic embedding triggers at:

1. On `edit_note` operations (currently skipped)
2. On project activation (async background)
3. On MCP startup (async background)

How should embedding generation be triggered to balance freshness, latency, resource usage, and architectural consistency?

## Decision Drivers

* **Freshness**: Search depends on embeddings; stale embeddings produce stale search results
* **Latency**: Triggers should not block user-facing operations
* **Resource usage**: Embedding generation is CPU-intensive (Ollama processing)
* **Consistency**: Trigger pattern should align with existing architecture
* **Separation of concerns**: Write/edit tools should not be responsible for derived index maintenance
* **Reliability**: Failed embeddings should not block successful writes

## Architectural Principles Assessment

### Current Pattern: Write-Through on write_note

**Pattern**: Synchronous trigger, asynchronous execution (fire-and-forget)

```typescript
// From tools/index.ts:429-440
if (name === "write_note") {
  const title = resolvedArgs.title as string | undefined;
  const folder = resolvedArgs.folder as string | undefined;
  const content = resolvedArgs.content as string | undefined;
  if (title && content) {
    const permalink = folder ? `${folder}/${title}` : title;
    triggerEmbedding(permalink, content);  // Fire-and-forget
    logger.debug({ permalink }, "Triggered embedding for new note");
  }
}
```

**Characteristics**:
* Trigger: Synchronous (called immediately after write success)
* Execution: Asynchronous (does not block tool return)
* Failure mode: Logged warning, does not affect write success

**Assessment**: This is a **hybrid write-through/write-behind pattern**:
* Write-through aspect: Trigger happens immediately after write
* Write-behind aspect: Actual embedding generation is async (fire-and-forget)

### Inngest Event-Driven Architecture

**Existing Infrastructure** (from inngest/events.ts):
* Session protocol events (protocol.start, protocol.end)
* Orchestrator events (agent.invoked, agent.completed)
* Feature completion events
* Approval workflow events

**Assessment**: The system already has event-driven infrastructure via Inngest. However, no note-level events exist:
* ✗ No `note/created` event
* ✗ No `note/updated` event
* ✗ No `note/embedded` event

**Consideration**: Adding note-level events would require:

1. Event emission from write_note/edit_note
2. Inngest workflow to consume events
3. Graceful degradation when Inngest unavailable

### Separation of Concerns Analysis

**Question**: Should embedding generation be part of write/edit transactions?

| Layer | Responsibility | Current | Proposed |
|-------|----------------|---------|----------|
| **Write/Edit Tools** | Content modification | Content storage + embedding trigger | Content storage only |
| **Embedding Service** | Index derivation | Triggered by tools | Triggered by events or background process |
| **Search Tool** | Index consumption | Queries embeddings table | Queries embeddings table |

**Current Architecture**: Tools are responsible for triggering embedding generation.

**Alternative Architecture**: Event-driven or background reconciliation separates concerns.

**Trade-off**: Simplicity (current) vs flexibility (event-driven) vs staleness tolerance (background).

## Considered Options

### Option 1: Extend Current Pattern - Trigger on edit_note

Add fire-and-forget trigger to edit_note matching write_note pattern.

**Implementation**:

```typescript
else if (name === "edit_note") {
  // After successful edit, fetch content and trigger embedding
  const identifier = resolvedArgs.identifier as string | undefined;
  if (identifier) {
    // Need to fetch full content after edit (content not in args)
    const readResult = await client.callTool({
      name: "read_note",
      arguments: { identifier, project: resolvedArgs.project }
    });
    if (readResult.content?.[0]?.text) {
      const content = extractContentFromRead(readResult);
      triggerEmbedding(identifier, content);
      logger.debug({ identifier }, "Triggered embedding for edited note");
    }
  }
}
```

**Pros**:
* Consistent with write_note pattern
* Immediate freshness (embeddings updated after edit)
* No architectural changes needed
* Fire-and-forget preserves zero latency

**Cons**:
* Requires additional read_note call to fetch content after edit
* More HTTP overhead (read_note call to basic-memory)
* Tools remain responsible for index maintenance
* No bulk catch-up for missed edits

### Option 2: Event-Driven with Inngest Workflows

Emit note-level events; Inngest workflows handle embedding generation.

**Implementation**:

```typescript
// New event types in inngest/events.ts
export type NoteCreatedEvent = {
  name: "note/created";
  data: {
    permalink: string;
    content: string;
    project: string;
    timestamp: string;
  };
};

export type NoteUpdatedEvent = {
  name: "note/updated";
  data: {
    permalink: string;
    project: string;
    timestamp: string;
  };
};

// New workflow in inngest/workflows/noteEmbedding.ts
export const noteEmbeddingWorkflow = inngest.createFunction(
  { id: "note-embedding" },
  { event: "note/created" },
  async ({ event, step }) => {
    await step.run("generate-embedding", async () => {
      await triggerEmbedding(event.data.permalink, event.data.content);
    });
  }
);

// In tools/index.ts after write/edit success
await inngest.send({
  name: "note/created",
  data: { permalink, content, project, timestamp: new Date().toISOString() }
});
```

**Pros**:
* Clean separation of concerns (tools emit events, workflows handle side effects)
* Centralizes embedding logic in workflow
* Enables future enhancements (batch processing, prioritization)
* Retry and failure handling built into Inngest
* Observability via Inngest dashboard

**Cons**:
* Requires Inngest to be running (graceful degradation needed)
* More complex architecture (events, workflows, fallback)
* Additional latency (~50-200ms event dispatch + workflow invocation)
* Dependency on external service (Inngest dev server)

### Option 3: Project Activation Trigger

On project activation, scan for notes missing embeddings and generate in background.

**Implementation**:

```typescript
// In tools/projects/active-project/index.ts
export async function handler(args: ActiveProjectArgs): Promise<CallToolResult> {
  const project = args.project;

  // Set active project
  setActiveProject(project);

  // Trigger background catch-up (fire-and-forget)
  triggerEmbeddingCatchUp(project);

  return { /* ... */ };
}

// New function in services/embedding/catchUp.ts
export function triggerEmbeddingCatchUp(project: string): void {
  // Fire-and-forget background process
  (async () => {
    const notes = await listNotesWithoutEmbeddings(project);
    for (const note of notes) {
      const content = await fetchNoteContent(note);
      await triggerEmbedding(note.permalink, content);
    }
  })().catch(error => {
    logger.warn({ project, error }, "Embedding catch-up failed");
  });
}
```

**Pros**:
* Predictable trigger point (user-initiated)
* Catches up on missed embeddings from edit_note
* No latency impact on write/edit operations
* User has visibility (can see embedding generation happening)

**Cons**:
* Can delay project activation if many stale notes
* Not immediate (edits stay stale until next project activation)
* Duplicate work if project activated multiple times
* No catch-up if user doesn't switch projects

### Option 4: MCP Startup Trigger

On MCP server startup, scan all projects and generate missing embeddings.

**Implementation**:

```typescript
// In src/index.ts after Ollama check
if (ollamaReady) {
  // Trigger startup catch-up (fire-and-forget)
  triggerStartupEmbeddingCatchUp();
  logger.info("Embedding catch-up initiated");
}

// New function in services/embedding/catchUp.ts
export function triggerStartupEmbeddingCatchUp(): void {
  (async () => {
    const projects = await listAllProjects();
    for (const project of projects) {
      const notes = await listNotesWithoutEmbeddings(project);
      for (const note of notes) {
        const content = await fetchNoteContent(note);
        await triggerEmbedding(note.permalink, content);
      }
    }
  })().catch(error => {
    logger.warn({ error }, "Startup embedding catch-up failed");
  });
}
```

**Pros**:
* Automatic catch-up on every MCP start
* No user interaction needed
* Catches all missed embeddings across all projects

**Cons**:
* Can spike CPU/memory on startup
* User has no control over timing
* Wasteful if restarted frequently
* Stale embeddings persist until next restart

### Option 5: Scheduled Reconciliation (Inngest Cron)

Background job runs periodically to generate missing embeddings.

**Implementation**:

```typescript
// New workflow in inngest/workflows/embeddingReconciliation.ts
export const embeddingReconciliationWorkflow = inngest.createFunction(
  { id: "embedding-reconciliation" },
  { cron: "*/5 * * * *" }, // Every 5 minutes
  async ({ step }) => {
    const projects = await step.run("list-projects", () => listAllProjects());

    for (const project of projects) {
      await step.run(`reconcile-${project}`, async () => {
        const notes = await listNotesWithoutEmbeddings(project);
        for (const note of notes) {
          const content = await fetchNoteContent(note);
          await triggerEmbedding(note.permalink, content);
        }
      });
    }
  }
);
```

**Pros**:
* Zero user-facing latency impact
* Automatic catch-up without user action
* Predictable resource usage (5-minute intervals)
* Eventual consistency model

**Cons**:
* Embeddings can be 5+ minutes stale
* Requires Inngest to be running
* Continuous background CPU usage
* Staleness window unacceptable for interactive search

## Recommended Architecture

**Hybrid: Option 1 (edit_note trigger) + Option 5 (scheduled reconciliation)**

### Primary Trigger: Fire-and-Forget on write_note/edit_note

Extend the existing pattern to edit_note for immediate freshness:

```typescript
// In tools/index.ts after write/edit success
if (name === "write_note" || name === "edit_note") {
  const project = resolvedArgs.project as string | undefined;
  invalidateBootstrapCache(project);

  if (name === "write_note") {
    // Content available in args
    const title = resolvedArgs.title as string | undefined;
    const folder = resolvedArgs.folder as string | undefined;
    const content = resolvedArgs.content as string | undefined;
    if (title && content) {
      const permalink = folder ? `${folder}/${title}` : title;
      triggerEmbedding(permalink, content);
    }
  } else if (name === "edit_note") {
    // Content not in args - use edit operation to determine if re-embedding needed
    const identifier = resolvedArgs.identifier as string | undefined;
    const operation = resolvedArgs.operation as string | undefined;

    // Only trigger if content was modified (not just metadata)
    if (identifier && operation !== "delete") {
      // Optimization: For append/prepend, fetch only if needed
      // For now, always trigger to ensure freshness
      queueEmbeddingForIdentifier(identifier, project);
    }
  }
}

// New function: Queue identifier for embedding (fetches content lazily)
function queueEmbeddingForIdentifier(identifier: string, project?: string): void {
  (async () => {
    const client = await getBasicMemoryClient();
    const result = await client.callTool({
      name: "read_note",
      arguments: { identifier, project }
    });

    if (result.content?.[0]?.text) {
      const content = extractMarkdownContent(result.content[0].text);
      triggerEmbedding(identifier, content);
      logger.debug({ identifier }, "Triggered embedding for edited note");
    }
  })().catch(error => {
    logger.warn({ identifier, error }, "Failed to queue embedding for edited note");
  });
}
```

### Safety Net: Scheduled Reconciliation (P2 - Optional)

Add Inngest cron workflow for catch-up (only if Inngest available):

```typescript
// Only register if Inngest is available
if (await isInngestAvailable()) {
  inngest.createFunction(
    { id: "embedding-reconciliation" },
    { cron: "0 */1 * * *" }, // Every hour
    async ({ step }) => {
      await step.run("reconcile-embeddings", async () => {
        const stats = await reconcileMissingEmbeddings();
        logger.info(stats, "Embedding reconciliation complete");
      });
    }
  );
}
```

### Why This Hybrid Approach

| Requirement | Solution | Rationale |
|-------------|----------|-----------|
| **Freshness** | Fire-and-forget on write/edit | Embeddings updated immediately after content change |
| **Latency** | Async execution | Zero blocking time for user operations |
| **Reliability** | Scheduled reconciliation | Catches missed embeddings (failures, crashes) |
| **Consistency** | Matches write_note pattern | Minimal architectural change |
| **Separation** | Background reconciliation | Tools focus on content, cron handles catch-up |

## Implementation Plan

### Phase 1: Extend Fire-and-Forget to edit_note (P0)

**Effort**: 2 hours

1. Add `queueEmbeddingForIdentifier` function to tools/index.ts
2. Add edit_note branch to embedding trigger logic
3. Add unit tests for embedding trigger on edit operations
4. Validate embedding generation for append/prepend/find_replace/replace_section

**Acceptance Criteria**:
* edit_note operations trigger embedding generation
* Embedding trigger does not block edit_note return
* Failed embeddings log warnings but do not fail edit operation

### Phase 2: Scheduled Reconciliation (P2 - Optional)

**Effort**: 3 hours

**Conditional**: Only implement if Inngest is available and used.

1. Create `reconcileMissingEmbeddings` function in services/embedding/
2. Add Inngest cron workflow (every hour)
3. Add metrics (notes reconciled, embeddings generated)
4. Add admin tool to trigger reconciliation manually

**Acceptance Criteria**:
* Cron workflow runs every hour
* Missing embeddings are caught up within 1 hour
* Reconciliation respects concurrency limits (p-limit)

### Phase 3: Monitoring and Observability (P2)

**Effort**: 1 hour

1. Add embedding generation metrics to logger
2. Track embedding lag (time between write and embedding)
3. Track reconciliation statistics

## Pattern Consistency with Existing Architecture

### Comparison with Current Patterns

| Pattern | Current Example | Embedding Trigger Pattern |
|---------|----------------|---------------------------|
| **Fire-and-forget** | Bootstrap cache invalidation (line 421) | ✓ Matches |
| **Async execution** | triggerEmbedding (line 429) | ✓ Matches |
| **No blocking** | Does not await embedding | ✓ Matches |
| **Error isolation** | Embedding failure logged, not thrown | ✓ Matches |

### Alignment with ADR-002

The proposed hybrid approach aligns with ADR-002 (Embedding Performance Optimization):

| ADR-002 Principle | Alignment |
|-------------------|-----------|
| **Batch API usage** | ✓ triggerEmbedding already uses batch API |
| **Concurrency control** | ✓ p-limit already applied (4 concurrent notes) |
| **Fire-and-forget** | ✓ Maintains existing pattern |
| **Timeout optimization** | ✓ Uses 60s timeout from ADR-002 |

### Inngest Usage Pattern

Proposed scheduled reconciliation matches existing Inngest usage:

| Existing Pattern | Embedding Reconciliation |
|------------------|--------------------------|
| Session protocol workflows | Scheduled reconciliation workflow |
| Graceful degradation when unavailable | Only runs if Inngest available |
| Event-driven architecture | Cron-driven architecture |

## Trade-Off Analysis

| Trigger | Freshness | Latency | Resource | Complexity | Fail Mode |
|---------|-----------|---------|----------|------------|-----------|
| **edit_note fire-and-forget** | Immediate | +0ms (async) | Low (single note) | Low | Edit succeeds, embedding logged |
| **Project activation** | Minutes | Spike | Medium (many notes) | Medium | Activation slow |
| **MCP startup** | On restart | Spike | High (all notes) | Medium | Startup slow |
| **Scheduled (hourly)** | ~30min avg | +0ms | Low (amortized) | Medium | Falls behind if rate high |
| **Event-driven (Inngest)** | ~1s | +50-200ms | Low | High | Requires Inngest |

## Decision

**Implement Phase 1 (edit_note trigger) immediately.**

**Defer Phase 2 (scheduled reconciliation) until evidence shows missed embeddings are a problem.**

### Rationale

1. **Immediate freshness**: Fire-and-forget on edit_note provides embeddings within seconds of content change
2. **Zero latency**: Async execution does not block user operations
3. **Pattern consistency**: Matches existing write_note trigger pattern
4. **Minimal complexity**: No new infrastructure (Inngest cron) needed initially
5. **Evidence-based**: Scheduled reconciliation adds complexity; only add if needed

### Monitoring for Phase 2 Decision

Track metrics to determine if Phase 2 is needed:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Embedding failure rate | >5% | Investigate retry logic |
| Embedding lag | >5 minutes | Consider scheduled reconciliation |
| Missing embeddings count | >100 notes | Implement scheduled reconciliation |

## Consequences

### Positive

* Good: Immediate embedding freshness for both create and edit operations
* Good: Zero user-facing latency (async execution)
* Good: Consistent pattern across write_note and edit_note
* Good: Minimal architectural change (extend existing fire-and-forget pattern)
* Good: No new dependencies or infrastructure

### Negative

* Bad: edit_note requires additional read_note call to fetch content (~100ms overhead per edit)
* Bad: No automatic catch-up for missed embeddings (manual intervention needed)
* Neutral: Tools remain responsible for triggering embeddings (separation not achieved)

### Mitigation

**Overhead from read_note**: Acceptable because:
* Async (does not block user)
* Amortized over embedding generation time (~260ms total)
* Edit operations are less frequent than reads

**Missed embeddings**: Acceptable because:
* Rare (fire-and-forget has high success rate)
* Manual batch embed tool exists for catch-up
* Can add scheduled reconciliation if evidence shows it's needed

## Validation Requirements

### Before Implementation

* [ ] Baseline: Measure current embedding freshness lag after write_note
* [ ] Test: Verify triggerEmbedding handles async execution correctly (no blocking)
* [ ] Test: Verify embedding failures do not crash or block tool execution

### After Implementation

* [ ] Verify: edit_note operations trigger embedding generation
* [ ] Measure: Embedding lag after edit_note (target: <5 seconds)
* [ ] Verify: read_note overhead is acceptable (<200ms total)
* [ ] Verify: Failed embeddings are logged and do not affect edit success

## Reversibility Assessment

* [x] **Rollback capability**: Remove edit_note trigger branch, revert to "skip" comment
* [x] **Vendor lock-in**: No new dependencies introduced
* [x] **Exit strategy**: Simple code removal (no data migration needed)
* [x] **Legacy impact**: No breaking changes to tools or APIs
* [x] **Data migration**: Not applicable (embeddings are derived data)

### Exit Strategy

**Trigger conditions**: Embedding lag unacceptable, or edit_note overhead too high

**Migration path**:

1. Remove edit_note trigger branch from tools/index.ts
2. Restore "skip" comment
3. Rely on manual batch embed or scheduled reconciliation

**Estimated effort**: 30 minutes (simple code removal)

## Alternatives Considered and Rejected

### Rejected: Event-Driven with Inngest (Option 2)

**Why rejected**:
* Adds significant complexity (events, workflows, graceful degradation)
* Requires Inngest to be running (external dependency)
* Adds 50-200ms latency (event dispatch + workflow invocation)
* Benefit (separation of concerns) does not justify cost for current scale

**Reconsider if**: System grows to thousands of notes/day, or embedding logic becomes complex enough to warrant workflow orchestration.

### Rejected: Project Activation Trigger (Option 3)

**Why rejected**:
* Unpredictable user experience (activation may be slow)
* No guarantee user will activate project (stale embeddings persist)
* Duplicate work if activated multiple times

### Rejected: MCP Startup Trigger (Option 4)

**Why rejected**:
* Startup spike in CPU/memory usage
* No user control or visibility
* Frequent restarts during development waste resources

### Rejected: Scheduled Reconciliation Only (Option 5)

**Why rejected**:
* 30-minute average staleness unacceptable for interactive search
* Continuous background CPU usage
* Does not solve immediate freshness requirement

## More Information

### Related ADRs

* ADR-002: Embedding Performance Optimization - Established batch API usage and concurrency patterns

### Related Analysis

* `.agents/analysis/025-embedding-performance-research.md` - Batch API research
* `.agents/analysis/026-timeout-changes-performance-review.md` - Timeout cascade analysis

### Related Code

* `src/tools/index.ts:429-445` - Current write_note trigger implementation
* `src/services/embedding/triggerEmbedding.ts` - Fire-and-forget embedding generation
* `src/services/embedding/generateEmbedding.ts` - Batch embedding API client

### Future Enhancements

If Phase 2 (scheduled reconciliation) is implemented:

1. **Reconciliation priority**: Prioritize recently modified notes over old notes
2. **Incremental reconciliation**: Process notes in batches to avoid resource spikes
3. **Manual trigger**: Add admin tool to trigger reconciliation on-demand
4. **Metrics dashboard**: Track embedding lag, failure rate, reconciliation statistics

### Open Questions

1. **Should edit_note always trigger, or only for content-modifying operations?**
   * Recommendation: Always trigger to ensure freshness (metadata changes are rare)

2. **Should embedding generation be configurable (enable/disable)?**
   * Recommendation: Yes, via environment variable `EMBEDDING_AUTO_TRIGGER=true/false`

3. **What is acceptable embedding lag for search freshness?**
   * Recommendation: <5 seconds for interactive search; validate with user feedback
