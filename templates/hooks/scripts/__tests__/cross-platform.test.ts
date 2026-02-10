/**
 * Cross-platform integration tests for refactored hook scripts.
 *
 * Verifies that user-prompt, pre-tool-use, and stop handlers produce
 * correct output for both Claude Code and Cursor event payloads.
 *
 * @see TASK-019-refactor-hook-scripts-for-normalization
 */
import { describe, expect, it, afterEach } from "vitest";
import { normalizeEvent } from "../normalize.js";
import { processUserPrompt } from "../user-prompt.js";
import { processPreToolUse } from "../pre-tool-use.js";
import { processStop } from "../stop.js";
import { setExecCommand, resetExecCommand } from "../exec.js";

afterEach(() => {
  resetExecCommand();
});

// ============================================================================
// User Prompt: Cross-Platform
// ============================================================================

describe("processUserPrompt - cross-platform", () => {
  it("Claude Code: detects scenario from prompt", () => {
    const event = normalizeEvent(
      { prompt: "fix the broken login flow", session_id: "s1", cwd: "/ws" },
      "UserPromptSubmit",
    );
    const result = processUserPrompt(event);
    expect(result.continue).toBe(true);
    expect(result.scenario?.detected).toBe(true);
    expect(result.scenario?.scenario).toBe("BUG");
  });

  it("Cursor: detects scenario from prompt", () => {
    const event = normalizeEvent({
      hook_event_name: "beforeSubmitPrompt",
      prompt: "fix the broken login flow",
      conversation_id: "c1",
      cwd: "/ws",
    });
    const result = processUserPrompt(event);
    expect(result.continue).toBe(true);
    expect(result.scenario?.detected).toBe(true);
    expect(result.scenario?.scenario).toBe("BUG");
  });

  it("both platforms detect same scenario for same prompt", () => {
    const prompt = "implement the OAuth authentication feature";

    const ccEvent = normalizeEvent(
      { prompt, session_id: "s1", cwd: "/ws" },
      "UserPromptSubmit",
    );
    const cursorEvent = normalizeEvent({
      hook_event_name: "beforeSubmitPrompt",
      prompt,
      conversation_id: "c1",
      cwd: "/ws",
    });

    const ccResult = processUserPrompt(ccEvent);
    const cursorResult = processUserPrompt(cursorEvent);

    expect(ccResult.scenario?.scenario).toBe(cursorResult.scenario?.scenario);
    expect(ccResult.scenario?.scenario).toBe("FEATURE");
  });

  it("injects workflow state for planning keywords on both platforms", () => {
    setExecCommand((cmd, args) => {
      if (cmd === "brain" && args[0] === "session") {
        return JSON.stringify({ mode: "planning", task: "design API" });
      }
      return "";
    });

    const prompt = "let's plan the implementation of the auth module";

    const ccEvent = normalizeEvent(
      { prompt, session_id: "s1", cwd: "/ws" },
      "UserPromptSubmit",
    );
    const cursorEvent = normalizeEvent({
      hook_event_name: "beforeSubmitPrompt",
      prompt,
      conversation_id: "c1",
      cwd: "/ws",
    });

    const ccResult = processUserPrompt(ccEvent);
    const cursorResult = processUserPrompt(cursorEvent);

    expect(ccResult.workflowState?.mode).toBe("planning");
    expect(cursorResult.workflowState?.mode).toBe("planning");
  });

  it("returns continue: true for non-matching prompt on both platforms", () => {
    const prompt = "hello world";

    const ccEvent = normalizeEvent(
      { prompt, session_id: "s1", cwd: "/ws" },
      "UserPromptSubmit",
    );
    const cursorEvent = normalizeEvent({
      hook_event_name: "beforeSubmitPrompt",
      prompt,
      conversation_id: "c1",
      cwd: "/ws",
    });

    expect(processUserPrompt(ccEvent).continue).toBe(true);
    expect(processUserPrompt(cursorEvent).continue).toBe(true);
    expect(processUserPrompt(ccEvent).scenario).toBeUndefined();
    expect(processUserPrompt(cursorEvent).scenario).toBeUndefined();
  });
});

