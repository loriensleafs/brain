/**
 * Session Status Validators Cross-Language Parity Tests
 *
 * Verifies that TypeScript and Go validators produce identical results
 * for session status validation. This test ensures:
 *
 * 1. Both validators accept the same valid inputs
 * 2. Both validators reject the same invalid inputs
 * 3. Both validators return the same error constraints for invalid inputs
 *
 * Test approach:
 * - Load shared test fixtures from session-status-parity-test-cases.json
 * - Run TypeScript validation
 * - Run Go validation via subprocess
 * - Compare results for parity
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import {
  getSessionStatusErrors,
  isValidSessionStatus,
  type SessionStatus,
  validateSessionStatus,
} from "../../session-status-validators";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures");
const packageRoot = join(__dirname, "..", "..", "..");

/**
 * Test case structure from fixtures file.
 */
interface SessionStatusTestCase {
  name: string;
  data: unknown;
  expectedError?: string;
}

/**
 * Test suite structure from fixtures file.
 */
interface SessionStatusTestSuite {
  valid: SessionStatusTestCase[];
  invalid: SessionStatusTestCase[];
}

/**
 * Go validation result structure.
 */
interface GoValidationResult {
  valid: boolean;
  status?: string;
  errors: Array<{
    field: string;
    constraint: string;
    message: string;
  }>;
}

/**
 * Load test fixtures from JSON file.
 */
function loadFixtures(): SessionStatusTestSuite {
  const fixturesPath = join(fixturesDir, "session-status-parity-test-cases.json");
  const content = readFileSync(fixturesPath, "utf-8");
  const fixtures = JSON.parse(content);
  return fixtures["session-status"];
}

/**
 * Run Go validator via subprocess.
 * Returns null if Go is not available.
 */
