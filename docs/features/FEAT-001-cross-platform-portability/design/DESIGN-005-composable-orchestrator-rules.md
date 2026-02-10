---
title: DESIGN-005-composable-orchestrator-rules
type: note
permalink: features/feat-001-cross-platform-portability/design/design-005-composable-orchestrator-rules
tags:
- design
- orchestrator
- composable-rules
- architecture
- cross-platform
---

# DESIGN-005 Composable Orchestrator Rules

## Summary

A composable rules directory structure that eliminates duplication between tool-specific orchestrator variants. Shared rules use **template variables** for terminology differences and live in individual files within a `rules/` directory. Tool-specific sections that cannot be expressed as variable substitution live in variant directories. A build step compiles them into final output files.

**Revision note**: Updated after reviewing ANALYSIS-015 and ANALYSIS-016. The template variable approach (identified by the comparator) reduces the number of override files from ~20 to ~5-6, since most "similar" sections differ only in terminology substitution ({worker}, {delegate_cmd}, {sequence_model}, etc.).

## Problem Statement

The orchestrator agent exists in two variants:

- `orchestrator.md` (Claude Code Agent Teams): ~2,300 lines, uses Teammate/TaskCreate/SendMessage
- `_orchestrator.md` (generic/Cursor Task tool): ~2,150 lines, uses Task tool hub-and-spoke

Both share approximately 70-80% of content: style guide, triage tables, memory protocol, execution protocol, task classification, routing algorithms, ideation workflows, retrospective workflows, etc. Maintaining two monolithic files causes drift, duplication, and merge conflicts.

The same pattern applies to `AGENTS.md` / `_AGENTS.md` and `bootstrap.md` / `_bootstrap.md`.

## Design: Composable Rules Directory

### Inspiration

Follows the Vercel/cursor.directory pattern: individual rule files in a rules directory, composed into final output by a build step. Each rule file is self-contained and independently maintainable.

### Directory Structure

