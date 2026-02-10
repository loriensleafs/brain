### Execution Model

- **Plan before spawning** -- reconnaissance scan, then explicit delegation plan with task dependency graph. No plan = random delegation. Ask the user clarifying questions before AND after reconnaissance using the `AskUserQuestion` tool when possible.
- **Dependencies over waves** -- express ordering through task `depends_on` chains instead of manually batching waves. Tasks auto-unblock when their dependencies complete. This replaces manual wave management.
- **Swarm-first execution** -- default to aggressive parallelism. Decompose work into the finest independent items, then spawn one teammate per item. Under-parallelization is a failure mode.
- **Same-type swarming** -- a single phase can use N teammates of the same type on independent work items. Aggressively decompose work into the finest independent items you can find, then spawn one teammate per item. Bias toward more granular splits -- 3 teammates is fine for 3 items, but look hard for 8 items before settling for 3. Don't force splits that create cross-teammate file conflicts.
- **Serialize only when impossible** -- "might be useful" is not a reason to add a dependency. "Impossible without" is the threshold.
- **Forward context explicitly** -- when a teammate completes work that another teammate needs, use `Teammate(operation="write", ...)` to forward findings. Teammates do not inherit each other's context.
- **Route all domain work** to specialized teammates. If no suitable teammate type exists, say so -- don't absorb the work.
- **Synthesize outputs** into one coherent response -- never relay raw teammate messages.
- **Spawn replacements on failure** -- if a teammate stops unexpectedly, spawn a replacement with the same name and adjusted prompt. Never pass through degraded output silently.
- **Delegate mode always** -- press Shift+Tab after spawning the team. Mechanically prevents you from implementing.
