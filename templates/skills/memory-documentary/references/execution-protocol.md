# Memory Documentary Execution Protocol

Detailed instructions for generating evidence-based documentary reports.

---

## Phase 1: Topic Comprehension (RE2)

Before searching, re-read the topic and answer:

1. **Core Concept**: What is the central subject to investigate?
2. **Search Variants**: What alternative phrasings or related terms should be included?
3. **Scope Boundaries**: What is explicitly IN scope? What is OUT of scope?
4. **Success Criteria**: What would make this analysis valuable?

**Confidence Note**: Assume Brain MCP server is available. Tool errors are rare and system will notify if unavailable.

---

## Phase 2: Investigation Planning (Plan-and-Solve)

Create an explicit search plan BEFORE executing queries:

### Memory Systems Queries

**Brain MCP** (semantic knowledge graph):

```python
# Step 1: Search for relevant notes
mcp__plugin_brain_brain__search_notes(query="[topic]")

# Step 2: Read specific notes for full content
mcp__plugin_brain_brain__read_note(identifier="[note-title-or-permalink]")

# Step 3: Search with category filter if needed
mcp__plugin_brain_brain__search_notes(query="[topic]", category="research")
```

### Project Artifacts

List specific grep patterns and file paths:

| Directory | Pattern | Purpose |
|-----------|---------|---------|
| `.agents/retrospective/` | `grep -r "[topic]"` | Learning extractions |
| `.agents/sessions/` | `grep -l "[topic]"` | Session logs |
| `.agents/analysis/` | List files | Research reports |
| `.agents/architecture/` | ADR keywords | Decisions |

### GitHub Issues

```bash
# Open issues
gh issue list --state open --search "[topic]" --json number,title,body,comments,labels,createdAt

# Closed issues
gh issue list --state closed --search "[topic]" --json number,title,body,comments,labels,createdAt,closedAt
```

---

## Phase 3: Data Collection

### Thread 1: Memory Systems

Execute queries from Phase 2 plan. For each result, capture:

| Field | Required |
|-------|----------|
| Memory/Observation ID | Yes |
| Source system | Yes |
| Timestamp | Yes |
| Importance score | If available |
| Direct quote | Yes |
| Related IDs | If available |

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
- Memories: N
- Observations: N
- Issues: N
- Files: N

**Pattern Categories**: [List major categories identified]
```

### Evidence Trail Format

For each major finding:

```markdown
### Finding: [Title]

**Memory Evidence**:
- **ID**: Brain Note: [note-title]
- **Retrieval**: `mcp__plugin_brain_brain__read_note(identifier="[note-title]")`
- **Created**: 2025-12-15
- **Quote**: "Direct quote from note content"
- **Relations**: Links to [[related-note-1]], [[related-note-2]]

**Document Evidence**:
- **Path**: `.agents/retrospective/2025-12-15-session-review.md`
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
2025-11-01: [Observation #101] - Initial belief: "[quote]"
2025-11-15: [Memory #202] - First iteration: "[quote]"
2025-12-01: [Issue #303] - Technical response
2025-12-15: [Session log] - Current state: "[quote]"
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

After report completion, update systems:

### Brain Update

```python
mcp__plugin_brain_brain__write_note(
    title="[Topic] Meta-Pattern Analysis",
    category="analysis",
    content="""[Summary of discovered meta-pattern]

## Observations
- [Key observation 1]
- [Key observation 2]

## Relations
- [[related-note-1]]
- [[related-note-2]]
"""
)
```

### Output File

Save complete report to: `analysis/[topic]-documentary/overview.md`

---

## Quality Targets

**User Reactions**:

- "Wait, it noticed THAT?" (genuine surprise)
- "I didn't realize I did that pattern" (self-awareness)
- "This will change how I work" (actionable insight)

**Report Characteristics**:

- Documentary feel with full evidence chain
- Patterns synthesized across 4+ data sources
- Timeline showing evolution over weeks/months
- Specific recommendations with evidence backing
