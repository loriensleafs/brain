---
type: design
id: DESIGN-001
title: Session state architecture with Brain note persistence
status: draft
priority: P0
related:
  - REQ-001
  - REQ-002
  - REQ-003
  - REQ-004
  - REQ-005
adr: ADR-016
created: 2026-01-18
updated: 2026-01-18
author: spec-generator
tags:
  - session-state
  - architecture
  - brain-persistence
---

# DESIGN-001: Session State Architecture with Brain Note Persistence

## Requirements Addressed

- REQ-001: Session state schema with orchestrator workflow tracking
- REQ-002: Optimistic locking for concurrent session updates
- REQ-003: HMAC-SHA256 signing for session state integrity
- REQ-004: Fail-closed behavior for PreToolUse hook gate checks
- REQ-005: Brain note persistence model for session state

## Design Overview

The session state architecture implements a two-tier persistence model with Brain notes as the single source of truth and an in-memory cache for performance. The architecture supports:

1. **Orchestrator workflow tracking** - Full agent routing history with decisions and verdicts
2. **Concurrent updates** - Optimistic locking with version-based conflict detection
3. **Integrity protection** - HMAC-SHA256 signing to prevent tampering
4. **Fail-closed gates** - PreToolUse hook blocks destructive tools when state unavailable
5. **Brain persistence** - Brain notes provide durable storage across restarts

The design eliminates the file cache (`session.json`) used in the original implementation, relying entirely on Brain MCP for persistence.

## Component Architecture

### Component 1: Session State Schema

**Purpose**: Define TypeScript interfaces for session state with orchestrator workflow tracking.

**Responsibilities**:

- Define SessionState interface with core fields and orchestratorWorkflow
- Define OrchestratorWorkflow interface with agent history, decisions, verdicts
- Define AgentInvocation interface for agent routing metadata
- Define Decision, Verdict, Handoff interfaces for workflow tracking
- Define AgentType union for all 16 agent types
- Define SignedSessionState interface extending SessionState with _signature field

**Interfaces**:

```typescript
// Core session state
interface SessionState {
  sessionId: string;
  currentMode: WorkflowMode;
  modeHistory: ModeHistoryEntry[];
  protocolStartComplete: boolean;
  protocolEndComplete: boolean;
  protocolStartEvidence: Record<string, string>;
  protocolEndEvidence: Record<string, string>;
  orchestratorWorkflow: OrchestratorWorkflow | null;
  activeFeature?: string;
  activeTask?: string;
  version: number;  // For optimistic locking
  createdAt: string;
  updatedAt: string;
}

// Orchestrator workflow tracking
interface OrchestratorWorkflow {
  activeAgent: AgentType | null;
  workflowPhase: "planning" | "implementation" | "validation" | "complete";
  agentHistory: AgentInvocation[];
  decisions: Decision[];
  verdicts: Verdict[];
  pendingHandoffs: Handoff[];
  compactionHistory: CompactionEntry[];
  startedAt: string;
  lastAgentChange: string;
}

// Agent invocation metadata
interface AgentInvocation {
  agent: AgentType;
  startedAt: string;
  completedAt: string | null;
  status: "in_progress" | "completed" | "failed" | "blocked";
  input: {
    prompt: string;
    context: Record<string, any>;
    artifacts: string[];
  };
  output: {
    artifacts: string[];
    summary: string;
    recommendations: string[];
    blockers: string[];
  } | null;
  handoffFrom: AgentType | null;
  handoffTo: AgentType | null;
  handoffReason: string;
}

// Decision tracking
interface Decision {
  id: string;
  type: "architectural" | "technical" | "process" | "scope";
  description: string;
  rationale: string;
  decidedBy: AgentType;
  approvedBy: AgentType[];
  rejectedBy: AgentType[];
  timestamp: string;
}

// Verdict aggregation
interface Verdict {
  agent: AgentType;
  decision: "approve" | "reject" | "conditional" | "needs_revision";
  confidence: number;
  reasoning: string;
  conditions?: string[];
  blockers?: string[];
  timestamp: string;
}

// Agent handoff metadata
interface Handoff {
  fromAgent: AgentType;
  toAgent: AgentType;
  reason: string;
  context: string;
  artifacts: string[];
  preservedContext?: Record<string, any>;
  createdAt: string;
}

// Compaction tracking
interface CompactionEntry {
  notePath: string;
  compactedAt: string;
  count: number;
}

// Agent types
type AgentType =
  | "orchestrator"
  | "analyst"
  | "architect"
  | "planner"
  | "implementer"
  | "critic"
  | "qa"
  | "security"
  | "devops"
  | "retrospective"
  | "memory"
  | "skillbook"
  | "independent-thinker"
  | "high-level-advisor"
  | "explainer"
  | "task-generator"
  | "pr-comment-responder";

// Signed state with HMAC
interface SignedSessionState extends SessionState {
  _signature: string;
}
```

