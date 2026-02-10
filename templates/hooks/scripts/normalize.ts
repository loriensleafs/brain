/**
 * Hook normalization layer.
 *
 * Detects platform from stdin JSON shape and normalizes to a common
 * NormalizedHookEvent interface. Each hook script imports this normalizer,
 * then runs platform-agnostic logic and uses formatOutput() to produce
 * the correct platform-specific response.
 *
 * Platform detection: Cursor events include `hook_event_name` field;
 * Claude Code events do not.
 *
 * Supported events (aligned with cursor.json and claude-code.json):
 *
 *   | Normalized       | Claude Code      | Cursor             |
 *   |------------------|------------------|--------------------|
 *   | session-start    | SessionStart     | sessionStart       |
 *   | prompt-submit    | UserPromptSubmit | beforeSubmitPrompt |
 *   | pre-tool-use     | PreToolUse       | preToolUse         |
 *   | stop             | Stop             | stop               |
 */

// ============================================================================
// Types
// ============================================================================

export type Platform = "claude-code" | "cursor";

export type NormalizedEventName =
  | "session-start"
  | "prompt-submit"
  | "pre-tool-use"
  | "stop";

/** Common interface for all hook events, regardless of source platform. */
export interface NormalizedHookEvent {
  platform: Platform;
  event: NormalizedEventName;
  sessionId: string;
  workspaceRoot: string;
  /** Raw input from the platform, passed through for scripts that need it. */
  raw: Record<string, unknown>;
  /** Normalized payload with event-specific fields. */
  payload: SessionStartPayload | PromptSubmitPayload | PreToolUsePayload | StopPayload;
}

export interface SessionStartPayload {
  sessionId: string;
  isBackgroundAgent?: boolean;
  composerMode?: string;
}

export interface PromptSubmitPayload {
  prompt: string;
  attachments?: Array<{ type: string; filePath: string }>;
}

export interface PreToolUsePayload {
  toolName: string;
  toolInput: Record<string, unknown>;
}

export interface StopPayload {
  status: string;
}

// ============================================================================
// Event Mapping
// ============================================================================

const cursorEventMap: Record<string, NormalizedEventName> = {
  sessionStart: "session-start",
  beforeSubmitPrompt: "prompt-submit",
  preToolUse: "pre-tool-use",
  stop: "stop",
};

const claudeCodeEventMap: Record<string, NormalizedEventName> = {
  SessionStart: "session-start",
  UserPromptSubmit: "prompt-submit",
  PreToolUse: "pre-tool-use",
  Stop: "stop",
};

// ============================================================================
// Platform Detection
// ============================================================================

/**
 * Detect platform from the raw JSON event shape.
 * Cursor events include `hook_event_name`; Claude Code events do not.
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

function resolveEvent(raw: Record<string, unknown>, platform: Platform, hookEventHint?: string): NormalizedEventName {
  if (platform === "cursor") {
    const name = raw.hook_event_name as string;
    return cursorEventMap[name] ?? "prompt-submit";
  }

  // Claude Code: use hint or structural detection
  if (hookEventHint && claudeCodeEventMap[hookEventHint]) {
    return claudeCodeEventMap[hookEventHint];
  }
  if (typeof raw.prompt === "string") return "prompt-submit";
  if (typeof raw.tool_name === "string") return "pre-tool-use";
  if (typeof raw.session_id === "string") return "session-start";
  return "prompt-submit";
}

function extractSessionId(raw: Record<string, unknown>, platform: Platform): string {
  if (platform === "cursor") {
    // Cursor: conversation_id is the stable session ID; sessionStart also has session_id
    return (raw.conversation_id as string) ?? (raw.session_id as string) ?? "";
  }
  return (raw.session_id as string) ?? "";
}

function extractWorkspaceRoot(raw: Record<string, unknown>, platform: Platform): string {
  if (platform === "cursor") {
    // Cursor: workspace_roots is an array (multiroot workspaces), take first
    const roots = raw.workspace_roots as string[] | undefined;
    return roots?.[0] ?? "";
  }
  return (raw.cwd as string) ?? "";
}

function buildPayload(
  raw: Record<string, unknown>,
  platform: Platform,
  event: NormalizedEventName,
): SessionStartPayload | PromptSubmitPayload | PreToolUsePayload | StopPayload {
  switch (event) {
    case "session-start":
      if (platform === "cursor") {
        return {
          sessionId: (raw.session_id as string) ?? "",
          isBackgroundAgent: (raw.is_background_agent as boolean) ?? false,
          composerMode: raw.composer_mode as string | undefined,
        };
      }
      return {
        sessionId: (raw.session_id as string) ?? "",
      };

    case "prompt-submit":
      if (platform === "cursor") {
        return {
          prompt: (raw.prompt as string) ?? "",
          attachments: raw.attachments as Array<{ type: string; filePath: string }> | undefined,
        };
      }
      return {
        prompt: (raw.prompt as string) ?? "",
      };

    case "pre-tool-use":
      return {
        toolName: (raw.tool_name as string) ?? "",
        toolInput: (raw.tool_input as Record<string, unknown>) ?? {},
      };

    case "stop":
      if (platform === "cursor") {
        return { status: (raw.status as string) ?? "completed" };
      }
      return { status: "completed" };
  }
}

/**
 * Normalize a raw hook event JSON to the common NormalizedHookEvent.
 *
 * @param raw - Parsed JSON from stdin
 * @param hookEventHint - Claude Code event type hint (e.g. "PreToolUse", "Stop")
 */