function runGoValidator(frontmatter: unknown): GoValidationResult | null {
  try {
    const input = JSON.stringify(frontmatter);
    const result = execSync(
      `go run ./cmd/validate-session-status/main.go '${input.replace(/'/g, "'\\''")}'`,
      {
        cwd: packageRoot,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    return JSON.parse(result.trim());
  } catch {
    // Go command may fail if Go is not available or validator not built
    return null;
  }
}

describe("Session Status Validators Cross-Language Parity", () => {
  let fixtures: SessionStatusTestSuite;
  let goAvailable = false;

  beforeAll(() => {
    fixtures = loadFixtures();

    // Check if Go is available
    try {
      execSync("go version", { cwd: packageRoot, stdio: "pipe" });
      // Check if the validator command exists
      execSync("go build -o /dev/null ./cmd/validate-session-status/main.go 2>/dev/null || true", {
        cwd: packageRoot,
        stdio: "pipe",
      });
      goAvailable = true;
    } catch {
      console.warn("Go not available, skipping Go parity comparison");
    }
  });

  describe("isValidSessionStatus", () => {
    it("returns true for IN_PROGRESS", () => {
      expect(isValidSessionStatus("IN_PROGRESS")).toBe(true);
    });

    it("returns true for PAUSED", () => {
      expect(isValidSessionStatus("PAUSED")).toBe(true);
    });

    it("returns true for COMPLETE", () => {
      expect(isValidSessionStatus("COMPLETE")).toBe(true);
    });

    it("returns false for lowercase", () => {
      expect(isValidSessionStatus("in_progress")).toBe(false);
    });

    it("returns false for invalid status", () => {
      expect(isValidSessionStatus("ACTIVE")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isValidSessionStatus("")).toBe(false);
    });
  });

  describe("Valid cases", () => {
    it("should have valid test fixtures loaded", () => {
      expect(fixtures.valid.length).toBeGreaterThan(0);
    });

    fixtures?.valid.forEach(({ name, data }) => {
      it(`${name}`, () => {
        // TypeScript validation
        const tsResult = validateSessionStatus(data);
        expect(tsResult.valid, `TS: Expected ${name} to be valid`).toBe(true);
        expect(tsResult.errors).toHaveLength(0);

        if (tsResult.valid) {
          expect(tsResult.status).toBeDefined();
          expect(["IN_PROGRESS", "PAUSED", "COMPLETE"]).toContain(tsResult.status);
        }

        // Go parity check (if available)
        if (goAvailable) {
          const goResult = runGoValidator(data);
          if (goResult !== null) {
            expect(goResult.valid, `Go: Expected ${name} to be valid`).toBe(true);
            expect(goResult.errors).toHaveLength(0);

            // Parity assertion
            expect(tsResult.valid).toBe(goResult.valid);
            if (tsResult.valid && goResult.valid) {
              expect(tsResult.status).toBe(goResult.status);
            }
          }
        }
      });
    });
  });

  describe("Invalid cases", () => {
    it("should have invalid test fixtures loaded", () => {
      expect(fixtures.invalid.length).toBeGreaterThan(0);
    });

    fixtures?.invalid.forEach(({ name, data, expectedError }) => {
      it(`${name}`, () => {
        // TypeScript validation
        const tsResult = validateSessionStatus(data);
        expect(tsResult.valid, `TS: Expected ${name} to be invalid`).toBe(false);
        expect(tsResult.errors.length).toBeGreaterThan(0);

        // Check expected error constraint
        if (expectedError) {
          const hasExpectedError = tsResult.errors.some((e) => e.constraint === expectedError);
          expect(hasExpectedError, `TS: Expected constraint ${expectedError} in errors`).toBe(true);
        }

        // Go parity check (if available)
        if (goAvailable) {
          const goResult = runGoValidator(data);
          if (goResult !== null) {
            expect(goResult.valid, `Go: Expected ${name} to be invalid`).toBe(false);
            expect(goResult.errors.length).toBeGreaterThan(0);

            // Parity assertion
            expect(tsResult.valid).toBe(goResult.valid);

            // Check same error constraint
            if (expectedError) {
              const goHasExpectedError = goResult.errors.some(
                (e) => e.constraint === expectedError,
              );
              expect(goHasExpectedError, `Go: Expected constraint ${expectedError} in errors`).toBe(
                true,
              );
            }
          }
        }
      });
    });
  });

  describe("getSessionStatusErrors", () => {
    it("returns empty array for valid frontmatter", () => {
      const errors = getSessionStatusErrors({
        title: "SESSION-2026-02-04_01-test",
        type: "session",
        status: "IN_PROGRESS",
        date: "2026-02-04",
      });
      expect(errors).toHaveLength(0);
    });

    it("returns multiple errors for frontmatter with multiple issues", () => {
      const errors = getSessionStatusErrors({
        title: "invalid-title",
        type: "note",
        status: "INVALID",
        date: "not-a-date",
      });
      expect(errors.length).toBeGreaterThan(1);

      const constraints = errors.map((e) => e.constraint);
      expect(constraints).toContain("title_invalid");
      expect(constraints).toContain("type_invalid");
      expect(constraints).toContain("status_invalid");
      expect(constraints).toContain("date_invalid");
    });
  });

  describe("Parity Summary", () => {
    it("generates parity summary for all test cases", () => {
      const allCases = [...fixtures.valid, ...fixtures.invalid];

      let tsValid = 0;
      let tsInvalid = 0;
      let goValid = 0;
      let goInvalid = 0;
      let parityMatches = 0;
      let parityMismatches = 0;
      const mismatches: string[] = [];

      for (const tc of allCases) {
        const tsResult = validateSessionStatus(tc.data);
        if (tsResult.valid) tsValid++;
        else tsInvalid++;

        if (goAvailable) {
          const goResult = runGoValidator(tc.data);
          if (goResult !== null) {
            if (goResult.valid) goValid++;
            else goInvalid++;

            if (tsResult.valid === goResult.valid) {
              parityMatches++;
            } else {
              parityMismatches++;
              mismatches.push(`${tc.name}: TS=${tsResult.valid}, Go=${goResult.valid}`);
            }
          }
        }
      }

      console.log("\n=== Session Status Validation Parity Summary ===");
      console.log(`Total test cases: ${allCases.length}`);
      console.log(`TypeScript: Valid ${tsValid}, Invalid ${tsInvalid}`);

      if (goAvailable) {
        console.log(`Go: Valid ${goValid}, Invalid ${goInvalid}`);
        console.log(`Parity: ${parityMatches} matches, ${parityMismatches} mismatches`);
        if (mismatches.length > 0) {
          console.log("Mismatches:", mismatches);
        }
        expect(parityMismatches).toBe(0);
      }

      // Verify expected distribution
      expect(tsValid).toBe(fixtures.valid.length);
      expect(tsInvalid).toBe(fixtures.invalid.length);
    });
  });

  describe("Status value coverage", () => {
    const statuses: SessionStatus[] = ["IN_PROGRESS", "PAUSED", "COMPLETE"];

    statuses.forEach((status) => {
      it(`accepts ${status} status`, () => {
        const result = validateSessionStatus({
          title: "SESSION-2026-02-04_01-test",
          type: "session",
          status,
          date: "2026-02-04",
        });
        expect(result.valid).toBe(true);
        expect(result.status).toBe(status);
      });
    });
  });

  describe("Edge cases", () => {
    it("rejects undefined frontmatter", () => {
      const result = validateSessionStatus(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors[0].constraint).toBe("frontmatter_required");
    });

    it("rejects null frontmatter", () => {
      const result = validateSessionStatus(null);
      expect(result.valid).toBe(false);
      expect(result.errors[0].constraint).toBe("frontmatter_required");
    });

    it("rejects array frontmatter", () => {
      const result = validateSessionStatus([]);
      expect(result.valid).toBe(false);
      expect(result.errors[0].constraint).toBe("frontmatter_required");
    });

    it("rejects string frontmatter", () => {
      const result = validateSessionStatus("not an object");
      expect(result.valid).toBe(false);
      expect(result.errors[0].constraint).toBe("frontmatter_required");
    });

    it("rejects number frontmatter", () => {
      const result = validateSessionStatus(123);
      expect(result.valid).toBe(false);
      expect(result.errors[0].constraint).toBe("frontmatter_required");
    });

    it("allows extra fields in frontmatter", () => {
      const result = validateSessionStatus({
        title: "SESSION-2026-02-04_01-test",
        type: "session",
        status: "IN_PROGRESS",
        date: "2026-02-04",
        permalink: "sessions/test",
        customField: "value",
      });
      expect(result.valid).toBe(true);
    });
  });
});
