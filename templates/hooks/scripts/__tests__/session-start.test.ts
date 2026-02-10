/**
 * Tests for session-start.ts
 *
 * Ported from apps/claude-plugin/cmd/hooks/session_start_test.go (1798 LOC).
 * Covers the most critical test scenarios from FEATURE-001.
 */
import { describe, expect, it, afterEach } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import {
  formatContextMarkdown,
  formatSessionInstructions,
  formatActiveSessionContext,
  noProjectInstructions,
  parseOpenSessionsFromMarkdown,
  buildSessionOutput,
} from "../session-start.js";
import { setExecCommand, resetExecCommand } from "../exec.js";
import { setGetEnv, setBrainConfigPath } from "../project-resolve.js";
import type {
  SessionStartOutput,
  ActiveSession,
  OpenSession,
} from "../types.js";

afterEach(() => {
  resetExecCommand();
  setGetEnv((key) => process.env[key] ?? "");
  setBrainConfigPath(() => "");
});

// === Tests for formatContextMarkdown ===

describe("formatContextMarkdown", () => {
  it("returns instructions when noProject flag set", () => {
    const output: SessionStartOutput = {
      success: true,
      bootstrapInfo: { noProject: true },
    };
    const result = formatContextMarkdown(output);
    expect(result).toContain("No active project is set");
    expect(result).toContain("AskUserQuestion");
    expect(result).toContain("active_project");
    expect(result).toContain("bootstrap_context");
    expect(result).toContain("list_projects");
  });

  it("returns error message on failure", () => {
    const output: SessionStartOutput = {
      success: false,
      error: "Something went wrong",
    };
    const result = formatContextMarkdown(output);
    expect(result).toContain("**Error:** Something went wrong");
  });

  it("includes git context when available", () => {
    const output: SessionStartOutput = {
      success: true,
      project: "test-project",
      gitContext: { branch: "main", status: "clean" },
      bootstrapInfo: { markdown: "" },
      openSessions: [],
    };
    const result = formatContextMarkdown(output);
    expect(result).toContain("**Branch:** main");
    expect(result).toContain("**Status:** clean");
  });

  it("includes active session context when present (FEATURE-001 M6)", () => {
    const output: SessionStartOutput = {
      success: true,
      project: "test-project",
      gitContext: { branch: "main", status: "clean" },
      bootstrapInfo: { markdown: "" },
      activeSession: {
        sessionId: "SESSION-2026-02-04_01-test",
        status: "IN_PROGRESS",
        path: "sessions/SESSION-2026-02-04_01-test.md",
        date: "2026-02-04",
        isValid: true,
        checks: [],
      },
      openSessions: [
        {
          sessionId: "SESSION-2026-02-03_01-paused",
          status: "PAUSED",
          date: "2026-02-03",
          permalink: "",
        },
      ],
    };
    const result = formatContextMarkdown(output);
    expect(result).toContain("### Active Session");
    expect(result).toContain("SESSION-2026-02-04_01-test");
    // Per FEATURE-001: should NOT contain open sessions when active session exists
    expect(result).not.toContain("### Open Sessions Detected");
    expect(result).not.toContain("Use the AskUserQuestion tool");
  });

  it("shows open sessions when no active session (FEATURE-001 M6)", () => {
    const output: SessionStartOutput = {
      success: true,
      project: "test-project",
      gitContext: { branch: "main", status: "clean" },
      bootstrapInfo: { markdown: "" },
      openSessions: [
        {
          sessionId: "SESSION-2026-02-04_01-feature",
          status: "IN_PROGRESS",
          date: "2026-02-04",
          branch: "feat/test",
          permalink: "",
        },
      ],
    };
    const result = formatContextMarkdown(output);
    expect(result).toContain("### Open Sessions Detected");
    expect(result).toContain("Found 1 session(s)");
    expect(result).toContain("AskUserQuestion");
    expect(result).toContain("MCP `session` tool");
  });

  it("shows new session instructions when no sessions (FEATURE-001 M6)", () => {
    const output: SessionStartOutput = {
      success: true,
      project: "test-project",
      gitContext: { branch: "main", status: "clean" },
      bootstrapInfo: { markdown: "" },
      openSessions: [],
    };
    const result = formatContextMarkdown(output);
    expect(result).toContain("### No Active Session");
    expect(result).toContain("AskUserQuestion");
    expect(result).toContain("operation=`create`");
    expect(result).not.toContain("operation=`resume`");
  });

  it("includes bootstrap warning", () => {
    const output: SessionStartOutput = {
      success: true,
      project: "test-project",
      bootstrapInfo: {
        warning: "Could not get bootstrap context: connection refused",
      },
      openSessions: [],
    };
    const result = formatContextMarkdown(output);
    expect(result).toContain("**Warning:**");
    expect(result).toContain("Could not get bootstrap context");
  });

  it("includes workflow state", () => {
    const output: SessionStartOutput = {
      success: true,
      project: "test-project",
      bootstrapInfo: { markdown: "" },
      workflowState: {
        mode: "analysis",
        task: "Research API",
        sessionId: "session-123",
      },
      openSessions: [],
    };
    const result = formatContextMarkdown(output);
    expect(result).toContain("### Workflow State");
    expect(result).toContain("**Mode:** analysis");
    expect(result).toContain("**Task:** Research API");
    expect(result).toContain("**Session:** session-123");
  });
});

