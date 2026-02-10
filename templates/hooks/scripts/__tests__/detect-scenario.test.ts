/**
 * Tests for detect-scenario.ts
 *
 * Ported from packages/validation/internal/detect_scenario_test.go
 */
import { describe, expect, it } from "vitest";
import { detectScenario } from "../detect-scenario.js";

describe("detectScenario", () => {
  it("detects BUG scenario", () => {
    const result = detectScenario("There is a bug in the login flow");
    expect(result.detected).toBe(true);
    expect(result.scenario).toBe("BUG");
    expect(result.keywords).toContain("bug");
    expect(result.directory).toBe("bugs");
    expect(result.noteType).toBe("bug");
  });

  it("detects FEATURE scenario", () => {
    const result = detectScenario("implement the OAuth authentication");
    expect(result.detected).toBe(true);
    expect(result.scenario).toBe("FEATURE");
    expect(result.keywords).toContain("implement");
  });

  it("detects SPEC scenario", () => {
    const result = detectScenario("define the API specification");
    expect(result.detected).toBe(true);
    expect(result.scenario).toBe("SPEC");
    expect(result.keywords).toContain("spec");
  });

  it("detects ANALYSIS scenario", () => {
    const result = detectScenario("analyze the performance bottleneck");
    expect(result.detected).toBe(true);
    expect(result.scenario).toBe("ANALYSIS");
    expect(result.keywords).toContain("analyze");
  });

  it("detects RESEARCH scenario", () => {
    const result = detectScenario("research the best framework");
    expect(result.detected).toBe(true);
    expect(result.scenario).toBe("RESEARCH");
    expect(result.keywords).toContain("research");
  });

  it("detects DECISION scenario", () => {
    const result = detectScenario("should i use React vs Vue");
    expect(result.detected).toBe(true);
    expect(result.scenario).toBe("DECISION");
  });

  it("detects TESTING scenario", () => {
    const result = detectScenario("test the integration endpoints");
    expect(result.detected).toBe(true);
    expect(result.scenario).toBe("TESTING");
    expect(result.keywords).toContain("test");
  });

  it("returns not detected for unrelated prompt", () => {
    const result = detectScenario("hello world");
    expect(result.detected).toBe(false);
    expect(result.scenario).toBe("");
    expect(result.keywords).toEqual([]);
  });

  it("is case insensitive", () => {
    const result = detectScenario("There is a BUG in the system");
    expect(result.detected).toBe(true);
    expect(result.scenario).toBe("BUG");
  });

  it("matches BUG before TESTING (priority order)", () => {
    // "fix" matches BUG, "test" matches TESTING, but BUG has higher priority
    const result = detectScenario("fix the broken test");
    expect(result.detected).toBe(true);
    expect(result.scenario).toBe("BUG");
  });

  it("detects multiple keywords", () => {
    const result = detectScenario("debug the crash that causes errors");
    expect(result.detected).toBe(true);
    expect(result.scenario).toBe("BUG");
    // Should match multiple keywords: debug, crash, error
    expect(result.keywords.length).toBeGreaterThanOrEqual(2);
  });
});
