# Research and Incorporate Workflow

Detailed phase workflows with templates, verification checkpoints, and tool usage patterns.

---

## Execution Principles

Complete the workflow systematically. Focus on:

- **Depth over breadth**: Thorough analysis of core concepts, not surface coverage
- **Concrete examples over abstract theory**: Every principle needs real-world demonstration
- **Integration with ai-agents project**: Every insight must show applicability

Do what is required for each phase; nothing more, nothing less.

---

## Phase 1: Research and Context Gathering (BLOCKING)

### Pre-Work: Existing Knowledge Check

**Before external research, analyze existing project context:**

```python
# Search Brain for related concepts
mcp__plugin_brain_brain__search_notes(query="{TOPIC} related concepts principles")

# Read specific notes for full context
mcp__plugin_brain_brain__read_note(identifier="{relevant-note-title}")
```

**Questions to answer:**

- What does ai-agents already know about this topic?
- What related patterns exist in the codebase? (ADRs, protocols, skills)
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

`.agents/analysis/{topic-slug}.md`

### Document Structure

Create sections as needed for the topic, but MUST include:

```markdown
# {Topic Name}: Analysis

**Date**: YYYY-MM-DD | **Context**: {CONTEXT} | **Sources**: [URLs]

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

## Applicability to ai-agents Project

[Integration points, proposed applications, priority assessment]

## References

[Sources with URLs]
```

**Note**: Organize for clarity, not template compliance. If the topic doesn't have "historical context," don't force it. Focus on what matters.

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

Add section to analysis document:

```markdown
## Applicability to ai-agents Project

### Integration Points

#### Agent System
[Specific agents and how they could use this]

#### Protocols
[Session protocol, handoff protocol enhancements]

#### Memory Architecture
[How this informs Brain note usage]

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

### 4A: Brain Project Note

Create comprehensive project note:

```python
mcp__plugin_brain_brain__write_note(
    title="{Topic Name} Integration",
    category="research",
    content="""# {Topic Name} Integration

## Core Insight
[1-2 sentences: the essence]

## Key Principles
1. [Principle 1 with brief explanation]
2. [Principle 2 with brief explanation]
3. [Principle 3 with brief explanation]

## Application to Project
[How this applies to our project specifically]

## Integration Points
- **Agent**: [Which agent, how it applies]
- **Protocol**: [Which protocol, enhancement]
- **Skill**: [Which skill, improvement]
- **Memory**: [How this informs memory usage]

## Practical Guidance
[Step-by-step application for team members]

## Observations
- Topic: {topic-slug}
- Integration priority: [high/medium/low]

## Relations
- [[analysis/{topic-slug}]]
- [[{related-concept-1}]]
- [[{related-concept-2}]]

## Next Steps
[Action items or implementation tasks]
"""
)
```

### 4B: Brain Atomic Notes

**CRITICAL REQUIREMENT**: Create 5-10 atomic notes

**Each note MUST satisfy (RULE 0)**:

| Constraint | Requirement |
|------------|-------------|
| **Atomic** | ONE concept per note (not a grab-bag of loosely related ideas) |
| **Actionable** | Include pattern/example/pitfall, not just theory |
| **Linked** | Connect to related existing notes via Relations section |

Violating these constraints creates unusable notes that pollute the knowledge graph.

**Note Categories** (create 1-2 from each relevant category):

1. Core definition and principle
2. Primary framework or model
3. Key application pattern
4. Critical failure mode
5. Relationship to existing concept
6. Implementation guidance
7. Concrete example with lesson
8. Anti-pattern with correction
9. Decision-making heuristic
10. Integration with project patterns

**Template for Each:**

```python
mcp__plugin_brain_brain__write_note(
    title="{Specific Concept from Topic}",
    category="research",
    content="""[Atomic explanation of ONE concept]

## Context
[When this applies]

## Pattern
[How to recognize/apply]

## Example
[Concrete instance]

## Observations
- Concept type: [principle/framework/pattern/anti-pattern]
- Pitfall: [What to avoid]

## Relations
- [[{topic}-integration]]
- [[{related-concept}]]
"""
)
```

### 4C: Link Related Notes

After creating all notes:

```python
# Search for related existing notes
mcp__plugin_brain_brain__search_notes(query="{related-concept}")

# Edit notes to add cross-references via Relations section
mcp__plugin_brain_brain__edit_note(
    identifier="{note-title}",
    operation="append",
    content="""
## Relations
- [[{new-related-note}]]
"""
)
```

### 4D: Skill Enhancement (if applicable)

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

Research completed: .agents/analysis/{topic-slug}.md

## Proposal

[Brief description of what to implement]

## Integration Points

[List specific files/agents/protocols]

## Benefits

[Why this matters]

## References

- Analysis: .agents/analysis/{topic-slug}.md
- Brain Project Note: {topic-slug}-integration
- Brain Note IDs: [list]

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
- Brain Project Note: {topic-slug}-integration
- Brain Notes: {count} atomic notes created
- Analysis Document: .agents/analysis/{topic-slug}.md

## Next Steps

[What should happen next - implementation, review, discussion]
```

---

## Token Efficiency

**Reuse Over Recreation:**

- Reference analysis document in memories (don't duplicate content)
- Link memories instead of repeating explanations
- Create atomic memories that combine in queries (not monolithic dumps)

**Strategic Importance Scoring:**

| Score | Use For |
|-------|---------|
| 10 | Foundational principles that inform multiple systems |
| 9 | Critical frameworks that guide major decisions |
| 8 | Practical patterns with broad applicability |
| 7 | Specific applications with clear value |

---

## Example Invocation

```text
Research and incorporate knowledge about: **Chesterton's Fence**

**Research Context**: Applies to decision-making processes, especially around changing or removing existing systems without understanding their purpose.

**Source URLs**:
- https://fs.blog/chestertons-fence/
- https://en.wikipedia.org/wiki/G._K._Chesterton#Chesterton's_fence
```
