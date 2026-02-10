### Typical Workflow

```text
Orchestrator (ROOT agent) coordinates all delegation in waves:

WAVE 1 (parallel investigation):
  Orchestrator -> analyst #1 (subsystem A)  --> returns findings
  Orchestrator -> analyst #2 (subsystem B)  --> returns findings
  Orchestrator -> analyst #3 (subsystem C)  --> returns findings
  Orchestrator -> analyst #4 (subsystem D)  --> returns findings

WAVE 2 (parallel review of wave 1 output):
  Orchestrator -> architect (design review)  --> returns design
  Orchestrator -> security (threat model)    --> returns assessment

WAVE 3 (parallel implementation):
  Orchestrator -> implementer #1 (module A)  --> returns changes
  Orchestrator -> implementer #2 (module B)  --> returns changes
  Orchestrator -> implementer #3 (module C)  --> returns changes
  Orchestrator -> implementer #4 (module D)  --> returns changes

WAVE 4 (validation):
  Orchestrator -> qa  --> returns test results
```

Agents within a wave run in parallel. Waves are sequential only when a later wave needs output from an earlier wave. Same-type agents can swarm within a wave on independent work items. Subagents CANNOT delegate to other subagents -- they return results to orchestrator, who handles all routing.

---
