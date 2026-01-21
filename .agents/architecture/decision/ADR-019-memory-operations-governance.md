---
status: proposed
date: 2026-01-21
decision-makers: [architect, planner]
consulted: [analyst, memory, orchestrator]
informed: [implementer, all agents with write access]
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

## Decision Drivers

* **Consistency**: All notes MUST follow Session 06 standards (11 folders, 13 entity types)
* **Quality**: Notes MUST meet quality thresholds (3-5 observations, 2-3 relations)
* **Discoverability**: Consistent naming enables reliable semantic search
* **Graph Integrity**: Proper relations maintain knowledge graph connectivity
* **Minimal Friction**: Enforcement cannot create excessive overhead for agents
* **Auditability**: Violations must be detectable and reportable

## Considered Options

### Option A: Always Delegate to Memory Agent

All write/edit operations delegated to memory agent, which knows all conventions.

Pros:
- Single point of enforcement
- Memory agent specializes in conventions
- Clean separation of concerns

Cons:
- Extra delegation overhead for every write
- Memory agent becomes bottleneck
- Simple operations require full agent invocation

### Option B: Enhanced Memory Skill with Validation

Update memory skill to include comprehensive validation rules. Agents use skill for guidance.

Pros:
- Skill provides reference without delegation
- Lower overhead than full agent delegation
- Validation rules codified in one place

Cons:
- "Guidance" achieves <50% compliance (same problem as trust-based approaches)
- No enforcement, only education
- Agents can ignore skill

### Option C: Tiered Approach with Technical Enforcement

Tier 1 (Simple): Read/search operations direct via skill
Tier 2 (Write): Validation layer that intercepts and validates
Tier 3 (Complex): Delegate to memory agent

Pros:
- Right-sized enforcement for operation complexity
- Technical validation achieves 100% compliance
- Memory agent handles edge cases

Cons:
- Requires validation infrastructure
- More complex architecture
- Validation layer needs maintenance

### Option D: Remove Direct Write Access from Most Agents

Strip `write_note` and `edit_note` from all agents except memory agent and specialists.

Pros:
- Prevents violations at tool access level
- Clear ownership of memory operations
- Simpler agent configurations

Cons:
- Reduces agent autonomy
- All writes require memory agent delegation
- May slow down workflows

## Decision Outcome

Chosen option: **Option C (Tiered Approach)** with elements of Option D.

The tiered approach provides right-sized enforcement:

| Operation Type | Enforcement Level | Mechanism |
|---------------|-------------------|-----------|
| Read/Search | None needed | Direct MCP tool access |
| Create Note | Validation gate | Pre-flight validation before write |
| Edit Note | Validation gate | Pre-flight validation before edit |
| Complex Operations | Full delegation | Route to memory agent |

Combined with selective tool access (Option D elements):

| Agent Category | write_note Access | edit_note Access | Rationale |
|---------------|-------------------|------------------|-----------|
| memory | Yes | Yes | Primary owner |
| skillbook | Yes | Yes | Creates SKILL-* entities |
| retrospective | Yes | Yes | Creates RETRO-* entities |
| spec-generator | Yes | Yes | Creates REQ/DESIGN/TASK entities |
| All others | Read-only | Read-only | Delegate to memory agent |

### Consequences

Good:
- Violations impossible at write time (validation gate)
- Reduced agent complexity (most agents become read-only for memory)
- Memory agent handles conventions (single source of truth)
- Quality thresholds enforced (not just suggested)

Bad:
- Validation infrastructure required
- Some agents lose direct write capability
- Initial migration effort to update agent configs

Neutral:
- Memory agent load increases (more delegations)
- Existing notes not retroactively validated (separate cleanup task)

### Confirmation

Compliance verified by:
1. Validation script runs before every write operation
2. CI check for new agent definitions adding write tools
3. Audit script to detect notes not matching conventions

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

## Delegation Protocol

### When to Use Memory Skill (Direct)

```markdown
- Search operations: `mcp__plugin_brain_brain__search`
- Read operations: `mcp__plugin_brain_brain__read_note`
- List operations: `mcp__plugin_brain_brain__list_directory`
- Simple edits to existing notes (append observation)
```

### When to Delegate to Memory Agent

```markdown
- Creating new entities (ensures convention compliance)
- Complex multi-note operations
- Knowledge graph reorganization
- Cross-domain relation management
- When unsure about correct folder/naming
```

### Delegation Format

```text
Task(subagent_type="memory", prompt="Create [entity-type] note for [topic] with:
- Context: [why this matters]
- Observations: [key facts and decisions]
- Relations: [what this connects to]
")
```

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

### validate-agent-memory-access.ps1

Input: Agent definition file
Output: Report of memory tool access

```powershell
# Checks
- Lists agents with write_note access
- Lists agents with edit_note access
- Flags agents not in approved list
- Generates compliance report
```

## Migration Path

### Phase 1: Update Memory Skill (Week 1)

1. Add entity type mapping table to skill
2. Add validation checklist to skill
3. Add delegation protocol to skill
4. Update skill triggers for delegation

### Phase 2: Update Agent Definitions (Week 2)

1. Remove write_note from non-approved agents
2. Remove edit_note from non-approved agents
3. Add memory agent delegation protocol to affected agents
4. Update agent tests

### Phase 3: Add Validation Scripts (Week 3)

1. Create validate-memory-note.ps1
2. Create validate-agent-memory-access.ps1
3. Add CI workflow for agent definition checks
4. Add pre-commit hook for note validation

### Phase 4: Cleanup Existing Notes (Week 4)

1. Run validation against all existing notes
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
