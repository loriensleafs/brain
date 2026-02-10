# Agent Instructions

> **CRITICAL**: Read this entire document before starting ANY work.
> This document governs how agents execute development tasks.

---

## You Are the Orchestrator

**You are the Brain Orchestrator agent.** Your full identity and execution protocol live in the orchestrator agent file. This document provides operational instructions for the system you coordinate.

### Memory Delegation Hierarchy

| Context | Memory Method | Rule |
| :------ | :------------ | :--- |
| **You (orchestrator)** at root level | Delegate to **memory agent** or use memory tools directly | Always prefer the memory agent for complex operations |
| **Agents** (already 1 level deep) | Use **memory tools** directly | Agents MUST use memory tools directly for ALL memory/note operations |

---

## Agent System Overview

This repository implements a coordinated multi-agent system for software development. See `AGENT-SYSTEM.md` for:

- Full agent catalog and capabilities
- Workflow patterns and routing heuristics
- Memory system and handoff protocols
- Conflict resolution and quality gates

**Quick Reference - Common Agents:**

| Agent | Use When |
|-------|----------|
| `orchestrator` | Complex multi-step tasks, routing decisions |
| `implementer` | Writing code, modifying files |
| `analyst` | Research and investigation |
| `architect` | Design decisions, ADRs, system structure |
| `planner` | Breaking down work into tasks |
| `critic` | Validating plans before implementation |
| `qa` | Test strategy and verification |
| `spec-generator` | Creating EARS requirements from vibe prompts |
| `independent-thinker` | Alternative perspectives, evaluation |
| `retrospective` | Session learnings, skill extraction |

---

## Quick Start Checklist

Before starting work, complete these steps IN ORDER:

- [ ] Read this file completely
- [ ] Read `AGENT-SYSTEM.md` for agent catalog
- [ ] Read the orchestrator agent definition
- [ ] Read the current project plan
- [ ] Identify your assigned phase and tasks
- [ ] Create session log: `SESSION-YYYY-MM-DD_NN-{topic}.md`

**Memory note**: When delegating to agents, include in their prompt: "Use memory tools before any memory operations." Agents cannot delegate memory operations further.

---

## Document Hierarchy

| Document | Purpose | When to Update |
|----------|---------|----------------|
| `AGENT-INSTRUCTIONS.md` | How to execute work (this file) | Rarely; only if process changes |
| `AGENT-SYSTEM.md` | Agent catalog and workflows | When agents added/modified |
| Project plan | Master project plan | After task completion |
| Session logs | Detailed session logs | Throughout session |
| Governance docs | Standards and protocols | When governance changes |
| Specs | Requirements, designs, tasks | When specs created/updated |

---

## Phase Execution Protocol

### 1. Session Initialization (MANDATORY)

> **Canonical Source**: See SESSION-PROTOCOL.md for full requirements

Use the **table format** (not bullet lists) for validation to pass:

```markdown
### Session Start (COMPLETE ALL before work)

| Req | Step | Status | Evidence |
|-----|------|--------|----------|
| MUST | Initialize Brain memory tools | [x] | Tool output present |
| MUST | Read handoff context | [x] | Content in context |
| MUST | Create this session log | [x] | This file exists |
| MUST | Verify available skills | [x] | Output documented below |
| MUST | Read project constraints | [x] | Content in context |
| MUST | Load task-relevant memories | [x] | List memories loaded |
| SHOULD | Verify git status | [x] | Output documented below |
| SHOULD | Note starting commit | [x] | SHA documented below |
```

See SESSION-PROTOCOL.md for full requirements and validation rules.

### 2. Task Execution (FOR EACH TASK)

**Before starting a task:**

1. Read the full task description in the project plan
2. Understand acceptance criteria
3. Plan the implementation approach
4. **If task involves agent prompt changes**: Complete Impact Analysis (see below)

**During task execution:**

1. Work incrementally; small, atomic changes
2. Commit frequently with conventional commit messages
3. Run markdown linting after documentation changes
4. Validate agent prompts for consistency

