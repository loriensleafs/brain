/**
 * Golden file snapshot tests for hook normalization.
 *
 * Captures the exact normalized output for representative event payloads
 * from both platforms. Vitest inline snapshots serve as golden files --
 * any change to normalization logic that alters output will fail CI
 * until snapshots are explicitly updated.
 *
 * @see TASK-020-add-ci-validation-and-golden-files
 */
import { describe, expect, it, afterEach } from "vitest";
import { normalizeEvent, getBlockingSemantics } from "../normalize.js";
import { processUserPrompt } from "../user-prompt.js";
import { processPreToolUse } from "../pre-tool-use.js";
import { processStop } from "../stop.js";
import { setExecCommand, resetExecCommand } from "../exec.js";

afterEach(() => {
  resetExecCommand();
});

// ============================================================================
// Golden: Claude Code Normalization
// ============================================================================

describe("golden: Claude Code normalization", () => {
  it("CC PreToolUse Bash → normalized snapshot", () => {
    const result = normalizeEvent(
      {
        tool_name: "Bash",
        tool_input: { command: "git status" },
        session_id: "cc-session-golden-1",
        cwd: "/Users/dev/brain",
      },
      "PreToolUse",
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "event": "before-shell",
        "payload": {
          "command": "git status",
          "tool_input": {
            "command": "git status",
          },
          "tool_name": "Bash",
        },
        "platform": "claude-code",
        "sessionId": "cc-session-golden-1",
        "workspaceRoot": "/Users/dev/brain",
      }
    `);
  });

  it("CC PreToolUse MCP → normalized snapshot", () => {
    const result = normalizeEvent(
      {
        tool_name: "mcp__plugin____brain__search",
        tool_input: { query: "hook normalization" },
        session_id: "cc-session-golden-2",
        cwd: "/Users/dev/brain",
      },
      "PreToolUse",
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "event": "before-mcp",
        "payload": {
          "tool_input": {
            "query": "hook normalization",
          },
          "tool_name": "mcp__plugin____brain__search",
        },
        "platform": "claude-code",
        "sessionId": "cc-session-golden-2",
        "workspaceRoot": "/Users/dev/brain",
      }
    `);
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
    expect(result).toMatchInlineSnapshot(`
      {
        "event": "prompt-submit",
        "payload": {
          "prompt": "implement OAuth authentication",
        },
        "platform": "claude-code",
        "sessionId": "cc-session-golden-3",
        "workspaceRoot": "/Users/dev/brain",
      }
    `);
  });

  it("CC Stop → normalized snapshot", () => {
    const result = normalizeEvent(
      { session_id: "cc-session-golden-4", cwd: "/Users/dev/brain" },
      "Stop",
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "event": "stop",
        "payload": {},
        "platform": "claude-code",
        "sessionId": "cc-session-golden-4",
        "workspaceRoot": "/Users/dev/brain",
      }
    `);
  });

  it("CC SessionStart → normalized snapshot", () => {
    const result = normalizeEvent(
      { session_id: "cc-session-golden-5", cwd: "/Users/dev/brain" },
      "SessionStart",
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "event": "session-start",
        "payload": {
          "cwd": "/Users/dev/brain",
        },
        "platform": "claude-code",
        "sessionId": "cc-session-golden-5",
        "workspaceRoot": "/Users/dev/brain",
      }
    `);
  });
});

// ============================================================================
// Golden: Cursor Normalization
// ============================================================================

