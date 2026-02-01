---
status: accepted
date: 2026-01-21
decision-makers: [architect, planner]
consulted: [analyst, memory, orchestrator]
informed: [all agents]
---

# ADR-019: Memory Operations Governance and Convention Enforcement

## Context and Problem Statement

Agents call Brain MCP tools directly (`mcp__plugin_brain_brain__write_note`, `mcp__plugin_brain_brain__edit_note`) and create governance debt:

- Notes written to incorrect folders (e.g., analysis content in planning/)
- Inconsistent file naming (lowercase vs CAPS prefix, missing numbers)
- Entity types not following Session 06 standards (13 entity types with CAPS prefix)
- Observation/relation format violations (missing categories, no wikilinks)
- Missing quality thresholds (fewer than 3 observations, no relations)

Current state: 15+ agents have direct access to `write_note` and `edit_note` tools with no enforcement mechanism.

How should we enforce Brain memory conventions across all agents?

**Architectural Constraint**: The agent system uses one-level delegation. Subagents cannot delegate to other subagents. When orchestrator delegates to analyst, analyst must be able to write directly. Any governance model requiring delegation to memory agent violates this constraint.

## Decision Drivers

- **One-Level Delegation**: Subagents cannot delegate; governance must work with direct tool access
- **Consistency**: All notes MUST follow Session 06 standards (11 folders, 13 entity types)
- **Quality**: Notes MUST meet quality thresholds (3-5 observations, 2-3 relations)
- **Discoverability**: Consistent naming enables reliable semantic search
- **Graph Integrity**: Proper relations maintain knowledge graph connectivity
- **Minimal Friction**: Enforcement cannot create excessive overhead for agents
- **Auditability**: Violations must be detectable and reportable

## Considered Options

### Option A: Always Delegate to Memory Agent

All write/edit operations delegated to memory agent, which knows all conventions.

Pros:

- Single point of enforcement
- Memory agent specializes in conventions
- Clean separation of concerns

Cons:

- **REJECTED**: Violates one-level delegation architecture
- Subagents cannot delegate to other subagents
- Memory agent becomes bottleneck

### Option B: Enhanced Memory Skill with Validation Guidance

Update memory skill to include comprehensive validation rules. All agents use skill for guidance and follow pre-flight validation.

Pros:

- Skill provides validation reference for all agents
- No delegation required (compatible with one-level delegation)
- Validation rules codified in one place
- All agents retain autonomy

Cons:

- Compliance depends on agents following guidance
- No technical enforcement at tool level
- Violations detected post-hoc via audit

### Option C: Remove Direct Write Access from Most Agents

Strip `write_note` and `edit_note` from all agents except memory agent and specialists.

Pros:

- Prevents violations at tool access level
- Clear ownership of memory operations

Cons:

- **REJECTED**: Violates one-level delegation architecture
- Analyst delegated by orchestrator cannot write without sub-delegation
- Creates workflow bottlenecks

### Option D: Validation-Based Governance (All Agents Write, MUST Validate)

All agents retain write access. Pre-flight validation is MANDATORY before writes. Post-hoc audit detects violations.

Pros:

- Compatible with one-level delegation
- All agents can write when delegated work requires it
- Governance via education + audit, not access removal
- Memory skill becomes validator/guide, not gatekeeper

Cons:

- Compliance depends on agent discipline
- Violations possible (detected by audit)
- Requires validation script infrastructure

## Decision Outcome

Chosen option: **Option D (Validation-Based Governance)**.

This option is the only one compatible with the one-level delegation architecture. All agents retain `write_note` and `edit_note` access. Governance is enforced through:

1. **Pre-flight validation requirements** (BLOCKING gate before writes)
2. **Memory skill as validator/guide** (provides validation checklist and entity mapping)
3. **Post-hoc audit scripts** (detect violations for cleanup)
4. **CI enforcement** (validate notes on PR)

| Operation Type | Who Can Perform | Enforcement Mechanism |
|---------------|-----------------|----------------------|
| Read/Search | All agents | No enforcement needed |
| Create Note | All agents | Pre-flight validation MUST pass |
| Edit Note | All agents | Pre-flight validation MUST pass |
| Complex Operations | All agents (consult memory skill) | Pre-flight validation + skill guidance |