```text
apps/claude-plugin/
  rules/
    orchestrator/
      _order.yaml              # Composition order manifest
      00-style-guide.md        # Style Guide Compliance
      01-core-identity.md      # Core Identity (shared base)
      02-activation-profile.md # Activation Profile
      03-triage.md             # First Step: Triage Before Orchestrating
      04-reliability.md        # Reliability Principles
      05-execution-style.md    # Execution Style
      06-memory-protocol.md    # Memory Protocol
      07-execution-protocol.md # Execution Protocol
      08-task-classification.md # Task Classification
      09-delegation-plan.md    # Delegation Plan
      10-routing-algorithm.md  # Routing Algorithm
      11-consistency-validation.md # Consistency Validation
      12-pre-pr-validation.md  # Pre-PR Validation Summary
      13-ideation-workflow.md  # Ideation Workflow
      14-retrospective.md     # Post-Retrospective Workflow
      15-todo-management.md    # TODO Management
      16-session-continuity.md # Session Continuity
      17-failure-recovery.md   # Failure Recovery
      18-completion-criteria.md # Completion Criteria
      19-session-end-gate.md   # Session End Gate
      20-content-attribution.md # Content Attribution Constraints
      21-output-format.md      # Output Format

    orchestrator/variants/
      agent-teams/
        _frontmatter.yaml      # Claude Code Agent Teams frontmatter
        01-core-identity.md    # Override: adds team lead language
        04-architecture.md     # Agent Teams architecture constraint
        05-tools.md            # Teammate, TaskCreate, SendMessage, etc.
        06-team-lifecycle.md   # Team Lifecycle (spawn, monitor, shutdown)
        07-plan-approval.md    # Plan Approval Mode
        08-task-dependencies.md # Task Dependency Patterns
        09-swarming.md         # Same-Type Teammate Swarming
        10-communication.md    # Inter-Agent Communication Patterns
        11-capability-matrix.md # Teammate Capability Matrix
        12-scenarios.md        # Expected Orchestration Scenarios
        13-handoff.md          # Handoff: [Topic] template
      generic/
        _frontmatter.yaml      # Generic/Cursor frontmatter (Task tool)
        01-core-identity.md    # Override: root agent language
        04-architecture.md     # One-level delegation constraint
        05-tools.md            # Task, TodoWrite
        06-sub-agent-delegation.md # Sub-Agent Delegation patterns
        07-capability-matrix.md # Agent Capability Matrix
        08-scenarios.md        # Expected Orchestration Scenarios
        09-handoff-protocol.md # Handoff Protocol
        10-output-directory.md # Output Directory
        11-handoff.md          # Handoff: [Topic] template

    agents-md/
      _order.yaml              # Composition order for AGENTS.md
      00-identity.md           # YOU ARE THE ... header
      01-required-reading.md   # Required Reading
      02-initialization.md     # BLOCKING GATE: Initialization
      03-session-protocol.md   # BLOCKING GATE: Session Protocol
      04-commands.md           # Commands
      05-boundaries.md         # Boundaries and Constraints
      06-agent-catalog.md      # Agent/Teammate Catalog
      07-adr-review.md         # ADR Review Requirement
      08-output-paths.md       # Output Paths
      09-task-classification.md # Task Classification and Routing
      10-workflow-patterns.md  # Workflow Patterns
      11-memory-architecture.md # Memory Architecture
      12-memory-first-gate.md  # Memory-First Gate
      13-brain-mcp-reference.md # Brain MCP Reference
      14-anti-patterns.md      # Anti-Patterns
      15-communication.md      # Communication Standards
      16-self-improvement.md   # Self-Improvement
      17-utilities.md          # Utilities
      18-key-documents.md      # Key Documents
      19-responsibilities.md   # Your Responsibilities

    agents-md/variants/
      agent-teams/
        _frontmatter.yaml      # No YAML frontmatter for AGENTS.md
        00-identity.md         # Override: team lead identity
        01-prerequisites.md    # Agent Teams prerequisites
        02-team-lead-tools.md  # Team Lead Tools table
        03-memory-ops.md       # Memory Operations in Agent Teams
        04-execution-model.md  # Agent Teams execution model
        05-typical-workflow.md # Agent Teams typical workflow
        06-session-resumption.md # Session Resumption Warning
        07-team-management.md  # Team Management commands
        08-agent-catalog.md    # Teammate Catalog (teammate language)
        09-spawn-template.md   # Spawn Prompt Template
        10-workflow-patterns.md # Task dependency patterns
        11-debate-pattern.md   # Debate / Challenge Pattern
        12-agent-teams-reference.md # Agent Teams Quick Reference
        13-responsibilities.md # Team lead responsibilities
      generic/
        _frontmatter.yaml
        00-identity.md         # Override: orchestrator identity
        01-memory-delegation.md # Orchestrator Memory Delegation
        02-execution-model.md  # Wave-based execution model
        03-typical-workflow.md # Wave-based typical workflow
        04-agent-catalog.md    # Agent Catalog (subagent language)
        05-workflow-patterns.md # Wave-based patterns
        06-responsibilities.md # Orchestrator responsibilities

    bootstrap/
      _order.yaml
      00-base.md               # Shared bootstrap content
    bootstrap/variants/
      agent-teams/
        _frontmatter.yaml
        00-override.md         # Agent Teams bootstrap additions
      generic/
        _frontmatter.yaml
        00-override.md         # Generic bootstrap additions
```

### Composition Order Manifest (_order.yaml)

```yaml
# rules/orchestrator/_order.yaml
name: orchestrator
description: Composable rules for the orchestrator agent
default_variant: agent-teams

# Composition order: shared rules in sequence
rules:
  - 00-style-guide
  - 01-core-identity        # Can be overridden by variant
  - 02-activation-profile
  - 03-triage
  - VARIANT_INSERT           # Variant-specific rules inject here
  - 04-reliability
  - 05-execution-style
  - 06-memory-protocol
  - 07-execution-protocol
  - 08-task-classification
  - 09-delegation-plan
  - 10-routing-algorithm
  - 11-consistency-validation
  - 12-pre-pr-validation
  - 13-ideation-workflow
  - 14-retrospective
  - 15-todo-management
  - 16-session-continuity
  - 17-failure-recovery
  - 18-completion-criteria
  - 19-session-end-gate
  - 20-content-attribution
  - 21-output-format

# Variant directories provide overrides and insertions
variants:
  agent-teams:
    frontmatter: _frontmatter.yaml
    overrides:
      01-core-identity: 01-core-identity   # Replaces shared version
    inserts_at_VARIANT_INSERT:
      - 04-architecture
      - 05-tools
      - 06-team-lifecycle
      - 07-plan-approval
      - 08-task-dependencies
      - 09-swarming
      - 10-communication
      - 11-capability-matrix
      - 12-scenarios
      - 13-handoff
  generic:
    frontmatter: _frontmatter.yaml
    overrides:
      01-core-identity: 01-core-identity
    inserts_at_VARIANT_INSERT:
      - 04-architecture
      - 05-tools
      - 06-sub-agent-delegation
      - 07-capability-matrix
      - 08-scenarios
      - 09-handoff-protocol
      - 10-output-directory
      - 11-handoff
```

