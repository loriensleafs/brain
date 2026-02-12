---
title: TASK-007-rename-files-to-kebab-case
type: task
status: todo
permalink: features/feat-002-feature-workflow/tasks/task-007-rename-files-to-kebab-case
feature-ref: FEAT-002
req-ref: REQ-005
effort-estimate-human: 1h
effort-estimate-ai: 15m
priority: high
created-by: planner
tags:
- task
- feature-workflow
- naming
- kebab-case
- migration
---

# TASK-007: Rename Files to Kebab-Case

## Description

Rename all existing FEAT-002 artifact files to follow the kebab-case convention defined in REQ-005. Files currently using spaces in names must be renamed to use hyphens.

## Definition of Done

1. All requirement files renamed: `REQ-NNN {Name}.md` to `REQ-NNN-{kebab-name}.md`
2. All design files renamed: `DESIGN-NNN {Name}.md` to `DESIGN-NNN-{kebab-name}.md`
3. All task files renamed: `TASK-NNN {Name}.md` to `TASK-NNN-{kebab-name}.md`
4. Main feature file renamed if needed
5. All wikilink references updated to match new filenames
6. Basic-memory indexes updated (re-sync after rename)

## Observations

- [task] File renames must preserve content and frontmatter #migration
- [task] Wikilinks in Relations sections may need updating #traceability
- [fact] Seventh and last task in execution order - blocked by TASK-006 #sequencing
- [fact] Originally numbered TASK-007 (same position in both orderings) #renumbering
- [constraint] Basic-memory will need re-sync after file renames #indexing

## Relations

- implements [[FEAT-002-feature-workflow]]
- satisfies [[REQ-005-kebab-case-filename-convention]]
- derives_from [[ADR-001-feature-workflow]]
- blocked_by [[TASK-006-update-explainer-agent-prompt]]
