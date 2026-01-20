---
type: task
id: TASK-012
title: Implement session-protocol-end workflow
status: complete
priority: P0
complexity: M
estimate: 4h
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

# TASK-012: Implement session-protocol-end Workflow

## Design Context

- DESIGN-001: Session State Architecture (workflow integration)
- ADR-016 Milestone 2.3: session-protocol-end Workflow

## Objective

Implement Inngest workflow that automates session protocol end steps. Workflow triggers on `feature/completion.requested` event, executes 6 protocol steps, and updates session state with completion evidence.

## Scope

**In Scope**:

- Inngest workflow with 6 sequential steps
- Session log validation (run `Validate-SessionProtocol.ps1`)
- Brain memory updates with session learnings
- Markdown lint execution
- Git commit creation (if changes exist)
- Protocol completion evidence recording

**Out of Scope**:

- Hook integration (separate task)
- Session protocol start workflow (TASK-011)
- Agent routing workflows (TASK-013)

## Acceptance Criteria

- [ ] Workflow completes all 6 steps without errors
- [ ] Session log validated successfully via PowerShell script
- [ ] Brain memory updated with session summary
- [ ] Markdown lint runs and fixes issues
- [ ] Git commit created with conventional format (if changes exist)
- [ ] Session state marked `protocolEndComplete: true`
- [ ] Workflow emits `session/complete` event on success
- [ ] Workflow handles validation failure gracefully (does not commit)

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/src/workflows/session-protocol-end.ts` | Create | Workflow implementation |
| `apps/mcp/src/workflows/steps/validate-session-log.ts` | Create | Session log validation step |
| `apps/mcp/src/workflows/steps/update-brain-memory.ts` | Create | Brain memory update step |
| `apps/mcp/src/workflows/steps/markdown-lint.ts` | Create | Markdown lint step |
| `apps/mcp/src/workflows/steps/git-commit.ts` | Create | Git commit step |

## Implementation Notes

### Workflow Structure

```typescript
// apps/mcp/src/workflows/session-protocol-end.ts
import { inngest } from "./inngest-client";
import { validateSessionLog } from "./steps/validate-session-log";
import { updateBrainMemory } from "./steps/update-brain-memory";
import { runMarkdownLint } from "./steps/markdown-lint";
import { createGitCommit } from "./steps/git-commit";

export const sessionProtocolEnd = inngest.createFunction(
  {
    id: "session-protocol-end",
    name: "Session Protocol End",
    retries: 3,
  },
  { event: "feature/completion.requested" },
  async ({ event, step }) => {
    const { sessionId } = event.data;

    // Step 1: Validate session log completeness
    const validationResult = await step.run("validate-session-log", async () => {
      return await validateSessionLog(sessionId);
    });

    if (!validationResult.passed) {
      throw new Error(
        `Session log validation failed:\n${validationResult.errors.join("\n")}`
      );
    }

    // Step 2: Update Brain memory with session learnings
    await step.run("update-brain-memory", async () => {
      return await updateBrainMemory(sessionId);
    });

    // Step 3: Run markdown lint
    const lintResult = await step.run("run-markdown-lint", async () => {
      return await runMarkdownLint();
    });

    // Step 4: Git commit (if changes exist)
    const commitSha = await step.run("create-git-commit", async () => {
      return await createGitCommit(sessionId);
    });

    // Step 5: Update session state with end evidence
    await step.run("update-session-state", async () => {
      const evidence = {
        validationPassed: "yes",
        validationOutput: validationResult.output,
        brainMemoryUpdated: "yes",
        markdownLintPassed: lintResult.passed ? "yes" : "no",
        markdownLintErrors: lintResult.errors?.join(", ") || "none",
        gitCommitSha: commitSha || "no-changes",
        endTimestamp: new Date().toISOString(),
      };

      await updateSessionWithLocking(sessionId, {
        protocolEndComplete: true,
        protocolEndEvidence: evidence,
      });
    });

    // Step 6: Emit session complete event
    await step.sendEvent("emit-session-complete", {
      name: "session/complete",
      data: {
        sessionId,
        timestamp: new Date().toISOString(),
      },
    });

    return { success: true, sessionId, commitSha };
  }
);
```

### Step Implementations

#### Session Log Validation

```typescript
// apps/mcp/src/workflows/steps/validate-session-log.ts
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

interface ValidationResult {
  passed: boolean;
  errors: string[];
  output: string;
}

export async function validateSessionLog(sessionId: string): Promise<ValidationResult> {
  const sessionLogPath = path.join(
    process.cwd(),
    ".agents",
    "sessions",
    `${sessionId}.md`
  );

  try {
    const { stdout, stderr } = await execAsync(
      `pwsh scripts/Validate-SessionProtocol.ps1 -SessionLogPath "${sessionLogPath}"`,
      { timeout: 30000 }
    );

    // Parse validation output
    const passed = stdout.includes("[PASS]") || !stderr.includes("[FAIL]");
    const errors = stderr
      .split("\n")
      .filter((line) => line.includes("[FAIL]"))
      .map((line) => line.replace(/\[FAIL\]\s*/, ""));

    return {
      passed,
      errors,
      output: stdout + stderr,
    };
  } catch (err) {
    // Validation script failed
    return {
      passed: false,
      errors: [`Validation script failed: ${err.message}`],
      output: err.stdout || err.stderr || "",
    };
  }
}
```

#### Brain Memory Update

```typescript
// apps/mcp/src/workflows/steps/update-brain-memory.ts
import fs from "fs/promises";
import path from "path";
import { brainMCP } from "../inngest-client";

