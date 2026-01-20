# Embedding Catch-Up Architecture Review

**Date**: 2026-01-20
**Architect**: Claude Code
**Status**: Architectural Analysis Complete

## Executive Summary

User requests automatic background catch-up for missing embeddings without manual `brain embed` invocation. This review evaluates five trigger strategies against separation of concerns, resource profiles, and user expectations.

**Recommendation**: Scheduled reconciliation (Pattern 2) using existing Inngest infrastructure provides optimal balance of simplicity, resource predictability, and architectural cleanliness.

---

## 1. Lifecycle Events Analysis

### Available Trigger Points

| Event | Location | Frequency | Predictability | When |
|-------|----------|-----------|----------------|------|
| **Session start** | `bootstrap_context` tool | Per MCP connection | High | User starts working |
| **Project activation** | `active_project` set | Per project switch | Medium | User changes context |
| **Inngest scheduled** | Cron workflow | Configurable (hourly/daily) | High | Clock-based |
| **Idle detection** | No MCP calls for N min | Opportunistic | Low | User pauses work |
| **Write/edit piggyback** | After content change | Per user action | Low (usage dependent) | After user modifies content |

### Trigger Characterization

#### Session Start (`bootstrap_context`)

**Pros**:

- Natural entry point, always executed
- User expects some initialization overhead
- High confidence trigger will fire

**Cons**:

- Blocking startup experience if synchronous
- May run when no new notes exist (wasted cycles)
- Unpredictable workload (0-1000 missing embeddings)

**Resource Profile**: 0-14s spike at session start (worst case: 1000 notes × 14ms/note)

#### Project Activation

**Pros**:

- Contextually relevant (catches up project-specific notes)
- Less frequent than session start (most users stay in one project)
- Can be scoped to project notes only

**Cons**:

- Requires project switching to trigger
- Single-project users may never trigger catch-up
- More complex to track last catch-up per project

**Resource Profile**: 0-14s spike per project switch (scoped to project notes)

#### Inngest Scheduled (Cron)

**Pros**:

- Predictable resource usage (known schedule)
- Leverages existing infrastructure (no new code paths)
- Runs regardless of user activity (true background)
- Easy to disable/configure

**Cons**:

- Requires Inngest dev server running
- May run when no work needed
- Slight staleness window (up to schedule interval)

**Resource Profile**: 0-700ms every N hours (configurable), predictable background load

#### Idle Detection

**Pros**:

- Opportunistic (uses idle CPU)
- No impact on active user workflow

**Cons**:

- Complex to implement (requires activity tracking)
- May never trigger for always-active users
- Unpredictable timing

**Resource Profile**: Variable, depends on user behavior

#### Write/Edit Piggyback (User's Suggestion)

**Pros**:

- Frequent execution (every content change)
- Guaranteed to run eventually

**Cons**:

- Unpredictable workload (0-1000 missing notes)
- Resource spike on every user action
- Architectural boundary violation (see Section 4)

**Resource Profile**: 0-14s spike after every write/edit (highly variable)

---

## 2. Architecture Pattern Analysis

### Pattern 1: Event-Driven Opportunistic

**Architecture**: Event (write/edit) → Check for missing → Conditional process

```typescript
// After write_note/edit_note completes
const missingCount = await countMissingEmbeddings(project);
if (missingCount > 0) {
  triggerEmbedding({ project, limit: 0 }); // Background
}
```

**Complexity**: Medium (conditional logic needed)

**Pros**:

- Leverages existing event hooks
- Catches up on every user action

**Cons**:

- Unpredictable resource usage
- May run unnecessarily if no missing embeddings
- Tight coupling between content tools and system-wide reconciliation

### Pattern 2: Scheduled Reconciliation

**Architecture**: Time-based cron → Process all missing

