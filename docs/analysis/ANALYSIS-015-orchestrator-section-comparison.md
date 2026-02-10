---
title: ANALYSIS-015 Orchestrator Section Comparison
type: note
permalink: analysis/analysis-015-orchestrator-section-comparison-1
tags:
- orchestrator
- composable-rules
- analysis
- agent-teams
- refactoring
---

# ANALYSIS-015 Orchestrator Section Comparison

## Observations

- [fact] Both orchestrator files share approximately 70% identical content by section count #orchestrator #composable-rules
- [fact] Standard orchestrator uses Task tool with hub-and-spoke subagent model, Agent Teams uses Teammate/TaskCreate/SendMessage with persistent teammates #tool-specific
- [fact] 25 sections are SHARED (identical or near-identical), 12 sections are SIMILAR (same concept with tool-specific wording), 8 sections are TOOL-SPECIFIC (unique to one version) #analysis
- [decision] Composable rules structure should extract shared content into reusable rule files and layer tool-specific overrides #architecture
- [insight] The Agent Teams version adds 6 unique sections not present in standard: Team Lifecycle, Plan Approval Mode, Task Dependency Patterns, Inter-Agent Communication Patterns, Teammate Capability Matrix, and Key Differences from Subagent Model #agent-teams
- [insight] The standard version has 2 unique sections not in Agent Teams: Handoff Protocol (explicit subagent return flow) and Output Directory (standalone listing) #hub-and-spoke
- [insight] Most SIMILAR sections differ only in terminology substitution: "agent" to "teammate", "Task tool" to "TaskCreate/Teammate", "wave" to "task dependency" #refactoring

## Section-by-Section Comparison

### SHARED Sections (Identical or Near-Identical Content)

| Section | Standard Line | Agent Teams Line | Notes |
|---------|--------------|-----------------|-------|
| Style Guide Compliance | 28 | 33 | Identical content |
| OODA Phase Classification | 550 | 825 | Identical table, minor wording |
| Clarification Gate | 566 | 839 | Identical checklist and tables |
| Task Classification (Step 1) | 624 | 897 | Same table, same signal words |
| Domain Identification (Step 2) | 650 | 924 | Identical domain table |
| Complexity from Classification (Step 3) | 687 | 961 | Same table, "agent" vs "teammate" |
| Classification Summary Template | 705 | 979 | Same template structure |
| Phase 1: Initialization | 727 | 1002 | Same checklist |
| Reconnaissance Scan | 742 | 1015 | Same 2-5 tool call guidance |
| Consistency Checkpoint | 1316 | 1124 | Same validation checklist |
| Phase 4: Validate Before Review | 858 | 1183 | Same workflow diagram and steps |
| QA Verdict Evaluation | 911 | 1234 | Same PASS/FAIL/NEEDS WORK logic |
| Security Validation | 924 | 1247 | Same PIV process |
| Aggregate Validation Results | 953 | 1276 | Same template |
| PR Creation Authorization | 968 | 1291 | Same verdict handling |
| Workflow Paths | 1019 | 1327 | Same paths, different notation |
| Agent/Teammate Sequences | 1030 | 1338 | Same sequences, different terms |
| Mandatory Rules | 1276 | 1364 | Same 4 rules |
| ADR Review Enforcement | 1283 | 1371 | Same blocking gate pattern |
| Quick Classification | 1263 | 1440 | Same table |
| Memory Protocol | 488 | 764 | Same pattern, minor template diff |
| Ideation Workflow (all phases) | 1396 | 1661 | Nearly identical across all phases |
| Post-Retrospective Workflow | 1686 | 1928 | Same 5-step process |
| Content Attribution Constraints | 2110 | 2269 | Same rules, AT adds "team names" |
| Session Continuity (handoff template) | 1962 | 2117 | Identical template |

### SIMILAR Sections (Same Concept, Different Implementation)

| Section | Standard | Agent Teams | Shared Concept | Key Difference |
|---------|----------|-------------|----------------|----------------|
| Core Identity | L39 | L44 | Orchestrator as coordinator, not implementer | AT adds "Team Lead" role, delegate mode |
| Activation Profile | L60 | L65 | Same keywords, summon pattern | AT adds "Team, Swarm" keywords |
| First Step: Triage | L66 | L71 | Same task type table | "agents" vs "teammates" terminology |
| Reliability Principles | L179 | L189 | 4 similar principles | AT: "Dependencies Over Waves" replaces "Parallel by Default" pattern; adds "Delegate Mode Always" |
| Execution Style | L188 | L200 | Scan-Plan-Execute-Synthesize | AT adds Create Team, Spawn, Delegate Mode steps |
| Delegation Planning (Phase 2 Step 2) | L755 | L1026 | Same plan structure | AT uses task dependency graph instead of waves |
| Same-Type Swarming | L339 | L624 | Same principle and tables | AT uses teammate spawning, Task calls differ |
| Expected Orchestration Scenarios | L474 | L749 | Same normal scenarios | AT adds teammate-specific scenarios (stops, forgets task) |
| Execution Protocol Phase 3 | L844 | L1110 | Autonomous execution | AT: monitor inbox/forward context vs wave-by-wave |
| Routing Heuristics | L1377 | L1404 | Same heuristic table | AT adds "C# / TypeScript / Go" vs just "C# implementation" |
| Complexity Assessment | L1246 | L1423 | Same level table | "agent" vs "teammate" |
| TODO Management | L1911 | L2077 | Same anti-pattern and correct behavior | AT adds TodoWrite vs TaskList distinction |