**File Location**: `apps/mcp/src/services/session/types.ts`

---

### Component 2: Brain Note Persistence

**Purpose**: Persist session state to Brain MCP notes with signature verification.

**Responsibilities**:

- Write session state to Brain note at `sessions/session-{sessionId}`
- Update current session pointer at `sessions/current-session`
- Read session state from Brain notes
- Load current session on MCP startup
- Store brain specialist agent context in separate notes

**Interfaces**:

```typescript
class BrainSessionPersistence {
  constructor(private brainMCP: BrainMCPClient);

  async saveSession(session: SessionState): Promise<void>;
  async loadSession(sessionId: string): Promise<SessionState | null>;
  async getCurrentSession(): Promise<SessionState | null>;
  async saveAgentContext(sessionId: string, agent: AgentType, invocation: AgentInvocation): Promise<void>;
}
```

**Implementation**:

```typescript
export class BrainSessionPersistence {
  constructor(private brainMCP: BrainMCPClient) {}

  async saveSession(session: SessionState): Promise<void> {
    // Sign session state
    const signed = signSessionState(session);

    // Write to Brain note (source of truth)
    await this.brainMCP.writeNote({
      title: `sessions/session-${session.sessionId}`,
      content: JSON.stringify(signed, null, 2),
      category: "sessions",
      project: process.cwd(),
    });

    // Update current session pointer
    await this.brainMCP.writeNote({
      title: "sessions/current-session",
      content: session.sessionId,
      category: "sessions",
      project: process.cwd(),
    });
  }

  async loadSession(sessionId: string): Promise<SessionState | null> {
    try {
      const note = await this.brainMCP.readNote({
        identifier: `sessions/session-${sessionId}`,
        project: process.cwd(),
      });

      const state = JSON.parse(note.content) as SignedSessionState;

      // Verify signature
      if (!verifySessionState(state)) {
        throw new Error(`Session state signature invalid for ${sessionId}`);
      }

      return state;
    } catch (err) {
      return null;
    }
  }

  async getCurrentSession(): Promise<SessionState | null> {
    try {
      const currentNote = await this.brainMCP.readNote({
        identifier: "sessions/current-session",
        project: process.cwd(),
      });

      const sessionId = currentNote.content.trim();
      return await this.loadSession(sessionId);
    } catch (err) {
      return null;
    }
  }

  async saveAgentContext(
    sessionId: string,
    agent: AgentType,
    invocation: AgentInvocation
  ): Promise<void> {
    await this.brainMCP.writeNote({
      title: `session-${sessionId}-agent-${agent}`,
      content: JSON.stringify(invocation, null, 2),
      category: "session-agents",
      project: process.cwd(),
    });
  }
}
```

**File Location**: `apps/mcp/src/services/session/brain-persistence.ts`

---

### Component 3: Session State Signing

**Purpose**: Sign and verify session state using HMAC-SHA256 to prevent tampering.

**Responsibilities**:

- Generate HMAC-SHA256 signature of session state
- Verify signature on state load
- Use server-side secret key from environment variable
- Canonical JSON serialization with sorted keys

**Interfaces**:

```typescript
function signSessionState(state: SessionState): SignedSessionState;
function verifySessionState(state: SignedSessionState): boolean;
```

**Implementation**:

```typescript
import { createHmac } from 'crypto';

const SESSION_SECRET = process.env.BRAIN_SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("BRAIN_SESSION_SECRET environment variable required");
}

export function signSessionState(state: SessionState): SignedSessionState {
  const stateWithoutSignature = { ...state };
  delete (stateWithoutSignature as any)._signature;

  // Canonical serialization with sorted keys
  const serialized = JSON.stringify(
    stateWithoutSignature,
    Object.keys(stateWithoutSignature).sort()
  );

  const signature = createHmac('sha256', SESSION_SECRET)
    .update(serialized)
    .digest('hex');

  return { ...state, _signature: signature };
}

export function verifySessionState(state: SignedSessionState): boolean {
  const expectedSignature = state._signature;
  if (!expectedSignature) return false;

  const stateWithoutSignature = { ...state };
  delete (stateWithoutSignature as any)._signature;

  const serialized = JSON.stringify(
    stateWithoutSignature,
    Object.keys(stateWithoutSignature).sort()
  );

  const actualSignature = createHmac('sha256', SESSION_SECRET)
    .update(serialized)
    .digest('hex');

  return actualSignature === expectedSignature;
}
```

**File Location**: `apps/mcp/src/services/session/signing.ts`

---

### Component 4: Optimistic Locking

**Purpose**: Prevent concurrent update conflicts using version-based optimistic locking.

**Responsibilities**:

- Increment version on every update
- Detect version conflicts on write
- Retry updates up to 3 times on conflict
- Throw error after max retries

**Interfaces**:

```typescript
async function updateSessionWithLocking(
  sessionId: string,
  updates: Partial<SessionState>,
  maxRetries?: number
): Promise<void>;
```

**Implementation**:

```typescript
export async function updateSessionWithLocking(
  sessionId: string,
  updates: Partial<SessionState>,
  maxRetries: number = 3
): Promise<void> {
  const persistence = new BrainSessionPersistence(brainMCP);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Read current state
    const current = await persistence.loadSession(sessionId);
    if (!current) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const expectedVersion = current.version;

    // Apply updates
    const updated: SessionState = {
      ...current,
      ...updates,
      version: expectedVersion + 1,
      updatedAt: new Date().toISOString(),
    };

    // Write to Brain note
    await persistence.saveSession(updated);

    // Verify version
    const verification = await persistence.loadSession(sessionId);
    if (verification && verification.version === expectedVersion + 1) {
      return;  // Success
    }

    // Version conflict
    console.warn(
      `Version conflict on session ${sessionId}, attempt ${attempt + 1}`
    );
  }

  throw new Error(
    `Failed to update session ${sessionId} after ${maxRetries} attempts`
  );
}
```

**File Location**: `apps/mcp/src/services/session/optimistic-locking.ts`

---

### Component 5: Session Service

**Purpose**: High-level API for session state management with workflow tracking.

**Responsibilities**:

- Create new sessions
- Update session state with optimistic locking
- Add agent invocations, decisions, verdicts
- Complete agent invocations
- Compact session history when threshold exceeded

**Interfaces**:

```typescript
class SessionService {
  async createSession(sessionId: string): Promise<SessionState>;
  async getSession(sessionId: string): Promise<SessionState>;
  async updateSession(sessionId: string, updates: Partial<SessionState>): Promise<void>;
  async addAgentInvocation(sessionId: string, invocation: AgentInvocation): Promise<void>;
  async addDecision(sessionId: string, decision: Decision): Promise<void>;
  async addVerdict(sessionId: string, verdict: Verdict): Promise<void>;
  async completeAgentInvocation(sessionId: string, agent: AgentType, output: AgentInvocation["output"]): Promise<void>;
  async compactSessionHistory(sessionId: string): Promise<void>;
}
```

**Implementation**: See implementation notes below.

**File Location**: `apps/mcp/src/services/session/index.ts`

---

### Component 6: Brain CLI Bridge

**Purpose**: Provide CLI commands for hooks to query session state via Brain CLI.

**Responsibilities**:

- `brain session get-state` command reads current session from Brain notes
- `brain session set-state` command updates session in Brain notes
- Return JSON output for hook consumption
- Handle MCP connection errors gracefully

**Interfaces**:

```typescript
// CLI command handler
async function getSessionState(): Promise<SessionState>;
async function setSessionState(sessionId: string, updates: Partial<SessionState>): Promise<void>;
```

**Implementation**:

```typescript
// apps/cli/src/commands/session/get-state.ts
export async function getSessionState(): Promise<SessionState> {
  const brainMCP = await connectToBrainMCP();
  const persistence = new BrainSessionPersistence(brainMCP);

  const session = await persistence.getCurrentSession();
  if (!session) {
    throw new Error("No current session found");
  }

  // Output JSON for hook consumption
  console.log(JSON.stringify(session));
  return session;
}
```

**Hook Integration**:

```go
// apps/claude-plugin/cmd/hooks/pre_tool_use.go
func PerformGateCheck(tool string) *GateCheckResult {
  cmd := exec.Command("brain", "session", "get-state")
  output, err := cmd.Output()

  // FAIL CLOSED: Block destructive tools if state unavailable
  if err != nil {
    if isReadOnlyTool(tool) {
      return &GateCheckResult{Allowed: true}
    }
    return &GateCheckResult{
      Allowed: false,
      Message: fmt.Sprintf("Session state unavailable. Blocking %s.", tool),
      Mode:    "unknown",
    }
  }

  // Parse session state
  var state SessionState
  if err := json.Unmarshal(output, &state); err != nil {
    return &GateCheckResult{
      Allowed: false,
      Message: "Failed to parse session state",
      Mode:    "unknown",
    }
  }

  // Disabled mode bypasses gates
  if state.CurrentMode == "disabled" {
    return &GateCheckResult{Allowed: true, Mode: "disabled"}
  }

  // Check protocol completion
  if !state.ProtocolStartComplete {
    return &GateCheckResult{
      Allowed: false,
      Message: "Session protocol incomplete",
      Mode:    "blocked",
    }
  }

  // Normal mode-based checking
  return CheckToolBlocked(tool, state.CurrentMode)
}

func isReadOnlyTool(tool string) bool {
  readOnlyTools := []string{"Read", "Glob", "Grep", "LSP", "WebFetch", "WebSearch"}
  for _, t := range readOnlyTools {
    if tool == t {
      return true
    }
  }
  return false
}
```

