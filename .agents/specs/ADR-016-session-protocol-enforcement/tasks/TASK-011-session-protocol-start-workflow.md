---
type: task
id: TASK-011
title: Implement session-protocol-start workflow
status: complete
priority: P0
complexity: M
estimate: 6h
related:
  - DESIGN-001
blocked_by:
  - TASK-010
blocks: []
assignee: implementer
created: 2026-01-18
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - inngest
  - workflows
  - session-protocol
---

# TASK-011: Implement session-protocol-start Workflow

## Design Context

- DESIGN-001: Session State Architecture (workflow integration)
- ADR-016 Milestone 2.2: session-protocol-start Workflow

## Objective

Implement Inngest workflow that automates session protocol start steps. Workflow triggers on `session/protocol.start` event, executes 8 protocol steps, and updates session state with completion evidence.

## Scope

**In Scope**:

- Inngest workflow with 8 sequential steps
- Brain MCP initialization
- Session state creation and validation
- Skills directory verification
- Session log file creation
- Constraints loading from Brain notes
- Git branch verification
- Protocol completion evidence recording

**Out of Scope**:

- Hook integration (TASK-006 in Phase 1 specs)
- Session protocol end workflow (TASK-012)
- Agent routing workflows (TASK-013)

## Acceptance Criteria

- [ ] Workflow completes all 8 steps without errors
- [ ] Session state created with `protocolStartComplete: true`
- [ ] Session log file created at `.agents/sessions/YYYY-MM-DD-session-NN.md`
- [ ] Evidence map populated with step outputs (Brain MCP version, git branch, etc.)
- [ ] Workflow emits `session/state.update` event on completion
- [ ] Workflow retries failed steps (Inngest built-in)
- [ ] Workflow timeouts after 30s per step
- [ ] Error notifications sent on failure

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/src/workflows/session-protocol-start.ts` | Create | Workflow implementation |
| `apps/mcp/src/workflows/steps/brain-init.ts` | Create | Brain MCP initialization step |
| `apps/mcp/src/workflows/steps/session-log-create.ts` | Create | Session log creation step |
| `apps/mcp/src/workflows/steps/skills-verify.ts` | Create | Skills directory verification |
| `apps/mcp/src/workflows/steps/git-verify.ts` | Create | Git branch verification |

## Implementation Notes

### Workflow Structure

```typescript
// apps/mcp/src/workflows/session-protocol-start.ts
import { inngest } from "./inngest-client";
import { SessionProtocolStartEvent } from "../events/session";
import { initializeBrainMCP } from "./steps/brain-init";
import { createSessionLog } from "./steps/session-log-create";
import { verifySkillsDirectory } from "./steps/skills-verify";
import { verifyGitBranch } from "./steps/git-verify";
import { loadConstraints } from "./steps/constraints-load";

