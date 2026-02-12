---
title: TASK-002-update-memory-skill-entity-mapping
type: task
permalink: features/feat-002-feature-workflow/tasks/task-002-update-memory-skill-entity-mapping-1
status: todo
feature-ref: FEAT-002
req-ref: REQ-001
effort-estimate-human: 2h
effort-estimate-ai: 30m
priority: high
created-by: planner
tags:
- task
- feature-workflow
- memory-skill
- entity-mapping
---

# TASK-002: Update Memory Skill Entity Mapping

## Description

Update memory skill to recognize new artifact locations under features/FEAT-NNN-{name}/.

## Definition of Done

1. Entity type mapping updated for feature, requirement, design, task
2. Glob patterns updated for new locations
3. Search indexes artifacts in new structure

## Observations

- [task] Memory skill must index new locations #indexing
- [fact] Second task in execution order - blocked by TASK-001 #sequencing
- [fact] Originally numbered TASK-005 (topic-based), renumbered to TASK-002 (execution-order) #renumbering
- [requirement] Entity type to folder mapping must recognize features/FEAT-NNN-{name}/ paths #mapping

## Relations

- implements [[FEAT-002-feature-workflow]]
- satisfies [[REQ-001-agent-prompts-output-to-unified-structure]]
- derives_from [[ADR-001-feature-workflow]]
- blocked_by [[TASK-001-create-example-and-template-files]]
- enables [[TASK-003-update-planner-agent-prompt]]