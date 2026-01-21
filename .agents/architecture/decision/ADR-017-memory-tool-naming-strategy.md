---
status: "proposed"
date: 2026-01-20
decision-makers: architect, high-level-advisor
consulted: analyst, planner, implementer, qa, security, devops
informed: all agents
---

# Memory Tool Naming Strategy: Native Implementation with Semantic Alignment

## Context and Problem Statement

Brain MCP currently proxies basic-memory tools and exposes them with basic-memory's naming convention:

- `write_note`, `read_note`, `edit_note`, `delete_note`, `list_directory`

The ai-agents convention uses "memory" terminology that better aligns with Brain's semantic purpose:

- `write_memory`, `read_memory`, `edit_memory`, `delete_memory`, `list_memories`

Should Brain MCP rename its tools to align with the "memory" terminology, and what is the optimal implementation strategy?

**User constraint**: Note locations are DYNAMIC and agents MUST use MCP tools (not hardcoded paths). This reinforces the importance of proper tool abstraction.

## Decision Drivers

1. **Semantic clarity**: "memory" terminology aligns with Brain's purpose as a knowledge/memory system
2. **AI-agents convention alignment**: Consistency with established patterns in the ai-agents repository
3. **Extensibility**: Future Brain-specific enhancements (validation, embedding triggers, workflow events)
4. **Migration complexity**: 33 files need updating across agents, templates, skills
5. **Maintainability**: Proxy layer vs. native implementation complexity
6. **Performance**: Overhead of proxy vs. direct implementation
7. **Existing patterns**: Brain MCP already implements `search` natively rather than proxying `search_notes`

## Considered Options

### Option A: Enhance Proxy Layer with Tool Aliasing

Modify Brain MCP's `callProxiedTool` function to:

- Continue proxying basic-memory tools (write_note, read_note, etc.)
- Expose them to Claude Code with renamed aliases (write_memory, read_memory, etc.)
- Maintain both names during transition period (backward compatibility)

**Pros**:

- Minimal code changes (estimated 2-4 hours)
- Backward compatibility possible during transition
- Leverages existing proxy infrastructure
- Basic-memory tools remain stable

**Cons**:

- Adds aliasing complexity to proxy layer
- Two names for same operation during transition (confusion risk)
- Does not enable Brain-specific enhancements
- Proxy indirection limits extensibility

### Option B: Implement Memory Tools Directly in Brain MCP

Stop proxying `write_note`/`read_note`/`edit_note`/`delete_note`. Implement as native Brain MCP tools:

- `write_memory`: Brain MCP native implementation calling basic-memory write_note internally
- `read_memory`: Brain MCP native implementation calling basic-memory read_note internally
- `edit_memory`: Brain MCP native implementation calling basic-memory edit_note internally
- `delete_memory`: Brain MCP native implementation calling basic-memory delete_note internally
- `list_memories`: Brain MCP native implementation calling basic-memory list_directory internally

**Pros**:

