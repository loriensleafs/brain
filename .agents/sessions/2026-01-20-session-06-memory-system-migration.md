# Session 06: Memory System Migration Planning

**Date**: 2026-01-20
**Branch**: main
**Starting Commit**: 2c32f9d (style: apply markdown linting fixes to analysis and QA documents)
**Agent**: orchestrator

---

## Objective

Understand and systematically migrate from ai-agents memory architecture (Serena/Forgetful) to brain's basic-memory foundation, establishing brain standards as we go.

---

## Key Insight

This is NOT a simple tool renaming task. Two different semantic graph implementations need to be mapped:

**ai-agents**:

- Structured Markdown Files → Basic Memory → Serena Memory
- Semantic Graph Search → Forgetful

**brain**:

- Structured Markdown Files → Basic Memory → Brain Semantic Search
- Different implementation, standards still evolving

---

## Critical Differences

1. **Brain is a moving target** - standards need to be defined as we migrate
2. **Entity types differ** - need to map ai-agents entities to brain entities
3. **Content standards required** - frontmatter, entities, relations, observations need validation
4. **Memory agent already deviated** - need to start fresh from ai-agents version

---

## Migration Scope

### Agents to Convert

- [ ] memory.md (start fresh from ai-agents)
- [ ] context-retrieval.md

### Commands to Convert

- [ ] context_gather.md
- [ ] memory-documentary.md
- [ ] forgetful commands (evaluate if needed)

### Skills to Convert

- [ ] curating-memories
- [ ] exploring-knowledge-graph
- [ ] memory
- [ ] memory-documentary
- [ ] serena-code-architecture
- [ ] using-forgetful-memory
- [ ] using-serena-symbols

---

## Entity Type Mapping

### ai-agents Entity Types

| Type | Pattern | Example | Purpose |
|------|---------|---------|---------|
| Skills | `{domain}-{topic}.md` | `powershell-testing-patterns.md` | Atomic strategies with evidence |
| Features | `feature-{name}.md` | `feature-authentication.md` | Requirements and scope |
| Decisions | `adr-{number}-{topic}.md` | `adr-014-distributed-handoff.md` | Architecture decisions |
| Patterns | `pattern-{name}.md` | `pattern-strategy-tax.md` | Problem signatures and solutions |
| Protocols | `{usage-type}.md` | `usage-mandatory.md` | Mandatory procedures |
| Sessions | `session-{id}.md` | `session-319-pr799-review.md` | Session context |

### brain Entity Types (to be defined)

**Confirmed**:

- Features
- Decisions
- Sessions

**To Define**: Standards for naming patterns and content structure

---

## Approach

Work iteratively, one section at a time, to:

1. Understand ai-agents implementation
2. Define brain standards
3. Map between systems
4. Validate quality

---

## Work Log

### Phase 1: Understanding CORE Architectural Difference

**CRITICAL: Basic Memory Knowledge Graph Foundation**

Brain is built on **basic-memory's persistent semantic knowledge graph**, not a tiered index system.

