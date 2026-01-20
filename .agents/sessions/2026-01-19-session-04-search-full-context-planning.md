# Session Log: 2026-01-19-session-04-search-full-context-planning

## Session Metadata

- **Date**: 2026-01-19
- **Agent**: planner
- **Task**: Create corrected implementation plan for search full_context enhancement
- **Branch**: main
- **Starting Commit**: 79e6204

## Objectives

1. Understand corrected requirements (search enhancement, not bootstrap) - [COMPLETE]
2. Review existing search tool and service architecture - [COMPLETE]
3. Create implementation plan with milestones and dependencies - [COMPLETE]
4. Include parallelization opportunities - [COMPLETE]

## Work Completed

### Requirements Clarification

Reviewed user's corrected requirements:

**Feature 1: Add full_context to Search Tool**

- Add `full_context` boolean parameter to search schema (default: false)
- When false: Return compact results (current behavior)
- When true: Include full note content in search results
- Update SearchService to support this parameter

**CLI Enhancement**:

- Add `--full-context` flag to brain search command (optional)
- Add `--project` flag (required, with auto-resolution)
- Pass both parameters to MCP search tool

**Bootstrap Internal Usage**:

- When bootstrap_context calls search internally for session enrichment
- Pass `full_context: true` to get expanded content
- This happens INSIDE bootstrap, not via parameter to bootstrap

**What NOT to Change**:

- ❌ Do NOT add full_context parameter to bootstrap_context tool
- ❌ Do NOT add --full-content flag to CLI bootstrap command
- ❌ Do NOT modify hook to pass full_context

### Architecture Review

Reviewed existing codebase:

**Search Tool** (`apps/mcp/src/tools/search/`):

- schema.ts: SearchArgsSchema with query, limit, threshold, mode, depth, project
- index.ts: Handler delegates to SearchService
- Current output: compact snippet in SearchResult

**SearchService** (`apps/mcp/src/services/search/`):

- types.ts: SearchOptions, SearchResult, SearchResponse interfaces
- index.ts: Unified search abstraction with semantic/keyword/hybrid modes
- Current snippet generation: Uses basic-memory content slice (200 chars)

**Bootstrap Context** (`apps/mcp/src/tools/bootstrap-context/`):

- sessionEnrichment.ts: Calls search for task/feature notes
- sectionQueries.ts: Calls search for features, decisions, bugs, activity
- Current behavior: Uses search snippets, converts to ContextNote.content

**CLI Search** (`apps/tui/cmd/search.go`):

- Current flags: --limit, --threshold, --mode, --depth, --project
- printSearchResults: Shows snippet (truncated to 100 chars)

### Plan Structure

Created 5-milestone plan:

**M1: SearchService Enhancement** (2 hours)

- Add fullContent option to SearchOptions
- Add fullContent field to SearchResult
- Implement fetchFullContent using basic-memory read_note
- Update search execution to fetch full content when requested

**M2: Search Tool Schema Update** (1 hour)

- Add full_context to SearchArgsSchema
- Update tool description
- Pass full_context to SearchService

**M3: CLI Search Flag** (1 hour)

- Add --full-context flag
- Update printSearchResults to show full content
- Update help text

**M4: Bootstrap Internal Enhancement** (30 minutes)

- Update sessionEnrichment queries to pass fullContent: true
- Update sectionQueries to pass fullContent: true
- Map fullContent to ContextNote.content

**M5: Testing & Validation** (2 hours)

- Unit tests for SearchService
- Integration tests for search tool
- CLI tests for --full-context flag
- Bootstrap integration tests
- Performance tests

### Parallelization Strategy

Identified 3-phase execution:

**Phase 1** (2 hours): M1 only - SearchService enhancement
**Phase 2** (2 hours, parallel): M2 + M3 + M4 - Tool, CLI, Bootstrap
**Phase 3** (2 hours): M5 - Testing

**Total Effort**: 6 hours over 1 day

### Key Design Decisions

**Full Content Retrieval**:

- Use basic-memory read_note tool to fetch full content
- Cache results per permalink to avoid duplicate reads
- Limit to 5000 chars per note (prevent token explosion)

**Backward Compatibility**:

- Default fullContent=false (compact snippets)
- Make parameter optional
- Graceful fallback to snippet on read failure

**Bootstrap Integration**:

- Internal change only (no tool signature change)
- Always pass fullContent: true for session enrichment
- Maps fullContent to ContextNote.content field

**CLI Display**:

- Show full content when FullContent field is non-empty
- Truncate display at 2000 chars with "..." if needed
- Keep snippet display for backward compatibility

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Slow full content retrieval | Cache read_note results; limit to 5000 chars |
| Token explosion in Claude | Limit full content per note; limit result count |
| Breaking compatibility | Default fullContent=false; optional parameter |
| Read_note errors | Graceful fallback to snippet |

## Artifacts Created

- `.agents/planning/001-search-full-context-enhancement.md` (implementation plan)
- `.agents/sessions/2026-01-19-session-04-search-full-context-planning.md` (this log)

## Key Learnings

**Requirement Clarification Prevents Waste**:

- Initial understanding was to add parameter to bootstrap
- Corrected understanding: enhance search tool, bootstrap uses internally
- Clear requirements prevent implementing wrong feature

**Layered Architecture Enables Clean Enhancement**:

- SearchService abstraction makes enhancement straightforward
- Each layer (service, tool, CLI, bootstrap) has clear responsibility
- Changes are additive (no breaking modifications)

**Internal Optimization vs. External Parameter**:

- Bootstrap wants full context for enrichment (internal optimization)
- CLI users want choice between compact/full (external parameter)
- Different audiences, different interface designs

**Backward Compatibility by Default**:

- Default behavior unchanged (fullContent=false)
- New behavior is opt-in (requires explicit flag/parameter)
- Reduces risk of breaking existing integrations

## Recommendations

**To Orchestrator**:

- Route to critic for plan validation
- If approved, route to implementer with M1 (SearchService enhancement)
- After M1, parallelize M2, M3, M4 (implementer can do all three)
- Route to QA for M5 (testing and validation)

**Implementation Sequence**:

1. Implementer: M1 (SearchService) - 2 hours
2. Implementer: M2 + M3 + M4 (Tool + CLI + Bootstrap) - 2 hours
3. QA: M5 (Testing) - 2 hours

**Estimated Timeline**: 1 working day (6 hours total effort)

## Session End Checklist

- [x] All objectives met
- [x] Plan created with 5 milestones
- [x] Parallelization opportunities identified
- [x] Risk mitigation documented
- [ ] Brain memory updated
- [ ] Markdown linting passed
- [ ] Artifacts committed
- [ ] Session protocol validation passed

## Next Steps

1. Orchestrator routes to critic for plan validation
2. If critic approves, orchestrator routes to implementer for M1
3. After M1 complete, orchestrator routes to implementer for M2-M4
4. After M2-M4 complete, orchestrator routes to QA for M5
5. After all complete, orchestrator reviews and closes

## Evidence

**Planning Duration**: ~45 minutes
**Milestones Defined**: 5
**Total Estimated Effort**: 6 hours
**Parallelization Factor**: 3 tasks in Phase 2
**Risk Count**: 4 identified with mitigations
