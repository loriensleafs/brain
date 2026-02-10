---
name: research-and-incorporate
version: 1.0.0
description: Research external topics, create comprehensive analysis, determine project
  applicability, and incorporate learnings into Brain memory system. Transforms
  knowledge into searchable, actionable project context.
license: MIT
model: claude-opus-4-5
agents:
  - analyst
metadata:
  timelessness: 8/10
  source: Chesterton's Fence research workflow (Session 203)
---
# Research and Incorporate

Transform external knowledge into actionable, searchable project context through structured research, analysis, and memory integration.

## Quick Start

```text
/research-and-incorporate

Topic: Chesterton's Fence
Context: Decision-making principle for understanding existing systems before changing them
URLs: https://fs.blog/chestertons-fence/, https://en.wikipedia.org/wiki/G._K._Chesterton
```

| Input | Output | Duration |
|-------|--------|----------|
| Topic + Context + URLs | Analysis doc + Brain notes (5-10 atomic notes) | 20-40 min |

## Triggers

- `/research-and-incorporate` - Main invocation
- "research and incorporate {topic}" - Natural language
- "study {topic} and add to memory" - Alternative phrasing
- "deep dive on {topic}" - Research focus
- "learn about {topic} for the project" - Project integration focus

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `TOPIC` | Yes | Subject to research (e.g., "Chesterton's Fence") |
| `CONTEXT` | Yes | Why this matters to the project |
| `URLS` | No | Comma-separated source URLs |

## Workflow Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: RESEARCH (BLOCKING)                                    │
│ • Check existing knowledge (Brain)                              │
│ • Fetch URLs with quote extraction                              │
│ • Web search for additional context                             │
│ • Synthesize: principles, frameworks, examples, failure modes   │
├─────────────────────────────────────────────────────────────────┤
│ Phase 2: ANALYSIS DOCUMENT (BLOCKING)                           │
│ • Write 3000-5000 word analysis to .agents/analysis/            │
│ • Include: concepts, frameworks, applications, failure modes    │
│ • Verify: 3+ examples, 3+ failure modes, 2+ relationships       │
├─────────────────────────────────────────────────────────────────┤
│ Phase 3: APPLICABILITY (BLOCKING)                               │
│ • Map integration points: agents, protocols, memory, skills     │
│ • Propose applications with effort estimates                    │
│ • Prioritize: High/Medium/Low based on project goals            │
├─────────────────────────────────────────────────────────────────┤
│ Phase 4: MEMORY INTEGRATION (BLOCKING)                          │
│ • Create Brain project note with cross-references               │
│ • Create 5-10 atomic Brain notes with observations/relations    │
│ • Link notes to related concepts via relations                  │
├─────────────────────────────────────────────────────────────────┤
│ Phase 5: ACTION ITEMS                                           │
│ • Create GitHub issue if implementation work identified         │
│ • Document in session log                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Quality Gates (BLOCKING)

| Gate | Requirement | Phase |
|------|-------------|-------|
| Research depth | Core principles + frameworks + 3 examples | 1 |
| Analysis length | 3000-5000 words minimum | 2 |
| Concrete examples | 3+ with context and outcomes | 2 |
| Failure modes | 3+ anti-patterns with corrections | 2 |
| Relationships | 2+ connections to existing concepts | 2 |
| Note atomicity | Each note covers ONE concept | 4 |
| Note count | 5-10 Brain notes created | 4 |

## Verification Checklist

After completion, verify:

- [ ] Analysis document exists at `.agents/analysis/{topic-slug}.md`
- [ ] Analysis is 3000-5000 words with concrete examples
- [ ] Applicability section documents integration opportunities
- [ ] Brain project note created with cross-references
- [ ] 5-10 Brain notes created with observations/relations
- [ ] Notes linked to related concepts via relations
- [ ] Each note is atomic (one concept)
- [ ] Action items documented (issue or next steps)

## Anti-Patterns

| Avoid | Why | Instead |
|-------|-----|---------|
| Superficial research | Surface definitions miss actionable insights | Dig into frameworks, examples, failure modes |
| Missing applicability | Research without integration is wasted | Every insight must show HOW it applies |
| Non-atomic notes | Multiple concepts pollutes graph | ONE concept per note |
| Disconnected knowledge | Orphaned artifacts aren't discoverable | Link notes via relations |
| Template over-compliance | Forcing irrelevant sections wastes tokens | Organize for the topic, not the template |
| Skipping verification | Quality gates exist for a reason | Verify each phase before proceeding |

## Related Skills

| Skill | Relationship |
|-------|--------------|
| `brain:writing-notes` | Note creation best practices |
| `brain:research-agent` | Deep research with progressive note building |
| `exploring-knowledge-graph` | Navigate created knowledge |

## References

| Document | Content |
|----------|---------|
| [workflow.md](references/workflow.md) | Detailed phase workflows with templates |
| [memory-templates.md](references/memory-templates.md) | Brain note structure templates |

## Extension Points

1. **Additional research sources**: Add MCP tools for specialized domains
2. **Custom analysis templates**: Topic-specific document structures
3. **Automated validation**: Scripts to verify memory atomicity
4. **Integration hooks**: Connect to ADR review for architecture topics
