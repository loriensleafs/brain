# Plan: Search Full Context Enhancement

## Overview

Add `full_context` parameter to search tool and CLI to optionally return complete note content instead of compact snippets. Bootstrap internally uses this feature when enriching session context.

## Objectives

- [PENDING] Add `full_context` parameter to search tool (default: false)
- [PENDING] Enhance search service to support full content retrieval
- [PENDING] Add CLI search `--full-context` flag
- [PENDING] Bootstrap calls search with full_context=true internally
- [PENDING] All tests pass with new parameter

## Scope

### In Scope

- Search tool schema enhancement (apps/mcp/src/tools/search/)
- SearchService enhancement to retrieve full content when requested
- CLI search command flag addition (apps/tui/cmd/search.go)
- Bootstrap internal search calls enhanced
- Test coverage for full_context parameter

### Out of Scope

- Bootstrap tool parameter changes (bootstrap_context does NOT expose full_context)
- CLI bootstrap command changes (bootstrap command unchanged)
- Hook changes (hooks call bootstrap as-is)
- Formatted output changes (bootstrap formatting unaffected)

## Milestones

### Milestone 1: SearchService Enhancement

**Status**: [PENDING]
**Goal**: SearchService can retrieve full note content when requested
**Estimated Effort**: 2 hours (based on read_note integration pattern)

**Deliverables**:

- [ ] Add `fullContent?: boolean` to SearchOptions type
- [ ] Update SearchResult type to include optional `fullContent?: string` field
- [ ] Modify `convertSearchResultsToContextNotes` helper to fetch full content when flag is true
- [ ] Add private method `fetchFullContent(permalink: string, project?: string)` to SearchService
- [ ] Update executeKeywordSearch to respect fullContent flag
- [ ] Update executeSemanticSearch to respect fullContent flag

**Acceptance Criteria**:

- [ ] SearchOptions includes fullContent boolean (default: false)
- [ ] SearchResult includes fullContent string field
- [ ] When fullContent=true, results include complete note content from basic-memory read_note
- [ ] When fullContent=false, results include compact snippet (current behavior)
- [ ] All existing tests pass with fullContent=false
- [ ] No performance degradation for compact mode (default)

**Dependencies**: None

**Technical Notes**:

- Use basic-memory read_note tool to fetch full content
- Cache full content results per permalink to avoid duplicate reads
- Limit full content to first 5000 chars per note (prevent token explosion)

---

### Milestone 2: Search Tool Schema Update

**Status**: [PENDING]
**Goal**: Search MCP tool accepts full_context parameter
**Estimated Effort**: 1 hour

**Deliverables**:

- [ ] Add `full_context` boolean to SearchArgsSchema (apps/mcp/src/tools/search/schema.ts)
- [ ] Update toolDefinition description to document full_context parameter
- [ ] Pass full_context to SearchService in handler (apps/mcp/src/tools/search/index.ts)
- [ ] Map fullContent from SearchResult to tool output

**Acceptance Criteria**:

- [ ] Schema validates full_context boolean parameter (default: false)
- [ ] Tool description documents full_context behavior
- [ ] Handler passes full_context to SearchService.search options
- [ ] Tool output includes fullContent field when full_context=true
- [ ] Backward compatible (omitting full_context works as before)

**Dependencies**: Milestone 1 (SearchService enhancement)

**Technical Notes**:

- Keep parameter name `full_context` (snake_case) for MCP tool consistency
- Map to `fullContent` (camelCase) for TypeScript SearchOptions

---

### Milestone 3: CLI Search Flags

**Status**: [PENDING]
**Goal**: CLI search command supports --project (required) and --full-context (optional) flags
**Estimated Effort**: 1.5 hours

**Deliverables**:

- [ ] Add `searchProject string` variable (apps/tui/cmd/search.go)
- [ ] Add `searchFullContext bool` variable (apps/tui/cmd/search.go)
- [ ] Add `--project` flag to searchCmd.Flags() (required with auto-resolution fallback)
- [ ] Add `--full-context` flag to searchCmd.Flags() (optional)
- [ ] Implement project auto-resolution when --project omitted but CWD resolvable
- [ ] Show error if --project missing and auto-resolution fails
- [ ] Pass project and full_context in toolArgs
- [ ] Update printSearchResults to show full content when present
- [ ] Update CLI help text to document both flags

**Acceptance Criteria**:

