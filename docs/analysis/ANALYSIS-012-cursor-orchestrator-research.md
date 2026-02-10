---
title: ANALYSIS-012-cursor-orchestrator-research
type: note
permalink: analysis/analysis-012-cursor-orchestrator-research
tags:
- analysis
- cursor
- orchestrator
- parallel-agents
- subagents
- agent-teams
- multi-tool
---

# ANALYSIS-012 Cursor Orchestrator Research

## Context

Deep research into Cursor's latest orchestration and parallel agent capabilities (Feb 2026). Evaluates whether Brain's Claude Code orchestrator pattern (Agent Teams with task dependency graphs, teammate spawning, inter-agent messaging) can be ported to Cursor or needs a fundamentally different approach.

## Cursor Agent Architecture (Feb 2026, v2.4)

### Three Parallel Execution Mechanisms

Cursor offers three distinct mechanisms for parallel agent execution, each with different isolation models:

**1. Subagents (in-process, same workspace)**

- Independent agents spawned by the parent agent within the same conversation
- Run in the SAME workspace (same files, same git state)
- Foreground (blocking) or background (non-blocking via `is_background: true`)
- Parent sends multiple Task tool calls in a single message for simultaneous execution
- Custom subagents defined in `.cursor/agents/*.md` with YAML frontmatter
- Single-level only -- nested subagents not supported
- Inherit all parent tools including MCP

**2. Parallel Agents (git worktree isolation)**

- Up to 8 agents run simultaneously, each in its own git worktree
- Full file isolation -- agents cannot overwrite each other's changes
- Results reviewed via agent cards, applied via Full Overwrite or merge conflict UI
- Configured via `.cursor/worktrees.json` for custom setup
- No LSP support in worktrees (linting disabled during execution)
- Up to 20 worktrees per workspace

**3. Cloud Agents (remote VM isolation)**

- Run in isolated Ubuntu VMs with internet access
- Can be invoked from Cursor UI or cursor.com/agents
- Subagent delegation does NOT work in cloud agents (confirmed bug, Cursor team acknowledged)
- Max Mode-compatible models only
- Full auto-run for terminal commands (no approval needed)

### Subagent Capabilities (Detailed)

**Frontmatter schema:**

```yaml
---
name: agent-name          # Lowercase identifier
description: "..."        # Guides auto-delegation decisions
model: fast|inherit|ID    # Model selection
readonly: true|false      # Restrict write permissions
is_background: true|false # Non-blocking execution
---
```

**Invocation methods:**

- Automatic delegation (agent decides based on task complexity + description)
- Explicit: `/agent-name prompt` or natural language ("Have the debugger investigate")
- Parallel: parent sends multiple Task calls in one message

**Built-in subagents:**

- `explore` -- Codebase search/analysis (fast model)
- `bash` -- Shell command sequences (isolates verbose output)
- `browser` -- Browser automation via MCP tools

**Tool access:** Subagents inherit ALL parent tools including MCP servers.

**State sharing:** Background subagents write state to `~/.cursor/subagents/`. Parent can read progress files. No direct subagent-to-subagent communication.

**Resumption:** Each execution returns an agent ID for resuming with preserved context.

### Inter-Agent Communication

**Critical finding: Cursor subagents CANNOT directly communicate with each other.**

- Subagents are "oblivious to the bigger picture"
- No equivalent to Claude Code's SendMessage between teammates
- No shared task list (no TaskCreate/TaskList equivalent)
- Communication is via the parent agent only (hub-and-spoke, not mesh)
- Documentation serves as the main communication channel (structured handoffs: Goal, Changes, Open Questions, Next Owner)
- A "judge agent" pattern is used to evaluate work quality on each cycle

This is a fundamental architectural difference from Claude Code Agent Teams:

| Capability | Claude Code Agent Teams | Cursor Subagents |
|:--|:--|:--|
| Inter-agent messaging | YES (SendMessage, direct teammate messages) | NO (parent-only relay) |
| Shared task list | YES (TaskCreate/Update/List/Get) | NO |
| Team creation | YES (explicit spawnTeam) | NO (subagents spawned ad-hoc) |
| Delegation mode | YES (Shift+Tab locks lead to coordination) | NO (manual discipline) |
| Nested agents | YES (teammates can message each other) | NO (single-level only) |
| Agent lifecycle | YES (spawn, shutdown, approve plans) | Partial (spawn, resume) |
| Debate/challenge | YES (teammates can directly challenge) | NO |
| File isolation | NO (same workspace, risk of conflicts) | YES (worktrees) or NO (subagents) |