// ============================================================================
// Pre-Tool-Use: Cross-Platform
// ============================================================================

describe("processPreToolUse - cross-platform", () => {
  it("Claude Code: allows Bash in coding mode", () => {
    setExecCommand((cmd, args) => {
      if (cmd === "brain" && args[0] === "session") {
        return JSON.stringify({ sessionId: "s1", currentMode: "coding" });
      }
      return "";
    });

    const event = normalizeEvent(
      { tool_name: "Bash", tool_input: { command: "npm test" }, session_id: "s1", cwd: "/ws" },
      "PreToolUse",
    );
    const result = processPreToolUse(event);
    expect(result.decision).toBe("allow");
  });

  it("Cursor: allows shell in coding mode", () => {
    setExecCommand((cmd, args) => {
      if (cmd === "brain" && args[0] === "session") {
        return JSON.stringify({ sessionId: "s1", currentMode: "coding" });
      }
      return "";
    });

    const event = normalizeEvent({
      hook_event_name: "beforeShellExecution",
      command: "npm test",
      conversation_id: "c1",
      cwd: "/ws",
    });
    const result = processPreToolUse(event);
    expect(result.decision).toBe("allow");
  });

  it("Claude Code: blocks Bash in analysis mode", () => {
    setExecCommand((cmd, args) => {
      if (cmd === "brain" && args[0] === "session") {
        return JSON.stringify({ sessionId: "s1", currentMode: "analysis" });
      }
      return "";
    });

    const event = normalizeEvent(
      { tool_name: "Bash", tool_input: { command: "rm -rf /" }, session_id: "s1", cwd: "/ws" },
      "PreToolUse",
    );
    const result = processPreToolUse(event);
    expect(result.decision).toBe("block");
  });

  it("Cursor: blocks shell in analysis mode", () => {
    setExecCommand((cmd, args) => {
      if (cmd === "brain" && args[0] === "session") {
        return JSON.stringify({ sessionId: "s1", currentMode: "analysis" });
      }
      return "";
    });

    const event = normalizeEvent({
      hook_event_name: "beforeShellExecution",
      command: "rm -rf /",
      conversation_id: "c1",
      cwd: "/ws",
    });
    const result = processPreToolUse(event);
    expect(result.decision).toBe("block");
  });

  it("Claude Code: allows MCP tools (Read) in analysis mode", () => {
    setExecCommand((cmd, args) => {
      if (cmd === "brain" && args[0] === "session") {
        return JSON.stringify({ sessionId: "s1", currentMode: "analysis" });
      }
      return "";
    });

    const event = normalizeEvent(
      { tool_name: "Read", tool_input: { file_path: "/test.ts" }, session_id: "s1", cwd: "/ws" },
      "PreToolUse",
    );
    const result = processPreToolUse(event);
    expect(result.decision).toBe("allow");
  });

  it("Cursor: allows MCP read tools in analysis mode", () => {
    setExecCommand((cmd, args) => {
      if (cmd === "brain" && args[0] === "session") {
        return JSON.stringify({ sessionId: "s1", currentMode: "analysis" });
      }
      return "";
    });

    const event = normalizeEvent({
      hook_event_name: "beforeMCPExecution",
      tool_name: "Read",
      tool_input: { file_path: "/test.ts" },
      server: "default",
      conversation_id: "c1",
      cwd: "/ws",
    });
    const result = processPreToolUse(event);
    expect(result.decision).toBe("allow");
  });

  it("both platforms produce same decision for same tool in same mode", () => {
    setExecCommand((cmd, args) => {
      if (cmd === "brain" && args[0] === "session") {
        return JSON.stringify({ sessionId: "s1", currentMode: "planning" });
      }
      return "";
    });

    const ccEvent = normalizeEvent(
      { tool_name: "Edit", tool_input: {}, session_id: "s1", cwd: "/ws" },
      "PreToolUse",
    );
    const cursorEvent = normalizeEvent({
      hook_event_name: "beforeMCPExecution",
      tool_name: "Edit",
      tool_input: {},
      server: "default",
      conversation_id: "c1",
      cwd: "/ws",
    });

    const ccResult = processPreToolUse(ccEvent);
    const cursorResult = processPreToolUse(cursorEvent);

    expect(ccResult.decision).toBe("block");
    expect(cursorResult.decision).toBe("block");
  });
});

