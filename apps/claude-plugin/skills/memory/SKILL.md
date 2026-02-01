---
name: memory
version: 0.1.0
description: Memory system for AI agents. Tier 1 Semantic (Brain MCP search). Tier 2-3
  (Episodic/Causal) planned for future phases. Enables memory-first architecture.
license: MIT
model: claude-sonnet-4-5
metadata:
  adr: [ADR-007, ADR-020]
  reference: ai-agents memory skill v0.2.0
  brain_version: 0.1.0
  timelessness: 8/10
---
# Memory System Skill

Memory operations for AI agents using Brain MCP.

---

## Quick Start

```typescript
// Tier 1: Search memory (Semantic)
mcp__plugin_brain_brain__search({
  query: "git hooks",
  limit: 10,
  mode: "auto"
})

// Tier 1: List available memories
mcp__plugin_brain_brain__list_directory({
  dir_name: "/",
  depth: 2
})

// Tier 1: Read specific memory
mcp__plugin_brain_brain__read_note({
  identifier: "usage-mandatory"
})
```

```bash
# Tier 2: Extract episode from session (Episodic)
bun run apps/claude-plugin/skills/memory/scripts/extract-episode.ts \
  --session SESSION-2026-01-20-06

# Tier 3: Add pattern (Causal)
bun run apps/claude-plugin/skills/memory/scripts/add-pattern.ts \
  --name "Memory-First Investigation" \
  --trigger "Agent wants to change existing system" \
  --action "Search memory before making changes" \
  --success-rate 0.95
```

---

## Memory-First as Chesterton's Fence

**Core Insight**: Memory-first architecture implements Chesterton's Fence principle for AI agents.

> "Do not remove a fence until you know why it was put up" - G.K. Chesterton

**Translation for agents**: Do not change code/architecture/protocol until you search memory for why it exists.

### Why This Matters

**Without memory search** (removing fence without investigation):

- Agent encounters complex code, thinks "this is ugly, I'll refactor it"
- Removes validation logic that prevents edge case
- Production incident occurs
- Memory contains past incident that explains why validation existed

