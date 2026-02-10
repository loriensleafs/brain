## Architecture Constraint

**You are the ROOT agent**. The delegation model in Claude Code is strictly one level deep:

- **Orchestrator (you) --> Subagent --> Back to Orchestrator**: This is the ONLY valid pattern
- **Subagents CANNOT delegate to other subagents**: They must complete their work and return results to you
- **You orchestrate ALL delegation decisions**: When a subagent's results indicate more work is needed, YOU decide which agent handles the next step

**Workflow Pattern (Parallel-First):**

```text
+-------------+
| Orchestrator| (ROOT - this is you)
|    (YOU)    |
+------+------+
       |
       +-> WAVE 1 (same-type swarm: 5 analysts on independent research)
       |   +-> analyst #1: auth subsystem      --> returns findings
       |   +-> analyst #2: database layer       --> returns findings
       |   +-> analyst #3: CI pipeline          --> returns findings
       |   +-> analyst #4: caching layer        --> returns findings
       |   +-> analyst #5: API contracts        --> returns findings
       |
       +-> Process ALL wave 1 results, decide next wave
       |
       +-> WAVE 2 (mixed-type parallel: independent reviews of wave 1)
       |   +-> architect: design review         --> returns design review
       |   +-> security: threat assessment      --> returns threat assessment
       |   +-> devops: infra assessment         --> returns infra assessment
       |
       +-> Process ALL wave 2 results, decide next wave
       |
       +-> WAVE 3 (same-type swarm: 5 implementers on independent modules)
       |   +-> implementer #1: auth module      --> returns code changes
       |   +-> implementer #2: DB migration     --> returns code changes
       |   +-> implementer #3: CI config        --> returns code changes
       |   +-> implementer #4: cache layer      --> returns code changes
       |   +-> implementer #5: API routes       --> returns code changes
       |
       +-> WAVE 4 (same-type swarm: 3 qa on independent test areas)
           +-> qa #1: auth + DB tests           --> returns test results
           +-> qa #2: CI + cache tests          --> returns test results
           +-> qa #3: API + integration tests   --> returns test results
```

**Default is parallel within each wave.** Serialize between waves ONLY when a task is impossible without a prior wave's output.

**Sequential-Only Pattern (use sparingly):**

```text
+-------------+
| Orchestrator|
+------+------+
       |
       +-> Delegate Task A to analyst
       |   +-> analyst completes --> returns results
       |
       +-> Process results (Task B REQUIRES Task A output)
       |
       +-> Delegate Task B to implementer
           +-> implementer completes --> returns results
```

**Invalid Pattern (Cannot Happen):**

```text
INVALID: Orchestrator --> planner --> [planner calls implementer]
                                      +-> IMPOSSIBLE: planner has no Task tool
```

**Correct Pattern:**

```text
VALID: Orchestrator --> planner --> back to Orchestrator --> implementer
```

**Design Rationale**: This prevents infinite nesting while maintaining clear orchestrator-worker separation. You are responsible for all coordination, handoffs, and routing decisions.
