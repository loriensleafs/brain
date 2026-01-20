# Session Log: Search Service Architecture Design

**Date**: 2026-01-19
**Session**: 02
**Agent**: architect
**Focus**: Design search service abstraction for Brain MCP

## Session Start

**Time**: 2026-01-19 10:00 AM PST
**Branch**: main
**Commit**: 1f920cd

### Context Retrieved

- Read existing analysis: `.agents/analysis/011-bootstrap-context-gaps.md`
- Reviewed Brain memories:
  - `features/brain-semantic-inngest-architecture/phase-1/task-1-5-implement-unified-search-mcp-tool`
  - `specs/brain-semantic-inngest-architecture/design/design-0001-brain-semantic-inngest-architecture`
- Examined current implementation:
  - `cmd/search.go` - CLI wrapper calling Brain MCP search tool
  - `cmd/bootstrap.go` - CLI calling bootstrap_context tool

### User Requirement

Extract search functionality so bootstrap-context and other tools can use semantic search without calling Brain MCP search_notes directly.

## Work Log

### Architecture Analysis

**Current State**:

- Brain MCP server provides unified `search` tool (semantic + keyword fallback)
- TUI CLI calls Brain MCP via HTTP client
- bootstrap_context tool exists in MCP but has gaps (per analysis 011)
- No abstraction layer between tools and search implementation

**Design Goal**: Service layer that:

1. Abstracts Brain MCP search capabilities
2. Provides semantic, keyword, and hybrid search modes
3. Configurable defaults (mode, limit, threshold, depth)
4. Used by bootstrap_context, session enrichment, and future tools

### Design Decisions

**Location**: Creating ADR-001 for this architectural decision

**Key Trade-offs**:

- Service location: MCP server vs TUI CLI vs shared library
- Search mode strategy: Auto-fallback vs explicit control
- Caching strategy: Per-service vs tool-level
- Configuration: Environment vs file vs in-memory

### Design Summary

**Chosen Solution**: Option 1 - Shared Go Package

**Location**: `internal/search/` package in TUI app

**Key Interface**:

```go
type Service struct {
    client *client.BrainClient
    config Config
}

func (s *Service) Search(ctx context.Context, query string, opts *Options) ([]Result, error)
func (s *Service) SemanticSearch(ctx context.Context, query string, limit int, threshold float64) ([]Result, error)
func (s *Service) KeywordSearch(ctx context.Context, query string, limit int) ([]Result, error)
func (s *Service) HybridSearch(ctx context.Context, query string, limit int) ([]Result, error)
```

**Configuration Strategy**:

- Per-tool configuration (bootstrap wants depth=1, session wants threshold=0.8)
- Hardcoded defaults with override capability
- Future: Environment variables if needed

**Integration Points**:

- Phase 1: Service implementation (2-3 hours)
- Phase 2: Bootstrap integration (1-2 hours)
- Phase 3: Session enrichment (1-2 hours, future)

**Total Effort**: 7-10 hours (implementation + testing + docs)

## Session End

### Artifacts Created

- [x] ADR-001: Search Service Abstraction (`.agents/architecture/ADR-001-search-service-abstraction.md`)
- [x] Session log (`.agents/sessions/2026-01-19-session-02-search-service-design.md`)

### Brain Memory Updates

Will be stored after ADR review completes.

### Next Steps

1. Architect returns to orchestrator with ADR path
2. **BLOCKING**: Orchestrator MUST invoke adr-review skill before proceeding
3. After adr-review PASS: Route to planner for implementation planning
4. After planning: Route to implementer for service implementation

### Git Status

**Modified**: None

**Created**:

- `.agents/architecture/ADR-001-search-service-abstraction.md`
- `.agents/sessions/2026-01-19-session-02-search-service-design.md`

**Not committed** (waiting for ADR review)
