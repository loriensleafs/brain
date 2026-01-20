---
status: "proposed"
date: 2026-01-19
decision-makers: architect
consulted: analyst (via analysis 011)
informed: implementer, planner
---

# Search Service Abstraction for Brain MCP Integration

## Context and Problem Statement

The Brain MCP server provides a unified `search` tool with semantic and keyword capabilities. Multiple components need search functionality (bootstrap_context, session enrichment, future tools), but currently call the Brain MCP search tool directly via HTTP. This creates tight coupling and prevents reuse of search logic, configuration, and caching strategies.

**Problem**: How do we abstract Brain MCP search capabilities so multiple tools can leverage semantic search without duplicating HTTP client code, search mode logic, and result processing?

## Decision Drivers

* Reduce code duplication across tools that need search
* Enable consistent search behavior (mode selection, fallback logic)
* Support configuration of search defaults (limit, threshold, depth)
* Maintain performance with caching where appropriate
* Keep architecture simple - avoid over-engineering for current needs
* Enable future enhancements (query preprocessing, result ranking)

## Considered Options

* Option 1: Shared Go package (search service in TUI app)
* Option 2: Enhanced MCP tool (add search variants to Brain MCP)
* Option 3: Thin wrapper with configuration (minimal abstraction)

## Decision Outcome

Chosen option: **Option 1 - Shared Go package**, because it provides the right level of abstraction for the TUI's current needs while maintaining clear separation of concerns.

The search service will be implemented as a Go package within the TUI app at `internal/search/` with the following interface:

```go
// Package search provides abstraction over Brain MCP search capabilities
package search

import "context"

// Service provides search capabilities with configurable defaults
type Service struct {
    client    *client.BrainClient
    config    Config
}

// Config holds search service configuration
type Config struct {
    DefaultMode      Mode    // auto, semantic, keyword
    DefaultLimit     int     // default: 10
    DefaultThreshold float64 // default: 0.7
    DefaultDepth     int     // default: 0
    CacheTTL         int     // seconds, 0 = no cache
}

// Mode represents search strategy
type Mode string

const (
    ModeAuto     Mode = "auto"     // Semantic first, keyword fallback
    ModeSemantic Mode = "semantic" // Vector search only
    ModeKeyword  Mode = "keyword"  // Text search only
)

// Options override default configuration for a search
type Options struct {
    Mode      *Mode
    Limit     *int
    Threshold *float64
    Depth     *int
}

// Result represents a single search result
type Result struct {
    Permalink       string
    Title           string
    SimilarityScore float64
    Snippet         string
    Source          string // "semantic" or "keyword"
    Depth           int    // relation depth
}

// Search executes a search with optional overrides
func (s *Service) Search(ctx context.Context, query string, opts *Options) ([]Result, error)

// SemanticSearch forces semantic mode
func (s *Service) SemanticSearch(ctx context.Context, query string, limit int, threshold float64) ([]Result, error)

// KeywordSearch forces keyword mode
func (s *Service) KeywordSearch(ctx context.Context, query string, limit int) ([]Result, error)

// HybridSearch executes both modes and merges results
func (s *Service) HybridSearch(ctx context.Context, query string, limit int) ([]Result, error)

// NewService creates a search service with configuration
func NewService(client *client.BrainClient, config Config) *Service
```

### Consequences

* Good: Centralizes search logic in one place
* Good: Enables testing of search behavior without HTTP calls (mock client)
* Good: Configuration allows per-tool customization (bootstrap wants depth=1, session wants threshold=0.8)
* Good: Clear interface for future enhancements (caching, result ranking, query preprocessing)
* Neutral: Adds one more abstraction layer (reasonable for complexity)
* Bad: TUI-specific solution - Brain MCP itself doesn't benefit

### Confirmation

Implementation will be confirmed through:

* Unit tests with mock Brain client
* Integration tests calling real Brain MCP
* Code review verifying interface matches design
* Usage by bootstrap_context tool validates API ergonomics

