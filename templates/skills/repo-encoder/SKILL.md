---
name: repo-encoder
description: Systematically populate the Brain knowledge base using Serena's LSP-powered
  symbol analysis for accurate, comprehensive codebase understanding.
license: MIT
model: claude-sonnet-4-5
metadata:
  version: 1.1.0
  argument-hint: 'Project path or name to encode (default: current directory)'
agents: [analyst, architect]
---

# Encode Repository

Transform an undocumented codebase into a rich, searchable knowledge repository using Serena's LSP-powered symbol analysis.

## Triggers

| Trigger Phrase | Operation |
|----------------|-----------|
| `encode this repository` | Full 12-phase encoding pipeline |
| `populate brain with this codebase` | Full encoding pipeline |
| `onboard to this repo` | Discovery + foundation phases |
| `refresh project understanding` | Re-run encoding on updated codebase |
| `build knowledge base for this project` | Full encoding pipeline |

## When to Use

Use this skill when:

- Onboarding to a new repository that lacks Brain memory notes
- Repository structure has changed significantly since last encoding
- Brain searches return sparse or outdated results for the project

Use `research-and-incorporate` instead when:

- Researching an external topic, not encoding a codebase
- You need analysis of a single concept, not full repository encoding

## Quick Start

```text
/repo-encoder
/repo-encoder ./my-project
"encode this repository"
"populate brain with this codebase"
```

| Input | Output | Duration |
|-------|--------|----------|
| Codebase path | Brain memory notes + docs | 30-60 min |

## Prerequisites

1. **Serena plugin**: `claude plugins list | grep serena`
2. **Brain MCP**: Test with `mcp__plugin____brain__search({ "query": "test" })`
3. If missing, set up Brain MCP first

## Process

### Phase 0: Discovery

Assess project size, complexity, and structure. Produce a structure map.

### Phase 1: Foundation

Create 5-10 project overview Brain memory notes covering purpose, tech stack, and entry points.

### Phase 1B: Dependencies

Create 1-3 dependency notes documenting external libraries and internal references.

### Phase 2: Symbols

Use Serena `find_symbol` and `find_referencing_symbols` to produce 10-15 architecture notes.

### Phase 2B: Entities

Create component Brain memory notes with relations. Deduplicate before creating.

### Phase 3: Patterns

Document 8-12 recurring code patterns, conventions, and idioms.

### Phase 4: Features

Create 1-2 notes per critical feature describing behavior and implementation.

### Phase 5: Decisions

Record design decisions with rationale and alternatives considered.

### Phase 6: Artifacts

Store code artifacts (configs, schemas, key files) as Brain memory notes.

### Phase 6B: Symbol Index

Create a symbol index note for navigation.

### Phase 7: Documents

Produce long-form documentation summarizing the codebase.

### Phase 7B: Architecture

Create an architecture reference note linking all prior phases.

See [references/phases.md](references/phases.md) for full phase details.

## Execution Order

```text
0 -> 1 -> 1B -> 2 -> 2B -> 3 -> 4 -> 5 -> 6 -> 6B -> 7 -> 7B
```

**Guidelines**:

- Execute phases in order
- Use Serena's `find_symbol` and `find_referencing_symbols`
- Deduplicate notes before creating
- Link notes via relations bidirectionally
- Create summary notes for large documents

## Memory Targets

| Profile | Total Notes | Documents | Entities |
|---------|-------------|-----------|----------|
| Small Simple | 17-31 | 2 | 3-5 |
| Small Complex | 28-46 | 2 | 5-10 |
| Medium | 38-66 | 2-3 | 10-20 |
| Large | 66-112 | 3-6 | 20-40 |

## Quality Principles

| Principle | Description |
|-----------|-------------|
| Symbol-accurate | Use LSP data, not guesses |
| Atomic | One concept per note |
| Size | 200-400 words ideal |
| Linking | Connect related notes via relations |

## Validation

After encoding, verify all outputs meet quality standards:

- [ ] Test search: "How do I add a new API endpoint?"
- [ ] Test dependency query: "What dependencies does this project use?"
- [ ] List notes by folder
- [ ] Verify note relations
- [ ] Check Symbol Index note exists
- [ ] Check Architecture Reference note exists
- [ ] All target components have Brain memory notes
- [ ] Notes linked via relations
- [ ] No duplicate notes in knowledge graph

See [references/validation.md](references/validation.md) for test commands.

## Anti-Patterns

| Avoid | Why | Instead |
|-------|-----|---------|
| Skipping Phase 0 discovery | Wastes effort on wrong project scope | Always assess project size and complexity first |
| Creating non-atomic notes | Pollutes search results, hard to maintain | One concept per note, 200-400 words |
| Duplicate notes | Bloats knowledge graph, inconsistent links | Deduplicate notes before creating |
| Skipping validation | No confidence in encoding quality | Run validation checklist after completion |

## References

| Document | Content |
|----------|---------|
| [phases.md](references/phases.md) | Detailed phase workflows |
| [templates.md](references/templates.md) | Note templates |
| [validation.md](references/validation.md) | Validation test commands |

## Related Skills

- `/code-symbols` - Serena symbol analysis
- `/code-architecture` - Architectural analysis with Brain memory
