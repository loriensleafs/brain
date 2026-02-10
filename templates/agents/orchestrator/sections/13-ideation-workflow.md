## Ideation Workflow

**Trigger Detection**: Recognize ideation scenarios by these signals:

- Package/library URLs (NuGet, npm, PyPI, etc.)
- Vague scope language: "we need to add", "we should consider", "what if we"
- GitHub issues without clear specifications
- Exploratory requests: "would it make sense to", "I was thinking about"
- Incomplete feature descriptions lacking acceptance criteria

### Phase 1: Research and Discovery

**{worker_type}**: analyst

**Tools available**:

- `WebSearch`, `WebFetch` - General web research and documentation lookup
- `mcp__plugin_brain_brain__search` - Search existing knowledge in Brain
- `mcp__plugin_brain_brain__read_note` - Read relevant analysis notes

**Output**: Research findings in Brain memory `analysis/ANALYSIS-ideation-[topic]`

**Research Template**:

```markdown
## Ideation Research: [Topic]

### Package/Technology Overview

[What it is, what problem it solves]

### Community Signal

[GitHub stars, downloads, maintenance activity, issues]

### Technical Fit Assessment

[How it fits with current codebase, dependencies, patterns]

### Integration Complexity

[Effort estimate, breaking changes, migration path]

### Alternatives Considered

[Other options and why this one is preferred]

### Risks and Concerns

[Security, licensing, maintenance burden]

### Recommendation

[Proceed / Defer / Reject with rationale]
```

### Phase 2: Validation and Consensus

**{worker_plural}** (parallel then sequential): high-level-advisor + independent-thinker + critic (parallel), then roadmap (sequential, needs their outputs)

| {worker_type}       | Role                  | Question to Answer                          |
| ------------------- | --------------------- | ------------------------------------------- |
| high-level-advisor  | Strategic fit         | Does this align with product direction?     |
| independent-thinker | Challenge assumptions | What are we missing? What could go wrong?   |
| critic              | Validate research     | Is the analysis complete and accurate?      |
| roadmap             | Priority assessment   | Where does this fit in the product roadmap? |

**Output**: Consensus decision in Brain memory `analysis/ANALYSIS-ideation-[topic]-validation`

**Decision Options**:

- **Proceed**: Move to Phase 3 (Planning)
- **Defer**: Good idea, but not now. Create a backlog entry in Brain memory `roadmap/backlog` with specified conditions and resume trigger.
- **Reject**: Not aligned with goals. Report rejection with documented reasoning.

### Phase 3: Epic and PRD Creation

**{worker_plural}** (sequential chain): roadmap then explainer then task-generator

| {worker_type}  | Output                       | Location                              |
| -------------- | ---------------------------- | ------------------------------------- |
| roadmap        | Epic vision with outcomes    | Brain memory `roadmap/EPIC-[topic]`   |
| explainer      | Full PRD with specifications | Brain memory `planning/PRD-[topic]`   |
| task-generator | Work breakdown structure     | Brain memory `planning/TASKS-[topic]` |

### Phase 4: Implementation Plan Review

**{worker_plural}** (parallel review): architect + devops + security + qa

| {worker_type} | Review Focus                         | Output                    |
| ------------- | ------------------------------------ | ------------------------- |
| architect     | Design patterns, architectural fit   | Design review notes       |
| devops        | CI/CD impact, infrastructure needs   | Infrastructure assessment |
| security      | Threat assessment, secure coding     | Security review           |
| qa            | Test strategy, coverage requirements | Test plan outline         |

**Consensus Required**: All {worker_plural} must approve before work begins.

**Output**: Approved implementation plan in Brain memory `planning/PLAN-implementation-[topic]`
