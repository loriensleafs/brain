---
title: TASK-003-update-planner-agent-prompt
type: task
permalink: features/feat-002-feature-workflow/tasks/task-003-update-planner-agent-prompt-1
status: todo
feature-ref: FEAT-002
req-ref: REQ-001
effort-estimate-human: 4h
effort-estimate-ai: 30m
priority: high
created-by: planner
tags:
- task
- feature-workflow
- planner-agent
- prompt-update
---

# TASK-003: Update Planner Agent Prompt

## Description

Update planner agent to output features to features/FEAT-NNN-{name}/ structure.

## Definition of Done

1. Planner outputs to new directory structure
2. Planner implements ID assignment protocol
3. Planner creates FEAT-NNN-{name}.md feature files

## Observations

- [task] Planner is primary FEATURE entity creator #responsibility
- [fact] Third task in execution order - blocked by TASK-002 #sequencing
- [fact] Originally numbered TASK-001 (topic-based), renumbered to TASK-003 (execution-order) #renumbering
- [requirement] Planner must query existing FEAT-NNN IDs and assign max+1 #id-assignment

## Relations

- implements [[FEAT-002-feature-workflow]]
- satisfies [[REQ-001-agent-prompts-output-to-unified-structure]]
- derives_from [[ADR-001-feature-workflow]]
- blocked_by [[TASK-002-update-memory-skill-entity-mapping]]
- enables [[TASK-004-update-spec-generator-agent-prompt]]