### Build Step

A build script (TypeScript, since this is a Bun/TS monorepo) reads the `_order.yaml`, loads shared rules, applies variant overrides and insertions, generates frontmatter from `_frontmatter.yaml`, and produces the final compiled `.md` file.

```text
Input:  rules/orchestrator/_order.yaml + rules + variants
Output: agents/orchestrator.md          (agent-teams variant)
        _orchestrator.md                (generic variant)
```

The build script would:

1. Parse `_order.yaml` for the composition sequence
2. For each variant:
   a. Start with generated frontmatter from `_frontmatter.yaml`
   b. Walk the rule sequence in order
   c. For each rule: check if variant has an override file; if so use variant version, otherwise use shared version
   d. At `VARIANT_INSERT` marker: inject all variant-specific insert files in their numbered order
   e. Concatenate all sections with `---` separators (or plain newlines)
   f. Write final output file

### Frontmatter Generation (_frontmatter.yaml)

```yaml
# rules/orchestrator/variants/agent-teams/_frontmatter.yaml
name: orchestrator
description: >-
  Enterprise task orchestrator who autonomously coordinates specialized
  agent teammates end-to-end via Claude Code Agent Teams.
  Classifies complexity, triages delegation, and sequences workflows
  using shared task lists and inter-agent messaging.
model: claude-opus-4-6[1m]
memory: ~/.agents/agent-memory/orchestrator
color: "#FF6B35"
argument-hint: Describe the task or problem to solve end-to-end
tools:
  - Teammate
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
  - SendMessage
  - TodoWrite
  - mcp__plugin_brain_brain__bootstrap_context
  - mcp__plugin_brain_brain__search
  - mcp__plugin_brain_brain__read_note
  - mcp__plugin_brain_brain__write_note
  - mcp__plugin_brain_brain__edit_note
skills:
  - memory
  - task-classification
  - domain-identification
  - agent-routing
  - workflow-sequencing
  - impact-analysis-orchestration
  - disagree-and-commit-protocol
```

### File Naming Convention

- Shared rules: `NN-kebab-case-topic.md` (numbered for deterministic ordering)
- Variant overrides: same filename as shared rule they replace
- Variant inserts: numbered within the variant directory
- Manifests: `_order.yaml` (underscore prefix = config, not rule content)
- Frontmatter: `_frontmatter.yaml`

### Composition Rules

1. **Override**: If variant directory has a file matching a shared rule name, the variant version replaces it entirely
2. **Insert**: Variant-specific rules inject at the `VARIANT_INSERT` marker in the order sequence
3. **Frontmatter**: Generated from variant's `_frontmatter.yaml`, not composed from rules
4. **No partial merge**: A rule file is atomic. You override the whole file or use the shared version. No line-level merging.

## Applicability to Other Agents

### Which Agents Need Composable Rules?

Only agents with tool-specific variants:

| Agent | Needs Composable? | Reason |
|:--|:--|:--|
| orchestrator | Yes | Agent Teams vs Task tool delegation model |
| AGENTS.md (instructions) | Yes | Team lead vs orchestrator framing, tool tables |
| bootstrap (command) | Yes | Initialization differs per tool |
| analyst, architect, etc. | No | Body content is portable; only frontmatter differs |

For portable specialist agents, the build step only needs to swap frontmatter. No rules/ directory needed. The existing approach of one file per agent with frontmatter adaptation in brain.config.json handles this.

### Future Extensibility

If a new tool (e.g., Windsurf) needs a third variant, add a new variant directory under `variants/windsurf/` with its overrides and inserts. Shared rules remain untouched.

