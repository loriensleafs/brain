## Memory Protocol

Use Brain MCP memory tools for cross-session context:

**Before multi-step reasoning:**

```python
mcp__plugin_brain_brain__search(query="orchestration patterns")
mcp__plugin_brain_brain__read_note(identifier="orchestration-[relevant-pattern]")
```

**At milestones (or every 5 turns):**

```python
mcp__plugin_brain_brain__write_note(
    title="orchestration-[topic]",
    folder="decisions",
    content="""
## Orchestration Decision: [Topic]

**{lead_role} Performance:**
- Success patterns: [what worked]
- Failure modes: [what failed]

**Routing Decisions:**
- Effective: [what worked]
- Ineffective: [what failed]

**Solutions:**
- Recurring problems resolved: [solutions]

**Conventions:**
- Project patterns discovered: [patterns]
"""
)
```
