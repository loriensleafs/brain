## Same-Type {worker_type} Swarming

Parallel execution is not limited to different specialist types. You can (and should) launch multiple {worker_plural} of the SAME type when a single step involves independent work items.

**The principle**: Aggressively decompose work into the finest independent items you can find, then {delegation_noun} one {worker} per item.

### When to Swarm Same-Type

| Signal                                           | Swarm Type        | Example                                                                                         |
| ------------------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------- |
| Research spans multiple independent topics       | analyst x N       | 6 analysts: API options, DB options, auth patterns, caching, CI, competitor                     |
| Implementation touches independent files/modules | implementer x N   | 8 implementers: auth, user service, API routes, DB migration, config, cache, middleware, events |
| Multiple documents need writing                  | explainer x N     | 5 explainers: API docs, user guide, migration guide, admin guide, architecture overview         |
| Testing spans independent components             | qa x N            | 5 qa: unit, integration, e2e, performance, security tests                                       |
| Review covers independent plans/artifacts        | critic x N        | 4 critics: PRD review, architecture review, task breakdown review, security plan review         |
| Security assessment covers independent surfaces  | security x N      | 4 security: API endpoints, auth flow, data storage, third-party integrations                    |

### Splitting Rules for Same-Type Swarms

1. **Non-overlapping scope**: Each {worker} has a clearly defined boundary. Use file paths, module names, or topic boundaries
2. **Self-contained context**: Each {worker} gets ALL the context it needs in its prompt
3. **Explicit exclusions**: Tell each {worker} what NOT to touch. "ONLY files in src/auth/" AND "Do NOT modify src/api/"
4. **Synthesis responsibility**: YOU ({lead_role}) synthesize the swarm results. Check for conflicts, resolve contradictions

### Anti-Patterns

| Anti-Pattern                                                | Why It Fails                             | Correct Pattern                                                       |
| ----------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| Swarm implementers on files that import each other          | Interface changes in one break the other | Sequential, or architect defines interfaces first                     |
| Swarm analysts on the same question from "different angles" | Redundant work, conflicting answers      | One analyst, or use different specialist types                        |
| Swarm without explicit scope boundaries                     | {worker_plural} step on each other's files | Always define ONLY/Do NOT boundaries                                |
| Swarm 3 {worker_plural} when work could be split into 8    | Under-decomposition wastes parallelism   | Aggressively split along file/module/topic boundaries                 |
| Force 10 {worker_plural} on 3 genuinely coupled items      | Manufactured splits create conflicts     | Match swarm size to actual independent items                          |
