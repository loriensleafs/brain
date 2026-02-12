---
title: TASK-004-update-spec-generator-agent-prompt
type: task
permalink: features/feat-002-feature-workflow/tasks/task-004-update-spec-generator-agent-prompt-1
status: todo
feature-ref: FEAT-002
req-ref: REQ-001
effort-estimate-human: 4h
effort-estimate-ai: 1h
priority: high
created-by: planner
tags:
- task
- feature-workflow
- spec-generator
- prompt-update
---

# TASK-004: Update Spec-Generator Agent Prompt

## Description

Update spec-generator to emit REQ/DESIGN/TASK artifacts to unified structure.

## Definition of Done

1. Spec-generator outputs to features/FEAT-NNN-{name}/[requirements|design|tasks]/
2. Spec-generator implements ID assignment per artifact type

## Observations

- [task] Spec-generator creates REQ/DESIGN/TASK child artifacts #responsibility
- [fact] Fourth task in execution order - blocked by TASK-003 #sequencing
- [fact] Originally numbered TASK-002 (topic-based), renumbered to TASK-004 (execution-order) #renumbering
- [requirement] Spec-generator must emit EARS-format requirements with ears-format: true frontmatter #ears-format

## Relations

- implements [[FEAT-002-feature-workflow]]
- satisfies [[REQ-001-agent-prompts-output-to-unified-structure]]
- derives_from [[ADR-001-feature-workflow]]
- blocked_by [[TASK-003-update-planner-agent-prompt]]
- enables [[TASK-005-update-task-generator-agent-prompt]]