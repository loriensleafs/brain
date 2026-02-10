---
title: ANALYSIS-013-mcp-orchestration-research
type: note
permalink: analysis/analysis-013-mcp-orchestration-research
tags:
- analysis
- mcp
- orchestration
- agent-teams
- task-management
- inter-agent
- a2a
- cross-platform
---

# ANALYSIS-013 MCP Orchestration Research

## Context

Research into whether Brain should build MCP-based orchestration primitives (task lists, messaging, state sharing) to make the Agent Teams pattern portable across Cursor and other tools. This is the key strategic question: should Brain's orchestration become protocol-level (MCP) rather than tool-specific (Claude Code Agent Teams)?

## Q1: Has Anyone Built MCP-Based Orchestration Primitives?

**Yes. Multiple implementations exist.**

### mcp-task-orchestrator (EchoingVesper)

The most mature implementation. Provides 7 MCP tools:

- `orchestrator_initialize_session` -- Start workflows
- `orchestrator_plan_task` -- Decompose into subtasks with dependency mapping
- `orchestrator_execute_task` -- Process subtasks with specialist role context
- `orchestrator_complete_task` -- Mark complete, capture artifacts
- `orchestrator_synthesize_results` -- Combine outputs
- `orchestrator_get_status` -- Progress tracking
- `orchestrator_maintenance_coordinator` -- Cleanup and optimization

Uses SQLite for state persistence. Implements role-based specialist execution (Architect, Implementer, Tester, Documenter, Reviewer, Debugger). Supports Claude Desktop, Cursor, Windsurf, and VS Code with Cline.

**Key insight**: This is almost exactly what Brain would need to build. The task decomposition, dependency mapping, specialist execution, and state tracking via MCP tools is the same pattern as Claude Code Agent Teams but protocol-portable.

### todo-mcp (floriscornel)

Simple task management MCP server with PostgreSQL backend:

- getLists, createList, getTasks, createTask, completeTask, archiveTask
- Priority-based sorting, persistent state
- Could be extended for inter-agent coordination

### mcp-tasks (flesler)

Task management MCP with multi-format support (Markdown, JSON, YAML).

### task-mcp-server (milkosten)

Another task management MCP server reference implementation.

### Integration servers

Todoist MCP, Microsoft To Do MCP, Things3 MCP -- external task service integrations.

**Conclusion**: The pattern of exposing task management via MCP tools is well-established. Multiple implementations demonstrate feasibility. The mcp-task-orchestrator is the closest precedent to what Brain needs.

## Q2: Cursor Team on Future Orchestration Features

**No official roadmap or commitments found.**

Forum activity shows strong community demand:

- "Agentic orchestration for Cursor" (post #132312) -- requests team-based agent orchestration with specialized agent teams, lead agents, memory managers, shared context. No Cursor team response.
- "Orchestrator/boomerang agent + cursor modes" (post #108503) -- requests auto-delegation between modes. No Cursor team response.
- "Multi-Agent Orchestration in Cursor" (post #150022) -- demonstration of hierarchical delegation. 1 community reply.
- "Background agent orchestrator" (post #142478) -- community member built custom orchestrator using Background Agent API with dependency-based parallelization (inspired by GitHub Actions "needs" concept). No MCP -- uses Background Agent API directly.

**Pattern**: Community is building orchestration workarounds because Cursor does not provide native primitives. The most advanced community solution uses the Background Agent API with a dependency graph.

## Q3: Cursor Roadmap Hints

**No formal roadmap published.** Cursor 2.4 (Jan 2026) added subagents and skills. No announced features for agent teams, inter-agent communication, shared task lists, or orchestration primitives.

Community expectations suggest Cursor will eventually add orchestration features, but no timeline or specifics. The Background Agent API is the closest thing to an orchestration primitive.

## Q4: OpenAI Agents SDK Inter-Agent Communication

The OpenAI Agents SDK uses a **handoff pattern**:

- Agents have a `handoffs` parameter listing other agents they can delegate to
- Handoffs are exposed as tools to the LLM (e.g., `transfer_to_refund_agent`)
- `on_handoff` callback executes when handoff is invoked (useful for data fetching)
- Two models: **handoff** (agents know each other, can defer) vs **agent-as-tool** (one agent calls others as tools, keeps control)

**Relevance to Brain**: The agent-as-tool pattern is closer to what Brain needs for Cursor. The orchestrator calls specialist agents as tools (subagents), maintaining a single thread of control. This matches Cursor's hub-and-spoke subagent model.

Brain could implement a similar pattern via MCP:

- `brain_handoff_to(agent_name, task_description)` -- delegate to specialist
- `brain_get_handoff_result(handoff_id)` -- retrieve result
- The MCP server maintains the handoff registry and state

## Q5: Google A2A Protocol and MCP Compatibility

**A2A and MCP are complementary, not competing.**

| Protocol | Scope | Communication Model |
|:--|:--|:--|
| MCP | Agent-to-tool (connecting agents to external resources) | Client-server, JSON-RPC 2.0 |
| A2A | Agent-to-agent (peer coordination) | Client-server, JSON-RPC 2.0, webhooks, SSE |

A2A key concepts:

- **Agent Cards**: JSON metadata advertising capabilities, endpoints, auth requirements (like service registry)
- **Task lifecycle**: submitted -> working -> input-required -> completed/failed
- **Message structure**: TextPart, FilePart, DataPart with role designations
- **Artifacts**: Tangible outputs streamed incrementally
- **Privacy**: Agents are opaque -- no internal state exposure

A2A is designed for inter-organization agent communication (e.g., retail agent talks to supplier agent). It is NOT designed for intra-tool orchestration (e.g., subagents within Cursor). The overhead of A2A (discovery, authentication, agent cards) is excessive for Brain's use case of coordinating subagents within a single tool session.

**Verdict**: A2A is not the right protocol for Brain's intra-tool orchestration. MCP is the better fit because it is already present in every target tool and provides the right abstraction level (tools exposed to the LLM).

## Q6: Existing MCP Task/Project Management Servers

Comprehensive list:

| Server | Storage | Tools | Complexity |
|:--|:--|:--|:--|
| mcp-task-orchestrator | SQLite | 7 (full lifecycle) | High (roles, deps, synthesis) |
| todo-mcp (floriscornel) | PostgreSQL | 6 (CRUD + priority) | Medium |
| mcp-tasks (flesler) | Multi-format | Multi-format export | Medium |
| todo-list-mcp (RegiByte) | SQLite | CRUD | Low (educational) |
| task-mcp-server (milkosten) | Unknown | Task API | Low-Medium |
| Todoist MCP | Todoist API | Task + project mgmt | Medium (external service) |
| Microsoft To Do MCP | Graph API | 13 tools (lists, tasks, checklists) | High (OAuth 2.0) |

**Brain does not need to build from scratch.** The mcp-task-orchestrator provides a proven architecture that Brain can adapt or extend.

## Q7: What Would brain_create_task / brain_send_message Look Like?

### Proposed MCP Tools for Brain Orchestration

**Task Management:**

```
brain_create_task(title, description, dependencies?, assignee?, priority?)
  -> Returns task_id
  
brain_update_task(task_id, status: "pending"|"in_progress"|"completed"|"blocked")
  -> Updates task state

brain_list_tasks(filter?: {status?, assignee?})
  -> Returns task list with dependency status

brain_get_task(task_id)
  -> Returns full task details
```

**Inter-Agent Messaging:**

```
brain_send_message(from_agent, to_agent, content, summary?)
  -> Stores message in message queue

brain_read_messages(agent_name, unread_only?: true)
  -> Returns messages for this agent

brain_broadcast(from_agent, content, summary?)
  -> Sends to all registered agents
```

**Agent Registry:**

```
brain_register_agent(name, role, capabilities?)
  -> Registers agent in the current session

brain_get_agents()
  -> Lists all registered agents in session
```

**State Sharing:**

```
brain_set_state(key, value, scope: "session"|"agent")
  -> Stores key-value state

brain_get_state(key, scope?)
  -> Retrieves state
```

### Precedent

The mcp-task-orchestrator already provides task_plan, task_execute, task_complete, and task_status. Brain would add messaging and agent registry on top.

The todo-mcp pattern (priority-based, persistent, multi-list) demonstrates the storage and API design for task management via MCP.

The CAMEL-AI blog demonstrates the adapter pattern for agent-to-agent communication via MCP: protocol translator + communication layer + context manager + tool integrator.

## Q8: Engineering Effort to Add to Brain's MCP Server

Brain's existing MCP server (apps/mcp/) is TypeScript with stdio/HTTP dual transport, 16 wrapper tools + 40 proxied from basic-memory. Adding orchestration primitives:

### Effort Estimate

| Component | Tools | Complexity | Estimated Hours |
|:--|:--|:--|:--|
| Task CRUD (create, update, list, get) | 4 tools | Low -- SQLite or in-memory | 4-8h |
| Task dependencies and auto-unblocking | 1 tool enhancement | Medium -- dependency graph | 4-6h |
| Message queue (send, read, broadcast) | 3 tools | Low -- in-memory queue with persistence | 4-8h |
| Agent registry (register, list) | 2 tools | Low -- session-scoped registry | 2-4h |
| State sharing (set, get) | 2 tools | Low -- key-value store | 2-4h |
| Session management (create, complete) | 2 tools | Medium -- lifecycle tracking | 4-6h |
| Tests and validation | -- | Medium | 8-12h |
| **Total** | **~14 tools** | | **28-48h** |

This is less effort than the dual TS+Go adapter system in ADR-002 (estimated at 49-81h AI-assisted for the full multi-tool architecture). The MCP orchestration primitives are self-contained additions to an existing server.

### Implementation Strategy

1. Start with task CRUD + dependency tracking (most critical for orchestration)
2. Add messaging queue (enables inter-agent communication across any MCP client)
3. Add agent registry (enables dynamic specialist discovery)
4. State sharing last (lower priority, can use files initially)

### Key Advantage

Once these tools exist in Brain's MCP server, they work in ANY tool that supports MCP -- Claude Code, Cursor, Codex, Gemini, VS Code, and all 40+ tools supported by the Vercel Skills CLI. No per-tool adaptation needed. This is the "basic-memory pattern" applied to orchestration.

## Strategic Assessment

### Should Brain Build MCP-Based Orchestration?

**YES.** Strong evidence supports this:

1. **Proven pattern**: mcp-task-orchestrator demonstrates feasibility and is used across Claude Desktop, Cursor, Windsurf, VS Code
2. **Community demand**: Cursor forum shows strong demand for orchestration that Cursor itself has not provided
3. **Protocol portability**: MCP is supported by 40+ tools. Building on MCP makes Brain's orchestration universally accessible.
4. **Moderate effort**: 28-48h estimated, less than the per-tool adapter system
5. **Complements existing architecture**: Brain's MCP server already exists; this is an extension, not a rewrite
6. **Strategic differentiation**: Brain becomes the only agent skill system with protocol-portable orchestration primitives
7. **Aligns with cross-platform proposal**: Phase 4 strategy (move enforcement into MCP) is directly implemented by this approach

### Risks

1. **MCP tools are advisory, not enforced**: The LLM decides whether to call brain_create_task. Without native tool enforcement (like Claude Code's Agent Teams), agents may ignore orchestration tools.
2. **Latency**: MCP tool calls add latency vs native Agent Teams primitives. For rapid task switching, this may be noticeable.
3. **Context consumption**: Each MCP tool call consumes context window tokens. Complex orchestration may consume significant context.
4. **Single-server bottleneck**: All orchestration runs through one MCP server. If the server crashes, all state is lost (unless persisted to SQLite).

### Recommendation

Build MCP orchestration primitives as a **complement** to native Agent Teams on Claude Code, not a replacement:

- On Claude Code: Use native Agent Teams (faster, enforced, richer API) with MCP orchestration as fallback
- On Cursor: Use MCP orchestration as the primary mechanism (Cursor lacks native equivalents)
- On other tools: MCP orchestration is the universal pattern

This gives Brain the best of both worlds: native performance on Claude Code, universal portability via MCP everywhere else.

## Observations

- [fact] mcp-task-orchestrator provides 7 MCP tools for task decomposition, specialist execution, and result synthesis across Claude/Cursor/Windsurf/VS Code #precedent
- [fact] Multiple todo/task MCP servers exist (6+ implementations) demonstrating established pattern for task management via MCP #ecosystem
- [fact] A2A protocol (Google, 150+ orgs) handles agent-to-agent communication but is designed for inter-organization coordination, not intra-tool orchestration #protocol
- [fact] MCP and A2A are complementary: MCP for agent-to-tool, A2A for agent-to-agent; most systems will use both #protocol
- [fact] OpenAI Agents SDK uses handoff pattern (agents as tools) which maps well to Cursor's hub-and-spoke subagent model #pattern
- [fact] Cursor community is building orchestration workarounds (Background Agent API with dependency graphs) because Cursor provides no native primitives #demand
- [fact] No Cursor team response or roadmap for agent teams, inter-agent communication, or shared task lists #gap
- [decision] Brain should build MCP orchestration primitives (~14 tools, 28-48h) as complement to native Agent Teams #recommendation
- [insight] MCP orchestration makes Brain's Agent Teams pattern portable to any MCP-supporting tool (40+) without per-tool adaptation #strategy
- [insight] MCP tools are advisory (LLM decides whether to call them), unlike native Agent Teams which enforce orchestration patterns #limitation
- [risk] MCP orchestration adds latency and context consumption compared to native Agent Teams primitives #tradeoff

## Relations

- relates_to [[ANALYSIS-012-cursor-orchestrator-research]]
- relates_to [[ANALYSIS-008-community-validation-research]]
- relates_to [[ADR-002-multi-tool-compatibility-architecture]]
- part_of [[SESSION-2026-02-09_01-multi-tool-compatibility-restructure]]
- relates_to [[FEAT-001 Multi-Tool Compatibility]]
