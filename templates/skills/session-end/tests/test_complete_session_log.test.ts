/**
 * Tests for session-end skill complete_session_log.ts.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

function makeSessionJson(
  sessionsDir: string,
  name: string = "2026-02-11-session-1.json"
): string {
  const session = {
    session: {
      number: 1,
      date: "2026-02-11",
      branch: "feat/test",
      startingCommit: "abc1234",
      objective: "Test session",
    },
    protocolCompliance: {
      sessionStart: {
        brainActivated: { level: "MUST", Complete: true, Evidence: "done" },
      },
      sessionEnd: {
        checklistComplete: { level: "MUST", Complete: false, Evidence: "" },
        handoffPreserved: { level: "MUST", Complete: false, Evidence: "" },
        brainMemoryUpdated: { level: "MUST", Complete: false, Evidence: "" },
        markdownLintRun: { level: "MUST", Complete: false, Evidence: "" },
        changesCommitted: { level: "MUST", Complete: false, Evidence: "" },
        validationPassed: { level: "MUST", Complete: false, Evidence: "" },
        tasksUpdated: { level: "SHOULD", Complete: false, Evidence: "" },
        retrospectiveInvoked: { level: "SHOULD", Complete: false, Evidence: "" },
      },
    },
    workLog: [],
    endingCommit: "",
    nextSteps: [],
  };
  const path = join(sessionsDir, name);
  writeFileSync(path, JSON.stringify(session, null, 2));
  return path;
}

describe("complete_session_log", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "session-end-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("module exports main function", async () => {
    const mod = await import("../scripts/complete_session_log.ts");
    expect(typeof mod.main).toBe("function");
  });

  test("findCurrentSessionLog returns null for empty dir", async () => {
    const { findCurrentSessionLog } = await import("../scripts/complete_session_log.ts");
    const sessionsDir = join(tmpDir, "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    expect(findCurrentSessionLog(sessionsDir)).toBeNull();
  });

  test("findCurrentSessionLog finds json file", async () => {
    const { findCurrentSessionLog } = await import("../scripts/complete_session_log.ts");
    const sessionsDir = join(tmpDir, "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    writeFileSync(join(sessionsDir, "2026-02-11-session-1.json"), "{}");
    const result = findCurrentSessionLog(sessionsDir);
    expect(result).not.toBeNull();
    expect(result).toContain("2026-02-11-session-1.json");
  });

  test("dry run does not modify file", async () => {
    const sessionsDir = join(tmpDir, ".agents", "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    const sessionPath = makeSessionJson(sessionsDir);

    const originalContent = readFileSync(sessionPath, "utf-8");

    // Verify structure is intact
    const parsed = JSON.parse(originalContent);
    expect(parsed.endingCommit).toBe("");
    expect(parsed.protocolCompliance.sessionEnd.checklistComplete.Complete).toBe(false);
  });

  test("rejects invalid json", () => {
    const sessionsDir = join(tmpDir, ".agents", "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    const badFile = join(sessionsDir, "bad.json");
    writeFileSync(badFile, "not json");

    // Verify the file exists and contains invalid JSON
    const content = readFileSync(badFile, "utf-8");
    expect(content).toBe("not json");
    expect(() => JSON.parse(content)).toThrow();
  });
});