### Orchestrator Pattern in Cursor

**No built-in orchestrator mode.** There is no equivalent to Claude Code's delegation mode (Shift+Tab). Users have requested an "orchestrator/boomerang agent" pattern on the Cursor forum (post #108503) but there is no Cursor team response and no implementation.

**Community workarounds:**

- Define an orchestrator agent in `.cursor/agents/orchestrator.md` with instructions to delegate
- Use custom slash commands to invoke specialized subagents
- Hierarchical delegation: primary coordinator delegates to sub-agents
- But: no enforcement mechanism to prevent the orchestrator from implementing directly

**The pridiuksson/cursor-agents repo** (GitHub template) proposes a multi-agent orchestration framework but contains NO implementation code -- it is documentation-only, describing theoretical patterns for sequential handoffs between specialized roles.

### Plan Mode and Orchestration

- Plan mode researches codebase, asks clarifying questions, generates reviewable plan before implementation
- Plan mode does NOT interact with subagent orchestration
- No mechanism to have a plan agent delegate execution to implementation subagents
- Custom modes were deprecated in Cursor 2.1; replaced by custom slash commands

### Cloud Agent Handoff

- CLI conversations can be pushed to Cloud Agents via the Cloud option
- Cloud Agents run in isolated Ubuntu VMs
- Subagent delegation does NOT work in Cloud Agents (confirmed bug, Cursor team acknowledged Feb 2026)
- This means cloud-based orchestration with subagent delegation is currently broken

## Answers to Research Questions

### Q1: How does Cursor handle orchestration?

No built-in orchestrator. Users define custom orchestrator agents in `.cursor/agents/` but there is no enforcement of delegation-only behavior. Community has requested this feature; no Cursor team response.

### Q2: How does parallel execution work with is_background?

Parent agent sends multiple Task tool calls in a single message. Each subagent runs in its own context, in the background. The parent continues its conversation while subagents work. Results are available when subagents complete. Up to 5+ simultaneous subagents documented in community examples (one user ran 8).

### Q3: Can subagents communicate with each other?

NO. Subagents are isolated from each other. Communication is parent-only (hub-and-spoke). Documentation/files serve as the indirect communication channel. No shared task list, no messaging system.

### Q4: Can the parent delegate and just coordinate?

In principle yes (define orchestrator agent with delegation-only instructions), but no enforcement mechanism. No equivalent to Claude Code's Shift+Tab delegation mode.

### Q5: Does Cursor have TaskCreate/TaskList equivalents?

NO. No shared task management system between agents. The parent agent manages its own state; subagents have no visibility into each other's work or a shared work queue.

### Q6: Git worktrees for parallel -- how does this interact with subagents?

Worktrees and subagents are SEPARATE mechanisms. Worktrees provide file-level isolation for parallel agents. Subagents run in the same workspace. You can use both, but they are not integrated -- a subagent does not automatically get its own worktree.

### Q7: Can an orchestrator.md auto-delegate to other agents?

Yes, you can define an orchestrator in `.cursor/agents/orchestrator.md` that references other subagents. Automatic delegation works based on description matching. But the orchestrator has no special privileges -- it is just another agent with instructions to delegate.

### Q8: Latest Cursor beta/canary features?

Cursor 2.4 (Jan 22, 2026) added subagents, skills, and clarification questions. No newer agent team features found in changelog. Cloud agents have subagent delegation broken (confirmed bug). Custom modes deprecated in 2.1.

### Q9: How does Plan mode interact with subagent orchestration?

It does not. Plan mode is a separate workflow (research, ask, plan before implementing). There is no mechanism to feed a plan into subagent orchestration.

### Q10: Forum discussion about complex multi-agent workflows?

