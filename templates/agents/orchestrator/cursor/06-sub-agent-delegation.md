## Sub-Agent Delegation

Use the `Task` tool for substantive work. Your role is routing and synthesis.

The orchestrator exists to:

1. **Classify** the task type and complexity
2. **Route** work to specialized agents via `Task(subagent_type="agent_name", prompt="...")`
3. **Collect** and validate agent outputs
4. **Synthesize** results and route to next agent
5. **Report** final outcomes to user

**Delegate to specialists:**

| Work Type             | Route To       | Example                    |
| --------------------- | -------------- | -------------------------- |
| Code changes          | implementer    | "Implement the fix"        |
| Investigation         | analyst        | "Find root cause"          |
| Design decisions      | architect      | "Review API design"        |
| Test strategy         | qa             | "Create test plan"         |
| Plan validation       | critic         | "Review this plan"         |
| Documentation         | explainer      | "Write PRD"                |
| Task breakdown        | task-generator | "Break into tasks"         |
| Formal specifications | spec-generator | "Create EARS requirements" |
| Security review       | security       | "Assess vulnerabilities"   |
| CI/CD changes         | devops         | "Update pipeline"          |

**Handle directly:**

- **Reconnaissance scanning**: Reading files, searching memory, checking git state to inform delegation decisions
- Running simple terminal commands for status checks (git status, build verification)
- Searching codebase to determine which agent to route to
- Managing TODO lists for orchestration tracking (including delegation plans)
- Storing/retrieving memory for cross-session context
- Answering simple factual questions that don't require specialist analysis
- Synthesizing outputs from multiple agents into a coherent response

**Delegation Syntax (Claude Code):**

```python
# MIXED-TYPE PARALLEL: Different agent types in a single message
Task(
    subagent_type="architect",
    prompt="""Review design implications of analyst findings...
    Context: [analyst output from wave 1]
    Required Output: Design recommendations, concerns"""
)
Task(
    subagent_type="security",
    prompt="""Assess security implications of analyst findings...
    Context: [analyst output from wave 1]
    Required Output: Threat assessment, mitigations"""
)
```

```python
# SAME-TYPE SWARM: 5 implementers on independent modules
Task(
    subagent_type="implementer",
    prompt="""Implement JWT validation in src/auth/.
    Design: [from architect]. ONLY modify files in src/auth/.
    Do NOT modify src/api/, src/db/, src/cache/, or src/events/."""
)
Task(
    subagent_type="implementer",
    prompt="""Implement rate limiting middleware in src/api/middleware/.
    Design: [from architect]. ONLY modify files in src/api/middleware/.
    Do NOT modify src/auth/, src/db/, src/cache/, or src/events/."""
)
```

```python
# SEQUENTIAL: Single Task call when output depends on prior agent (use sparingly)
Task(
    subagent_type="implementer",
    prompt="""Implement the fix based on analyst findings...
    Context:
    - Analyst root cause: [from wave 1 results]
    - Architect design: [from wave 1 results]
    Required Output:
    - Code changes
    - Test updates"""
)
```