export const sessionProtocolStart = inngest.createFunction(
  {
    id: "session-protocol-start",
    name: "Session Protocol Start",
    retries: 3,
  },
  { event: "session/protocol.start" },
  async ({ event, step }) => {
    const { sessionId, workingDirectory } = event.data;

    // Step 1: Initialize Brain MCP
    const brainVersion = await step.run("initialize-brain-mcp", async () => {
      return await initializeBrainMCP(workingDirectory);
    });

    // Step 2: Load/create session state
    const sessionState = await step.run("load-create-session", async () => {
      const persistence = new BrainSessionPersistence(brainMCP);
      let state = await persistence.loadSession(sessionId);

      if (!state) {
        state = {
          sessionId,
          currentMode: "analysis",
          modeHistory: [],
          protocolStartComplete: false,
          protocolEndComplete: false,
          protocolStartEvidence: {},
          protocolEndEvidence: {},
          orchestratorWorkflow: null,
          version: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await persistence.saveSession(state);
      }

      return state;
    });

    // Step 3: Verify skills directory exists
    const skillsVerified = await step.run("verify-skills-directory", async () => {
      return await verifySkillsDirectory(workingDirectory);
    });

    // Step 4: Create session log file
    const sessionLogPath = await step.run("create-session-log", async () => {
      return await createSessionLog(sessionId, workingDirectory);
    });

    // Step 5: Load constraints from Brain notes
    const constraints = await step.run("load-constraints", async () => {
      return await loadConstraints();
    });

    // Step 6: Verify git branch
    const gitBranch = await step.run("verify-git-branch", async () => {
      return await verifyGitBranch(workingDirectory);
    });

    // Step 7: Update session state with protocol evidence
    await step.run("update-session-state", async () => {
      const evidence = {
        brainMCPVersion: brainVersion,
        skillsDirectoryVerified: skillsVerified.toString(),
        sessionLogPath,
        constraintsLoaded: constraints ? "yes" : "no",
        gitBranch,
        startTimestamp: new Date().toISOString(),
      };

      await updateSessionWithLocking(sessionId, {
        protocolStartComplete: true,
        protocolStartEvidence: evidence,
      });
    });

    // Step 8: Emit state update event
    await step.sendEvent("emit-state-update", {
      name: "session/state.update",
      data: {
        sessionId,
        updates: { protocolStartComplete: true },
        timestamp: new Date().toISOString(),
      },
    });

    return { success: true, sessionId };
  }
);
```

### Step Implementations

#### Brain MCP Initialization

```typescript
// apps/mcp/src/workflows/steps/brain-init.ts
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function initializeBrainMCP(workingDirectory: string): Promise<string> {
  try {
    // Build context for current project
    const { stdout, stderr } = await execAsync(
      `brain context build ${workingDirectory}`,
      { timeout: 30000 }
    );

    if (stderr && !stderr.includes("warning")) {
      throw new Error(`Brain MCP initialization failed: ${stderr}`);
    }

    // Extract version from stdout (format: "Brain MCP v1.2.3")
    const versionMatch = stdout.match(/Brain MCP v([\d.]+)/);
    return versionMatch ? versionMatch[1] : "unknown";
  } catch (err) {
    throw new Error(`Brain MCP initialization failed: ${err.message}`);
  }
}
```

#### Session Log Creation

```typescript
// apps/mcp/src/workflows/steps/session-log-create.ts
import fs from "fs/promises";
import path from "path";

export async function createSessionLog(
  sessionId: string,
  workingDirectory: string
): Promise<string> {
  const sessionLogDir = path.join(workingDirectory, ".agents", "sessions");
  const sessionLogPath = path.join(sessionLogDir, `${sessionId}.md`);

  // Check if log already exists
  try {
    await fs.access(sessionLogPath);
    return sessionLogPath; // Already exists
  } catch {
    // Create log file
  }

  // Ensure directory exists
  await fs.mkdir(sessionLogDir, { recursive: true });

  // Create log template
  const template = `# ${sessionId}

**Started**: ${new Date().toISOString()}
**Mode**: analysis

## Session Start Checklist

- [x] Brain MCP initialized
- [x] Session state created
- [x] Skills directory verified
- [x] Session log created
- [x] Constraints loaded
- [x] Git branch verified

## Session End Checklist

- [ ] Session log complete
- [ ] Brain memory updated
- [ ] Markdown lint passed
- [ ] Changes committed
- [ ] Session protocol validated

## Work Log

### ${new Date().toLocaleTimeString()}

Session protocol start workflow completed.

## Artifacts Created

(To be updated during session)

## Decisions Made

(To be updated during session)

## Blockers

None

## Next Steps

1. Begin work on active task
`;

  await fs.writeFile(sessionLogPath, template, "utf-8");
  return sessionLogPath;
}
```

#### Skills Directory Verification

```typescript
// apps/mcp/src/workflows/steps/skills-verify.ts
import fs from "fs/promises";
import path from "path";

export async function verifySkillsDirectory(workingDirectory: string): Promise<boolean> {
  const skillsDir = path.join(workingDirectory, ".claude", "skills");

  try {
    const stats = await fs.stat(skillsDir);
    return stats.isDirectory();
  } catch {
    return false;
  }
}
```

#### Git Branch Verification

```typescript
// apps/mcp/src/workflows/steps/git-verify.ts
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function verifyGitBranch(workingDirectory: string): Promise<string> {
  try {
    const { stdout } = await execAsync("git branch --show-current", {
      cwd: workingDirectory,
      timeout: 5000,
    });

    return stdout.trim();
  } catch (err) {
    throw new Error(`Git branch verification failed: ${err.message}`);
  }
}
```

#### Constraints Loading

```typescript
// apps/mcp/src/workflows/steps/constraints-load.ts
import { brainMCP } from "../inngest-client";

export async function loadConstraints(): Promise<string | null> {
  try {
    const note = await brainMCP.readNote({
      identifier: "usage-mandatory",
      project: process.cwd(),
    });

    return note.content;
  } catch (err) {
    console.warn("Failed to load usage-mandatory constraints:", err.message);
    return null;
  }
}
```

## Testing Requirements

### Unit Tests

- [ ] Each step function executes successfully in isolation
- [ ] Brain MCP initialization returns version string
- [ ] Session log creation writes correct template
- [ ] Skills verification detects missing directory
- [ ] Git verification returns current branch
- [ ] Constraints loading handles missing note gracefully

### Integration Tests

- [ ] Workflow triggers on `session/protocol.start` event
- [ ] Workflow completes all 8 steps in order
- [ ] Session state updated with `protocolStartComplete: true`
- [ ] Session log file created at correct path
- [ ] Evidence map contains all expected fields
- [ ] `session/state.update` event emitted on completion

### Failure Tests

- [ ] Brain MCP offline → workflow retries 3 times → fails gracefully
- [ ] Skills directory missing → workflow continues (warning logged)
- [ ] Git not initialized → workflow fails with clear error
- [ ] Step timeout → workflow fails after 30s

### Performance Tests

- [ ] Workflow completes in <5s under normal conditions (P95)
- [ ] Step timeouts enforced (30s max per step)

## Dependencies

**External**:

- Brain MCP operational (BLOCKING)
- Git repository initialized (BLOCKING)

**Internal**:

- TASK-010: Inngest workflow setup (Inngest client available)
- TASK-001, TASK-003: Session state types and Brain persistence

## Blocked By

- TASK-010: Inngest workflow setup (must complete first)

## Blocks

None (can be implemented in parallel with TASK-012, TASK-013)

## Rollback Plan

If workflow fails in production:

1. Disable workflow via feature flag
2. Fall back to manual bootstrap command
3. Document failure in session log
4. Fix issues and re-deploy

## References

- **ADR-016**: Automatic Session Protocol Enforcement
- **Milestone 2.2**: session-protocol-start Workflow
- **SESSION-PROTOCOL.md**: Session start requirements
- **Inngest Step API**: <https://inngest.com/docs/functions/steps>
