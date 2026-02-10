# Memory Templates

Templates for creating atomic Brain notes from research.

---

## Atomic Note Principles

Each note must pass the atomicity test:

1. Can you understand it at first glance?
2. Can you title it in 5-50 words?
3. Does it represent ONE concept/fact/decision?

### Constraints

| Field | Guidance |
|-------|----------|
| Title | Short, searchable phrase |
| Content | Single concept with observations and relations |
| Category | research, analysis, decisions, features, etc. |
| Observations | Key facts and insights |
| Relations | Links to related notes via `[[note-title]]` |

---

## Note Categories and Templates

### 1. Core Principle Note

For foundational concepts that define the topic.

```python
mcp__plugin_brain_brain__write_note(
    title="{Topic}: Core Principle",
    category="research",
    content="""{Topic} is [definition in 1-2 sentences].

## Origin
[Where it comes from, who coined it]

## Core Insight
[The fundamental idea in plain language]

## Decision Rule
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Observations
- Core principle: [key insight]
- Heuristic: [One-line test for correct application]

## Relations
- [[{domain}-concepts]]
- [[decision-frameworks]]
"""
)
```

### 2. Framework Note

For decision frameworks, models, or structured approaches.

```python
mcp__plugin_brain_brain__write_note(
    title="{Topic}: {Framework Name} Framework",
    category="research",
    content="""The {Framework Name} provides a structured approach to [purpose].

## Phases/Steps
1. **[Phase 1]**: [Description] - [Key question to answer]
2. **[Phase 2]**: [Description] - [Key question to answer]
3. **[Phase 3]**: [Description] - [Key question to answer]
4. **[Phase 4]**: [Description] - [Key question to answer]

## When to Use
[Conditions that trigger this framework]

## Output
[What applying this framework produces]

## Observations
- Framework type: decision-making
- Applicable when: [conditions]

## Relations
- [[decision-frameworks]]
- [[{topic}-core-principle]]
"""
)
```

### 3. Application Pattern Note

For concrete ways to apply the concept.

```python
mcp__plugin_brain_brain__write_note(
    title="{Topic}: {Application Area} Application",
    category="research",
    content="""Applying {Topic} to {Application Area}.

## Context
[When this pattern applies]

## Pattern
1. [Recognition step - how to identify the situation]
2. [Investigation step - what to examine]
3. [Evaluation step - how to assess findings]
4. [Action step - what to do based on evaluation]

## Example
[Concrete instance from software engineering]

## Observations
- Application area: {area}
- Pitfall to avoid: [Common mistake in this application]

## Relations
- [[{topic}-core-principle]]
- [[{area}-patterns]]
"""
)
```

### 4. Failure Mode Note

For anti-patterns and what to avoid.

```python
mcp__plugin_brain_brain__write_note(
    title="{Topic}: {Failure Name} Anti-Pattern",
    category="research",
    content="""Anti-pattern: {Failure Name}

## Description
[What this failure looks like in practice]

## Why It Happens
[Root cause of this failure]

## Consequences
[What goes wrong when this occurs]

## Detection
[How to recognize this failure mode]

## Correction
[How to fix or prevent it]

## Observations
- Type: anti-pattern
- Severity: [high/medium/low]
- Example: [Concrete instance where this occurred]

## Relations
- [[{topic}-core-principle]]
- [[anti-patterns]]
"""
)
```

### 5. Project Integration Note

For specific connections to the project.

```python
mcp__plugin_brain_brain__write_note(
    title="{Topic}: Project Integration Pattern",
    category="research",
    content="""{Topic} integrates with the project through [mechanism].

## Integration Points
- **Agent**: [Which agent, specific application]
- **Protocol**: [Which protocol, enhancement opportunity]
- **Skill**: [Which skill, improvement area]
- **Memory**: [How this informs memory operations]

## Implementation Approach
1. [Step 1 with file/component reference]
2. [Step 2 with file/component reference]
3. [Step 3 with file/component reference]

## Verification
[How to confirm correct integration]

## Observations
- Integration type: [type]
- Priority: [high/medium/low]

## Relations
- [[{topic}-core-principle]]
- [[project-patterns]]
"""
)
```

### 6. Relationship Note

For connections between concepts.

```python
mcp__plugin_brain_brain__write_note(
    title="{Topic}: Relationship to {Other Concept}",
    category="research",
    content="""{Topic} relates to {Other Concept} through [relationship type].

## Similarity
[What they have in common]

## Difference
[Where they diverge]

## Synergy
[How they work together]

## When to Use Each
- Use {Topic} when: [conditions]
- Use {Other Concept} when: [conditions]
- Use both when: [conditions]

## Observations
- Relationship type: [complementary/alternative/prerequisite]
- Practical guidance: [How to decide between them]

## Relations
- [[{topic}-core-principle]]
- [[{other-concept}]]
"""
)
```

### 7. Decision Heuristic Note

For quick decision rules derived from the topic.

```python
mcp__plugin_brain_brain__write_note(
    title="{Topic}: Decision Heuristic for {Situation}",
    category="decisions",
    content="""When facing {Situation}, apply this heuristic.

## Key Question
[The key question to ask]

## Decision Matrix
| Condition | Action |
|-----------|--------|
| [Condition 1] | [Action 1] |
| [Condition 2] | [Action 2] |
| [Condition 3] | [Action 3] |

## Default Action
[What to do if uncertain]

## Rationale
[Why this heuristic works, traced to {Topic}]

## Observations
- Heuristic type: decision-making
- Example: [Concrete application of this heuristic]

## Relations
- [[{topic}-core-principle]]
- [[decision-heuristics]]
"""
)
```

---

## Category Guide

| Category | Use For | Example |
|----------|---------|---------|
| research | Foundational principles, frameworks, patterns | Core concepts from external research |
| analysis | Investigation results, deep dives | Analysis of codebase patterns |
| decisions | Decision records, heuristics | Architecture decisions, trade-offs |
| features | Feature planning and implementation | Feature specifications |

---

## Linking Strategy

After creating notes, link them via the Relations section:

1. **Wiki-style links**: Use `[[note-title]]` syntax in Relations section
2. **Search for related**: Find existing notes to link

```python
# Search for related notes
mcp__plugin_brain_brain__search_notes(query="{related-concept}")

# Edit existing note to add relation
mcp__plugin_brain_brain__edit_note(
    identifier="{note-title}",
    operation="append",
    content="""
## Relations
- [[{new-related-note}]]
"""
)
```

**Link when:**

- Concepts are complementary (use together)
- Concepts are alternatives (choose between)
- Concepts share a domain
- One concept implements another