**File Locations**:

- `apps/cli/src/commands/session/get-state.ts`
- `apps/cli/src/commands/session/set-state.ts`
- `apps/claude-plugin/cmd/hooks/pre_tool_use.go`

---

### Component 7: Session History Compaction

**Purpose**: Compact agent history when it exceeds threshold to prevent unbounded growth.

**Responsibilities**:

- Trigger compaction when agentHistory.length > 10
- Keep last 3 invocations in session state
- Store full history in separate Brain note
- Preserve all decisions and verdicts (never compact)
- Track compaction history with note paths

**Interfaces**:

```typescript
async function compactSessionState(session: SessionState): Promise<CompactionResult>;

interface CompactionResult {
  compactedState: SessionState;
  historyNote: string;
}
```

**Implementation**:

```typescript
export async function compactSessionState(
  session: SessionState
): Promise<CompactionResult> {
  const workflow = session.orchestratorWorkflow;
  if (!workflow || workflow.agentHistory.length <= 10) {
    throw new Error("Compaction not needed");
  }

  // Keep last 3 invocations
  const recentInvocations = workflow.agentHistory.slice(-3);
  const historicalInvocations = workflow.agentHistory.slice(0, -3);

  // Store full history in Brain note
  const historyNotePath = `sessions/session-${session.sessionId}-history-${Date.now()}`;
  await brainMCP.writeNote({
    title: historyNotePath,
    content: JSON.stringify({
      sessionId: session.sessionId,
      compactedAt: new Date().toISOString(),
      fullHistory: historicalInvocations,
    }, null, 2),
    category: "session-history",
  });

  // Update workflow with compacted history
  const compactedWorkflow = {
    ...workflow,
    agentHistory: recentInvocations,
    compactionHistory: [
      ...(workflow.compactionHistory || []),
      {
        notePath: historyNotePath,
        compactedAt: new Date().toISOString(),
        count: historicalInvocations.length,
      },
    ],
  };

  return {
    compactedState: { ...session, orchestratorWorkflow: compactedWorkflow },
    historyNote: historyNotePath,
  };
}
```

**File Location**: `apps/mcp/src/services/session/compaction.ts`

---

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Persistence** | Brain MCP notes only | Single source of truth, eliminates file cache |
| **Concurrency** | Optimistic locking with version field | Simple, no distributed locks, 3-retry handles transients |
| **Integrity** | HMAC-SHA256 signing | Detect tampering, server-side secret, no key management complexity |
| **Gate behavior** | Fail-closed with read-only whitelist | Security by default, explicit opt-out via "disabled" mode |
| **Compaction** | Keep last 3, store history in Brain notes | Balance completeness and performance |
| **Hook interface** | Brain CLI (not direct MCP) | Hooks cannot access MCP directly, CLI provides bridge |

## Security Considerations

- **BRAIN_SESSION_SECRET** must be 32+ characters, randomly generated, stored securely
- **Signature verification** blocks tools if signature invalid (fail-closed)
- **Read-only tool whitelist** prevents destructive operations when state unknown
- **Mode "disabled"** provides explicit opt-out, but should be documented as security risk
- **Brain notes** stored in file system, should have appropriate file permissions

## Testing Strategy

1. **Unit tests**:
   - Session state schema validation (TypeScript compilation)
   - HMAC signing and verification
   - Optimistic locking retry logic
   - Compaction algorithm (keep last 3, store history)
   - Brain persistence read/write operations

2. **Integration tests**:
   - SessionStart hook → Brain CLI → session state load
   - PreToolUse hook → Brain CLI → gate check (with/without state)
   - Agent invocation tracking end-to-end
   - Concurrent session updates (version conflicts)
   - MCP restart → session state reload from Brain notes

3. **Security tests**:
   - Tampered session state → signature verification fails
   - Missing BRAIN_SESSION_SECRET → MCP startup fails
   - State unavailable → fail-closed behavior (read-only tools allowed)
   - Signature mismatch → PreToolUse blocks all destructive tools

4. **Performance tests**:
   - Session state compaction at 10, 20, 50 invocations
   - Brain note read/write latency
   - In-memory cache hit rate

## Open Questions

- **Compaction retention period**: How long should historical Brain notes be retained? (Suggested: 30 days, configurable)
- **Concurrent workflow updates**: Should Inngest workflows coordinate to avoid version conflicts? (Suggested: Sequential execution via Inngest steps)
- **Brain note size limits**: What is the maximum practical size for session state notes? (Need testing)
- **MCP startup time**: How long does it take to load session state from Brain notes on restart? (Need benchmarking)
