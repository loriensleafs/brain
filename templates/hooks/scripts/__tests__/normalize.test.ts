/**
 * Tests for normalize.ts -- hook normalization layer.
 *
 * Covers platform detection, event mapping, payload normalization,
 * output formatting, and session ID extraction for both platforms.
 */
import { describe, expect, it } from "vitest";
import {
  detectPlatform,
  normalizeEvent,
  formatOutput,
  type NormalizedHookEvent,
} from "../normalize";

// ============================================================================
// Platform Detection
// ============================================================================

describe("detectPlatform", () => {
  it("detects Cursor from hook_event_name field", () => {
    expect(detectPlatform({ hook_event_name: "preToolUse" }))
      .toBe("cursor");
  });

  it("detects Claude Code when hook_event_name is absent", () => {
    expect(detectPlatform({ tool_name: "Bash", tool_input: {} }))
      .toBe("claude-code");
  });

  it("detects Claude Code for empty object", () => {
    expect(detectPlatform({})).toBe("claude-code");
  });

  it("detects Cursor even with extra fields", () => {
    expect(detectPlatform({
      hook_event_name: "stop",
      conversation_id: "conv-123",
      status: "completed",
    })).toBe("cursor");
  });

  it("does not falsely detect Cursor when hook_event_name is non-string", () => {
    expect(detectPlatform({ hook_event_name: 42 })).toBe("claude-code");
    expect(detectPlatform({ hook_event_name: null })).toBe("claude-code");
  });
});

// ============================================================================
// Cursor Event Normalization
// ============================================================================

describe("normalizeEvent - Cursor", () => {
  it("normalizes sessionStart", () => {
    const result = normalizeEvent({
      hook_event_name: "sessionStart",
      session_id: "sess-1",
      is_background_agent: false,
      composer_mode: "agent",
      conversation_id: "conv-1",
      workspace_roots: ["/workspace"],
    });
    expect(result.platform).toBe("cursor");
    expect(result.event).toBe("session-start");
    expect(result.sessionId).toBe("conv-1");
    expect(result.workspaceRoot).toBe("/workspace");
    expect(result.payload).toEqual({
      sessionId: "sess-1",
      isBackgroundAgent: false,
      composerMode: "agent",
    });
  });

  it("normalizes beforeSubmitPrompt", () => {
    const result = normalizeEvent({
      hook_event_name: "beforeSubmitPrompt",
      prompt: "hello world",
      conversation_id: "conv-2",
      workspace_roots: ["/workspace"],
    });
    expect(result.event).toBe("prompt-submit");
    expect(result.payload).toEqual({
      prompt: "hello world",
    });
  });

  it("normalizes preToolUse", () => {
    const result = normalizeEvent({
      hook_event_name: "preToolUse",
      tool_name: "Shell",
      tool_input: { command: "npm test" },
      conversation_id: "conv-3",
      workspace_roots: ["/workspace"],
    });
    expect(result.event).toBe("pre-tool-use");
    expect(result.payload).toEqual({
      toolName: "Shell",
      toolInput: { command: "npm test" },
    });
  });

  it("normalizes stop", () => {
    const result = normalizeEvent({
      hook_event_name: "stop",
      status: "completed",
      conversation_id: "conv-4",
      workspace_roots: ["/workspace"],
    });
    expect(result.event).toBe("stop");
    expect(result.payload).toEqual({ status: "completed" });
  });

  it("includes attachments in prompt-submit payload", () => {
    const result = normalizeEvent({
      hook_event_name: "beforeSubmitPrompt",
      prompt: "check this",
      attachments: [{ type: "file", filePath: "/test.ts" }],
      conversation_id: "conv-5",
      workspace_roots: ["/workspace"],
    });
    expect((result.payload as any).attachments).toEqual([{ type: "file", filePath: "/test.ts" }]);
  });

  it("falls back to prompt-submit for unknown event", () => {
    const result = normalizeEvent({
      hook_event_name: "someUnknownEvent",
      conversation_id: "conv-6",
      workspace_roots: ["/workspace"],
    });
    expect(result.event).toBe("prompt-submit");
  });

  it("extracts workspace_roots array (first element)", () => {
    const result = normalizeEvent({
      hook_event_name: "stop",
      conversation_id: "conv-7",
      workspace_roots: ["/first", "/second"],
    });
    expect(result.workspaceRoot).toBe("/first");
  });
});

