/**
 * Tests for verdict aggregation logic.
 */

import { describe, expect, it } from "bun:test";
import { mergeVerdicts, canProceed, type FinalVerdict } from "../verdicts";
import type { AgentVerdict, Verdict } from "../../agents";

/**
 * Helper to create an AgentVerdict.
 */
function makeVerdict(
  agent: string,
  verdict: Verdict,
  details?: string
): AgentVerdict {
  return { agent, verdict, details };
}

describe("mergeVerdicts", () => {
  describe("blocking verdicts", () => {
    it("returns CRITICAL_FAIL when any agent returns CRITICAL_FAIL", () => {
      const verdicts: AgentVerdict[] = [
        makeVerdict("qa", "PASS"),
        makeVerdict("analyst", "CRITICAL_FAIL", "Test coverage below threshold"),
        makeVerdict("architect", "PASS"),
        makeVerdict("roadmap", "PASS"),
      ];

      const result = mergeVerdicts(verdicts);

      expect(result.verdict).toBe("CRITICAL_FAIL");
      expect(result.isBlocking).toBe(true);
      expect(result.blockingAgents).toEqual(["analyst"]);
      expect(result.reason).toContain("analyst");
      expect(result.reason).toContain("CRITICAL_FAIL");
    });

    it("returns REJECTED when any agent returns REJECTED (no CRITICAL_FAIL)", () => {
      const verdicts: AgentVerdict[] = [
        makeVerdict("qa", "PASS"),
        makeVerdict("analyst", "REJECTED", "Requirements not met"),
        makeVerdict("architect", "WARN"),
        makeVerdict("roadmap", "PASS"),
      ];

      const result = mergeVerdicts(verdicts);

      expect(result.verdict).toBe("REJECTED");
      expect(result.isBlocking).toBe(true);
      expect(result.blockingAgents).toEqual(["analyst"]);
    });

    it("returns FAIL when any agent returns FAIL (no higher priority blocking)", () => {
      const verdicts: AgentVerdict[] = [
        makeVerdict("qa", "FAIL", "Tests failing"),
        makeVerdict("analyst", "PASS"),
        makeVerdict("architect", "PASS"),
        makeVerdict("roadmap", "PASS"),
      ];

      const result = mergeVerdicts(verdicts);

      expect(result.verdict).toBe("FAIL");
      expect(result.isBlocking).toBe(true);
      expect(result.blockingAgents).toEqual(["qa"]);
      expect(result.reason).toContain("Tests failing");
    });

    it("returns NEEDS_REVIEW when any agent returns NEEDS_REVIEW (no higher priority)", () => {
      const verdicts: AgentVerdict[] = [
        makeVerdict("qa", "PASS"),
        makeVerdict("analyst", "PASS"),
        makeVerdict("architect", "NEEDS_REVIEW", "Complex changes require review"),
        makeVerdict("roadmap", "PASS"),
      ];

      const result = mergeVerdicts(verdicts);

      expect(result.verdict).toBe("NEEDS_REVIEW");
      expect(result.isBlocking).toBe(true);
      expect(result.blockingAgents).toEqual(["architect"]);
    });

    it("prioritizes CRITICAL_FAIL over other blocking verdicts", () => {
      const verdicts: AgentVerdict[] = [
        makeVerdict("qa", "FAIL"),
        makeVerdict("analyst", "CRITICAL_FAIL"),
        makeVerdict("architect", "REJECTED"),
        makeVerdict("roadmap", "NEEDS_REVIEW"),
      ];

      const result = mergeVerdicts(verdicts);

      expect(result.verdict).toBe("CRITICAL_FAIL");
      expect(result.blockingAgents).toHaveLength(4);
    });

    it("includes all blocking agents in reason when multiple block", () => {
      const verdicts: AgentVerdict[] = [
        makeVerdict("qa", "FAIL"),
        makeVerdict("analyst", "FAIL"),
        makeVerdict("architect", "PASS"),
        makeVerdict("roadmap", "PASS"),
      ];

      const result = mergeVerdicts(verdicts);

      expect(result.verdict).toBe("FAIL");
      expect(result.blockingAgents).toEqual(["qa", "analyst"]);
      expect(result.reason).toContain("2 agents");
      expect(result.reason).toContain("qa");
      expect(result.reason).toContain("analyst");
    });
  });

  describe("warning verdicts", () => {
    it("returns WARN when any agent returns WARN (no blocking)", () => {
      const verdicts: AgentVerdict[] = [
        makeVerdict("qa", "PASS"),
        makeVerdict("analyst", "WARN", "Minor issues found"),
        makeVerdict("architect", "PASS"),
        makeVerdict("roadmap", "PASS"),
      ];

      const result = mergeVerdicts(verdicts);

      expect(result.verdict).toBe("WARN");
      expect(result.isBlocking).toBe(false);
      expect(result.warningAgents).toEqual(["analyst"]);
      expect(result.reason).toContain("analyst");
    });

    it("returns PARTIAL when any agent returns PARTIAL (no blocking, no WARN)", () => {
      const verdicts: AgentVerdict[] = [
        makeVerdict("qa", "PASS"),
        makeVerdict("analyst", "PARTIAL", "Some tasks incomplete"),
        makeVerdict("architect", "PASS"),
        makeVerdict("roadmap", "PASS"),
      ];

      const result = mergeVerdicts(verdicts);

      expect(result.verdict).toBe("PARTIAL");
      expect(result.isBlocking).toBe(false);
      expect(result.warningAgents).toEqual(["analyst"]);
    });

    it("prioritizes WARN over PARTIAL", () => {
      const verdicts: AgentVerdict[] = [
        makeVerdict("qa", "WARN"),
        makeVerdict("analyst", "PARTIAL"),
        makeVerdict("architect", "PASS"),
        makeVerdict("roadmap", "PASS"),
      ];

      const result = mergeVerdicts(verdicts);

      expect(result.verdict).toBe("WARN");
      expect(result.warningAgents).toEqual(["qa", "analyst"]);
    });
  });

  describe("success verdicts", () => {
    it("returns PASS when all agents return PASS", () => {
      const verdicts: AgentVerdict[] = [
        makeVerdict("qa", "PASS"),
        makeVerdict("analyst", "PASS"),
        makeVerdict("architect", "PASS"),
        makeVerdict("roadmap", "PASS"),
      ];

      const result = mergeVerdicts(verdicts);

      expect(result.verdict).toBe("PASS");
      expect(result.isBlocking).toBe(false);
      expect(result.passingAgents).toEqual(["qa", "analyst", "architect", "roadmap"]);
      expect(result.reason).toContain("4 agents passed");
    });

    it("returns COMPLIANT when any agent returns COMPLIANT (rest PASS)", () => {
      const verdicts: AgentVerdict[] = [
        makeVerdict("qa", "PASS"),
        makeVerdict("analyst", "COMPLIANT"),
        makeVerdict("architect", "PASS"),
        makeVerdict("roadmap", "COMPLIANT"),
      ];

      const result = mergeVerdicts(verdicts);

      expect(result.verdict).toBe("COMPLIANT");
      expect(result.isBlocking).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles empty verdicts array", () => {
      const result = mergeVerdicts([]);

      expect(result.verdict).toBe("PASS");
      expect(result.isBlocking).toBe(false);
      expect(result.reason).toBe("No verdicts to aggregate");
      expect(result.blockingAgents).toEqual([]);
      expect(result.warningAgents).toEqual([]);
      expect(result.passingAgents).toEqual([]);
    });

    it("handles single verdict", () => {
      const result = mergeVerdicts([makeVerdict("qa", "PASS")]);

      expect(result.verdict).toBe("PASS");
      expect(result.agentResults).toHaveProperty("qa");
    });

    it("preserves agent details in agentResults", () => {
      const verdicts: AgentVerdict[] = [
        makeVerdict("qa", "FAIL", "Test coverage at 45%"),
        makeVerdict("analyst", "PASS", "All requirements met"),
      ];

      const result = mergeVerdicts(verdicts);

      expect(result.agentResults.qa.details).toBe("Test coverage at 45%");
      expect(result.agentResults.analyst.details).toBe("All requirements met");
    });

    it("includes details in single blocking agent reason", () => {
      const result = mergeVerdicts([
        makeVerdict("qa", "FAIL", "Specific failure reason"),
      ]);

      expect(result.reason).toContain("Specific failure reason");
    });
  });
});

describe("canProceed", () => {
  it("returns false when verdict is blocking", () => {
    const finalVerdict: FinalVerdict = {
      verdict: "FAIL",
      isBlocking: true,
      reason: "Test failure",
      agentResults: {},
      blockingAgents: ["qa"],
      warningAgents: [],
      passingAgents: [],
    };

    expect(canProceed(finalVerdict)).toBe(false);
  });

  it("returns true when verdict is not blocking", () => {
    const finalVerdict: FinalVerdict = {
      verdict: "WARN",
      isBlocking: false,
      reason: "Minor warnings",
      agentResults: {},
      blockingAgents: [],
      warningAgents: ["analyst"],
      passingAgents: ["qa", "architect", "roadmap"],
    };

    expect(canProceed(finalVerdict)).toBe(true);
  });

  it("returns true for PASS verdict", () => {
    const finalVerdict: FinalVerdict = {
      verdict: "PASS",
      isBlocking: false,
      reason: "All passed",
      agentResults: {},
      blockingAgents: [],
      warningAgents: [],
      passingAgents: ["qa", "analyst", "architect", "roadmap"],
    };

    expect(canProceed(finalVerdict)).toBe(true);
  });
});
