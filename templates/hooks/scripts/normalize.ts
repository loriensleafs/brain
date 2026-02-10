/**
 * Hook normalization layer.
 *
 * Detects platform from stdin JSON shape and normalizes to a common
 * NormalizedHookEvent interface. Each hook script imports this normalizer,
 * then runs platform-agnostic logic.
 *
 * Platform detection: Cursor events have `hook_event_name` field;
 * Claude Code events do not.
 *
 * @see DESIGN-002-hook-normalization-layer
 * @see TASK-018-build-hook-normalization-shim
 */

// ============================================================================
// Types
// ============================================================================

/** Supported platforms. */
export type Platform = "claude-code" | "cursor";

/** Normalized event names shared across platforms. */
export type NormalizedEventName =
  | "prompt-submit"
  | "before-shell"
  | "before-mcp"
  | "before-read-file"
  | "after-edit"
  | "stop"
  | "session-start"
  | "notification"
  | "subagent-stop";

/** Common interface for all hook events, regardless of source platform. */
export interface NormalizedHookEvent {
  platform: Platform;
  event: NormalizedEventName;
  sessionId: string;
  workspaceRoot: string;
  payload: Record<string, unknown>;
}

/** Platform-specific blocking capability per event. */
export interface BlockingSemantics {
  canBlock: boolean;
  infoOnly: boolean;
}

// ============================================================================
// Event Mapping
// ============================================================================

/**
 * Map Cursor hook_event_name values to normalized event names.
 * Cursor sends: beforeSubmitPrompt, beforeShellExecution,
 * beforeMCPExecution, beforeReadFile, afterFileEdit, stop
 */
const cursorEventMap: Record<string, NormalizedEventName> = {
  beforeSubmitPrompt: "prompt-submit",
  beforeShellExecution: "before-shell",
  beforeMCPExecution: "before-mcp",
  beforeReadFile: "before-read-file",
  afterFileEdit: "after-edit",
  stop: "stop",
};

/**
 * Map Claude Code hook event names to normalized event names.
 * Claude Code doesn't send event names in the payload -- the event
 * type is determined by which hook config triggers. We infer from
 * the hookSpecificOutput.hookEventName or the structural shape.
 */
const claudeCodeEventMap: Record<string, NormalizedEventName> = {
  UserPromptSubmit: "prompt-submit",
  PreToolUse: "before-shell", // refined by tool_name below
  PostToolUse: "after-edit",  // refined by tool_name below
  Stop: "stop",
  SessionStart: "session-start",
  Notification: "notification",
  SubagentStop: "subagent-stop",
};

/**
 * Blocking semantics per event per platform.
 * Claude Code Stop can block; Cursor stop is info-only.
 */
const blockingSemantics: Record<string, Record<Platform, BlockingSemantics>> = {
  "prompt-submit": {
    "claude-code": { canBlock: true, infoOnly: false },
    cursor: { canBlock: false, infoOnly: true },
  },
  "before-shell": {
    "claude-code": { canBlock: true, infoOnly: false },
    cursor: { canBlock: true, infoOnly: false },
  },
  "before-mcp": {
    "claude-code": { canBlock: true, infoOnly: false },
    cursor: { canBlock: true, infoOnly: false },
  },
  "before-read-file": {
    "claude-code": { canBlock: false, infoOnly: true }, // no CC equivalent
    cursor: { canBlock: true, infoOnly: false },
  },
  "after-edit": {
    "claude-code": { canBlock: false, infoOnly: true },
    cursor: { canBlock: false, infoOnly: true },
  },
  stop: {
    "claude-code": { canBlock: true, infoOnly: false },
    cursor: { canBlock: false, infoOnly: true },
  },
  "session-start": {
    "claude-code": { canBlock: false, infoOnly: true },
    cursor: { canBlock: false, infoOnly: true }, // no Cursor equivalent
  },
  notification: {
    "claude-code": { canBlock: false, infoOnly: true },
    cursor: { canBlock: false, infoOnly: true },
  },
  "subagent-stop": {
    "claude-code": { canBlock: false, infoOnly: true },
    cursor: { canBlock: false, infoOnly: true },
  },
};

// ============================================================================
// Platform Detection
// ============================================================================

/**
 * Detect platform from the raw JSON event shape.
 *
 * Cursor events always include `hook_event_name`.
 * Claude Code events never do.
 */
export function detectPlatform(raw: Record<string, unknown>): Platform {
  if (typeof raw.hook_event_name === "string") {
    return "cursor";
  }
  return "claude-code";
}

// ============================================================================
// Normalization
// ============================================================================

/**
 * Resolve the normalized event name for a Cursor event.
 */
function normalizeCursorEvent(raw: Record<string, unknown>): NormalizedEventName {
  const hookEventName = raw.hook_event_name as string;
  return cursorEventMap[hookEventName] ?? "prompt-submit";
}

/**
 * Resolve the normalized event name for a Claude Code event.
 *
 * Claude Code doesn't embed the event type in the payload.
 * We use an optional `_hookEvent` hint (set by the caller or hook config)
 * or fall back to structural detection from known fields.
 */
