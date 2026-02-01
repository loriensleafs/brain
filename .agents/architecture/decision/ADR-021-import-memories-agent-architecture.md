---
status: accepted
date: 2026-02-01
adr_review_date: 2026-02-01
decision-makers: [architect, planner]
consulted: [analyst, implementer, memory, security, critic, independent-thinker, high-level-advisor]
informed: [orchestrator, all agents]
consensus: 6/6 ACCEPT
---

# ADR-021: Import-Memories Agent Architecture

## Pre-Conditions (BLOCKING)

Implementation MUST NOT begin until the following pre-conditions are satisfied:

| ID | Pre-Condition | Status | Evidence Required |
|----|---------------|--------|-------------------|
| PC-1 | `write_note` embedding pipeline triggers correctly | BLOCKED | Semantic search returns newly written notes within 60 seconds |
| PC-2 | Embedding failure rate < 5% on standard content | BLOCKED | Test 20 notes with varied content, verify 19+ indexed |

**Rationale**: The 0% indexing rate (0/126 files indexed) in migration testing demonstrates a fundamental embedding pipeline failure. Building an import agent on broken infrastructure guarantees continued failure.

**Verification Command**:

```bash
# Write test note and verify indexing
brain write_note --title "test-embedding-$(date +%s)" --content "Test content for embedding verification"
sleep 60
brain search --query "Test content for embedding verification" --limit 5
# Expected: test note appears in results
```

## Context and Problem Statement

Brain's migration scripts demonstrate 46% failure rate (106/232 files failed) when importing external notes. The `migrate_agents` tool uses template-based transformation with YAML title sanitization that proves inadequate for edge cases. After successful writes, 0 files appear indexed for semantic search, indicating broken embedding pipeline integration.

Current migration tooling consists of three separate MCP tools:

1. `migrate_agents` - Transforms .agents/ content to basic-memory format
2. `migrate_cluster` - Executes pre-analyzed cluster migrations
3. `organizer` - Multi-mode tool for consolidation, deduplication, maintenance, and backlog operations

These tools share overlapping concerns but lack coordination. The script-based approach cannot handle:

- YAML frontmatter edge cases (titles with colons, quotes, special characters)
- Content merging when duplicate topics exist
- Indexing verification post-write
- Progress tracking for large imports
- Intelligent splitting of oversized notes

How should Brain handle import of external notes and memories while ensuring quality transformation, proper indexing, and reliable completion?

## Decision Drivers

- **Reliability**: 46% failure rate is unacceptable for production use
- **Flexibility**: Must handle arbitrary source formats, not just .agents/ structure
- **Intelligence**: AI can reason about edge cases that break template-based parsing
- **Quality**: Imported notes must meet basic-memory standards (3+ observations, 2+ relations)
- **Indexing**: All imported notes must be searchable via semantic search
- **Resumability**: Large imports must survive interruption and resume cleanly
- **Merge capability**: Related content should consolidate, not fragment the knowledge graph
- **Maintenance burden**: Fewer specialized tools reduces cognitive load and bug surface
- **Security**: Must prevent directory traversal and unauthorized filesystem access (CWE-22)

## Considered Options

### Option A: Improve Existing migrate_agents Script

Enhance YAML sanitization, add retry logic, fix embedding integration.

Pros:

- Minimal architectural change
- Reuses existing code investment
- Faster to implement

Cons:

- Template-based approach cannot handle all edge cases
- No merge/split capability
- No progress tracking or resume
- Still requires separate tools for different operations
- Does not address organizer overlap

### Option B: AI Agent for Import (import-memories)

Replace script-based migration with an AI agent that analyzes, plans, transforms, and verifies imports. Consolidate organizer functionality into the agent.

Pros:

- AI handles edge cases through reasoning, not brittle regexes
- Natural language understanding for content extraction
- Merge/split decisions based on semantic understanding
- Progress tracking with resume capability
- Single tool replaces multiple specialized scripts
- Verification phase ensures indexing works

Cons:

- Higher token cost per import operation
- Requires agent definition and skill development
- Non-deterministic behavior (same input may yield different transformations)

### Option C: Hybrid Approach

Keep script for simple cases, escalate to agent for failures.

Pros:

- Lower cost for straightforward imports
- Agent handles edge cases

Cons:

- Two code paths to maintain
- Unclear escalation criteria
- Complex error handling

## Decision Outcome

Chosen option: **Option B - AI Agent for Import**, because:

