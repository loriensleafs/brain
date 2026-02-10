## Inter-Agent Communication Patterns

Agent Teams unlock communication patterns impossible with subagents.

### Pattern: Debate / Challenge

Spawn teammates that challenge each other's conclusions:

```python
Task(team_name="debug-session", name="hypothesis-a", subagent_type="analyst",
    prompt="""Investigate the auth timeout bug. Your hypothesis: it is a token expiry issue.
    Try to PROVE this hypothesis. Send findings to team-lead and hypothesis-b.
    If hypothesis-b sends counter-evidence, address it.""",
    run_in_background=True)

Task(team_name="debug-session", name="hypothesis-b", subagent_type="analyst",
    prompt="""Investigate the auth timeout bug. Your hypothesis: it is a connection pool exhaustion issue.
    Try to PROVE this hypothesis. Send findings to team-lead and hypothesis-a.
    If hypothesis-a sends counter-evidence, address it.""",
    run_in_background=True)
```

### Pattern: Forward Context Between Teammates

When analyst completes research, forward findings to architect:

```python
# In your message handling loop, when analyst-auth sends findings:
Teammate(
    operation="write",
    target_agent_id="architect",
    value="""Research findings from analyst-auth:
    - JWT validation has 3 bypass paths
    - Token refresh lacks rate limiting
    - Session store uses deprecated Redis API
    Use these findings for your design review (task #6)."""
)
```

### Pattern: Status Broadcast

```python
Teammate(
    operation="broadcast",
    name="team-lead",
    value="Status check: Report your current task, progress, and any blockers."
)
```

Use sparingly. Broadcasting sends N messages for N teammates. Prefer targeted messages.
