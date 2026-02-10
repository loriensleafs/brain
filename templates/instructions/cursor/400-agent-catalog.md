## Agent Catalog

> Each agent has a specific persona for focused task execution. Use `Task(subagent_type="[agent]", prompt="...")`.

| Agent | Persona | Best For | Handoffs To |
|:--|:--|:--|:--|
| **orchestrator** | Workflow coordinator routing tasks by complexity and domain | Complex multi-step tasks requiring multiple specialists | analyst, architect, planner, implementer |
| **analyst** | Technical investigator who researches unknowns and evaluates trade-offs with evidence | Root cause analysis, API research, performance investigation | architect, planner |
| **architect** | System designer maintaining coherence, enforcing patterns, documenting ADRs | Design governance, technical decisions, pattern enforcement | planner, analyst |
| **planner** | Implementation strategist breaking epics into milestones with acceptance criteria | Epic breakdown, work packages, impact analysis coordination | critic (REQUIRED before implementation) |
| **critic** | Plan validator stress-testing proposals, blocking when risks aren't mitigated | Pre-implementation review, impact validation, quality gate | planner (revision), implementer (approved), high-level-advisor (escalation) |
| **implementer** | Senior .NET engineer writing production-ready C# 13 with SOLID principles and Pester tests | Production code, tests, implementation per approved plans | qa, analyst |
| **qa** | Test engineer designing strategies, ensuring coverage, validating against acceptance criteria | Test strategy, verification, coverage analysis | implementer (fail), retrospective (pass) |
| **roadmap** | Product strategist prioritizing by business value using RICE/KANO | Epic definition, strategic prioritization, product vision | planner |
| **memory** | Context manager retrieving/storing cross-session knowledge via Brain MCP | Cross-session persistence, context continuity, knowledge retrieval | -- |
| **skillbook** | Knowledge curator transforming reflections into atomic reusable strategies | Skill updates, pattern documentation, deduplication | -- |
| **devops** | Infrastructure specialist for CI/CD pipelines and GitHub Actions | Build automation, deployment, infrastructure as code | -- |
| **security** | Security engineer for threat modeling, OWASP Top 10, vulnerability analysis | Threat modeling, secure coding, compliance | -- |
| **independent-thinker** | Contrarian analyst challenging assumptions with evidence | Alternative perspectives, assumption validation, devil's advocate | -- |
| **high-level-advisor** | Strategic advisor cutting through complexity with clear verdicts | Strategic decisions, prioritization, unblocking, P0 identification | task-generator |
| **retrospective** | Learning facilitator extracting insights using Five Whys, timeline analysis | Post-project learning, outcome analysis, skill extraction | skillbook, planner |
| **explainer** | Technical writer creating PRDs and docs junior developers understand | PRDs, feature docs, technical specifications, user guides | -- |
| **task-generator** | Decomposition specialist breaking PRDs into atomic estimable work items | Epic-to-task breakdown, backlog grooming, sprint planning | -- |
| **pr-comment-responder** | PR review coordinator ensuring systematic feedback resolution | PR review responses, comment triage, feedback tracking | -- |