1. **Failure rate**: 46% failure proves template-based approach fundamentally limited
2. **Edge case handling**: AI reasoning handles YAML edge cases, content parsing ambiguity
3. **Consolidation**: Replaces migrate_agents, subsumes migrate_cluster, absorbs relevant organizer modes
4. **Quality assurance**: Built-in verification ensures imported notes meet standards and appear in search
5. **Resume capability**: Progress tracking enables reliable large-scale imports

### Consequences

Good:

- Single tool for all import operations reduces cognitive load
- AI-driven transformation produces higher quality observations/relations
- Progress tracking enables reliable batch imports
- Merge capability prevents knowledge graph fragmentation
- Verification phase catches indexing failures before claiming success

Bad:

- Higher token cost per import (estimated 2-5x compared to script)
- Non-deterministic results require acceptance of variation
- Requires deprecation and removal of existing tools

### Confirmation

Implementation confirmed by:

- Successful import of test batch with 0% failure rate
- All imported notes discoverable via semantic search
- Quality metrics meet thresholds (avg 3+ observations, 2+ relations per note)
- Resume functionality verified through interrupted import test

**Test Batch Definition**:

| Criterion | Specification |
|-----------|---------------|
| **Batch Size** | 50 files minimum |
| **Content Diversity** | Mix of: plain text (20%), YAML frontmatter (30%), code blocks (20%), wikilinks (15%), mixed content (15%) |
| **Edge Cases Required** | At least 10 files with known difficult patterns: colons in titles, nested quotes, unicode characters, empty sections, oversized content (>10KB) |
| **Source Variety** | At least 3 different source formats (e.g., .agents/, Obsidian vault, raw markdown) |
| **Success Threshold** | 95% files imported (47/50), 90% indexed within 5 minutes (42/47) |

## Security Requirements

The import-memories agent operates on external filesystem paths. All source paths MUST be validated before any read operations.

### Path Validation (CWE-22 Prevention)

**MUST** use existing `validatePath()` from `apps/mcp/src/config/path-validator.ts`:

```typescript
import { validatePath, isPathWithin } from "../config/path-validator";

// Before ANY source file read operation
function validateSourcePath(sourcePath: string): void {
  const result = validatePath(sourcePath);
  if (!result.valid) {
    throw new Error(`Invalid source path: ${result.error}`);
  }
}

// For import source directories, validate containment
function validateImportSource(filePath: string, allowedBase: string): void {
  if (!isPathWithin(filePath, allowedBase)) {
    throw new Error(`Path escapes allowed import directory: ${filePath}`);
  }
}
```

**Validation Checklist**:

| Check | Function | When Applied |
|-------|----------|--------------|
| Directory traversal (`..`) | `validatePath()` | Before any path use |
| Null byte injection | `validatePath()` | Before any path use |
| System path access | `validatePath()` | Before any path use |
| Path containment | `isPathWithin()` | For each file in import batch |

### Filesystem Access Constraints

**READ-ONLY Access to Source Filesystem**:

The import-memories agent MUST have READ-ONLY access to the source filesystem. Write operations are permitted ONLY to:

1. Brain project notes directory (via `write_note` MCP tool)
2. Import progress/state files in `{brain_project_path}/.import/`

| Operation | Source Filesystem | Brain Notes Directory | Import State Directory |
|-----------|-------------------|----------------------|----------------------|
| Read | ALLOWED | ALLOWED | ALLOWED |
| Write | FORBIDDEN | ALLOWED (via MCP) | ALLOWED |
| Delete | FORBIDDEN | FORBIDDEN | ALLOWED (cleanup) |
| Modify | FORBIDDEN | ALLOWED (via MCP) | ALLOWED |

**Enforcement**: Agent tool definitions MUST NOT include filesystem write tools (`fs.writeFile`, `fs.unlink`, etc.) for arbitrary paths. All note writes go through Brain MCP `write_note` tool.

## Code to Remove

### Phase 1: Deprecate

Mark the following as deprecated in code comments and documentation:

| Tool | Location | Reason |
|------|----------|--------|
| `migrate_agents` | `apps/mcp/src/tools/migrate-agents/` | Replaced by import-memories agent |
| `migrate_cluster` | `apps/mcp/src/tools/migrate-cluster/` | Subsumed by import-memories agent |

### Phase 2: Remove

After import-memories agent proves stable (30 days), remove:

```text
apps/mcp/src/tools/migrate-agents/
  schema.ts
  parser.ts
  relations.ts
  transformer.ts
  observations.ts
  index.ts
  __tests__/
    relations.test.ts
    parser.test.ts
    transformer.test.ts
    observations.test.ts

apps/mcp/src/tools/migrate-cluster/
  schema.ts
  index.ts

scripts/migrate-agents.ts
```

