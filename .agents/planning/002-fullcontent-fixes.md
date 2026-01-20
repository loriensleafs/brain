# Plan: fullContent Implementation Fixes

## Overview

Quick bug fix and enhancement session addressing 3 gaps in fullContent parameter handling across bootstrap, search, and CLI components.

## Objectives

- [ ] Expose hybrid search mode in CLI and MCP schema
- [ ] Remove unused full_context parameter from bootstrap_context tool
- [ ] Add feature task enrichment to session context injection

## Scope

### In Scope

- Schema updates (MCP search tool)
- CLI flag additions (search command)
- Parameter removal (bootstrap_context)
- Session enrichment enhancement (feature tasks)

### Out of Scope

- Related notes fullContent (Issue 1 - already works correctly)
- Full content caching or performance optimization
- Additional search modes beyond hybrid

## Milestones

### Milestone 1: CLI Hybrid Mode Support

**Status**: [PENDING]
**Goal**: Expose existing hybrid search mode to CLI and MCP users
**Estimated Effort**: 30 minutes
**Deliverables**:

- [ ] Add "hybrid" to SearchArgsSchema enum in `apps/mcp/src/tools/search/schema.ts`
- [ ] Update toolDefinition description to document hybrid mode behavior
- [ ] Update CLI help text in `apps/tui/cmd/search.go` to include hybrid option

**Acceptance Criteria**:

- `brain search --mode hybrid "query"` executes successfully
- MCP search tool accepts `mode: "hybrid"` parameter
- Help text documents hybrid as "keyword + semantic fusion"

**Dependencies**: None

---

### Milestone 2: Remove Bootstrap full_context Parameter

**Status**: [PENDING]
**Goal**: Remove unused parameter causing API confusion
**Estimated Effort**: 30 minutes
**Deliverables**:

- [ ] Remove `full_context` from `BootstrapContextArgsSchema` in `schema.ts`
- [ ] Remove `full_context` from tool definition documentation
- [ ] Remove `full_context` handling from `index.ts` handler
- [ ] Remove `full_context` from `structuredOutput.ts` processing
- [ ] Remove `full_context` from `formattedOutput.ts` formatting

**Acceptance Criteria**:

- `bootstrap_context` tool schema validation rejects `full_context` parameter
- All references to `full_context` removed from bootstrap codebase
- Existing bootstrap calls (without full_context) continue working

**Dependencies**: None (independent of Milestone 1)

---

### Milestone 3: Feature Task Enrichment

**Status**: [PENDING]
**Goal**: Enrich session context with task notes when feature is active
**Estimated Effort**: 2-3 hours
**Deliverables**:

- [ ] Add `enrichFeatureWithTasks()` function to `sessionEnrichment.ts`
- [ ] Extract task wikilinks from feature note content
- [ ] Query each task note with `fullContent=true`
- [ ] Integrate task notes into session context structure
- [ ] Add error handling for missing task notes

**Acceptance Criteria**:

- When `activeFeature` is set and feature note contains task wikilinks, bootstrap returns task note full content
- Task notes section populated with task titles and full content
- Bootstrap execution time remains under 5 seconds for features with up to 10 tasks
- Missing tasks logged but do not block bootstrap execution

**Dependencies**: None (independent of Milestones 1-2)

---

## Implementation Order

**Priority sequence**:

1. **Milestone 1** (XS effort) - Quick win, high user value
2. **Milestone 2** (S effort) - API cleanup, prevents misuse
3. **Milestone 3** (M effort) - Feature enhancement

**Rationale**: Do smallest, highest-value changes first. Milestone 3 requires most design consideration.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Task wikilink parsing fragile | Medium | Medium | Use robust regex, handle malformed links gracefully |
| Bootstrap performance degradation | Low | Medium | Limit max tasks queried (10), use parallel queries |
| Schema change breaks existing clients | Low | High | Hybrid mode is additive (backward compatible) |
| Bootstrap parameter removal breaks users | Low | Low | No evidence of full_context usage in codebase |

## Technical Approach

### Milestone 1: Schema Extension

**Approach**: Additive change to enum, backward compatible.

```typescript
mode: z
  .enum(["auto", "semantic", "keyword", "hybrid"])
  .default("auto")
```

### Milestone 2: Parameter Removal

**Approach**: Grep for all `full_context` references, delete systematically.

**Files to modify**:

- `apps/mcp/src/tools/bootstrap-context/schema.ts`
- `apps/mcp/src/tools/bootstrap-context/index.ts`
- `apps/mcp/src/tools/bootstrap-context/structuredOutput.ts`
- `apps/mcp/src/tools/bootstrap-context/formattedOutput.ts`

### Milestone 3: Task Enrichment

**Approach**: Add new enrichment step in session context pipeline.

**Pseudocode**:

```typescript
async function enrichFeatureWithTasks(
  featureNotes: ContextNote[],
  project: Project
): Promise<ContextNote[]> {
  const taskWikilinks = extractTaskWikilinks(featureNotes);
  const taskNotes = await Promise.all(
    taskWikilinks.map(link =>
      searchService.search({ query: link, fullContent: true, limit: 1, project })
    )
  );
  return taskNotes.flat().slice(0, 10); // Limit 10 tasks
}
```

**Files to modify**:

- `apps/mcp/src/tools/bootstrap-context/sessionEnrichment.ts`

## Success Criteria

**Overall**:

- [ ] All 3 milestones marked [COMPLETE]
- [ ] Hybrid mode documented in CLI help and MCP schema
- [ ] Bootstrap no longer accepts full_context parameter
- [ ] Feature sessions include enriched task context
- [ ] All tests pass (existing + new)
- [ ] Markdown linting passes

**Verification**:

```bash
# Milestone 1
brain search --mode hybrid "authentication"

# Milestone 2
# Verify full_context rejected in schema validation

# Milestone 3
# Start session with activeFeature containing task wikilinks
# Verify bootstrap returns task full content
```

## Dependencies

**External**: None

**Internal**: All milestones are independent and can be implemented in parallel or sequentially.

## Files Modified (Summary)

| File | Milestone | Change Type |
|------|-----------|-------------|
| `apps/mcp/src/tools/search/schema.ts` | 1 | Add enum value |
| `apps/tui/cmd/search.go` | 1 | Update help text |
| `apps/mcp/src/tools/bootstrap-context/schema.ts` | 2 | Remove parameter |
| `apps/mcp/src/tools/bootstrap-context/index.ts` | 2 | Remove parameter usage |
| `apps/mcp/src/tools/bootstrap-context/structuredOutput.ts` | 2 | Remove parameter handling |
| `apps/mcp/src/tools/bootstrap-context/formattedOutput.ts` | 2 | Remove parameter handling |
| `apps/mcp/src/tools/bootstrap-context/sessionEnrichment.ts` | 3 | Add enrichment function |

**Total Files**: 7
