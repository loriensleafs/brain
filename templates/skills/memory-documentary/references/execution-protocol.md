# Memory Documentary Execution Protocol

Detailed instructions for generating evidence-based documentary reports.

---

## Phase 1: Topic Comprehension (RE2)

Before searching, re-read the topic and answer:

1. **Core Concept**: What is the central subject to investigate?
2. **Search Variants**: What alternative phrasings or related terms should be included?
3. **Scope Boundaries**: What is explicitly IN scope? What is OUT of scope?
4. **Success Criteria**: What would make this analysis valuable?

**Confidence Note**: Brain MCP tools are the primary data source. Use semantic search with folder scoping and depth traversal for comprehensive coverage.

---

## Phase 2: Investigation Planning (Plan-and-Solve)

Create an explicit search plan BEFORE executing queries:

### Brain Memory Queries

Search across multiple folders and with different query variants:

```python
# Semantic search across all notes
mcp__plugin_brain_brain__search({
  "query": "[topic]",
  "mode": "semantic",
  "limit": 10
})

# Search with depth for related notes
mcp__plugin_brain_brain__search({
  "query": "[topic]",
  "mode": "semantic",
  "depth": 2,
  "limit": 10
})

# Folder-scoped searches for specific domains
mcp__plugin_brain_brain__search({
  "query": "[topic]",
  "folder": "decisions",
  "limit": 10
})

mcp__plugin_brain_brain__search({
  "query": "[topic]",
  "folder": "sessions",
  "limit": 10
})

# Read specific notes for full content
mcp__plugin_brain_brain__read_note({
  "identifier": "<note title or permalink>"
})

# Browse folders for discovery
mcp__plugin_brain_brain__list_directory({
  "dir_name": "analysis",
  "depth": 2
})
```

### Project Artifacts

List specific grep patterns and file paths:

| Folder | Pattern | Purpose |
|--------|---------|---------|
| `retrospective/` | Search for topic keywords | Learning extractions |
| `sessions/` | Search for topic keywords | Session logs |
| `analysis/` | List directory contents | Research reports |
| `decisions/` | Search for ADR keywords | Decisions |

### GitHub Issues

```bash
# Open issues
gh issue list --state open --search "[topic]" --json number,title,body,comments,labels,createdAt

# Closed issues
gh issue list --state closed --search "[topic]" --json number,title,body,comments,labels,createdAt,closedAt
```

---

## Phase 3: Data Collection

### Thread 1: Brain Memory Notes

Execute queries from Phase 2 plan. For each result, capture:

| Field | Required |
|-------|----------|
| Note title/permalink | Yes |
| Source folder | Yes |
| Creation date | Yes |
| Entity type | Yes |
| Direct quote | Yes |
| Related notes (via relations) | If available |

### Thread 2: Project Artifacts

For each matching file:

| Field | Required |
|-------|----------|
| File path | Yes |
| Line numbers | For key passages |
| Direct quotes | Yes |
| Git date | If possible (`git log -1 --format=%ai [file]`) |

### Thread 3: GitHub Issues

For each relevant issue:

| Field | Required |
|-------|----------|
| Issue number | Yes |
| Link | Yes |
| State | Yes (OPEN/CLOSED) |
| Created date | Yes |
| Closed date | If closed |
| Labels | Yes |
| Key quotes | From body and comments |
| Related PRs | If any |

**Error Handling**: If GitHub API rate limits occur, note timestamp and include partial results.

---

## Phase 4: Report Generation

### Executive Summary Format

```markdown
## Executive Summary

**Key Finding**: [One sentence summary]

**Timeline**: [Earliest date] to [Most recent date]

**Evidence Count**:
- Brain notes: N
- Issues: N
- Files: N

**Pattern Categories**: [List major categories identified]
```

### Evidence Trail Format

For each major finding:

