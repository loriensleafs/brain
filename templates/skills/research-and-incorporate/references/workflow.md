# Research and Incorporate Workflow

Detailed phase workflows with templates, verification checkpoints, and tool usage patterns.

---

## Execution Principles

Complete the workflow systematically. Focus on:

- **Depth over breadth**: Thorough analysis of core concepts, not surface coverage
- **Concrete examples over abstract theory**: Every principle needs real-world demonstration
- **Integration with project**: Every insight must show applicability

Do what is required for each phase; nothing more, nothing less.

---

## Phase 1: Research and Context Gathering (BLOCKING)

### Pre-Work: Existing Knowledge Check

**Before external research, analyze existing project context:**

```python
# Search Brain memory for related concepts
mcp__plugin_brain_brain__search({
  "query": "{TOPIC} related concepts principles",
  "mode": "semantic",
  "limit": 10
})

# Search within specific folders
mcp__plugin_brain_brain__search({
  "query": "{TOPIC}",
  "folder": "decisions",
  "limit": 5
})

# Browse relevant folders
mcp__plugin_brain_brain__list_directory({
  "dir_name": "analysis"
})
```

**Questions to answer:**

- What does the project already know about this topic?
- What related patterns exist in the knowledge base? (ADRs, session logs, skills)
- How does this topic connect to current work?

This prevents duplication and ensures new knowledge integrates with existing understanding.

### External Research

**If URLs provided, fetch with TWO-STEP analysis:**

**Step 1 - Extract quotes (grounding):**

```python
WebFetch(url, prompt="Find quotes relevant to {TOPIC}. Extract verbatim text in <quotes> tags.")
```

**Step 2 - Analyze quotes (reasoning):**

Based ONLY on the quotes extracted above, identify:

- Core principles mentioned
- Frameworks or models described
- Examples provided
- Relationships to other concepts noted

**Web searches to perform:**

- "{TOPIC} definition principles"
- "{TOPIC} practical applications examples"
- "{TOPIC} software engineering"
- "{TOPIC} decision frameworks"

### Normal Research Failures (Handle Without Apologizing)

| Condition | Action |
|-----------|--------|
| URL returns 404 or paywall | Note unavailability, use alternative sources |
| WebSearch returns limited results | Refine query or proceed with available information |
| Source contradicts another source | Document both perspectives, note disagreement |

These are expected research conditions, not errors requiring user notification.

### Synthesis Requirements (MUST include all)

- Core principles and foundational concepts
- Practical frameworks or models
- Real-world applications with concrete examples
- Common failure modes and anti-patterns
- Relationships to other methodologies or principles

### Phase 1 Verification

```xml
<phase_1_verification>
- Do I understand core principles? (Can I explain to original author?)
- Do I have 3+ concrete examples with context?
- Have I identified minimum 3 failure modes?
- Do I understand relationships to 2+ existing concepts?
</phase_1_verification>
```

**If any verification fails, return to research. Do not proceed with incomplete understanding.**

---

## Phase 2: Deep Analysis Document (BLOCKING)

### File Location

Create as a Brain memory note in the `analysis/` folder.

### Document Structure

Create sections as needed for the topic, but MUST include:

```markdown
---
title: ANALYSIS-NNN {Topic Name}
type: analysis
tags: [research, {topic-keywords}]
---

# ANALYSIS-NNN {Topic Name}

## Observations

- [fact] Research completed on {date} from {N} sources #research
- [insight] Core principle: {one sentence summary} #principle
- [decision] Integration approach: {brief description} #integration

## Relations

- relates_to [[Related Concept A]]
- relates_to [[Related Concept B]]

## Executive Summary

[2-3 paragraphs: essence, why it matters, key takeaways]

## Core Concepts

[Definitions, principles, foundations - organized for this topic]

## Frameworks

[Decision frameworks, models, process patterns - if applicable]

## Applications

[How this applies in practice - minimum 3 concrete examples with outcomes]

### Example 1: [Scenario]
**Context**: [situation]
**Application**: [how concept was applied]
**Outcome**: [result]
**Lesson**: [key takeaway]

### Example 2: [Scenario]
[Same structure]

### Example 3: [Scenario]
[Same structure]

## Failure Modes

[What goes wrong and why - minimum 3 anti-patterns with corrections]

### Anti-Pattern 1: [Name]
**Description**: [what it looks like]
**Why It Fails**: [root cause]
**Correction**: [proper approach]

### Anti-Pattern 2: [Name]
[Same structure]

### Anti-Pattern 3: [Name]
[Same structure]

## Relationships

[How this connects to other concepts - minimum 2 explicit connections]

### Connection to [Concept A]
[How they relate, complement, or contrast]

### Connection to [Concept B]
[How they relate, complement, or contrast]

## Applicability to Project

[Integration points, proposed applications, priority assessment]

## References

[Sources with URLs]
```

**Note**: Organize for clarity, not template compliance. If the topic does not have "historical context," do not force it. Focus on what matters.

### Quality Gates (BLOCKING)

| Gate | Requirement |
|------|-------------|
| Word count | 3000-5000 words minimum |
| Examples | Minimum 3 concrete examples with context |
| Failure modes | Minimum 3 identified |
| Relationships | Minimum 2 related concepts mapped |
| Actionable guidance | Implementation recommendations included |

### Phase 2 Verification

```xml
<phase_2_verification>
- Is analysis comprehensive? (3000-5000 words)
- Are examples concrete? (Not generic scenarios)
- Are failure modes specific? (Not vague warnings)
- Are relationships explicit? (Clear connections, not hand-waving)
</phase_2_verification>
```

**If any verification fails, return to Phase 2. Do not proceed with surface-level analysis.**

---

## Phase 3: Applicability Assessment (BLOCKING)

### Analysis Areas

