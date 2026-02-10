/**
 * Pre-tool-use hook handler.
 *
 * Ported from apps/claude-plugin/cmd/hooks/pre_tool_use.go.
 * Reads tool name from stdin, checks if it's allowed in the current mode.
 */
import type { PreToolUseInput, PreToolUseOutput } from "./types.js";
import { performGateCheck } from "./gate-check.js";

export async function runPreToolUse(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");

  let toolInput: PreToolUseInput;
  try {
    toolInput = JSON.parse(raw) as PreToolUseInput;
  } catch {
    process.stderr.write("failed to parse input\n");
    process.exit(1);
    return;
  }

  const result = performGateCheck(toolInput.tool);

  const output: PreToolUseOutput = {
    decision: result.allowed ? "allow" : "block",
    mode: result.mode,
  };
  if (!result.allowed && result.message) {
    output.message = result.message;
  }

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}

// Run if executed directly
const isMain = process.argv[1]?.endsWith("pre-tool-use.ts") ||
  process.argv[1]?.endsWith("pre-tool-use.js");
if (isMain) {
  runPreToolUse().catch((err) => {
    process.stderr.write(`Error: ${err}\n`);
    process.exit(1);
  });
}