```typescript
// In apps/mcp/src/inngest/workflows/embeddingReconciliation.ts
export const embeddingReconciliation = inngest.createFunction(
  { id: "embedding-reconciliation" },
  { cron: "0 */6 * * *" },  // Every 6 hours
  async ({ step }) => {
    const projects = await step.run("get-projects", async () => {
      return Object.keys(getCodePaths());
    });

    for (const project of projects) {
      await step.run(`reconcile-${project}`, async () => {
        return generateEmbeddings({ project, limit: 0 });
      });
    }
  }
);
```

**Complexity**: Low (leverage existing Inngest infrastructure)

**Pros**:

- Predictable resource usage
- Simple to implement (single workflow file)
- Runs regardless of user activity
- Easy to configure (change cron schedule)

**Cons**:

- Requires Inngest dev server
- Slight staleness window (max = schedule interval)

### Pattern 3: Lazy Initialization

**Architecture**: Project switch → Check last catch-up → Trigger if stale

```typescript
// In project/resolve.ts or similar
export function setActiveProject(project: string): void {
  const lastCatchup = getLastCatchupTime(project);
  if (!lastCatchup || isStale(lastCatchup)) {
    triggerEmbedding({ project, limit: 0 }); // Background
  }
  // ... rest of project activation
}
```

**Complexity**: Medium (track last catch-up time per project)

**Pros**:

- Project-scoped (efficient)
- Only triggers when needed

**Cons**:

- Requires persistent state (last catch-up tracking)
- Single-project users may never trigger
- Additional complexity for state management

### Pattern 4: Hybrid (Scheduled + On-Demand)

**Architecture**: Multiple triggers (cron + session start), same processor

```typescript
// Scheduled reconciliation (every 6 hours)
export const scheduledReconciliation = inngest.createFunction(
  { cron: "0 */6 * * *" },
  async () => { /* ... */ }
);

// Session start reconciliation (immediate catch-up)
export const sessionStartReconciliation = inngest.createFunction(
  { event: "session/protocol.start" },
  async ({ event }) => { /* ... */ }
);
```

**Complexity**: Higher (multiple workflows, coordination needed)

**Pros**:

- Most robust (multiple safety nets)
- Fast catch-up on session start + background safety net

**Cons**:

- More complex
- Potential duplicate work (both triggers fire close together)
- Higher maintenance burden

---

## 3. Resource Profile Analysis

**Baseline Performance** (from analysis/035-embedding-trigger-strategy.md):

- Single note embedding: ~14ms
- Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
- Chunking: ~2000 chars per chunk, 15% overlap
- Batch API: Up to 32 chunks per batch request

### Workload Scenarios

| Trigger | Typical Missing | Time | Blocking | Resource Pattern |
|---------|----------------|------|----------|------------------|
| **Every write/edit** | 0-100 | 0-1.4s | No | Spiky, unpredictable |
| **Session start** | 0-1000 | 0-14s | No | Predictable spike |
| **Hourly cron** | 0-50 | 0-700ms | No | Smooth background |
| **6-hour cron** | 0-200 | 0-2.8s | No | Larger but infrequent |
| **Daily cron** | 0-800 | 0-11.2s | No | Largest but rare |

### User Experience Impact

| Pattern | UX Impact | Rationale |
|---------|-----------|-----------|
| **Write/edit piggyback** | Variable (0-1.4s CPU spike per action) | Unpredictable workload, user may notice slowdown during batch edits |
| **Session start** | Single 0-14s background spike | User expects some startup overhead, non-blocking |
| **Scheduled cron** | Zero (runs in background) | User unaware, no interaction |
| **Hybrid** | Same as session start + cron | Best of both worlds, higher complexity cost |

---

## 4. Separation of Concerns Assessment

### Should write/edit Tools Handle Global Catch-Up?

**Current Architecture**:

- `write_note`: Triggers embedding for THAT note (local responsibility)
- `edit_note`: Skips embedding (per analysis/035)

**Proposed Architecture** (Piggyback):

- `write_note`/`edit_note`: Trigger for that note + ALL missing notes (global responsibility)

### Architectural Boundary Analysis

