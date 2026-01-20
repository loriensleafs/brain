# Analysis: Brain CLI Search Returns No Results

## 1. Objective and Scope

**Objective**: Determine why `brain search <query>` returns empty results and
identify if project flag is needed
**Scope**: CLI search command implementation, MCP search tool, project
resolution mechanism

## 2. Context

User reports `brain search <query>` returns no results. User suspects missing
project flag to specify which project to search.

Current environment:

- CWD: `/Users/peter.kloss/Dev/brain`
- Config: `~/.basic-memory/brain-config.json` contains project mapping
  `"brain": "/Users/peter.kloss/Dev/brain"`
- No environment variables set (BM_PROJECT, BM_ACTIVE_PROJECT)
- Notes exist in basic-memory that should be searchable

## 3. Approach

**Methodology**:

1. Traced search command flow from CLI through MCP tool
2. Analyzed project resolution hierarchy
3. Executed search with DEBUG=1 to capture actual response
4. Examined SearchService project resolution logic
5. Reviewed MCP search tool schema and handler

**Tools Used**: Read, Grep, Bash (DEBUG output)

**Limitations**: Cannot test all search modes without embeddings database
populated

## 4. Data and Analysis

### Evidence Gathered

| Finding | Source | Confidence |
| ------- | ------ | ---------- |
| CLI search does not pass project parameter | apps/tui/cmd/search.go:78-103 | High |
| MCP search tool accepts optional project | apps/mcp/src/tools/search/schema.ts:42 | High |
| SearchService resolves project via 5-level | apps/mcp/src/services/search/index.ts:228-231 | High |
| CWD match requires code_paths config | apps/mcp/src/project/resolve.ts:102-131 | High |
| Config file exists with brain project | ~/.basic-memory/brain-config.json | High |
| Search returns empty results | DEBUG output | High |

### Facts (Verified)

**CLI Command Structure** (apps/tui/cmd/search.go):

- Lines 78-103: Build toolArgs map with query, limit, threshold, mode, depth
- Line 106: Calls `brainClient.CallTool("search", toolArgs)`
- **Project parameter never added to toolArgs**

**MCP Search Tool Schema** (apps/mcp/src/tools/search/schema.ts):

- Line 42: `project: z.string().optional().describe("Project name to search
  in")`
- Project is optional but recommended for scoped searches

**SearchService Project Resolution**
(apps/mcp/src/services/search/index.ts):

Lines 228-231:

```typescript
private resolveProjectContext(project?: string): string | undefined {
  if (project) return project;
  return resolveProject(undefined, process.cwd()) ?? undefined;
}
```

**Project Resolution Hierarchy** (apps/mcp/src/project/resolve.ts):

5-level resolution order:

1. Explicit parameter (highest priority)
2. Session state (in-memory activeProject)
3. BM_PROJECT env var
4. BM_ACTIVE_PROJECT env var (legacy)
5. CWD match against code_paths
6. null (no project resolved)

**CWD Match Logic** (apps/mcp/src/project/resolve.ts:102-131):

- Matches CWD against configured code_paths
- Returns project with deepest (most specific) path match
- Config file verified at `~/.basic-memory/brain-config.json`
- Contains `"brain": "/Users/peter.kloss/Dev/brain"`

**DEBUG Output**:

```json
{
  "results": [],
  "total": 0,
  "query": "session protocol",
  "mode": "auto",
  "depth": 0
}
```

### Hypotheses (Unverified)

1. **CWD mismatch**: MCP server process.cwd() may differ from CLI CWD
2. **No embeddings**: Auto mode tries semantic first, which requires embeddings
3. **Project not resolved**: CWD resolution failing despite config being correct
4. **basic-memory search failure**: Keyword search via basic-memory failing

## 5. Results

**Root Cause Identified**: CLI search command does not pass project parameter
to MCP search tool.

**Current Behavior**:

