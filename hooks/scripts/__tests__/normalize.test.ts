/**
 * Tests for normalize.ts -- hook normalization layer.
 *
 * Covers platform detection, event mapping, payload normalization,
 * blocking semantics, and session ID extraction for both platforms.
 *
 * @see TASK-018-build-hook-normalization-shim
 */
import { describe, expect, it } from "vitest";
import {
  detectPlatform,
  normalizeEvent,
  getBlockingSemantics,
  type NormalizedHookEvent,
  type Platform,
  type NormalizedEventName,
} from "../normalize.js";

// ============================================================================
// Platform Detection
// ============================================================================

describe("detectPlatform", () => {
  it("detects Cursor from hook_event_name field", () => {
    expect(detectPlatform({ hook_event_name: "beforeShellExecution" }))
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
    expect(detectPlatform({ hook_event_name: true })).toBe("claude-code");
  });
});

// ============================================================================
// Cursor Event Normalization
// ============================================================================

describe("normalizeEvent - Cursor", () => {
  it("normalizes beforeSubmitPrompt to prompt-submit", () => {
    const result = normalizeEvent({
      hook_event_name: "beforeSubmitPrompt",
      prompt: "hello world",
      conversation_id: "conv-abc",
      cwd: "/workspace",
    });
    expect(result.platform).toBe("cursor");
    expect(result.event).toBe("prompt-submit");
    expect(result.sessionId).toBe("conv-abc");
    expect(result.workspaceRoot).toBe("/workspace");
    expect(result.payload.prompt).toBe("hello world");
  });

  it("normalizes beforeShellExecution to before-shell", () => {
    const result = normalizeEvent({
      hook_event_name: "beforeShellExecution",
      command: "git status",
      cwd: "/workspace",
      conversation_id: "conv-456",
    });
    expect(result.platform).toBe("cursor");
    expect(result.event).toBe("before-shell");
    expect(result.payload.command).toBe("git status");
  });

  it("normalizes beforeMCPExecution to before-mcp", () => {
    const result = normalizeEvent({
      hook_event_name: "beforeMCPExecution",
      tool_name: "read_note",
      tool_input: { identifier: "my-note" },
      server: "brain",
      conversation_id: "conv-789",
      cwd: "/workspace",
    });
    expect(result.platform).toBe("cursor");
    expect(result.event).toBe("before-mcp");
    expect(result.payload.tool_name).toBe("read_note");
    expect(result.payload.server).toBe("brain");
  });

  it("normalizes beforeReadFile to before-read-file", () => {
    const result = normalizeEvent({
      hook_event_name: "beforeReadFile",
      file_path: "/workspace/secret.env",
      cwd: "/workspace",
      conversation_id: "conv-111",
    });
    expect(result.platform).toBe("cursor");
    expect(result.event).toBe("before-read-file");
    expect(result.payload.file_path).toBe("/workspace/secret.env");
  });

  it("normalizes afterFileEdit to after-edit", () => {
    const result = normalizeEvent({
      hook_event_name: "afterFileEdit",
      edits: [{ old_string: "foo", new_string: "bar" }],
      cwd: "/workspace",
      conversation_id: "conv-222",
    });
    expect(result.platform).toBe("cursor");
    expect(result.event).toBe("after-edit");
    expect(result.payload.edits).toEqual([{ old_string: "foo", new_string: "bar" }]);
  });

  it("normalizes Cursor stop to stop", () => {
    const result = normalizeEvent({
      hook_event_name: "stop",
      status: "completed",
      conversation_id: "conv-333",
      cwd: "/workspace",
    });
    expect(result.platform).toBe("cursor");
    expect(result.event).toBe("stop");
    expect(result.payload.status).toBe("completed");
  });

  it("includes attachments in prompt-submit payload", () => {
    const result = normalizeEvent({
      hook_event_name: "beforeSubmitPrompt",
      prompt: "check this file",
      attachments: [{ path: "/workspace/file.ts" }],
      conversation_id: "conv-444",
      cwd: "/workspace",
    });
    expect(result.payload.attachments).toEqual([{ path: "/workspace/file.ts" }]);
  });

  it("falls back to prompt-submit for unknown Cursor event", () => {
    const result = normalizeEvent({
      hook_event_name: "someUnknownEvent",
      conversation_id: "conv-555",
      cwd: "/workspace",
    });
    expect(result.event).toBe("prompt-submit");
  });
});

// ============================================================================
// Claude Code Event Normalization
// ============================================================================