**Access Model**:

| Agent | write_note | edit_note | Rationale |
|-------|------------|-----------|-----------|
| **All agents** | **Yes** | **Yes** | One-level delegation requires direct access |

### Consequences

Good:

- Compatible with one-level delegation architecture
- All agents can complete delegated work independently
- No workflow bottlenecks from memory agent delegation
- Governance via validation, not access control

Bad:

- Violations possible if agents skip validation
- Post-hoc cleanup required for non-compliant notes
- Relies on agent discipline and audit

Neutral:

- Memory agent role shifts from gatekeeper to consultant
- Validation infrastructure required
- Existing notes not retroactively validated (separate cleanup task)

### Confirmation

Compliance verified by:

1. Pre-flight validation checklist in memory skill (agents MUST complete)
2. Post-hoc audit script to detect notes not matching conventions
3. CI check validates notes in PRs before merge
4. Session logs must show validation checklist completed before writes

## Enforcement Mechanism Design

### 1. Pre-Flight Validation (BLOCKING)

Before any `write_note` or `edit_note` call, agents MUST validate:

```markdown
### Pre-Flight Validation Checklist

- [ ] Folder matches entity type (see mapping below)
- [ ] File name follows CAPS prefix pattern
- [ ] Frontmatter includes required fields (title, type, tags)
- [ ] Observations section exists with 3+ entries
- [ ] Relations section exists with 2+ wikilinks
- [ ] Observation format: `- [category] content #tags`
- [ ] Relation format: `- relation_type [[Target Entity]]`
```

### 2. Entity Type to Folder Mapping (Canonical)

| Entity Type | Folder | File Pattern | Example |
|-------------|--------|--------------|---------|
| decision | decisions/ | `ADR-{NNN}-{topic}.md` | `ADR-015-auth-strategy.md` |
| session | sessions/ | `SESSION-YYYY-MM-DD-NN-{topic}.md` | `SESSION-2026-01-20-06-memory.md` |
| requirement | specs/{spec}/requirements/ | `REQ-{NNN}-{topic}.md` | `REQ-001-user-login.md` |
| design | specs/{spec}/design/ | `DESIGN-{NNN}-{topic}.md` | `DESIGN-001-auth-flow.md` |
| task | specs/{spec}/tasks/ | `TASK-{NNN}-{topic}.md` | `TASK-001-implement-jwt.md` |
| analysis | analysis/ | `ANALYSIS-{NNN}-{topic}.md` | `ANALYSIS-001-memory-arch.md` |
| feature | planning/ | `FEATURE-{NNN}-{topic}.md` | `FEATURE-001-oauth.md` |
| epic | roadmap/ | `EPIC-{NNN}-{name}.md` | `EPIC-001-authentication.md` |
| critique | critique/ | `CRIT-{NNN}-{topic}.md` | `CRIT-001-oauth-plan.md` |
| test-report | qa/ | `QA-{NNN}-{topic}.md` | `QA-001-oauth.md` |
| security | security/ | `SEC-{NNN}-{component}.md` | `SEC-001-auth-flow.md` |
| retrospective | retrospective/ | `RETRO-YYYY-MM-DD-{topic}.md` | `RETRO-2026-01-20-failures.md` |
| skill | skills/ | `SKILL-{NNN}-{topic}.md` | `SKILL-001-markdownlint.md` |

### 3. Quality Thresholds (MUST)

| Element | Minimum | Maximum | Example |
|---------|---------|---------|---------|
| Observations | 3 | 10 | `- [decision] Using JWT #auth` |
| Relations | 2 | 8 | `- implements [[REQ-001]]` |
| Tags | 2 | 5 | `tags: [auth, security]` |
| Title | 5 chars | 80 chars | `ADR-015 Auth Strategy` |

### 4. Observation Categories (Valid Set)

```text
[fact], [decision], [requirement], [technique], [insight],
[problem], [solution], [constraint], [risk], [outcome]
```

### 5. Relation Types (Valid Set)

```text
implements, depends_on, relates_to, extends, part_of,
inspired_by, contains, pairs_with, supersedes, leads_to, caused_by
```