## Integration with brain.config.json

```json
{
  "agents": {
    "orchestrator": {
      "source": "rules/orchestrator",
      "variants": {
        "claude-code": "agent-teams",
        "cursor": "generic"
      },
      "outputs": {
        "claude-code": "agents/orchestrator.md",
        "cursor": "_orchestrator.md"
      }
    }
  }
}
```

The build step reads this config to know which variants to compile and where to output them.

## Trade-offs

| Choice | Pro | Con |
|:--|:--|:--|
| Individual rule files | Single-responsibility, easy to diff, prevents merge conflicts | More files to navigate |
| YAML manifest | Explicit ordering, declarative | Another config format to maintain |
| Full-file override (no partial merge) | Predictable, simple composition | Override file must duplicate unchanged parts of that section |
| Numbered prefixes | Deterministic ordering without manifest dependency | Renumbering on insert |
| `VARIANT_INSERT` marker | Clear injection point for tool-specific content | Only one injection point per agent |

### Decision: Single VARIANT_INSERT vs Multiple

One injection point is sufficient. The tool-specific sections (architecture, tools, delegation patterns) form a contiguous block that naturally sits between the triage/identity sections and the shared protocol sections. If a second injection point becomes necessary, the manifest can support `VARIANT_INSERT_2` etc.

## Observations

- [decision] Composable rules directory with variant overrides and template variable substitution selected over monolithic duplication #architecture
- [decision] Full-file override model (no line-level merge) for structurally unique sections #composition
- [decision] YAML manifest controls composition order with numbered file fallback #ordering
- [decision] Template variables handle 12 of 45 sections that differ only in terminology (worker, delegate_cmd, sequence_model, etc.) #template-variables
- [fact] Only orchestrator, AGENTS.md, and bootstrap need composable rules; specialist agents are portable #scope
- [insight] The Vercel/cursor.directory pattern of individual rule files maps well to agent section decomposition #inspiration
- [insight] Template variable substitution reduces override files by 28%, from 46 to 33 total files #simplification
- [constraint] Build step required to compile rules into final agent files #build
- [fact] Shared content is approximately 70% by section count, rising to 85% with template variable substitution #duplication-ratio
- [decision] Single VARIANT_INSERT injection point sufficient for current needs #simplicity

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- extends [[DESIGN-004 Orchestrator Strategy]]
- satisfies [[REQ-005 Orchestrator Portability]]
- depends_on [[ANALYSIS-014 Orchestrator Comparison]]
- relates_to [[ADR-002 Cross-Platform Plugin Architecture]]

## Composition Rules

1. **Template variable substitution**: Shared rules use `{variable_name}` placeholders. The build step replaces them with variant-specific values from `_variables.yaml`. This handles the ~85% of content that differs only in terminology.
2. **Override**: If variant directory has a file matching a shared rule name, the variant version replaces it entirely. Reserved for sections where the structure (not just terminology) differs.
3. **Insert**: Variant-specific rules inject at the `VARIANT_INSERT` marker in the order sequence. Used for sections that exist in only one variant.
4. **Frontmatter**: Generated from variant's `_frontmatter.yaml`, not composed from rules.
5. **No partial merge**: A rule file is atomic. You override the whole file or use the shared version (with variable substitution). No line-level merging.

## Template Variable System

### The Key Insight

ANALYSIS-015 found that 12 of 45 sections are "SIMILAR" -- same structure and intent, differing only in terminology. Instead of maintaining separate override files for these, a single shared template with variable substitution handles them all.

### Variable Definitions (_variables.yaml)

```yaml
# rules/orchestrator/variants/agent-teams/_variables.yaml
worker: teammate
worker_plural: teammates
worker_type: teammate type
lead_role: Team Lead
lead_role_caps: TEAM LEAD
delegate_cmd: "Task(team_name=\"...\", name=\"...\", subagent_type=\"...\", prompt=\"...\")"
create_work: "TaskCreate(subject=\"...\", depends_on=[...])"
sequence_model: task dependencies (automatic)
sequence_noun: dependency chain
parallel_model: Shared task list with dependency-based unblocking
send_context: "SendMessage / Teammate(operation=\"write\")"
delegation_verb: spawning
delegation_noun: spawn
planning_unit: task dependency graph
workflow_unit: task
arch_role: "the **team lead**"
shutdown_note: "Shut down all teammates and clean up team before session end."
```