| Concern | write_note/edit_note Responsibility | Catch-Up Responsibility |
|---------|-------------------------------------|------------------------|
| **Scope** | Single note content | All missing embeddings |
| **Intent** | User-initiated action | System maintenance |
| **Predictability** | Known (1 note) | Unknown (0-1000 notes) |
| **Atomicity** | Transactional (edit this note) | Bulk operation (process all missing) |

**Violation**: Piggybacking catch-up on content tools conflates:

1. **User action** (edit/write a specific note)
2. **System maintenance** (reconcile all missing embeddings)

These are distinct concerns:

- User action: Predictable, scoped, transactional
- System maintenance: Unpredictable, global, eventual consistency

**Design Principle**: Separate local operations from global reconciliation.

**Recommendation**: Keep write/edit tools focused on single-note responsibility. Use separate mechanism for catch-up.

---

## 5. Existing Infrastructure Assessment

### Inngest Availability

**Current State**:

- Inngest client: `apps/mcp/src/inngest/client.ts` (local dev mode)
- Health check: `checkInngestAvailability()` with 3s timeout
- Graceful degradation: Server continues if Inngest unavailable
- Workflows: 9 existing workflows (`sessionState.ts`, `sessionProtocolStart.ts`, etc.)

**Event Types**: 11 defined events in `events.ts`:

- `session/protocol.start`
- `session/protocol.end`
- `session/state.update`
- `orchestrator/agent.invoked`
- `orchestrator/agent.completed`
- (and 6 others)

**Precedent**: Existing `session/protocol.start` event demonstrates Inngest is already used for lifecycle triggers.

### Implementation Feasibility

**New Workflow Addition**:

```typescript
// apps/mcp/src/inngest/workflows/embeddingReconciliation.ts
import { inngest } from "../client";
import { generateEmbeddings } from "../../tools/embed";
import { getCodePaths } from "../../project/config";

export const embeddingReconciliation = inngest.createFunction(
  {
    id: "embedding-reconciliation",
    name: "Embedding Reconciliation"
  },
  { cron: "TZ=UTC 0 */6 * * *" },  // Every 6 hours
  async ({ step }) => {
    const projects = await step.run("list-projects", async () => {
      return Object.keys(getCodePaths());
    });

    const results = [];
    for (const project of projects) {
      const result = await step.run(`reconcile-${project}`, async () => {
        // Call existing embed tool handler
        return await generateEmbeddings({
          project,
          force: false,  // Only missing
          limit: 0       // No limit
        });
      });
      results.push({ project, result });
    }

    return {
      projectsProcessed: projects.length,
      results
    };
  }
);
```

**Export Addition**:

```typescript
// apps/mcp/src/inngest/index.ts
export { embeddingReconciliation } from "./workflows/embeddingReconciliation";
```

**Server Registration**:

```typescript
// apps/mcp/src/transport/http.ts (or wherever workflows are served)
import { embeddingReconciliation } from "../inngest";

serve({
  functions: [
    // ... existing workflows
    embeddingReconciliation,
  ]
});
```

**Complexity**: Low (if Inngest already set up), High (if Inngest not running)

---

## 6. User Expectation Analysis

**User Statement**: "I don't want to have to run it manually when embeddings fall behind"

**Interpretation**:

- User wants "set and forget" behavior
- User willing to accept background resource usage
- User prioritizes convenience over immediate consistency

**Design Implication**: Favor automatic triggers over manual invocation, even if there's a slight staleness window.

**User's Proposed Approach**: Piggyback on write/edit

**Architect's Counter-Proposal**: Scheduled reconciliation

**Why the Change**:

1. **Separation of concerns**: Content tools stay focused on single-note operations
2. **Resource predictability**: Scheduled runs are predictable, not spiky
3. **Implementation simplicity**: Leverage existing Inngest infrastructure
4. **User visibility**: User can check Inngest dashboard to see reconciliation runs

---

## 7. Trade-Off Matrix