describe("normalizeEvent - Claude Code", () => {
  it("normalizes PreToolUse with Bash to before-shell (with hint)", () => {
    const result = normalizeEvent(
      {
        tool_name: "Bash",
        tool_input: { command: "npm test" },
        session_id: "sess-123",
        cwd: "/workspace",
      },
      "PreToolUse",
    );
    expect(result.platform).toBe("claude-code");
    expect(result.event).toBe("before-shell");
    expect(result.sessionId).toBe("sess-123");
    expect(result.payload.command).toBe("npm test");
  });

  it("normalizes PreToolUse with MCP tool to before-mcp (with hint)", () => {
    const result = normalizeEvent(
      {
        tool_name: "mcp__plugin____brain__search",
        tool_input: { query: "hooks" },
        session_id: "sess-456",
        cwd: "/workspace",
      },
      "PreToolUse",
    );
    expect(result.platform).toBe("claude-code");
    expect(result.event).toBe("before-mcp");
    expect(result.payload.tool_name).toBe("mcp__plugin____brain__search");
  });

  it("normalizes Stop with hint", () => {
    const result = normalizeEvent(
      { session_id: "sess-789", cwd: "/workspace" },
      "Stop",
    );
    expect(result.platform).toBe("claude-code");
    expect(result.event).toBe("stop");
  });

  it("normalizes UserPromptSubmit with hint", () => {
    const result = normalizeEvent(
      {
        prompt: "implement feature X",
        session_id: "sess-aaa",
        cwd: "/workspace",
      },
      "UserPromptSubmit",
    );
    expect(result.platform).toBe("claude-code");
    expect(result.event).toBe("prompt-submit");
    expect(result.payload.prompt).toBe("implement feature X");
  });

  it("normalizes SessionStart with hint", () => {
    const result = normalizeEvent(
      { session_id: "sess-bbb", cwd: "/workspace" },
      "SessionStart",
    );
    expect(result.platform).toBe("claude-code");
    expect(result.event).toBe("session-start");
    expect(result.payload.cwd).toBe("/workspace");
  });

  it("normalizes PostToolUse with hint", () => {
    const result = normalizeEvent(
      {
        tool_name: "Write",
        tool_output: { file: "test.ts" },
        session_id: "sess-ccc",
        cwd: "/workspace",
      },
      "PostToolUse",
    );
    expect(result.platform).toBe("claude-code");
    expect(result.event).toBe("after-edit");
    expect(result.payload.tool_name).toBe("Write");
  });

  // --- Structural detection fallback (no hint) ---

  it("detects prompt-submit from prompt field (no hint)", () => {
    const result = normalizeEvent({
      prompt: "do something",
      session_id: "sess-ddd",
      cwd: "/workspace",
    });
    expect(result.event).toBe("prompt-submit");
    expect(result.payload.prompt).toBe("do something");
  });

  it("detects before-shell from Bash tool_name (no hint)", () => {
    const result = normalizeEvent({
      tool_name: "Bash",
      tool_input: { command: "ls" },
      session_id: "sess-eee",
      cwd: "/workspace",
    });
    expect(result.event).toBe("before-shell");
    expect(result.payload.command).toBe("ls");
  });

  it("detects before-mcp from non-Bash tool_name (no hint)", () => {
    const result = normalizeEvent({
      tool_name: "Read",
      tool_input: { file_path: "/test.ts" },
      session_id: "sess-fff",
      cwd: "/workspace",
    });
    expect(result.event).toBe("before-mcp");
    expect(result.payload.tool_name).toBe("Read");
  });

  it("detects session-start from minimal session_id-only payload (no hint)", () => {
    const result = normalizeEvent({
      session_id: "sess-ggg",
      cwd: "/workspace",
    });
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

  it("extracts sessionId (camelCase) for Claude Code", () => {
    const result = normalizeEvent(
      { prompt: "hello", sessionId: "cc-session-2", cwd: "/ws" },
      "UserPromptSubmit",
    );
    expect(result.sessionId).toBe("cc-session-2");
  });

  it("extracts conversation_id for Cursor", () => {
    const result = normalizeEvent({
      hook_event_name: "stop",
      conversation_id: "cursor-conv-1",
      cwd: "/ws",
    });
    expect(result.sessionId).toBe("cursor-conv-1");
  });

  it("falls back to session_id for Cursor if no conversation_id", () => {
    const result = normalizeEvent({
      hook_event_name: "stop",
      session_id: "cursor-sess-fallback",
      cwd: "/ws",
    });
    expect(result.sessionId).toBe("cursor-sess-fallback");
  });

  it("returns empty string when no session identifier present", () => {
    const result = normalizeEvent({
      hook_event_name: "stop",
      cwd: "/ws",
    });
    expect(result.sessionId).toBe("");
  });
});

// ============================================================================
// Workspace Root Extraction
// ============================================================================

describe("workspace root extraction", () => {
  it("extracts cwd field", () => {
    const result = normalizeEvent(
      { prompt: "hi", cwd: "/my/project", session_id: "s1" },
      "UserPromptSubmit",
    );
    expect(result.workspaceRoot).toBe("/my/project");
  });

  it("extracts workspace_root for Cursor", () => {
    const result = normalizeEvent({
      hook_event_name: "stop",
      workspace_root: "/cursor/workspace",
      conversation_id: "c1",
    });
    expect(result.workspaceRoot).toBe("/cursor/workspace");
  });

  it("returns empty string when neither cwd nor workspace_root", () => {
    const result = normalizeEvent({
      hook_event_name: "stop",
      conversation_id: "c2",
    });
    expect(result.workspaceRoot).toBe("");
  });
});

// ============================================================================
// Blocking Semantics
// ============================================================================

describe("getBlockingSemantics", () => {
  it("Claude Code Stop can block", () => {
    const result = getBlockingSemantics("stop", "claude-code");
    expect(result.canBlock).toBe(true);
    expect(result.infoOnly).toBe(false);
  });

  it("Cursor stop is info-only", () => {
    const result = getBlockingSemantics("stop", "cursor");
    expect(result.canBlock).toBe(false);
    expect(result.infoOnly).toBe(true);
  });

  it("both platforms can block before-shell", () => {
    expect(getBlockingSemantics("before-shell", "claude-code").canBlock).toBe(true);
    expect(getBlockingSemantics("before-shell", "cursor").canBlock).toBe(true);
  });

  it("both platforms can block before-mcp", () => {
    expect(getBlockingSemantics("before-mcp", "claude-code").canBlock).toBe(true);
    expect(getBlockingSemantics("before-mcp", "cursor").canBlock).toBe(true);
  });

  it("Claude Code prompt-submit can block, Cursor cannot", () => {
    expect(getBlockingSemantics("prompt-submit", "claude-code").canBlock).toBe(true);
    expect(getBlockingSemantics("prompt-submit", "cursor").canBlock).toBe(false);
  });

  it("before-read-file: Cursor can block, Claude Code cannot", () => {
    expect(getBlockingSemantics("before-read-file", "cursor").canBlock).toBe(true);
    expect(getBlockingSemantics("before-read-file", "claude-code").canBlock).toBe(false);
  });

  it("after-edit is info-only on both platforms", () => {
    expect(getBlockingSemantics("after-edit", "claude-code").infoOnly).toBe(true);
    expect(getBlockingSemantics("after-edit", "cursor").infoOnly).toBe(true);
  });

  it("returns info-only for unknown events", () => {
    const result = getBlockingSemantics("unknown-event" as NormalizedEventName, "claude-code");
    expect(result.canBlock).toBe(false);
    expect(result.infoOnly).toBe(true);
  });
});

// ============================================================================
// Full Round-Trip Tests
// ============================================================================

describe("normalizeEvent - round-trip scenarios", () => {
  it("Cursor shell execution round-trip", () => {
    const raw = {
      hook_event_name: "beforeShellExecution",
      command: "git push origin main",
      cwd: "/Users/dev/brain",
      conversation_id: "conv-roundtrip-1",
      generation_id: "gen-001",
    };
    const event = normalizeEvent(raw);

    expect(event).toEqual({
      platform: "cursor",
      event: "before-shell",
      sessionId: "conv-roundtrip-1",
      workspaceRoot: "/Users/dev/brain",
      payload: { command: "git push origin main" },
    } satisfies NormalizedHookEvent);
  });

  it("Claude Code Bash execution round-trip", () => {
    const raw = {
      tool_name: "Bash",
      tool_input: { command: "git push origin main" },
      session_id: "sess-roundtrip-1",
      cwd: "/Users/dev/brain",
    };
    const event = normalizeEvent(raw, "PreToolUse");

    expect(event).toEqual({
      platform: "claude-code",
      event: "before-shell",
      sessionId: "sess-roundtrip-1",
      workspaceRoot: "/Users/dev/brain",
      payload: {
        command: "git push origin main",
        tool_name: "Bash",
        tool_input: { command: "git push origin main" },
      },
    } satisfies NormalizedHookEvent);
  });

  it("both platforms produce same event name for shell execution", () => {
    const cursorResult = normalizeEvent({
      hook_event_name: "beforeShellExecution",
      command: "ls",
      cwd: "/ws",
      conversation_id: "c",
    });

    const ccResult = normalizeEvent(
      { tool_name: "Bash", tool_input: { command: "ls" }, session_id: "s", cwd: "/ws" },
      "PreToolUse",
    );

    expect(cursorResult.event).toBe(ccResult.event);
    expect(cursorResult.event).toBe("before-shell");
  });

  it("both platforms produce same event name for stop", () => {
    const cursorResult = normalizeEvent({
      hook_event_name: "stop",
      status: "completed",
      conversation_id: "c",
      cwd: "/ws",
    });

    const ccResult = normalizeEvent(
      { session_id: "s", cwd: "/ws" },
      "Stop",
    );

    expect(cursorResult.event).toBe(ccResult.event);
    expect(cursorResult.event).toBe("stop");
  });
});
