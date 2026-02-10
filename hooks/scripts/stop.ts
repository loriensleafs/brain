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
import type { StopOutput, WorkflowState } from "./types.ts";
import type { NormalizedHookEvent } from "./normalize.ts";
import { normalizeEvent, getBlockingSemantics } from "./normalize.ts";
import { validateStopReadiness } from "./validate.ts";
import { execCommand } from "./exec.ts";

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
  const blocking = getBlockingSemantics(event.event, event.platform);

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

  // Only block if the platform supports it and validation failed
  const shouldBlock = !result.valid && blocking.canBlock;

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

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");

  // Exit code 2 = block (Claude Code only; Cursor stop is info-only)
  if (shouldBlock) {
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
