---
title: ANALYSIS-014-orchestrator-comparison
type: note
permalink: analysis/analysis-014-orchestrator-comparison
tags:
- analysis
- orchestrator
- comparison
- mcp-task-orchestrator
- agent-teams
- parallel
- multi-agent
---

# ANALYSIS-014 Orchestrator Comparison: mcp-task-orchestrator vs Brain Agent Teams

## Context

Side-by-side comparison of EchoingVesper/mcp-task-orchestrator (an MCP-based task orchestration server) against Brain's Claude Code Agent Teams pattern. Evaluates whether the MCP approach can replace, complement, or serve as the foundation for portable orchestration.

## mcp-task-orchestrator: Full API Surface (from source code)

### Tool Categories (4 groups, 15+ tools total)

**Core Orchestration (3 tools):**

```
orchestrator_initialize_session(working_directory?)
  -> Creates session, detects workspace (git, project type)

orchestrator_synthesize_results(parent_task_id)
  -> Combines completed subtask outputs into final result

orchestrator_get_status(include_completed?, session_id?, task_id?)
  -> Progress tracking for active tasks
```

**Generic Task Management (6 tools):**

```
orchestrator_plan_task(title, description, task_type?, complexity?, specialist_type?, parent_task_id?, estimated_effort?, due_date?, context?, dependencies?)
  -> Creates task with rich metadata
  -> task_type: standard|breakdown|milestone|review|approval|research|implementation|testing|documentation|deployment|custom
  -> complexity: trivial|simple|moderate|complex|very_complex
  -> specialist_type: analyst|coder|tester|documenter|reviewer|architect|devops|researcher|coordinator|generic
  -> dependencies: array of prerequisite task IDs

orchestrator_execute_task(task_id)
  -> Returns specialist context and prompts for the task

orchestrator_complete_task(task_id, summary, detailed_work, next_action, file_paths?, artifact_type?)
  -> next_action: continue|needs_revision|blocked|complete
  -> artifact_type: code|documentation|analysis|design|test|config|general

orchestrator_update_task(task_id, title?, description?, status?, specialist_type?, complexity?, estimated_effort?, due_date?, context?)
  -> status: pending|active|in_progress|blocked|completed|failed|cancelled|archived

orchestrator_delete_task(task_id, force?, archive_instead?)
orchestrator_cancel_task(task_id, reason?, preserve_work?)

orchestrator_query_tasks(status?, task_type?, specialist_type?, parent_task_id?, complexity?, search_text?, created_after?, created_before?, include_children?, include_artifacts?, limit?, offset?)
  -> Advanced filtering and search
```

**Session Management (4 tools):**

```
orchestrator_list_sessions(include_completed?, limit?)
orchestrator_resume_session(session_id)
orchestrator_cleanup_sessions(cleanup_type: completed|orphaned|old|all, older_than_days?, dry_run?)
orchestrator_session_status(session_id)
```

**Maintenance (1 tool):**

```
orchestrator_maintenance_coordinator(action: scan_cleanup|validate_structure|update_documentation|prepare_handover, scope?, validation_level?, target_task_id?)
```

### Dependency Handling (from source code analysis)

The orchestrator has a `_get_next_recommended_task()` method that:

1. When a task completes, finds tasks that depend on the completed task
2. Checks if ALL dependencies of each dependent task are now met (all completed)
3. Returns the first unblocked pending task as the next recommendation
4. Falls back to any pending task if no dependency-based match found

This is dependency-aware sequential recommendation, NOT automatic parallel unblocking. The system suggests the next task; it does not spawn agents to work on newly-unblocked tasks.

### Parallel Execution: NOT SUPPORTED

**Critical finding from source code analysis**: mcp-task-orchestrator does NOT support true parallel execution.

- No mechanism to spawn multiple agents working simultaneously
- Tasks execute sequentially: plan -> execute -> complete -> next
- The "work stream" concept groups related tasks but executes them one at a time
- The orchestrator is a SINGLE-AGENT coordinator -- it guides ONE LLM through a multi-step workflow
- There is no concept of multiple concurrent agents each working on different tasks

The orchestrator is designed for a single AI assistant (Claude, Cursor, etc.) to work through complex tasks systematically, not for multiple agents to work in parallel.

### Inter-Agent Communication: NONE

- No messaging system between agents
- No shared state between agents
- The orchestrator is the single agent's memory, not a coordination layer
- "Specialist context" is role-specific system prompt injection, not delegation to a separate agent

### Specialist Roles

Roles are system prompt overlays, not separate agents:

- When executing a task assigned to "architect", the LLM receives architect-specific instructions
- The SAME LLM processes all specialist tasks sequentially
- Customizable via `.task_orchestrator/roles/project_roles.yaml`
- Predefined: analyst, coder, tester, documenter, reviewer, architect, devops, researcher, coordinator, generic

## Side-by-Side Comparison

| Capability | Brain Agent Teams | mcp-task-orchestrator |
|:--|:--|:--|
| **Architecture** | Multiple concurrent agents (teammates) | Single agent with role switching |
| **Parallel execution** | YES -- teammates run simultaneously via run_in_background | NO -- sequential task-by-task execution |
| **Agent spawning** | Task(team_name, name, subagent_type) spawns real agents | No agent spawning; role context injected into same LLM |
| **Team lifecycle** | spawnTeam -> spawn teammates -> shutdown -> cleanup | initialize_session -> work tasks -> synthesize -> cleanup |
| **Task creation** | TaskCreate(subject, description) | orchestrator_plan_task(title, description, dependencies, specialist_type) |
| **Dependencies** | addBlockedBy: [task_ids] with auto-unblocking | dependencies: [task_ids] with next-task recommendation |
| **Task status** | pending -> in_progress -> completed | pending -> active -> in_progress -> blocked -> completed/failed/cancelled/archived |
| **Inter-agent messaging** | SendMessage(recipient, content) -- ANY teammate to ANY teammate | NONE |
| **Broadcasting** | broadcast to all teammates | NONE |
| **Delegation mode** | Shift+Tab locks lead to coordination-only | NONE |
| **Plan approval** | plan_mode_required, approvePlan, rejectPlan | NONE |
| **Debate/challenge** | Teammates directly argue with evidence | IMPOSSIBLE -- single agent cannot debate itself |
| **Agent registry** | Implicit via team membership | NONE (specialists are roles, not agents) |
| **State persistence** | Teammates share TaskList; lost on team cleanup | SQLite database; survives across sessions |
| **Session management** | Team cleanup on session end | list_sessions, resume_session, cleanup_sessions |
| **Context isolation** | Each teammate has separate context window | All tasks share single LLM context window |
| **Artifact management** | Ad-hoc file creation | Structured artifact storage with types and file_paths |
| **Workspace awareness** | Manual (teammates read files as needed) | Automatic (git detection, project type, smart placement) |
| **Tool availability** | Native Claude Code tools + MCP | MCP tools only |
| **Platform support** | Claude Code only (experimental) | Claude Desktop, Cursor, Windsurf, VS Code |
| **Rich task metadata** | subject, description, blockedBy, blocks | title, description, task_type, complexity, specialist_type, estimated_effort, due_date, dependencies, context |

## Answers to Key Questions

### Does mcp-task-orchestrator support TRUE parallel execution?

**NO.** It is fundamentally a single-agent sequential orchestrator. The same LLM works through tasks one at a time with specialist role context injection. There is no mechanism to spawn multiple agents or have multiple LLMs working simultaneously. The "work stream" concept groups related tasks but does not parallelize them.

### Can agents message each other?

**NO.** There is only one agent. The orchestrator provides context to the LLM for each task, but there is no messaging, no shared inbox, no peer-to-peer communication. The "specialist" is the same LLM wearing a different hat.

### Can it handle the debate/challenge pattern?

**NO.** A single agent cannot debate itself. The debate/challenge pattern requires two or more independent agents with separate context windows examining evidence and directly responding to each other's arguments. This is fundamentally impossible with a single-agent orchestrator.

### Does it support dependency-based auto-unblocking?

**PARTIAL.** When a task completes, `_get_next_recommended_task()` checks if any dependent tasks now have all prerequisites met and recommends the next one. But it does not automatically spawn agents to work on unblocked tasks -- it just suggests which task to work on next.

### What's the biggest workflow it's been used for?

Based on the README and source, workflows are typically 3-8 subtasks (software projects decomposed into Architecture -> Implementation -> Testing -> Documentation). No evidence of workflows with 10+ parallel agents because parallel execution is not supported.

### How does it compare on RELIABILITY?

| Factor | Brain Agent Teams | mcp-task-orchestrator |
|:--|:--|:--|
| Enforcement | Native tool enforcement (Agent Teams API is mandatory) | Advisory (LLM must choose to call tools) |
| Task completion | Teammates are driven by their context; they work until done | LLM must remember to call orchestrator_complete_task |
| Delegation | Shift+Tab mechanically prevents lead from implementing | Nothing prevents the LLM from skipping orchestration |
| State persistence | In-memory; lost on team cleanup | SQLite; survives across sessions and crashes |
| Error recovery | Spawn replacement teammates on failure | Resume session with preserved state |