```markdown
### Finding: [Title]

**Brain Memory Evidence**:
- **Note**: [Title or permalink]
- **Retrieval**: `mcp__plugin_brain_brain__read_note({ "identifier": "[permalink]" })`
- **Folder**: decisions/ (or sessions/, analysis/, etc.)
- **Type**: decision (or session, analysis, etc.)
- **Quote**: "Direct quote from note content"
- **Relations**: Related to [[Note A]], [[Note B]]

**Document Evidence**:
- **Path**: `analysis/topic-documentary.md`
- **Lines**: 45-52
- **Quote**: "Direct quote from document"
- **Git Date**: 2025-12-15 14:32:00

**GitHub Evidence**:
- **Issue**: [#234](https://github.com/owner/repo/issues/234)
- **State**: CLOSED
- **Created**: 2025-12-10
- **Closed**: 2025-12-18
- **Labels**: bug, priority:high
- **Quote**: "Direct quote from issue body or comment"
```

### Pattern Evolution Format

**Section Header**: `### Pattern Evolution: [Pattern Name]`

**Timeline Format**:

```text
2025-11-01: [Note: ADR-010] - Initial belief: "[quote]"
2025-11-15: [Note: SESSION-2025-11-15] - First iteration: "[quote]"
2025-12-01: [Issue #303] - Technical response
2025-12-15: [Note: SESSION-2025-12-15] - Current state: "[quote]"
```

**Before/After Table**:

| Aspect | Before | After |
|--------|--------|-------|
| Belief | [Previous] | [Current] |
| Behavior | [Previous] | [Current] |
| Trigger | N/A | [Specific incident with receipt] |

### Unexpected Patterns Format

Analyze across categories with boundaries:

**Frequency Patterns** (temporal clustering):

- Time of day patterns (e.g., "80% of errors after 10pm")
- Day of week patterns (e.g., "Friday commits have 2x bug rate")
- Clustering (e.g., "issues come in bursts of 3-5")

**Correlation Patterns** (co-occurrence):

- Sequential (e.g., "X always happens before Y")
- Prerequisite (e.g., "A implies B follows")
- Simultaneous (e.g., "When X, also Y")

**Avoidance Patterns** (conspicuous absence):

- Topics never mentioned
- Tools never used
- Questions never asked

**Contradiction Patterns** (saying vs doing):

- Stated preference vs actual behavior
- Documentation vs implementation
- Protocol vs practice

**Evolution Patterns** (change over time):

- Recursive loops
- Pendulum swings
- Progressive refinement

**Emotional Patterns** (sentiment markers):

- Frustration markers (e.g., "again", "still broken")
- Excitement markers (e.g., exclamation, "finally")
- Fatigue markers (e.g., shorter messages)

---

## Phase 5: Memory Updates

After report completion, store the meta-pattern as a Brain memory note:

### Brain Memory Update

```python
mcp__plugin_brain_brain__write_note({
  "title": "ANALYSIS-NNN [Topic] Meta-Pattern Analysis",
  "folder": "analysis",
  "content": """---
title: ANALYSIS-NNN [Topic] Meta-Pattern Analysis
type: analysis
tags: [documentary, meta-pattern, [topic-keywords]]
---

# ANALYSIS-NNN [Topic] Meta-Pattern Analysis

## Observations

- [insight] Key meta-pattern discovered from documentary analysis #meta-analysis
- [fact] Evidence spans [date range] across [N] sources #evidence
- [decision] Recommended action based on pattern analysis #recommendation

## Relations

- relates_to [[Related Note A]]
- relates_to [[Related Note B]]

## Summary

[Summary of discovered meta-pattern and key findings]

## Recommendations

[Actionable recommendations with evidence backing]
"""
})
```

### Output File

Save complete report as a Brain memory note in the `analysis/` folder.

---

## Quality Targets

**User Reactions**:

- "Wait, it noticed THAT?" (genuine surprise)
- "I didn't realize I did that pattern" (self-awareness)
- "This will change how I work" (actionable insight)

**Report Characteristics**:

- Documentary feel with full evidence chain
- Patterns synthesized across multiple data sources
- Timeline showing evolution over weeks/months
- Specific recommendations with evidence backing