1. CLI builds toolArgs without project
2. MCP search tool receives no project parameter
3. SearchService calls `resolveProject(undefined, process.cwd())`
4. Project resolution depends on MCP server's CWD or environment variables
5. If resolution fails, basic-memory search_notes is called without project
6. basic-memory may filter out results or search empty project

**Impact Metrics**:

- Lines missing project parameter: 1 (toolArgs build)
- Files affected: 1 (search.go)
- Resolution hierarchy levels bypassed: 1 (explicit parameter)

## 6. Discussion

**Why No Results**:

The CLI search bypasses level 1 (explicit parameter) in the resolution
hierarchy. This forces reliance on:

- Level 5: CWD match (dependent on MCP server process CWD)
- No guarantee MCP server CWD matches user shell CWD

**Design Intent**:

The MCP search tool's optional project parameter suggests the design expected:

- Auto-resolution from CWD (current implementation)
- OR explicit project specification (not implemented in CLI)

**Both Solutions Valid**:

1. **Add --project flag**: Gives users explicit control
2. **Fix auto-resolution**: Make CWD matching reliable

**Why Both Are Recommended**:

- Flag provides explicit control when auto-resolution ambiguous
- Auto-resolution provides convenience for common case
- Matches resolution hierarchy design (explicit parameter = highest priority)

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
| -------- | -------------- | --------- | ------ |
| P0 | Add --project/-p flag to CLI search | User control, matches MCP schema | 10 lines |
| P1 | Pass resolved project from CLI to MCP | Ensure CWD resolution uses shell CWD | 5 lines |
| P2 | Add debug output showing project | Helps users diagnose issues | 10 lines |
| P2 | Add project to DEBUG output | Show which project was searched | 2 lines |

**Implementation Approach**:

1. Add flag: `searchCmd.Flags().StringVarP(&searchProject, "project", "p", "",
   "Project name to search in")`
2. Pass to toolArgs: `if searchProject != "" { toolArgs["project"] =
   searchProject }`
3. Alternative: Resolve project in CLI and always pass: `toolArgs["project"] =
   resolveProject()`

## 8. Conclusion

**Verdict**: Implement both --project flag AND improve auto-resolution

**Confidence**: High

**Rationale**: CLI search command does not pass project parameter to MCP tool,
forcing reliance on CWD auto-resolution which may fail when MCP server's
process.cwd() differs from user's shell CWD. Adding explicit flag provides user
control while maintaining convenience of auto-resolution.

### User Impact

**What changes for you**:

- Add `--project brain` flag to search commands: `brain search "query" --project
  brain`
- Or rely on auto-resolution if CWD is inside configured code_path

**Effort required**: 1-2 hours implementation + testing

**Risk if ignored**: Search continues returning empty results, users cannot
search notes

## 9. Appendices

### Sources Consulted

- [apps/tui/cmd/search.go](file:///Users/peter.kloss/Dev/brain/apps/tui/cmd/search.go) -
  CLI implementation
- [apps/mcp/src/tools/search/schema.ts](file:///Users/peter.kloss/Dev/brain/apps/mcp/src/tools/search/schema.ts) -
  MCP tool schema
- [apps/mcp/src/services/search/index.ts](file:///Users/peter.kloss/Dev/brain/apps/mcp/src/services/search/index.ts) -
  SearchService
- [apps/mcp/src/project/resolve.ts](file:///Users/peter.kloss/Dev/brain/apps/mcp/src/project/resolve.ts) -
  Project resolution
- [apps/mcp/src/project/config.ts](file:///Users/peter.kloss/Dev/brain/apps/mcp/src/project/config.ts) -
  Config loading

### Data Transparency

**Found**:

- CLI search.go implementation
- MCP search tool schema with optional project parameter
- 5-level project resolution hierarchy
- Config file with brain project mapping
- Empty results from DEBUG output

**Not Found**:

- Evidence of MCP server CWD at runtime
- Logs showing project resolution path taken
- Evidence of embeddings database existence
- basic-memory search_notes behavior without project