- Clean semantic model ("memory" aligns with Brain's purpose)
- Single source of truth for tool naming
- Enables Brain-specific enhancements without proxy limitations:
  - Pre-write validation (title uniqueness, format compliance)
  - Post-write embedding generation (already partially implemented for proxied tools)
  - Workflow event emission (session state updates, feature tracking)
  - Quality gates (mandatory search before write)
- Follows existing pattern: `search` tool is already implemented natively
- No dual naming confusion

**Cons**:

- More implementation work required (estimated 16-22 hours)
- Risk of behavioral divergence from basic-memory if not carefully maintained
- Need to keep parity with basic-memory parameter handling

### Option C: Hybrid Approach (Selective Native Implementation)

Enhance proxy layer with renaming capability for read-only tools, but implement write operations natively to enable Brain-specific behaviors:

- **Proxied with alias**: `read_memory` (alias for read_note), `list_memories` (alias for list_directory)
- **Native implementation**: `write_memory`, `edit_memory`, `delete_memory`

**Pros**:

- Balances implementation effort with extensibility
- Critical paths (write/edit) get Brain enhancements
- Read-only operations stay simple via proxy

**Cons**:

- Mixed architecture (some proxied, some direct) adds conceptual complexity
- Harder to reason about which tools have which capabilities
- Eventual need to convert read tools to native if enhancements needed

## Decision Outcome

**Chosen option: Option B - Implement Memory Tools Directly in Brain MCP**

### Rationale

1. **Existing precedent**: Brain MCP already implements `search` as a native tool rather than proxying `search_notes`. This established the pattern that Brain can and should implement tools natively when Brain-specific behavior is needed.

2. **Already partially implemented**: The proxy layer already has Brain-specific behavior for `write_note` and `edit_note`:
   - Search guard (duplicate checking before write)
   - Bootstrap cache invalidation
   - Embedding trigger (fire-and-forget embedding generation)

   This behavior would be cleaner in native tool implementations rather than special-cased in `callProxiedTool`.

3. **Semantic alignment**: "Memory" terminology is semantically accurate for Brain's purpose. Basic-memory uses "note" because it's a note-taking system. Brain is a memory system for AI agents. The terminology should reflect this.

4. **Extensibility requirements**: Future Brain features require native tool control:
   - Session state updates on write/edit (ADR-016)
   - Mandatory search-before-write enforcement (currently warn-only)
   - Knowledge graph maintenance triggers
   - Workflow event emission for orchestrator tracking

5. **Clean migration**: Native implementation means the old names simply stop being exposed. No aliasing confusion. Migration is a clean cutover.

6. **User requirement alignment**: The user emphasized that note locations are DYNAMIC and agents MUST use MCP tools. Native implementation with proper naming reinforces this contract - agents interact with Brain's memory abstraction, not basic-memory's note storage.

### Consequences

**Good**:

- Clean semantic model aligned with Brain's purpose
- Single tool naming convention (no aliasing confusion)
- Enables full Brain-specific enhancement without proxy limitations
- Follows established pattern (search tool is already native)
- Consolidates existing write/edit enhancements into proper tool implementations
- Future-proof for session state integration (ADR-016)

**Bad**:

- Implementation effort: 16-22 hours for 5 tools
- Risk of behavioral divergence if basic-memory parameters change (mitigated by tests)
- Breaking change requires coordinated migration of 33 files

**Neutral**:

- Basic-memory tools remain available internally for the native implementations to call
- Proxy layer continues to exist for other basic-memory tools (build_context, recent_activity, etc.)

### Confirmation

Implementation compliance confirmed by:

1. **Unit tests**: Each native tool has tests verifying behavior matches basic-memory
2. **Integration tests**: End-to-end tests with Brain MCP calling basic-memory internally
3. **Migration validation**: Script to verify all 33 files updated to new tool names
4. **Parity tests**: Automated comparison of Brain tool output vs. basic-memory tool output

## Pros and Cons of the Options

### Option A: Enhance Proxy Layer with Tool Aliasing

**Implementation approach**: Add alias mapping in `discoverAndRegisterTools`

```typescript
const TOOL_ALIASES: Record<string, string> = {
  write_memory: "write_note",
  read_memory: "read_note",
  edit_memory: "edit_note",
  delete_memory: "delete_note",
  list_memories: "list_directory",
};
```

- Good, because minimal code changes
- Good, because backward compatibility possible
- Neutral, because proxy overhead unchanged
- Bad, because two names for same operation (confusion)
- Bad, because Brain-specific enhancements remain in proxy layer (messy)
- Bad, because does not solve the fundamental abstraction problem

### Option B: Implement Memory Tools Directly in Brain MCP

**Implementation approach**: Create `tools/memory/` directory with native implementations

```
apps/mcp/src/tools/memory/
  write/
    index.ts
    schema.ts
  read/
    index.ts
    schema.ts
  edit/
    index.ts
    schema.ts
  delete/
    index.ts
    schema.ts
  list/
    index.ts
    schema.ts
```

- Good, because clean semantic alignment
- Good, because enables Brain-specific enhancements
- Good, because follows existing search tool pattern
- Good, because single naming convention (no confusion)
- Neutral, because requires more implementation work
- Bad, because higher initial effort (16-22 hours)
- Bad, because must maintain parity with basic-memory behavior

### Option C: Hybrid Approach (Selective Native Implementation)

**Implementation approach**: Mix of alias mapping and native implementations

- Good, because write path gets enhancements
- Good, because read path stays simple
- Neutral, because moderate implementation effort
- Bad, because mixed architecture harder to reason about
- Bad, because eventual need to convert read tools anyway
- Bad, because cognitive overhead of "which tools are native?"

## Implementation Notes

**Estimated Effort**: 16-22 hours total

- Implementation: 12-15 hours (5 tools at 2-3 hours each)
- Migration script: 2 hours
- Documentation: 2 hours

### Phase 1: Native Tool Implementation (12-15 hours)

**Files to create**:

```
apps/mcp/src/tools/memory/
  write/index.ts       - Native write_memory with search guard, embedding trigger
  write/schema.ts      - Zod schema matching basic-memory write_note params
  read/index.ts        - Native read_memory
  read/schema.ts       - Zod schema
  edit/index.ts        - Native edit_memory with embedding trigger
  edit/schema.ts       - Zod schema
  delete/index.ts      - Native delete_memory
  delete/schema.ts     - Zod schema
  list/index.ts        - Native list_memories
  list/schema.ts       - Zod schema
  index.ts             - Barrel export
```

### Test Coverage Requirements

**Minimum Coverage Thresholds**:

- Line coverage: 80% for all native tool implementations
- Branch coverage: 75% for error handling paths
- Integration test coverage: 100% of tool APIs (write, read, edit, delete, list)

**Coverage Reporting**:

```bash
# Generate coverage report
npm run test:coverage

# Verify thresholds
npm run test:coverage -- --coverageThreshold='{"global":{"lines":80,"branches":75}}'
```

**Acceptance**: Coverage thresholds must pass before Phase 1 completion.

**Files to modify**:

```
apps/mcp/src/tools/index.ts  - Register memory tools in WRAPPER_TOOLS
                             - Remove write_note, edit_note from PROJECT_TOOLS
                             - Add to HIDDEN_TOOLS: write_note, read_note, edit_note, delete_note
```

**Key implementation details**:

1. Each native tool calls basic-memory internally via `getBasicMemoryClient()`
2. Move search guard logic from `callProxiedTool` to `write_memory` handler
3. Move embedding trigger logic from `callProxiedTool` to `write_memory` and `edit_memory` handlers
4. Move cache invalidation logic to native handlers

### Security Controls (Required)

**Path Traversal Prevention**:

```typescript
function validateNoteIdentifier(input: string): void {
  if (input.includes("..") || input.includes("\0")) {
    throw new MemoryToolError({
      code: "PATH_TRAVERSAL",
      message: "Invalid identifier: contains prohibited sequences",
      invalidPath: input,
    });
  }
}
```

**Content Size Limits**:

```typescript
// In write_memory and edit_memory schemas
content: z.string()
  .max(1048576)  // 1MB limit
  .describe("Note content (max 1MB)")
```

**CWE Coverage**:

- CWE-22: Path Traversal - Mitigated by validateNoteIdentifier
- CWE-400: Resource Exhaustion - Mitigated by content size limit

### Error Handling Architecture

**Error Types**:

```typescript
type MemoryToolError =
  | { code: "BASIC_MEMORY_FAILURE"; message: string; cause: Error }
  | { code: "EMBEDDING_FAILURE"; message: string; embeddingError: Error }
  | { code: "SEARCH_GUARD_VIOLATION"; message: string; existingNote: string }
  | { code: "VALIDATION_ERROR"; message: string; field: string }
  | { code: "PATH_TRAVERSAL"; message: string; invalidPath: string }
  | { code: "CONTENT_SIZE_EXCEEDED"; message: string; size: number; limit: number };
```

**Error Propagation**:

- basic-memory errors mapped to Brain-specific error types with context
- Preserve stack traces for debugging
- Add operation context (which Brain tool, which parameters)

**Retry Strategy**:

- Transient failures (network, file lock): Retry 3x with exponential backoff
- Permanent failures (invalid input, path traversal): Fail immediately
- Circuit breaker: Disable tool after 5 consecutive failures

**Fail-Safe Defaults**:

- Search guard failure: log warning, allow write (do not block valid operations)
- Embedding failure: log error, continue with write (embeddings can be regenerated)

### Behavioral Parity Testing

**Parity Definition**: Native Brain tools must match basic-memory proxied tools in:

| Aspect | Parity Criterion | Measurement |
|--------|------------------|-------------|
| Output format | JSON structure equivalence | Deep object comparison |
| Error codes | Map basic-memory errors to Brain errors | Error type assertions |
| Performance | Native overhead <10% vs proxied | Latency benchmarking |
| Side effects | Search guard, embedding triggers preserved | Integration tests |

**Test Strategy**:

- Unit tests for each tool (write, read, edit, delete, list)
- Integration tests with real basic-memory backend
- Performance benchmarks (baseline vs native)
- Side effect verification (search guard called, embeddings queued)

**Acceptance Criteria**:

- All parity tests pass (0 failures)
- Performance overhead <10%
- Side effects function identically

### Performance Benchmarking

**Baseline Measurement** (before native implementation):

Measure current proxy performance:

```typescript
// Benchmark proxy tools
const start = performance.now();
await callProxiedTool("write_note", { title, folder, content });
const end = performance.now();
console.log(`write_note (proxied): ${end - start}ms`);
```

**Target** (after native implementation):

Native tools must meet:

- write_memory: <1.1x baseline latency (10% overhead max)
- read_memory: <1.1x baseline latency
- edit_memory: <1.1x baseline latency
- delete_memory: <1.1x baseline latency
- list_memories: <1.1x baseline latency

**Acceptance Threshold**: Native overhead <10% vs proxied for all tools

**Test Implementation**:

```typescript
describe("Performance parity", () => {
  it("write_memory overhead <10% vs write_note", async () => {
    const proxyTime = await benchmark(() => callProxiedTool("write_note", params));
    const nativeTime = await benchmark(() => writeMemory(params));
    expect(nativeTime).toBeLessThan(proxyTime * 1.1);
  });
});
```

### Basic-Memory Dependency Management

**Selected Strategy**: Version pinning with change monitoring

**Implementation**:

```json
{
  "dependencies": {
    "@basicmachines/basic-memory-mcp": "0.16.0"
  }
}
```

**Change Monitoring Process**:

1. Monitor basic-memory releases (GitHub watch)
2. On new release, run full parity test suite
3. Manual review of breaking changes in release notes
4. Update Brain tool implementations if API changes
5. Update pinned version only after parity verified

**Alternative Considered**: Runtime API contract validation (adds latency, rejected)

**Breaking Change Protocol**:

- basic-memory major version change: full regression testing required
- basic-memory minor version change: parity tests + manual review
- basic-memory patch version change: automated parity tests only

### Terminology Value Evidence

**Hypothesis**: "memory" terminology provides better semantic clarity than "note" for AI agents.

**Evidence Limitations**: No empirical measurements exist. This is an architectural decision based on:

1. Domain modeling: Brain's purpose is "memory system for AI agents" (user description)
2. Consistency with ai-agents convention (user requirement for migration)
3. Distinction: "note" = storage artifact, "memory" = semantic capability

**Validation Approach** (Post-Implementation):

- Track agent error rates before/after migration
- Monitor support questions about tool naming
- Survey: "Is write_memory clearer than write_note?"

**Acknowledged Risk**: Terminology change may not measurably improve agent performance. Benefit is primarily architectural consistency with ai-agents convention (user requirement).

**Decision Rationale**: User explicitly requested ai-agents memory convention alignment. This ADR fulfills that requirement.

### Phase 2: Migration Script (2 hours)

**Create**: `scripts/Migrate-MemoryToolNames.ps1`

**Features Required**:

- `-WhatIf` parameter for dry-run preview
- `-Verbose` parameter for detailed output
- Context-aware replacement (skip comments, docs with basic-memory examples)
- Validation pass after all replacements
- Backup creation before modification

**Replacements**:

| From | To |
|------|-----|
| `mcp__plugin_brain_brain__write_note` | `mcp__plugin_brain_brain__write_memory` |
| `mcp__plugin_brain_brain__read_note` | `mcp__plugin_brain_brain__read_memory` |
| `mcp__plugin_brain_brain__edit_note` | `mcp__plugin_brain_brain__edit_memory` |
| `mcp__plugin_brain_brain__delete_note` | `mcp__plugin_brain_brain__delete_memory` |
| `mcp__plugin_brain_brain__list_directory` | `mcp__plugin_brain_brain__list_memories` |
| `write_note` (in tool references) | `write_memory` |
| `read_note` (in tool references) | `read_memory` |
| `edit_note` (in tool references) | `edit_memory` |
| `delete_note` (in tool references) | `delete_memory` |
| `list_directory` (in tool references) | `list_memories` |

**Scope Clarification**:

- **Active code (33 files)**: Replace all tool names
- **Comments/docs**: Update Brain examples, preserve basic-memory examples
- **Historical logs (231 files)**: Skip (read-only archive)

**Validation Logic**:

```powershell
# Post-migration validation
function Test-MigrationCompleteness {
    param([string]$TargetPath)

    # Check for missed old patterns
    $oldPatterns = @("write_note", "read_note", "edit_note", "delete_note", "list_directory")
    foreach ($pattern in $oldPatterns) {
        $matches = rg $pattern $TargetPath --type md
        if ($matches) {
            Write-Warning "Found unmigrated references to $pattern"
        }
    }

    # Check for new pattern presence
    $newPatterns = @("write_memory", "read_memory", "edit_memory", "delete_memory", "list_memories")
    $foundNew = $false
    foreach ($pattern in $newPatterns) {
        if (rg $pattern $TargetPath --type md --quiet) {
            $foundNew = $true
            break
        }
    }

    return $foundNew
}
```

### Phase 3: Documentation Updates (2 hours)

**Files to update**:

- `apps/mcp/src/transport/resources/guides/writing.md` - Update tool names
- `apps/mcp/src/transport/resources/guides/reading.md` - Update tool names
- `apps/mcp/src/transport/resources/guides/behavior.md` - Update tool names
- `AGENTS.md` - Tool mapping table (already has both patterns documented)
- Brain notes in claude-plugin that reference tool names

### Testing Requirements

1. **Unit tests for each native tool**:
   - Parameter validation (Zod schema)
   - Basic-memory call with correct arguments
   - Response format matches expected output

2. **Integration tests**:
   - Write then read roundtrip
   - Edit then read verification
   - Delete then list verification
   - Search guard enforcement (write_memory)
   - Embedding trigger (write_memory, edit_memory)

3. **Migration validation**:
   - No remaining references to old tool names in migrated files
   - All MCP tool calls succeed post-migration

### Rollback Validation

Rollback procedure must demonstrate:

- [ ] Rollback completes in <2 hours
- [ ] All 33 migrated files functional post-rollback
- [ ] No note data corruption detected
- [ ] Integration test suite passes post-rollback
- [ ] Agents successfully execute write/read/edit/delete operations
- [ ] Embedding triggers continue to function

**Test Strategy**:

1. Deploy native implementation (Phase 1-2 complete)
2. Execute full rollback procedure
3. Run integration test suite
4. Verify agent functionality with rolled-back tools

## Questions for Planner

1. **Parallel vs. Sequential**: Can Phase 1 (implementation) and Phase 2 (migration script) be done in parallel, or should implementation complete first?

2. **Breaking change coordination**: Should migration be atomic (all files in one commit) or incremental (tool implementation first, migration second)?

3. **Rollback strategy**: Need a rollback plan if migration breaks agent functionality. Suggest: keep basic-memory tools available (not hidden) for 1 release cycle, then hide them.

## Reversibility Assessment

- [x] **Rollback capability**: Can revert to proxied tools by removing native implementations and unhiding basic-memory tools
- [x] **Vendor lock-in**: No new vendor lock-in introduced (basic-memory remains the storage layer)
- [x] **Exit strategy**: N/A - this is internal tool naming, not external dependency
- [x] **Legacy impact**: 33 files need migration; migration script provides automated path
- [x] **Data migration**: No data migration required - only tool names change, not storage format

### Rollback Plan

If native implementation has critical bugs:

1. Remove native tools from WRAPPER_TOOLS
2. Remove from HIDDEN_TOOLS: write_note, read_note, edit_note, delete_note, list_directory
3. Revert migration script changes (run inverse replacements)
4. Estimated rollback time: 1-2 hours

## More Information

**Related ADRs**:

- ADR-001: Search Service Abstraction - Established pattern of native tool implementation for Brain-specific behavior
- ADR-002: Embedding Performance Optimization - Embedding triggers must be carried forward to native tools
- ADR-016: Automatic Session Protocol Enforcement - Session state updates require native tool control

**Related Analysis**:

- `.agents/analysis/memory-architecture-comparison.md` - Full migration scope analysis

**Realization Timeline**:

- Phase 1: Native tool implementation (12-15 hours)
- Phase 2: Migration script (2 hours)
- Phase 3: Documentation updates (2 hours)
- Total: 16-22 hours implementation + testing

**Review Schedule**:

Post-implementation review after 7 days of use to assess:

- Tool behavior parity with basic-memory
- Enhancement effectiveness (search guard, embedding triggers)
- Agent migration completeness
- Any behavioral regressions
