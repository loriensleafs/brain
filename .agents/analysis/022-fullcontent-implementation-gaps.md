# Analysis: fullContent Implementation Gaps

## Objective

Verify 4 specific fullContent-related issues in current implementation:

1. Related notes full content fetching (depth > 0 + fullContent)
2. Bootstrap accepts full_context parameter (should not)
3. Feature task enrichment missing fullContent
4. CLI search hybrid mode support

## Context

User identified potential gaps in fullContent parameter handling across search, bootstrap, and CLI components. Quick verification needed before implementation work.

## Analysis

### Issue 1: Related Notes Full Content

**Current State**: NO - not working

**Gap**: `expandWithRelations()` in SearchService (lines 543-584) does NOT call `enrichWithFullContent()` for related notes. The enrichment happens at line 178-180 BEFORE expansion.

**Code Flow**:

```typescript
// Line 173-180 in search/index.ts
if (opts.depth > 0) {
  results = await this.expandWithRelations(results, opts.depth, resolvedProject);
}

// Fetch full content if requested
if (opts.fullContent) {
  results = await this.enrichWithFullContent(results, resolvedProject);
}
```

This ORDER is CORRECT. Full content enrichment happens AFTER expansion, so it SHOULD enrich both direct matches AND related notes.

**CORRECTION**: Actually works as designed. The enrichment at line 178-180 processes ALL results in the array, including related notes added by `expandWithRelations()`.

**Current State (revised)**: YES - works correctly

**Verification**: `enrichWithFullContent()` at lines 344-364 maps over ALL results, not just direct matches.

**Fix Required**: None

**Files**: None

**Effort**: N/A

---

### Issue 2: Bootstrap Accepts full_context Parameter

**Current State**: YES - has the parameter (SHOULD NOT per user)

**Gap**: `schema.ts` lines 25-32 define `full_context` parameter in `BootstrapContextArgsSchema`.

**Code**:

```typescript
full_context: z
  .boolean()
  .default(false)
  .describe(
    "When true, includes full note content for features, decisions, and activity. " +
      "Default (false) returns compact wikilink references only. " +
      "Use for rich context injection when token cost is acceptable."
  ),
```

Tool definition at lines 70-76 also documents it.

**Fix Required**: Remove `full_context` parameter from bootstrap_context tool schema and implementation

**Files to Modify**:

- `apps/mcp/src/tools/bootstrap-context/schema.ts` (remove lines 25-32, 70-76)
- `apps/mcp/src/tools/bootstrap-context/index.ts` (remove usage of full_context)
- `apps/mcp/src/tools/bootstrap-context/structuredOutput.ts` (remove full_context handling)
- `apps/mcp/src/tools/bootstrap-context/formattedOutput.ts` (remove full_context handling)

**Effort**: S (small - straightforward parameter removal)

---

### Issue 3: Feature Task Enrichment Missing

**Current State**: NO - not implemented

**Gap**: `sessionEnrichment.ts` does NOT query task notes for features. It only queries task notes for `activeTask` and feature notes for `activeFeature`.

**Code Analysis**:

```typescript
// Lines 145-152 - only queries for activeTask and activeFeature
const taskNotes: ContextNote[] = sessionState.activeTask
  ? await queryTaskNotes(project, sessionState.activeTask, maxTaskNotes)
  : [];

const featureNotes: ContextNote[] = sessionState.activeFeature
  ? await queryFeatureNotes(project, sessionState.activeFeature, maxFeatureNotes)
  : [];
```

No logic to:

1. Parse feature notes for task references
2. Query each task note individually
3. Fetch full content for tasks

**Fix Required**: Add `enrichFeatureWithTasks()` function that:

- Takes feature notes array
- Extracts task wikilinks from each feature
- Queries each task with fullContent=true
- Returns enriched task notes array

**Files to Modify**:

- `apps/mcp/src/tools/bootstrap-context/sessionEnrichment.ts` (add enrichFeatureWithTasks function)

**Effort**: M (medium - requires parsing, multiple queries, integration)

---

### Issue 4: CLI Hybrid Search Mode

**Current State**: YES/NO - hybrid mode exists in MCP but NOT exposed in CLI

**Gap**:

CLI `search.go` line 91:

```go
searchCmd.Flags().StringVarP(&searchMode, "mode", "m", "auto", "Search mode: auto, semantic, keyword")
```

MCP `search/schema.ts` line 31-34:

```typescript
mode: z
  .enum(["auto", "semantic", "keyword"])
  .default("auto")
```

SearchService IMPLEMENTS hybrid mode (lines 144-152) but schema does NOT expose it.

**Fix Required**:

1. Add "hybrid" to SearchArgsSchema enum in `apps/mcp/src/tools/search/schema.ts`
2. Update toolDefinition description to document hybrid mode
3. Update CLI help text in `apps/tui/cmd/search.go` to document hybrid mode

**Files to Modify**:

- `apps/mcp/src/tools/search/schema.ts` (add "hybrid" to enum, update docs)
- `apps/tui/cmd/search.go` (update help text)

**Effort**: XS (extra small - just expose existing functionality)

---

## Summary Table

| Issue | Works? | Gap | Effort |
|-------|--------|-----|--------|
| 1. Related notes fullContent | YES | None (works as designed) | N/A |
| 2. Bootstrap full_context param | NO | Should not accept parameter | S |
| 3. Feature task enrichment | NO | Missing enrichFeatureWithTasks() | M |
| 4. CLI hybrid mode | NO | Not exposed in schema/CLI | XS |

## Recommendations

**Priority Order**:

1. Issue 4 (XS effort) - Quick win, expose existing functionality
2. Issue 2 (S effort) - Remove unused parameter
3. Issue 3 (M effort) - Requires design decision on feature/task relationship

**Issue 1 Clarification**: No fix needed. Full content enrichment happens AFTER relation expansion, so ALL results (direct + related) get full content when `fullContent=true`.

## Conclusion

**Verdict**: 3 out of 4 issues require fixes

**Confidence**: High

**Rationale**: Code analysis confirms gaps exist in Issues 2, 3, 4. Issue 1 is a false positive (works correctly).

### User Impact

**Issue 2**: Removes confusing unused parameter from bootstrap API
**Issue 3**: Enables richer task context for feature-related sessions
**Issue 4**: Exposes existing hybrid search capability to CLI users

**Effort required**: XS + S + M = approximately 4-8 hours total

**Risk if ignored**:

- Issue 2: API confusion, potential misuse
- Issue 3: Incomplete session context for feature work
- Issue 4: Users cannot access hybrid mode via CLI
