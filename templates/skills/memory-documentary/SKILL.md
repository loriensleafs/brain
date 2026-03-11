---
name: memory-documentary
description: Generate evidence-based documentary reports by searching across Brain memory notes, project artifacts, and GitHub issues. Produces investigative journalism-style analysis with full citation chains.
license: MIT
agents:
  - analyst
  - memory
model: claude-sonnet-4-5
metadata:
  version: 2.0.0
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

- `Search my memories for patterns about...`
- `What does my history say about...`
- `Generate a documentary on my [topic]`
- `Cross-reference all systems for...`
- `Evidence-based analysis of my [topic]`

---

## When to Use

Use this skill when:

- You need cross-system evidence for a pattern or recurring theme
- Investigating historical decisions and their evolution over time
- Building a cited, verifiable narrative from memory data

Use `memory` skill instead when:

- You need a simple search for a known fact or pattern
- The query targets a single topic, not cross-system synthesis

## Quick Reference

| Phase | Action | Output |
|-------|--------|--------|
| 1 | Topic Comprehension | Search variants, scope boundaries |
| 2 | Investigation Planning | Explicit queries per source |
| 3 | Data Collection | Evidence with identifiers, timestamps |
| 4 | Report Generation | Documentary with citations |
| 5 | Memory Updates | Store meta-pattern discovered |

---

## Process

The skill searches ALL available data sources systematically:

**Brain Memory Notes**:

- Semantic search across all note types (decisions, sessions, analysis, etc.)
- Depth-based graph traversal for related notes
- Folder-scoped searches for domain-specific findings

**Project Artifacts**:

- `sessions/` - Session logs (via Brain notes or file system)
- `analysis/` - Research reports
- `decisions/` - ADRs
- `planning/` - Plans and PRDs
- `retrospective/` - Learning extractions

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
- Evidence count (notes + issues + files)
- Major pattern categories

### Evidence Trail

Full citation for each finding:

- Note title/permalink with retrieval command
- Source folder (decisions/, sessions/, analysis/, etc.)
- Creation date
- Direct quote from source
- Links to related evidence

### Pattern Evolution

Timeline showing how thinking changed:

```text
YYYY-MM-DD: [Note: ADR-015] - Initial state
YYYY-MM-DD: [Note: SESSION-2025-01-15] - First iteration
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

- What all sources agree on
- What is recent vs crystallized knowledge
- Actionable recommendations

---

## Evidence Standards

| Standard | Requirement |
|----------|-------------|
| Citation | Every claim has note identifier, timestamp, quote |
| Quotes | Direct quotes, not paraphrases |
| Verification | Retrieval commands for all evidence |
| Cross-links | Related evidence connected |

---

## Anti-Patterns

| Avoid | Why | Instead |
|-------|-----|---------|
| Partial searches | Miss critical evidence | Search across all folders and sources |
| Paraphrasing | Loses verifiability | Direct quotes only |
| Single query | Miss variations | 3+ query variants |
| Skipping folder scopes | Incomplete picture | Search decisions/, sessions/, analysis/, planning/ |

---

## Verification

After execution:

- [ ] Report saved to analysis/ folder in Brain memory
- [ ] Every claim has a citation with source, identifier, and direct quote
- [ ] Brain memory was searched across relevant folders
- [ ] Meta-pattern stored as new Brain memory note (Phase 5)

## Output Location

Reports saved as Brain memory notes in the `analysis/` folder.

---

## Related Skills

| Skill | Relationship |
|-------|--------------|
| memory | Operations (search, read, write) |
| exploring-knowledge-graph | Brain graph traversal |
| retrospective | Learning extraction |
| skillbook | Pattern to skill conversion |

---

## On Invocation

**Read**: `references/execution-protocol.md`

This contains the full 5-phase execution protocol with detailed instructions for each data source.
