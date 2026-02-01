---
status: proposed
date: 2026-01-21
decision-makers: [architect, planner]
consulted: [analyst, memory]
informed: [implementer, orchestrator]
---

# ADR-018: Episodic and Causal Memory Architecture for Brain

## Context and Problem Statement

Brain has successfully implemented Tier 1 (Semantic Memory) using basic-memory's knowledge graph model with markdown files, WikiLink relations, and vector embeddings. The ai-agents repository contains proven implementations of Tier 2 (Episodic Memory) and Tier 3 (Causal Graph) using JSON files with PowerShell tooling.

How should we implement Tiers 2-3 in brain to leverage basic-memory's strengths while preserving the proven functionality from ai-agents?

## Decision Drivers

* **Consistency**: Memory architecture should align with basic-memory's markdown-first philosophy
* **Queryability**: Episodes and causal relationships must be searchable via semantic search
* **Interoperability**: Relations between episodes, patterns, and semantic notes should work seamlessly
* **Performance**: Episode retrieval for similar past situations needs sub-second response
* **Tooling**: MCP tools must support episode and causal operations without adding external dependencies
* **Migration**: Existing ai-agents episode/causal data should be importable

## Considered Options

### Tier 2 (Episodic Memory) Storage

* **Option A**: Separate JSON files (mirror ai-agents approach)
* **Option B**: Markdown notes in `episodes/` folder with structured frontmatter
* **Option C**: Hybrid (JSON for structured storage, markdown facade for Brain MCP access)

### Tier 3 (Causal Graph) Storage

* **Option A**: Single JSON file (mirror ai-agents approach)
* **Option B**: Extend basic-memory relations with causal relation types
* **Option C**: Dedicated `patterns/` folder with pattern notes plus graph index

## Decision Outcome

### Tier 2: Option B - Markdown Episode Notes

Chosen because it aligns with brain's architecture philosophy and enables seamless integration with semantic search.

### Tier 3: Option C - Pattern Notes with Computed Graph

Chosen because it provides human-readable patterns while maintaining graph traversal capability.

## Architecture Design

### Tier 2: Episodic Memory as Markdown Notes

#### Storage Model

Episodes stored as markdown notes in `episodes/` folder with structured frontmatter:

```markdown
---
title: EPISODE-2026-01-21-session-42
type: episode
tags: [episodic, memory, session-42]
permalink: episodes/episode-2026-01-21-session-42
outcome: success
task: Implement episodic memory architecture
duration_minutes: 45
metrics:
  tool_calls: 23
  errors: 2
  recoveries: 2
  commits: 3
  files_changed: 8
---

# EPISODE-2026-01-21-session-42

## Context
Session implementing ADR-018 episodic memory architecture.

## Observations
- [decision:d001] Chose markdown over JSON for episode storage #architecture #decision
- [decision:d002] Selected pattern notes over single JSON for causal graph #architecture
- [event:e001] Initial analysis completed after reviewing schemas #milestone
- [event:e002] Architecture document drafted #milestone
- [error:e003] Missing Brain MCP build_context tool #error #recovered

## Decisions

### d001: Episode Storage Format
- **Timestamp**: 2026-01-21T10:30:00Z
- **Type**: design
- **Context**: Need to store episodic memory in brain
- **Options**: JSON files, Markdown notes, Hybrid
- **Chosen**: Markdown notes
- **Rationale**: Aligns with basic-memory philosophy, enables semantic search
- **Outcome**: success
- **Effects**: [[d002]] enabled by this decision

### d002: Causal Graph Storage
- **Timestamp**: 2026-01-21T10:45:00Z
- **Type**: design
- **Context**: Need causal reasoning capability
- **Options**: Single JSON, Extended relations, Pattern notes
- **Chosen**: Pattern notes with computed graph
- **Outcome**: success

## Events Timeline
1. [2026-01-21T10:00:00Z] Session started
2. [2026-01-21T10:15:00Z] Schema analysis completed
3. [2026-01-21T10:30:00Z] Decision d001 made
4. [2026-01-21T10:45:00Z] Decision d002 made
5. [2026-01-21T10:50:00Z] ADR drafted

## Lessons Learned
- Markdown-first approach enables better searchability
- Structured frontmatter captures metrics without losing readability
- WikiLinks between decisions create natural causality

## Relations
- part_of [[SESSION-2026-01-21-42]]
- implements [[ADR-018 Episodic Memory Architecture]]
- leads_to [[PATTERN-markdown-episode-format]]
```

