# Session 04: Embedding Catch-Up Trigger Implementation

**Date**: 2026-01-20
**Agent**: implementer
**Branch**: main
**Starting Commit**: (to be recorded)

## Session Start Checklist

- [x] Initialize Brain MCP (not available - using file-based context)
- [x] Read strategic verdict (038-catchup-trigger-verdict.md)
- [x] Read architecture analysis (embedding-catchup-architecture.md)
- [x] Read requirements analysis (037-embedding-catchup-requirements.md)
- [x] Create session log
- [x] Verify git branch (main)

## Objective

Implement embedding catch-up trigger on session start (bootstrap_context) per strategic verdict 038.

**Strategic Decision**: Project activation trigger (P0) - run catch-up check on every bootstrap_context call.

**Key Insight**: "If there aren't any missing, it's almost instant" - validation query is negligible cost.

## Artifacts Review

**Strategic Verdict** (038-catchup-trigger-verdict.md):
- Decision: PROJECT ACTIVATION (with simplification)
- Priority: P0 for initial implementation
- Rationale: Session start = catch-up eliminates need for scheduled reconciliation
- Action: Add catch-up trigger to bootstrap_context (4 hour estimate)

**Architecture Analysis** (embedding-catchup-architecture.md):
- Architect recommended: Scheduled reconciliation (Pattern 2)
- High-level-advisor overruled: Session start trigger (Pattern 3 variant)
- Reason: User behavior pattern makes scheduled approach over-engineered

**Requirements Analysis** (037-embedding-catchup-requirements.md):
- P0: Project activation trigger
- Detection query: `SELECT DISTINCT n.permalink FROM notes n LEFT JOIN brain_embeddings e ON n.permalink = e.entity_id WHERE e.entity_id IS NULL`
- Fire-and-forget: Non-blocking background batch

## Implementation Plan

Total estimate: 4 hours

### TASK-001: Implement Missing Embeddings Query (1 hour)

**File**: Create `apps/mcp/src/tools/bootstrap-context/catchupTrigger.ts`

**Acceptance criteria**:
- Query returns count of notes without embeddings
- Empty result set returns 0
- Database errors handled gracefully
- Project parameter validated

### TASK-002: Implement Batch Embedding Trigger (1 hour)

**File**: Same file (`catchupTrigger.ts`)

**Logging checklist**:
- [ ] Trigger event with count and project
- [ ] Completion event with stats
- [ ] Error event with failure details

### TASK-003: Integrate into bootstrap_context (30 min)

**File**: `apps/mcp/src/tools/bootstrap-context/index.ts`

**Integration point**: After context building completes, before return

### TASK-004: Add Tests (1.5 hours)

**File**: Create `apps/mcp/src/tools/bootstrap-context/__tests__/catchupTrigger.test.ts`

**Test cases**:
- Query returns correct count
- Zero count skips batch trigger
- Non-zero count triggers batch
- Logging events emitted
- Fire-and-forget doesn't block
- Error handling works

## Implementation Notes

(To be filled during implementation)

## Session End Checklist

- [ ] All tasks implemented or deferred with rationale
- [ ] Tests pass (bun test)
- [ ] Build succeeds (bun run typecheck)
- [ ] Commits made with conventional messages
- [ ] Security flagging completed
- [ ] Implementation notes documented
- [ ] Files changed list accurate

## Evidence

| Requirement | Evidence | Status |
|-------------|----------|--------|
| Session log created | This file | [COMPLETE] |
| Branch verified | main | [COMPLETE] |
| Strategic verdict read | 038-catchup-trigger-verdict.md | [COMPLETE] |
| Tests passing | (pending) | [PENDING] |
| Build passing | (pending) | [PENDING] |

## Handoff

(To be completed at session end)
