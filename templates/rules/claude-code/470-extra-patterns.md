### Debate / Challenge Pattern

Agent Teams enable a pattern impossible with subagents -- teammates can directly challenge each other:

```python
Task(team_name="debug", name="hypothesis-a", subagent_type="analyst",
    prompt="""Investigate auth timeout. Your hypothesis: token expiry issue.
    Try to PROVE this. Send findings to team-lead AND hypothesis-b.
    If hypothesis-b sends counter-evidence, address it.""",
    run_in_background=True)

Task(team_name="debug", name="hypothesis-b", subagent_type="analyst",
    prompt="""Investigate auth timeout. Your hypothesis: connection pool exhaustion.
    Try to PROVE this. Send findings to team-lead AND hypothesis-a.
    If hypothesis-a sends counter-evidence, address it.""",
    run_in_background=True)
```

### Agent Teams Quick Reference

#### Team Lifecycle

```text
1. Create team:     Teammate(operation="spawnTeam", team_name="...")
2. Create tasks:    TaskCreate(...) x N with depends_on chains
3. Spawn teammates: Task(team_name="...", name="...", ...) x N
4. Delegate mode:   Shift+Tab
5. Monitor:         TaskList, read inbox, forward context
6. Shutdown:        Teammate(operation="requestShutdown", ...) for each
7. Cleanup:         Teammate(operation="cleanup", team_name="...")
```

#### Teammate Communication

| Action | Tool Call |
|:--|:--|
| Message one teammate | `Teammate(operation="write", target_agent_id="name", value="...")` |
| Message all teammates | `Teammate(operation="broadcast", name="team-lead", value="...")` |
| Read incoming messages | Check your inbox (automatic in in-process mode) |
| Forward findings | Read from sender's message, write to recipient |

#### Task Management

| Action | Tool Call |
|:--|:--|
| Create task | `TaskCreate(team_name="...", subject="...", description="...", depends_on=[...])` |
| Update task status | `TaskUpdate(team_name="...", task_id=N, status="completed")` |
| View all tasks | `TaskList(team_name="...")` |
| View one task | `TaskGet(team_name="...", task_id=N)` |

#### Plan Approval

| Action | Tool Call |
|:--|:--|
| Spawn with plan required | `Task(team_name="...", ..., plan_mode_required=True)` |
| Approve plan | `Teammate(operation="approvePlan", target_agent_id="...", request_id="...")` |
| Reject plan | `Teammate(operation="rejectPlan", target_agent_id="...", request_id="...", reason="...")` |

### Extended Anti-Patterns (Agent Teams)

| Anti-Pattern | Do This Instead |
|:--|:--|
| Spawning teammates before creating tasks | Create ALL tasks first, then spawn teammates |
| Two teammates editing the same file | Assign non-overlapping file scopes per teammate |
| Broadcasting for every message | Use targeted `write` to specific teammate |
| Implementing in the lead session | Activate delegate mode (Shift+Tab) |
| Forgetting to forward context | Teammates have no shared memory of each other's work |
| Skipping team cleanup at session end | Orphaned teams persist on disk and waste resources |
| One teammate doing 5 sequential tasks | Swarm 5 teammates on independent items |

### Extended Always Do (Agent Teams)

- **Create ALL tasks before spawning teammates** -- prevents teammates from claiming tasks before the dependency graph is complete
- **Activate delegate mode (Shift+Tab) after spawning** -- mechanically prevents you from implementing
- **Shut down all teammates before session end** -- orphaned teammates waste tokens and can conflict with future sessions
- **Forward context explicitly** -- teammates don't inherit your conversation. Use `Teammate(operation="write", ...)` to pass findings between teammates.

### Extended Never Do (Agent Teams)

- Spawn teammates before creating all tasks (dependency graph must be complete first)
- Let two teammates edit the same file (last write wins, causes data loss)
- Broadcast when a targeted message would suffice (broadcast costs scale with team size)
- Skip team cleanup at session end (orphaned teams persist on disk)

### Extended Critical Constraints (Agent Teams)

| Constraint | Source |
|:--|:--|
| Create tasks before spawning teammates | Agent Teams protocol |
| Delegate mode after team creation | Agent Teams protocol |
| Shut down + cleanup before session end | Agent Teams protocol |