describe("golden: Cursor normalization", () => {
  it("Cursor beforeShellExecution → normalized snapshot", () => {
    const result = normalizeEvent({
      hook_event_name: "beforeShellExecution",
      command: "git status",
      cwd: "/Users/dev/brain",
      conversation_id: "cursor-conv-golden-1",
      generation_id: "gen-001",
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "event": "before-shell",
        "payload": {
          "command": "git status",
        },
        "platform": "cursor",
        "sessionId": "cursor-conv-golden-1",
        "workspaceRoot": "/Users/dev/brain",
      }
    `);
  });

  it("Cursor beforeMCPExecution → normalized snapshot", () => {
    const result = normalizeEvent({
      hook_event_name: "beforeMCPExecution",
      tool_name: "read_note",
      tool_input: { identifier: "ADR-020" },
      server: "brain",
      cwd: "/Users/dev/brain",
      conversation_id: "cursor-conv-golden-2",
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "event": "before-mcp",
        "payload": {
          "server": "brain",
          "tool_input": {
            "identifier": "ADR-020",
          },
          "tool_name": "read_note",
        },
        "platform": "cursor",
        "sessionId": "cursor-conv-golden-2",
        "workspaceRoot": "/Users/dev/brain",
      }
    `);
  });

  it("Cursor beforeSubmitPrompt → normalized snapshot", () => {
    const result = normalizeEvent({
      hook_event_name: "beforeSubmitPrompt",
      prompt: "implement OAuth authentication",
      conversation_id: "cursor-conv-golden-3",
      cwd: "/Users/dev/brain",
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "event": "prompt-submit",
        "payload": {
          "prompt": "implement OAuth authentication",
        },
        "platform": "cursor",
        "sessionId": "cursor-conv-golden-3",
        "workspaceRoot": "/Users/dev/brain",
      }
    `);
  });

  it("Cursor stop → normalized snapshot", () => {
    const result = normalizeEvent({
      hook_event_name: "stop",
      status: "completed",
      conversation_id: "cursor-conv-golden-4",
      cwd: "/Users/dev/brain",
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "event": "stop",
        "payload": {
          "status": "completed",
        },
        "platform": "cursor",
        "sessionId": "cursor-conv-golden-4",
        "workspaceRoot": "/Users/dev/brain",
      }
    `);
  });

  it("Cursor beforeReadFile → normalized snapshot", () => {
    const result = normalizeEvent({
      hook_event_name: "beforeReadFile",
      file_path: "/Users/dev/brain/.env",
      cwd: "/Users/dev/brain",
      conversation_id: "cursor-conv-golden-5",
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "event": "before-read-file",
        "payload": {
          "file_path": "/Users/dev/brain/.env",
        },
        "platform": "cursor",
        "sessionId": "cursor-conv-golden-5",
        "workspaceRoot": "/Users/dev/brain",
      }
    `);
  });

  it("Cursor afterFileEdit → normalized snapshot", () => {
    const result = normalizeEvent({
      hook_event_name: "afterFileEdit",
      edits: [
        { old_string: "const x = 1", new_string: "const x = 2" },
      ],
      cwd: "/Users/dev/brain",
      conversation_id: "cursor-conv-golden-6",
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "event": "after-edit",
        "payload": {
          "edits": [
            {
              "new_string": "const x = 2",
              "old_string": "const x = 1",
            },
          ],
        },
        "platform": "cursor",
        "sessionId": "cursor-conv-golden-6",
        "workspaceRoot": "/Users/dev/brain",
      }
    `);
  });
});

// ============================================================================
// Golden: Blocking Semantics Matrix
// ============================================================================

describe("golden: blocking semantics matrix", () => {
  const events = [
    "prompt-submit", "before-shell", "before-mcp",
    "before-read-file", "after-edit", "stop",
    "session-start",
  ] as const;

  const platforms = ["claude-code", "cursor"] as const;

  it("full blocking matrix snapshot", () => {
    const matrix: Record<string, Record<string, { canBlock: boolean; infoOnly: boolean }>> = {};
    for (const event of events) {
      matrix[event] = {};
      for (const platform of platforms) {
        matrix[event][platform] = getBlockingSemantics(event, platform);
      }
    }
    expect(matrix).toMatchInlineSnapshot(`
      {
        "after-edit": {
          "claude-code": {
            "canBlock": false,
            "infoOnly": true,
          },
          "cursor": {
            "canBlock": false,
            "infoOnly": true,
          },
        },
        "before-mcp": {
          "claude-code": {
            "canBlock": true,
            "infoOnly": false,
          },
          "cursor": {
            "canBlock": true,
            "infoOnly": false,
          },
        },
        "before-read-file": {
          "claude-code": {
            "canBlock": false,
            "infoOnly": true,
          },
          "cursor": {
            "canBlock": true,
            "infoOnly": false,
          },
        },
        "before-shell": {
          "claude-code": {
            "canBlock": true,
            "infoOnly": false,
          },
          "cursor": {
            "canBlock": true,
            "infoOnly": false,
          },
        },
        "prompt-submit": {
          "claude-code": {
            "canBlock": true,
            "infoOnly": false,
          },
          "cursor": {
            "canBlock": false,
            "infoOnly": true,
          },
        },
        "session-start": {
          "claude-code": {
            "canBlock": false,
            "infoOnly": true,
          },
          "cursor": {
            "canBlock": false,
            "infoOnly": true,
          },
        },
        "stop": {
          "claude-code": {
            "canBlock": true,
            "infoOnly": false,
          },
          "cursor": {
            "canBlock": false,
            "infoOnly": true,
          },
        },
      }
    `);
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
    expect(result).toMatchInlineSnapshot(`
      {
        "continue": true,
        "scenario": {
          "detected": true,
          "recommended": "Create bug note in bugs/ before proceeding",
          "scenario": "BUG",
          "triggers": [
            "broken",
            "fix",
          ],
        },
      }
    `);
  });

  it("no match snapshot", () => {
    const event = normalizeEvent(
      { prompt: "hello world", session_id: "s", cwd: "/ws" },
      "UserPromptSubmit",
    );
    const result = processUserPrompt(event);
    expect(result).toMatchInlineSnapshot(`
      {
        "continue": true,
      }
    `);
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
    expect(result.message).toContain("[BLOCKED]");
    expect(result.message).toContain("analysis mode");
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
    expect(result).toMatchInlineSnapshot(`
      {
        "decision": "allow",
        "mode": "coding",
      }
    `);
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
    expect(output).toMatchInlineSnapshot(`
      {
        "continue": true,
        "message": "No active workflow - session can end",
      }
    `);
  });
});
