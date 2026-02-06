---
title: ADR-001-feature-workflow
type: decision
permalink: decisions/adr-001-feature-workflow
tags:
  - architecture
  - features
  - artifacts
  - planner
  - spec-generator
  - traceability
---

# ADR-001: Unified Feature Artifact Structure Anchored to Architectural Decisions

## Status

**ACCEPTED** (2026-02-04)

**Review Round 3 (2026-02-04)**: 6-agent debate completed. P0 issues resolved through discussion. User approved.

## Context

We have two workflows creating similar artifacts in different locations:

1. **spec-generator** outputs to `specs/{spec}/[requirements|design|tasks]/` with REQ-NNN, DESIGN-NNN, TASK-NNN files
2. **planner + task-generator** outputs to `planning/` with PLAN-NNN, PRD-NNN files, and tasks embedded as observations

Both workflows ultimately feed into the implementer agent with the same information structured differently. This creates:

- Confusion about where to find feature artifacts
- No clear traceability from features to the ADR that spawned them
- Tasks sometimes as observations (not queryable) vs separate files (queryable)
- Duplicate concepts: PLAN vs DESIGN, PRD vs REQ

## Decision

Adopt a unified feature artifact structure that:

1. **Feature-centric directories**: `features/FEAT-NNN-{name}/` (not ADR-based)
2. **ADR/PRD references via frontmatter**: Features link to source docs through `source-refs` field (ADRs, PRDs, or Epics)
3. **Convergent naming**: REQ/DESIGN/TASK prefixes regardless of creation workflow
4. **Path validation**: Feature directory names must match `FEAT-\d{3}-[a-z0-9-]+` (max 50 chars)
5. **No backwards compatibility**: Clean break - new artifacts use unified structure only

### Directory Structure

```text
features/
  FEAT-001-multi-tool-installer/
    FEAT-001-multi-tool-installer.md     # Index with source-refs: [ADR-028]
    phase-1-core-tui.md
    phase-2-multi-tool.md
    requirements/
      REQ-001-tool-detection.md
    design/
      DESIGN-001-tui-flow.md
    tasks/
      TASK-001-implement-detection.md
```

### Entity Types

| Type        | Pattern               | Location                               |
| ----------- | --------------------- | -------------------------------------- |
| feature     | FEAT-NNN-{name}.md    | features/FEAT-NNN-{name}/              |
| phase       | phase-N-{name}.md     | features/FEAT-NNN-{name}/              |
| requirement | REQ-NNN-{topic}.md    | features/FEAT-NNN-{name}/requirements/ |
| design      | DESIGN-NNN-{topic}.md | features/FEAT-NNN-{name}/design/       |
| task        | TASK-NNN-{topic}.md   | features/FEAT-NNN-{name}/tasks/        |

### ID Assignment Protocol

**Subagent Responsibility**: The creating agent (planner, spec-generator, task-generator, explainer) is responsible for ID assignment:

1. Query existing entities of that type in the target location
2. Find the maximum existing NNN value
3. Assign next ID as max + 1
4. If no existing entities, start at 001

Example for task-generator creating a task:

```
1. Glob features/FEAT-001-*/tasks/TASK-*.md
2. Parse IDs: [001, 002, 005] -> max = 5
3. New task gets TASK-006
```

### Forward References and Traceability

**Forward References**: Use basic-memory's forward reference capability when creating artifacts before parent IDs exist:

1. Create requirement with `feature-ref: [[FEAT-001-multi-tool-installer]]` (wikilink)
2. Basic-memory auto-resolves when feature entity is created
3. After feature creation, update requirement frontmatter to include resolved `feature-ref: FEAT-001`

**Mandatory Relations**: ALL artifacts MUST include Relations section. Available relation types:

| Relation Type  | Use For                                       | Example                         |
| -------------- | --------------------------------------------- | ------------------------------- |
| `implements`   | Links to parent feature                       | `implements [[FEAT-001-name]]`  |
| `derives_from` | Links to source ADR/PRD/Epic                  | `derives_from [[ADR-001-name]]` |
| `satisfies`    | Task satisfies requirement                    | `satisfies [[REQ-001-name]]`    |
| `depends_on`   | Sequential dependency - should complete first | `depends_on [[TASK-002-name]]`  |
| `blocked_by`   | Hard blocker - CANNOT proceed until resolved  | `blocked_by [[TASK-001-name]]`  |
| `enables`      | Completing this enables another               | `enables [[TASK-003-name]]`     |
| `traces_to`    | Traceability link                             | `traces_to [[DESIGN-001-name]]` |