#### Episode Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | EPISODE-YYYY-MM-DD-session-NN format |
| `type` | string | Yes | Always "episode" |
| `tags` | array | Yes | Must include "episodic" |
| `permalink` | string | Yes | episodes/{episode-id} |
| `outcome` | enum | Yes | success, partial, failure |
| `task` | string | Yes | High-level task description |
| `duration_minutes` | number | No | Session duration |
| `metrics` | object | No | tool_calls, errors, recoveries, commits, files_changed |

#### Episode Content Sections

| Section | Purpose |
|---------|---------|
| `## Context` | Why this episode matters |
| `## Observations` | Categorized facts with tags |
| `## Decisions` | Structured decision records |
| `## Events Timeline` | Chronological event list |
| `## Lessons Learned` | Key takeaways |
| `## Relations` | Links to sessions, ADRs, patterns |

### Tier 3: Causal Graph as Pattern Notes

#### Storage Model

Causal patterns stored as markdown notes in `patterns/` folder:

```markdown
---
title: PATTERN-serena-first-routing
type: pattern
tags: [causal, pattern, routing, memory]
permalink: patterns/pattern-serena-first-routing
trigger: Memory query needed during session
success_rate: 0.85
occurrences: 12
last_validated: 2026-01-21
---

# PATTERN-serena-first-routing

## Context
When agents need to query memory during a session, routing to Serena before Forgetful reduces latency and improves relevance.

## Trigger
Memory query request during active session

## Action
Route query to Serena semantic search first. If no results above 0.7 threshold, fall back to Forgetful keyword search.

## Observations
- [evidence] 12 sessions used this pattern #validated
- [evidence] 85% success rate (10/12 sessions) #metrics
- [evidence] Average 200ms faster than Forgetful-first #performance
- [causal] Fast response -> maintains context -> better decisions #chain

## Causal Relationships
- enables [[PATTERN-continuous-context]]
- prevents [[PATTERN-context-loss]]
- correlates [[ADR-007 Memory First Architecture]]

## Evidence Episodes
- [[EPISODE-2026-01-20-session-41]] - success
- [[EPISODE-2026-01-19-session-40]] - success
- [[EPISODE-2026-01-18-session-39]] - partial (fallback used)

## Anti-Pattern Warning
Skipping Serena and going direct to Forgetful causes:
- Higher latency (400ms average increase)
- Lower relevance (keyword matching misses semantic connections)
- See [[ANTIPATTERN-forgetful-first]] for evidence

## Relations
- validates [[ADR-007 Memory First Architecture]]
- part_of [[Memory Routing Strategy]]
- caused_by [[Research on memory system performance]]
```

#### Graph Computation Strategy

The causal graph is computed on-demand from pattern notes rather than stored as a separate JSON file:

1. **Node Discovery**: Parse all notes in `patterns/` folder
2. **Edge Extraction**: Parse `## Causal Relationships` sections for relation types
3. **Weight Calculation**: Compute from success_rate and occurrences frontmatter
4. **Path Finding**: BFS/DFS on computed graph structure

This approach provides:
* Human-readable patterns
* Semantic searchability
* Automatic embedding generation
* No sync issues between graph and patterns

#### Causal Relation Types

Extend basic-memory relation types with causal semantics:

| Relation Type | Meaning | Example |
|---------------|---------|---------|
| `causes` | Direct causation | `- causes [[Outcome A]]` |
| `enables` | Makes possible | `- enables [[Pattern B]]` |
| `prevents` | Blocks occurrence | `- prevents [[Error C]]` |
| `correlates` | Statistical association | `- correlates [[Metric D]]` |

These are parsed from the `## Causal Relationships` section (distinct from `## Relations`).

### Tool Implementation Strategy

#### New Brain MCP Tools Required

| Tool | Purpose | Implementation |
|------|---------|----------------|
| `store_episode` | Create episode note from session data | TypeScript tool |
| `query_episodes` | Search episodes by outcome, task, date | TypeScript tool (wrapper around search) |
| `get_decision_sequence` | Extract decisions from episode | TypeScript tool |
| `add_pattern` | Create/update pattern note | TypeScript tool |
| `query_patterns` | Search patterns by trigger, success_rate | TypeScript tool |
| `get_causal_path` | Find path between nodes in computed graph | TypeScript tool |
| `get_antipatterns` | Find patterns with low success_rate | TypeScript tool |

#### Implementation Priority

| Phase | Tools | Rationale |
|-------|-------|-----------|
| Phase 1 | `store_episode`, `query_episodes` | Enable episode capture |
| Phase 2 | `add_pattern`, `query_patterns` | Enable pattern learning |
| Phase 3 | `get_causal_path`, `get_decision_sequence`, `get_antipatterns` | Enable causal reasoning |

#### Existing Tool Compatibility