Brain Agent Teams is more reliable for enforcing workflow discipline but less resilient to crashes. mcp-task-orchestrator is less reliable for enforcement but more resilient to interruption.

### What's missing from mcp-task-orchestrator that Brain would need?

1. **True parallel execution** -- The ability to have multiple agents working simultaneously (most critical gap)
2. **Inter-agent messaging** -- SendMessage/broadcast between agents
3. **Agent registry** -- Register active agents, their roles, and capabilities
4. **Delegation enforcement** -- Prevent the orchestrator from doing work directly
5. **Plan approval workflow** -- Require explicit approval before agents proceed
6. **Debate/challenge support** -- Enable agents to challenge each other's conclusions
7. **Auto-unblocking with agent spawning** -- When dependencies clear, automatically assign or signal available agents

## What Brain Should Build

### Option A: Extend mcp-task-orchestrator

Fork the existing project and add missing capabilities. Pros: proven foundation, existing user base. Cons: Python (Brain MCP server is TypeScript), different architecture, significant modifications needed.

### Option B: Build Brain-native MCP orchestration tools

Add orchestration tools to Brain's existing TypeScript MCP server. Pros: TypeScript (matches Brain stack), tight integration with Brain memory, designed for Brain's specific needs. Cons: building from scratch.

### Option C: Hybrid -- Use mcp-task-orchestrator's task management, add Brain-specific layers

Use the existing project for task CRUD and session management. Build Brain-specific tools for messaging, agent registry, and parallel coordination on top. Cons: two MCP servers (complexity), Python + TypeScript (language mismatch).

### Recommendation: Option B (Brain-native)

Brain should build its own MCP orchestration tools because:

1. mcp-task-orchestrator is fundamentally a single-agent tool -- adding multi-agent support would be a rewrite
2. Brain's MCP server is TypeScript; mcp-task-orchestrator is Python -- language mismatch adds friction
3. Brain needs tight integration with its memory system (Brain notes for task state, not a separate SQLite)
4. The task CRUD is the easy part (4-8h). The hard part (messaging, parallel coordination) does not exist in the reference implementation.

However, Brain should adopt mcp-task-orchestrator's good ideas:

- Rich task metadata (task_type, complexity, estimated_effort, due_date)
- Session management with resume capability
- Structured artifact storage
- Workspace awareness (git detection, project type)
- Advanced task querying (filter by status, type, specialist, date range)

## Observations

- [fact] mcp-task-orchestrator is a single-agent sequential orchestrator, NOT a multi-agent parallel coordinator #architecture
- [fact] No parallel execution: same LLM works through tasks one at a time with specialist role injection #limitation
- [fact] No inter-agent messaging, broadcasting, or shared state between agents #limitation
- [fact] Dependencies are tracked but only provide next-task recommendations, not auto-unblocking with agent spawning #limitation
- [fact] Specialist roles are system prompt overlays on the same LLM, not separate agents #design
- [fact] State persistence via SQLite survives across sessions; Brain Agent Teams state is in-memory and lost on cleanup #tradeoff
- [fact] Task status lifecycle is richer than Brain's: pending|active|in_progress|blocked|completed|failed|cancelled|archived vs pending|in_progress|completed #api
- [fact] Task metadata is richer: task_type, complexity, estimated_effort, due_date, context fields that Brain lacks #api
- [insight] mcp-task-orchestrator solves a different problem than Brain Agent Teams: sequential single-agent workflow management vs parallel multi-agent orchestration #mismatch
- [decision] Brain should build its own MCP orchestration tools (Option B) rather than extend mcp-task-orchestrator, because adding multi-agent support to a single-agent tool would be a rewrite #recommendation
- [insight] Brain should adopt mcp-task-orchestrator's good ideas (rich metadata, session resume, artifact storage, advanced querying) while building native parallel and messaging support #hybrid

## Relations

- relates_to [[ANALYSIS-013-mcp-orchestration-research]]
- relates_to [[ANALYSIS-012-cursor-orchestrator-research]]
- relates_to [[ADR-002-multi-tool-compatibility-architecture]]
- part_of [[SESSION-2026-02-09_01-multi-tool-compatibility-restructure]]

## Addendum: Cursor Official Documentation (Parallel Execution Details)

Source: cursor.com/docs/configuration/worktrees, cursor.com/docs/context/subagents

### Cursor Parallel Execution: Two Distinct Mechanisms

**Mechanism 1: Subagent Parallel Execution (in-process, same workspace)**

From official docs:

