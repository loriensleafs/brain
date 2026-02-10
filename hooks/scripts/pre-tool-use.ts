/**
 * Pre-tool-use hook handler.
 *
 * Ported from apps/claude-plugin/cmd/hooks/pre_tool_use.go.
 * Reads tool name from stdin, checks if it's allowed in the current mode.
 *
 * Cross-platform: works with both Claude Code (PreToolUse) and
 * Cursor (beforeShellExecution, beforeMCPExecution) via normalization.
 */
import type { PreToolUseOutput } from "./types.ts";
import type { NormalizedHookEvent } from "./normalize.ts";
import { normalizeEvent } from "./normalize.ts";
import { performGateCheck } from "./gate-check.ts";

/**
 * Extract tool name from a normalized event.
 * Claude Code sends tool_name directly.
 * Cursor sends tool_name for MCP, and "Bash" equivalent for shell.
 */
function extractToolName(event: NormalizedHookEvent): string {
  // For before-shell, the tool is always Bash
  if (event.event === "before-shell") return "Bash";

  // For before-mcp, extract from payload
  const toolName = event.payload.tool_name as string;
  if (toolName) return toolName;

  // Fallback to tool field in payload (Claude Code PreToolUse)
  return (event.payload.tool as string) ?? "";
}

/**
 * Process a normalized pre-tool-use event. Platform-agnostic core logic.
 */
export function processPreToolUse(event: NormalizedHookEvent): PreToolUseOutput {
  const tool = extractToolName(event);
  const result = performGateCheck(tool);

  const output: PreToolUseOutput = {
    decision: result.allowed ? "allow" : "block",
    mode: result.mode,
  };
  if (!result.allowed && result.message) {
    output.message = result.message;
  }

  return output;
}

export async function runPreToolUse(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    process.stderr.write("failed to parse input\n");
    process.exit(1);
  }

  // Normalize the event (auto-detects Claude Code vs Cursor)
  const event = normalizeEvent(parsed, "PreToolUse");
  const output = processPreToolUse(event);

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
