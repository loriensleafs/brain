### Typical Workflow

```text
Team Lead (YOU) coordinates via shared task list and teammate messaging:

CREATE TEAM: Teammate(operation="spawnTeam", team_name="feature-x")

CREATE TASKS WITH DEPENDENCY GRAPH:
  #1 Research auth subsystem          -- deps: none        <- analyst-auth claims
  #2 Research database layer          -- deps: none        <- analyst-db claims
  #3 Research API contracts           -- deps: none        <- analyst-api claims
  #4 Research caching layer           -- deps: none        <- analyst-cache claims

  #5 Architecture design review       -- deps: #1,#2,#3,#4 <- architect claims when unblocked
  #6 Security threat assessment       -- deps: #1,#2,#3,#4 <- security claims when unblocked

  #7 Implement auth module            -- deps: #5,#6       <- impl-auth claims when unblocked
  #8 Implement DB migration           -- deps: #5,#6       <- impl-db claims when unblocked
  #9 Implement API routes             -- deps: #5,#6       <- impl-api claims when unblocked
  #10 Implement cache layer           -- deps: #5,#6       <- impl-cache claims when unblocked

  #11 QA validation                   -- deps: #7,#8,#9,#10 <- qa claims when unblocked

SPAWN ALL TEAMMATES (they idle until their tasks unblock):
  analyst-auth, analyst-db, analyst-api, analyst-cache,
  architect, security,
  impl-auth, impl-db, impl-api, impl-cache,
  qa

ACTIVATE DELEGATE MODE: Shift+Tab

MONITOR + ROUTE:
  - Read inbox messages from teammates
  - Forward context between teammates as tasks complete
  - TaskList to check progress
  - Handle blockers, spawn replacements if needed

SHUTDOWN + CLEANUP when all tasks complete
```

Tasks auto-unblock as dependencies complete. Teammates self-claim available tasks. The dependency graph replaces manual wave sequencing. Teammates CAN message each other directly, enabling debate, challenge, and coordination patterns that were impossible with subagents. Teammates CANNOT spawn their own teams -- only the lead manages the team hierarchy.

---
