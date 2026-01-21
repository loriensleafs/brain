# Analysis: Memory Architecture Comparison - Brain vs AI-Agents

## 1. Objective and Scope

**Objective**: Provide comprehensive comparison of Brain's basic-memory architecture versus ai-agents' Serena-based memory architecture to identify all migration requirements from ai-agents patterns to Brain patterns.

**Scope**:

- Brain MCP foundation (basic-memory + semantic search enhancements)
- AI-Agents memory system (Serena + Forgetful tiered architecture)
- Tool naming conventions and API mappings
- File and directory conventions
- Migration inventory for Brain's claude-plugin

**Excluded**: Implementation details of migration scripts (deferred to planner/implementer phases).

---

## 2. Context

Brain and ai-agents both implement multi-agent systems with persistent memory for cross-session continuity. However, they use different memory architectures:

- **Brain**: Built on basic-memory with semantic search extensions via sqlite-vec embeddings
- **AI-Agents**: Uses Serena (file-based tiered memory) + Forgetful (knowledge graph) with cloudmcp-manager

The Brain repository has migrated FROM ai-agents patterns but contains residual ai-agents references that need updating.

---

## 3. Approach

**Methodology**:

1. Deep reading of basic-memory documentation (AI Assistant Guide, Extended Guide, Knowledge Format)
2. Source code analysis of Brain MCP (db, services/search, tools/search, tools/bootstrap-context)
3. AI-Agents documentation review (AGENTS.md, SESSION-PROTOCOL.md, deepwiki Memory System)
4. Pattern scanning for residual ai-agents references in Brain claude-plugin

**Tools Used**: WebFetch, Read, Grep, Glob

**Limitations**: Could not access some referenced documentation URLs that returned truncated content.

---

## 4. Data and Analysis

### 4.1 Brain Memory Architecture Summary

#### Foundation: Basic-Memory

Basic-memory is a local-first knowledge management system that creates semantic knowledge graphs from markdown files:

| Component | Description |
|-----------|-------------|
| **Storage** | Plain-text markdown files with YAML frontmatter |
| **Index** | SQLite database as secondary index (not primary source) |
| **Interface** | MCP server for AI assistant interaction |
| **Graph** | Semantic knowledge graph with observations and relations |

#### Storage Model

Notes are stored as markdown with:

- Unique title serving as identifier (becomes permalink)
- Auto-generated permalink for stable references
- YAML frontmatter (tags, type, dates)
- Observations section using [category] content #tags format
- Relations section using relation_type [[Target]] format
- Optional folder organization

#### Entity Types

note (default), person, project, meeting, decision, spec

#### Observation Format

```markdown
- [category] observation content #tag1 #tag2
```

**Standard categories**: [fact], [idea], [decision], [technique], [requirement], [question], [insight], [problem], [solution]

#### Relation Format

```markdown
- relation_type [[Target Entity]]
```

**Relation types**: relates_to, implements, requires, extends, part_of, contrasts_with, caused_by, leads_to, similar_to

#### Brain MCP Tools

| Tool | Purpose |
|------|---------|
| write_note | Create or overwrite note |
| read_note | Read note by identifier/permalink |
| edit_note | Update note (append, prepend, find_replace, replace_section) |
| delete_note | Remove note |
| list_directory | List notes in a folder |
| search | Unified search (auto/semantic/keyword/hybrid modes) |
| build_context | Initialize project context with depth/timeframe filtering |

#### Brain Semantic Search Enhancement

Brain extends basic-memory with sqlite-vec embeddings:

| Component | Location | Purpose |
|-----------|----------|---------|
| Vector schema | apps/mcp/src/db/schema.ts | 768-dimension embeddings with chunked storage |
| Vector operations | apps/mcp/src/db/vectors.ts | Store, delete, search with cosine distance |
| SearchService | apps/mcp/src/services/search/ | Unified search with semantic/keyword fallback |
| OllamaClient | apps/mcp/src/services/ollama/ | Embedding generation via Ollama |
| Bootstrap context | apps/mcp/src/tools/bootstrap-context/ | Session enrichment with active features, decisions, bugs |