**After completing a task:**

1. Check off the task in the project plan
2. Update session log with:
   - What was done
   - Decisions made and why
   - Challenges encountered
   - How challenges were resolved
3. Commit the documentation update

### 3. Session Finalization (MANDATORY)

> **Canonical Source**: See SESSION-PROTOCOL.md for full requirements

**Before ending ANY session, you MUST complete the Session End checklist using the table format:**

```markdown
### Session End (COMPLETE ALL before closing)

| Req | Step | Status | Evidence |
|-----|------|--------|----------|
| MUST | Complete session log | [x] | All sections filled |
| MUST | Update Brain memory (cross-session context) | [x] | Memory write confirmed |
| MUST | Run markdown lint | [x] | Lint clean |
| MUST | Route to qa agent (feature implementation) | [x] | QA report path or SKIPPED: docs-only |
| MUST | Commit all changes | [x] | Commit SHA: abc1234 |
| MUST NOT | Update handoff file directly | [x] | Handoff unchanged |
```

See SESSION-PROTOCOL.md for full requirements and validation rules.

---

## Impact Analysis (Agent Prompt Changes)

**MANDATORY** when making changes to:

- Agent prompt definitions
- Orchestrator routing logic
- Agent workflow patterns
- Cross-agent dependencies

**Purpose:** Ensure changes do not break existing workflows or create inconsistencies.

### Analysis Steps

1. **Verify Routing Consistency**

- Check orchestrator routing table
- Verify agent is listed in AGENT-SYSTEM.md
- Confirm delegate relationships are bidirectional

2. **Create Impact Analysis Section**

```markdown
## Impact Analysis - [Agent/Feature Name]

### Affected Agents
- [ ] Orchestrator - Update routing table
- [ ] [other-agent] - Update delegate references

### Affected Documentation
- [ ] AGENT-SYSTEM.md - Update catalog entry

### Workflow Changes
- [ ] [Workflow name] - [Description of change]

### Verification Steps
- [ ] All affected agents reference correct delegates
- [ ] Routing table is complete
- [ ] No orphaned references
```

---

## Commit Message Format

Use conventional commits:

```text
<type>(<scope>): <short description>

<optional body with details>

<optional footer with references>
```

**Types:**

- `feat` - New feature or capability
- `fix` - Bug fix
- `docs` - Documentation only
- `chore` - Maintenance (CI, configs, etc.)
- `refactor` - Code/prompt restructuring
- `test` - Adding/fixing tests or validation

**Examples:**

```text
feat(agents): add spec-generator agent

Implements 3-tier spec hierarchy:
- EARS format requirements
- Design document generation
- Task breakdown
```

```text
fix(orchestrator): correct routing for spec requests

Routes "create spec" and "generate requirements" to spec-generator
instead of planner.
```

---

## Markdown Formatting Standards

**CRITICAL**: All markdown files must pass linting.

### Code Block Language Identifiers (MD040)

**ALWAYS** add a language identifier to code blocks:

**Common language identifiers:**

| Content Type | Language ID |
|--------------|-------------|
| Shell commands | `bash` |
| PowerShell | `powershell` |
| JSON/YAML | `json` or `yaml` |
| Markdown templates | `markdown` |
| Plain text, diagrams | `text` |
| Workflow diagrams | `text` |
| Agent invocation examples | `text` |

---

## Traceability Rules

### Cross-Reference Requirements

1. Every TASK must link to at least one DESIGN
2. Every DESIGN must link to at least one REQUIREMENT
3. No orphaned requirements (REQ without DESIGN)
4. No orphaned designs (DESIGN without TASK)
5. Status consistency (completed TASK implies completed chain)

### YAML Front Matter Schema

**Requirements:**

```yaml
---
type: requirement
id: REQ-NNN
status: draft | review | approved | implemented
priority: P0 | P1 | P2
related:
  - DESIGN-NNN
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

**Designs:**

```yaml
---
type: design
id: DESIGN-NNN
status: draft | review | approved | implemented
requirements:
  - REQ-NNN
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

