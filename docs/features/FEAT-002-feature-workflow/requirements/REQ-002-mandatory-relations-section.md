---
title: REQ-002-mandatory-relations-section
type: requirement
status: draft
permalink: features/feat-002-feature-workflow/requirements/req-002-mandatory-relations-section
feature-ref: FEAT-002
priority: must
created-by: planner
tags:
- requirement
- feature-workflow
- relations
- traceability
---

# REQ-002: Mandatory Relations Section in All Artifacts

## Requirement Statement

ALL artifacts (features, requirements, designs, tasks) MUST include a Relations section that documents:

1. **Parent entity reference** (feature-ref for requirements/designs/tasks)
2. **Source document references** (ADR, PRD, Epic)
3. **Related artifact references** (trace through REQ to DESIGN to TASK chain)

## Acceptance Criteria

1. Every artifact has a Relations section (markdown ## Relations heading)
2. Relations use wikilink format `[[Entity-Name]]` for basic-memory forward reference resolution
3. Minimum 2 relations per artifact (parent + source document)
4. Relation types are semantic (implements, derives_from, traces_to, etc.)
5. All relations resolve correctly during entity creation
6. Agent prompts instruct creation of Relations sections

## Dependencies

- ADR-001 Relations specification (ACCEPTED)
- Basic-memory forward reference capability

## Observations

- [requirement] Relations are mandatory, not optional #enforcement
- [requirement] Relations enable automatic traceability graph #traceability
- [requirement] Wikilink format enables forward references before entities exist #resolution
- [constraint] Minimum 2 relations ensures adequate linking #quality

## Relations

- implements [[FEAT-002-feature-workflow]]
- traces_to [[ADR-001-feature-workflow]]
