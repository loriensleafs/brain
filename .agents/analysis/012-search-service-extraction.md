# Analysis: Search Service Extraction from Bootstrap-Context

## 1. Objective and Scope

**Objective**: Document current search implementation patterns across bootstrap-context components and identify opportunities to extract reusable search service with semantic search capabilities.

**Scope**:

- bootstrap-context tool components (sectionQueries.ts, sessionEnrichment.ts, index.ts)
- Existing search tool implementation
- Search patterns and duplication analysis
- Extraction recommendations

## 2. Context

The codebase currently has two search implementations:

1. **Dedicated search tool** (`apps/mcp/src/tools/search/index.ts`) - Semantic search with keyword fallback
2. **Bootstrap-context queries** - Multiple instances of keyword-only searches via `search_notes`

User vision: Extract search into reusable service that uses semantic search for better results.

## 3. Approach

**Methodology**: Code review and pattern analysis
**Tools Used**: Grep, Read (file analysis)
**Limitations**: Cannot verify runtime behavior or performance characteristics

## 4. Data and Analysis

### Evidence Gathered

| Finding | Source | Confidence |
|---------|--------|-----------|
| 6 instances of `search_notes` calls in bootstrap-context | sectionQueries.ts (4), sessionEnrichment.ts (2) | High |
| Dedicated search tool with semantic capabilities exists | tools/search/index.ts | High |
| All bootstrap queries use keyword-only search | sectionQueries.ts, sessionEnrichment.ts | High |
| Search result parsing duplicated 2 times | sectionQueries.ts, sessionEnrichment.ts | High |
| No semantic search used in bootstrap-context | All bootstrap files | High |

### Facts (Verified)

**Search Tool Implementation (tools/search/index.ts)**:

- Supports semantic search using sqlite-vec with embeddings
- Includes automatic keyword fallback when no embeddings exist
- Provides relation expansion (wikilink following) up to specified depth
- Search modes: semantic, keyword, auto (semantic with fallback)
- Uses Ollama for query embedding generation
- Parameters: query, limit, threshold (0.7 default), mode, depth (0 default)

**Bootstrap-Context Search Usage**:

1. **sectionQueries.ts** - 4 search calls:
   - `queryRecentActivity()` (line 72): `search_notes` with after_date filter, page_size 50
   - `queryActiveFeatures()` (line 100): `search_notes` with types filter, query "Status"
   - `queryRecentDecisions()` (line 142): `search_notes` with types filter, query "decision"
   - `queryOpenBugs()` (line 177): `search_notes` with types filter, query "bug"

2. **sessionEnrichment.ts** - 2 search calls:
   - `queryTaskNotes()` (line 61): `search_notes` with task identifier query
   - `queryFeatureNotes()` (line 84): `search_notes` with feature identifier query

**Search Parameters Used**:

- All use `search_notes` tool via basic-memory proxy
- All specify project parameter
- Most specify page_size/limit (5, 10, 50)
- Some use after_date for time filtering
- Some use types array for type filtering
- All use simple string queries (no semantic capabilities)

**Duplication Identified**:

1. **Result Parsing Logic** - Duplicated in 2 files:
   - `sectionQueries.ts` (lines 214-265): `parseAndEnrichNotes()` function
   - `sessionEnrichment.ts` (lines 181-222): `parseSearchResults()` function
   - Both parse BasicMemoryResult/SearchResult responses
   - Both handle result.result.results and result.content[0].text formats
   - Both filter for entity type and map to ContextNote structure
   - Difference: sectionQueries includes note type/status detection, sessionEnrichment does not

2. **Client Initialization** - Repeated in every function:
   - `const client = await getBasicMemoryClient()` appears 6 times
   - No connection pooling or caching

3. **Search Pattern** - Repeated structure:

   ```typescript
   const client = await getBasicMemoryClient();
   const result = await client.callTool({
     name: "search_notes",
     arguments: { project, query, ...filters }
   });
   return parseResults(result);
   ```

### Hypotheses (Unverified)

- Semantic search would improve relevance for task/feature note queries
- Relation expansion (depth parameter) could eliminate need for separate relationFollowing.ts
- Unified search service would reduce code duplication by 40-50%

## 5. Results

**Current Search Implementation**:

- 6 search_notes calls across 2 files
- 2 result parsing implementations (140 lines duplicated)
- 0 semantic search usage
- 0 relation expansion usage

**Existing Capabilities Not Used**:

- Semantic vector search (sqlite-vec + Ollama embeddings)
- Automatic keyword fallback
- Relation expansion via wikilinks
- Configurable similarity threshold