function normalizeClaudeCodeEvent(
  raw: Record<string, unknown>,
  hookEventHint?: string,
): NormalizedEventName {
  // Use explicit hint if provided
  if (hookEventHint && claudeCodeEventMap[hookEventHint]) {
    const base = claudeCodeEventMap[hookEventHint];

    // Refine PreToolUse based on tool_name
    if (hookEventHint === "PreToolUse") {
      const toolName = (raw.tool_name as string) ?? "";
      if (toolName === "Bash") return "before-shell";
      return "before-mcp";
    }

    // Refine PostToolUse based on tool_name
    if (hookEventHint === "PostToolUse") {
      return "after-edit";
    }

    return base;
  }

  // Structural detection fallback
  if (typeof raw.prompt === "string") return "prompt-submit";
  if (typeof raw.tool_name === "string") {
    const toolName = raw.tool_name as string;
    if (toolName === "Bash") return "before-shell";
    return "before-mcp";
  }
  if (typeof raw.session_id === "string" && Object.keys(raw).length <= 2) {
    return "session-start";
  }

  return "prompt-submit";
}

/**
 * Extract session ID from the raw event.
 * Claude Code uses `session_id`; Cursor uses `conversation_id`.
 */
function extractSessionId(raw: Record<string, unknown>, platform: Platform): string {
  if (platform === "cursor") {
    return (raw.conversation_id as string) ?? (raw.session_id as string) ?? "";
  }
  return (raw.session_id as string) ?? (raw.sessionId as string) ?? "";
}

/**
 * Extract workspace root from the raw event.
 * Claude Code uses `cwd`; Cursor uses `cwd` or `workspace_root`.
 */
function extractWorkspaceRoot(raw: Record<string, unknown>): string {
  return (raw.cwd as string)
    ?? (raw.workspace_root as string)
    ?? "";
}

/**
 * Build the normalized payload from platform-specific fields.
 * Strips platform metadata fields and keeps domain data.
 */
function buildPayload(
  raw: Record<string, unknown>,
  platform: Platform,
  event: NormalizedEventName,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (platform === "cursor") {
    switch (event) {
      case "before-shell":
        payload.command = raw.command ?? "";
        break;
      case "before-mcp":
        payload.tool_name = raw.tool_name ?? "";
        payload.tool_input = raw.tool_input ?? {};
        if (raw.server) payload.server = raw.server;
        break;
      case "after-edit":
        payload.edits = raw.edits ?? [];
        break;
      case "prompt-submit":
        payload.prompt = raw.prompt ?? "";
        if (raw.attachments) payload.attachments = raw.attachments;
        break;
      case "before-read-file":
        payload.file_path = raw.file_path ?? "";
        break;
      case "stop":
        payload.status = raw.status ?? "completed";
        break;
      default:
        Object.assign(payload, raw);
    }
  } else {
    // Claude Code
    switch (event) {
      case "before-shell":
        payload.command = (raw.tool_input as Record<string, unknown>)?.command ?? "";
        payload.tool_name = raw.tool_name ?? "Bash";
        payload.tool_input = raw.tool_input ?? {};
        break;
      case "before-mcp":
        payload.tool_name = raw.tool_name ?? "";
        payload.tool_input = raw.tool_input ?? {};
        break;
      case "after-edit":
        payload.tool_name = raw.tool_name ?? "";
        payload.tool_output = raw.tool_output ?? {};
        break;
      case "prompt-submit":
        payload.prompt = raw.prompt ?? "";
        break;
      case "stop":
        // Claude Code stop has no specific payload fields
        break;
      case "session-start":
        // Session start payload is the entire hook input
        if (raw.cwd) payload.cwd = raw.cwd;
        break;
      default:
        Object.assign(payload, raw);
    }
  }

  return payload;
}

/**
 * Normalize a raw hook event JSON object to the common NormalizedHookEvent.
 *
 * @param raw - The parsed JSON from stdin
 * @param hookEventHint - Optional Claude Code event type hint
 *   (e.g. "PreToolUse", "Stop"). Not needed for Cursor events.
 */
export function normalizeEvent(
  raw: Record<string, unknown>,
  hookEventHint?: string,
): NormalizedHookEvent {
  const platform = detectPlatform(raw);
  const event = platform === "cursor"
    ? normalizeCursorEvent(raw)
    : normalizeClaudeCodeEvent(raw, hookEventHint);

  return {
    platform,
    event,
    sessionId: extractSessionId(raw, platform),
    workspaceRoot: extractWorkspaceRoot(raw),
    payload: buildPayload(raw, platform, event),
  };
}

/**
 * Get blocking semantics for a normalized event on a given platform.
 */
export function getBlockingSemantics(
  event: NormalizedEventName,
  platform: Platform,
): BlockingSemantics {
  return blockingSemantics[event]?.[platform]
    ?? { canBlock: false, infoOnly: true };
}

// ============================================================================
// Stdin Helper
// ============================================================================

/**
 * Read stdin, parse JSON, and normalize the event.
 * Convenience function for hook scripts.
 *
 * @param hookEventHint - Optional Claude Code event type hint
 */
export async function readAndNormalize(
  hookEventHint?: string,
): Promise<NormalizedHookEvent> {
  const data = await Bun.file("/dev/stdin").text();
  const raw = JSON.parse(data.trim()) as Record<string, unknown>;
  return normalizeEvent(raw, hookEventHint);
}
