---
name: execution-plans
description: Manage execution plans as versioned Brain memory notes with progress tracking and decision logs. Use when creating, updating, or archiving plans for complex multi-step work.
license: MIT
agents:
  - planner
model: claude-sonnet-4-5
metadata:
  version: 2.0.0
---

# Execution Plans Skill

Treat execution plans as first-class Brain memory notes in the `planning/` folder.

## Plan Storage

Plans are stored as Brain memory notes using the `planning/` folder:

```text
planning/
  PLAN-001-feature-name.md      # Active plan
  PLAN-002-refactoring.md       # Active plan
  PLAN-003-migration.md         # Completed (status in frontmatter)
  PLAN-004-abandoned-idea.md    # Abandoned (status in frontmatter)
```

Plan lifecycle is tracked via observations in the note, not by moving files between directories.

## Triggers

| Trigger Phrase | Operation |
|----------------|-----------|
| `create execution plan` | Create new plan note in planning/ |
| `update plan progress` | Edit plan note with progress entry |
| `log decision` | Edit plan note with decision entry |
| `complete plan` | Edit plan note to mark completed |
| `abandon plan` | Edit plan note to mark abandoned with rationale |

## Plan Template

### Required Sections

| Section | Purpose |
|---------|---------|
| Observations | Status, key facts, decisions |
| Relations | Links to issues, PRs, ADRs |
| Objectives | Checkboxes for trackable goals |
| Decision Log | Table of decisions with rationale |
| Progress Log | Timestamped updates with agent attribution |
| Blockers | Current impediments |

## Workflow

### Creating a Plan

```python
mcp__plugin_brain_brain__write_note({
  "title": "PLAN-NNN {Plan Name}",
  "folder": "planning",
  "content": """---
title: PLAN-NNN {Plan Name}
type: task
tags: [plan, {domain}, active]
---

# PLAN-NNN {Plan Name}

## Observations

- [fact] Plan created on YYYY-MM-DD #status
- [fact] Owner: {agent name} #ownership
- [requirement] {Primary objective} #objective
- [constraint] {Key constraint or dependency} #constraint

## Relations

- relates_to [[Issue #{number}]]
- depends_on [[ADR-NNN Related Decision]]

## Objectives

- [ ] {Objective 1}
- [ ] {Objective 2}
- [ ] {Objective 3}

## Decision Log

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|------------------------|

## Progress Log

| Date | Update | Agent |
|------|--------|-------|
| YYYY-MM-DD | Plan created | {agent} |

## Blockers

None currently.
"""
})
```

### Updating Progress

```python
# Check off completed objectives and add progress entry
mcp__plugin_brain_brain__edit_note({
  "identifier": "PLAN-NNN {Plan Name}",
  "operation": "replace_section",
  "heading": "Progress Log",
  "content": "## Progress Log\n\n| Date | Update | Agent |\n|------|--------|-------|\n| YYYY-MM-DD | Plan created | {agent} |\n| YYYY-MM-DD | {New update} | {agent} |"
})
```

### Logging Decisions

```python
# Add row to Decision Log
mcp__plugin_brain_brain__edit_note({
  "identifier": "PLAN-NNN {Plan Name}",
  "operation": "replace_section",
  "heading": "Decision Log",
  "content": "## Decision Log\n\n| Date | Decision | Rationale | Alternatives Considered |\n|------|----------|-----------|------------------------|\n| YYYY-MM-DD | {What was decided} | {Why this choice} | {What else was evaluated} |"
})
```

### Completing a Plan

1. Verify all objectives checked
2. Update status observation and tags

```python
mcp__plugin_brain_brain__edit_note({
  "identifier": "PLAN-NNN {Plan Name}",
  "operation": "append",
  "content": "\n- [outcome] Plan completed on YYYY-MM-DD #completed"
})
```

### Blocking a Plan

```python
mcp__plugin_brain_brain__edit_note({
  "identifier": "PLAN-NNN {Plan Name}",
  "operation": "replace_section",
  "heading": "Blockers",
  "content": "## Blockers\n\n- {Impediment description}\n- Blocked since: YYYY-MM-DD"
})
```

### Abandoning a Plan

```python
mcp__plugin_brain_brain__edit_note({
  "identifier": "PLAN-NNN {Plan Name}",
  "operation": "append",
  "content": "\n- [decision] Plan abandoned on YYYY-MM-DD: {rationale} #abandoned"
})
```

## Integration

- Session logs reference active plans when relevant
- Planner agent creates plans here when executing complex work
- Retrospectives link back to completed plans via wikilinks

## Anti-Patterns

| Avoid | Why | Instead |
|-------|-----|---------|
| Plans without objectives | Not trackable | Define measurable checkboxes |
| Undocumented decisions | Lost institutional knowledge | Log every non-trivial choice |
| Stale active plans | Clutters search results | Complete or abandon promptly |
| Plans without relations | No traceability | Always link to source issue or ADR |
| Plans without observations | Missing categorized facts | Add status, ownership, constraints |

## Verification

After creating a plan:

- [ ] Note exists in Brain memory `planning/` folder
- [ ] Has 3+ observations with categories and tags
- [ ] Has 2+ relations via wikilinks
- [ ] At least one objective defined
- [ ] Linked to issue or PR

After completing:

- [ ] All objectives checked
- [ ] Final progress entry added
- [ ] Completion observation appended
