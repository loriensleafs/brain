---
title: TASK-005-update-task-generator-agent-prompt
type: task
status: todo
permalink: features/feat-002-feature-workflow/tasks/task-005-update-task-generator-agent-prompt
feature-ref: FEAT-002
req-ref: REQ-001
effort-estimate-human: 3h
effort-estimate-ai: 45m
priority: high
created-by: planner
tags:
- task
- feature-workflow
- task-generator
- prompt-update
---

# TASK-005: Update Task-Generator Agent Prompt

## Description

Update the task-generator agent prompt to create task artifacts in the unified structure. The task-generator operates at the operational level, creating executable TASK entities under FEAT-NNN contexts.

**Current behavior**: Creates tasks as observations in PLAN entities
**New behavior**: Creates TASK-NNN.md files in `features/FEAT-NNN-{name}/tasks/`

## Definition of Done

1. Task-generator prompt updated to output to `features/FEAT-NNN-{name}/tasks/`
2. Task-generator creates TASK-NNN.md files (separate files, never observations)
3. Each task includes required frontmatter and sections per ADR-001
4. Task-generator implements ID assignment protocol (query existing TASK-*.md, assign max+1)
5. Blocking relationships documented via blocked-by frontmatter field
6. Task numbers match execution order per ADR-001 sequencing rules

## Observations

- [task] Tasks must be separate files, not observations #queryability
- [fact] Fifth task in execution order - blocked by TASK-004 #sequencing
- [fact] Originally numbered TASK-003 (topic-based), renumbered to TASK-005 (execution-order) #renumbering
- [requirement] Task-generator must enforce task number = execution order rule #sequencing

## Relations

- implements [[FEAT-002-feature-workflow]]
- satisfies [[REQ-001-agent-prompts-output-to-unified-structure]]
- derives_from [[ADR-001-feature-workflow]]
- blocked_by [[TASK-004-update-spec-generator-agent-prompt]]
- enables [[TASK-006-update-explainer-agent-prompt]]