### Phase 3: Evaluate Organizer

The organizer tool contains modes that may overlap with import-memories:

| Organizer Mode | Overlap | Decision |
|----------------|---------|----------|
| `consolidate` | Merge/split operations | Subsume into import-memories |
| `dedupe` | Duplicate detection | Keep (runtime dedup vs import dedup) |
| `maintain` | Quality analysis | Keep (ongoing maintenance vs import) |
| `backlog` | Priority management | Keep (unrelated to import) |

**Recommendation**: Absorb `consolidate` mode into import-memories agent. Keep `dedupe`, `maintain`, and `backlog` as ongoing maintenance tools distinct from import operations.

### Tool Index Update

Remove from `apps/mcp/src/tools/index.ts`:

```typescript
// Remove these imports
import * as migrateCluster from "./migrate-cluster";
import * as migrateAgents from "./migrate-agents";

// Remove from WRAPPER_TOOLS map
["migrate_cluster", { ... }],
["migrate_agents", { ... }],
```

## Benefits of Agent Approach

### Universal Import

Handles any markdown source, not just .agents/ structure:

- Obsidian vaults
- Notion exports
- Logseq databases
- Custom markdown repositories
- Legacy memory systems (ai-agents, mem0)

### Intelligent Merging

Detects and consolidates related content:

- Title similarity matching
- Topic clustering via embeddings
- Reference graph analysis
- Configurable merge strategies (prompt, auto-merge, skip)

### Better Transformation

AI-generated observations and relations:

- Understands content semantics, not just patterns
- Extracts implicit relationships
- Generates appropriate observation categories
- Creates wikilinks to existing notes

### Verification Phase

Confirms successful import:

- All notes indexed in semantic search
- Quality thresholds met
- Cross-references resolve
- Generates detailed import report

## Implementation Plan

### Phase 1: Agent Definition (Week 1)

Create agent definition at `apps/claude-plugin/agents/import-memories.md`:

- 4-phase workflow: ANALYZE, PLAN, EXECUTE, VERIFY
- Tool access: Brain MCP tools + filesystem read (READ-ONLY)
- Activation keywords and summon phrase
- Model: claude-sonnet-4-5 (standard workflow complexity)

### Phase 2: Progress Tracking (Week 1-2)

Implement progress file system:

```text
{brain_project_path}/.import/
  current-import.json       # Active import state
  completed/                # Historical import records
  recovery/                 # Partial state for recovery
```

Schema includes:

- Import job ID and timestamps
- Phase progress tracking
- Checkpoint management
- Failed operation log
- Cumulative statistics

### Phase 3: Core Import (Week 2-3)

Implement ANALYZE and EXECUTE phases:

- File discovery and parsing
- Entity type detection
- Basic-memory format transformation
- write_note execution with error handling
- Progress checkpointing

### Phase 4: Merge Logic (Week 3-4)

Implement PLAN phase with merge detection:

- Title similarity (Jaccard threshold >0.8)
- Reference clustering (bidirectional wikilinks)
- Topic overlap (LLM assessment)
- Merge operation execution

### Phase 5: Verification (Week 4)

Implement VERIFY phase:

- Index validation via search
- Quality check (observations, relations)
- Reference resolution
- Import report generation

### Phase 6: Deprecation (Week 5+)

- Mark migrate_agents, migrate_cluster as deprecated
- Update documentation
- Monitor agent stability
- Remove deprecated code after 30 days

## Tool Enhancements Recommended

### write_note Enhancement

Add conflict mode and import metadata:

```typescript
interface WriteNoteEnhanced {
  // existing params
  conflict_mode?: "fail" | "overwrite" | "merge" | "skip";
  import_metadata?: {
    import_id: string;
    source_path: string;
    imported_at: string;
  };
}
```

### bulk_write_notes

New tool for efficiency:

```typescript
interface BulkWriteNotes {
  notes: Array<{
    folder: string;
    title: string;
    content: string;
  }>;
  project?: string;
  dry_run?: boolean;
}
```

### search Enhancement

Add import metadata filter:

```typescript
interface SearchEnhanced {
  // existing params
  filter?: {
    import_id?: string;
    imported_after?: string;
    has_tag?: string;
  };
}
```

## Effort Estimate

