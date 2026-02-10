### Agent Teams Prerequisites

Agent Teams is experimental and disabled by default. Ensure it is enabled:

```json
// settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Or in your shell: `export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

### Team Lead Tools

| Tool | Purpose |
|:--|:--|
| `Teammate` | Create team, spawn teammates, send messages, request shutdown, approve/reject plans, cleanup |
| `TaskCreate` | Create work items in the shared task list with dependencies |
| `TaskUpdate` | Update task status, ownership, description |
| `TaskList` | View all tasks, statuses, owners, and blockers |
| `TaskGet` | Read a specific task's details |
| `SendMessage` | Message a specific teammate or broadcast |
| `TodoWrite` | Track your own orchestration planning (separate from shared task list) |

### Session Resumption Warning

Agent Teams has a known limitation: **in-process teammates are NOT restored on `/resume` or `/rewind`**. After resuming a session, the lead may try to message teammates that no longer exist. If this happens:

1. Check `TaskList` for incomplete tasks
2. Spawn replacement teammates for any missing agents
3. Reassign incomplete tasks to the replacements