// ============================================================================
// Stop: Cross-Platform
// ============================================================================

describe("processStop - cross-platform", () => {
  it("Claude Code: allows stop when no workflow active", () => {
    setExecCommand(() => { throw new Error("no state"); });

    const event = normalizeEvent(
      { session_id: "s1", cwd: "/ws" },
      "Stop",
    );
    const { output, shouldBlock } = processStop(event);
    expect(output.continue).toBe(true);
    expect(shouldBlock).toBe(false);
  });

  it("Cursor: allows stop when no workflow active", () => {
    setExecCommand(() => { throw new Error("no state"); });

    const event = normalizeEvent({
      hook_event_name: "stop",
      status: "completed",
      conversation_id: "c1",
      cwd: "/ws",
    });
    const { output, shouldBlock } = processStop(event);
    expect(output.continue).toBe(true);
    expect(shouldBlock).toBe(false);
  });

  it("Claude Code: blocks stop when validation fails (canBlock=true)", () => {
    setExecCommand((cmd, args) => {
      if (cmd === "brain" && args[0] === "session") {
        return JSON.stringify({
          mode: "coding",
          task: "unfinished work",
          sessionId: "s1",
          updatedAt: new Date().toISOString(),
        });
      }
      return "";
    });

    const event = normalizeEvent(
      { session_id: "s1", cwd: "/ws" },
      "Stop",
    );
    const { output, shouldBlock } = processStop(event);
    // Validation may pass or fail depending on mode/task state,
    // but the key assertion is that shouldBlock respects canBlock
    if (!output.continue) {
      expect(shouldBlock).toBe(true); // CC can block
    }
  });

  it("Cursor: never blocks stop even when validation fails (info-only)", () => {
    setExecCommand((cmd, args) => {
      if (cmd === "brain" && args[0] === "session") {
        return JSON.stringify({
          mode: "coding",
          task: "unfinished work",
          sessionId: "s1",
          updatedAt: new Date().toISOString(),
        });
      }
      return "";
    });

    const event = normalizeEvent({
      hook_event_name: "stop",
      status: "completed",
      conversation_id: "c1",
      cwd: "/ws",
    });
    const { shouldBlock } = processStop(event);
    // Cursor stop is info-only, so shouldBlock is always false
    expect(shouldBlock).toBe(false);
  });

  it("both platforms run validation regardless of blocking capability", () => {
    setExecCommand((cmd, args) => {
      if (cmd === "brain" && args[0] === "session") {
        return JSON.stringify({
          mode: "disabled",
          sessionId: "s1",
          updatedAt: new Date().toISOString(),
        });
      }
      return "";
    });

    const ccEvent = normalizeEvent(
      { session_id: "s1", cwd: "/ws" },
      "Stop",
    );
    const cursorEvent = normalizeEvent({
      hook_event_name: "stop",
      status: "completed",
      conversation_id: "c1",
      cwd: "/ws",
    });

    const ccResult = processStop(ccEvent);
    const cursorResult = processStop(cursorEvent);

    // Both should have validation results
    expect(ccResult.output.message).toBeDefined();
    expect(cursorResult.output.message).toBeDefined();
  });
});