| Component | Effort | Notes |
|-----------|--------|-------|
| Agent definition | 4h | Prompt engineering, workflow design |
| Progress tracking | 8h | File I/O, schema, resume logic |
| Transformation logic | 12h | AI prompts for observation/relation extraction |
| Merge logic | 8h | Similarity detection, content merging |
| Verification | 4h | Quality checks, report generation |
| Testing | 8h | Unit tests, integration tests |
| Documentation | 4h | User guide, examples |
| Deprecation/removal | 4h | Code removal, index updates |
| **Total** | **52h** | 6.5 person-days |

**Note**: Effort estimate assumes Pre-Conditions (PC-1, PC-2) are already satisfied. If embedding pipeline fix is required, add 8-16h for investigation and remediation.

## Reversibility Assessment

- [ ] **Rollback capability**: Deprecated tools can be restored from git history
- [ ] **Vendor lock-in**: None (uses existing Brain MCP tools)
- [ ] **Exit strategy**: Revert to script-based approach if agent proves unreliable
- [ ] **Legacy impact**: Existing imported notes unaffected; only future imports change
- [ ] **Data migration**: Import metadata tags enable identification of agent-imported notes

## Pros and Cons of the Options

### Option A: Improve Existing Scripts

- Good, because minimal architectural change
- Good, because reuses existing code
- Bad, because template-based cannot handle all edge cases
- Bad, because no merge/split capability
- Bad, because no progress tracking
- Bad, because maintains multiple tools

### Option B: AI Agent for Import

- Good, because AI handles edge cases through reasoning
- Good, because single tool replaces multiple scripts
- Good, because progress tracking enables resumability
- Good, because verification ensures quality
- Good, because merge capability prevents fragmentation
- Neutral, because higher token cost (acceptable for batch operations)
- Bad, because non-deterministic results

### Option C: Hybrid Approach

- Good, because lower cost for simple cases
- Bad, because two code paths to maintain
- Bad, because unclear escalation criteria
- Bad, because complex error handling

## More Information

### Related ADRs

- ADR-007: Memory-First Architecture (establishes memory patterns)
- ADR-019: Memory Operations Governance (quality thresholds)
- ADR-020: Configuration Architecture (project path resolution, path validation utilities)

### Design Document

Full technical design at `.agents/architecture/DESIGN-import-memories-agent.md` includes:

- 4-phase workflow diagram
- Progress file schema
- Merge candidate detection algorithms
- Entity type detection heuristics
- Observation category mapping
- Sample import plan JSON

### Migration Failure Evidence

**Source**: Manual test run on 2026-01-31

**Test Environment**:

- Brain version: 0.8.2
- Source directory: `/Users/peter.kloss/Dev/ai-agents/.agents/`
- Target project: `brain-test`

**Reproducible Test Command**:

```bash
# Run migrate_agents on test directory
cd /Users/peter.kloss/Dev/brain
pnpm exec ts-node scripts/migrate-agents.ts \
  --source "/Users/peter.kloss/Dev/ai-agents/.agents/" \
  --project "brain-test" \
  --dry-run false \
  2>&1 | tee migration-test-$(date +%Y%m%d).log

# Count results from log
grep -c "SUCCESS" migration-test-*.log  # Expected: ~126
grep -c "FAILED" migration-test-*.log   # Expected: ~106
grep -c "INDEXED" migration-test-*.log  # Expected: 0

# Verify indexing via search
brain search --project brain-test --query "session" --limit 10
# Expected: 0 results if indexing broken
```

**Results Summary**:

| Metric | Count | Percentage |
|--------|-------|------------|
| Files discovered | 232 | 100% |
| Files migrated | 126 | 54% |
| Files failed | 106 | 46% |
| Files indexed | 0 | 0% |

**Primary Failure Modes**:

1. YAML title sanitization (68 failures): Titles containing `:`, `"`, `'`, or starting with special characters
2. Content parsing (23 failures): Malformed frontmatter or unexpected structure
3. Write errors (15 failures): Duplicate title conflicts, path issues

**Secondary Issue**: Embedding pipeline not triggered post-write (affects all 126 successful writes)

### Organizer Tool Analysis

The organizer tool at `apps/mcp/src/tools/organizer/` contains:

| Mode | Files | Purpose |
|------|-------|---------|
| consolidate | consolidate.ts | Merge/split operations |
| dedupe | dedupe.ts | Duplicate detection |
| maintain | maintain.ts | Quality analysis (orphans, stale, gaps) |
| backlog | backlog.ts | Priority and dependency management |

Shared utilities:

- similarity.ts - Jaccard and content similarity
- wikilinks.ts - Reference extraction
- markdown.ts - Content parsing

**Consolidate mode** overlaps with import-memories merge functionality. The agent should absorb this capability, while dedupe/maintain/backlog remain as ongoing maintenance tools.