- Parent agent sends "multiple Task tool calls in a single message, so subagents run simultaneously"
- Foreground mode: blocks until complete, returns result immediately
- Background mode (`is_background: true`): returns immediately, subagent works independently
- Background subagents write state to `~/.cursor/subagents/` for parent monitoring
- Each subagent gets clean context window (no prior conversation history)
- Subagents inherit ALL parent tools including MCP servers
- Resumption via agent ID: `Resume agent abc123 and analyze remaining test failures`
- Token cost scales linearly: 5 parallel subagents = ~5x token cost
- No maximum concurrent count documented; constraint is token cost, not architecture
- Single-level only: "Nested subagents are unsupported today"
- NO inter-subagent communication: parent-to-subagent only
- Built-in subagents: Explore (10 parallel searches), Bash, Browser

**Mechanism 2: Parallel Agents via Git Worktrees (file-isolated)**

From official docs:

- Each agent runs in its own git worktree with isolated file sets
- 1:1 mapping of agents to worktrees
- Maximum 20 worktrees per workspace
- Oldest worktrees auto-deleted when limit exceeded (by last access time)
- Cursor automatically creates and configures worktrees
- New/edited files from primary working tree brought along (git-ignored files excluded)
- Supports both multi-agent parallel AND Best-of-N (same prompt, multiple models)
- Results applied via: Full Overwrite or native merge conflict resolution UI
- Configuration: `.cursor/worktrees.json` with setup commands (npm ci, pip install, env copy, migrations)
- Limitation: NO LSP in worktrees (no linting during agent execution)

### Three-Way Comparison: Brain Agent Teams vs Cursor Parallel vs mcp-task-orchestrator

| Capability | Brain Agent Teams | Cursor Subagents | Cursor Worktrees | mcp-task-orchestrator |
|:--|:--|:--|:--|:--|
| **True parallel?** | YES (teammates) | YES (background mode) | YES (separate worktrees) | NO (sequential) |
| **Max parallel** | Unlimited | Unlimited (cost-limited) | 20 per workspace | 1 |
| **File isolation** | NO (shared workspace) | NO (shared workspace) | YES (per-worktree) | N/A |
| **Inter-agent messaging** | YES (any-to-any) | NO (parent-only) | NO (separate workspaces) | NO |
| **Agent spawning** | Explicit (Task + name) | Automatic or /name | UI-driven | N/A |
| **Shared task list** | YES (TaskCreate/List) | NO | NO | YES (but single-agent) |
| **Context isolation** | YES (per teammate) | YES (per subagent) | YES (per worktree) | NO (single context) |
| **Resumption** | NO (lost on cleanup) | YES (agent ID) | YES (worktree persists) | YES (session ID) |
| **Tool inheritance** | YES (MCP + native) | YES (all parent tools + MCP) | YES (full environment) | MCP only |
| **Result merging** | Manual (lead synthesizes) | Parent reads results | Full Overwrite or merge UI | synthesize_results tool |
| **Delegation enforcement** | YES (Shift+Tab) | NO | NO | NO |
| **Debate/challenge** | YES | NO | NO | NO |
| **State persistence** | In-memory | ~/.cursor/subagents/ | Git worktree (on disk) | SQLite database |

### Key Insight: Cursor Has Two Parallel Paths Brain Lacks

1. **Subagent parallelism** (in-process) is the closest analog to Brain's Agent Teams. Both spawn parallel agents with separate contexts. But Cursor lacks inter-agent messaging, shared task lists, and delegation enforcement.

2. **Worktree parallelism** (file-isolated) has NO equivalent in Brain's Agent Teams. This enables truly independent execution where agents cannot conflict on file edits. Brain's Agent Teams teammates all share the same workspace and can overwrite each other's changes.

Brain's MCP orchestration layer should support BOTH patterns:

- MCP task tools for subagent-style coordination (task list, messaging, state)
- Awareness of worktree isolation when available (no file conflict management needed)

### Updated Observations

- [fact] Cursor subagent parallelism works via parent sending multiple Task tool calls in a single message #parallel
- [fact] Cursor worktree parallelism supports up to 20 per workspace with automatic creation and file isolation #parallel
- [fact] Cursor subagent state persists at ~/.cursor/subagents/ and supports resumption via agent IDs #persistence
- [fact] Cursor has NO inter-subagent communication; parent-to-subagent only (hub-and-spoke) #limitation
- [insight] Brain's Agent Teams has inter-agent messaging that neither Cursor mechanism nor mcp-task-orchestrator provides -- this is Brain's unique value #differentiation
- [insight] Cursor's worktree isolation (no file conflicts) is a capability Brain Agent Teams lacks (shared workspace) #gap

