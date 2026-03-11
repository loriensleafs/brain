/**
 * Tests for session-log-fixer skill get_validation_errors.ts.
 */

import { describe, test, expect } from "bun:test";
import { parseJobSummary } from "../scripts/get_validation_errors";

describe("parseJobSummary", () => {
  test("parses overall verdict", () => {
    const summary = "Overall Verdict: **CRITICAL_FAIL**\n1 MUST requirement(s) not met";
    const result = parseJobSummary(summary);
    expect(result.overall_verdict).toBe("CRITICAL_FAIL");
    expect(result.must_failure_count).toBe(1);
  });

  test("parses non-compliant sessions", () => {
    const summary = [
      "| Session File | Verdict | MUST Failures |",
      "|:---|:---|:---:|",
      "| `2025-12-29-session-11.md` | NON_COMPLIANT | 2 |",
    ].join("\n");
    const result = parseJobSummary(summary);
    expect(result.non_compliant_sessions).toHaveLength(1);
    expect(result.non_compliant_sessions[0].file).toBe("2025-12-29-session-11.md");
    expect(result.non_compliant_sessions[0].must_failures).toBe(2);
  });

  test("handles empty summary", () => {
    const result = parseJobSummary("");
    expect(result.overall_verdict).toBeNull();
    expect(result.must_failure_count).toBe(0);
    expect(result.non_compliant_sessions).toEqual([]);
  });
});
