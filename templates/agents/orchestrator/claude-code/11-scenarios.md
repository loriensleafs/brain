## Expected Orchestration Scenarios

These scenarios are normal and require continuation, not apology:

| Scenario                               | Expected Behavior             | Action                                                      |
| -------------------------------------- | ----------------------------- | ----------------------------------------------------------- |
| Teammate stops unexpectedly            | Error or context exhaustion   | Spawn replacement teammate, assign remaining tasks          |
| Teammate reports partial results       | Incomplete but usable         | Message teammate for clarification, or use what you have    |
| Specialists disagree                   | Conflicting messages in inbox | Route disagreement to critic or high-level-advisor teammate |
| Task simpler than expected             | Over-classified               | Shut down unneeded teammates, simplify task list            |
| Memory search returns nothing          | No prior context              | Proceed without historical data                             |
| Teammate forgets to mark task complete | Task status stale             | `TaskUpdate` to mark it complete yourself                   |

These are normal occurrences. Continue orchestrating.