**1. Agent System Integration:**

- Which agents could benefit from this knowledge?
- Should this inform agent prompts or workflows?
- Does this suggest new agent responsibilities?

**2. Protocol and Process:**

- Does this improve session protocols?
- Should this inform handoff procedures?
- Does this enhance quality gates?

**3. Memory and Knowledge Management:**

- Does this inform how we store knowledge?
- Should this guide memory architecture decisions?
- Does this improve knowledge retrieval patterns?

**4. Constraint and Governance:**

- Should this become a project constraint?
- Does this inform ADR review processes?
- Should this guide decision-making protocols?

**5. Skills and Automation:**

- Could this be encoded in a skill?
- Does this suggest new automation patterns?
- Should this inform script design?

### Document in Analysis

Add section to analysis note:

```markdown
## Applicability to Project

### Integration Points

#### Agent System
[Specific agents and how they could use this]

#### Protocols
[Session protocol, handoff protocol enhancements]

#### Memory Architecture
[How this informs Brain memory usage]

#### Skills and Automation
[Concrete skill enhancement opportunities]

### Proposed Applications

1. **[Application 1]**
   - **What**: [specific change or addition]
   - **Where**: [files/agents/protocols affected]
   - **Why**: [benefit and connection to concept]
   - **Effort**: [estimate: trivial/small/medium/large]

2. **[Application 2]**
   [Same structure]

### Priority Assessment

**High Priority**: [applications that align with current objectives]
**Medium Priority**: [valuable but not urgent]
**Low Priority**: [nice-to-have enhancements]
```

### Phase 3 Verification

```xml
<phase_3_verification>
- Have I identified specific integration points? (Not generic possibilities)
- Are applications concrete? (File paths, agent names, protocol sections)
- Is priority justified? (Based on project goals, not opinion)
</phase_3_verification>
```

**If any verification fails, return to Phase 3. Do not proceed without clear applicability.**

---

## Phase 4: Memory Integration (BLOCKING)

### 4A: Brain Memory Notes

Create atomic notes for key concepts, each with proper Brain memory structure:

```python
mcp__plugin_brain_brain__write_note({
  "title": "{Specific Concept from Topic}",
  "folder": "analysis",
  "content": """---
title: {Specific Concept from Topic}
type: analysis
tags: [research, {topic}, {domain}]
---

# {Specific Concept from Topic}

## Observations

- [fact] {Atomic explanation of ONE concept} #{topic}
- [technique] {How to apply this concept} #application
- [risk] {What to avoid when applying} #anti-pattern

## Relations

- relates_to [[ANALYSIS-NNN {Topic Name}]]
- relates_to [[Related Concept]]

## Details

**Context**: [When this applies]
**Pattern**: [How to recognize/apply]
**Example**: [Concrete instance]
**Pitfall**: [What to avoid]
"""
})
```

**CRITICAL REQUIREMENT**: Create 5-10 atomic notes.

**Each note MUST satisfy**:

| Constraint | Requirement |
|------------|-------------|
| **Atomic** | ONE concept per note |
| **Structured** | 3+ observations with categories and tags |
| **Connected** | 2+ relations via wikilinks |
| **Typed** | Proper entity type (analysis, decision, etc.) |

### 4B: Link Related Notes

After creating all notes, connect them to existing knowledge:

```python
# Search for related existing notes
mcp__plugin_brain_brain__search({
  "query": "{related-concept}",
  "mode": "semantic",
  "limit": 5
})

# Add relations to existing notes
mcp__plugin_brain_brain__edit_note({
  "identifier": "<existing note title>",
  "operation": "append",
  "content": "\n- relates_to [[New Note Title]]"
})
```

### 4C: Skill Enhancement (if applicable)

If topic enhances an existing skill:

1. Read current skill prompt
2. Identify integration point
3. Add new section documenting concept application
4. Update with concrete examples
5. Document in commit message

---

## Phase 5: Action Items

### If Implementation Work Identified

Create GitHub issue:

```bash
# Verify branch first
git branch --show-current

# Create issue with detailed description
gh issue create \
    --title "[Enhancement] Apply {TOPIC} to {integration-area}" \
    --body "## Context

Research completed: analysis note in Brain memory

## Proposal

[Brief description of what to implement]

## Integration Points

[List specific files/agents/protocols]

## Benefits

[Why this matters]

## References

- Analysis Note: ANALYSIS-NNN {topic-slug}
- Related Notes: [list titles]

## Tasks

- [ ] [Specific task 1]
- [ ] [Specific task 2]
- [ ] [Specific task 3]

## Acceptance Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]" \
    --label "enhancement" \
    --label "research-derived"
```

### Document in Session Log

```markdown
## Action Items Created

- GitHub Issue #{number}: {title}
- Brain Memory Notes: {count} notes created
- Analysis Note: ANALYSIS-NNN {topic-slug}

## Next Steps

[What should happen next - implementation, review, discussion]
```

---

## Token Efficiency

**Reuse Over Recreation:**

- Reference analysis note in other notes (do not duplicate content)
- Use wikilink relations instead of repeating explanations
- Create atomic notes that combine in search queries (not monolithic dumps)

**Strategic Importance:**

Notes created from research should use appropriate entity types:

| Entity Type | Use For |
|-------------|---------|
| analysis | Comprehensive research analysis documents |
| decision | If research leads to an architectural decision |
| skill | If research produces a reusable skill pattern |

---

## Example Invocation

```text
Research and incorporate knowledge about: **Chesterton's Fence**

**Research Context**: Applies to decision-making processes, especially around changing or removing existing systems without understanding their purpose.

**Source URLs**:
- https://fs.blog/chestertons-fence/
- https://en.wikipedia.org/wiki/G._K._Chesterton#Chesterton's_fence
```