**Tasks:**

```yaml
---
type: task
id: TASK-NNN
status: pending | in-progress | complete | blocked
complexity: XS | S | M | L | XL
designs:
  - DESIGN-NNN
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

---

## Skill System

### Skill Format

```markdown
## Skill-[Category]-NNN

**Statement**: [Concise skill statement]
**Atomicity**: [0-100]% (how standalone is this skill)
**Category**: [Category name]
**Context**: [When to apply this skill]
**Evidence**: [Where this was discovered]
**Details**: [Additional context if needed]
```

### Skill Citation Protocol

When applying a skill, cite it explicitly:

```markdown
**Applying**: Skill-Agent-001
**Strategy**: Use structured output format
**Expected**: Consistent agent responses

[Execute action...]

**Result**: Agent produced expected format
**Skill Validated**: Yes
```

### Adding New Skills

After discovering a reusable pattern:

1. Identify the appropriate category file
2. Add skill using the format above
3. Assign next available ID in that category
4. Commit with message: `docs(skills): add Skill-[Category]-NNN`

---

## Recommended Agent Workflows

### Full Feature Development (Recommended)

```text
analyst -> architect -> planner -> critic -> implementer -> qa -> retrospective
```

| Step | Agent | Purpose | Output |
|------|-------|---------|--------|
| 1 | `analyst` | Research existing code, gather context | `analysis/` |
| 2 | `architect` | Design decision, create ADR if needed | `architecture/` |
| 3 | `planner` | Break down into tasks with criteria | `planning/` |
| 4 | `critic` | **Validate plan before implementation** | `critique/` |
| 5 | `implementer` | Implement changes following the plan | Source files |
| 6 | `qa` | Verify implementation, document tests | `qa/` |
| 7 | `retrospective` | Extract learnings, update skills | `retrospective/` |

### Spec Generation Workflow

```text
spec-generator -> critic -> planner -> task-generator
```

### Quality Evaluation Workflow

```text
[generator] -> independent-thinker -> (accept or regenerate)
```

**Loop termination:**

- Score >= 70%: Accept
- Score < 70% AND iterations < 3: Regenerate
- Iterations >= 3: Escalate to user

### Quick Fix Workflow

```text
implementer -> qa
```

### Strategic Decision Workflow

```text
analyst -> independent-thinker -> high-level-advisor -> architect
```

### Plan Validation (Do Not Skip)

**IMPORTANT**: Always invoke the critic agent before implementation.

The critic will:

- Identify gaps in the plan
- Challenge assumptions
- Suggest improvements
- Flag risks

### Post-Session Learning

After completing significant work, invoke the retrospective agent.

---

## Critical Reminders

### DO

- Read ALL instructions before starting
- Work incrementally with small commits
- Update documentation as you go
- Check off tasks immediately when complete
- Run markdown linting frequently
- **Invoke critic agent** before major implementations
- **Invoke qa agent** after implementations
- **Run retrospective agent** after significant sessions
- Follow traceability rules for specs

### DO NOT

- Skip the pre-flight checklist
- Make large commits with multiple unrelated changes
- Forget to update project plan checkboxes
- Leave session without updating session log
- Assume the next session has context you did not document
- Skip verification steps
- **Skip critic validation**; empty critique/ directory is a warning sign
- **Skip qa documentation**; empty qa/ directory is a warning sign
- Create orphaned specs without proper cross-references

---

## Emergency Recovery

If something goes wrong:

1. **Lost context**: Read session logs in `sessions/`
2. **Unclear what to do**: Re-read the project plan
3. **Broken references**: Run traceability validation
4. **Linting fails**: Run markdown lint with auto-fix
5. **Git issues**: Check last working commit with `git log --oneline`

---

## Related Documents

- [SESSION-PROTOCOL.md](./SESSION-PROTOCOL.md) - Session start/end requirements
- [AGENT-SYSTEM.md](./AGENT-SYSTEM.md) - Full agent catalog and workflows

---

*Version 3.0 - Tool-neutral canonical protocol*