**With memory search** (Chesterton's Fence investigation):

- Agent encounters complex code
- Searches memory: `mcp__plugin_brain_brain__search({ query: "validation logic edge case" })`
- Finds past incident explaining why code exists
- Makes informed decision: preserve, modify, or replace with equivalent safety

### Investigation Protocol

When you encounter something you want to change:

| Change Type | Memory Search Required |
|-------------|------------------------|
| Remove ADR constraint | `mcp__plugin_brain_brain__search({ query: "[constraint name]" })` |
| Bypass protocol | `mcp__plugin_brain_brain__search({ query: "[protocol name] why" })` |
| Delete >100 lines | `mcp__plugin_brain_brain__search({ query: "[component] purpose" })` |
| Refactor complex code | `mcp__plugin_brain_brain__search({ query: "[component] edge case" })` |
| Change workflow | `mcp__plugin_brain_brain__search({ query: "[workflow] rationale" })` |

### What Memory Contains (Git Archaeology)

**Tier 1 (Semantic)**: Facts, patterns, constraints

- Why does PowerShell-only constraint exist? (ADR-005)
- Why do skills exist instead of raw CLI? (usage-mandatory)
- What incidents led to BLOCKING gates? (protocol-blocking-gates)

**Tier 2 (Episodic)**: Past session outcomes [FUTURE]

- What happened when we tried approach X? (session replay)
- What edge cases did we encounter? (failure episodes)

**Tier 3 (Causal)**: Decision patterns [FUTURE]

- What decisions led to success? (causal paths)
- What patterns should we repeat/avoid? (success/failure patterns)

### Memory-First Gate (BLOCKING)

**Before changing existing systems, you MUST**:

1. `mcp__plugin_brain_brain__search({ query: "[topic]" })`
2. Review results for historical context
3. If insufficient, document gap (Tiers 2-3 not yet available)
4. Document findings in decision rationale
5. Only then proceed with change

**Why BLOCKING**: <50% compliance with "check memory first" guidance. Making it BLOCKING achieves 100% compliance (same pattern as session protocol gates).

**Verification**: Session logs must show memory search BEFORE decisions, not after.

### Connection to Chesterton's Fence Analysis

See ADR-007 for:

- Memory-first architecture principles
- Investigation protocol
- Verification requirements
- BLOCKING gate enforcement

**Key takeaway**: Memory IS your investigation tool. It contains the "why" that Chesterton's Fence requires you to discover.

---

## Triggers

| Trigger Phrase | Maps To |
|----------------|---------|
| "search memory for X" | Tier 1: `mcp__plugin_brain_brain__search()` |
| "what do we know about X" | Tier 1: `mcp__plugin_brain_brain__search()` |
| "list memories" | Tier 1: `mcp__plugin_brain_brain__list_directory()` |
| "read memory X" | Tier 1: `mcp__plugin_brain_brain__read_note()` |
| "extract episode from session" | Tier 2: `bun run scripts/extract-episode.ts --session SESSION-X` |
| "what happened in session X" | Tier 2: `mcp__plugin_brain_brain__read_note({ identifier: "EPISODE-X" })` |
| "find sessions with failures" | Tier 2: `mcp__plugin_brain_brain__search({ query: "outcome:failure", folder: "episodes" })` |
| "add pattern" | Tier 3: `bun run scripts/add-pattern.ts --name "..." --trigger "..."` |
| "what patterns led to success" | Tier 3: `mcp__plugin_brain_brain__search({ query: "success_rate:>0.7", folder: "patterns" })` |

---

## Quick Reference

| Operation | Tool | Key Parameters |
|-----------|------|----------------|
| Search facts/patterns | `mcp__plugin_brain_brain__search` | `query`, `mode`, `limit` |
| List memories | `mcp__plugin_brain_brain__list_directory` | `dir_name`, `depth` |
| Read memory | `mcp__plugin_brain_brain__read_note` | `identifier` |
| Write memory | `mcp__plugin_brain_brain__write_note` | `title`, `content`, `folder` |
| Edit memory | `mcp__plugin_brain_brain__edit_note` | `identifier`, `operation`, `content` |
| Extract episode | `bun run scripts/extract-episode.ts` | `--session SESSION-ID`, `--force` |
| Query episodes | `mcp__plugin_brain_brain__search` | `query`, `folder: "episodes"` |
| Read episode | `mcp__plugin_brain_brain__read_note` | `identifier: "EPISODE-{id}"` |
| Add pattern | `bun run scripts/add-pattern.ts` | `--name`, `--trigger`, `--action`, `--success-rate` |
| Query patterns | `mcp__plugin_brain_brain__search` | `query`, `folder: "patterns"` |
| Get antipatterns | `mcp__plugin_brain_brain__search` | `query: "success_rate:<0.3"` |

---

## Decision Tree

```text
What do you need?
│
├─► Current facts, patterns, or rules?
│   └─► TIER 1: mcp__plugin_brain_brain__search()
│
├─► List available memories?
│   └─► TIER 1: mcp__plugin_brain_brain__list_directory()
│
├─► Read specific memory?
│   └─► TIER 1: mcp__plugin_brain_brain__read_note()
│
├─► What happened in a specific session?
│   ├─ Extract first: bun run scripts/extract-episode.ts [log-path]
│   └─► TIER 2: mcp__plugin_brain_brain__read_note({ identifier: "EPISODE-X" })
│
├─► Recent sessions with specific outcome?
│   └─► TIER 2: mcp__plugin_brain_brain__search({ query: "outcome:failure" })
│
├─► Why did decision X lead to outcome Y?
│   └─► TIER 3: Search related patterns, trace WikiLink relations
│
├─► What patterns have high success rate?
│   └─► TIER 3: mcp__plugin_brain_brain__search({ query: "success_rate:>0.7" })
│
├─► Need to store new knowledge?
│   ├─ Session complete? → bun run scripts/extract-episode.ts
│   ├─ Pattern discovered? → bun run scripts/add-pattern.ts
│   └─ Factual knowledge? → mcp__plugin_brain_brain__write_note()
│
└─► Not sure which tier?
    └─► Start with TIER 1 (search), escalate to Tier 2/3 if insufficient
```

---

## Anti-Patterns

| Anti-Pattern | Do This Instead |
|--------------|-----------------|
| Skipping memory search | Always search before multi-step reasoning |
| Using old Serena/Forgetful tools | Use Brain MCP tools (`mcp__plugin_brain_brain__*`) |
| Expecting Tier 2-3 features | Document needs, these are planned for future |
| Not documenting memory gaps | When memory lacks info, note it for future enhancement |
| Skipping pre-flight validation | ALWAYS complete validation checklist before writes |
| Writing to wrong folder | Check entity type to folder mapping |
| Missing CAPS prefix in filename | Follow pattern: `{PREFIX}-{NNN}-{topic}.md` |
| Fewer than 3 observations | Add more facts/decisions with categories |
| No relations section | Add 2+ wikilinks to related entities |
| Generic NOTE-* entity type | Choose specific entity type (13 valid types) |

---

## Storage Locations

> **Configuration**: Memory paths configured in `~/.config/brain/config.json` (see ADR-020).

| Mode | Example Path | Pattern Explanation |
|------|--------------|---------------------|
| DEFAULT | ~/memories/brain/episodes/ | {memories_location}/{project}/episodes/ |
| CODE | ~/Dev/brain/docs/episodes/ | {code_path}/docs/episodes/ (no /{project}) |
| CUSTOM | /custom/path/episodes/ | {memories_path}/episodes/ (no /{project}) |

Note: `memories_location` defaults to `~/memories` but is configurable via `brain config set memories-location <path>`.

| Data | Location |
|------|----------|
| Brain config | `~/.config/brain/config.json` |
| Brain memories | `{resolved_path}/` (see modes above) |
| Episodes | `{resolved_path}/episodes/EPISODE-*.md` |
| Patterns | `{resolved_path}/patterns/PATTERN-*.md` |
| Sessions | `{resolved_path}/sessions/SESSION-*.md` |
| Governance | `{resolved_path}/governance/` |

**Notes**:

- Brain MCP tools handle path resolution automatically. Do not use hardcoded paths in agent instructions.
- The `memories_location` default is `~/memories` but can be configured per-project or globally.
- ADR-020 defines three modes: DEFAULT, CODE, CUSTOM (see table above).

---

## Verification

| Operation | Verification |
|-----------|--------------|
| Search completed | Result count > 0 OR logged "no results" |
| Memory read | Note content returned |
| Memory written | Confirmation with permalink |
| Episode extracted | Markdown file created in `episodes/` folder |
| Pattern added | Markdown file created in `patterns/` folder |
| Pattern updated | Success rate recalculated, occurrences incremented |

---

## Related Skills

| Skill | When to Use Instead |
|-------|---------------------|
| `curating-memories` | Memory maintenance (if available) |
| `exploring-knowledge-graph` | Multi-hop graph traversal (if available) |

---

## Write Operations Governance (BLOCKING)

> **References**:
>
> - ADR-019: Memory Operations Governance (validation-based governance)
> - ADR-020: Configuration Architecture Refactoring (storage locations, terminology)

**All agents MAY write to Brain memory using this skill.**

The agent system uses one-level delegation. Subagents cannot delegate to other subagents. When orchestrator delegates to analyst, analyst must be able to write directly. Governance is achieved through pre-flight validation, not access control.

**Non-compliant writes create governance debt**:

- Notes in wrong folders
- Inconsistent naming (missing CAPS prefix)
- Missing quality thresholds
- Broken knowledge graph relations

### All Agents Can Write (with Validation)

| Agent | write_note | edit_note | Requirement |
|-------|------------|-----------|-------------|
| **All agents** | **Yes** | **Yes** | MUST complete pre-flight validation |

**No delegation required.** All agents write directly after completing validation.

### Pre-Flight Validation (BLOCKING - All Agents)

Before calling `write_note` or `edit_note`, you MUST complete this checklist:

```markdown
### Pre-Flight Checklist (MUST all pass before write)

- [ ] Entity type is valid (13 types only, see table below)
- [ ] Folder matches entity type (see mapping)
- [ ] File name follows CAPS prefix pattern
- [ ] Frontmatter has: title, type, tags (2-5)
- [ ] Observations section: 3-10 entries with categories
- [ ] Observation format: `- [category] content #tags`
- [ ] Relations section: 2-8 entries with wikilinks
- [ ] Relation format: `- relation_type [[Target Entity]]`
```

**Agents that skip validation create governance debt.** Post-hoc audit will detect violations.

### Entity Type to Folder Mapping (Canonical)

| Entity Type | Folder | File Pattern |
|-------------|--------|--------------|
| decision | decisions/ | `ADR-{NNN}-{topic}.md` |
| session | sessions/ | `SESSION-YYYY-MM-DD-NN-{topic}.md` |
| requirement | specs/{spec}/requirements/ | `REQ-{NNN}-{topic}.md` |
| design | specs/{spec}/design/ | `DESIGN-{NNN}-{topic}.md` |
| task | specs/{spec}/tasks/ | `TASK-{NNN}-{topic}.md` |
| analysis | analysis/ | `ANALYSIS-{NNN}-{topic}.md` |
| feature | planning/ | `FEATURE-{NNN}-{topic}.md` |
| epic | roadmap/ | `EPIC-{NNN}-{name}.md` |
| critique | critique/ | `CRIT-{NNN}-{topic}.md` |
| test-report | qa/ | `QA-{NNN}-{topic}.md` |
| security | security/ | `SEC-{NNN}-{component}.md` |
| retrospective | retrospective/ | `RETRO-YYYY-MM-DD-{topic}.md` |
| skill | skills/ | `SKILL-{NNN}-{topic}.md` |

**No generic `NOTE-*` type allowed.** Forces proper categorization.

### Valid Observation Categories

```text
[fact], [decision], [requirement], [technique], [insight],
[problem], [solution], [constraint], [risk], [outcome]
```

### Valid Relation Types

```text
implements, depends_on, relates_to, extends, part_of,
inspired_by, contains, pairs_with, supersedes, leads_to, caused_by
```

### Quality Thresholds

| Element | Min | Max | Example |
|---------|-----|-----|---------|
| Observations | 3 | 10 | `- [decision] Using JWT #auth` |
| Relations | 2 | 8 | `- implements [[REQ-001]]` |
| Tags | 2 | 5 | `tags: [auth, security]` |

### Example: Compliant Note Structure

```markdown
---
title: ADR-019 Memory Governance
type: decision
tags: [memory, governance, enforcement]
---

# ADR-019 Memory Governance

## Context

Agents writing to memory without conventions create governance debt.

## Observations

- [decision] Validation-based governance selected #architecture
- [fact] All agents retain direct write access #one-level-delegation
- [requirement] Pre-flight validation MUST pass before writes #blocking
- [technique] Memory skill provides validation guidance (not access control) #pattern

## Relations

- supersedes [[Ad-hoc Memory Writing]]
- implements [[ADR-007 Memory-First Architecture]]
- relates_to [[Session 06 Entity Standards]]
```

### Write Operation Decision Tree

```text
Need to write/edit a memory note?
│
├─► Run pre-flight validation checklist
│   │
│   ├─► All checks PASS: Proceed with write_note/edit_note
│   │
│   └─► Any check FAILS: Fix violations before writing
│       │
│       ├─► Wrong folder? Check entity type mapping
│       ├─► Missing CAPS prefix? Follow naming pattern
│       ├─► Too few observations? Add more facts/decisions
│       └─► No relations? Add 2+ wikilinks
│
├─► Unsure about conventions?
│   │
│   └─► Consult this skill for entity type mapping, naming patterns, examples
│
└─► Read/search operations: Always allowed directly (no validation needed)
```

**All agents write directly.** No delegation to memory agent required.

---

## Tier 2: Episodic Memory

Session replay via structured episode extraction. Reduces session logs from 10K-50K tokens to 500-2000 tokens.

**Capabilities**:

- Extract structured episodes from completed session logs
- Query past sessions by outcome/task/date
- Read decision sequences and event timelines
- 95% token reduction vs full session logs

**Architecture**: Markdown notes in `episodes/` folder with structured frontmatter, integrated with basic-memory knowledge graph.

**Usage**:

```bash
# Extract episode from completed session (reads from Brain memory)
bun run apps/claude-plugin/skills/memory/scripts/extract-episode.ts \
  --session SESSION-2026-01-20-06

# Query episodes by outcome
mcp__plugin_brain_brain__search({
  query: "outcome:failure",
  folder: "episodes",
  limit: 10
})

# Read specific episode
mcp__plugin_brain_brain__read_note({
  identifier: "EPISODE-2026-01-20-06"
})
```

### Tier 3: Causal Graph

Decision pattern tracking with statistical validation. Prevents repeated mistakes through success rate tracking.

**Capabilities**:

- Track cause-effect relationships via WikiLink relations
- Success rate tracking for patterns (running average)
- Anti-pattern detection (low success rate patterns)
- Pattern queries via semantic search

**Architecture**: Pattern notes in `patterns/` folder with typed WikiLink relations (causes, enables, prevents, correlates).

**Usage**:

```bash
# Add new pattern
bun run apps/claude-plugin/skills/memory/scripts/add-pattern.ts \
  --name "Memory-First Investigation" \
  --trigger "Agent wants to change existing system" \
  --action "Search memory before making changes" \
  --success-rate 0.95

# Query high success patterns
mcp__plugin_brain_brain__search({
  query: "success_rate:>0.7",
  folder: "patterns"
})

# Find antipatterns
mcp__plugin_brain_brain__search({
  query: "success_rate:<0.3",
  folder: "patterns"
})
```

**Reference**: See ADR-018 for complete episodic and causal memory architecture.

---