**Required Relations by Entity Type**:

| Entity Type     | REQUIRED Relations                                                                                                       | OPTIONAL Relations                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| **feature**     | `derives_from` (source ADR/PRD/Epic, or empty if none)                                                                   | `depends_on`, `enables` (other features)                |
| **requirement** | `implements` (parent feature)                                                                                            | `depends_on` (other requirements), `traces_to` (design) |
| **design**      | `implements` (parent feature), `satisfies` (requirements it addresses)                                                   | `traces_to` (other designs)                             |
| **task**        | `implements` (parent feature), `blocked_by` (preceding tasks, except TASK-001), `enables` (following tasks, except last) | `satisfies` (requirement), `traces_to` (design)         |

**Relation Validation Rules**:

- TASK-001 MUST NOT have `blocked_by` (it's the first task)
- The last task MUST NOT have `enables` (nothing follows it)
- Every task except first MUST have `blocked_by` pointing to lower-numbered task(s)
- Every task except last MUST have `enables` pointing to higher-numbered task(s)

**Task Sequencing** (REQUIRED for all tasks):

1. **Task numbers MUST match execution order**: TASK-001 executes first, TASK-002 executes second, etc.

   - When creating tasks, determine the complete execution order FIRST, then assign sequential numbers
   - Task numbers are NOT arbitrary identifiers - they indicate execution sequence
   - A lower-numbered task MUST NEVER be blocked by a higher-numbered task
   - TASK-001 has no `blocked_by` (it's first), TASK-NNN is `blocked_by` TASK-(N-1)

1. **Sequencing relations document the dependency graph**:

   - Every task (except first) SHOULD have `blocked_by` relation to the immediately preceding task(s)
   - Every task (except last) SHOULD have `enables` relation to the immediately following task(s)
   - Relations reinforce the numbering but are SECONDARY to the number sequence

1. **Sequential numbering principle**:

   - TASK-001 -> TASK-002 -> TASK-003 -> ... (reading order = execution order)
   - Parallel tasks (no dependencies between them) still get sequential numbers
   - If TASK-003 and TASK-004 can run in parallel, neither blocks the other, but both are blocked_by TASK-002

```markdown
## Relations

- implements [[FEAT-001-multi-tool-installer]]
- derives_from [[ADR-028-multi-ide-installation]]
- satisfies [[REQ-001-tool-detection]]
- blocked_by [[TASK-005-memory-skill-mapping]]
- enables [[TASK-002-spec-generator-update]]
```

### Status Management

**Status Frontmatter**: Every entity MUST have a `status` field:

| Entity      | Valid Statuses                          |
| ----------- | --------------------------------------- |
| feature     | draft, in-progress, complete, abandoned |
| requirement | draft, approved, implemented, deferred  |
| design      | draft, approved, implemented            |
| task        | todo, in-progress, done, blocked        |

**Status Transition Protocol**:

1. When status changes, update the entity's frontmatter `status` field
2. Update ALL documents that reference this entity's status
3. Cascade checks: blocked tasks may unblock when dependency completes

Example: When TASK-001 moves to `done`:

```yaml
# In TASK-001.md frontmatter
status: done # Updated from in-progress

# In FEAT-001.md, update task reference if status is tracked
```

### Workflow Convergence

**Two Source Workflows Map to Same Structure**:

| Workflow  | Source Doc                           | Creates                          |
| --------- | ------------------------------------ | -------------------------------- |
| ADR Flow  | decisions/ADR-NNN.md                 | FEATURE -> REQ -> DESIGN -> TASK |
| PRD Flow  | planning/PRD-NNN.md (from explainer) | FEATURE -> REQ -> DESIGN -> TASK |
| Epic Flow | roadmap/EPIC-NNN.md                  | FEATURE -> REQ -> DESIGN -> TASK |

**ADR Flow** (adr-generator -> planner -> spec-generator -> task-generator):

- ADR spawns strategic features requiring architectural decisions
- `source-refs: [ADR-028]`

**PRD Flow** (roadmap -> explainer -> task-generator):

- Epic spawns PRD which spawns tactical features
- `source-refs: [PRD-001]` or `source-refs: [EPIC-001, PRD-001]`

**Features Without Source Doc**:

- Bug fixes, minor enhancements: `source-refs: []`
- Still uses full directory structure for traceability

### Required Sections by Entity Type

**COMMON (all entities)**:

- [requirement] Frontmatter (title, type, status, permalink) #required-section
- [requirement] Overview/Summary (1-2 paragraphs)
- [requirement] Observations section (categorized facts)
- [requirement] Relations section (links to related entities)

**FEATURE-specific**:

- [requirement] Context (why this feature exists)
- [requirement] Scope (what's in/out)
- [requirement] Success Criteria (measurable outcomes)
- [requirement] Phases (if multi-phase implementation)
- [requirement] Effort Summary (total time if done entirely by human, total time if done entirely by AI)

**REQUIREMENT-specific**:

- [requirement] Requirement Statement (EARS format if from spec-generator, prose if from explainer)
- [requirement] Acceptance Criteria
- [requirement] Dependencies

**DESIGN-specific**:

- [requirement] Technical Approach
- [requirement] Interfaces/APIs (if applicable)
- [requirement] Trade-offs Considered

**TASK-specific**:

- [requirement] Description (what to do)
- [requirement] Definition of Done #validation
- [requirement] Estimated Effort #planning
- [requirement] Dependencies (blocking tasks) #blocking-task

### Frontmatter Schema

**Feature Entity**:

```yaml
---
title: FEAT-001-multi-tool-installer # REQUIRED
type: feature # REQUIRED
status: draft|in-progress|complete # REQUIRED
permalink: features/FEAT-001/index # REQUIRED (auto-generated)
source-refs: [ADR-028] # REQUIRED (empty array if none)
priority: critical|high|medium|low # OPTIONAL (default: medium)
created-by: planner|spec-generator # REQUIRED (provenance)
tags: [feature, ...] # OPTIONAL
---
```

**Requirement Entity**:

```yaml
---
title: REQ-001 Tool Detection # REQUIRED
type: requirement # REQUIRED
status: draft|approved|implemented # REQUIRED
feature-ref: FEAT-001 # REQUIRED (parent feature)
ears-format: true|false # OPTIONAL (spec-generator sets true)
priority: must|should|could|wont # OPTIONAL (MoSCoW)
---
```

**Design Entity**:

```yaml
---
title: DESIGN-001 TUI Flow # REQUIRED
type: design # REQUIRED
status: draft|approved|implemented # REQUIRED
feature-ref: FEAT-001 # REQUIRED
req-refs: [REQ-001, REQ-002] # OPTIONAL (traced requirements)
---
```

**Task Entity**:

```yaml
---
title: TASK-001 Implement Detection # REQUIRED
type: task # REQUIRED
status: todo|in-progress|done|blocked # REQUIRED
feature-ref: FEAT-001 # REQUIRED
req-ref: REQ-001 # OPTIONAL (source requirement)
design-ref: DESIGN-001 # OPTIONAL (implementing design)
effort-estimate-human: Xh # OPTIONAL (human doing work)
effort-estimate-ai: Xh # OPTIONAL (AI doing work)
assigned-to: agent-name # OPTIONAL
blocked-by: [TASK-002] # OPTIONAL (dependency)
---
```

### Key Principles

1. **Source doc anchors features** - ADR, PRD, or Epic spawns the feature
2. **FEAT-NNN-{name}.md** as the feature entity (descriptive filename, not generic index.md)
3. **Convergent naming** - REQ/DESIGN/TASK prefixes regardless of workflow
4. **Tasks ALWAYS separate files** - Never observations, always queryable
5. **Status is authoritative** - Frontmatter status is source of truth
6. **Relations are mandatory** - Every artifact links to parents and siblings

### Entity Type Mapping Updates

| Entity Type | New Location                                     | Created By                       |
| ----------- | ------------------------------------------------ | -------------------------------- |
| feature     | features/FEAT-NNN-{name}/FEAT-NNN-{name}.md      | planner OR explainer             |
| requirement | features/FEAT-NNN-{name}/requirements/REQ-NNN.md | spec-generator OR explainer      |
| design      | features/FEAT-NNN-{name}/design/DESIGN-NNN.md    | spec-generator OR planner        |
| task        | features/FEAT-NNN-{name}/tasks/TASK-NNN.md       | spec-generator OR task-generator |
| epic        | roadmap/EPIC-NNN.md                              | roadmap agent (unchanged)        |
| prd         | planning/PRD-NNN.md                              | explainer agent (unchanged)      |
| decision    | decisions/ADR-NNN.md                             | adr-generator (unchanged)        |

### Workflow Field Governance

**Common Fields** (REQUIRED for all workflows):

- title, type, status, permalink
- feature-ref (for child entities)
- Relations section

**Workflow-Specific Fields** (OPTIONAL, set by creating workflow):

| Field                 | Set By                 | Purpose                                  |
| --------------------- | ---------------------- | ---------------------------------------- |
| ears-format           | spec-generator         | Indicates formal EARS requirement format |
| effort-estimate-human | planner/task-generator | Human time estimate                      |
| effort-estimate-ai    | planner/task-generator | AI time estimate                         |
| milestone             | planner                | Phase grouping                           |
| priority (MoSCoW)     | spec-generator         | must/should/could/wont                   |
| impact-analysis       | planner                | Risk/effort/value assessment             |

**Governance Rule**: Workflow-specific fields are informational. Core fields (status, refs, relations) are authoritative and must always be present.

## Consequences

### Good

- [benefit] Single location for all feature artifacts
- [benefit] Clear traceability: Source Doc (ADR/PRD/Epic) -> FEATURE -> REQ/DESIGN -> TASK
- [benefit] Tasks always queryable as first-class entities
- [benefit] Reduced cognitive load - one structure to learn
- [benefit] Convergent output enables workflow flexibility
- [benefit] Both ADR and PRD flows produce identical artifact structure
- [benefit] Status management ensures artifacts stay synchronized
- [benefit] Forward references enable natural creation order

### Bad

- [disadvantage] Agent prompts need updates (planner, spec-generator, task-generator, explainer)
- [disadvantage] Memory skill entity mapping needs update
- [consideration] No migration path for existing artifacts (clean break)

### Neutral

- [impact] EPICs remain in roadmap/ (can span multiple ADRs/features)
- [impact] PRDs remain in planning/ (source doc, not migrated)
- [impact] Decisions remain in decisions/ (source of truth)

## Observations

- [decision] Feature-centric directory structure with source-refs frontmatter #architecture
- [decision] FEATURE entity type replaces PLAN/PRD ambiguity #naming
- [decision] Tasks always separate files, never observations #queryability
- [decision] Subagents responsible for ID assignment (query max + 1) #delegation
- [decision] Forward references via wikilinks for pre-creation linking #basic-memory
- [decision] No backwards compatibility - clean break for new artifacts #migration
- [decision] Status frontmatter is authoritative, must cascade updates #status
- [decision] PRD flow (roadmap->explainer->task-generator) maps to same structure as ADR flow #convergence
- [constraint] Both workflows must output to same structure #convergence
- [constraint] All artifacts MUST have Relations section for traceability #traceability
- [rationale] Implementer doesn't care which workflow created artifacts #simplicity
- [rationale] Subagents already have context to query and increment IDs #delegation
- [insight] Planner milestones map to DESIGN, not separate concept #mapping
- [insight] Basic-memory forward references solve chicken-egg problem #resolution

## Relations

- implements [[ADR-028-multi-ide-installation-brain-cli]]
- extends [[Memory Skill Entity Mapping]]
- supersedes [[Dual Artifact Structure Pattern]]
- affects [[Planner Agent]]
- affects [[Spec-Generator Agent]]
- affects [[Task-Generator Agent]]
- affects [[Explainer Agent]]
- affects [[Roadmap Agent]]
- integrates_with [[Basic-Memory Forward References]]

## Security Considerations

- [security] Path validation prevents traversal attacks via regex `FEAT-\d{3}-[a-z0-9-]+` #mitigation
- [security] Maximum 50 character limit on directory names prevents buffer issues #mitigation
- [security] No path separators (/, \) allowed in feature names #mitigation
- [security] Secret detection delegated to existing pre-commit hooks #integration

## Reversibility

- [reversibility] LOW RISK - Frontmatter-based linking allows rollback without file moves #assessment
- [reversibility] Existing artifacts unchanged until explicitly migrated #gradual
- [reversibility] Feature directories can be flattened back if structure proves unwieldy #escape-hatch

## Review History

- [review] 2026-02-02: Round 2 - 6-agent debate completed #process
- [review] Round 2 Verdict: NEEDS-REVISION (4 ACCEPT, 2 NEEDS-REVISION) #outcome
- [review] Round 2 P0 issues: ID assignment, forward refs, status mgmt, workflow divergence #identified
- [review] 2026-02-04: Round 3 - P0 issues resolved through discussion #process
- [review] Round 3 Resolution: Subagent ID assignment, basic-memory forward refs #resolved
- [review] Round 3 Resolution: Status transitions with cascade updates #resolved
- [review] Round 3 Resolution: PRD/Epic flow integration, required sections defined #resolved
- [review] Round 3 Resolution: No backwards compatibility - clean break #resolved
- [review] Round 3 Verdict: PROPOSED - Ready for final approval #outcome