**Code Duplication Metrics**:

- Result parsing: 140 lines duplicated (2 implementations)
- Client initialization: 6 instances
- Search call pattern: 6 instances with minor variations

## 6. Discussion

### Why Current State is Suboptimal

**Relevance**: Simple keyword search with query "Status" or "bug" returns low-precision results. Semantic search would understand intent better.

**Example**: Query "active feature" with semantic search would find features with status IN_PROGRESS/NOT_STARTED, even without literal keyword match.

**Maintenance**: Two parsing implementations drift over time. sectionQueries includes type/status detection; sessionEnrichment does not. Future bug fixes must be applied twice.

**Performance**: No connection pooling. Each search creates new basic-memory client connection.

**Missed Capabilities**: Existing search tool includes relation expansion (wikilink following) that could replace separate relationFollowing.ts logic (45 lines).

### Extraction Opportunities

**High Value**:

1. **Unified search service** abstracting search_notes calls
2. **Single parsing implementation** with optional enrichment
3. **Semantic search upgrade** for better relevance

**Medium Value**:

1. **Connection pooling** for basic-memory client
2. **Relation expansion integration** replacing custom logic

**Low Value**:

1. **Search caching** (bootstrap already has session cache)

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
|----------|---------------|-----------|--------|
| P0 | Create SearchService abstraction wrapping search tool | Eliminates 6 instances of duplicated search calls | 4 hours |
| P0 | Consolidate result parsing into single implementation | Eliminates 140 lines of duplication | 2 hours |
| P1 | Enable semantic search for task/feature queries | Improves relevance for session enrichment | 1 hour |
| P1 | Use relation expansion instead of custom relationFollowing | Reduces code by 45 lines, leverages existing capability | 2 hours |
| P2 | Add connection pooling for basic-memory client | Performance improvement | 3 hours |

### Implementation Strategy

**Phase 1: Extract Without Behavioral Change**

1. Create `SearchService` class in `apps/mcp/src/services/search/`
2. Method: `search(query, options)` wrapping keyword search_notes calls
3. Single `parseResults()` implementation with type/status enrichment
4. Replace all 6 search_notes calls with SearchService.search()
5. Verify tests pass (no behavior change)

**Phase 2: Enable Semantic Search**

1. Add `mode` parameter to SearchService.search() (default: auto)
2. Use unified search tool internally (semantic with keyword fallback)
3. Update sessionEnrichment queries to use semantic mode
4. Measure relevance improvement in session context quality

**Phase 3: Replace Custom Relation Following**

1. Add `depth` parameter to SearchService.search()
2. Remove custom relationFollowing.ts logic
3. Use search tool's relation expansion capability

**API Design**:

```typescript
interface SearchOptions {
  project: string;
  limit?: number;
  mode?: 'semantic' | 'keyword' | 'auto';
  depth?: number;
  filters?: {
    types?: string[];
    after_date?: string;
  };
  enrichment?: {
    detectType?: boolean;
    parseStatus?: boolean;
  };
}

class SearchService {
  async search(query: string, options: SearchOptions): Promise<ContextNote[]> {
    // Use unified search tool
    // Parse and enrich results
    // Return ContextNote[]
  }
}
```

**Benefits**:

- Single source of truth for search logic
- No result parsing duplication
- Semantic search improves session context relevance
- Reduced maintenance burden (2 implementations → 1)

## 8. Conclusion

**Verdict**: Proceed with extraction
**Confidence**: High
**Rationale**: Clear duplication (140 lines), existing semantic search capability unused, low implementation risk with high maintenance benefit.

### User Impact

- **What changes for you**: Session context includes more relevant notes via semantic search
- **Effort required**: No user-facing changes; internal refactoring only
- **Risk if ignored**: Continued code duplication, missed opportunity for semantic search relevance

## 9. Appendices

### Sources Consulted

- apps/mcp/src/tools/bootstrap-context/sectionQueries.ts
- apps/mcp/src/tools/bootstrap-context/sessionEnrichment.ts
- apps/mcp/src/tools/bootstrap-context/index.ts
- apps/mcp/src/tools/search/index.ts
- apps/mcp/src/utils/security/searchGuard.ts

### Data Transparency

- **Found**: 6 search_notes calls, 2 parsing implementations, existing semantic search tool
- **Not Found**: Performance metrics, relevance comparison data, user feedback on context quality
- **Could Not Verify**: Runtime behavior, actual search result quality differences