## Pros and Cons of the Options

### Option 1: Shared Go package (search service in TUI app)

Go package at `internal/search/` providing abstraction over Brain MCP search.

* Good: Clean separation of concerns (search logic vs HTTP client vs tools)
* Good: Easy to test with mock client
* Good: Configuration enables per-tool behavior
* Good: Natural fit for Go project structure
* Neutral: TUI-specific, not shared with other Brain clients
* Bad: One more layer of indirection (but minimal)

### Option 2: Enhanced MCP tool (add search variants to Brain MCP)

Add tools like `semantic_search`, `keyword_search`, `bootstrap_search` to Brain MCP server.

* Good: Centralized in MCP server, all clients benefit
* Good: No client-side abstraction needed
* Neutral: Each variant has specific defaults
* Bad: MCP tool proliferation (one tool per use case)
* Bad: Configuration becomes server-side (harder to customize per-client)
* Bad: Doesn't solve code duplication in client result processing

### Option 3: Thin wrapper with configuration (minimal abstraction)

Simple wrapper function in `client/search.go` that adds configuration but keeps HTTP client visible.

* Good: Minimal abstraction, very simple
* Good: Configuration still centralized
* Neutral: Still ties tools to HTTP client interface
* Bad: Less testable (HTTP client harder to mock)
* Bad: Doesn't provide semantic methods (SemanticSearch, etc.)
* Bad: Future enhancements (caching, ranking) would clutter client package

## Integration Plan

### Phase 1: Service Implementation

**Effort**: 2-3 hours

1. Create `internal/search/` package with interface
2. Implement `Service` struct with Brain client wrapper
3. Add configuration support (Config struct)
4. Implement convenience methods (SemanticSearch, KeywordSearch, HybridSearch)
5. Unit tests with mock client

### Phase 2: Bootstrap Integration

**Effort**: 1-2 hours

1. Modify `cmd/bootstrap.go` to use search service
2. Configure bootstrap-specific defaults (depth=1, threshold=0.7)
3. Update bootstrap_context tool calls to use search service
4. Integration tests

### Phase 3: Session Enrichment

**Effort**: 1-2 hours (when session enrichment is implemented)

1. Configure session-specific defaults (threshold=0.8, mode=semantic)
2. Use search service for session-aware queries
3. Integration tests

### Affected Components

| Component | Change Type | Impact |
|-----------|-------------|--------|
| `cmd/bootstrap.go` | Modify | Use search service instead of direct MCP call |
| `cmd/search.go` | Modify | Use search service (optional, for consistency) |
| `internal/search/` | New | Search service implementation |
| `client/http.go` | No change | Continues providing Brain MCP HTTP interface |

### Configuration Strategy

Search service configuration will be:

* **Default**: Hardcoded in `NewService()` with sensible defaults
* **Per-tool override**: Each tool (bootstrap, session) creates service with custom Config
* **Environment variables**: Future enhancement if needed (e.g., `BRAIN_SEARCH_MODE=semantic`)

**Example Usage**:

```go
// In cmd/bootstrap.go
searchService := search.NewService(brainClient, search.Config{
    DefaultMode:      search.ModeAuto,
    DefaultLimit:     20,          // Bootstrap wants more results
    DefaultThreshold: 0.7,
    DefaultDepth:     1,            // Bootstrap follows relations
    CacheTTL:         45,           // 45-second cache like bootstrap_context
})

results, err := searchService.Search(ctx, "active features", nil)
```

```go
// In future session enrichment
searchService := search.NewService(brainClient, search.Config{
    DefaultMode:      search.ModeSemantic,
    DefaultLimit:     10,
    DefaultThreshold: 0.8,          // Session wants high relevance
    DefaultDepth:     0,            // Session doesn't need relations
    CacheTTL:         0,            // No cache for session queries
})

results, err := searchService.Search(ctx, query, &search.Options{
    Limit: intPtr(5), // Override for this query
})
```

## Reversibility Assessment

