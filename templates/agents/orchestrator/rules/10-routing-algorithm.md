## Routing Algorithm

### Task Classification

Every task is classified across three dimensions:

1. **Task Type**: Feature, Bug Fix, Infrastructure, Security, Strategic, Research, Documentation, Refactoring, Ideation, Specification, PR Comment
2. **Complexity Level**: Simple (single {worker}), Multi-Step (sequential {worker_plural}), Multi-Domain (parallel concerns)
3. **Risk Level**: Low, Medium, High, Critical

### Workflow Paths (Canonical Reference)

These workflow paths are the canonical reference for all task routing.

| Path              | {worker_type} Sequence                                                    |
| ----------------- | ------------------------------------------------------------------------- |
| **Quick Fix**     | implementer then qa                                                       |
| **Standard**      | analyst then planner then implementer then qa                             |
| **Strategic**     | [independent-thinker + high-level-advisor] then task-generator            |
| **Specification** | spec-generator then [critic + architect] then task-generator              |

### {worker_type} Sequences by Task Type

**Notation**: `then` = sequential (output required), `+` = parallel (independent work)

| Task Type                                   | {worker_type} Sequence                                                                   | Path                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------- |
| Feature (multi-domain)                      | analyst then architect then planner then critic then implementer then qa                  | Standard (extended)  |
| Feature (multi-domain with impact analysis) | analyst then planner then [implementer + architect + security + devops + qa] then critic then implementer then qa | Standard (extended)  |
| Feature (multi-step)                        | analyst then planner then implementer then qa                                            | Standard             |
| Bug Fix (multi-step)                        | analyst then implementer then qa                                                         | Standard (lite)      |
| Bug Fix (simple)                            | implementer then qa                                                                      | Quick Fix            |
| Security                                    | analyst then security then architect then critic then implementer then qa                | Standard (extended)  |
| Infrastructure                              | analyst then devops then security then critic then qa                                    | Standard (extended)  |
| Research                                    | analyst (standalone)                                                                     | N/A                  |
| Documentation                               | explainer then critic                                                                    | Standard (lite)      |
| Strategic                                   | roadmap then architect then planner then critic                                          | Strategic            |
| Refactoring                                 | analyst then architect then implementer then qa                                          | Standard             |
| Ideation                                    | analyst then [high-level-advisor + independent-thinker + critic] then roadmap then explainer then task-generator then [architect + devops + security + qa] | Strategic (extended) |
| Specification                               | spec-generator then [critic + architect] then task-generator then implementer then qa    | Specification        |
| PR Comment (quick fix)                      | implementer then qa                                                                      | Quick Fix            |
| PR Comment (standard)                       | analyst then planner then implementer then qa                                            | Standard             |
| PR Comment (strategic)                      | [independent-thinker + high-level-advisor] then task-generator                           | Strategic            |
| Post-Retrospective                          | retrospective then [skillbook if skills + memory if updates] then git add                | Automatic            |

**Note**: These sequences show {worker} TYPES, not {worker} COUNT. Any single step can expand into a same-type swarm. `analyst` could become `analyst-1` through `analyst-8` depending on how many independent research topics exist. `implementer` could become `implementer-1` through `implementer-10` depending on how many independent modules are touched. Aggressively decompose work to find the finest independent splits, then swarm accordingly.

### Mandatory {worker_type} Rules

1. **Security {worker} ALWAYS for**: Files matching `**/Auth/**`, `.githooks/*`, `*.env*`
2. **QA {worker} ALWAYS after**: Any implementer changes
3. **Critic {worker} BEFORE**: Multi-domain implementations
4. **adr-review skill ALWAYS after**: ADR creation/update (see ADR Review Enforcement below)

### ADR Review Enforcement (BLOCKING)

When ANY {worker} returns output indicating ADR creation/update:

**Detection Pattern**:

- {worker_type} output contains: "ADR created/updated: decisions/ADR-\*"
- {worker_type} output contains: "MANDATORY: {lead_role} MUST invoke adr-review"

**Enforcement**:

```text
BLOCKING GATE: ADR Review Required

1. Verify ADR file exists at specified path
2. Invoke adr-review skill:

   Skill(skill="adr-review", args="[ADR file path]")

3. Wait for adr-review completion
4. Only after adr-review completes, {route_next}

DO NOT {route_next} until adr-review completes.
```

**Failure Handling**:

| Condition                    | Action                                                     |
| ---------------------------- | ---------------------------------------------------------- |
| ADR file not found           | Report error to user, halt workflow                        |
| adr-review skill unavailable | Report error to user, document gap, proceed with warning   |
| adr-review fails             | Review failure output, decide to retry or escalate to user |

### Routing Heuristics with Fallbacks

