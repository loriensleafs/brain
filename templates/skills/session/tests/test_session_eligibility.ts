/**
 * Tests for session skill test_investigation_eligibility.ts script.
 */

import { describe, test, expect } from "bun:test";
import { fileMatchesAllowlist } from "../scripts/test_investigation_eligibility";

describe("fileMatchesAllowlist", () => {
  test("accepts .agents/sessions/ paths", () => {
    expect(fileMatchesAllowlist(".agents/sessions/2026-01-01-session-1.json")).toBe(true);
  });

  test("accepts .agents/analysis/ paths", () => {
    expect(fileMatchesAllowlist(".agents/analysis/report.md")).toBe(true);
  });

  test("accepts .agents/retrospective/ paths", () => {
    expect(fileMatchesAllowlist(".agents/retrospective/retro.md")).toBe(true);
  });

  test("accepts .agents/security/ paths", () => {
    expect(fileMatchesAllowlist(".agents/security/scan.md")).toBe(true);
  });

  test("accepts .agents/memory/ paths", () => {
    expect(fileMatchesAllowlist(".agents/memory/index.md")).toBe(true);
  });

  test("accepts .agents/architecture/REVIEW- paths", () => {
    expect(fileMatchesAllowlist(".agents/architecture/REVIEW-ADR-034.md")).toBe(true);
  });

  test("accepts .agents/critique/ paths", () => {
    expect(fileMatchesAllowlist(".agents/critique/plan.md")).toBe(true);
  });

  test("rejects code files", () => {
    expect(fileMatchesAllowlist("scripts/main.py")).toBe(false);
  });

  test("rejects src files", () => {
    expect(fileMatchesAllowlist("src/MyClass.cs")).toBe(false);
  });

  test("rejects workflow files", () => {
    expect(fileMatchesAllowlist(".github/workflows/ci.yml")).toBe(false);
  });

  test("normalizes backslashes", () => {
    expect(fileMatchesAllowlist(".agents\\sessions\\log.json")).toBe(true);
  });
});
