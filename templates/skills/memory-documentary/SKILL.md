---
name: memory-documentary
version: 1.0.0
description: Generate evidence-based documentary reports by searching across Brain
  memory system, .agents/ artifacts, and GitHub issues. Produces investigative
  journalism-style analysis with full citation chains.
license: MIT
model: claude-sonnet-4-5
agents:
  - analyst
  - retrospective
  - memory
metadata:
  timelessness: 8/10
  category: analysis
---
# Memory Documentary Skill

Generate comprehensive documentary-style reports from your memory systems with full evidence chains.

---

## Quick Start

```text
/memory-documentary [topic]
```

Example topics:

- "recurring frustrations"
- "coding patterns not codified"
- "evolution of thinking on testing"
- "decisions I second-guessed"
- "what I complain about most"

---

## Triggers

Use this skill when:

- "Search my memories for patterns about..."
- "What does my history say about..."
- "Generate a documentary on my [topic]"
- "Cross-reference all systems for..."
- "Evidence-based analysis of my [topic]"

---

## Quick Reference

| Phase | Action | Output |
|-------|--------|--------|
| 1 | Topic Comprehension | Search variants, scope boundaries |
| 2 | Investigation Planning | Explicit queries per system |
| 3 | Data Collection | Evidence with IDs, timestamps |
| 4 | Report Generation | Documentary with citations |
| 5 | Memory Updates | Store meta-pattern discovered |

---

## How It Works

The skill searches ALL available data sources systematically:

**Memory Systems (Brain MCP)**:

- Brain: Semantic knowledge graph with observations and relations
- Supports search, read, write, and edit operations on notes

**Project Artifacts**:

- `.agents/retrospective/` - Learning extractions
- `.agents/sessions/` - Session logs
- `.agents/analysis/` - Research reports
- `.agents/architecture/` - ADRs
- `.agents/planning/` - Plans and PRDs

**GitHub Issues**:

- Open and closed issues
- Comments and related PRs

---

## Commands

```bash
# Standard invocation
/memory-documentary "recurring frustrations"

# With explicit time range
/memory-documentary "testing patterns" --since 2025-12-01
```

---

## Report Structure

### Executive Summary

- Key finding in one sentence
- Timeline span (earliest to most recent)
- Evidence count (memories + observations + issues + files)
- Major pattern categories

### Evidence Trail

Full citation for each finding:

- Memory ID/Observation ID with retrieval command
- Source system (Brain)
- Timestamp/Creation date
- Direct quote from source
- Links to related evidence

### Pattern Evolution

Timeline showing how thinking changed:

```text
YYYY-MM-DD: [Observation #ID] - Initial state
YYYY-MM-DD: [Memory #ID] - First iteration
YYYY-MM-DD: [Issue #NNN] - Technical response
```

### Unexpected Patterns

Cross-system synthesis revealing:

- Frequency patterns (time clustering)
- Correlation patterns (X happens before Y)
- Avoidance patterns (conspicuous absence)
- Contradiction patterns (saying vs doing)
- Evolution patterns (recursive loops)
- Emotional patterns (frustration markers)

### Synthesis

- What all systems agree on
- What's recent vs crystallized knowledge
- Actionable recommendations

---

## Evidence Standards

| Standard | Requirement |
|----------|-------------|
| Citation | Every claim has ID, timestamp, quote |
| Quotes | Direct quotes, not paraphrases |
| Verification | Retrieval commands for all evidence |
| Cross-links | Related evidence connected |

---

## Anti-Patterns

| Avoid | Why | Instead |
|-------|-----|---------|
| Partial searches | Miss critical evidence | Search ALL systems |
| Paraphrasing | Loses verifiability | Direct quotes only |
| Single query | Miss variations | 3+ query variants per system |
| Skipping systems | Incomplete picture | Check all 4 MCP servers |

---

## Output Location

Reports saved to: `.agents/analysis/[topic]-documentary-[date].md`

---

## Related Skills

| Skill | Relationship |
|-------|--------------|
| memory | Operations (search, update) |
| exploring-knowledge-graph | Brain graph traversal |
| retrospective | Learning extraction |
| skillbook | Pattern → skill conversion |

---

## On Invocation

**Read**: `references/execution-protocol.md`

This contains the full 5-phase execution protocol with detailed instructions for each data source.