| Existing Tool | Tier 2/3 Usage |
|---------------|----------------|
| `write_note` | Can create episodes/patterns manually |
| `edit_note` | Can update episode observations |
| `search` | Finds episodes/patterns via semantic search |
| `read_note` | Retrieves specific episode/pattern |
| `build_context` | Includes recent episodes in context |

### Migration Path

#### From ai-agents Episodes

1. Parse existing `episode-*.json` files
2. Transform to markdown format using schema mapping:

```typescript
interface EpisodeTransform {
  // JSON field -> Markdown location
  id: 'frontmatter.title',
  session: 'frontmatter.permalink',
  timestamp: 'frontmatter.date',
  outcome: 'frontmatter.outcome',
  task: 'frontmatter.task',
  decisions: '## Decisions section',
  events: '## Events Timeline section',
  metrics: 'frontmatter.metrics',
  lessons: '## Lessons Learned section'
}
```

1. Generate WikiLinks for decision effects (d001 -> [[d002]])
2. Write to `episodes/` folder

#### From ai-agents Causal Graph

1. Parse `causal-graph.json` nodes array
2. Create pattern note for each node type=pattern
3. For non-pattern nodes, create observation entries in related episodes
4. Parse edges array to populate `## Causal Relationships` sections
5. Verify graph integrity by computing and comparing

### Integration with Session Protocol

#### Session Start

```text
1. bootstrap_context includes recent episodes (outcome=failure, last 7 days)
2. Query antipatterns for warnings
3. Load relevant patterns for task type
```

#### Session End

```text
1. Extract session log -> episode note via Extract-SessionEpisode.ps1
2. Update related patterns with new evidence
3. Compute new antipatterns if failure occurred
```

### Directory Structure

```text
~/memories/{project}/
├── episodes/
│   ├── EPISODE-2026-01-21-session-42.md
│   └── EPISODE-2026-01-20-session-41.md
├── patterns/
│   ├── PATTERN-serena-first-routing.md
│   ├── PATTERN-continuous-context.md
│   └── ANTIPATTERN-forgetful-first.md
├── decisions/
├── sessions/
├── skills/
└── ...
```

## Consequences

### Positive

* Episodes and patterns are human-readable markdown
* Full semantic search capability via embeddings
* WikiLinks create natural knowledge graph connections
* No external JSON files to maintain
* Existing Brain MCP tools work with new note types
* Patterns can reference and be referenced by all other note types

### Negative

* Graph traversal requires parsing markdown (vs direct JSON access)
* Migration effort from existing ai-agents data
* More complex episode creation (structured markdown vs JSON)
* Success rate/occurrence tracking requires frontmatter parsing

### Neutral

* PowerShell scripts (Extract-SessionEpisode.ps1) remain for session extraction
* TypeScript tools added to Brain MCP for specialized operations
* Pattern success rates are denormalized (stored in frontmatter, not computed)

## Confirmation

Implementation will be confirmed through:

1. Design review by architect agent
2. Prototype implementation of `store_episode` tool
3. Migration test with sample ai-agents episodes
4. Integration test with session protocol

## Reversibility Assessment

* **Rollback capability**: Episodes/patterns are markdown files, easily reversible
* **Vendor lock-in**: None - pure markdown with frontmatter
* **Exit strategy**: Export to JSON if needed
* **Legacy impact**: ai-agents data can be imported, no breaking changes
* **Data migration**: Reversing creates markdown -> JSON export (straightforward)

## More Information

### Related ADRs
* [[ADR-007 Memory First Architecture]] - Established memory-first principle
* [[ADR-001 Search Service Abstraction]] - Search infrastructure
* ADR-038 (ai-agents) - Original Reflexion Memory Schema

### Implementation References
* ai-agents ReflexionMemory.psm1 - Episode/pattern functions
* brain relationFollowing.ts - WikiLink extraction
* brain organizer/types.ts - Quality issue patterns

### Schema Compatibility

Episode frontmatter maps to ai-agents episode.schema.json:

| ai-agents Field | brain Frontmatter |
|-----------------|-------------------|
| `id` | `title` (EPISODE-*) |
| `session` | Derived from title |
| `timestamp` | `date` in frontmatter |
| `outcome` | `outcome` |
| `task` | `task` |
| `metrics` | `metrics` object |
| `decisions` | `## Decisions` section |
| `events` | `## Events Timeline` section |
| `lessons` | `## Lessons Learned` section |

Causal graph computed from pattern notes:

| ai-agents Field | brain Source |
|-----------------|--------------|
| `nodes` | Pattern notes in `patterns/` |
| `edges` | `## Causal Relationships` sections |
| `patterns` | Notes with `type: pattern` frontmatter |