### TOOL-SPECIFIC Sections (Only in One Version)

| Section | Version | Line | Purpose |
|---------|---------|------|---------|
| Architecture Constraint (hub-and-spoke diagram) | Standard | L90 | Explains one-level subagent model with wave diagrams |
| Architecture Constraint (Agent Teams diagram) | Agent Teams | L95 | Explains shared task list, teammates, key primitives |
| Claude Code Tools | Standard | L168 | Lists Read/Grep/Glob/Task/TodoWrite |
| Claude Code Agent Teams Tools | Agent Teams | L176 | Lists Teammate/TaskCreate/TaskUpdate/SendMessage |
| Sub-Agent Delegation (with syntax) | Standard | L227 | Task() call syntax, routing tables |
| Team Lifecycle (Steps 1-6) | Agent Teams | L263 | Full lifecycle: Create Team, Tasks, Spawn, Delegate, Monitor, Shutdown |
| Plan Approval Mode | Agent Teams | L546 | plan_mode_required for critical teammates |
| Task Dependency Patterns | Agent Teams | L569 | Research-Review-Impl-QA, Fan-Out/Fan-In, Pipeline patterns |
| Inter-Agent Communication | Agent Teams | L677 | Debate/Challenge, Forward Context, Status Broadcast |
| Teammate Capability Matrix (extended) | Agent Teams | L728 | Full matrix with "Sends Results To" column |
| Handoff Protocol | Standard | L1888 | Explicit subagent return flow |
| Output Directory (standalone) | Standard | L1946 | Brain memory folder listing |
| Failure Recovery | Both (different) | L2024/L2177 | Standard: reroute to fallback; AT: spawn replacement |
| Session End Gate | Both (different) | L2037/L2205 | AT adds teammate shutdown and team cleanup requirements |
| Completion Criteria | Both (different) | L2099/L2192 | AT adds "All teammates shut down" and "Team cleaned up" |
| Output Format | Both (different) | L2123/L2279 | Standard: "Agent Workflow" table; AT: "Team Configuration" table |

## Proposed Composable Rules Structure

### Shared Rule Files (extracted from both)

| Rule File | Sections Included |
|-----------|-------------------|
| `rules/identity.md` | Style Guide Compliance, Core Identity (shared portion) |
| `rules/triage.md` | First Step: Triage, Phase 0, OODA Classification |
| `rules/classification.md` | Task Classification, Domain Identification, Complexity Assessment, Quick Classification |
| `rules/clarification.md` | Clarification Gate, First Principles Routing |
| `rules/planning.md` | Phase 1 Initialization, Phase 2 Reconnaissance, Delegation Plan Quality Check |
| `rules/routing.md` | Workflow Paths, Agent/Teammate Sequences, Mandatory Rules, Routing Heuristics |
| `rules/swarming.md` | Same-Type Swarming (principle, when-to, splitting rules, anti-patterns) |
| `rules/validation.md` | Phase 4 (QA, Security PIV, Aggregate, PR Authorization), Consistency Checkpoint |
| `rules/memory.md` | Memory Protocol, Brain MCP patterns |
| `rules/ideation.md` | Full Ideation Workflow (Phases 1-4) |
| `rules/retrospective.md` | Post-Retrospective Workflow, Conditional Routing, Error Handling |
| `rules/session.md` | Session Continuity, Handoff Template, TODO Management, Segue Management |
| `rules/attribution.md` | Content Attribution Constraints |
| `rules/adr-review.md` | ADR Review Enforcement |
| `rules/pr-comments.md` | PR Comment Routing |
| `rules/specification.md` | Specification Routing, Traceability Chain |
| `rules/impact-analysis.md` | Impact Analysis Orchestration, Disagree and Commit |
| `rules/completion.md` | Completion Criteria, Session End Gate, Fail-Closed Principle |
| `rules/scenarios.md` | Expected Orchestration Scenarios (shared subset) |
| `rules/output-format.md` | Output Format (shared structure) |

### Tool-Specific Override Files

| Override File | Content |
|---------------|---------|
| `overrides/claude-code-standard.md` | Architecture Constraint (hub-and-spoke), Tools list, Sub-Agent Delegation syntax, Wave-based execution, Handoff Protocol, Output Directory, Failure Recovery (reroute) |
| `overrides/claude-code-agent-teams.md` | Architecture Constraint (team model), Key Primitives, Tools list, Team Lifecycle, Plan Approval Mode, Task Dependency Patterns, Inter-Agent Communication, Teammate Capability Matrix, Failure Recovery (spawn replacement), Session End Gate (teammate shutdown) |

### Terminology Mapping (for template variables)

| Shared Term | Standard | Agent Teams |
|-------------|----------|-------------|
| `{worker}` | agent / subagent | teammate |
| `{delegate_cmd}` | `Task(subagent_type=...)` | `Task(team_name=..., name=..., subagent_type=...)` |
| `{create_work}` | (implicit in prompt) | `TaskCreate(subject=..., depends_on=[...])` |
| `{sequence_model}` | waves (manual) | task dependencies (automatic) |
| `{lead_role}` | ROOT agent | Team Lead |
| `{send_context}` | (included in Task prompt) | `SendMessage / Teammate(operation="write")` |
| `{parallel_model}` | Multiple Task calls in single message | Shared task list with dependency-based unblocking |

## Relations

- relates_to [[ANALYSIS-014 Orchestrator Composable Rules]]
- relates_to [[ADR-020 Brain Memory Configuration]]
- part_of [[Plugin Composable Architecture]]
