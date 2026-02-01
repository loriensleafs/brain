# Memory Governance Enforcement Design

**Date**: 2026-01-21
**Status**: Accepted
**ADR**: ADR-019

---

## Executive Summary

This design addresses governance debt from agents calling Brain MCP write tools directly without following conventions. The solution uses **validation-based governance**: all agents retain write access, but MUST complete pre-flight validation before any write operation. This approach is required by the one-level delegation architecture (subagents cannot delegate to other subagents).

---

## Problem Statement

**Current State (Audit 2026-01-21)**:

- 15+ agents have direct access to `write_note` and `edit_note`
- No validation before writes
- Observed violations: wrong folders, missing CAPS prefixes, no relations
- Session 06 established 11 folders and 13 entity types with naming conventions

**Architectural Constraint**:

- Agent system uses one-level delegation
- Subagents cannot delegate to other subagents
- When orchestrator delegates to analyst, analyst must write directly
- Any governance model requiring delegation to memory agent violates this constraint

**Impact**:

- Knowledge graph fragmentation
- Search reliability degradation
- Cross-session context loss
- Maintenance burden accumulation

---

## Design Decisions

### 1. Validation-Based Governance Model

```text
TIER 1: Read Operations (No Enforcement)
├── mcp__plugin_brain_brain__search
├── mcp__plugin_brain_brain__read_note
└── mcp__plugin_brain_brain__list_directory

TIER 2: Write Operations (Pre-Flight Validation REQUIRED)
├── mcp__plugin_brain_brain__write_note
└── mcp__plugin_brain_brain__edit_note
    └── ALL agents: Complete pre-flight validation checklist

TIER 3: Complex Operations (Consult Memory Skill)
├── Multi-note operations
├── Knowledge graph reorganization
└── Cross-domain relation management
    └── ALL agents: Reference memory skill for guidance
```

### 2. Agent Access Matrix (All Agents Write)

| Agent | Search | Read | Write | Edit | Requirement |
|-------|--------|------|-------|------|-------------|
| **All agents** | Yes | Yes | **Yes** | **Yes** | Pre-flight validation |

**No delegation required.** All agents write directly after completing validation.

### 3. Pre-Flight Validation (BLOCKING - All Agents)

Before ANY write operation, all agents MUST validate:

```markdown
### Pre-Flight Checklist (MUST all pass before write)

- [ ] Entity type valid (13 types only)
- [ ] Folder matches entity type
- [ ] File name follows CAPS prefix pattern
- [ ] Frontmatter complete (title, type, tags)
- [ ] Observations: 3-10 entries with categories
- [ ] Relations: 2-8 wikilinks
```

**Agents that skip validation create governance debt.** Post-hoc audit detects violations.

### 4. Memory Skill as Validator/Guide (Not Gatekeeper)

The memory skill provides:

- Entity type to folder mapping
- Naming convention patterns
- Quality threshold requirements
- Compliant note examples

**Role shift**: Memory skill is a validation guide, not an access controller.

---

## Entity Type Standards (Session 06)

| Entity Type | Folder | File Pattern | Example |
|-------------|--------|--------------|---------|
| decision | decisions/ | `ADR-{NNN}-{topic}.md` | `ADR-015-auth.md` |
| session | sessions/ | `SESSION-YYYY-MM-DD-NN-{topic}.md` | `SESSION-2026-01-20-06-memory.md` |
| requirement | specs/{spec}/requirements/ | `REQ-{NNN}-{topic}.md` | `REQ-001-login.md` |
| design | specs/{spec}/design/ | `DESIGN-{NNN}-{topic}.md` | `DESIGN-001-auth.md` |
| task | specs/{spec}/tasks/ | `TASK-{NNN}-{topic}.md` | `TASK-001-jwt.md` |
| analysis | analysis/ | `ANALYSIS-{NNN}-{topic}.md` | `ANALYSIS-001-memory.md` |
| feature | planning/ | `FEATURE-{NNN}-{topic}.md` | `FEATURE-001-oauth.md` |
| epic | roadmap/ | `EPIC-{NNN}-{name}.md` | `EPIC-001-auth.md` |
| critique | critique/ | `CRIT-{NNN}-{topic}.md` | `CRIT-001-plan.md` |
| test-report | qa/ | `QA-{NNN}-{topic}.md` | `QA-001-oauth.md` |
| security | security/ | `SEC-{NNN}-{component}.md` | `SEC-001-auth.md` |
| retrospective | retrospective/ | `RETRO-YYYY-MM-DD-{topic}.md` | `RETRO-2026-01-20-failures.md` |
| skill | skills/ | `SKILL-{NNN}-{topic}.md` | `SKILL-001-lint.md` |