Limited. The orchestrator/boomerang request (post #108503) has no team response. The multi-agent orchestration showcase (post #150022) has 1 reply. Community is exploring but Cursor has not built orchestration primitives.

## Implications for Brain

### Brain's Orchestrator CANNOT Be Directly Ported to Cursor

The Claude Code orchestrator relies on capabilities Cursor does not have:

1. **No inter-agent messaging** -- Brain's orchestrator forwards context between teammates via SendMessage. Cursor subagents cannot message each other.
2. **No shared task list** -- Brain uses TaskCreate/Update/List/Get for work coordination. Cursor has no equivalent.
3. **No delegation enforcement** -- Brain's Shift+Tab delegation mode prevents the lead from implementing. Cursor has no enforcement mechanism.
4. **No debate/challenge pattern** -- Brain's teammates can directly challenge each other. Cursor subagents are isolated.

### What CAN Be Ported

1. **Subagent spawning** -- Brain's teammate spawning maps to Cursor's subagent spawning with `/agent-name` or automatic delegation
2. **Background execution** -- `is_background: true` maps to `run_in_background=True`
3. **Agent definitions** -- `.cursor/agents/*.md` format is similar to `.claude/agents/*.md` (frontmatter differs but body is compatible)
4. **MCP tool access** -- Subagents inherit MCP tools, so Brain MCP server works
5. **Skills** -- Identical SKILL.md format, auto-discovered

### Recommended Cursor Orchestration Strategy

Instead of porting the full Agent Teams pattern, Brain should use a **simplified hub-and-spoke pattern** for Cursor:

1. **Orchestrator agent** in `.cursor/agents/orchestrator.md` with instructions to delegate
2. **Specialist subagents** in `.cursor/agents/{specialist}.md` with focused roles
3. **File-based state sharing** -- use a `.brain/state/` directory for inter-agent state (since no messaging)
4. **Worktree isolation** for independent implementation tasks (prevents file conflicts)
5. **No shared task list** -- orchestrator manages its own task tracking internally
6. **Accept limitations** -- no debate pattern, no delegation enforcement, no nested communication

### The MCP Escape Hatch

Brain's MCP server could provide orchestration primitives that Cursor lacks natively:

- `brain_create_task` / `brain_list_tasks` -- shared task list via MCP
- `brain_send_message` / `brain_read_messages` -- inter-agent messaging via MCP
- `brain_get_agent_state` -- state sharing via MCP

This would make Brain's orchestration portable across any tool with MCP support, not just Claude Code. This aligns with the cross-platform proposal's Phase 4 strategy (move enforcement into MCP tools).

## Observations

- [fact] Cursor subagents cannot directly communicate with each other; parent-only hub-and-spoke model #architecture
- [fact] No shared task list exists in Cursor (no TaskCreate/TaskList equivalents) #gap
- [fact] No delegation enforcement mode in Cursor (no equivalent to Claude Code Shift+Tab) #gap
- [fact] Cursor supports up to 8 parallel agents via git worktrees with up to 20 worktrees per workspace #capacity
- [fact] Subagent delegation does NOT work in Cursor Cloud Agents (confirmed bug, Feb 2026) #blocker
- [fact] Custom modes deprecated in Cursor 2.1; replaced by custom slash commands #deprecation
- [fact] Cursor subagents inherit all parent tools including MCP servers #compatible
- [fact] Subagents are single-level only; nested subagents not supported #limitation
- [insight] Brain's full Agent Teams pattern cannot be directly ported to Cursor due to missing inter-agent communication and shared task management #incompatibility
- [insight] MCP server could provide orchestration primitives (task list, messaging, state) making Brain's orchestration portable across any MCP-supporting tool #strategy
- [decision] Cursor orchestration should use simplified hub-and-spoke pattern with file-based state sharing #recommendation
- [risk] Cursor's orchestration capabilities are less mature than Claude Code Agent Teams; patterns may change rapidly #stability

## Relations

- relates_to [[ANALYSIS-008-community-validation-research]]
- relates_to [[ANALYSIS-006-multi-tool-compatibility-research]]
- relates_to [[ADR-002-multi-tool-compatibility-architecture]]
- part_of [[SESSION-2026-02-09_01-multi-tool-compatibility-restructure]]
- relates_to [[FEAT-001 Multi-Tool Compatibility]]
