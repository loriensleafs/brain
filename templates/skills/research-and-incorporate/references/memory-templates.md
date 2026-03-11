# Memory Templates

Templates for creating atomic Brain memory notes from research.

---

## Atomic Note Principles

Each note must pass the atomicity test:

1. Can you understand it at first glance?
2. Can you title it in 5-50 words?
3. Does it represent ONE concept/fact/decision?

### Constraints

| Element | Min | Max | Guidance |
|---------|-----|-----|----------|
| Observations | 3 | 10 | Categorized facts with tags |
| Relations | 2 | 8 | Wikilinks to related notes |
| Tags | 2 | 5 | For categorization |

---

## Note Categories and Templates

### 1. Core Principle Note

For foundational concepts that define the topic.

```python
mcp__plugin_brain_brain__write_note({
  "title": "{Topic}: Core Principle",
  "folder": "analysis",
  "content": """---
title: {Topic}: Core Principle
type: analysis
tags: [research, principles, {topic}]
---

# {Topic}: Core Principle

## Observations

- [fact] {Topic} is {definition in 1-2 sentences} #{topic}
- [insight] Core insight: {the fundamental idea in plain language} #principle
- [technique] Decision rule: {how to apply this principle} #application

## Relations

- relates_to [[ANALYSIS-NNN {Topic Name}]]
- relates_to [[Related Concept]]

## Details

**Origin**: [Where it comes from, who coined it]

**Decision Rule**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Key Heuristic**: [One-line test for correct application]
"""
})
```

### 2. Framework Note

For decision frameworks, models, or structured approaches.

```python
mcp__plugin_brain_brain__write_note({
  "title": "{Topic}: {Framework Name} Framework",
  "folder": "analysis",
  "content": """---
title: {Topic}: {Framework Name} Framework
type: analysis
tags: [research, frameworks, {topic}]
---

# {Topic}: {Framework Name} Framework

## Observations

- [fact] The {Framework Name} provides a structured approach to {purpose} #{topic}
- [technique] Apply when {conditions that trigger this framework} #application
- [insight] Output: {what applying this framework produces} #outcome

## Relations

- relates_to [[ANALYSIS-NNN {Topic Name}]]
- relates_to [[{Topic}: Core Principle]]

## Phases

1. **[Phase 1]**: [Description] - [Key question to answer]
2. **[Phase 2]**: [Description] - [Key question to answer]
3. **[Phase 3]**: [Description] - [Key question to answer]
4. **[Phase 4]**: [Description] - [Key question to answer]

## Integration

[How this connects to project workflows]
"""
})
```

### 3. Application Pattern Note

For concrete ways to apply the concept.

```python
mcp__plugin_brain_brain__write_note({
  "title": "{Topic}: {Application Area} Application",
  "folder": "analysis",
  "content": """---
title: {Topic}: {Application Area} Application
type: analysis
tags: [research, patterns, {topic}]
---

# {Topic}: {Application Area} Application

## Observations

- [technique] Apply {Topic} to {Application Area} by {brief method} #{topic}
- [fact] Pattern recognition: {how to identify the situation} #recognition
- [risk] Pitfall to avoid: {common mistake in this application} #anti-pattern

## Relations

- relates_to [[ANALYSIS-NNN {Topic Name}]]
- relates_to [[{Topic}: Core Principle]]

## Pattern

1. [Recognition step - how to identify the situation]
2. [Investigation step - what to examine]
3. [Evaluation step - how to assess findings]
4. [Action step - what to do based on evaluation]

**Example**: [Concrete instance]

**Connection**: [How this relates to existing project patterns]
"""
})
```

### 4. Failure Mode Note

For anti-patterns and what to avoid.

```python
mcp__plugin_brain_brain__write_note({
  "title": "{Topic}: {Failure Name} Anti-Pattern",
  "folder": "analysis",
  "content": """---
title: {Topic}: {Failure Name} Anti-Pattern
type: analysis
tags: [research, anti-patterns, {topic}]
---

# {Topic}: {Failure Name} Anti-Pattern

## Observations

- [problem] {What this failure looks like in practice} #{topic}
- [insight] Root cause: {why it happens} #root-cause
- [solution] Correction: {how to fix or prevent it} #correction

## Relations

- relates_to [[ANALYSIS-NNN {Topic Name}]]
- relates_to [[{Topic}: Core Principle]]

## Details

**Detection**: [How to recognize this failure mode]

**Consequences**: [What goes wrong when this occurs]

**Example**: [Concrete instance where this occurred]
"""
})
```

