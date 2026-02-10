## Team Lifecycle

### Step 1: Create Team

```python
Teammate(
    operation="spawnTeam",
    team_name="feature-auth-refactor",
    description="Refactoring authentication module across 5 subsystems"
)
```

### Step 2: Create Tasks with Dependencies

```python
# PARALLEL RESEARCH (no dependencies -- all run immediately)
TaskCreate(
    team_name="feature-auth-refactor",
    subject="Research auth subsystem",
    description="Investigate JWT validation in src/auth/. Document current state, issues, and patterns.",
)  # -> Task #1

TaskCreate(
    team_name="feature-auth-refactor",
    subject="Research database layer",
    description="Investigate session storage in src/db/. Document schema, queries, and bottlenecks.",
)  # -> Task #2

# REVIEWS (depend on ALL research completing)
TaskCreate(
    team_name="feature-auth-refactor",
    subject="Architecture design review",
    description="Review findings from tasks #1-2. Produce design spec with module boundaries.",
    depends_on=[1, 2]  # blocked until all research done
)  # -> Task #3

# IMPLEMENTATION (depends on design review)
TaskCreate(
    team_name="feature-auth-refactor",
    subject="Implement auth module changes",
    description="""Implement changes per design spec from task #3.
    SCOPE: ONLY files in src/auth/. Do NOT modify src/api/, src/db/.""",
    depends_on=[3]
)  # -> Task #4

# TESTING (depends on all implementation)
TaskCreate(
    team_name="feature-auth-refactor",
    subject="QA validation",
    description="Run full test suite. Validate auth + DB integration.",
    depends_on=[4]
)  # -> Task #5
```

### Step 3: Spawn Teammates

Spawn ALL teammates up front. Idle teammates wait for their tasks to unblock, then self-claim.

```python
# Research swarm
Task(
    team_name="feature-auth-refactor",
    name="analyst-auth",
    subagent_type="analyst",
    prompt="""You are analyst-auth on team feature-auth-refactor.
    Claim task #1 from the shared task list.
    When done, mark it complete and send your findings to team-lead.
    Then check for other available tasks.""",
    run_in_background=True
)

Task(
    team_name="feature-auth-refactor",
    name="analyst-db",
    subagent_type="analyst",
    prompt="""You are analyst-db on team feature-auth-refactor.
    Claim task #2 from the shared task list.
    When done, mark it complete and send your findings to team-lead.
    Then check for other available tasks.""",
    run_in_background=True
)

# Reviews -- spawn now, they idle until tasks unblock
Task(
    team_name="feature-auth-refactor",
    name="architect",
    subagent_type="architect",
    prompt="""You are architect on team feature-auth-refactor.
    Wait for task #3 to become available (blocked by research tasks).
    When unblocked, claim it, review all research findings, and produce a design spec.
    Send your design to team-lead and mark task complete.""",
    run_in_background=True
)

# Implementation -- spawn now, idles until design review completes
Task(
    team_name="feature-auth-refactor",
    name="impl-auth",
    subagent_type="implementer",
    prompt="""You are impl-auth on team feature-auth-refactor.
    Wait for task #4 to become available (blocked by design review).
    When unblocked, claim it and implement auth module changes.
    SCOPE: ONLY files in src/auth/. Do NOT modify src/api/, src/db/.
    Send results to team-lead and mark task complete.""",
    run_in_background=True
)

# QA -- spawn now, idles until implementation completes
Task(
    team_name="feature-auth-refactor",
    name="qa",
    subagent_type="qa",
    prompt="""You are qa on team feature-auth-refactor.
    Wait for task #5 to become available (blocked by implementation).
    When unblocked, claim it, run the full test suite, validate integration.
    Send results to team-lead and mark task complete.""",
    run_in_background=True
)
```

### Step 4: Activate Delegate Mode

Press **Shift+Tab** to lock yourself into coordination-only mode. You can still:

- Read inbox messages from teammates
- Send messages to teammates
- Create/update tasks
- View task list status
- Approve/reject plans

You cannot:

- Edit files
- Run implementation commands
- Write code

### Step 5: Monitor, Route, Synthesize

```python
# Check task progress
TaskList(team_name="feature-auth-refactor")

# When analyst-auth sends findings, forward to architect
Teammate(
    operation="write",
    target_agent_id="architect",
    value="analyst-auth findings: [summary]. Use this for your design review."
)

# Broadcast status check to all
Teammate(
    operation="broadcast",
    name="team-lead",
    value="Status check: Report your progress."
)
```

### Step 6: Shutdown and Cleanup

```python
# Request shutdown of each teammate
Teammate(
    operation="requestShutdown",
    target_agent_id="analyst-auth",
    reason="All tasks complete"
)
# ... repeat for each teammate

# After all teammates confirm shutdown
Teammate(
    operation="cleanup",
    team_name="feature-auth-refactor"
)
```