**Search Modes**:

- auto: Tries semantic first, falls back to keyword if no embeddings
- semantic: Vector similarity search only
- keyword: Text-based search via basic-memory
- hybrid: Combines semantic and keyword results

---

### 4.2 AI-Agents Memory Architecture Summary

#### Dual-Tier Memory System

AI-Agents implements a tiered memory approach:

| Tier | System | Purpose | Token Impact |
|------|--------|---------|--------------|
| **1 (Primary)** | Serena | File-based project memory, cross-platform | 82% savings via session caching |
| **2 (Secondary)** | Forgetful | Semantic search, knowledge graph | Cross-project patterns |
| **3 (Fallback)** | VS Code memory | Platform-specific | Not shared |

#### Serena Three-Tier Storage Model

Serena uses hierarchical indexing:

| Tier | File Pattern | Purpose | Token Budget |
|------|--------------|---------|--------------|
| **L1** | memory-index.md | Global routing to L2 indexes | ~500 tokens |
| **L2** | skills-*-index.md | Domain-specific keyword to filename mappings | ~100 tokens each |
| **L3** | {domain}-{topic}.md | Atomic memory content | Variable |

**Critical Constraint**: L2 indexes are pure lookup tables with ONLY keyword to file mappings.

#### Serena Tools

| Tool | Purpose |
|------|---------|
| write_memory | Create or update memory file |
| read_memory | Retrieve memory by name |
| list_memories | Enumerate available memories |
| delete_memory | Remove memory file |
| edit_memory | Update using literal or regex replacement |
| activate_project | Initialize project context |
| initial_instructions | Load Serena manual |

#### Forgetful Knowledge Graph

Forgetful provides semantic search with 13 SQLite tables:

| Table Category | Examples |
|----------------|----------|
| Core entities | users, memories, projects, entities |
| Content | documents, code_artifacts |
| Relationships | memory_links, entity_relationships |
| Associations | memory_project_association, memory_entity_association |

#### Forgetful Tools

| Tool | Purpose |
|------|---------|
| memory-search_nodes | Semantic similarity queries |
| memory-open_nodes | Fetch specific entities |
| memory-create_entities | Store new knowledge |
| memory-add_observations | Augment existing entities |
| memory-create_relations | Connect related concepts |

#### Session Continuity Mechanisms

