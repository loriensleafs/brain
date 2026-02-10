/**
 * Golden file snapshot tests for hook normalization.
 *
 * Captures the exact normalized output for representative event payloads
 * from both platforms. Vitest inline snapshots serve as golden files --
 * any change to normalization logic that alters output will fail CI
 * until snapshots are explicitly updated.
 */
import { describe, expect, it, afterEach } from "vitest";
import { normalizeEvent, formatOutput } from "../normalize";
import { processUserPrompt } from "../user-prompt";
import { processPreToolUse } from "../pre-tool-use";
import { processStop } from "../stop";
import { setExecCommand, resetExecCommand } from "../exec";

afterEach(() => {
  resetExecCommand();
});

// ============================================================================
// Golden: Claude Code Normalization
// ============================================================================

describe("golden: Claude Code normalization", () => {
  it("CC PreToolUse → normalized snapshot", () => {
    const result = normalizeEvent(
      {
        tool_name: "Bash",
        tool_input: { command: "git status" },
        session_id: "cc-session-golden-1",
        cwd: "/Users/dev/brain",
      },
      "PreToolUse",
    );
    expect(result.platform).toBe("claude-code");
    expect(result.event).toBe("pre-tool-use");
    expect(result.sessionId).toBe("cc-session-golden-1");
    expect(result.workspaceRoot).toBe("/Users/dev/brain");
    expect(result.payload).toEqual({
      toolName: "Bash",
      toolInput: { command: "git status" },
    });
  });

  it("CC UserPromptSubmit → normalized snapshot", () => {
    const result = normalizeEvent(
      {
        prompt: "implement OAuth authentication",
        session_id: "cc-session-golden-3",
        cwd: "/Users/dev/brain",
      },
      "UserPromptSubmit",
    );
    expect(result.event).toBe("prompt-submit");
    expect(result.payload).toEqual({
      prompt: "implement OAuth authentication",
    });
  });

  it("CC Stop → normalized snapshot", () => {
    const result = normalizeEvent(
      { session_id: "cc-session-golden-4", cwd: "/Users/dev/brain" },
      "Stop",
    );
    expect(result.event).toBe("stop");
    expect(result.payload).toEqual({ status: "completed" });
  });

  it("CC SessionStart → normalized snapshot", () => {
    const result = normalizeEvent(
      { session_id: "cc-session-golden-5", cwd: "/Users/dev/brain" },
      "SessionStart",
    );
    expect(result.event).toBe("session-start");
    expect(result.payload).toEqual({ sessionId: "cc-session-golden-5" });
  });
});

// ============================================================================
// Golden: Cursor Normalization
// ============================================================================

describe("golden: Cursor normalization", () => {
  it("Cursor sessionStart → normalized snapshot", () => {
    const result = normalizeEvent({
      hook_event_name: "sessionStart",
      session_id: "cursor-sess-golden-1",
      is_background_agent: false,
      composer_mode: "agent",
      conversation_id: "cursor-conv-golden-1",
      workspace_roots: ["/Users/dev/brain"],
    });
    expect(result.event).toBe("session-start");
    expect(result.payload).toEqual({
      sessionId: "cursor-sess-golden-1",
      isBackgroundAgent: false,
      composerMode: "agent",
    });
  });

  it("Cursor preToolUse → normalized snapshot", () => {
    const result = normalizeEvent({
      hook_event_name: "preToolUse",
      tool_name: "Shell",
      tool_input: { command: "git status" },
      conversation_id: "cursor-conv-golden-2",
      workspace_roots: ["/Users/dev/brain"],
    });
    expect(result.event).toBe("pre-tool-use");
    expect(result.payload).toEqual({
      toolName: "Shell",
      toolInput: { command: "git status" },
    });
  });

  it("Cursor beforeSubmitPrompt → normalized snapshot", () => {
    const result = normalizeEvent({
      hook_event_name: "beforeSubmitPrompt",
      prompt: "implement OAuth authentication",
      conversation_id: "cursor-conv-golden-3",
      workspace_roots: ["/Users/dev/brain"],
    });
    expect(result.event).toBe("prompt-submit");
    expect(result.payload).toEqual({
      prompt: "implement OAuth authentication",
    });
  });

  it("Cursor stop → normalized snapshot", () => {
    const result = normalizeEvent({
      hook_event_name: "stop",
      status: "completed",
      conversation_id: "cursor-conv-golden-4",
      workspace_roots: ["/Users/dev/brain"],
    });
    expect(result.event).toBe("stop");
    expect(result.payload).toEqual({ status: "completed" });
  });
});

