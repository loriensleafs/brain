---
status: "proposed"
date: 2026-01-21
decision-makers: architect, high-level-advisor
consulted: analyst, planner, implementer, qa, memory
informed: all agents
---

# Memory-First Architecture: Chesterton's Fence for AI Agents

## Context and Problem Statement

AI agents are expert but amnesiac. Each session starts with zero context from previous work. Without explicit memory retrieval, agents repeatedly:

- Remove code without understanding why it exists
- Bypass protocols without knowing past incidents
- Make decisions that contradict earlier agreements
- Lose learnings that should inform future work

This creates a fundamental problem: agents have the capability to change systems but lack the context to know whether changes are safe.

How do we ensure agents investigate existing context before making changes to architecture, protocols, or significant code?

## Decision Drivers

1. **Chesterton's Fence principle**: Do not remove a fence until you know why it was put up
2. **Agent amnesia**: Each session starts fresh with no memory of past work
3. **Protocol compliance**: Prior guidance ("check memory first") achieves <50% compliance without enforcement
4. **Reversibility risk**: Changes without context investigation may be difficult to reverse
5. **Decision quality**: Informed decisions require historical context
6. **Implementation agnosticism**: The principle must work regardless of memory backend

## Considered Options

### Option A: Advisory Guidance (Status Quo)

Document recommendations to search memory before decisions. No enforcement mechanism.

**Pros**:

- No implementation required
- Maximum agent flexibility

**Cons**:

- <50% compliance observed in practice
- Agents ignore guidance under time pressure
- No verification mechanism
- Repeated incidents from uninformed changes

### Option B: BLOCKING Gate with Verification

Require memory search before specific change types. Verify compliance through session log evidence.

**Pros**:

- Achieves near-100% compliance (same pattern as session protocol gates)
- Evidence-based verification
- Prevents uninformed destructive changes
- Implementation agnostic

**Cons**:

- Adds friction to agent workflow
- Requires enforcement mechanism
- May slow down simple changes

### Option C: Automated Pre-Commit Hooks

Implement technical controls that block commits without memory search evidence.

**Pros**:

- Technical enforcement cannot be bypassed
- Consistent application

**Cons**:

- Complex implementation
- May block legitimate emergency changes
- Requires infrastructure changes

## Decision Outcome

**Chosen option: Option B - BLOCKING Gate with Verification**

Memory search MUST occur before changing existing systems. Compliance is verified through session log evidence.

### The Principle

> "Do not remove a fence until you know why it was put up." - G.K. Chesterton

**Translation for AI agents**: Do not change code, architecture, or protocol until you search memory for why it exists.

### Why This Matters

**Without memory search** (removing fence without investigation):

1. Agent encounters complex code, thinks "this is ugly, I'll refactor it"
2. Removes validation logic that prevents edge case
3. Production incident occurs
4. Memory contains past incident that explains why validation existed

