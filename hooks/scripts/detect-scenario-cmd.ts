/**
 * Detect-scenario command handler.
 *
 * Ported from apps/claude-plugin/cmd/hooks/detect_scenario.go.
 * Reads a prompt from stdin and returns scenario detection results.
 */
import type { DetectScenarioInput, DetectScenarioOutput } from "./types.ts";
import { detectScenario } from "./detect-scenario.ts";

export async function runDetectScenario(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();

  let detectInput: DetectScenarioInput;
  try {
    detectInput = JSON.parse(raw) as DetectScenarioInput;
  } catch {
    // If not JSON, treat entire input as the prompt
    detectInput = { prompt: raw };
  }

  const result = detectScenario(detectInput.prompt);

  const output: DetectScenarioOutput = {
    detected: result.detected,
    scenario: result.scenario || undefined,
    triggers: result.keywords.length > 0 ? result.keywords : undefined,
    recommended: result.recommended || undefined,
    directory: result.directory || undefined,
    noteType: result.noteType || undefined,
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}

// Run if executed directly
const isMain = process.argv[1]?.endsWith("detect-scenario-cmd.ts") ||
  process.argv[1]?.endsWith("detect-scenario-cmd.js");
if (isMain) {
  runDetectScenario().catch((err) => {
    process.stderr.write(`Error: ${err}\n`);
    process.exit(1);
  });
}