// === Tests for formatSessionInstructions ===

describe("formatSessionInstructions", () => {
  it("lists open sessions with AskUserQuestion", () => {
    const sessions: OpenSession[] = [
      {
        sessionId: "SESSION-2026-02-04_01-feature-work",
        status: "IN_PROGRESS",
        date: "2026-02-04",
        branch: "feat/session-resume",
        topic: "feature work",
        permalink: "",
      },
      {
        sessionId: "SESSION-2026-02-03_02-bug-fix",
        status: "PAUSED",
        date: "2026-02-03",
        topic: "bug fix",
        permalink: "",
      },
    ];
    const result = formatSessionInstructions(sessions);
    expect(result).toContain("DO THE FOLLOWING IMMEDIATELY");
    expect(result).toContain("### Open Sessions Detected");
    expect(result).toContain("Found 2 session(s)");
    expect(result).toContain("SESSION-2026-02-04_01-feature-work - feature work");
    expect(result).toContain("AskUserQuestion");
    expect(result).toContain("operation=`resume`");
    expect(result).toContain("operation=`create`");
  });

  it("shows new session prompt when no sessions", () => {
    const result = formatSessionInstructions([]);
    expect(result).toContain("### No Active Session");
    expect(result).toContain("AskUserQuestion");
    expect(result).toContain("session topic");
    expect(result).toContain("operation=`create`");
    expect(result).not.toContain("operation=`resume`");
  });
});

// === Tests for formatActiveSessionContext ===

describe("formatActiveSessionContext", () => {
  it("shows full active session info", () => {
    const session: ActiveSession = {
      sessionId: "SESSION-2026-02-04_01-test",
      status: "IN_PROGRESS",
      path: "sessions/SESSION-2026-02-04_01-test.md",
      mode: "coding",
      task: "Implement feature X",
      branch: "feat/test",
      date: "2026-02-04",
      topic: "test feature",
      isValid: true,
      checks: [{ name: "brain_init", passed: true }],
    };
    const result = formatActiveSessionContext(session);
    expect(result).toContain("### Active Session");
    expect(result).toContain("SESSION-2026-02-04_01-test - test feature");
    expect(result).toContain("**Status**: IN_PROGRESS");
    expect(result).toContain("**Date**: 2026-02-04");
    expect(result).toContain("**Branch**: feat/test");
    expect(result).toContain("**Mode**: coding");
    expect(result).toContain("**Current Task**: Implement feature X");
    expect(result).toContain("All checks passed");
  });

  it("shows failed validation checks", () => {
    const session: ActiveSession = {
      sessionId: "SESSION-2026-02-04_01-test",
      status: "IN_PROGRESS",
      path: "",
      date: "2026-02-04",
      isValid: false,
      checks: [
        { name: "brain_init", passed: true },
        { name: "git_branch", passed: false },
      ],
    };
    const result = formatActiveSessionContext(session);
    expect(result).toContain("Some checks failed");
    expect(result).toContain("brain_init: [PASS]");
    expect(result).toContain("git_branch: [FAIL]");
  });
});

