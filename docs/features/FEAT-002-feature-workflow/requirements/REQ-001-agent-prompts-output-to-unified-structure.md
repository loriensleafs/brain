---
title: REQ-001-agent-prompts-output-to-unified-structure
type: requirement
status: draft
permalink: features/feat-002-feature-workflow/requirements/req-001-agent-prompts-output-to-unified-structure
feature-ref: FEAT-002
priority: must
created-by: planner
tags:
- requirement
- feature-workflow
- agent-prompts
- unified-structure
---

# REQ-001: Agent Prompts Output to Unified Structure

## Requirement Statement

The planner, spec-generator, task-generator, and explainer agents MUST output all feature artifacts to the unified directory structure defined in ADR-001:

```text
features/FEAT-NNN-{name}/
├── FEAT-NNN-{name}.md
├── requirements/
│   └── REQ-NNN-{topic}.md
├── design/
│   └── DESIGN-NNN-{topic}.md
└── tasks/
    └── TASK-NNN-{topic}.md
```

Feature directory names MUST match the pattern `FEAT-\d{3}-[a-z0-9-]+` (max 50 characters).

## Acceptance Criteria

1. Agent prompts contain instructions to create features in `features/FEAT-NNN-{name}/` structure
2. Feature directories follow naming pattern validation (`FEAT-NNN-{name}`)
3. Agent prompts output FEAT entity as `FEAT-NNN-{name}.md` (descriptive filename)
4. Requirements, designs, and tasks go to correct subdirectories
5. All artifacts include correct frontmatter per ADR-001 schema
6. Forward-refs used for pre-creation linking if needed

## Dependencies

- ADR-001 acceptance (ACCEPTED)
- ID assignment protocol understanding (REQ-004)
- Frontmatter schema knowledge (ADR-001)

## Observations

- [requirement] Four agents need prompt updates: planner, spec-generator, task-generator, explainer #scope
- [dependency] ID assignment protocol (query max + 1) required before agent updates #ordering
- [constraint] Feature directory names validated by regex pattern #security

## Relations

- implements [[FEAT-002-feature-workflow]]
- traces_to [[ADR-001-feature-workflow]]
- requires [[REQ-004-subagent-id-assignment-protocol]]