- [ ] `--project` flag is required (shows error if missing and can't auto-resolve)
- [ ] `--full-context` flag is optional (defaults to false)
- [ ] Both flags can be used together: `brain search "query" --project myproj --full-context`
- [ ] Auto-resolution works when --project omitted but CWD contains .brain/ or .git/
- [ ] `brain search "query" --full-context` includes full note content in output
- [ ] `brain search "query"` returns compact snippets (current behavior)
- [ ] SearchResult struct includes FullContent string field
- [ ] printSearchResults shows full content when present (not snippet)
- [ ] Help text explains both --project and --full-context behavior

**Dependencies**: Milestone 2 (tool schema update)

**Technical Notes**:

- Project auto-resolution follows existing pattern in other commands
- Only show full content when FullContent field is non-empty
- Truncate display at 2000 chars with "..." if content exceeds limit
- Keep snippet display for backward compatibility when FullContent is empty
- Error message for missing project should suggest using --project flag or running from project directory

---

### Milestone 4: Bootstrap Internal Enhancement

**Status**: [PENDING]
**Goal**: Bootstrap calls search with full_context=true for session enrichment
**Estimated Effort**: 30 minutes

**Deliverables**:

- [ ] Update sessionEnrichment.ts queryTaskNotes to pass fullContent: true to search
- [ ] Update sessionEnrichment.ts queryFeatureNotes to pass fullContent: true to search
- [ ] Update sectionQueries.ts functions to pass fullContent: true to search
- [ ] Map fullContent from SearchResult to ContextNote.content

**Acceptance Criteria**:

- [ ] Session enrichment searches return full note content
- [ ] Section queries (features, decisions, bugs, activity) return full note content
- [ ] Bootstrap formatted output includes expanded context
- [ ] ContextNote.content field populated with full text (not snippet)
- [ ] No impact on bootstrap tool signature (internal change only)

**Dependencies**: Milestone 2 (tool schema update)

**Technical Notes**:

- Changes are internal to bootstrap implementation
- No bootstrap_context tool parameter changes required
- Hook output format remains unchanged
- Bootstrap formatted output naturally benefits from richer content

---

### Milestone 5: Testing & Validation

**Status**: [PENDING]
**Goal**: Comprehensive test coverage for full_context parameter
**Estimated Effort**: 2 hours

**Deliverables**:

- [ ] Unit tests for SearchService with fullContent option
- [ ] Integration tests for search tool with full_context parameter
- [ ] CLI test for brain search --full-context flag
- [ ] Bootstrap integration test verifying full content retrieval
- [ ] Performance test ensuring no degradation in compact mode

**Acceptance Criteria**:

- [ ] Test coverage: 80% minimum for new code paths
- [ ] Unit tests verify fullContent=true fetches full note content
- [ ] Unit tests verify fullContent=false returns snippets
- [ ] Integration test verifies MCP tool full_context parameter works
- [ ] CLI test verifies --full-context flag works end-to-end
- [ ] Performance test confirms no regression in default mode

**Dependencies**: Milestones 1-4 (all implementation complete)

**Test Cases**:

1. SearchService.search with fullContent: true returns full content
2. SearchService.search with fullContent: false returns snippets
3. Search tool with full_context=true includes fullContent in results
4. CLI search --full-context displays full content
5. Bootstrap session enrichment includes full content in ContextNotes

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Full content retrieval is slow | Medium | High | Cache read_note results per permalink; limit to 5000 chars |
| Token explosion in Claude context | Medium | High | Limit full content to 5000 chars per note; limit result count |
| Breaking backward compatibility | Low | High | Default fullContent=false; make parameter optional |
| Basic-memory read_note errors | Low | Medium | Graceful fallback to snippet on read failure |

## Dependencies

- SearchService abstraction (exists)
- Basic-memory read_note tool (exists)
- Search tool schema validation (exists)
- CLI MCP client integration (exists)

## Technical Approach

**Layered Enhancement Pattern**:

1. **Service Layer** (SearchService): Add fullContent retrieval logic using basic-memory read_note
2. **Tool Layer** (search tool): Expose full_context parameter and pass to service
3. **CLI Layer** (search command): Add --full-context flag and display full content
4. **Bootstrap Layer** (internal): Call search with fullContent: true for enrichment

**Full Content Retrieval Strategy**:

```typescript
// In SearchService
private async fetchFullContent(permalink: string, project?: string): Promise<string> {
  const client = await getBasicMemoryClient();
  const result = await client.callTool({
    name: "read_note",
    arguments: { identifier: permalink, project }
  });

  // Extract text content from MCP response
  const text = extractTextContent(result);

  // Limit to prevent token explosion
  return text.slice(0, 5000);
}

// Use in search execution
if (options.fullContent) {
  for (const result of results) {
    result.fullContent = await this.fetchFullContent(result.permalink, project);
  }
}
```

**Bootstrap Integration**:

```typescript
// sessionEnrichment.ts - queryTaskNotes
const response = await search.search(taskIdentifier, {
  project,
  limit,
  mode: "auto",
  fullContent: true, // NEW: Get full content for session enrichment
});

// Map fullContent to ContextNote.content
return response.results.map(result => ({
  title: result.title,
  permalink: result.permalink,
  type: detectNoteType(...),
  status: parseStatus(...),
  content: result.fullContent || result.snippet, // Use full content if available
  file_path: result.permalink,
}));
```

**CLI Display Strategy**:

```go
// search.go - printSearchResults
func printSearchResults(results []SearchResult) {
  for i, r := range results {
    fmt.Printf("%d. %s\n", i+1, r.Title)
    fmt.Printf("   %s\n", r.Permalink)

    // Show full content if available
    if r.FullContent != "" {
      content := r.FullContent
      if len(content) > 2000 {
        content = content[:2000] + "..."
      }
      fmt.Printf("   %s\n", content)
    } else if r.Snippet != "" {
      // Fallback to snippet
      snippet := r.Snippet
      if len(snippet) > 100 {
        snippet = snippet[:100] + "..."
      }
      fmt.Printf("   %s\n", snippet)
    }
    fmt.Println()
  }
}
```

## Success Criteria

How we know the plan is complete:

- [ ] Search tool accepts full_context parameter (backward compatible)
- [ ] SearchService retrieves full note content when fullContent=true
- [ ] CLI search --full-context flag displays complete notes
- [ ] Bootstrap session enrichment includes full content in ContextNotes
- [ ] All tests pass with 80%+ coverage
- [ ] No performance regression in default compact mode
- [ ] Documentation updated with full_context usage examples

## Parallelization Opportunities

**Independent Work Streams**:

| Stream | Milestones | Blocking Dependencies |
|--------|-----------|----------------------|
| **A: Service Layer** | M1 (SearchService) | None - can start immediately |
| **B: Tool Layer** | M2 (search tool schema) | M1 complete |
| **C: CLI Layer** | M3 (CLI flag) | M2 complete |
| **D: Bootstrap Layer** | M4 (internal calls) | M2 complete |
| **E: Testing** | M5 (tests) | M1-M4 complete |

**Optimal Execution Sequence**:

1. **Phase 1** (2 hours): M1 only - SearchService enhancement
2. **Phase 2** (2 hours, parallel): M2 + M3 + M4 - Tool, CLI, Bootstrap (all depend on M1)
3. **Phase 3** (2 hours): M5 - Testing and validation

**Total Estimated Effort**: 6 hours (can be completed in 3 phases over 1 day)

## Pre-PR Validation Requirements

**MANDATORY**: All validation tasks MUST complete before PR creation.

### Validation Work Package

**Assignee**: QA Agent
**Blocking**: PR creation
**Estimated Effort**: 1-2 hours

#### Task 1: Cross-Cutting Concerns Audit

- [ ] Verify no hardcoded project paths
- [ ] Verify all error handling includes fallback to snippet
- [ ] Verify no TODO/FIXME/XXX placeholders
- [ ] Verify content length limits enforced (5000 chars)

#### Task 2: Fail-Safe Design Verification

- [ ] Verify fullContent defaults to false (backward compatible)
- [ ] Verify read_note failures gracefully fall back to snippet
- [ ] Verify empty fullContent handled correctly in CLI display
- [ ] Verify token limits not exceeded in bootstrap enrichment

#### Task 3: Test-Implementation Alignment

- [ ] Verify test parameters match implementation defaults
- [ ] Verify CLI flag name matches tool parameter name (full_context)
- [ ] Verify code coverage meets 80% threshold
- [ ] Verify edge cases covered (empty content, read errors, long content)

#### Task 4: CI Environment Simulation

- [ ] Run tests in CI mode (GITHUB_ACTIONS=true)
- [ ] Verify build succeeds with new code
- [ ] Verify no new linting errors
- [ ] Document any platform-specific behavior

#### Task 5: Environment Variable Completeness

- [ ] Verify BM_PROJECT/BRAIN_PROJECT resolution works
- [ ] Verify no new environment variables required
- [ ] Verify project resolution fallback chain intact
- [ ] Document any configuration changes

### Acceptance Criteria

- All 5 validation tasks complete
- QA agent provides validation evidence
- Orchestrator receives APPROVED verdict
- No blocking issues identified

### Dependencies

- Blocks: PR creation
- Depends on: Implementation completion (M1-M5)

## Impact Analysis Summary

**Consultation Status**: [PENDING]
**Blocking Issues**: None

**Consultations Required**:

- [ ] Implementer - Code structure and testing
- [ ] QA - Test strategy and coverage
- [ ] Security - No security concerns (read-only operation)

### Overall Complexity Assessment

- **Code**: Low (parameter addition, existing patterns)
- **Architecture**: Low (follows SearchService abstraction pattern)
- **Security**: Low (read-only, no new attack surface)
- **Operations**: Low (no deployment changes)
- **Quality**: Medium (requires comprehensive test coverage)
- **Overall**: Low-Medium

### Planning Metrics

**Consultation Coverage**:

- Specialists Requested: 2 (Implementer, QA)
- Specialists Completed: 0
- Coverage: 0%

**Issues Discovered Pre-Implementation**: 0

**Planning Checkpoints**:

- Analysis Started: 2026-01-19 (Session 04)
- Consultations Complete: TBD
- Plan Finalized: 2026-01-19

## Notes

**Why No Bootstrap Parameter?**

Bootstrap_context does NOT expose full_context as a parameter because:

1. It's an internal optimization (bootstrap controls how it calls search)
2. Hooks call bootstrap with no parameters (minimal interface)
3. Bootstrap ALWAYS wants full context for enrichment (not optional)
4. Adding parameter would complicate hook integration with no benefit

**Why CLI Search Gets Flag?**

CLI search --full-context is useful because:

1. Users may want compact snippets OR full notes for different tasks
2. Interactive CLI benefits from user choice
3. Follows standard CLI pattern (optional flags for behavior modification)
4. No breaking changes (default is compact)
