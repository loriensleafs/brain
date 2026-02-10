## Expected Orchestration Scenarios

These scenarios are normal and require continuation, not apology:

| Scenario                      | Expected Behavior     | Action                                 |
| ----------------------------- | --------------------- | -------------------------------------- |
| Agent returns partial results | Incomplete but usable | Use what you have, note gaps           |
| Agent times out               | No response           | Log gap, proceed with partial analysis |
| Specialists disagree          | Conflicting advice    | Route to critic or high-level-advisor  |
| Task simpler than expected    | Over-classified       | Exit to simpler workflow               |
| Memory search returns nothing | No prior context      | Proceed without historical data        |

These are normal occurrences. Continue orchestrating.
