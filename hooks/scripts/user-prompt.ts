/**
 * User-prompt hook handler.
 *
 * Ported from apps/claude-plugin/cmd/hooks/user_prompt.go.
 * Reads prompt from stdin, detects scenarios, injects workflow state.
 */
import type {
  UserPromptInput,
  UserPromptOutput,
  ScenarioDetectionResult,
  WorkflowStateInfo,
} from "./types.js";
import { detectScenario } from "./detect-scenario.js";
import { execCommand } from "./exec.js";

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

export async function runUserPrompt(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();

  let promptInput: UserPromptInput;
  try {
    promptInput = JSON.parse(raw) as UserPromptInput;
  } catch {
    // If not JSON, treat entire input as the prompt
    promptInput = { prompt: raw };
  }

  const output: UserPromptOutput = { continue: true };

  // Detect scenario from prompt
  const result = detectScenario(promptInput.prompt);
  if (result.detected) {
    output.scenario = {
      detected: result.detected,
      scenario: result.scenario,
      triggers: result.keywords,
      recommended: result.recommended,
    } satisfies ScenarioDetectionResult;
  }

  // Check for planning keywords and inject workflow state
  if (containsAny(promptInput.prompt, planningKeywords)) {
    const workflowState = loadWorkflowState();
    if (workflowState) {
      output.workflowState = workflowState;
    }
  }

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
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