| Artifact | Location | Purpose |
|----------|----------|---------|
| Session logs | .agents/sessions/YYYY-MM-DD-session-NN.md | Audit trails |
| HANDOFF.md | .agents/HANDOFF.md | Read-only dashboard |
| Serena memories | .serena/memories/*.md | Cross-session patterns |

---

### 4.3 Key Architectural Differences

| Aspect | AI-Agents (Serena/Forgetful) | Brain (Basic-Memory) | Migration Impact |
|--------|------------------------------|----------------------|------------------|
| **Storage Location** | .serena/memories/ | ~/memories/{project}/ via Brain | Directory paths need updating |
| **Index Approach** | 3-tier index hierarchy (L1/L2/L3) | Direct semantic search | Remove index maintenance references |
| **Tool Prefix** | mcp__serena__* | mcp__plugin_brain_brain__* | All tool references need renaming |
| **Knowledge Graph** | Forgetful (external MCP) | Integrated sqlite-vec embeddings | Remove Forgetful references |
| **Observation Format** | Same [category] content #tags | Same | No change needed |
| **Relation Format** | Same relation_type [[Target]] | Same | No change needed |
| **Init Sequence** | activate_project then initial_instructions | build_context | Init calls need updating |
| **Fallback Strategy** | Serena then Forgetful then VS Code | Semantic then Keyword (auto mode) | Simplify fallback logic |

#### Tool Name Mapping

| AI-Agents Tool | Brain Equivalent |
|----------------|------------------|
| mcp__serena__activate_project | mcp__plugin_brain_brain__build_context |
| mcp__serena__initial_instructions | Not needed (context in build_context) |
| mcp__serena__write_memory | mcp__plugin_brain_brain__write_note |
| mcp__serena__read_memory | mcp__plugin_brain_brain__read_note |
| mcp__serena__list_memories | mcp__plugin_brain_brain__list_directory |
| mcp__serena__edit_memory | mcp__plugin_brain_brain__edit_note |
| mcp__serena__delete_memory | mcp__plugin_brain_brain__delete_note |
| memory-search_nodes | mcp__plugin_brain_brain__search |
| memory-open_nodes | mcp__plugin_brain_brain__read_note |
| memory-create_entities | mcp__plugin_brain_brain__write_note |
| memory-add_observations | mcp__plugin_brain_brain__edit_note (append) |
| memory-create_relations | mcp__plugin_brain_brain__edit_note (append Relations section) |

---

## 5. Results

### 5.1 Comprehensive Migration Inventory

#### Category A: Agent Files with Memory Patterns (HIGH Priority)

Files in apps/claude-plugin/agents/ requiring tool name updates:

| File | Complexity | Reason |
|------|------------|--------|
| memory.md | LOW | Already uses Brain tools, COMPLETE |
| orchestrator.md | MEDIUM | Verify init sequence |
| architect.md | MEDIUM | Verify memory references |
| analyst.md | MEDIUM | Verify memory references |

**Note**: Core agents already migrated to Brain tool names. Verification needed.

#### Category B: Template Files (HIGH Priority)

Files in apps/claude-plugin/agents/templates/agents/ containing Forgetful references:

| File | Complexity | Reason |
|------|------------|--------|
| analyst.shared.md | MEDIUM | Contains memory-search_nodes references |
| architect.shared.md | MEDIUM | Contains memory-search_nodes references |
| critic.shared.md | MEDIUM | Contains memory-search_nodes references |
| devops.shared.md | MEDIUM | Contains memory-search_nodes references |
| explainer.shared.md | MEDIUM | Contains memory-search_nodes references |
| high-level-advisor.shared.md | MEDIUM | Contains memory-search_nodes references |
| implementer.shared.md | MEDIUM | Contains memory-search_nodes references |
| independent-thinker.shared.md | MEDIUM | Contains memory-search_nodes references |
| memory.shared.md | HIGH | Primary memory agent template |
| orchestrator.shared.md | HIGH | Contains Forgetful AND Serena references |
| planner.shared.md | MEDIUM | Contains memory-search_nodes references |
| pr-comment-responder.shared.md | HIGH | Contains both Forgetful AND Serena |
| qa.shared.md | MEDIUM | Contains memory-search_nodes references |
| retrospective.shared.md | MEDIUM | Contains memory-search_nodes references |
| roadmap.shared.md | MEDIUM | Contains memory-search_nodes references |
| skillbook.shared.md | HIGH | Contains both Forgetful AND Serena |
| task-generator.shared.md | MEDIUM | Contains memory-search_nodes references |
| security.shared.md | MEDIUM | Contains memory-search_nodes references |

#### Category C: Session Protocol Files (HIGH Priority)

| File | Complexity | Reason |
|------|------------|--------|
| agents/.agents/SESSION-PROTOCOL.md | HIGH | Core session init/end references Serena |
| agents/.agents/governance/PROJECT-CONSTRAINTS.md | MEDIUM | May reference Serena |
| agents/AGENT-SYSTEM.md | HIGH | System documentation |

#### Category D: Skills with Memory Logic (MEDIUM Priority)

| Directory | Complexity | Reason |
|-----------|------------|--------|
| skills/memory/ | HIGH | Contains MemoryRouter.psm1 with Forgetful logic |
| skills/memory/scripts/Search-Memory.ps1 | HIGH | Unified search with Forgetful augmentation |
| skills/memory/references/memory-router.md | MEDIUM | Documents Forgetful integration |
| skills/memory/references/tier-selection-guide.md | MEDIUM | Documents tiered approach |

#### Category E: Documentation Files (MEDIUM Priority)

Files in apps/claude-plugin/agents/.agents/specs/:

| File | Complexity | Reason |
|------|------------|--------|
| skill-catalog-mcp-spec.md | LOW | References Serena tools |
| agent-orchestration-mcp-spec.md | MEDIUM | References memory tools |
| session-state-mcp-spec.md | MEDIUM | References session state |

#### Category F: Session Logs (LOW Priority - Historical)

231 files in apps/claude-plugin/agents/.agents/sessions/ contain .serena or Serena references. These are historical records and may not require migration, but should be assessed for:

- Active pattern references that agents might load
- Session templates that get copied

#### Category G: Prompt Files (LOW Priority)

| File | Complexity | Reason |
|------|------------|--------|
| agents/.agents/prompts/research-and-incorporate-workflow-optimized.md | LOW | Contains Serena references |

### 5.2 Quantified Migration Scope

| Category | File Count | Estimated Lines | Priority |
|----------|------------|-----------------|----------|
| Templates | 18 | ~3,600 | HIGH |
| Session Protocol | 3 | ~800 | HIGH |
| Skills | 4 | ~500 | MEDIUM |
| Specs | 3 | ~300 | MEDIUM |
| Session Logs | 231 | Historical | LOW |
| Other | 5 | ~200 | LOW |

**Total Active Files**: 33 files requiring migration
**Estimated Lines of Change**: ~5,400 lines

---

## 6. Discussion

### Key Migration Challenges

1. **Tool Name Divergence**: AI-agents uses mcp__serena__*prefix while Brain uses mcp__plugin_brain_brain__*. All tool invocations need systematic replacement.

2. **Init Sequence Simplification**: AI-agents requires two calls (activate_project + initial_instructions) while Brain uses single build_context call. Session protocols must be updated.

3. **Tiered Index Removal**: AI-agents L1/L2/L3 index structure does not exist in Brain. References to memory-index.md, skills-*-index.md patterns need removal or reimagination.

4. **Forgetful Elimination**: Brain has integrated semantic search (sqlite-vec) eliminating need for external Forgetful MCP. All memory-search_nodes, memory-open_nodes, etc. references must be replaced with Brain equivalents.

5. **Memory Router Logic**: The MemoryRouter.psm1 module implements Serena + Forgetful augmentation logic that needs refactoring for Brain-only operation.

### Architectural Alignment

Both systems share:

- Observation format: [category] content #tags
- Relation format: relation_type [[Target]]
- Session logging location: .agents/sessions/
- HANDOFF.md as read-only reference

This commonality simplifies migration since content formats remain compatible.

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Incomplete tool mapping | LOW | HIGH | Comprehensive grep validation post-migration |
| Session protocol disruption | MEDIUM | HIGH | Test session start/end cycles |
| Skill script breakage | MEDIUM | MEDIUM | Unit tests for MemoryRouter |
| Template generation drift | LOW | LOW | Run Generate-Agents.ps1 post-migration |

---

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
|----------|----------------|-----------|--------|
| P0 | Update SESSION-PROTOCOL.md init sequence | Blocks all session starts | 1 hour |
| P0 | Update 18 template files with Brain tools | Source for generated agents | 4 hours |
| P1 | Refactor MemoryRouter.psm1 for Brain-only | Core memory search path | 2 hours |
| P1 | Update Search-Memory.ps1 skill | Agent-facing skill | 1 hour |
| P1 | Update AGENT-SYSTEM.md documentation | Accuracy for new sessions | 2 hours |
| P2 | Update spec files | Reference accuracy | 1 hour |
| P2 | Review session log templates | Pattern consistency | 1 hour |
| P3 | Assess historical session logs | Determine if cleanup needed | 2 hours |

### Migration Script Requirements

A migration script should:

1. Replace mcp__serena__activate_project with mcp__plugin_brain_brain__build_context
2. Remove mcp__serena__initial_instructions calls (not needed)
3. Replace mcp__serena__write_memory with mcp__plugin_brain_brain__write_note
4. Replace mcp__serena__read_memory with mcp__plugin_brain_brain__read_note
5. Replace mcp__serena__list_memories with mcp__plugin_brain_brain__list_directory
6. Replace mcp__serena__edit_memory with mcp__plugin_brain_brain__edit_note
7. Replace memory-search_nodes with mcp__plugin_brain_brain__search
8. Replace memory-open_nodes with mcp__plugin_brain_brain__read_note
9. Replace memory-create_entities with mcp__plugin_brain_brain__write_note
10. Replace memory-add_observations with mcp__plugin_brain_brain__edit_note
11. Replace .serena/memories/ paths with Brain notes directory references
12. Remove Forgetful availability checks and fallback logic
13. Update L1/L2/L3 index references to direct search patterns

---

## 8. Conclusion

**Verdict**: Proceed with migration

**Confidence**: High

**Rationale**: Brain's architecture already supports all required memory operations. The migration is primarily a renaming and simplification exercise. Content formats (observations, relations) are compatible.

### User Impact

- **What changes for you**: Tool invocations in agents will use Brain MCP prefix. Session init simplifies to single call. No external Forgetful MCP required.
- **Effort required**: 15-20 hours of systematic updates across 33 active files
- **Risk if ignored**: Agents will fail to execute memory operations due to tool name mismatches

---

## 9. Appendices

### Appendix A: Sources Consulted

**Documentation**:

- <https://docs.basicmemory.com/guides/ai-assistant-guide/>
- <https://docs.basicmemory.com/guides/knowledge-format/>
- <https://docs.basicmemory.com/technical/technical-information/>
- <https://github.com/basicmachines-co/basic-memory/blob/main/docs/ai-assistant-guide-extended.md>
- <https://deepwiki.com/rjmurillo/ai-agents/6-memory-system>
- <https://deepwiki.com/rjmurillo/ai-agents/1-overview>

**Source Code**:

- /Users/peter.kloss/Dev/brain/apps/mcp/src/db/schema.ts
- /Users/peter.kloss/Dev/brain/apps/mcp/src/db/vectors.ts
- /Users/peter.kloss/Dev/brain/apps/mcp/src/services/search/index.ts
- /Users/peter.kloss/Dev/brain/apps/mcp/src/tools/bootstrap-context/index.ts
- /Users/peter.kloss/Downloads/ai-agents-main/AGENTS.md
- /Users/peter.kloss/Downloads/ai-agents-main/.agents/SESSION-PROTOCOL.md

**Brain Claude Plugin**:

- /Users/peter.kloss/Dev/brain/apps/claude-plugin/agents/AGENTS.md
- /Users/peter.kloss/Dev/brain/apps/claude-plugin/agents/memory.md
- /Users/peter.kloss/Dev/brain/apps/claude-plugin/skills/memory/references/

### Appendix B: Data Transparency

**Found**:

- Complete basic-memory tool reference
- Full Brain MCP source code for search and embedding
- AI-agents memory system documentation
- All files with Serena/Forgetful references in Brain claude-plugin

**Not Found**:

- Some deepwiki pages returned truncated content
- Specific ADR documents for Brain memory decisions
- Historical migration notes (if any exist)

### Appendix C: File Counts by Pattern

```text
Pattern: mcp__serena__|serena_|\.serena
Found: 231 files in apps/claude-plugin

Pattern: write_memory|read_memory|list_memories|edit_memory|delete_memory
Found: 16 files in apps/claude-plugin

Pattern: memory-search_nodes|memory-open_nodes|memory-create_entities|memory-add_observations
Found: 17 files in apps/claude-plugin

Pattern: mcp__plugin_brain_brain__
Found: 284 files in apps/claude-plugin (already migrated)
```