export async function updateBrainMemory(sessionId: string): Promise<void> {
  // Read session log
  const sessionLogPath = path.join(
    process.cwd(),
    ".agents",
    "sessions",
    `${sessionId}.md`
  );
  const sessionLog = await fs.readFile(sessionLogPath, "utf-8");

  // Extract summary from session log
  const summary = extractSessionSummary(sessionLog);

  // Update Brain memory
  await brainMCP.writeNote({
    title: `sessions/${sessionId}-summary`,
    content: summary,
    category: "session-summaries",
    project: process.cwd(),
  });
}

function extractSessionSummary(sessionLog: string): string {
  // Extract key sections from session log
  const sections = [
    "Work Log",
    "Artifacts Created",
    "Decisions Made",
    "Blockers",
    "Next Steps",
  ];

  let summary = `# Session Summary\n\n`;

  for (const section of sections) {
    const regex = new RegExp(`## ${section}([\\s\\S]*?)(?=##|$)`, "i");
    const match = sessionLog.match(regex);

    if (match) {
      summary += `## ${section}\n${match[1].trim()}\n\n`;
    }
  }

  return summary;
}
```

#### Markdown Lint

```typescript
// apps/mcp/src/workflows/steps/markdown-lint.ts
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface LintResult {
  passed: boolean;
  errors?: string[];
}

export async function runMarkdownLint(): Promise<LintResult> {
  try {
    const { stdout, stderr } = await execAsync(
      `npx markdownlint-cli2 --fix "**/*.md"`,
      { timeout: 60000 }
    );

    return {
      passed: true,
      errors: stderr ? [stderr] : undefined,
    };
  } catch (err) {
    // Lint found errors
    return {
      passed: false,
      errors: [err.message],
    };
  }
}
```

#### Git Commit

```typescript
// apps/mcp/src/workflows/steps/git-commit.ts
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function createGitCommit(sessionId: string): Promise<string | null> {
  try {
    // Check if there are changes
    const { stdout: status } = await execAsync("git status --porcelain", {
      timeout: 5000,
    });

    if (!status.trim()) {
      return null; // No changes to commit
    }

    // Stage all changes
    await execAsync("git add .", { timeout: 10000 });

    // Create commit with conventional format
    const commitMessage = `chore: complete session ${sessionId}

Session protocol end workflow completed successfully.

Generated with Brain MCP session protocol automation.`;

    await execAsync(`git commit -m "${commitMessage}"`, { timeout: 10000 });

    // Get commit SHA
    const { stdout: sha } = await execAsync("git rev-parse HEAD", {
      timeout: 5000,
    });

    return sha.trim();
  } catch (err) {
    throw new Error(`Git commit failed: ${err.message}`);
  }
}
```

## Testing Requirements

### Unit Tests

- [ ] Session log validation detects incomplete logs
- [ ] Session log validation passes for complete logs
- [ ] Brain memory update extracts correct summary
- [ ] Markdown lint runs successfully
- [ ] Git commit skips when no changes exist
- [ ] Git commit creates commit when changes exist

### Integration Tests

- [ ] Workflow triggers on `feature/completion.requested` event
- [ ] Workflow completes all 6 steps in order
- [ ] Session state marked `protocolEndComplete: true`
- [ ] Brain memory contains session summary
- [ ] Git commit created with correct message format
- [ ] `session/complete` event emitted on success

### Failure Tests

- [ ] Invalid session log → workflow fails without committing
- [ ] Markdown lint errors → workflow continues (logs warning)
- [ ] Git commit failure → workflow fails with clear error
- [ ] Brain MCP offline → workflow retries 3 times → fails gracefully

### Performance Tests

- [ ] Workflow completes in <10s under normal conditions (P95)
- [ ] Validation script completes in <5s
- [ ] Git commit completes in <3s

## Dependencies

**External**:

- Brain MCP operational (BLOCKING)
- Git repository initialized (BLOCKING)
- PowerShell 7.4+ for validation script (BLOCKING)

**Internal**:

- TASK-010: Inngest workflow setup (Inngest client available)
- TASK-001, TASK-003: Session state types and Brain persistence
- `scripts/Validate-SessionProtocol.ps1` exists

## Blocked By

- TASK-010: Inngest workflow setup (must complete first)

## Blocks

None (can be implemented in parallel with TASK-011, TASK-013)

## Rollback Plan

If workflow fails in production:

1. Disable workflow via feature flag
2. Fall back to manual session end commands
3. Document failure in session log
4. Fix issues and re-deploy

## References

- **ADR-016**: Automatic Session Protocol Enforcement
- **Milestone 2.3**: session-protocol-end Workflow
- **SESSION-PROTOCOL.md**: Session end requirements
- **Inngest Step API**: <https://inngest.com/docs/functions/steps>
