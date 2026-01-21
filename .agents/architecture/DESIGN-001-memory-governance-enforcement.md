# Memory Governance Enforcement Design

**Date**: 2026-01-21
**Status**: Proposed
**ADR**: ADR-019

---

## Executive Summary

This design addresses governance debt from agents calling Brain MCP write tools directly without following conventions. The solution uses a tiered enforcement approach: read operations remain unrestricted, write operations require either pre-flight validation (approved agents) or delegation to memory agent (all others).

---

## Problem Statement

**Current State (Audit 2026-01-21)**:
- 15+ agents have direct access to `write_note` and `edit_note`
- No validation before writes
- Observed violations: wrong folders, missing CAPS prefixes, no relations
- Session 06 established 11 folders and 13 entity types with naming conventions

**Impact**:
- Knowledge graph fragmentation
- Search reliability degradation
- Cross-session context loss
- Maintenance burden accumulation

---

## Design Decisions

### 1. Tiered Enforcement Model

```text
TIER 1: Read Operations (No Enforcement)
├── mcp__plugin_brain_brain__search
├── mcp__plugin_brain_brain__read_note
└── mcp__plugin_brain_brain__list_directory

TIER 2: Write Operations (Validation Gate)
├── mcp__plugin_brain_brain__write_note
└── mcp__plugin_brain_brain__edit_note

TIER 3: Complex Operations (Memory Agent Delegation)
├── Multi-note operations
├── Knowledge graph reorganization
└── Cross-domain relation management
```

### 2. Agent Access Matrix

| Agent | Search | Read | Write | Edit | Rationale |
|-------|--------|------|-------|------|-----------|
| memory | Yes | Yes | Yes | Yes | Primary owner |
| skillbook | Yes | Yes | Yes | Yes | SKILL-* entities |
| retrospective | Yes | Yes | Yes | Yes | RETRO-* entities |
| spec-generator | Yes | Yes | Yes | Yes | REQ/DESIGN/TASK |
| All others | Yes | Yes | **No** | **No** | Delegate |

### 3. Pre-Flight Validation (for approved agents)

Before any write operation, approved agents MUST validate:

```markdown
### Pre-Flight Checklist

- [ ] Entity type valid (13 types only)
- [ ] Folder matches entity type
- [ ] File name follows CAPS prefix pattern
- [ ] Frontmatter complete (title, type, tags)
- [ ] Observations: 3-10 entries with categories
- [ ] Relations: 2-8 wikilinks
```

### 4. Delegation Protocol (for non-approved agents)

```text
Task(subagent_type="memory", prompt="Create [entity-type] note:
- Folder: [folder per entity mapping]
- Title: [CAPS-PREFIX-NNN-topic]
- Context: [why this matters]
- Observations: [list with categories]
- Relations: [wikilinks to related entities]
")
```

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
- Write Operations Governance section
- Agent access matrix
- Pre-flight validation checklist
- Delegation protocol
- Entity type mapping
- Anti-patterns for write violations

### 2. Agent Definition Updates [TODO]

Remove `write_note` and `edit_note` from non-approved agents:

```yaml
# Before (violation)
tools:
  - mcp__plugin_brain_brain__write_note
  - mcp__plugin_brain_brain__edit_note

# After (compliant)
tools:
  - mcp__plugin_brain_brain__search
  - mcp__plugin_brain_brain__read_note
```

Agents to update:
- architect.md
- planner.md
- orchestrator.md
- implementer.md
- critic.md
- analyst.md
- qa.md
- high-level-advisor.md
- independent-thinker.md
- task-generator.md
- explainer.md
- pr-comment-responder.md

### 3. Validation Scripts [TODO]

**validate-memory-note.ps1**
- Input: Note content or file path
- Output: PASS/FAIL with violations list
- Checks: All pre-flight validation items

**validate-agent-memory-access.ps1**
- Input: Agent definition directory
- Output: Compliance report
- Checks: Unauthorized write_note/edit_note access

### 4. CI Integration [TODO]

**Workflow: validate-agent-definitions.yml**
- Trigger: PR modifying `agents/*.md`
- Action: Run validate-agent-memory-access.ps1
- Gate: Block merge if unauthorized access detected

**Workflow: validate-memory-notes.yml**
- Trigger: PR modifying memory notes
- Action: Run validate-memory-note.ps1
- Gate: Block merge if validation fails

---

## Migration Path

### Phase 1: Documentation (Week 1) [IN PROGRESS]
- [x] Create ADR-019
- [x] Update memory skill with governance section
- [x] Create this design document
- [ ] Update memory agent documentation

### Phase 2: Agent Updates (Week 2)
- [ ] Remove write tools from non-approved agents
- [ ] Add delegation protocol to affected agents
- [ ] Update agent tests

### Phase 3: Validation Scripts (Week 3)
- [ ] Create validate-memory-note.ps1
- [ ] Create validate-agent-memory-access.ps1
- [ ] Add CI workflows
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
| Agent compliance | 100% | No unauthorized write access |
| Note compliance | 95% | Pre-flight validation pass rate |
| Delegation success | 90% | Memory agent creates compliant notes |
| Graph connectivity | 2+ relations/note | Average relations per note |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Memory agent bottleneck | Slow workflows | Batch delegation, async writes |
| Agent friction | Developer pushback | Clear error messages, examples |
| Existing note violations | Technical debt | Phased cleanup, archive option |
| Validation false positives | Blocked valid writes | Refinement based on feedback |

---

## Related Documents

- ADR-019: Memory Operations Governance
- ADR-007: Memory-First Architecture
- ADR-018: Episodic and Causal Memory Architecture
- Session 06: Memory System Migration (entity type standards)
- Memory Skill: `apps/claude-plugin/skills/memory/SKILL.md`
- Memory Agent: `apps/claude-plugin/agents/memory.md`
