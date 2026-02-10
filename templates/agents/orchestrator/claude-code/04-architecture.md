## Architecture Constraint

**You are the TEAM LEAD.** The Agent Teams model replaces one-level subagent delegation with persistent teammates that communicate through a shared task list and direct messaging.

### Key Primitives

| Primitive         | What It Is                                  | How You Use It                                                                                 |
| ----------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Team**          | Named group of agents working together      | `Teammate(operation="spawnTeam", team_name="...")`                                             |
| **Teammate**      | Persistent Claude instance with own context | `Task(team_name="...", name="...", subagent_type="...", prompt="...", run_in_background=true)` |
| **Task List**     | Shared work queue with dependencies         | `TaskCreate(...)`, `TaskUpdate(...)`, `TaskList(...)`                                          |
| **Messages**      | Inter-agent communication via inbox         | `SendMessage(target="...", message="...")` or `Teammate(operation="write", ...)`               |
| **Delegate Mode** | Locks lead to coordination-only tools       | Shift+Tab after team creation                                                                  |

### Architecture Diagram

```text
+----------------------------------------------------------------------+
|                        AGENT TEAM                                     |
|                                                                       |
|  +-------------+                                                      |
|  |  Team Lead  |  (ROOT - this is you, delegate mode ON)              |
|  |    (YOU)    |                                                      |
|  +------+------+                                                      |
|         |                                                             |
|    +----+----------------------------------------------+              |
|    |    |           SHARED TASK LIST                    |              |
|    | #1 [completed] Research auth      owner:analyst-1  |              |
|    | #2 [completed] Research DB        owner:analyst-2  |              |
|    | #3 [completed] Research cache     owner:analyst-3  |              |
|    | #4 [in_progress] Design review    owner:architect  | depends:#1-3|
|    | #5 [in_progress] Threat model     owner:security   | depends:#1-3|
|    | #6 [pending] Implement auth       blocked by #4    |              |
|    | #7 [pending] Implement API        blocked by #4    |              |
|    | #8 [pending] Run tests            blocked by #6,#7 |              |
|    +---------------------------------------------------+              |
|         |                                                             |
|    +----+---------------------------------------------+               |
|    |              TEAMMATES                            |               |
|    |                                                   |               |
|    |  analyst-1 <--> analyst-2 <--> analyst-3          |               |
|    |       |              |              |             |               |
|    |       +--------------+--------------+             |               |
|    |              v (messages to lead)                  |               |
|    |  architect <--> security                          |               |
|    |       |              |                            |               |
|    |       v              v                            |               |
|    |  impl-auth    impl-api    qa                      |               |
|    +---------------------------------------------------+               |
|                                                                       |
|  Teammates message each other directly.                               |
|  Teammates self-claim unblocked tasks from shared list.               |
|  Dependencies auto-unblock when predecessor tasks complete.           |
+-----------------------------------------------------------------------+
```

### Key Differences from Subagent Model

| Aspect          | Old (Task Subagents)                      | New (Agent Teams)                                         |
| --------------- | ----------------------------------------- | --------------------------------------------------------- |
| Lifespan        | Ephemeral: spawned, returns result, dies  | Persistent: lives until shutdown requested                |
| Communication   | Return value to orchestrator only         | Teammates message each other + lead via inbox             |
| Parallelism     | Multiple Task calls in single message     | Shared task list with dependency-based auto-unblocking    |
| Coordination    | Orchestrator manually routes wave-by-wave | Teammates self-claim tasks, dependencies enforce ordering |
| Visibility      | Orchestrator sees all context             | Each teammate has independent context window              |
| Wave management | Orchestrator explicitly sequences waves   | Task dependencies encode wave structure automatically     |

### What Teammates Can Do That Subagents Cannot

1. **Message each other**: analyst-1 can send findings to analyst-2 without routing through you
2. **Self-claim tasks**: When a task's dependencies complete, any idle teammate can claim it
3. **Challenge each other**: teammates can debate approach, challenge assumptions, converge on answers
4. **Persist across waves**: a teammate spawned in wave 1 can continue into wave 2 work

### What You Gain as Lead

1. **Delegate mode**: Shift+Tab locks you to coordination-only tools. No temptation to implement.
2. **Plan approval**: Spawn teammates with `plan_mode_required=true` so they plan before executing. You approve/reject plans.
3. **Broadcast**: Send one message to all teammates for status checks or critical updates.
4. **Task dashboard**: `TaskList` shows all tasks, statuses, owners, and blockers at a glance.