export function normalizeEvent(
  raw: Record<string, unknown>,
  hookEventHint?: string,
): NormalizedHookEvent {
  const platform = detectPlatform(raw);
  const event = resolveEvent(raw, platform, hookEventHint);

  return {
    platform,
    event,
    sessionId: extractSessionId(raw, platform),
    workspaceRoot: extractWorkspaceRoot(raw, platform),
    raw,
    payload: buildPayload(raw, platform, event),
  };
}

// ============================================================================
// Output Formatting
// ============================================================================

/** Options for formatting hook output. Scripts populate what they need. */
export interface HookOutput {
  // session-start
  env?: Record<string, string>;
  additionalContext?: string;

  // session-start, prompt-submit
  continue?: boolean;

  // pre-tool-use
  decision?: "allow" | "deny";
  reason?: string;
  updatedInput?: Record<string, unknown>;

  // stop
  followupMessage?: string;

  // shared
  userMessage?: string;
}

/**
 * Format a HookOutput into the correct platform-specific JSON string.
 * Scripts call this and write the result to stdout.
 */
export function formatOutput(event: NormalizedHookEvent, output: HookOutput): string {
  const result: Record<string, unknown> = {};

  if (event.platform === "cursor") {
    switch (event.event) {
      case "session-start":
        if (output.env) result.env = output.env;
        if (output.additionalContext) result.additional_context = output.additionalContext;
        if (output.continue !== undefined) result.continue = output.continue;
        if (output.userMessage) result.user_message = output.userMessage;
        break;
      case "prompt-submit":
        result.continue = output.continue ?? true;
        if (output.userMessage) result.user_message = output.userMessage;
        break;
      case "pre-tool-use":
        result.decision = output.decision ?? "allow";
        if (output.reason) result.reason = output.reason;
        if (output.updatedInput) result.updated_input = output.updatedInput;
        break;
      case "stop":
        if (output.followupMessage) result.followup_message = output.followupMessage;
        break;
    }
  } else {
    // Claude Code output format
    switch (event.event) {
      case "session-start":
        // Claude Code sessionStart is observational
        break;
      case "prompt-submit":
        // Claude Code UserPromptSubmit can block
        if (output.continue === false) {
          result.decision = "block";
          if (output.userMessage) result.reason = output.userMessage;
        }
        break;
      case "pre-tool-use":
        result.decision = output.decision ?? "allow";
        if (output.reason) result.reason = output.reason;
        break;
      case "stop":
        // Claude Code Stop is observational
        break;
    }
  }

  return JSON.stringify(result);
}

// ============================================================================
// Stdin Helper
// ============================================================================

/**
 * Read stdin, parse JSON, and normalize the event.
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
