/**
 * User-prompt hook handler.
 *
 * Ported from apps/claude-plugin/cmd/hooks/user_prompt.go.
 * Reads prompt from stdin, detects scenarios, injects workflow state.
 *
 * Cross-platform: works with both Claude Code (UserPromptSubmit) and
 * Cursor (beforeSubmitPrompt) via the normalization layer.
 */
import type {
  UserPromptOutput,
  ScenarioDetectionResult,
  WorkflowStateInfo,
} from "./types";
import type { NormalizedHookEvent } from "./normalize";
import { normalizeEvent, formatOutput } from "./normalize";
import { detectScenario } from "./detect-scenario";
import { execCommand } from "./exec";

/** Keywords that trigger workflow state injection. */
const planningKeywords = [
  "plan", "implement", "build", "feature",
  "create", "develop", "design", "architect",
  "phase", "task", "milestone", "epic",
  "spec", "specification", "requirement",
];

/** Check if text contains any of the given patterns (case-insensitive). */
function containsAny(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some((p) => lower.includes(p.toLowerCase()));
}

/** Load workflow state from brain session command. */
function loadWorkflowState(): WorkflowStateInfo | null {
  try {
    const output = execCommand("brain", ["session", "get-state"]);
    return JSON.parse(output) as WorkflowStateInfo;
  } catch {
    return null;
  }
}

/**
 * Process a normalized prompt event. Platform-agnostic core logic.
 * Extracts prompt text from the normalized payload and runs scenario
 * detection and workflow state injection.
 */
export function processUserPrompt(event: NormalizedHookEvent): UserPromptOutput {
  const prompt = ("prompt" in event.payload ? event.payload.prompt : "") as string;
  const output: UserPromptOutput = { continue: true };

  // Detect scenario from prompt
  const result = detectScenario(prompt);
  if (result.detected) {
    output.scenario = {
      detected: result.detected,
      scenario: result.scenario,
      triggers: result.keywords,
      recommended: result.recommended,
    } satisfies ScenarioDetectionResult;
  }

  // Check for planning keywords and inject workflow state
  if (containsAny(prompt, planningKeywords)) {
    const workflowState = loadWorkflowState();
    if (workflowState) {
      output.workflowState = workflowState;
    }
  }

  return output;
}

export async function runUserPrompt(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // If not JSON, treat entire input as the prompt
    parsed = { prompt: raw };
  }

  // Normalize the event (auto-detects Claude Code vs Cursor)
  const event = normalizeEvent(parsed, "UserPromptSubmit");
  const result = processUserPrompt(event);

  if (event.platform === "cursor") {
    // Cursor beforeSubmitPrompt: {continue, user_message}
    const out = formatOutput(event, {
      continue: result.continue,
      userMessage: result.scenario?.detected
        ? `[${result.scenario.scenario}] ${result.scenario.recommended}`
        : undefined,
    });
    process.stdout.write(out + "\n");
  } else {
    // Claude Code: pass through internal format
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  }
}

// Run if executed directly
const isMain = process.argv[1]?.endsWith("user-prompt.ts") ||
  process.argv[1]?.endsWith("user-prompt.js");
if (isMain) {
  runUserPrompt().catch((err) => {
    process.stderr.write(`Error: ${err}\n`);
    process.exit(1);
  });
}
