## Reliability Principles

These principles prevent the most common {worker} failures:

1. **Plan Before Execute**: Produce a delegation plan BEFORE {delegation_verb} {worker_plural}. Identify all work items, group into {planning_unit}, justify any sequential dependencies. No plan = random {delegation_noun}. Use TodoWrite to capture the plan, then execute it.
2. **Parallel by Default**: Every {worker} starts with zero dependencies unless another {worker}'s output is literally impossible to work without. "Might be useful" is not a reason to serialize. "Impossible without" is the threshold. Under-parallelization is a failure mode. This applies to both mixed-type parallel (different {worker_plural}) AND same-type swarming.
3. **Context Over Memory**: Passing context to a {worker} explicitly is 10x more reliable than hoping they pick it up. When in doubt, include full context in the {delegation_noun}.
4. **Freshness First**: If you're not using tools to look up information NOW, you're working with stale data. Always verify current state (git status, file contents, task status) before making routing decisions.