* [x] **Rollback capability**: Can remove search service and revert to direct MCP calls without data loss
* [x] **Vendor lock-in**: No external dependency introduced (uses existing Brain MCP)
* [x] **Exit strategy**: If search service proves unnecessary, tools can call Brain MCP directly again
* [x] **Legacy impact**: No breaking changes to existing MCP tools or interfaces
* [x] **Data migration**: No data storage, purely logic abstraction

### Vendor Lock-in Assessment

**Dependency**: Brain MCP server (existing dependency, not introduced by this decision)
**Lock-in Level**: None

This decision does not introduce new external dependencies. It abstracts an existing internal dependency (Brain MCP search tool).

### Exit Strategy

**Trigger conditions**: Search service proves too complex or unmaintainable
**Migration path**:

1. Update tools to call `client.CallTool("search", ...)` directly
2. Copy search mode logic if needed
3. Remove `internal/search/` package
**Estimated effort**: 2-3 hours (revert changes in bootstrap, remove package)
**Data export**: Not applicable (no data stored)

### Accepted Trade-offs

We accept one additional abstraction layer in the TUI app to gain:

* Testability (mock client vs HTTP calls)
* Configuration flexibility (per-tool defaults)
* Code reuse (multiple tools use same search logic)
* Future enhancement path (caching, ranking, preprocessing)

## Dependencies

### Existing Dependencies

* Brain MCP server must be running (`client.EnsureServerRunning()`)
* Brain MCP `search` tool must exist and return expected format

### Implementation Dependencies

* Current Brain client interface (`client.BrainClient.CallTool()`)
* Result unmarshaling logic from `cmd/search.go` (reuse)

### Blocked By

* None (can implement immediately)

### Blocks

* Bootstrap context session state integration (analysis 011) will benefit from this
* Future session enrichment features

## Effort Estimate

### Design Work

* **This ADR**: 1 hour (complete)

### Implementation

* **Phase 1** (Service): 2-3 hours
* **Phase 2** (Bootstrap): 1-2 hours
* **Phase 3** (Session): 1-2 hours (future)
* **Total**: 4-7 hours

### Testing

* Unit tests: 1 hour
* Integration tests: 1 hour
* **Total**: 2 hours

### Documentation

* Package godoc: 30 minutes
* Usage examples: 30 minutes
* **Total**: 1 hour

**Grand Total**: 7-10 hours

## More Information

### Related Analysis

* `.agents/analysis/011-bootstrap-context-gaps.md` - Identified need for session-aware queries in bootstrap_context

### Related Design Docs

* `specs/brain-semantic-inngest-architecture/design/design-0001-brain-semantic-inngest-architecture` - Brain MCP search tool architecture
* `features/brain-semantic-inngest-architecture/phase-1/task-1-5-implement-unified-search-mcp-tool` - Unified search implementation

### Design Alternatives Considered

**Alternative: TypeScript service in Brain MCP**

* Rejected because TUI is Go-based and needs Go interface
* Would require JSON serialization for every call
* Doesn't solve client-side configuration needs

**Alternative: Just use HTTP client directly**

* Simpler but violates DRY (every tool reimplements search logic)
* Harder to test (no mock layer)
* Configuration spread across tools

### Future Enhancements

The search service interface enables:

1. **Query preprocessing**: Stemming, synonym expansion
2. **Result ranking**: Custom scoring beyond similarity
3. **Caching**: TTL-based cache to reduce MCP calls
4. **Batch queries**: Execute multiple searches in parallel
5. **Query analysis**: Detect query intent (feature search vs general search)

These enhancements can be added to the service without changing tool code.

### Open Questions

1. Should caching be service-level or tool-level?
   * **Recommendation**: Service-level with TTL configuration (consistent with bootstrap_context pattern)

2. Should hybrid search merge results or concatenate?
   * **Recommendation**: Deduplicate by permalink, merge snippets, use best score

3. How to handle search failures?
   * **Recommendation**: Return error, let caller decide (retry, fallback, fail)