| Task Type                  | Primary {worker_type}    | Fallback    |
| -------------------------- | ------------------------ | ----------- |
| C# / TypeScript / Go impl | implementer              | analyst     |
| Architecture review        | architect                | analyst     |
| Epic to Milestones         | planner                  | roadmap     |
| Milestones to Atomic tasks | task-generator           | planner     |
| Challenge assumptions      | independent-thinker      | critic      |
| Plan validation            | critic                   | analyst     |
| Test strategy              | qa                       | implementer |
| Research/investigation     | analyst                  | -           |
| Strategic decisions        | roadmap                  | architect   |
| Security assessment        | security                 | analyst     |
| Infrastructure changes     | devops                   | security    |
| Feature ideation           | analyst                  | roadmap     |
| Formal specifications      | spec-generator           | explainer   |
| PR comment triage          | (see PR Comment Routing) | analyst     |

### Complexity Assessment

Assess complexity BEFORE selecting {worker_plural}:

| Level        | Criteria                                      | {worker_type} Strategy                |
| ------------ | --------------------------------------------- | ------------------------------------- |
| **Trivial**  | Direct tool call answers it                   | No {worker} needed                    |
| **Simple**   | 1-2 files, clear scope, known pattern         | implementer only                      |
| **Standard** | 2-5 files, may need research                  | 2-10 {worker_plural} with clear handoffs |
| **Complex**  | Cross-cutting, new domain, security-sensitive | Full orchestration with critic review |

**Heuristics:**

- If you can describe the fix in one sentence: Simple
- If task matches 2+ categories below: route to analyst {worker} first for decomposition
- If uncertain about scope: Standard (not Complex)

### Quick Classification

| If task involves...                                | Task Type      | Complexity      | {worker_plural} Required                       |
| -------------------------------------------------- | -------------- | --------------- | ----------------------------------------------- |
| `**/Auth/**`, `**/Security/**`                     | Security       | Complex         | security, architect, implementer, qa            |
| `.github/workflows/*`, `.githooks/*`               | Infrastructure | Standard        | devops, security, qa                            |
| New functionality                                  | Feature        | Assess first    | See Complexity Assessment                       |
| Something broken                                   | Bug Fix        | Simple/Standard | analyst (if unclear), implementer, qa           |
| "Why does X..."                                    | Research       | Trivial/Simple  | analyst or direct answer                        |
| Architecture decisions                             | Strategic      | Complex         | roadmap, architect, planner, critic             |
| Package/library URLs, vague scope, "we should add" | Ideation       | Complex         | Full ideation pipeline (see Ideation Workflow)  |
| PR review comment                                  | PR Comment     | Assess first    | See PR Comment Routing                          |

### PR Comment Routing

When you receive a PR comment context, classify using this decision tree:

```text
Is this about WHETHER to do something? (scope, priority, alternatives)
    |
    +-- YES --> STRATEGIC PATH
    |           {delegation_verb}: independent-thinker + high-level-advisor (parallel)
    |           Then: task-generator
    |
    +-- NO --> Can you explain the fix in one sentence?
                |
                +-- YES --> QUICK FIX PATH
                |           {delegation_verb}: implementer then qa
                |
                +-- NO --> STANDARD PATH
                            {delegation_verb}: analyst then planner then implementer then qa
```

**Quick Fix indicators:**

- Typo fixes
- Obvious bug fixes
- Style/formatting issues
- Simple null checks
- Clear one-line changes

**Standard indicators:**

- Needs investigation
- Multiple files affected
- Performance concerns
- Complex refactoring
- New functionality

**Strategic indicators:**

- "Should we do this?"
- "Why not do X instead?"
- "This seems like scope creep"
- "Consider alternative approach"
- Architecture direction questions

### Specification Routing

When formal requirements are needed, route through the spec workflow.

**Trigger Detection**: Recognize specification scenarios by these signals:

- Explicit request for requirements, specifications, or EARS format
- Complex feature requiring traceability
- Regulatory or compliance needs
- "What should this do?" questions needing formal answers
- Features that will be implemented by multiple {worker_plural}/sessions

**Orchestration Flow**:

```text
1. Create spec-generator {worker} with feature description
2. spec-generator asks clarifying questions (returns to user if needed)
3. spec-generator produces (in Brain memory):
   - REQ-NNN documents in specs/{ENTITY-NNN-topic}/requirements/
   - DESIGN-NNN documents in specs/{ENTITY-NNN-topic}/design/
   - TASK-NNN documents in specs/{ENTITY-NNN-topic}/tasks/
4. Create critic {worker} for EARS compliance validation
5. Create architect {worker} for design review
6. Spec-generator's TASK documents are implementation-ready (no task-generator needed)
7. After approval, create implementer {worker_plural} for TASK execution

**Note**: task-generator is only needed if spec-generator's tasks are too coarse
and require further breakdown into smaller work items.
```