**Basic Memory Knowledge Graph Structure** (from <https://docs.basicmemory.com>):

1. **Entities** (Each markdown file):
   - Title (unique identifier)
   - Auto-generated permalink
   - YAML frontmatter (tags, entity type: note/person/project/decision/spec/meeting)
   - Observations (categorized facts with tags)
   - Relations (directional wikilinks)

2. **Observations** (Categorized facts):
   - Format: `- [category] content #tag1 #tag2`
   - Categories: [fact], [idea], [decision], [technique], [requirement], [problem], [solution], [insight]
   - Minimum 3-5 observations per note
   - Each observation should have 1-2 tags

3. **Relations** (Directional links):
   - Format: `- relation_type [[Target Entity]]`
   - Types: implements, requires, extends, part_of, contrasts_with, leads_to, caused_by
   - Minimum 2-3 relations per note
   - Forward references supported (can link before target exists)

**Best Practices**:

- Search before creating (prevent duplicates)
- Use exact entity titles in relations
- Specific relation types (avoid generic "relates_to")
- Progressive elaboration across sessions

---

### Phase 1b: ai-agents vs brain Comparison

**Analysis: Key Architectural Differences**

| Aspect | ai-agents (Serena/Forgetful) | brain (Basic Memory Knowledge Graph) |
|--------|------------------------------|--------------------------------------|
| **Architecture** | 3-tier index (L1 → L2 → L3) | Semantic knowledge graph with vector embeddings |
| **Storage** | `.serena/memories/` | `~/memories/{project}/` |
| **Tools** | `mcp__serena__*` | `mcp__plugin_brain_brain__*` |
| **Search** | Memory Router + tiered lookup | Direct semantic search |
| **Observations** | `[YYYY-MM-DD] [Source]: [Content]` | `- [category] content #tags` |
| **Relations** | Markdown list (supersedes, depends_on) | Wikilink syntax (relates_to, implements) |
| **Organization** | Domain indexes (skills-*-index.md) | Folder structure (analysis/, features/) |
| **Categories** | Date + source tracking | Category tags ([fact], [decision], [insight]) |

**Critical Insights**:

1. Brain is built on basic-memory's **knowledge graph model** (entities + observations + relations)
2. This is fundamentally different from ai-agents' tiered index system
3. Current brain memory agent (lines 82-327) inconsistently mixes both paradigms
4. Need fresh start based on basic-memory knowledge graph principles

**Observation Format Comparison**:

```markdown
# ai-agents
[2025-01-15] [roadmap]: Epic EPIC-001 created for OAuth2 integration
[2025-01-20] [implementer]: Sprint 1 started, 5/15 tasks in progress

# brain
- [decision] Epic EPIC-001 created for OAuth2 integration #roadmap #oauth
- [fact] Sprint 1 started, 5/15 tasks in progress #implementation
```

**Relation Format Comparison**:

```markdown
# ai-agents
## Relations
- **supersedes**: [previous-file-name]
- **depends_on**: [dependency-file-name]

# brain
## Relations
- relates_to [[Previous Version]]
- requires [[Dependency Note]]
```

---

### Phase 2: Defining brain Standards

**Entity Types to Define**:

| Entity Type | ai-agents Pattern | brain Pattern (TBD) | Priority |
|-------------|-------------------|---------------------|----------|
| Features | `feature-{name}.md` | ? | P0 |
| Decisions | `adr-{number}-{topic}.md` | ? | P0 |
| Sessions | `session-{id}.md` | ? | P0 |
| Skills | `{domain}-{topic}.md` | ? | P1 |
| Patterns | `pattern-{name}.md` | ? | P1 |
| Protocols | `{usage-type}.md` | ? | P1 |

**For each entity type, define**:

1. Naming pattern (file name)
2. Frontmatter schema
3. Required sections
4. Observation format
5. Relation types
6. Validation rules

---

### Phase 3: Memory Agent Section-by-Section Conversion

**Status**: COMPLETE

Converted all sections from ai-agents memory agent to brain:

**Sections Converted**:

1. ✅ Core Identity - Minimal changes (tool name)
2. ✅ Style Guide Compliance - Adapted observation format, added brain structure requirements
3. ✅ Activation Profile - No changes needed
4. ✅ Claude Code Tools - Tool name mappings (serena → brain)
5. ✅ Core Mission - No changes needed
6. ✅ Key Responsibilities - No changes needed
7. ✅ Memory Architecture - Complete rewrite (tiered indexes → knowledge graph)
8. ✅ Memory Tools Reference - Tool API changes
9. ✅ File Naming and Entity Identification - Added brain entity types with CAPS prefix pattern
10. ✅ Relations - Changed to wikilink syntax, added brain relation types
11. ✅ Retrieval Protocol - Semantic search instead of tiered lookup
12. ✅ Storage Protocol - Emphasized continuous curation, frequent updates
13. ✅ Skill Citation Protocol - Adapted for brain memory notes
14. ✅ Freshness Protocol - Source tracking via wikilinks/context
15. ✅ Handoff Protocol - Workflow-based state instead of HANDOFF.md
16. ✅ Execution Mindset - Added "Curate" principle

**Output**: `/Users/peter.kloss/Dev/brain/apps/claude-plugin/agents/memory.md` (replaced old version)

---

## Summary

### Accomplishments

**Standards Defined**:

- 11 semantic folders for brain projects
- 13 entity types with CAPS prefix naming convention
- Observation format: `- [category] content #tags`
- Relation format: `- relation_type [[Target Entity]]`
- Quality thresholds: 3-5 observations, 2-3 relations minimum
- Project-scoped storage with DEFAULT/CODE/custom path modes

**Key Architectural Differences Understood**:

- ai-agents: 3-tier index system (L1 → L2 → L3)
- brain: Knowledge graph with semantic search + vector embeddings
- ai-agents: Date+source observation format
- brain: Category tags + wikilinks for source attribution
- ai-agents: HANDOFF.md for session state
- brain: Workflow-based state management

**Memory Agent Converted**:

- All 16 sections adapted for brain
- Minimal changes approach - kept ai-agents structure where possible
- Basic-memory knowledge graph principles integrated
- Continuous curation and frequent updates emphasized

### Requirements Identified

**Need**: `validate_memory` Go utility function

- Validate note structure (frontmatter, sections)
- Check quality thresholds (observations, relations)
- Verify format compliance (category tags, wikilinks)
- Priority: Medium (not blocking)

---

### Folder Organization Research

**basic-memory docs recommend:**

- `specs/` - Specifications
- `decisions/` - Decision records
- `meetings/` - Meeting notes
- `conversations/` - AI conversations
- `implementations/` - Code/implementations
- `docs/` - Documentation

**brain .agents (current - 8 folders):**

- analysis, architecture, critique, planning, qa, security, sessions, specs

**ai-agents .agents (their repo - 25 folders):**

- analysis, architecture, archive, audit, benchmarks, critique, devops, governance, guides, handoffs, memory, metrics, operations, planning, pr-consolidation, prompts, qa, retrospective, roadmap, security, sessions, skillbook, skills, specs, steering

**markdown-renderer memories (actual brain project - 15 folders):**

- analysis, architecture, archive, best-practices, bugs, critique, decisions, features, implementation, performance, planning, qa, research, sessions, specs

**mcps memories (actual brain project - 3 folders):**

- brain, memory, polar-ui (organized by project name, not semantic category)

**Common folders across all sources:**

- analysis, architecture, critique, planning, qa, sessions, specs

**Decision: brain Semantic Folder Standard (11 core folders)**

- analysis/, decisions/, planning/, roadmap/, sessions/, specs/, critique/, qa/, security/, retrospective/, skills/

**Decision: brain Entity Types with Consistent Prefix Pattern**

| Semantic Folder | Entity Type | File Naming Pattern | Example |
|----------------|-------------|---------------------|---------|
| `decisions/` | `decision` | `ADR-{number}-{topic}.md` | `ADR-015-auth-strategy.md` |
| `sessions/` | `session` | `SESSION-YYYY-MM-DD-NN-{topic}.md` | `SESSION-2026-01-20-06-memory-migration.md` |
| `specs/{spec}/requirements/` | `requirement` | `REQ-{number}-{topic}.md` | `REQ-001-user-login.md` |
| `specs/{spec}/design/` | `design` | `DESIGN-{number}-{topic}.md` | `DESIGN-001-auth-flow.md` |
| `specs/{spec}/tasks/` | `task` | `TASK-{number}-{topic}.md` | `TASK-001-implement-jwt.md` |
| `analysis/` | `analysis` | `ANALYSIS-{number}-{topic}.md` | `ANALYSIS-001-memory-architecture.md` |
| `planning/` | `feature` | `FEATURE-{number}-{topic}.md` | `FEATURE-001-oauth-integration.md` |
| `roadmap/` | `epic` | `EPIC-{number}-{name}.md` | `EPIC-001-user-authentication.md` |
| `critique/` | `critique` | `CRIT-{number}-{topic}.md` | `CRIT-001-oauth-plan.md` |
| `qa/` | `test-report` | `QA-{number}-{topic}.md` | `QA-001-oauth-integration.md` |
| `security/` | `security` | `SEC-{number}-{component}.md` | `SEC-001-auth-flow.md` |
| `retrospective/` | `retrospective` | `RETRO-YYYY-MM-DD-{topic}.md` | `RETRO-2026-01-20-session-failures.md` |
| `skills/` | `skill` | `SKILL-{number}-{topic}.md` | `SKILL-001-markdownlint-before-edit.md` |

**Rationale**:

- Consistent CAPS prefix pattern (easier to scan, clear entity types)
- `SEC-` covers all security work (not just threat modeling)
- `QA-` covers test strategies, plans, reports, validation
- No generic `NOTE-` type (forces proper categorization, maintains graph quality)

---

### Required Utility: validate_memory

**Need**: Go utility function (not MCP tool) to validate individual note structure and quality

**Purpose**:

- Validate note structure (frontmatter, required sections)
- Check quality thresholds (3-5 observations, 2-3 relations)
- Verify observation format (category tags, hashtags)
- Validate relation format (wikilink syntax)
- Check entity type matches folder

**Usage**: Can be called from scripts, CI, or manual validation - not exposed as MCP tool

**Priority**: Medium - needed for quality assurance but not blocking memory agent conversion

---

## Next Steps

**Remaining Memory Migration Work**:

1. **Other Memory Agents**:
   - context-retrieval.md (from ai-agents)

2. **Memory Commands**:
   - context_gather.md
   - memory-documentary.md
   - forgetful commands (evaluate if needed)

3. **Memory Skills**:
   - curating-memories
   - exploring-knowledge-graph
   - memory
   - memory-documentary
   - serena-code-architecture
   - using-forgetful-memory
   - using-serena-symbols

4. **Create Brain Standard Notes** (optional):
   - brain-knowledge-graph-principles.md
   - brain-entity-types.md
   - brain-observation-standards.md
   - brain-relation-taxonomy.md
   - brain-folder-organization.md

5. **Implement validate_memory utility** (Go function)

**Decision**: Continue with iterative approach - convert agents/commands/skills one at a time, establishing standards just-in-time as needed.
