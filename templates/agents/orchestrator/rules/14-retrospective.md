## Post-Retrospective Workflow (Automatic)

When a retrospective {worker} completes, it produces a **Structured Handoff Output** that you ({lead_role}) MUST process automatically. No user prompting required.

### Trigger

Retrospective {worker} output contains `## Retrospective Handoff` section.

### Automatic Processing Sequence

```text
Step 1: Parse Handoff Output
  - Extract Skill Candidates table
  - Extract Memory Updates table
  - Extract Git Operations table
  - Read Handoff Summary for routing decisions

Step 2: Route to Skillbook (IF skill candidates exist)
  - Filter skills with atomicity >= 70%
  - Route ADD/UPDATE/TAG/REMOVE operations

Step 3: Persist Memory Updates (IF memory updates exist)
  - Use Brain MCP tools directly for simple updates
  - Create/update notes in specified folders

Step 4: Execute Git Operations (IF git operations listed)
  - Stage any in-repo code files listed
  - Brain memories are managed via MCP tools (no git staging needed)
  - Do NOT commit (user will commit when ready)

Step 5: Report Completion
  - Summarize skills persisted
  - Summarize memory updates made
  - List files staged for commit
```

### Implementation Details

#### Step 1: Parse Handoff Output

Look for these sections in retrospective {worker} output:

```markdown
### Skill Candidates

| Skill ID | Statement | Atomicity | Operation | Target |
...

### Memory Updates

| Entity | Type | Content | File |
...

### Git Operations

| Operation | Path | Reason |
...

### Handoff Summary

- **Skills to persist**: N candidates
- **Memory files touched**: [list]
- **Recommended next**: [routing hint]
```

#### Step 2: Skillbook Routing

For each skill candidate with atomicity >= 70%, create a skillbook {worker} with the operation details.

#### Step 3: Memory Persistence

For simple updates, use Brain MCP tools directly:

```python
mcp__plugin_brain_brain__edit_note(
    identifier="[note-title]",
    operation="append",
    content="- [category] [Content from table] #tag"
)
```

For complex multi-note updates, create a memory {worker}.

#### Step 4: Git Operations

Execute directly via Bash:

```bash
# Stage any in-repo code files listed in Git Operations table
# Brain memories stored outside repo - no git staging needed for those
git add [code-files]
```

### Conditional Routing

| Condition                    | Action                                |
| ---------------------------- | ------------------------------------- |
| Skill Candidates table empty | Skip Step 2                           |
| Memory Updates table empty   | Skip Step 3                           |
| Git Operations table empty   | Skip Step 4                           |
| All tables empty             | Log warning, no downstream processing |

### Error Handling

| Error                    | Recovery                                            |
| ------------------------ | --------------------------------------------------- |
| Skillbook fails          | Log error, continue with memory/git                 |
| Memory persistence fails | Log error, continue with git                        |
| Git add fails            | Report failure to user                              |
| Malformed handoff output | Parse what is available, warn about missing sections |