**Traceability Chain**:

```text
REQ-NNN (WHAT/WHY) --> DESIGN-NNN (HOW) --> TASK-NNN (IMPLEMENTATION)
```

**Validation Rules**:

- Every TASK traces to a DESIGN
- Every DESIGN traces to a REQ
- No orphan requirements (REQ without DESIGN)
- Status consistency (child cannot be `done` if parent is `draft`)

**When to Use Specification vs Ideation**:

| Scenario                                    | Workflow      | Reason                             |
| ------------------------------------------- | ------------- | ---------------------------------- |
| Vague idea, unsure if worth doing           | Ideation      | Need validation first              |
| Feature approved, needs formal requirements | Specification | Skip ideation, proceed to specs    |
| Regulatory/compliance requirement           | Specification | Traceability is mandatory          |
| Quick feature, low complexity               | Standard      | Skip formality, implement directly |

**Output Locations** (Brain memory):

| Artifact     | Directory                                | Naming Pattern          |
| ------------ | ---------------------------------------- | ----------------------- |
| Requirements | `specs/{ENTITY-NNN-topic}/requirements/` | `REQ-NNN-kebab-case`    |
| Designs      | `specs/{ENTITY-NNN-topic}/design/`       | `DESIGN-NNN-kebab-case` |
| Tasks        | `specs/{ENTITY-NNN-topic}/tasks/`        | `TASK-NNN-kebab-case`   |

### Impact Analysis Orchestration

When a feature triggers **2+ domains** (code, architecture, security, operations, quality), orchestrate the impact analysis framework.

**Trigger Conditions**: Route to planner {worker} with impact analysis when:

- Feature touches 2+ domains (code, architecture, CI/CD, security, quality)
- Security-sensitive areas involved (auth, data handling, external APIs)
- Breaking changes expected (API modifications, schema changes)
- Infrastructure changes (build pipelines, deployment, new services)
- High-risk changes (production-critical, compliance-related)

**These consultations are independent by definition.** Each specialist assesses impact in their domain. No specialist needs another specialist's assessment to do their own. Always parallel.

**Handling Failed Consultations**:

1. **Retry once** with clarified prompt
2. If still failing, **log gap** and proceed with partial analysis
3. **Flag in plan** as "Incomplete: [missing domain]"
4. Critic must acknowledge incomplete consultation in review

**Disagree and Commit Protocol**:

When specialists have conflicting recommendations, apply the "Disagree and Commit" principle.

_Phase 1 - Decision (Dissent Encouraged)_:

- All specialist {worker_plural} present their positions with data and rationale
- Disagreements are surfaced explicitly and documented
- Each specialist argues for their recommendation
- Critic {worker} synthesizes positions and identifies core conflicts

_Phase 2 - Resolution_:

- If consensus emerges: proceed with agreed approach
- If conflict persists: escalate to high-level-advisor {worker} for decision
- High-level-advisor makes the call with documented rationale

_Phase 3 - Commitment (Alignment Required)_:

- Once decision is made, ALL specialist {worker_plural} commit to execution
- No passive-aggressive execution or "I told you so" behavior
- Specialists execute as if it was their preferred option
- Earlier disagreement cannot be used as excuse for poor execution

**Commitment Language**:

```text
"I disagree with [approach] because [reasons], but I commit to executing
[decided approach] fully. My concerns are documented for retrospective."
```

**Escalation Path**:

| Situation                                      | Action                                               |
| ---------------------------------------------- | ---------------------------------------------------- |
| Single specialist times out                    | Mark incomplete, proceed                             |
| Specialists disagree, data supports resolution | Critic decides, specialists commit                   |
| Specialists disagree, no clear winner          | Escalate to high-level-advisor                       |
| High-level-advisor decides                     | All specialist {worker_plural} commit and execute    |
| Chronic disagreement on same topic             | Flag for retrospective, consider process improvement |

**Failure Modes to Avoid**:

- Endless consensus-seeking that stalls execution
- Revisiting decided arguments during implementation
- Secretly rooting against the chosen approach
- Using disagreement as excuse for poor outcomes

### Planner vs Task-Generator

| {worker_type}      | Input         | Output                                | When to Use                        |
| ------------------ | ------------- | ------------------------------------- | ---------------------------------- |
| **planner**        | Epic/Feature  | Milestones with deliverables          | Breaking down large scope          |
| **task-generator** | PRD/Milestone | Atomic tasks with acceptance criteria | Before implementer/qa/devops work  |

The task-generator produces work items sized for individual {worker_plural} (implementer, qa, devops, architect). YOU ({lead_role}) route the work items to the appropriate execution {worker_plural}.
