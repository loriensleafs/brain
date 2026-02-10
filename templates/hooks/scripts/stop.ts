/**
 * Stop hook handler.
 *
 * Ported from apps/claude-plugin/cmd/hooks/stop.go.
 * Validates session before ending, outputs {"continue": true/false}.
 *
 * Cross-platform: works with both Claude Code (Stop, blocking) and
 * Cursor (stop, info-only) via normalization. On Cursor, validation
 * runs but exit code is always 0 (cannot block).
 */
import type { StopOutput, WorkflowState } from "./types";
import type { NormalizedHookEvent } from "./normalize";
import { normalizeEvent, formatOutput } from "./normalize";
import { validateStopReadiness } from "./validate";
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

/**
 * Process a normalized stop event. Platform-agnostic core logic.
 * Returns the output and whether the process should block (exit non-zero).
 */
export function processStop(event: NormalizedHookEvent): { output: StopOutput; shouldBlock: boolean } {
  const workflowState = loadWorkflowState();

  if (!workflowState) {
    return {
      output: {
        continue: true,
        message: "No active workflow - session can end",
      },
      shouldBlock: false,
    };
  }

  const result = validateStopReadiness(workflowState);

  const output: StopOutput = {
    continue: result.valid,
    message: result.message,
    checks: result.checks,
    remediation: result.remediation || undefined,
  };

  // Only block on Claude Code (exit code 2); Cursor stop uses followup_message
  const shouldBlock = !result.valid && event.platform === "claude-code";

  return { output, shouldBlock };
}

export async function runStop(): Promise<void> {
  // Read stdin if available (Cursor sends stop event JSON)
  let parsed: Record<string, unknown> = {};
  try {
    const data = await Bun.file("/dev/stdin").text();
    if (data.trim()) {
      parsed = JSON.parse(data.trim()) as Record<string, unknown>;
    }
  } catch {
    // No stdin or parse error -- treat as CC stop with no payload
  }

  // Normalize the event (auto-detects Claude Code vs Cursor)
  const event = normalizeEvent(parsed, "Stop");
  const { output, shouldBlock } = processStop(event);

  if (event.platform === "cursor") {
    // Cursor stop: {followup_message} (optional, triggers retry loop)
    const out = formatOutput(event, {
      followupMessage: !output.continue ? output.remediation : undefined,
    });
    process.stdout.write(out + "\n");
  } else {
    // Claude Code: pass through internal format
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    // Exit code 2 = block (Claude Code only)
    if (shouldBlock) {
      process.exit(2);
    }
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