// ============================================================================
// Golden: Output Formatting
// ============================================================================

describe("golden: formatOutput", () => {
  it("Cursor pre-tool-use deny output", () => {
    const event = normalizeEvent({
      hook_event_name: "preToolUse",
      tool_name: "Shell",
      tool_input: { command: "rm -rf /" },
      conversation_id: "c",
      workspace_roots: ["/ws"],
    });
    const out = formatOutput(event, { decision: "deny", reason: "Dangerous command" });
    expect(JSON.parse(out)).toEqual({
      decision: "deny",
      reason: "Dangerous command",
    });
  });

  it("Claude Code pre-tool-use allow output", () => {
    const event = normalizeEvent(
      { tool_name: "Bash", tool_input: { command: "npm test" }, session_id: "s", cwd: "/ws" },
      "PreToolUse",
    );
    const out = formatOutput(event, { decision: "allow" });
    expect(JSON.parse(out)).toEqual({ decision: "allow" });
  });
});

// ============================================================================
// Golden: Process Function Output Snapshots
// ============================================================================

describe("golden: processUserPrompt output", () => {
  it("BUG scenario detection snapshot", () => {
    const event = normalizeEvent(
      { prompt: "fix the broken login flow", session_id: "s", cwd: "/ws" },
      "UserPromptSubmit",
    );
    const result = processUserPrompt(event);
    expect(result.continue).toBe(true);
    expect(result.scenario?.detected).toBe(true);
    expect(result.scenario?.scenario).toBe("BUG");
  });

  it("no match snapshot", () => {
    const event = normalizeEvent(
      { prompt: "hello world", session_id: "s", cwd: "/ws" },
      "UserPromptSubmit",
    );
    const result = processUserPrompt(event);
    expect(result.continue).toBe(true);
    expect(result.scenario).toBeUndefined();
  });
});

describe("golden: processPreToolUse output", () => {
  it("blocked in analysis mode snapshot", () => {
    setExecCommand((cmd, args) => {
      if (cmd === "brain" && args[0] === "session") {
        return JSON.stringify({ sessionId: "s1", currentMode: "analysis" });
      }
      return "";
    });

    const event = normalizeEvent(
      { tool_name: "Bash", tool_input: { command: "rm -rf /" }, session_id: "s", cwd: "/ws" },
      "PreToolUse",
    );
    const result = processPreToolUse(event);
    expect(result.decision).toBe("block");
    expect(result.mode).toBe("analysis");
  });

  it("allowed in coding mode snapshot", () => {
    setExecCommand((cmd, args) => {
      if (cmd === "brain" && args[0] === "session") {
        return JSON.stringify({ sessionId: "s1", currentMode: "coding" });
      }
      return "";
    });

    const event = normalizeEvent(
      { tool_name: "Bash", tool_input: { command: "npm test" }, session_id: "s", cwd: "/ws" },
      "PreToolUse",
    );
    const result = processPreToolUse(event);
    expect(result.decision).toBe("allow");
    expect(result.mode).toBe("coding");
  });
});

describe("golden: processStop output", () => {
  it("no workflow state snapshot", () => {
    setExecCommand(() => { throw new Error("no state"); });

    const event = normalizeEvent(
      { session_id: "s", cwd: "/ws" },
      "Stop",
    );
    const { output, shouldBlock } = processStop(event);
    expect(shouldBlock).toBe(false);
    expect(output.continue).toBe(true);
  });
});