| Criterion | Write/Edit Piggyback | Session Start | Scheduled Cron | Hybrid |
|-----------|---------------------|---------------|----------------|--------|
| **Complexity** | Medium | Medium | Low | High |
| **Resource Predictability** | Low (spiky) | Medium (per session) | High (time-based) | Medium |
| **Staleness Window** | Minimal (after write) | Per session | Up to schedule interval | Minimal |
| **Separation of Concerns** | ❌ Violates | ✅ Clean | ✅ Clean | ✅ Clean |
| **Implementation Effort** | Low (modify 2 tools) | Medium (state tracking) | Low (single workflow) | High (multiple workflows) |
| **Infrastructure Dependency** | None | None | Inngest required | Inngest required |
| **User Awareness** | None (invisible) | Startup delay notice | None (background) | Startup delay + background |
| **Robustness** | Medium (depends on user activity) | Medium (depends on sessions) | High (always runs) | Very High (multiple safety nets) |

---

## 8. Recommended Architecture

### Primary Trigger: Scheduled Reconciliation (Pattern 2)

**Why**:

1. **Separation of Concerns**: Keeps content tools focused on single-note operations
2. **Predictable Resources**: Time-based scheduling provides known resource profile
3. **Simplicity**: Single workflow file, leverages existing Inngest infrastructure
4. **Robustness**: Runs regardless of user activity (true background)
5. **Configurability**: Easy to adjust schedule (hourly, 6-hourly, daily)

**Implementation**:

```typescript
// apps/mcp/src/inngest/workflows/embeddingReconciliation.ts
export const embeddingReconciliation = inngest.createFunction(
  { id: "embedding-reconciliation" },
  { cron: "TZ=UTC 0 */6 * * *" },  // Every 6 hours
  async ({ step }) => {
    const projects = Object.keys(getCodePaths());

    for (const project of projects) {
      await step.run(`reconcile-${project}`, async () => {
        return generateEmbeddings({ project, limit: 0 });
      });
    }
  }
);
```

**Schedule Recommendation**: Every 6 hours

- **Rationale**: Balances staleness (max 6-hour window) with resource efficiency
- **Alternative**: Hourly (lower staleness) or Daily (lower resource usage)

### Secondary Trigger: None (Keep It Simple)

**Rationale**: Scheduled reconciliation alone provides adequate coverage. Adding session-start or piggyback triggers increases complexity without significant user benefit.

**Future Enhancement**: If user feedback indicates 6-hour staleness is unacceptable, consider adding session-start trigger (Pattern 4: Hybrid).

---

## 9. Rejected Approaches

### Approach 1: Write/Edit Piggyback

**Why Rejected**:

- Violates separation of concerns (local vs global operations)
- Unpredictable resource usage (0-1000 missing notes)
- Tight coupling between content tools and system maintenance

**When to Reconsider**: If scheduled reconciliation proves insufficient and users demand real-time catch-up.

### Approach 2: Session Start Trigger

**Why Rejected**:

- More complex than scheduled cron (requires state tracking)
- Less robust (depends on user starting sessions)
- Single-project users may never switch projects

**When to Reconsider**: If users report frequent context switching and want immediate catch-up on project activation.

### Approach 3: Idle Detection

**Why Rejected**:

- High complexity (activity tracking required)
- Unpredictable timing (may never trigger for active users)
- No clear user benefit over scheduled approach

**When to Reconsider**: If scheduled reconciliation causes noticeable resource impact and opportunistic scheduling is needed.

---

## 10. Implementation Complexity

### Option Comparison

| Option | Files to Modify | New Files | Test Complexity | Effort Estimate |
|--------|----------------|-----------|-----------------|-----------------|
| **Scheduled Cron** | 2 (index.ts, http.ts) | 1 (embeddingReconciliation.ts) | Low (single workflow test) | 2-4 hours |
| **Session Start** | 3 (bootstrap-context, session, embed) | 1 (state tracking) | Medium (state management tests) | 6-8 hours |
| **Write/Edit Piggyback** | 2 (tools/index.ts, embed) | 0 | Medium (edge case testing) | 4-6 hours |
| **Hybrid** | 4 (all of above) | 2 (two workflows) | High (coordination tests) | 10-12 hours |

