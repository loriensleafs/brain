/**
 * Validate-session command handler.
 *
 * Ported from apps/claude-plugin/cmd/hooks/validate_session.go.
 * Validates session state for completeness before ending.
 */
import type {
  ValidateSessionInput,
  ValidateSessionOutput,
  WorkflowState,
} from "./types";
import { validateSession } from "./validate";
import { execCommand } from "./exec";

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

export async function runValidateSession(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();

  let _validateInput: ValidateSessionInput = {};
  if (raw) {
    try {
      _validateInput = JSON.parse(raw) as ValidateSessionInput;
    } catch {
      // Ignore parse errors
    }
  }

  const workflowState = loadWorkflowState();
  const result = validateSession(workflowState);

  const output: ValidateSessionOutput = {
    valid: result.valid,
    checks: result.checks,
    message: result.message,
    remediation: result.remediation || undefined,
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");

  if (!result.valid) {
    process.exit(1);
  }
}

// Run if executed directly
const isMain = process.argv[1]?.endsWith("validate-session.ts") ||
  process.argv[1]?.endsWith("validate-session.js");
if (isMain) {
  runValidateSession().catch((err) => {
    process.stderr.write(`Error: ${err}\n`);
    process.exit(1);
  });
}