## Addendum 2: OpenCode Agent Architecture

Source: opencode.ai/docs/agents/, community research

### OpenCode Agent System

**Two-tier architecture:**

- **Primary agents**: Direct interaction assistants cycled via Tab. Tool access controlled through permissions. Examples: Build (full access), Plan (restricted -- edit and bash set to "ask").
- **Subagents**: Specialized assistants invoked by primary agents via Task tool or manually via `@agent-name` syntax. Examples: General (full tools, multi-step parallel), Explore (read-only).

**Agent configuration schema:**

```yaml
---
description: "Agent purpose"
mode: primary|subagent|all
model: provider/model-id
temperature: 0.1
tools:
  write: false
  edit: false
permission:
  bash:
    "git push": "ask"
    "grep *": "allow"
  task:
    "pattern": "ask|allow|deny"
---
System prompt content here.
```

**Key features:**

- Per-agent tool permissions (edit/bash/webfetch: ask/allow/deny)
- Per-agent model override (can use different models per agent)
- Session hierarchy: parent-child session navigation (Leader+Left/Right)
- 40+ lifecycle hooks and 25+ tools including LSP, AST-Grep
- Skills loaded on-demand via native skill tool
- Task tool enables agent-to-agent delegation with permission controls
- Compatible with Claude Code agent format (.claude/agents/ auto-discovered)
- MCP support with per-agent glob patterns (more granular than Claude Code)

**Limitations:**

- No explicit parallel execution limit documented
- No inter-agent messaging (delegation via Task tool only)
- No shared task list
- No delegation enforcement mode

### Four-Way Comparison

| Capability | Brain Agent Teams | Cursor Subagents | Cursor Worktrees | OpenCode | mcp-task-orchestrator |
|:--|:--|:--|:--|:--|:--|
| **True parallel** | YES | YES (background) | YES (per-worktree) | Unclear (Task tool) | NO |
| **Max parallel** | Unlimited | Unlimited (cost) | 20/workspace | Not documented | 1 |
| **File isolation** | NO | NO | YES | NO | N/A |
| **Inter-agent messaging** | YES (any-to-any) | NO | NO | NO | NO |
| **Shared task list** | YES | NO | NO | NO | YES (single-agent) |
| **Delegation enforcement** | YES (Shift+Tab) | NO | NO | NO | NO |
| **Debate/challenge** | YES | NO | NO | NO | NO |
| **Per-agent model** | YES (model field) | YES (model field) | N/A | YES (model field) | N/A |
| **Per-agent permissions** | Partial (tools) | YES (readonly) | N/A | YES (granular) | N/A |
| **Session resume** | NO | YES (agent ID) | YES (worktree) | YES (sessions) | YES (session ID) |
| **MCP granularity** | Session-level | Session-level | Session-level | Per-agent glob | N/A |
| **Skills system** | YES (SKILL.md) | YES (SKILL.md) | N/A | YES (on-demand) | NO |
| **Hooks** | YES (6 events) | YES (7+ events) | N/A | YES (40+ hooks) | NO |
| **Platform** | Claude Code only | Cursor only | Cursor only | OpenCode (multi-provider) | Any MCP client |
| **Agent format** | .claude/agents/*.md | .cursor/agents/*.md | N/A | .opencode/agents/*.md + JSON | N/A |

### Key Takeaway: Brain's Unique Value is Inter-Agent Communication

Across all five systems examined (Brain Agent Teams, Cursor subagents, Cursor worktrees, OpenCode, mcp-task-orchestrator), ONLY Brain Agent Teams provides:

1. Any-to-any inter-agent messaging (SendMessage)
2. Shared task list with dependency-based auto-unblocking (TaskCreate/TaskList)
3. Delegation enforcement (Shift+Tab)
4. Debate/challenge patterns (teammates directly challenge each other)

These four capabilities define Brain's orchestration differentiation. Making them portable via MCP would give Brain a unique position in the ecosystem -- no other tool or MCP server provides multi-agent coordination primitives.

### OpenCode Observations

- [fact] OpenCode has two-tier agent architecture (primary + subagent) with Task tool for delegation #opencode
- [fact] OpenCode has 40+ lifecycle hooks (vs Claude Code 6, Cursor 7+) and per-agent MCP glob patterns #opencode
- [fact] OpenCode has granular per-agent permissions (edit/bash/webfetch: ask/allow/deny per command pattern) #opencode
- [fact] OpenCode is compatible with Claude Code agent format (.claude/agents/ auto-discovered) #compatibility
- [insight] OpenCode's per-agent MCP glob patterns are more granular than any other tool -- Brain should track this for future adapter support #feature