**With memory search** (Chesterton's Fence investigation):

1. Agent encounters complex code
2. Searches memory: `query="validation logic edge case"`
3. Finds past incident explaining why code exists
4. Makes informed decision: preserve, modify, or replace with equivalent safety

### Investigation Protocol

When you encounter something you want to change:

| Change Type | Memory Search Required | Query Pattern |
|-------------|------------------------|---------------|
| Remove ADR constraint | MUST search | `"[constraint name] rationale"` |
| Bypass protocol | MUST search | `"[protocol name] why incident"` |
| Delete >100 lines | MUST search | `"[component] purpose edge case"` |
| Refactor complex code | MUST search | `"[component] edge case failure"` |
| Change workflow | MUST search | `"[workflow] rationale incident"` |
| Modify architecture | MUST search | `"[component] design decision"` |

### Memory Tiers

Memory contains different types of context:

**Tier 1 (Semantic)**: Facts, patterns, constraints

- Why does PowerShell-only constraint exist?
- Why do skills exist instead of raw CLI?
- What patterns should this component follow?

**Tier 2 (Episodic)**: Past session outcomes

- What happened when we tried approach X?
- What edge cases did we encounter?
- What failures led to current design?

**Tier 3 (Causal)**: Decision patterns

- What decisions led to success?
- What patterns should we repeat or avoid?
- What root causes were identified?

### Memory-First Gate (BLOCKING)

**Before changing existing systems, you MUST**:

1. Search memory with relevant query
2. Review results for historical context
3. If insufficient results, escalate query (broader terms, Tier 2/3)
4. Document findings in decision rationale
5. Only then proceed with change

**Why BLOCKING**: Advisory guidance achieved <50% compliance. BLOCKING gates achieve near-100% compliance. This matches the pattern used for session protocol enforcement.

**Verification**: Session logs must show memory search BEFORE decisions, not after.

### Evidence Requirements

Session log must include:

```markdown
## Memory-First Verification

| Decision | Memory Query | Results Found | Context Applied |
|----------|--------------|---------------|-----------------|
| [Decision] | [Query used] | [Y/N + summary] | [How it informed decision] |
```

If memory search yields no results:

```markdown
| Refactor auth code | "auth validation edge case" | No results | Proceeding with caution - no historical context found |
```

### Consequences

**Good**:

- Agents make informed decisions based on historical context
- Reduces repeat incidents from uninformed changes
- Preserves institutional knowledge across agent sessions
- Creates audit trail of decision context
- Implementation agnostic (works with any memory backend)

**Bad**:

- Adds step to agent workflow
- May slow simple changes that have no relevant history
- Requires discipline to search with effective queries

**Neutral**:

- Shifts burden from "assume safe to change" to "prove safe to change"
- Memory quality determines investigation quality

### Confirmation

Implementation compliance confirmed by:

1. **Session log validation**: Memory search evidence present before architectural/protocol changes
2. **Decision documentation**: Rationale includes memory context (or explicit "no context found")
3. **Validator script**: Can check session logs for memory-first compliance

## Pros and Cons of the Options

### Option A: Advisory Guidance (Status Quo)

- Good, because no implementation overhead
- Good, because maximum flexibility
- Bad, because <50% compliance in practice
- Bad, because no verification mechanism
- Bad, because repeated incidents from uninformed changes

### Option B: BLOCKING Gate with Verification

- Good, because achieves near-100% compliance
- Good, because evidence-based verification
- Good, because implementation agnostic
- Good, because prevents uninformed destructive changes
- Neutral, because adds step to workflow
- Bad, because requires enforcement discipline

### Option C: Automated Pre-Commit Hooks

- Good, because technical enforcement
- Good, because consistent application
- Bad, because complex implementation
- Bad, because may block emergency changes
- Bad, because requires infrastructure changes

## Implementation Notes

### When Memory-First is Required

| Trigger | Memory-First Required |
|---------|----------------------|
| Creating new ADR | MUST search for related decisions |
| Modifying existing ADR | MUST search for dependent systems |
| Removing code >100 lines | MUST search for component history |
| Bypassing documented protocol | MUST search for protocol rationale |
| Changing workflow/process | MUST search for workflow history |
| Modifying security controls | MUST search for threat context |

### When Memory-First is Optional

| Trigger | Memory-First Optional |
|---------|----------------------|
| Adding new feature (no existing code) | MAY search for patterns |
| Fixing obvious bug | MAY search for root cause |
| Documentation updates | MAY search for context |
| Test additions | MAY search for coverage gaps |

### Query Strategies

**Start specific, broaden if needed**:

1. First query: Exact component/feature name
2. If no results: Related concepts
3. If still no results: Category/domain search
4. Document: "Searched [queries], no relevant context found"

**Effective query examples**:

- `"validation middleware edge case"` (specific)
- `"input validation failure"` (broader)
- `"security validation rationale"` (domain)

### Session Log Template Addition

Add to session log template:

```markdown
## Memory-First Compliance

### Pre-Decision Searches

| Time | Decision Context | Query | Results | Action |
|------|------------------|-------|---------|--------|
| | | | | |

### Chesterton's Fence Checks

- [ ] Searched memory before modifying existing architecture
- [ ] Searched memory before bypassing documented protocol
- [ ] Documented rationale includes memory context
```

## Reversibility Assessment

- [x] **Rollback capability**: Process change, no technical rollback needed
- [x] **Vendor lock-in**: None - principle is implementation agnostic
- [x] **Exit strategy**: N/A - this is a process principle
- [x] **Legacy impact**: Improves handling of legacy code/decisions
- [x] **Data migration**: None required

## More Information

**Related ADRs**:

- ADR-016: Session Protocol Enforcement (enforcement pattern reference)
- ADR-017: Memory Tool Naming Strategy (memory tool interface)

**Philosophical Foundation**:

G.K. Chesterton's fence parable: Before removing a fence, understand why it was built. The person who doesn't understand its purpose is precisely the person who shouldn't remove it.

Applied to AI agents: Before changing code/architecture/protocol, search memory for why it exists. The agent that doesn't know the history is precisely the agent that shouldn't make uninformed changes.

**Realization Timeline**:

- Immediate: Document principle in agent instructions
- Session log template: Add memory-first verification section
- Validation: Add memory-first compliance check to session validator

**Review Schedule**:

Post-implementation review after 30 days to assess:

- Compliance rate with memory-first searches
- Quality of memory queries
- Decision quality improvement
- Incident reduction from uninformed changes
