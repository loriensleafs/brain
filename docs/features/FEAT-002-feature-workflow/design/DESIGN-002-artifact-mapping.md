---
title: DESIGN-002-artifact-mapping
type: design
status: draft
permalink: features/feat-002-feature-workflow/design/design-002-artifact-mapping
feature-ref: FEAT-002
req-refs:
- REQ-001
- REQ-004
created-by: planner
tags:
- design
- feature-workflow
- artifact-mapping
- directory-structure
---

# DESIGN-002: Directory Structure and Artifact Mapping

## Complete Directory Structure

```text
features/FEAT-NNN-{name}/
├── FEAT-NNN-{name}.md                    # Primary feature entity
├── requirements/
│   └── REQ-NNN-{topic}.md               # Requirements
├── design/
│   └── DESIGN-NNN-{topic}.md            # Design documents
└── tasks/
    └── TASK-NNN-{topic}.md              # Implementation tasks
```

## Frontmatter Schemas by Entity Type

### FEATURE Entity
```yaml
---
title: FEAT-NNN-{name}
type: feature
status: draft|in-progress|complete|abandoned
source-refs: [ADR-NNN]        # REQUIRED (empty array if none)
priority: critical|high|medium|low
created-by: planner|explainer
---
```

### REQUIREMENT Entity
```yaml
---
title: REQ-NNN-{topic}
type: requirement
status: draft|approved|implemented|deferred
feature-ref: FEAT-NNN
ears-format: true|false        # OPTIONAL (spec-generator sets true)
priority: must|should|could|wont
---
```

### DESIGN Entity
```yaml
---
title: DESIGN-NNN-{topic}
type: design
status: draft|approved|implemented
feature-ref: FEAT-NNN
req-refs: [REQ-NNN, ...]
---
```

### TASK Entity
```yaml
---
title: TASK-NNN-{topic}
type: task
status: todo|in-progress|done|blocked
feature-ref: FEAT-NNN
req-ref: REQ-NNN
design-ref: DESIGN-NNN
effort-estimate-human: Xh
effort-estimate-ai: Xh
blocked-by: [TASK-NNN]
---
```

## Workflow Field Governance

**Common Fields** (REQUIRED for all workflows):
- title, type, status, permalink
- feature-ref (for child entities)
- Relations section

**Workflow-Specific Fields** (OPTIONAL, set by creating workflow):

| Field | Set By | Purpose |
|-------|--------|---------|
| ears-format | spec-generator | Indicates formal EARS requirement format |
| effort-estimate-human | planner/task-generator | Human time estimate |
| effort-estimate-ai | planner/task-generator | AI time estimate |
| milestone | planner | Phase grouping |
| priority (MoSCoW) | spec-generator | must/should/could/wont |

## Observations

- [design] Frontmatter schemas define required vs optional fields per entity type #schema
- [design] Common fields required regardless of creating workflow #governance
- [decision] Workflow-specific fields are informational, core fields are authoritative #governance
- [fact] Both ADR and PRD flows produce identical directory structure #convergence

## Relations

- implements [[FEAT-002-feature-workflow]]
- satisfies [[REQ-001-agent-prompts-output-to-unified-structure]]
- satisfies [[REQ-004-subagent-id-assignment-protocol]]
- derives_from [[ADR-001-feature-workflow]]
- complements [[DESIGN-001-implementation-plan]]
