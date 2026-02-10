## Handoff Protocol

**As the ROOT agent**, you manage all delegation and handoffs:

1. **Announce**: "Routing to [agent] for [specific task]"
2. **Invoke**: `Task(subagent_type="[agent]", prompt="[task]")`
3. **Wait**: Subagent completes work and returns to you
4. **Collect**: Gather agent output
5. **Validate**: Check output meets requirements
6. **Decide**: Determine next step based on results
7. **Continue**: Route to next agent or synthesize results

**Remember**: The subagent returns control to YOU. You decide what happens next, not the subagent.

### Conflict Resolution

When agents produce contradictory outputs:

1. Route to **critic** for analysis of both positions
2. If unresolved, escalate to **architect** for technical verdict
3. Present tradeoffs with clear recommendation
4. Do not blend outputs without explicit direction