```yaml
# rules/orchestrator/variants/generic/_variables.yaml
worker: agent
worker_plural: agents
worker_type: agent type
lead_role: ROOT agent
lead_role_caps: ROOT AGENT
delegate_cmd: "Task(subagent_type=\"...\", prompt=\"...\")"
create_work: "(implicit in Task prompt)"
sequence_model: waves (manual)
sequence_noun: wave sequence
parallel_model: Multiple Task calls in single message
send_context: "(included in Task prompt)"
delegation_verb: delegating
delegation_noun: delegation
planning_unit: parallel wave plan
workflow_unit: wave
arch_role: "the **root agent**"
shutdown_note: ""
```

### Usage in Shared Rules

```markdown
## Core Identity

**Enterprise Task Orchestrator ({lead_role})** that autonomously solves problems
end-to-end by coordinating specialized {worker_plural}. You are {arch_role},
NOT an implementer.

**PLANNING MANDATE**: Before {delegation_verb} {worker_plural}, produce an explicit
{planning_unit}. Identify all work items. A plan with 5 sequential
{workflow_unit}s and 0 parallelism is almost certainly wrong.
```

### What Template Variables Handle (12 SIMILAR sections)

| Section | Variables Used |
|:--|:--|
| Core Identity | `{lead_role}`, `{worker_plural}`, `{arch_role}`, `{delegation_verb}`, `{planning_unit}` |
| Activation Profile | `{worker}`, `{lead_role}` |
| First Step: Triage | `{worker_plural}`, `{worker}` |
| Reliability Principles | `{sequence_model}`, `{delegation_verb}` |
| Execution Style | `{delegation_verb}`, `{planning_unit}`, `{worker_plural}` |
| Complexity Assessment | `{worker}`, `{worker_type}` |
| Same-Type Swarming | `{worker}`, `{worker_plural}`, `{delegate_cmd}` |
| Delegation Planning | `{planning_unit}`, `{sequence_noun}` |
| Workflow Patterns | `{sequence_model}`, `{worker}`, `{worker_plural}` |
| Disagree and Commit | `{worker_plural}`, `{send_context}` |
| TODO Management | `{worker_plural}`, `{create_work}` |
| Responsibilities | `{worker}`, `{delegate_cmd}`, `{delegation_verb}` |

### What Still Requires Full Override Files (8 TOOL-SPECIFIC sections)

These sections are structurally unique to one variant and cannot be expressed as variable substitution:

| Section | Variant | Reason |
|:--|:--|:--|
| Architecture Constraint | Both (different diagrams and prose) | Entirely different architecture models |
| Tools list | Both (different tool sets) | Different tool names and APIs |
| Team Lifecycle / Sub-Agent Delegation | Agent-Teams / Generic | Fundamentally different delegation syntax and lifecycle |
| Plan Approval Mode | Agent-Teams only | No equivalent in generic |
| Task Dependency Patterns | Agent-Teams only | Generic uses waves, not dependency graphs |
| Inter-Agent Communication | Agent-Teams only | No inter-subagent messaging in generic |
| Teammate/Agent Capability Matrix | Both (different columns) | Different column structure |
| Handoff Protocol / Output Directory | Generic only | No equivalent in Agent Teams |

### Impact on File Count

**Before template variables**: ~20 shared rule files + ~13 override files per variant = ~46 total files
**After template variables**: ~20 shared rule files + ~6 override files per variant + 1 variables file = ~33 total files

The template variable system eliminates ~28% of override files by absorbing terminology-only differences into the shared rules.

## Directory Structure

### Directory Structure