// ============================================================================
// Claude Code Event Normalization
// ============================================================================

describe("normalizeEvent - Claude Code", () => {
  it("normalizes SessionStart with hint", () => {
    const result = normalizeEvent(
      { session_id: "sess-1", cwd: "/workspace" },
      "SessionStart",
    );
    expect(result.event).toBe("session-start");
    expect(result.payload).toEqual({ sessionId: "sess-1" });
  });

  it("normalizes UserPromptSubmit with hint", () => {
    const result = normalizeEvent(
      { prompt: "implement feature X", session_id: "sess-2", cwd: "/workspace" },
      "UserPromptSubmit",
    );
    expect(result.event).toBe("prompt-submit");
    expect(result.payload).toEqual({ prompt: "implement feature X" });
  });

  it("normalizes PreToolUse with hint", () => {
    const result = normalizeEvent(
      { tool_name: "Bash", tool_input: { command: "npm test" }, session_id: "sess-3", cwd: "/workspace" },
      "PreToolUse",
    );
    expect(result.event).toBe("pre-tool-use");
    expect(result.payload).toEqual({
      toolName: "Bash",
      toolInput: { command: "npm test" },
    });
  });

  it("normalizes Stop with hint", () => {
    const result = normalizeEvent(
      { session_id: "sess-4", cwd: "/workspace" },
      "Stop",
    );
    expect(result.event).toBe("stop");
    expect(result.payload).toEqual({ status: "completed" });
  });

  // Structural detection (no hint)
  it("detects prompt-submit from prompt field", () => {
    const result = normalizeEvent({ prompt: "do something", session_id: "s", cwd: "/ws" });
    expect(result.event).toBe("prompt-submit");
  });

  it("detects pre-tool-use from tool_name field", () => {
    const result = normalizeEvent({ tool_name: "Bash", tool_input: {}, session_id: "s", cwd: "/ws" });
    expect(result.event).toBe("pre-tool-use");
  });

  it("detects session-start from session_id-only payload", () => {
    const result = normalizeEvent({ session_id: "s", cwd: "/ws" });
    expect(result.event).toBe("session-start");
  });
});

// ============================================================================
// Session ID Extraction
// ============================================================================

describe("session ID extraction", () => {
  it("extracts session_id for Claude Code", () => {
    const result = normalizeEvent(
      { prompt: "hello", session_id: "cc-session-1", cwd: "/ws" },
      "UserPromptSubmit",
    );
    expect(result.sessionId).toBe("cc-session-1");
  });

  it("extracts conversation_id for Cursor", () => {
    const result = normalizeEvent({
      hook_event_name: "stop",
      conversation_id: "cursor-conv-1",
      workspace_roots: ["/ws"],
    });
    expect(result.sessionId).toBe("cursor-conv-1");
  });

  it("falls back to session_id for Cursor if no conversation_id", () => {
    const result = normalizeEvent({
      hook_event_name: "stop",
      session_id: "cursor-sess-fallback",
      workspace_roots: ["/ws"],
    });
    expect(result.sessionId).toBe("cursor-sess-fallback");
  });

  it("returns empty string when no session identifier present", () => {
    const result = normalizeEvent({
      hook_event_name: "stop",
      workspace_roots: ["/ws"],
    });
    expect(result.sessionId).toBe("");
  });
});

// ============================================================================
// Output Formatting
// ============================================================================

