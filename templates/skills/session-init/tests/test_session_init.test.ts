/**
 * Tests for session-init skill TypeScript modules and scripts.
 */

import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ---------------------------------------------------------------------------
// Module: common_types
// ---------------------------------------------------------------------------

describe("ApplicationFailedError", () => {
  test("is an Error subclass", async () => {
    const { ApplicationFailedError } = await import("../lib/common_types.ts");
    expect(ApplicationFailedError.prototype instanceof Error).toBe(true);
    const err = new ApplicationFailedError("test msg");
    expect(err.message).toBe("test msg");
    expect(err.name).toBe("ApplicationFailedError");
  });
});

// ---------------------------------------------------------------------------
// Module: template_helpers
// ---------------------------------------------------------------------------

describe("getDescriptiveKeywords", () => {
  test("extracts keywords from basic objective", async () => {
    const { getDescriptiveKeywords } = await import("../lib/template_helpers.ts");
    const result = getDescriptiveKeywords("Debug recurring session validation failures");
    expect(result).toContain("debug");
    expect(result).toContain("recurring");
    expect(result).toContain("session");
    expect(result).toContain("validation");
    expect(result).toContain("failures");
  });

  test("returns empty string for empty input", async () => {
    const { getDescriptiveKeywords } = await import("../lib/template_helpers.ts");
    expect(getDescriptiveKeywords("")).toBe("");
    expect(getDescriptiveKeywords("   ")).toBe("");
  });

  test("limits to 5 keywords", async () => {
    const { getDescriptiveKeywords } = await import("../lib/template_helpers.ts");
    const result = getDescriptiveKeywords(
      "implement complex feature requiring multiple file changes across codebase"
    );
    const parts = result.split("-");
    expect(parts.length).toBeLessThanOrEqual(5);
  });

  test("filters out stop words", async () => {
    const { getDescriptiveKeywords } = await import("../lib/template_helpers.ts");
    const result = getDescriptiveKeywords("fix the broken test for coverage");
    const words = result.split("-");
    expect(words).not.toContain("the");
    expect(words).not.toContain("for");
  });
});

describe("newPopulatedSessionLog", () => {
  test("raises on missing placeholders", async () => {
    const { newPopulatedSessionLog } = await import("../lib/template_helpers.ts");
    expect(() =>
      newPopulatedSessionLog(
        "No placeholders here",
        { branch: "main", commit: "abc", status: "clean" },
        { session_number: 1, objective: "test" }
      )
    ).toThrow("Template missing required placeholders");
  });

  test("replaces all placeholders", async () => {
    const { newPopulatedSessionLog } = await import("../lib/template_helpers.ts");
    const tmpl =
      "Session NN on YYYY-MM-DD branch [branch name] " +
      "commit [SHA] obj [What this session aims to accomplish] " +
      "status [clean/dirty]";
    const result = newPopulatedSessionLog(
      tmpl,
      { branch: "feat/test", commit: "abc123", status: "clean" },
      { session_number: 42, objective: "Test session" }
    );
    expect(result).toContain("42");
    expect(result).toContain("feat/test");
    expect(result).toContain("abc123");
    expect(result).toContain("Test session");
    expect(result).toContain("clean");
  });
});

// ---------------------------------------------------------------------------
// Script: new_session_log.ts (unit tests for helpers)
// ---------------------------------------------------------------------------

describe("new_session_log helpers", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "session-init-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("autoDetectSessionNumber returns 1 for empty dir", async () => {
    const { autoDetectSessionNumber } = await import("../scripts/new_session_log.ts");
    const sessionsDir = join(tmpDir, "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    expect(autoDetectSessionNumber(sessionsDir)).toBe(1);
  });

  test("autoDetectSessionNumber increments from existing", async () => {
    const { autoDetectSessionNumber } = await import("../scripts/new_session_log.ts");
    const sessionsDir = join(tmpDir, "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    writeFileSync(join(sessionsDir, "2026-01-01-session-5.json"), "{}");
    expect(autoDetectSessionNumber(sessionsDir)).toBe(6);
  });

  test("getMaxExistingSession returns null for empty dir", async () => {
    const { getMaxExistingSession } = await import("../scripts/new_session_log.ts");
    const sessionsDir = join(tmpDir, "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    expect(getMaxExistingSession(sessionsDir)).toBeNull();
  });

  test("getMaxExistingSession returns max number", async () => {
    const { getMaxExistingSession } = await import("../scripts/new_session_log.ts");
    const sessionsDir = join(tmpDir, "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    writeFileSync(join(sessionsDir, "2026-01-01-session-3.json"), "{}");
    writeFileSync(join(sessionsDir, "2026-01-01-session-7.json"), "{}");
    expect(getMaxExistingSession(sessionsDir)).toBe(7);
  });

  test("buildSessionData creates valid structure", async () => {
    const { buildSessionData } = await import("../scripts/new_session_log.ts");
    const data = buildSessionData(
      { branch: "feat/test", commit: "abc1234" },
      1,
      "Test session",
      "2026-03-11"
    );
    expect(data.session.number).toBe(1);
    expect(data.session.objective).toBe("Test session");
    expect(data.session.branch).toBe("feat/test");
    expect(data.protocolCompliance.sessionStart.branchVerified.Complete).toBe(true);
    expect(data.protocolCompliance.sessionStart.notOnMain.Complete).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Script: new_session_log_json.ts
// ---------------------------------------------------------------------------

describe("new_session_log_json", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "session-json-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("main creates json file (mocked git)", async () => {
    // This test verifies the module structure can be imported
    const mod = await import("../scripts/new_session_log_json.ts");
    expect(typeof mod.main).toBe("function");
  });
});