## Write Operations Protocol

### All Agents MAY Write Directly

Per one-level delegation architecture, all agents retain `write_note` and `edit_note` access. There is no delegation requirement.

### Pre-Flight Validation (BLOCKING)

Before ANY write operation, agents MUST complete pre-flight validation:

```markdown
### Pre-Flight Checklist (MUST all pass before write)

- [ ] Entity type is valid (13 types only, see table below)
- [ ] Folder matches entity type (see mapping)
- [ ] File name follows CAPS prefix pattern
- [ ] Frontmatter has: title, type, tags (2-5)
- [ ] Observations section: 3-10 entries with categories
- [ ] Observation format: `- [category] content #tags`
- [ ] Relations section: 2-8 entries with wikilinks
- [ ] Relation format: `- relation_type [[Target Entity]]`
```

**Agents that skip validation create governance debt.** Post-hoc audit will detect violations.

### When to Consult Memory Skill

The memory skill provides guidance (not access control):

```markdown
- **Entity type mapping**: Which folder for which entity type
- **Naming conventions**: CAPS prefix patterns
- **Quality thresholds**: Minimum observations/relations
- **Format examples**: Compliant note structure
```

### Complex Operations

For complex multi-note operations or knowledge graph reorganization, agents SHOULD:

1. Complete pre-flight validation for each note
2. Reference memory skill for entity relationships
3. Document cross-domain relations properly

## Validation Script Requirements

### validate-memory-note.ps1

Input: Note content or file path
Output: PASS/FAIL with specific violations

```powershell
# Validation checks
- Frontmatter presence and completeness
- Entity type valid (from 13-type list)
- Folder matches entity type
- File name matches CAPS pattern for entity type
- Observation count >= 3
- Observation format valid (category + tags)
- Relation count >= 2
- Relation format valid (type + wikilink)
- No generic NOTE-* entity type
```

### audit-memory-violations.ps1

Input: Memory notes directory
Output: Compliance report with violation list

```powershell
# Audit checks (post-hoc)
- Scans all notes in memory folders
- Validates each note against pre-flight checklist
- Generates report: compliant count, violation count, violation details
- Groups violations by type (folder mismatch, naming, quality threshold)
- Outputs actionable fix recommendations
```

## Migration Path

### Phase 1: Update Documentation (Week 1)

1. Update ADR-019 to validation-based governance (this document)
2. Update memory skill with pre-flight validation checklist
3. Update DESIGN-001 to reflect validation-based enforcement
4. Remove access-control language from all documents

### Phase 2: Ensure All Agents Have Write Access (Week 2)

1. Verify all agent definitions include `write_note` and `edit_note`
2. Add pre-flight validation guidance to agent instructions
3. Remove any delegation-to-memory requirements
4. Update agent documentation

### Phase 3: Add Validation Scripts (Week 3)

1. Create validate-memory-note.ps1 (validates note structure)
2. Create audit-memory-violations.ps1 (finds non-compliant notes)
3. Add CI workflow for note validation on PR
4. Add pre-commit hook for note validation

### Phase 4: Cleanup Existing Notes (Week 4)

1. Run audit against all existing notes
2. Generate violation report
3. Fix or archive non-compliant notes
4. Establish baseline compliance metrics

## More Information

### Related Decisions

- ADR-007: Memory-First Architecture
- ADR-017: Memory Tool Naming Strategy
- ADR-018: Episodic and Causal Memory Architecture
- Session 06: Memory System Migration (established entity types)

### Evidence

Current state audit (2026-01-21):

- 15+ agents have direct write_note access
- No validation before writes
- Inconsistent naming observed in existing notes
- No enforcement mechanism exists

### Review Schedule

Review at 30 days post-implementation to assess:

- Delegation volume to memory agent
- Validation rejection rate
- Agent friction feedback
- Compliance metrics

### Reversibility Assessment

- Rollback capability: Yes, restore previous agent definitions
- Vendor lock-in: None (all internal tooling)
- Exit strategy: N/A (internal governance)
- Legacy impact: Existing notes require cleanup
- Data migration: Reversible, no data loss risk
