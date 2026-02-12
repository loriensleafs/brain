---
title: DESIGN-001-implementation-plan
type: design
status: draft
permalink: features/feat-002-feature-workflow/design/design-001-implementation-plan
feature-ref: FEAT-002
created-by: planner
tags:
- design
- feature-workflow
- implementation
- plan
---

# DESIGN-001: Implementation Plan

## Summary

FEAT-002 implements ADR-001 (Unified Feature Artifact Structure) across the Brain system. This design covers the implementation approach for consolidating artifact creation from four agents (planner, spec-generator, task-generator, explainer) into a single organizational structure.

## Technical Approach

### Phase 1: Foundation
1. Create template files demonstrating correct artifact structure (TASK-001)
2. Update memory skill entity mapping to recognize `features/FEAT-NNN-{name}/` paths (TASK-002)

### Phase 2: Agent Prompt Updates
3. Update planner agent to create FEAT-NNN feature entities (TASK-003)
4. Update spec-generator to emit REQ/DESIGN/TASK to unified structure (TASK-004)
5. Update task-generator to create TASK files as separate entities (TASK-005)
6. Update explainer agent for PRD-to-FEATURE flow (TASK-006)

### Phase 3: Cleanup
7. Rename existing files to kebab-case convention (TASK-007)

## Artifact Mapping

| Entity Type | Pattern | Location | Created By |
|-------------|---------|----------|------------|
| feature | FEAT-NNN-{name}.md | features/FEAT-NNN-{name}/ | planner, explainer |
| requirement | REQ-NNN-{topic}.md | features/FEAT-NNN-{name}/requirements/ | spec-generator, explainer |
| design | DESIGN-NNN-{topic}.md | features/FEAT-NNN-{name}/design/ | spec-generator, planner |
| task | TASK-NNN-{topic}.md | features/FEAT-NNN-{name}/tasks/ | spec-generator, task-generator |

## Workflow Convergence

**ADR Flow** (Architecture-driven):
```text
decisions/ADR-NNN.md
    -> planner reads ADR
features/FEAT-NNN-{name}/FEAT-NNN-{name}.md [source-refs: [ADR-NNN]]
    -> spec-generator refines
    ├── requirements/REQ-NNN.md
    ├── design/DESIGN-NNN.md
    └── tasks/TASK-NNN.md
```

**PRD Flow** (Requirements-driven):
```text
roadmap/EPIC-NNN.md
    -> explainer creates PRD
planning/PRD-NNN.md
    -> explainer reads PRD
features/FEAT-NNN-{name}/FEAT-NNN-{name}.md [source-refs: [PRD-NNN]]
    -> task-generator refines
    ├── requirements/REQ-NNN.md
    ├── design/DESIGN-NNN.md
    └── tasks/TASK-NNN.md
```

Both flows converge to identical artifact structure once feature is created.

## ID Assignment Protocol

### Shared Feature ID Pool
- Query Pattern: Glob `features/FEAT-*/FEAT-*.md`
- Assignment: Find max FEAT-NNN ID and assign max + 1

### Per-Feature Sub-Entity ID Pools
Each entity type has independent numbering within a feature:
- REQ Pool: Glob `REQ-*.md` within requirements/
- DESIGN Pool: Glob `DESIGN-*.md` within design/
- TASK Pool: Glob `TASK-*.md` within tasks/

## Trade-offs Considered

1. **Feature-centric vs ADR-centric directories**: Chose feature-centric because features are the unit of work, ADRs are decision records
2. **Centralized vs decentralized ID assignment**: Chose decentralized (agents query max+1) because agents already have context
3. **Migration vs clean break**: Chose clean break because migration adds complexity with little benefit

## Artifact Inventory

### Feature Entity
- **FEAT-002-feature-workflow** (primary feature document)
  - Status: draft
  - Location: `features/FEAT-002-feature-workflow/FEAT-002-feature-workflow.md`

### Requirements (5 total)
1. **REQ-001**: Agent Prompts Output to Unified Structure (status: draft)
2. **REQ-002**: Mandatory Relations Section (status: draft)
3. **REQ-003**: Status Frontmatter Consistency and Cascading (status: draft)
4. **REQ-004**: Subagent ID Assignment Protocol (status: draft)
5. **REQ-005**: Kebab-Case Filename Convention (status: approved)

### Designs (3 total)
1. **DESIGN-001**: Implementation Plan (this document)
2. **DESIGN-002**: Directory Structure and Artifact Mapping
3. **DESIGN-003**: Structure Patterns and Best Practices

### Tasks (7 total)
1. **TASK-001**: Create Example and Template Files (human: 3h, AI: 1h) - done
2. **TASK-002**: Update Memory Skill Entity Mapping (human: 2h, AI: 30m) - todo
3. **TASK-003**: Update Planner Agent Prompt (human: 4h, AI: 30m) - todo
4. **TASK-004**: Update Spec-Generator Agent Prompt (human: 4h, AI: 1h) - todo
5. **TASK-005**: Update Task-Generator Agent Prompt (human: 3h, AI: 45m) - todo
6. **TASK-006**: Update Explainer Agent Prompt (human: 3h, AI: 45m) - todo
7. **TASK-007**: Rename Files to Kebab-Case (human: 1h, AI: 15m) - todo

## Observations

- [design] Implementation uses 3-phase approach: foundation, agent updates, cleanup #phases
- [design] Both ADR and PRD flows produce identical artifact structure #convergence
- [decision] Feature-centric directories chosen over ADR-centric #architecture
- [decision] Decentralized ID assignment via query max+1 #protocol
- [insight] Templates critical for agent adoption of new structure #change-management

## Relations

- implements [[FEAT-002-feature-workflow]]
- satisfies [[REQ-001-agent-prompts-output-to-unified-structure]]
- derives_from [[ADR-001-feature-workflow]]
