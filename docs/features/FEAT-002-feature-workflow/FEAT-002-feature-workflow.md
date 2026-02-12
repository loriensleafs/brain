---
title: FEAT-002-feature-workflow
type: feature
status: draft
permalink: features/feat-002-feature-workflow/feat-002-feature-workflow
source-refs:
- ADR-001
priority: high
created-by: planner
tags:
- feature
- architecture
- artifacts
- unified-structure
- implementation
---

# FEAT-002: Feature Workflow Implementation

## Context

ADR-001 (Unified Feature Artifact Structure Anchored to Architectural Decisions) has been ACCEPTED and defines a new organizational paradigm for feature artifacts across the brain system. This feature implements that decision by:

1. **Unifying artifact location**: Features now reside in `features/FEAT-NNN-{name}/` instead of being scattered across `specs/` and `planning/`
2. **Establishing convergent naming**: All artifacts use REQ/DESIGN/TASK prefixes regardless of which workflow created them
3. **Creating traceability anchors**: Features link to source documents (ADRs, PRDs, Epics) via `source-refs` frontmatter
4. **Enabling proper status management**: Frontmatter-based status is authoritative and must cascade

## Scope

**IN SCOPE**:
- Update agent prompts (planner, spec-generator, task-generator, explainer) to follow ADR-001 structure
- Update memory skill entity mapping to recognize new artifact locations
- Create template/example files showing the unified structure
- Implement ID assignment protocol (query max + 1)
- Implement forward reference resolution for entities created before parent IDs exist

**OUT OF SCOPE**:
- Migrating existing artifacts from old locations (clean break)
- Changing ADR/PRD/EPIC storage locations (they remain source documents)
- Implementing status cascade automation (manual cascade in this phase)

## Success Criteria

1. All agent prompts emit artifacts to `features/FEAT-NNN-{name}/` with correct subdirectories
2. Every artifact includes mandatory Relations section with parent/source references
3. ID assignment protocol is implemented and tested (query existing, assign max+1)
4. Forward references work correctly for pre-creation linking
5. Status frontmatter is consistent across all artifacts
6. Example/template files demonstrate correct structure
7. No backwards compatibility - new artifacts use unified structure only

## Phases

### Phase 1: Foundation (TASK-001, TASK-002)
- Create example/template files demonstrating correct structure
- Update memory skill entity mapping for new locations

### Phase 2: Agent Prompt Updates (TASK-003 through TASK-006)
- Update planner agent prompt to output features following ADR-001
- Update spec-generator agent prompt with unified naming
- Update task-generator agent prompt with unified paths
- Update explainer agent prompt for PRD to FEATURE flow

### Phase 3: Cleanup (TASK-007)
- Rename existing files to kebab-case convention

## Effort Summary

| If done by | Total Time |
|------------|------------|
| **Human** | 19h |
| **AI** | ~5h |

## Task Execution Order

| Order | Task | Rationale |
|-------|------|-----------|
| 1 | TASK-001: Templates | Create examples first to guide agent prompt updates |
| 2 | TASK-002: Memory Skill | Update entity mapping so agents can query existing artifacts |
| 3 | TASK-003: Planner | Primary FEAT creator - depends on templates and memory skill |
| 4 | TASK-004: Spec-Generator | Creates REQ/DESIGN/TASK - needs planner pattern |
| 5 | TASK-005: Task-Generator | Creates TASK files - follows spec-generator pattern |
| 6 | TASK-006: Explainer | PRD flow - adapts planner pattern for PRD source |
| 7 | TASK-007: Kebab-Case | Rename files to follow naming convention |

## Observations

- [architecture] ADR-001 defines feature-centric directory structure replacing scattered specs/ and planning/ locations #structure
- [decision] Clean break - no backwards compatibility, new artifacts only #migration
- [decision] Task numbers match execution order per ADR-001 sequencing rules #sequencing
- [decision] Dual time estimates: human vs AI effort tracked separately #estimation
- [fact] Four agents need prompt updates for full convergence: planner, spec-generator, task-generator, explainer #scope
- [constraint] ADR/PRD/EPIC locations unchanged (remain source documents) #boundaries
- [insight] Templates and examples are critical for adoption by agents #change-management
- [architecture] Frontmatter-based traceability replaces implicit organizational patterns #metadata
- [insight] Feature IDs start at 001 and increment per location, not globally #numbering

## Relations

- implements [[ADR-001-feature-workflow]]
- derives_from [[ADR-001-feature-workflow]]
- contains [[REQ-001-agent-prompts-output-to-unified-structure]]
- contains [[REQ-002-mandatory-relations-section]]
- contains [[REQ-003-status-frontmatter-consistency]]
- contains [[REQ-004-subagent-id-assignment-protocol]]
- contains [[REQ-005-kebab-case-filename-convention]]
