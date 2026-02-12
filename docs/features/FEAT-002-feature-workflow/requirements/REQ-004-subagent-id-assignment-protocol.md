---
title: REQ-004-subagent-id-assignment-protocol
type: requirement
status: draft
permalink: features/feat-002-feature-workflow/requirements/req-004-subagent-id-assignment-protocol
feature-ref: FEAT-002
priority: must
created-by: planner
tags:
- requirement
- feature-workflow
- id-assignment
- protocol
---

# REQ-004: Subagent ID Assignment Protocol

## Requirement Statement

Creating agents (planner, spec-generator, task-generator, explainer) MUST implement ID assignment following the protocol:

1. **Query existing entities**: Use Glob or search to find all entities of the type being created in the target location
2. **Find maximum ID**: Parse entity filenames and identify the maximum NNN value
3. **Assign next ID**: Assign ID as max + 1, padded to 3 digits
4. **If no existing**: Start at 001 if no entities of that type exist in the location

Example for task-generator creating a new task:

```text
1. Glob features/FEAT-001-*/tasks/TASK-*.md
2. Find: [TASK-001.md, TASK-002.md, TASK-005.md]
3. Parse: [001, 002, 005] -> max = 5
4. Assign: New task gets TASK-006
```

## Acceptance Criteria

1. Each agent includes ID assignment logic in its prompt
2. ID assignment uses glob pattern to find existing entities
3. ID parsing correctly extracts NNN values from filenames
4. New IDs are assigned as max + 1, padded to 3 digits
5. Agents verify ID uniqueness before creating artifacts
6. Protocol documented in each agent prompt

## Dependencies

- Glob tool capability (available to agents)
- Entity naming conventions from ADR-001

## Observations

- [requirement] ID assignment delegated to creating agents, not centralized #delegation
- [requirement] Agents must query existing entities before assigning IDs #prevention
- [constraint] ID assignment is per-location (FEAT-001 tasks separate from FEAT-002 tasks) #scope
- [insight] Glob patterns enable efficient ID discovery without database queries #implementation

## Relations

- implements [[FEAT-002-feature-workflow]]
- traces_to [[ADR-001-feature-workflow]]
- required_by [[REQ-001-agent-prompts-output-to-unified-structure]]