**No generic NOTE-* type.** Forces proper categorization.

---

## Quality Thresholds

| Element | Minimum | Maximum |
|---------|---------|---------|
| Observations | 3 | 10 |
| Relations | 2 | 8 |
| Tags | 2 | 5 |
| Title length | 5 chars | 80 chars |

### Valid Observation Categories

```text
[fact], [decision], [requirement], [technique], [insight],
[problem], [solution], [constraint], [risk], [outcome]
```

### Valid Relation Types

```text
implements, depends_on, relates_to, extends, part_of,
inspired_by, contains, pairs_with, supersedes, leads_to, caused_by
```

---

## Enforcement Mechanisms

### 1. Memory Skill Update [COMPLETE]

Updated `apps/claude-plugin/skills/memory/SKILL.md` with:

- Write Operations Governance section (validation-based, not access-control)
- All agents can write with pre-flight validation
- Pre-flight validation checklist (BLOCKING)
- Entity type mapping
- Anti-patterns for write violations

### 2. Agent Definition Updates [NOT REQUIRED]

**No changes needed.** All agents retain `write_note` and `edit_note` access.

Previous approach (access control) was rejected because it violates one-level delegation:

```yaml
# REJECTED approach (violates one-level delegation)
# Do NOT remove write tools from agents

# CORRECT approach (all agents retain write access)
tools:
  - mcp__plugin_brain_brain__search
  - mcp__plugin_brain_brain__read_note
  - mcp__plugin_brain_brain__write_note  # All agents keep this
  - mcp__plugin_brain_brain__edit_note   # All agents keep this
```

### 3. Validation Scripts [TODO]

**validate-memory-note.ps1**

- Input: Note content or file path
- Output: PASS/FAIL with violations list
- Checks: All pre-flight validation items

**audit-memory-violations.ps1**

- Input: Memory notes directory
- Output: Compliance report with violation list
- Checks: Post-hoc detection of governance debt

### 4. CI Integration [TODO]

**Workflow: validate-memory-notes.yml**

- Trigger: PR modifying memory notes
- Action: Run validate-memory-note.ps1
- Gate: Block merge if validation fails

---

## Migration Path

### Phase 1: Documentation (Week 1) [COMPLETE]

- [x] Create ADR-019 (validation-based governance)
- [x] Update memory skill with governance section
- [x] Create this design document
- [x] Update to validation-based model (not access-control)

### Phase 2: Verify Agent Definitions (Week 2)

- [ ] Verify all agents have `write_note` and `edit_note` access
- [ ] Add pre-flight validation guidance to agent prompts
- [ ] Remove any delegation-to-memory requirements
- [ ] Update agent documentation

### Phase 3: Validation Scripts (Week 3)

- [ ] Create validate-memory-note.ps1
- [ ] Create audit-memory-violations.ps1
- [ ] Add CI workflow for note validation
- [ ] Add pre-commit hooks

### Phase 4: Cleanup (Week 4)

- [ ] Audit existing notes for violations
- [ ] Generate compliance report
- [ ] Fix or archive non-compliant notes
- [ ] Establish baseline metrics

---

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Note compliance | 95% | Pre-flight validation pass rate (CI) |
| Graph connectivity | 2+ relations/note | Average relations per note |
| Audit violations | <10% | Post-hoc audit violation rate |
| Agent autonomy | 100% | All agents can complete delegated work without sub-delegation |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agents skip validation | Governance debt | Post-hoc audit, CI enforcement |
| Existing note violations | Technical debt | Phased cleanup, archive option |
| Validation false positives | Blocked valid writes | Refinement based on feedback |
| Complex operations lack guidance | Poor quality notes | Memory skill provides examples |

---

## Related Documents

- ADR-019: Memory Operations Governance
- ADR-007: Memory-First Architecture
- ADR-018: Episodic and Causal Memory Architecture
- Session 06: Memory System Migration (entity type standards)
- Memory Skill: `apps/claude-plugin/skills/memory/SKILL.md`
- Memory Agent: `apps/claude-plugin/agents/memory.md`