// === Tests for noProjectInstructions ===

describe("noProjectInstructions", () => {
  it("contains required elements", () => {
    const instructions = noProjectInstructions();
    expect(instructions).toContain("No active project is set");
    expect(instructions).toContain("AskUserQuestion");
    expect(instructions).toContain("active_project");
    expect(instructions).toContain("bootstrap_context");
    expect(instructions).toContain("list_projects");
  });
});

// === Tests for parseOpenSessionsFromMarkdown (legacy fallback) ===

describe("parseOpenSessionsFromMarkdown", () => {
  it("parses Session State format", () => {
    const markdown = `## Memory Context [v7] (Full)

**Project:** test-project

### Session State

**Active Session**: None
**Open Sessions**: 2 sessions available
- SESSION-2026-02-04_01-feature - feature work (IN_PROGRESS) (branch: \`feat/test\`)
- SESSION-2026-02-03_02-bugfix (PAUSED)

### Active Features

- Feature-Auth`;

    const sessions = parseOpenSessionsFromMarkdown(markdown);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].sessionId).toBe("SESSION-2026-02-04_01-feature");
    expect(sessions[0].status).toBe("IN_PROGRESS");
    expect(sessions[0].date).toBe("2026-02-04");
    expect(sessions[0].branch).toBe("feat/test");
    expect(sessions[1].sessionId).toBe("SESSION-2026-02-03_02-bugfix");
    expect(sessions[1].status).toBe("PAUSED");
  });

  it("returns empty for no session section", () => {
    const markdown = `## Memory Context
### Active Features
- Feature-Auth`;
    expect(parseOpenSessionsFromMarkdown(markdown)).toHaveLength(0);
  });

  it("normalizes lowercase status to uppercase", () => {
    const markdown = `### Session State
- SESSION-2026-02-04_01-test (in_progress)
- SESSION-2026-02-03_02-other (paused)`;
    const sessions = parseOpenSessionsFromMarkdown(markdown);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].status).toBe("IN_PROGRESS");
    expect(sessions[1].status).toBe("PAUSED");
  });
});

// === Tests for buildSessionOutput ===

describe("buildSessionOutput", () => {
  it("returns noProject flag when project identification fails", async () => {
    setGetEnv(() => "");
    const configPath = join(
      tmpdir(),
      `brain-test-empty-${Date.now()}.json`,
    );
    await Bun.write(
      configPath,
      JSON.stringify({ version: "2.0.0", projects: {} }),
    );
    setBrainConfigPath(() => configPath);

    const result = await buildSessionOutput("");
    expect(result.success).toBe(true);
    expect(result.bootstrapInfo).toBeTruthy();
    expect(result.bootstrapInfo!.noProject).toBe(true);
  });

  it("returns success with project from env var", async () => {
    setGetEnv((key) =>
      key === "BRAIN_PROJECT" ? "test-project" : "",
    );
    setExecCommand((name, args) => {
      if (name === "brain" && args[0] === "bootstrap")
        return "## Memory Context\n**Project:** test-project";
      if (name === "brain" && args[0] === "session")
        return '{"mode":"coding"}';
      if (name === "brain" && args[0] === "projects") return "";
      if (name === "git") {
        if (args[0] === "branch") return "main\n";
        if (args[0] === "log") return "abc123 Initial commit\n";
        if (args[0] === "status") return "";
      }
      return "";
    });

    const result = await buildSessionOutput("");
    expect(result.success).toBe(true);
    expect(result.project).toBe("test-project");
    expect(result.gitContext).toBeTruthy();
    expect(result.workflowState).toBeTruthy();
  });
});
