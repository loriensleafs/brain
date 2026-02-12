---
title: TASK-006-update-explainer-agent-prompt
type: task
status: todo
permalink: features/feat-002-feature-workflow/tasks/task-006-update-explainer-agent-prompt
feature-ref: FEAT-002
req-ref: REQ-001
effort-estimate-human: 3h
effort-estimate-ai: 45m
priority: high
created-by: planner
tags:
- task
- feature-workflow
- explainer
- prompt-update
---

# TASK-006: Update Explainer Agent Prompt

## Description

Update the explainer agent to create feature artifacts following the ADR-001 unified structure for the PRD (Product Requirements Document) workflow. The explainer creates FEAT entities from PRDs, enabling the PRD flow to produce the same artifact structure as the ADR flow.

**Current behavior**: Creates artifacts in `planning/` with custom structures
**New behavior**: Creates FEAT entities in `features/FEAT-NNN-{name}/` with source-refs pointing to PRD/EPIC

## Definition of Done

1. Explainer prompt updated to output features to `features/FEAT-NNN-{name}/` structure
2. Explainer creates FEAT-NNN-{name}.md entities from PRDs
3. Features include source-refs: [PRD-NNN] or [EPIC-NNN, PRD-NNN]
4. Explainer implements ID assignment protocol for FEAT-NNN entities
5. All required sections present (Context, Scope, Success Criteria, Observations, Relations)

## Observations

- [task] Explainer handles PRD flow (roadmap -> explainer -> task-generator) #workflow
- [fact] Sixth task in execution order - blocked by TASK-005 #sequencing
- [fact] Originally numbered TASK-004 (topic-based), renumbered to TASK-006 (execution-order) #renumbering
- [requirement] Explainer must set source-refs to PRD and/or EPIC IDs #traceability

## Relations

- implements [[FEAT-002-feature-workflow]]
- satisfies [[REQ-001-agent-prompts-output-to-unified-structure]]
- derives_from [[ADR-001-feature-workflow]]
- blocked_by [[TASK-005-update-task-generator-agent-prompt]]
- enables [[TASK-007-rename-files-to-kebab-case]]
