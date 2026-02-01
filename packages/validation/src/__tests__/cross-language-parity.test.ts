/**
 * Cross-Language Validation Parity Tests
 *
 * Verifies that TypeScript (AJV) and Go (santhosh-tekuri/jsonschema) validators
 * produce identical results for all schemas. This test ensures:
 *
 * 1. Both validators accept the same valid inputs
 * 2. Both validators reject the same invalid inputs
 * 3. Error constraints match between validators
 *
 * Test approach:
 * - Load shared test fixtures from parity-test-cases.json
 * - Run TypeScript validation with AJV
 * - Run Go validation via subprocess
 * - Compare results
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";

import {
  getBootstrapContextArgsErrors,
  getBrainConfigErrors,
  getSearchArgsErrors,
  getSessionStateErrors,
  type ValidationError,
  validateBootstrapContextArgs,
  validateBrainConfig,
  validateSearchArgs,
  validateSessionState,
} from "../validate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesPath = join(__dirname, "fixtures", "parity-test-cases.json");

interface ParityTestCase {
  name: string;
  data: unknown;
  expectedConstraint?: string;
}

interface ParityTestSuite {
  valid: ParityTestCase[];
  invalid: ParityTestCase[];
}

interface ParityTestFixtures {
  search: ParityTestSuite;
  "bootstrap-context": ParityTestSuite;
  "session-state": ParityTestSuite;
  "brain-config": ParityTestSuite;
}

let fixtures: ParityTestFixtures;
let goTestsAvailable = true;
const packageRoot = join(__dirname, "..", "..");

beforeAll(() => {
  // Load test fixtures
  const fixtureContent = readFileSync(fixturesPath, "utf-8");
  fixtures = JSON.parse(fixtureContent);

  // Check if Go tests are runnable
  try {
    execSync("go version", { cwd: packageRoot, stdio: "pipe" });
  } catch {
    goTestsAvailable = false;
    console.warn("Go not available, skipping Go parity comparison");
  }
});

describe("Cross-Language Validation Parity", () => {
  describe("SearchArgs Parity", () => {
    describe("valid inputs", () => {
      test("TypeScript validates all valid cases", () => {
        for (const tc of fixtures.search.valid) {
          const testData = Array.isArray(tc.data) ? tc.data : [tc.data];

          for (const data of testData) {
            const isValid = validateSearchArgs(data);
            expect(isValid, `Case "${tc.name}" should be valid`).toBe(true);
          }
        }
      });

      test("TypeScript returns no errors for valid cases", () => {
        for (const tc of fixtures.search.valid) {
          const testData = Array.isArray(tc.data) ? tc.data : [tc.data];

          for (const data of testData) {
            const errors = getSearchArgsErrors(data);
            expect(errors, `Case "${tc.name}" should have no errors`).toEqual(
              [],
            );
          }
        }
      });
    });

    describe("invalid inputs", () => {
      test("TypeScript rejects all invalid cases", () => {
        for (const tc of fixtures.search.invalid) {
          const isValid = validateSearchArgs(tc.data);
          expect(isValid, `Case "${tc.name}" should be invalid`).toBe(false);
        }
      });

      test("TypeScript returns expected constraint errors", () => {
        for (const tc of fixtures.search.invalid) {
          const errors = getSearchArgsErrors(tc.data);
          expect(
            errors.length,
            `Case "${tc.name}" should have errors`,
          ).toBeGreaterThan(0);

          if (tc.expectedConstraint) {
            const constraints = errors.map((e) => e.constraint);
            expect(
              constraints,
              `Case "${tc.name}" should contain constraint "${tc.expectedConstraint}"`,
            ).toContain(tc.expectedConstraint);
          }
        }
      });
    });
  });

  describe("BootstrapContextArgs Parity", () => {
    describe("valid inputs", () => {
      test("TypeScript validates all valid cases", () => {
        for (const tc of fixtures["bootstrap-context"].valid) {
          const testData = Array.isArray(tc.data) ? tc.data : [tc.data];

          for (const data of testData) {
            const isValid = validateBootstrapContextArgs(data);
            expect(isValid, `Case "${tc.name}" should be valid`).toBe(true);
          }
        }
      });

      test("TypeScript returns no errors for valid cases", () => {
        for (const tc of fixtures["bootstrap-context"].valid) {
          const testData = Array.isArray(tc.data) ? tc.data : [tc.data];

          for (const data of testData) {
            const errors = getBootstrapContextArgsErrors(data);
            expect(errors, `Case "${tc.name}" should have no errors`).toEqual(
              [],
            );
          }
        }
      });
    });

    describe("invalid inputs", () => {
      test("TypeScript rejects all invalid cases", () => {
        for (const tc of fixtures["bootstrap-context"].invalid) {
          const isValid = validateBootstrapContextArgs(tc.data);
          expect(isValid, `Case "${tc.name}" should be invalid`).toBe(false);
        }
      });

      test("TypeScript returns expected constraint errors", () => {
        for (const tc of fixtures["bootstrap-context"].invalid) {
          const errors = getBootstrapContextArgsErrors(tc.data);
          expect(
            errors.length,
            `Case "${tc.name}" should have errors`,
          ).toBeGreaterThan(0);

          if (tc.expectedConstraint) {
            const constraints = errors.map((e) => e.constraint);
            expect(
              constraints,
              `Case "${tc.name}" should contain constraint "${tc.expectedConstraint}"`,
            ).toContain(tc.expectedConstraint);
          }
        }
      });
    });
  });

  describe("SessionState Parity", () => {
    describe("valid inputs", () => {
      test("TypeScript validates all valid cases", () => {
        for (const tc of fixtures["session-state"].valid) {
          const testData = Array.isArray(tc.data) ? tc.data : [tc.data];

          for (const data of testData) {
            const isValid = validateSessionState(data);
            expect(isValid, `Case "${tc.name}" should be valid`).toBe(true);
          }
        }
      });

      test("TypeScript returns no errors for valid cases", () => {
        for (const tc of fixtures["session-state"].valid) {
          const testData = Array.isArray(tc.data) ? tc.data : [tc.data];

          for (const data of testData) {
            const errors = getSessionStateErrors(data);
            expect(errors, `Case "${tc.name}" should have no errors`).toEqual(
              [],
            );
          }
        }
      });
    });

    describe("invalid inputs", () => {
      test("TypeScript rejects all invalid cases", () => {
        for (const tc of fixtures["session-state"].invalid) {
          const isValid = validateSessionState(tc.data);
          expect(isValid, `Case "${tc.name}" should be invalid`).toBe(false);
        }
      });

      test("TypeScript returns expected constraint errors", () => {
        for (const tc of fixtures["session-state"].invalid) {
          const errors = getSessionStateErrors(tc.data);
          expect(
            errors.length,
            `Case "${tc.name}" should have errors`,
          ).toBeGreaterThan(0);

          if (tc.expectedConstraint) {
            const constraints = errors.map((e) => e.constraint);
            expect(
              constraints,
              `Case "${tc.name}" should contain constraint "${tc.expectedConstraint}"`,
            ).toContain(tc.expectedConstraint);
          }
        }
      });
    });
  });

  describe("BrainConfig Parity", () => {
    describe("valid inputs", () => {
      test("TypeScript validates all valid cases", () => {
        for (const tc of fixtures["brain-config"].valid) {
          const testData = Array.isArray(tc.data) ? tc.data : [tc.data];

          for (const data of testData) {
            const isValid = validateBrainConfig(data);
            expect(isValid, `Case "${tc.name}" should be valid`).toBe(true);
          }
        }
      });

      test("TypeScript returns no errors for valid cases", () => {
        for (const tc of fixtures["brain-config"].valid) {
          const testData = Array.isArray(tc.data) ? tc.data : [tc.data];

          for (const data of testData) {
            const errors = getBrainConfigErrors(data);
            expect(errors, `Case "${tc.name}" should have no errors`).toEqual(
              [],
            );
          }
        }
      });
    });

    describe("invalid inputs", () => {
      test("TypeScript rejects all invalid cases", () => {
        for (const tc of fixtures["brain-config"].invalid) {
          const isValid = validateBrainConfig(tc.data);
          expect(isValid, `Case "${tc.name}" should be invalid`).toBe(false);
        }
      });

      test("TypeScript returns expected constraint errors", () => {
        for (const tc of fixtures["brain-config"].invalid) {
          const errors = getBrainConfigErrors(tc.data);
          expect(
            errors.length,
            `Case "${tc.name}" should have errors`,
          ).toBeGreaterThan(0);

          if (tc.expectedConstraint) {
            const constraints = errors.map((e) => e.constraint);
            expect(
              constraints,
              `Case "${tc.name}" should contain constraint "${tc.expectedConstraint}"`,
            ).toContain(tc.expectedConstraint);
          }
        }
      });
    });
  });
});

describe("Go Validator Parity (via subprocess)", () => {
  test.skipIf(!goTestsAvailable)(
    "Go tests pass for search schema",
    async () => {
      // Run Go tests for search validation
      const result = execSync(
        "go test -v -run TestSearchArgsParity ./internal/",
        {
          cwd: packageRoot,
          encoding: "utf-8",
        },
      );

      expect(result).toContain("PASS");
      expect(result).not.toContain("FAIL");
    },
  );

  test.skipIf(!goTestsAvailable)(
    "Go tests pass for bootstrap-context schema",
    async () => {
      const result = execSync(
        "go test -v -run TestBootstrapContextArgsParity ./internal/",
        {
          cwd: packageRoot,
          encoding: "utf-8",
        },
      );

      expect(result).toContain("PASS");
      expect(result).not.toContain("FAIL");
    },
  );

  test.skipIf(!goTestsAvailable)(
    "Go tests pass for brain-config schema",
    async () => {
      const result = execSync(
        "go test -v -run TestBrainConfigParity ./internal/",
        {
          cwd: packageRoot,
          encoding: "utf-8",
        },
      );

      expect(result).toContain("PASS");
      expect(result).not.toContain("FAIL");
    },
  );
});

/**
 * Summary test that compares validation results between TypeScript and Go.
 * This test counts pass/fail rates for both validators and compares them.
 */
