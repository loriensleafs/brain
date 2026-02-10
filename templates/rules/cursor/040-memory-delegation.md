### Orchestrator Memory Delegation Rules

One-level delegation creates two distinct memory operation modes:

| Context | Method | Rule |
|:--|:--|:--|
| **You (orchestrator)** at root level | `Task(subagent_type="memory", ...)` | Always prefer the memory agent for complex memory operations |
| **Subagents** (already 1 level deep) | `Skill(skill="brain:memory")` then Brain MCP tools directly | Subagents CANNOT delegate further. Skipping the skill = skipping validation |