### Recommended Implementation Steps

**Phase 1: Core Workflow (Estimated: 2-4 hours)**

1. Create `apps/mcp/src/inngest/workflows/embeddingReconciliation.ts`
2. Export workflow in `apps/mcp/src/inngest/index.ts`
3. Register workflow in HTTP transport
4. Write unit tests for workflow logic

**Phase 2: Configuration (Estimated: 1 hour)**

1. Add `EMBEDDING_RECONCILIATION_CRON` environment variable (default: `0 */6 * * *`)
2. Document configuration in README
3. Add logging for reconciliation runs

**Phase 3: Monitoring (Estimated: 1 hour)**

1. Add Inngest dashboard documentation
2. Add logging for processed/failed notes
3. Document expected resource usage

**Total Effort**: 4-6 hours

---

## 11. Decision

### Verdict: Scheduled Reconciliation (Pattern 2)

**Selected Trigger**: Inngest cron workflow running every 6 hours

**Rationale**:

1. **Simplicity**: Leverages existing Inngest infrastructure with minimal new code
2. **Separation of Concerns**: Keeps content tools focused on single-note operations
3. **Predictability**: Time-based scheduling provides known resource profile
4. **Robustness**: Runs regardless of user activity
5. **Low Complexity**: Single workflow file, straightforward testing

**Trade-Offs Accepted**:

- **Staleness Window**: Up to 6 hours between reconciliation runs
- **Infrastructure Dependency**: Requires Inngest dev server running

**Rejected Alternatives**:

- **Write/Edit Piggyback**: Violates separation of concerns, unpredictable resource usage
- **Session Start**: More complex, less robust than scheduled approach
- **Hybrid**: Unnecessary complexity for initial implementation

### Implementation Path

**Immediate** (This PR):

1. Create scheduled reconciliation workflow
2. Configure 6-hour cron schedule
3. Add basic logging and monitoring

**Future Enhancements** (If Needed):

1. Add session-start trigger if users report 6-hour staleness is too long
2. Add configuration UI for schedule adjustment
3. Add project-specific reconciliation controls

---

## 12. Appendices

### A. Performance Calculations

**Worst-Case Scenario**: 1000 missing embeddings

- Time: 1000 notes × 14ms/note = 14,000ms = 14s
- Resource: Background CPU usage, non-blocking
- Frequency: Every 6 hours

**Typical Scenario**: 50 missing embeddings (estimate)

- Time: 50 notes × 14ms/note = 700ms
- Resource: Negligible
- Frequency: Every 6 hours

### B. Inngest Cron Syntax

```typescript
{ cron: "TZ=UTC 0 */6 * * *" }
```

- `TZ=UTC`: Timezone
- `0`: Minute (top of the hour)
- `*/6`: Every 6 hours
- `* * *`: Every day, every month, every day of week

**Alternative Schedules**:

- Hourly: `0 * * * *`
- Every 12 hours: `0 */12 * * *`
- Daily at midnight: `0 0 * * *`

### C. Related Documents

- `apps/mcp/.agents/analysis/035-embedding-trigger-strategy.md` - Prior analysis of edit_note triggering
- `apps/mcp/src/inngest/workflows/sessionState.ts` - Example Inngest workflow
- `apps/mcp/src/tools/embed/index.ts` - Embedding generation implementation

### D. Open Questions

1. **Should reconciliation run if Inngest is unavailable?**
   - Recommendation: No, graceful degradation (user runs manual `brain embed`)

2. **Should reconciliation be configurable per-project?**
   - Recommendation: Not initially, add if user feedback demands it

3. **Should reconciliation notify user when complete?**
   - Recommendation: Log only, no user notification (background operation)
