---
title: REQ-003-status-frontmatter-consistency
type: requirement
status: draft
permalink: features/feat-002-feature-workflow/requirements/req-003-status-frontmatter-consistency
feature-ref: FEAT-002
priority: must
created-by: planner
tags:
- requirement
- feature-workflow
- status
- frontmatter
---

# REQ-003: Status Frontmatter Consistency and Cascading

## Requirement Statement

All artifacts MUST maintain consistent status in frontmatter according to entity type:

- **Feature**: `draft | in-progress | complete | abandoned`
- **Requirement**: `draft | approved | implemented | deferred`
- **Design**: `draft | approved | implemented`
- **Task**: `todo | in-progress | done | blocked`

When an artifact's status changes, all documents that reference it MUST be updated to reflect the new status.

## Acceptance Criteria

1. Frontmatter schema includes status field for each entity type
2. Agent prompts enforce valid status values per entity type
3. Status transitions are documented (when status changes, update referencing artifacts)
4. Cascade rules documented: task completion may unblock dependent tasks
5. Status is source of truth (frontmatter status is authoritative, not derived)

## Dependencies

- ADR-001 status schema (ACCEPTED)
- Frontmatter field definitions

## Observations

- [requirement] Status field is mandatory and per-entity-type #enforcement
- [constraint] Status cascade requires manual updates in this phase #limitation
- [decision] Frontmatter status is authoritative source of truth #governance
- [insight] Task blocking relationships enable status cascade logic #dependency

## Relations

- implements [[FEAT-002-feature-workflow]]
- traces_to [[ADR-001-feature-workflow]]