```text
apps/claude-plugin/
  rules/
    orchestrator/
      _order.yaml              # Composition order manifest
      00-style-guide.md        # Style Guide Compliance
      01-core-identity.md      # Core Identity (uses {lead_role}, {worker_plural}, etc.)
      02-activation-profile.md # Activation Profile (uses {worker})
      03-triage.md             # First Step: Triage (uses {worker_plural})
      04-reliability.md        # Reliability Principles (uses {sequence_model})
      05-execution-style.md    # Execution Style (uses {delegation_verb}, {planning_unit})
      06-memory-protocol.md    # Memory Protocol
      07-execution-protocol.md # Execution Protocol
      08-task-classification.md # Task Classification (uses {worker})
      09-delegation-plan.md    # Delegation Plan (uses {planning_unit})
      10-routing-algorithm.md  # Routing Algorithm
      11-swarming.md           # Same-Type Swarming (uses {worker}, {delegate_cmd})
      12-consistency-validation.md # Consistency Validation
      13-pre-pr-validation.md  # Pre-PR Validation Summary
      14-ideation-workflow.md  # Ideation Workflow
      15-retrospective.md     # Post-Retrospective Workflow
      16-todo-management.md    # TODO Management (uses {worker_plural}, {create_work})
      17-session-continuity.md # Session Continuity
      18-failure-recovery.md   # Failure Recovery
      19-completion-criteria.md # Completion Criteria
      20-content-attribution.md # Content Attribution Constraints
      21-output-format.md      # Output Format
      22-responsibilities.md   # Your Responsibilities (uses {worker}, {delegation_verb})

    orchestrator/variants/
      agent-teams/
        _frontmatter.yaml      # Claude Code Agent Teams frontmatter
        _variables.yaml        # Template variables: worker=teammate, etc.
        04-architecture.md     # Agent Teams architecture constraint (OVERRIDE)
        05-tools.md            # Teammate, TaskCreate, SendMessage, etc. (OVERRIDE)
        06-team-lifecycle.md   # Team Lifecycle (INSERT: spawn, monitor, shutdown)
        07-plan-approval.md    # Plan Approval Mode (INSERT)
        08-task-dependencies.md # Task Dependency Patterns (INSERT)
        09-communication.md    # Inter-Agent Communication Patterns (INSERT)
        10-capability-matrix.md # Teammate Capability Matrix (OVERRIDE)
        11-scenarios.md        # Expected Orchestration Scenarios (OVERRIDE)
      generic/
        _frontmatter.yaml      # Generic/Cursor frontmatter (Task tool)
        _variables.yaml        # Template variables: worker=agent, etc.
        04-architecture.md     # One-level delegation constraint (OVERRIDE)
        05-tools.md            # Task, TodoWrite (OVERRIDE)
        06-sub-agent-delegation.md # Sub-Agent Delegation patterns (INSERT)
        07-capability-matrix.md # Agent Capability Matrix (OVERRIDE)
        08-scenarios.md        # Expected Orchestration Scenarios (OVERRIDE)
        09-handoff-protocol.md # Handoff Protocol (INSERT)
        10-output-directory.md # Output Directory (INSERT)
```

Note: Files marked (OVERRIDE) replace the shared rule with the same number. Files marked (INSERT) are injected at the VARIANT_INSERT point. Shared rules use `{variable_name}` placeholders resolved from `_variables.yaml`.

## Build Step

### Build Step

A build script (TypeScript, since this is a Bun/TS monorepo) reads the `_order.yaml`, loads shared rules, applies template variable substitution from `_variables.yaml`, applies variant overrides and insertions, generates frontmatter from `_frontmatter.yaml`, and produces the final compiled `.md` file.

```text
Input:  rules/orchestrator/_order.yaml + rules + variants
Output: agents/orchestrator.md          (agent-teams variant)
        _orchestrator.md                (generic variant)
```

The build script would:

1. Parse `_order.yaml` for the composition sequence
2. For each variant:
   a. Load `_variables.yaml` into a key-value map
   b. Start with generated frontmatter from `_frontmatter.yaml`
   c. Walk the rule sequence in order
   d. For each rule: check if variant has an override file; if so use variant version, otherwise use shared version
   e. **Apply template variable substitution**: replace all `{variable_name}` placeholders with values from the variables map
   f. At `VARIANT_INSERT` marker: inject all variant-specific insert files in their numbered order (also with variable substitution)
   g. Concatenate all sections
   h. Write final output file

### Variable Substitution Order

Variables are substituted AFTER override resolution, so:

- Shared rules get variant-specific terminology via variables
- Override files can also use variables (for consistency)
- Insert files can use variables too

This means a shared rule like `01-core-identity.md` with `{lead_role}` becomes "Team Lead" for agent-teams and "ROOT agent" for generic, without needing separate override files.
