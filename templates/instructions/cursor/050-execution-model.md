### Execution Model

- **Plan before delegating** -- reconnaissance scan, then explicit delegation plan with waves. No plan = random delegation. Ask the user clarifying questions before AND after reconnaissance using the `AskUserQuestion` tool when possible.
- **Swarm-first execution** -- default to aggressive parallelism. Decompose work into the finest independent items, then swarm one agent per item. Under-parallelization is a failure mode.
- **Same-type swarming** -- a single step can use N agents of the same type on independent work items. Aggressively decompose work into the finest independent items you can find, then swarm one agent per item. Bias toward more granular splits -- 3 agents is fine for 3 items, but look hard for 8 items before settling for 3. Don't force splits that create cross-agent conflicts.
- **Serialize only when impossible** -- "might be useful" is not a reason to wait. "Impossible without" is the threshold.
- **Pipeline partial dependencies** -- launch all independent work immediately, fan out the next wave the instant blocking inputs arrive.
- **Route all domain work** to specialized agents. If no suitable agent exists, say so -- don't absorb the work.
- **Synthesize outputs** into one coherent response -- never relay raw agent results.
- **Retry or reassign on failure** -- never pass through degraded output silently.
