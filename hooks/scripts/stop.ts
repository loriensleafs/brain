/**
 * Stop hook handler.
 *
 * Ported from apps/claude-plugin/cmd/hooks/stop.go.
 * Validates session before ending, outputs {"continue": true/false}.
 */
import type { StopOutput, WorkflowState } from "./types.js";
import { validateStopReadiness } from "./validate.js";
import { execCommand } from "./exec.js";

/** Load workflow state from brain session command. */
function loadWorkflowState(): WorkflowState | null {
  try {
    const output = execCommand("brain", ["session", "get-state"]);
    const parsed = JSON.parse(output);
    return {
      mode: parsed.mode ?? parsed.currentMode ?? "",
      task: parsed.task ?? "",
      sessionId: parsed.sessionId ?? "",
      updatedAt: parsed.updatedAt ?? "",
    } satisfies WorkflowState;
  } catch {
    return null;
  }
}

export async function runStop(): Promise<void> {
  const workflowState = loadWorkflowState();

  if (!workflowState) {
    const output: StopOutput = {
      continue: true,
      message: "No active workflow - session can end",
    };
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    return;
  }

  const result = validateStopReadiness(workflowState);

  const output: StopOutput = {
    continue: result.valid,
    message: result.message,
    checks: result.checks,
    remediation: result.remediation || undefined,
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");

  // Exit code 2 = block if validation failed
  if (!result.valid) {
    process.exit(2);
  }
}

// Run if executed directly
const isMain = process.argv[1]?.endsWith("stop.ts") ||
  process.argv[1]?.endsWith("stop.js");
if (isMain) {
  runStop().catch((err) => {
    process.stderr.write(`Error: ${err}\n`);
    process.exit(1);
  });
}