### 5. Project Integration Note

For specific connections to the project.

```python
mcp__plugin_brain_brain__write_note({
  "title": "{Topic}: Project Integration Pattern",
  "folder": "analysis",
  "content": """---
title: {Topic}: Project Integration Pattern
type: analysis
tags: [research, integration, {topic}]
---

# {Topic}: Project Integration Pattern

## Observations

- [fact] {Topic} integrates with project through {mechanism} #{topic}
- [technique] Implementation approach: {brief steps} #integration
- [constraint] Verification: {how to confirm correct integration} #verification

## Relations

- relates_to [[ANALYSIS-NNN {Topic Name}]]
- implements [[Related ADR or Decision]]

## Integration Points

- **Agent**: [Which agent, specific application]
- **Protocol**: [Which protocol, enhancement opportunity]
- **Skill**: [Which skill, improvement area]
- **Memory**: [How this informs memory operations]

## Implementation Approach

1. [Step 1 with file/component reference]
2. [Step 2 with file/component reference]
3. [Step 3 with file/component reference]
"""
})
```

### 6. Relationship Note

For connections between concepts.

```python
mcp__plugin_brain_brain__write_note({
  "title": "{Topic}: Relationship to {Other Concept}",
  "folder": "analysis",
  "content": """---
title: {Topic}: Relationship to {Other Concept}
type: analysis
tags: [research, relationships, {topic}]
---

# {Topic}: Relationship to {Other Concept}

## Observations

- [fact] {Topic} relates to {Other Concept} through {relationship type} #{topic}
- [insight] Synergy: {how they work together} #synergy
- [technique] When to use each: {selection criteria} #decision

## Relations

- relates_to [[ANALYSIS-NNN {Topic Name}]]
- relates_to [[{Other Concept}]]

## Comparison

**Similarity**: [What they have in common]

**Difference**: [Where they diverge]

**When to use each**:
- Use {Topic} when: [conditions]
- Use {Other Concept} when: [conditions]
- Use both when: [conditions]
"""
})
```

### 7. Decision Heuristic Note

For quick decision rules derived from the topic.

```python
mcp__plugin_brain_brain__write_note({
  "title": "{Topic}: Decision Heuristic for {Situation}",
  "folder": "analysis",
  "content": """---
title: {Topic}: Decision Heuristic for {Situation}
type: analysis
tags: [research, heuristics, {topic}]
---

# {Topic}: Decision Heuristic for {Situation}

## Observations

- [technique] When facing {Situation}, ask: {key question} #{topic}
- [fact] Default action when uncertain: {what to do} #heuristic
- [insight] Rationale traced to {Topic} principle #rationale

## Relations

- relates_to [[ANALYSIS-NNN {Topic Name}]]
- relates_to [[{Topic}: Core Principle]]

## Decision Matrix

| Condition | Action |
|-----------|--------|
| [Condition 1] | [Action 1] |
| [Condition 2] | [Action 2] |
| [Condition 3] | [Action 3] |

**Example**: [Concrete application of this heuristic]
"""
})
```

---

## Quality Thresholds

| Element | Min | Max | Example |
|---------|-----|-----|---------|
| Observations | 3 | 10 | `- [decision] Using JWT #auth` |
| Relations | 2 | 8 | `- implements [[ADR-015]]` |
| Tags | 2 | 5 | `tags: [auth, security]` |

---

## Linking Strategy

After creating notes:

1. **Search for related notes**: Find existing notes that connect to new knowledge
2. **Add forward relations**: New notes reference existing knowledge via wikilinks
3. **Add backward relations**: Edit existing notes to reference new knowledge

```python
# Search for related existing notes
mcp__plugin_brain_brain__search({
  "query": "{related-concept}",
  "mode": "semantic",
  "limit": 5
})

# Add relation to existing note
mcp__plugin_brain_brain__edit_note({
  "identifier": "<existing note title>",
  "operation": "append",
  "content": "\n- relates_to [[New Note Title]]"
})
```

**Link when:**

- Concepts are complementary (use together)
- Concepts are alternatives (choose between)
- Concepts share a domain
- One concept implements another
