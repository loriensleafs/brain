/**
 * Tests for gate-check.ts
 *
 * Ported from apps/claude-plugin/cmd/hooks/gate_check_test.go (665 LOC).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  isReadOnlyTool,
  checkToolBlocked,
  performGateCheck,
  formatBlockMessage,
  MODE_BLOCKED_TOOLS,
} from "../gate-check.js";
import { setExecCommand, resetExecCommand } from "../exec.js";

// === Tests for isReadOnlyTool ===

describe("isReadOnlyTool", () => {
  const readOnlyTools = ["Read", "Glob", "Grep", "LSP", "WebFetch", "WebSearch"];
  const destructiveTools = ["Edit", "Write", "Bash", "NotebookEdit", "Task", "SomeTool"];

  for (const tool of readOnlyTools) {
    it(`${tool} is read-only`, () => {
      expect(isReadOnlyTool(tool)).toBe(true);
    });
  }

  for (const tool of destructiveTools) {
    it(`${tool} is NOT read-only`, () => {
      expect(isReadOnlyTool(tool)).toBe(false);
    });
  }
});

// === Tests for checkToolBlocked ===

describe("checkToolBlocked", () => {
  // Analysis mode
  it("analysis blocks Edit", () => {
    const result = checkToolBlocked("Edit", "analysis");
    expect(result.allowed).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it("analysis blocks Write", () => {
    expect(checkToolBlocked("Write", "analysis").allowed).toBe(false);
  });

  it("analysis blocks Bash", () => {
    expect(checkToolBlocked("Bash", "analysis").allowed).toBe(false);
  });

  it("analysis blocks NotebookEdit", () => {
    expect(checkToolBlocked("NotebookEdit", "analysis").allowed).toBe(false);
  });

  it("analysis allows Read", () => {
    expect(checkToolBlocked("Read", "analysis").allowed).toBe(true);
  });

  it("analysis allows Grep", () => {
    expect(checkToolBlocked("Grep", "analysis").allowed).toBe(true);
  });

  it("analysis allows Task", () => {
    expect(checkToolBlocked("Task", "analysis").allowed).toBe(true);
  });

  // Planning mode
  it("planning blocks Edit", () => {
    expect(checkToolBlocked("Edit", "planning").allowed).toBe(false);
  });

  it("planning blocks Write", () => {
    expect(checkToolBlocked("Write", "planning").allowed).toBe(false);
  });

  it("planning allows Bash", () => {
    expect(checkToolBlocked("Bash", "planning").allowed).toBe(true);
  });

  // Coding mode
  it("coding allows Edit", () => {
    expect(checkToolBlocked("Edit", "coding").allowed).toBe(true);
  });

  it("coding allows Write", () => {
    expect(checkToolBlocked("Write", "coding").allowed).toBe(true);
  });

  it("coding allows Bash", () => {
    expect(checkToolBlocked("Bash", "coding").allowed).toBe(true);
  });

  // Disabled mode
  it("disabled allows Edit", () => {
    expect(checkToolBlocked("Edit", "disabled").allowed).toBe(true);
  });

  it("disabled allows everything", () => {
    expect(checkToolBlocked("AnyTool", "disabled").allowed).toBe(true);
  });

  // Empty mode
  it("empty mode allows Edit", () => {
    expect(checkToolBlocked("Edit", "").allowed).toBe(true);
  });

  // Unknown mode
  it("unknown mode allows Edit", () => {
    expect(checkToolBlocked("Edit", "unknown-mode").allowed).toBe(true);
  });

  // Tool and mode are preserved in result
  it("preserves tool and mode in result", () => {
    const result = checkToolBlocked("Edit", "analysis");
    expect(result.tool).toBe("Edit");
    expect(result.mode).toBe("analysis");
  });
});

// === Tests for performGateCheck with fail-closed behavior ===

describe("performGateCheck", () => {
  afterEach(() => {
    resetExecCommand();
  });

  it("blocks destructive tools when state unavailable (fail-closed)", () => {
    setExecCommand(() => {
      throw new Error("brain CLI not available");
    });

    const destructiveTools = ["Edit", "Write", "Bash", "NotebookEdit", "Task"];
    for (const tool of destructiveTools) {
      const result = performGateCheck(tool);
      expect(result.allowed).toBe(false);
      expect(result.mode).toBe("unknown");
      expect(result.message).toBeTruthy();
    }
  });

  it("allows read-only tools when state unavailable", () => {
    setExecCommand(() => {
      throw new Error("brain CLI not available");
    });

    const readOnlyTools = ["Read", "Glob", "Grep", "LSP", "WebFetch", "WebSearch"];
    for (const tool of readOnlyTools) {
      const result = performGateCheck(tool);
      expect(result.allowed).toBe(true);
      expect(result.mode).toBe("unknown");
    }
  });

  it("allows all tools in disabled mode", () => {
    setExecCommand(() =>
      JSON.stringify({ sessionId: "test", currentMode: "disabled" }),
    );

    const tools = ["Edit", "Write", "Bash", "Read", "Grep", "NotebookEdit"];
    for (const tool of tools) {
      const result = performGateCheck(tool);
      expect(result.allowed).toBe(true);
      expect(result.mode).toBe("disabled");
    }
  });

  it("blocks destructive tools in analysis mode", () => {
    setExecCommand(() =>
      JSON.stringify({ sessionId: "test", currentMode: "analysis" }),
    );

    expect(performGateCheck("Edit").allowed).toBe(false);
    expect(performGateCheck("Write").allowed).toBe(false);
    expect(performGateCheck("Bash").allowed).toBe(false);

    expect(performGateCheck("Read").allowed).toBe(true);
    expect(performGateCheck("Grep").allowed).toBe(true);
    expect(performGateCheck("Task").allowed).toBe(true);
  });

  it("allows all tools in coding mode", () => {
    setExecCommand(() =>
      JSON.stringify({ sessionId: "test", currentMode: "coding" }),
    );

    const tools = ["Edit", "Write", "Bash", "Read", "Grep", "NotebookEdit"];
    for (const tool of tools) {
      const result = performGateCheck(tool);
      expect(result.allowed).toBe(true);
      expect(result.mode).toBe("coding");
    }
  });
});

// === Tests for formatBlockMessage ===

describe("formatBlockMessage", () => {
  it("includes tool name and mode", () => {
    const msg = formatBlockMessage("Edit", "analysis");
    expect(msg).toContain("Edit");
    expect(msg).toContain("analysis");
    expect(msg).toContain("set_mode");
    expect(msg).toContain("coding");
  });

  it("includes planning mode description", () => {
    const msg = formatBlockMessage("Write", "planning");
    expect(msg).toContain("Write");
    expect(msg).toContain("planning");
    expect(msg).toContain("set_mode");
  });
});

// === Tests for ModeBlockedTools configuration ===

describe("ModeBlockedTools", () => {
  it("analysis mode has correct blocked tools", () => {
    const blocked = MODE_BLOCKED_TOOLS.analysis;
    expect(blocked).toContain("Edit");
    expect(blocked).toContain("Write");
    expect(blocked).toContain("Bash");
    expect(blocked).toContain("NotebookEdit");
    expect(blocked).toHaveLength(4);
  });

  it("planning mode blocks Edit, Write, NotebookEdit but NOT Bash", () => {
    const blocked = MODE_BLOCKED_TOOLS.planning;
    expect(blocked).toContain("Edit");
    expect(blocked).toContain("Write");
    expect(blocked).toContain("NotebookEdit");
    expect(blocked).not.toContain("Bash");
    expect(blocked).toHaveLength(3);
  });

  it("coding mode has no blocked tools", () => {
    expect(MODE_BLOCKED_TOOLS.coding).toHaveLength(0);
  });

  it("disabled mode has no blocked tools", () => {
    expect(MODE_BLOCKED_TOOLS.disabled).toHaveLength(0);
  });
});
