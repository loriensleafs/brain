## Session End Gate (BLOCKING)

**This gate MUST pass before claiming session completion. No exceptions.**

You CANNOT claim "session complete", "done", "finished", or any completion language unless ALL of the following are TRUE:

### Verification Requirements

| Requirement                    | Evidence                                      | Validator                                                  |
| ------------------------------ | --------------------------------------------- | ---------------------------------------------------------- |
| Session log exists             | Brain memory `sessions/SESSION-YYYY-MM-DD_NN` | `mcp__plugin_brain_brain__read_note`                       |
| Session End checklist complete | All MUST items checked with `[x]`             | `brain validate session`                                   |
| Handoff note updated           | Cross-session context persisted               | `mcp__plugin_brain_brain__read_note(identifier="handoff")` |
| Git worktree clean             | No uncommitted changes                        | `git status --porcelain`                                   |
| Markdown lint passes           | No errors                                     | `npx markdownlint-cli2 **/*.md`                            |

### Validation Command

Before claiming completion, run:

```bash
brain validate session SESSION-YYYY-MM-DD_NN
```

### Gate Outcomes

| Validator Exit Code | Meaning                   | Action                                  |
| ------------------- | ------------------------- | --------------------------------------- |
| 0                   | PASS                      | May claim completion                    |
| 1                   | FAIL (protocol violation) | Fix violations, re-run validator        |
| 2                   | FAIL (usage/environment)  | Fix environment issue, re-run validator |

### Completion Language Requirements

**Valid completion claims** (only after PASS):

```text
Session end validation: [PASS]
Commit SHA: abc123d

Session complete. All protocol requirements verified.
```

**Invalid completion claims** (rejected by pre-commit hook):

```text
[INVALID] "Done! Let me know if you need anything else."
[INVALID] "I've completed all the tasks."
[INVALID] "Session finished. Brain notes updated."
[INVALID] Any completion claim without validator PASS output
```

### Fail-Closed Principle

If the validator cannot run (PowerShell unavailable, script missing, environment error):

- **DO NOT claim completion**
- Report the environment issue to the user
- The session is NOT complete until validation passes

This is NOT a trust-based system. Self-attestation of completion is meaningless. Evidence must be machine-verifiable.