describe("formatOutput - Cursor", () => {
  const cursorEvent = (event: string): NormalizedHookEvent => ({
    platform: "cursor",
    event: event as any,
    sessionId: "c1",
    workspaceRoot: "/ws",
    raw: {},
    payload: {} as any,
  });

  it("formats session-start output", () => {
    const out = formatOutput(cursorEvent("session-start"), {
      env: { BRAIN_SESSION: "s1" },
      additionalContext: "You are Brain.",
      continue: true,
    });
    expect(JSON.parse(out)).toEqual({
      env: { BRAIN_SESSION: "s1" },
      additional_context: "You are Brain.",
      continue: true,
    });
  });

  it("formats prompt-submit block", () => {
    const out = formatOutput(cursorEvent("prompt-submit"), {
      continue: false,
      userMessage: "Blocked by policy",
    });
    expect(JSON.parse(out)).toEqual({
      continue: false,
      user_message: "Blocked by policy",
    });
  });

  it("formats pre-tool-use deny", () => {
    const out = formatOutput(cursorEvent("pre-tool-use"), {
      decision: "deny",
      reason: "Analysis mode",
    });
    expect(JSON.parse(out)).toEqual({
      decision: "deny",
      reason: "Analysis mode",
    });
  });

  it("formats pre-tool-use with updated input", () => {
    const out = formatOutput(cursorEvent("pre-tool-use"), {
      decision: "allow",
      updatedInput: { command: "npm ci" },
    });
    expect(JSON.parse(out)).toEqual({
      decision: "allow",
      updated_input: { command: "npm ci" },
    });
  });

  it("formats stop with followup", () => {
    const out = formatOutput(cursorEvent("stop"), {
      followupMessage: "Run tests next",
    });
    expect(JSON.parse(out)).toEqual({
      followup_message: "Run tests next",
    });
  });
});

describe("formatOutput - Claude Code", () => {
  const ccEvent = (event: string): NormalizedHookEvent => ({
    platform: "claude-code",
    event: event as any,
    sessionId: "s1",
    workspaceRoot: "/ws",
    raw: {},
    payload: {} as any,
  });

  it("formats pre-tool-use allow", () => {
    const out = formatOutput(ccEvent("pre-tool-use"), { decision: "allow" });
    expect(JSON.parse(out)).toEqual({ decision: "allow" });
  });

  it("formats prompt-submit block", () => {
    const out = formatOutput(ccEvent("prompt-submit"), {
      continue: false,
      userMessage: "Blocked",
    });
    expect(JSON.parse(out)).toEqual({
      decision: "block",
      reason: "Blocked",
    });
  });

  it("formats session-start as empty (observational)", () => {
    const out = formatOutput(ccEvent("session-start"), {});
    expect(JSON.parse(out)).toEqual({});
  });
});

// ============================================================================
// Cross-Platform Parity
// ============================================================================

describe("cross-platform parity", () => {
  it("both platforms produce same normalized event for pre-tool-use", () => {
    const cursor = normalizeEvent({
      hook_event_name: "preToolUse",
      tool_name: "Shell",
      tool_input: { command: "ls" },
      conversation_id: "c",
      workspace_roots: ["/ws"],
    });

    const cc = normalizeEvent(
      { tool_name: "Shell", tool_input: { command: "ls" }, session_id: "s", cwd: "/ws" },
      "PreToolUse",
    );

    expect(cursor.event).toBe(cc.event);
    expect(cursor.event).toBe("pre-tool-use");
  });

  it("both platforms produce same normalized event for stop", () => {
    const cursor = normalizeEvent({
      hook_event_name: "stop",
      status: "completed",
      conversation_id: "c",
      workspace_roots: ["/ws"],
    });

    const cc = normalizeEvent(
      { session_id: "s", cwd: "/ws" },
      "Stop",
    );

    expect(cursor.event).toBe(cc.event);
    expect(cursor.event).toBe("stop");
  });
});
