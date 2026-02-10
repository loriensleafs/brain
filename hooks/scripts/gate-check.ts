/**
 * Gate check (pre-tool-use) for brain-hooks.
 *
 * Ported from apps/claude-plugin/cmd/hooks/gate_check.go.
 * Implements FAIL-CLOSED behavior per ADR-016 Resolution 4.
 */
import { execCommand } from "./exec.ts";
import type { BrainSessionState, GateCheckResult } from "./types.ts";

/** Read-only tools that are safe when session state is unavailable. */
const READ_ONLY_TOOLS: Record<string, boolean> = {
  Read: true,
  Glob: true,
  Grep: true,
  LSP: true,
  WebFetch: true,
  WebSearch: true,
};

/** Tools blocked in each mode. */
const MODE_BLOCKED_TOOLS: Record<string, string[]> = {
  analysis: ["Edit", "Write", "Bash", "NotebookEdit"],
  planning: ["Edit", "Write", "NotebookEdit"],
  coding: [],
  disabled: [],
};

export function isReadOnlyTool(tool: string): boolean {
  return READ_ONLY_TOOLS[tool] === true;
}

/**
 * Get Brain session state from the CLI.
 * Returns null on error (CLI unavailable, invalid output, etc.).
 */
export function getBrainSessionState(): BrainSessionState | null {
  try {
    const output = execCommand("brain", ["session", "get-state"]);
    return JSON.parse(output) as BrainSessionState;
  } catch {
    return null;
  }
}

/**
 * Check if a tool is blocked for the current mode.
 */
export function checkToolBlocked(
  tool: string,
  mode: string,
): GateCheckResult {
  const result: GateCheckResult = {
    allowed: true,
    mode,
    tool,
  };

  // If mode is disabled or empty, allow everything
  if (mode === "disabled" || mode === "") {
    return result;
  }

  // Get blocked tools for this mode
  const blockedTools = MODE_BLOCKED_TOOLS[mode];
  if (!blockedTools) {
    // Unknown mode -- allow by default
    return result;
  }

  // Check if tool is in blocked list
  if (blockedTools.includes(tool)) {
    result.allowed = false;
    result.message = formatBlockMessage(tool, mode);
  }

  return result;
}

/**
 * Create a user-friendly block message.
 */
export function formatBlockMessage(tool: string, mode: string): string {
  const modeDescriptions: Record<string, string> = {
    analysis:
      "Analysis mode is for research and investigation. Code modifications are not allowed.",
    planning:
      "Planning mode is for design and planning. Direct file edits are not allowed.",
  };

  const description =
    modeDescriptions[mode] ??
    `Current mode (${mode}) does not allow this tool.`;

  return (
    `[BLOCKED] Tool '${tool}' is not allowed in ${mode} mode.\n\n` +
    `${description}\n\n` +
    'To proceed with code changes, transition to coding mode first using: set_mode(mode="coding")'
  );
}

/**
 * Perform a gate check: read session state and check if tool is allowed.
 *
 * Implements FAIL-CLOSED behavior:
 * - If state unavailable and tool is read-only: ALLOW
 * - If state unavailable and tool is destructive: BLOCK
 * - If mode is "disabled": ALLOW (explicit bypass)
 * - Otherwise: Check mode-based blocking
 */
export function performGateCheck(tool: string): GateCheckResult {
  const state = getBrainSessionState();

  // FAIL CLOSED: If state unavailable, block destructive tools
  if (!state) {
    if (isReadOnlyTool(tool)) {
      return {
        allowed: true,
        mode: "unknown",
        tool,
        message:
          "Session state unavailable. Read-only tool allowed.",
      };
    }
    return {
      allowed: false,
      mode: "unknown",
      tool,
      message: `[BLOCKED] Session state unavailable. Cannot verify mode for destructive tool '${tool}'. Start a session or use read-only tools only.`,
    };
  }

  // EXPLICIT DISABLED: Only disabled mode bypasses all gates
  if (state.currentMode === "disabled") {
    return {
      allowed: true,
      mode: "disabled",
      tool,
    };
  }

  // Normal mode-based checking
  return checkToolBlocked(tool, state.currentMode);
}

// Export constants for testing
export { READ_ONLY_TOOLS, MODE_BLOCKED_TOOLS };