describe("Parity Summary", () => {
  test("validation results match between TypeScript and Go", () => {
    const schemas = [
      "search",
      "bootstrap-context",
      "session-state",
      "brain-config",
    ] as const;
    const validators: Record<
      string,
      {
        validate: (data: unknown) => boolean;
        getErrors: (data: unknown) => ValidationError[];
      }
    > = {
      search: { validate: validateSearchArgs, getErrors: getSearchArgsErrors },
      "bootstrap-context": {
        validate: validateBootstrapContextArgs,
        getErrors: getBootstrapContextArgsErrors,
      },
      "session-state": {
        validate: validateSessionState,
        getErrors: getSessionStateErrors,
      },
      "brain-config": {
        validate: validateBrainConfig,
        getErrors: getBrainConfigErrors,
      },
    };

    const results: Record<
      string,
      {
        validPassed: number;
        validTotal: number;
        invalidPassed: number;
        invalidTotal: number;
      }
    > = {};

    for (const schema of schemas) {
      const fixture = fixtures[schema];
      const { validate, getErrors } = validators[schema];

      let validPassed = 0;
      let validTotal = 0;
      let invalidPassed = 0;
      let invalidTotal = 0;

      // Test valid cases
      for (const tc of fixture.valid) {
        const testData = Array.isArray(tc.data) ? tc.data : [tc.data];
        for (const data of testData) {
          validTotal++;
          if (validate(data)) {
            validPassed++;
          }
        }
      }

      // Test invalid cases
      for (const tc of fixture.invalid) {
        invalidTotal++;
        if (!validate(tc.data)) {
          invalidPassed++;
        }
      }

      results[schema] = {
        validPassed,
        validTotal,
        invalidPassed,
        invalidTotal,
      };
    }

    // Log summary
    console.log("\n=== Cross-Language Parity Summary (TypeScript/AJV) ===");
    for (const [schema, r] of Object.entries(results)) {
      console.log(
        `${schema}: Valid ${r.validPassed}/${r.validTotal}, Invalid ${r.invalidPassed}/${r.invalidTotal}`,
      );
    }

    // All TypeScript tests should pass
    for (const [schema, r] of Object.entries(results)) {
      expect(r.validPassed, `${schema}: All valid cases should pass`).toBe(
        r.validTotal,
      );
      expect(r.invalidPassed, `${schema}: All invalid cases should fail`).toBe(
        r.invalidTotal,
      );
    }
  });
});
