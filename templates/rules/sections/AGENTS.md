# Brain Agent System

For non-trivial tasks, delegate to specialized agents. Default: `Agent(subagent_type="orchestrator", prompt="...")`

When `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set, the orchestrator uses Agent Teams (persistent teammates, shared task list, direct inter-agent messaging). Otherwise it uses standard `Agent()` delegation.

---

## Initialization (BLOCKING)

Before ANY work:

1. `mcp__plugin____brain__bootstrap_context` (loads project state, active features, recent decisions)
2. `mcp__plugin____brain__session({ operation: "get" })` (check for open sessions)

---

## Agents

### Coordination

| Agent | Use When |
|---|---|
| **orchestrator** | Multi-step tasks, cross-domain work, anything requiring 2+ specialists |
| **planner** | Breaking epics into milestones with acceptance criteria |
| **task-generator** | Decomposing milestones into atomic, estimable tasks |
| **backlog-generator** | Proactive backlog discovery (not decomposition) |

### Analysis

| Agent | Use When |
|---|---|
| **analyst** | Research, root cause analysis, feasibility, API investigation |
| **architect** | Design governance, ADRs, pattern enforcement, design reviews |
| **critic** | Validating plans before implementation (MANDATORY gate) |
| **high-level-advisor** | Strategic decisions, priority conflicts, tie-breaking |
| **independent-thinker** | Challenge assumptions, devil's advocate, blind spot detection |

### Execution

| Agent | Use When |
|---|---|
| **implementer** | Production code with SOLID/DRY/YAGNI, tests alongside code |
| **qa** | Test strategy, coverage analysis, pre-PR quality gates |
| **devops** | CI/CD pipelines, infrastructure, deployment |
| **security** | Threat modeling, OWASP/CWE scanning, post-implementation verification |

### Support

| Agent | Use When |
|---|---|
| **memory** | Complex memory operations, knowledge graph maintenance |
| **skillbook** | Curating learned patterns, atomicity scoring, skill retirement |
| **retrospective** | Post-project learning extraction, Five Whys, timeline analysis |
| **explainer** | PRDs, feature docs, technical specifications |
| **adr-generator** | Creating Architecture Decision Records |
| **context-retrieval** | Session initialization, context rehydration |
| **issue-feature-review** | GitHub issue triage (PROCEED/DEFER/DECLINE verdicts) |
| **roadmap** | Epic definition, RICE/KANO prioritization |
| **spec-generator** | 3-tier specifications (REQ/DESIGN/TASK) in EARS format |
| **pr-comment-responder** | Handling PR review feedback systematically |

---

## Skills

### Decision & Analysis

| Skill | Trigger |
|---|---|
| **decision-critic** | Stress-test a decision before committing |
| **cynefin-classifier** | Classify problem domain (Clear/Complicated/Complex/Chaotic) |
| **cva-analysis** | Discover natural abstractions from requirements |
| **pre-mortem** | Identify risks before failure (prospective hindsight) |
| **buy-vs-build-framework** | Build vs buy with TCO analysis |
| **chestertons-fence** | Investigate why code exists before changing it |
| **threat-modeling** | STRIDE analysis with mitigation roadmap |

### Code Quality

| Skill | Trigger |
|---|---|
| **code-qualities-assessment** | Score cohesion, coupling, encapsulation, testability, DRY |
| **analyze** | Multi-step codebase investigation with evidence |
| **taste-lints** | Project-config-aware linting with agent-readable remediation |
| **style-enforcement** | Code style validation against project config |
| **doc-coverage** | Detect missing documentation gaps |
| **security-scan** | CWE-22/CWE-78 pattern detection |
| **fix-markdown-fences** | Repair malformed code fence closings |

### Code Intelligence

| Skill | Trigger |
|---|---|
| **code-architecture** | Analyze project structure, build knowledge graphs |
| **code-symbols** | When to use LSP symbols vs text search |
| **repo-encoder** | Index a repository for semantic search |

### Planning & Execution

| Skill | Trigger |
|---|---|
| **planner** | Interactive planning with milestone breakdown |
| **execution-plans** | Versioned plan artifacts with progress tracking |
| **programming-advisor** | Evaluate existing solutions before custom development |
| **context-optimizer** | Optimize skill placement, compress context |

### Memory & Knowledge

| Skill | Trigger |
|---|---|
| **memory** | Search, read, write, edit Brain notes |
| **using-brain-memory** | Guidance for effective Brain memory usage |
| **curating-memories** | Update, obsolete, link existing memories |
| **exploring-knowledge-graph** | Multi-hop graph traversal across notes |
| **memory-documentary** | Generate evidence-based reports from memory |
| **reflect** | Capture learnings with confidence tiers |
| **research-and-incorporate** | Research topics and integrate into memory |

### Session & Workflow

| Skill | Trigger |
|---|---|
| **session-init** | Create protocol-compliant session logs |
| **session-end** | Validate and complete session logs |
| **session** | Session lifecycle management |
| **session-log-fixer** | Fix validation failures in session logs |

### PR & GitHub

| Skill | Trigger |
|---|---|
| **adr-review** | Multi-agent debate for ADR validation (6 agents) |
| **pr-comment-responder** | Handle PR review feedback |
| **github-url-intercept** | Route GitHub URLs to API (prevents context blowout) |
| **merge-resolver** | Automated conflict resolution |
| **pipeline-validator** | CI pipeline monitoring after PR |

### Meta & Governance

| Skill | Trigger |
|---|---|
| **SkillForge** | Create new skills (4-phase: analysis, spec, generation, synthesis) |
| **slashcommandcreator** | Create new slash commands |
| **prompt-engineer** | Optimize system prompts with research-backed patterns |
| **steering-matcher** | Match file paths to applicable steering guidance |
| **doc-sync** | Synchronize documentation across repository |
| **incoherence** | Detect contradictions in docs/code/specs |
| **analysis-provenance** | Check code ownership before modifying |
| **validation-authority** | Treat upstream validators as authoritative |
| **metrics** | Agent usage metrics from git history |

---

## Hooks (Enforcement)

Hooks enforce quality gates automatically. You cannot bypass them.

| Lifecycle | What Gets Enforced |
|---|---|
| **SessionStart** | Session initialization, memory-first compliance, ADR change detection |
| **PreToolUse** | Routing gates (QA/Critic/ADR before PR), skill-first policy, session log guard, branch protection, security gates |
| **PostToolUse** | Markdown auto-lint, ADR lifecycle detection |
| **Stop** | Session completeness validation, skill learning extraction |
| **UserPromptSubmit** | Autonomous execution detection, memory compliance |
| **SubagentStop** | QA agent output validation |
| **PermissionRequest** | Auto-approve safe test commands (`bun test`, `npm test`, etc.) |

---

## Commands

| Command | Purpose |
|---|---|
| `/0-init` | Initialize session |
| `/1-plan` | Planning phase |
| `/2-impl` | Implementation phase |
| `/3-qa` | QA validation |
| `/4-security` | Security review |
| `/9-sync` | Session sync and cleanup |
| `/pr-review` | Review someone else's PR |
| `/push-pr` | Create and push PR |
| `/context-gather` | Gather semantic context |
| `/research` | Research delegation |
| `/memory-search` | Search Brain memory |
| `/memory-save` | Save to Brain memory |
| `/memory-explore` | Explore knowledge graph |
| `/memory-list` | List recent notes |

---

## Memory

Brain uses a semantic knowledge graph built from markdown notes.

**Search**: `mcp__plugin____brain__search({ query: "topic", limit: 10 })`
**Read**: `mcp__plugin____brain__read_note({ identifier: "note-name" })`
**Write**: `mcp__plugin____brain__write_note({ title: "ENTITY-NNN-topic", folder: "folder", content: "..." })`
**Edit**: `mcp__plugin____brain__edit_note({ identifier: "note-name", operation: "append", content: "..." })`

### Entity Types

| Type | Prefix | Folder |
|---|---|---|
| Decision | `ADR-NNN` | `decisions/` |
| Analysis | `ANALYSIS-NNN` | `analysis/` |
| Feature | `FEAT-NNN` | `features/` |
| Session | `SESSION-YYYY-MM-DD_NN` | `sessions/` |
| Epic | `EPIC-NNN` | `roadmap/` |
| Critique | `CRIT-NNN` | `critique/` |
| Test Report | `QA-NNN` | `qa/` |
| Security | `SEC-NNN` | `security/` |
| Retrospective | `RETRO-YYYY-MM-DD` | `retrospective/` |
| Skill | `SKILL-NNN` | `skills/` |

Prefixes MUST be ALL CAPS. Every note needs 3+ observations and 2+ relations.

### Memory-First Gate

Before changing existing systems, search memory for why they exist:

```
mcp__plugin____brain__search({ query: "[component] purpose" })
```

---

## Constraints

### Always

- Search memory before multi-step reasoning
- Verify branch before git operations
- Commit atomically (single logical change)
- Run `npx markdownlint-cli2 --fix "**/*.md"` before commits

### Never

- Commit secrets or credentials
- Force push to main
- Skip hooks (`--no-verify`)
- Include AI attribution in commit messages

### Git Messages

```
feat|fix|refactor|test|docs|chore(scope): short description

Optional body with rationale.

Closes #42
```

---

## Workflow Patterns

```
Feature:     analyst → architect → planner → critic → implementer → qa
Quick Fix:   implementer → qa
Strategic:   independent-thinker + high-level-advisor → task-generator
Research:    analyst (standalone)
PR Comment:  pr-comment-responder → implementer → qa
```

Critic review is MANDATORY before implementation. QA is MANDATORY after.

---

## Key Documents

| Document | What's In It |
|---|---|
| This file | Navigation hub (agents, skills, hooks, commands, memory) |
| Agent `.md` files | Full agent definitions with methodology and templates |
| Skill `SKILL.md` files | Skill triggers, process, scripts, references |
| `settings.json` | Hook wiring configuration |
