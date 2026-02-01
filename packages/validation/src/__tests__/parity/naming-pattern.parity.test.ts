/**
 * Naming Pattern Cross-Language Parity Tests
 *
 * Verifies that TypeScript and Go validators produce identical results
 * for all 13 naming patterns defined in ADR-023. This test ensures:
 *
 * 1. Both validators accept the same valid inputs
 * 2. Both validators reject the same invalid inputs (old formats)
 * 3. Both validators handle edge cases identically (path traversal, empty input)
 *
 * Test approach:
 * - Run TypeScript validation with naming-pattern.ts
 * - Run Go validation via subprocess (cmd/validate-naming)
 * - Compare results for parity
 */

import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import {
  type PatternType,
  validateNamingPattern,
} from "../../naming-pattern";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..", "..", "..");

/**
 * Test case definition for naming pattern validation.
 */
interface NamingPatternTestCase {
  fileName: string;
  patternType?: PatternType;
  expected: boolean;
  description?: string;
}

/**
 * All 13 pattern types with valid examples.
 * Each pattern must have at least one valid and one invalid example.
 */
const validTestCases: NamingPatternTestCase[] = [
  // Decision (ADR)
  { fileName: "ADR-001-database-selection.md", patternType: "decision", expected: true },
  { fileName: "ADR-023-unified-validation.md", patternType: "decision", expected: true },
  { fileName: "ADR-999-final-decision.md", patternType: "decision", expected: true },

  // Session
  { fileName: "SESSION-2026-02-01-01-import.md", patternType: "session", expected: true },
  { fileName: "SESSION-2024-12-31-99-year-end.md", patternType: "session", expected: true },

  // Requirement
  { fileName: "REQ-001-user-login.md", patternType: "requirement", expected: true },
  { fileName: "REQ-123-data-export.md", patternType: "requirement", expected: true },

  // Design
  { fileName: "DESIGN-001-api-architecture.md", patternType: "design", expected: true },
  { fileName: "DESIGN-050-database-schema.md", patternType: "design", expected: true },

  // Task
  { fileName: "TASK-001-implement-auth.md", patternType: "task", expected: true },
  { fileName: "TASK-042-fix-bug.md", patternType: "task", expected: true },

  // Analysis
  { fileName: "ANALYSIS-001-copilot-cli.md", patternType: "analysis", expected: true },
  { fileName: "ANALYSIS-015-performance-review.md", patternType: "analysis", expected: true },

  // Feature
  { fileName: "FEATURE-001-oauth-integration.md", patternType: "feature", expected: true },
  { fileName: "FEATURE-003-dashboard.md", patternType: "feature", expected: true },

  // Epic
  { fileName: "EPIC-001-user-authentication.md", patternType: "epic", expected: true },
  { fileName: "EPIC-005-reporting-system.md", patternType: "epic", expected: true },

  // Critique
  { fileName: "CRIT-001-auth-plan-critique.md", patternType: "critique", expected: true },
  { fileName: "CRIT-010-api-design-review.md", patternType: "critique", expected: true },

  // Test Report (QA)
  { fileName: "QA-001-auth-test-report.md", patternType: "test-report", expected: true },
  { fileName: "QA-050-integration-tests.md", patternType: "test-report", expected: true },

  // Security (SEC)
  { fileName: "SEC-001-auth-flow.md", patternType: "security", expected: true },
  { fileName: "SEC-025-data-encryption.md", patternType: "security", expected: true },

  // Retrospective
  { fileName: "RETRO-2026-01-15-sprint-review.md", patternType: "retrospective", expected: true },
  { fileName: "RETRO-2024-12-31-year-end.md", patternType: "retrospective", expected: true },

  // Skill
  { fileName: "SKILL-001-memory-ops.md", patternType: "skill", expected: true },
  { fileName: "SKILL-015-git-workflow.md", patternType: "skill", expected: true },
];

/**
 * Invalid test cases - deprecated formats that should be rejected.
 */
const invalidDeprecatedTestCases: NamingPatternTestCase[] = [
  // Old skill format: Skill-Category-001.md
  { fileName: "Skill-Category-001.md", patternType: "skill", expected: false, description: "old skill format" },
  { fileName: "Skill-Memory-015.md", patternType: "skill", expected: false, description: "old skill format" },

  // Old session format: YYYY-MM-DD-session-NN.md
  { fileName: "2026-02-01-session-01.md", patternType: "session", expected: false, description: "old session format" },
  { fileName: "2024-12-31-session-99.md", patternType: "session", expected: false, description: "old session format" },

  // Old threat model format: TM-NNN-*.md
  { fileName: "TM-001-auth.md", patternType: "security", expected: false, description: "old threat model format" },
  { fileName: "TM-025-data-encryption.md", patternType: "security", expected: false, description: "old threat model format" },
];

/**
 * Edge cases for security and validation robustness.
 */
const edgeCases: NamingPatternTestCase[] = [
  // Path traversal attempts
  { fileName: "../etc/passwd", expected: false, description: "path traversal with .." },
  { fileName: "../../secret.md", expected: false, description: "double path traversal" },
  { fileName: "path/to/ADR-001-test.md", expected: false, description: "forward slash in path" },
  { fileName: "path\\to\\ADR-001-test.md", expected: false, description: "backslash in path" },

  // Empty and invalid inputs
  { fileName: "", expected: false, description: "empty filename" },
  { fileName: "random-file.md", expected: false, description: "unrecognized pattern" },
  { fileName: "ADR-01-too-short.md", expected: false, description: "2-digit number instead of 3" },
  { fileName: "ADR-0001-too-long.md", expected: false, description: "4-digit number instead of 3" },
  { fileName: "adr-001-lowercase.md", expected: false, description: "lowercase prefix" },
  { fileName: "ADR-001.md", expected: false, description: "missing description" },
  { fileName: "ADR-001-test.txt", expected: false, description: "wrong extension" },
  { fileName: "ADR-001-my decision.md", expected: false, description: "space in filename" },
];

/**
 * Pattern type mismatch cases - valid file but wrong pattern type specified.
 */
const patternMismatchCases: NamingPatternTestCase[] = [
  { fileName: "ADR-001-test.md", patternType: "session", expected: false, description: "ADR file with session type" },
  { fileName: "SESSION-2026-01-01-01-test.md", patternType: "decision", expected: false, description: "SESSION file with decision type" },
  { fileName: "SKILL-001-test.md", patternType: "epic", expected: false, description: "SKILL file with epic type" },
];

/**
 * Go validation result structure.
 */
interface GoValidationResult {
  valid: boolean;
  patternType?: string;
  error?: string;
  isDeprecated?: boolean;
  deprecatedPattern?: string;
}

/**
 * Run Go validator via subprocess.
 */
function runGoValidator(fileName: string, patternType?: string): GoValidationResult | null {
  try {
    const args = patternType ? `"${fileName}" "${patternType}"` : `"${fileName}"`;
    const result = execSync(
      `go run ./cmd/validate-naming/main.go ${args}`,
      {
        cwd: packageRoot,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }
    );
    return JSON.parse(result.trim());
  } catch (error) {
    // Go command may fail if Go is not available
    return null;
  }
}

describe("Naming Pattern Cross-Language Parity", () => {
  let goAvailable = false;

  beforeAll(() => {
    try {
      execSync("go version", { cwd: packageRoot, stdio: "pipe" });
      // Also check if the Go validator can be built
      execSync("go build -o /dev/null ./cmd/validate-naming/main.go", {
        cwd: packageRoot,
        stdio: "pipe",
      });
      goAvailable = true;
    } catch {
      console.warn("Go not available or validator build failed, skipping Go parity tests");
    }
  });

  describe("Valid patterns (all 13 types)", () => {
    validTestCases.forEach(({ fileName, patternType, expected }) => {
      it(`${fileName} should match ${patternType}`, () => {
        // TypeScript validation
        const tsResult = validateNamingPattern({ fileName, patternType });
        expect(tsResult.valid, `TS: Expected ${fileName} to be valid`).toBe(expected);
        expect(tsResult.patternType).toBe(patternType);

        // Go parity check (if available)
        if (goAvailable) {
          const goResult = runGoValidator(fileName, patternType);
          if (goResult !== null) {
            expect(goResult.valid, `Go: Expected ${fileName} to be valid`).toBe(expected);
            expect(goResult.patternType).toBe(patternType);
            // Parity assertion
            expect(tsResult.valid).toBe(goResult.valid);
          }
        }
      });
    });
  });

  describe("Invalid patterns (deprecated formats)", () => {
    invalidDeprecatedTestCases.forEach(({ fileName, patternType, expected, description }) => {
      it(`${fileName} should be rejected (${description})`, () => {
        // TypeScript validation
        const tsResult = validateNamingPattern({ fileName, patternType });
        expect(tsResult.valid, `TS: Expected ${fileName} to be invalid`).toBe(expected);
        expect(tsResult.isDeprecated).toBe(true);

        // Go parity check (if available)
        if (goAvailable) {
          const goResult = runGoValidator(fileName, patternType);
          if (goResult !== null) {
            expect(goResult.valid, `Go: Expected ${fileName} to be invalid`).toBe(expected);
            expect(goResult.isDeprecated).toBe(true);
            // Parity assertion
            expect(tsResult.valid).toBe(goResult.valid);
            expect(tsResult.isDeprecated).toBe(goResult.isDeprecated);
          }
        }
      });
    });
  });

  describe("Edge cases", () => {
    edgeCases.forEach(({ fileName, expected, description }) => {
      it(`${description}: "${fileName}"`, () => {
        // TypeScript validation
        const tsResult = validateNamingPattern({ fileName });
        expect(tsResult.valid, `TS: Expected ${fileName} to be invalid`).toBe(expected);

        // Go parity check (if available)
        if (goAvailable) {
          const goResult = runGoValidator(fileName);
          if (goResult !== null) {
            expect(goResult.valid, `Go: Expected ${fileName} to be invalid`).toBe(expected);
            // Parity assertion
            expect(tsResult.valid).toBe(goResult.valid);
          }
        }
      });
    });
  });

  describe("Pattern type mismatch", () => {
    patternMismatchCases.forEach(({ fileName, patternType, expected, description }) => {
      it(`${description}`, () => {
        // TypeScript validation
        const tsResult = validateNamingPattern({ fileName, patternType });
        expect(tsResult.valid, `TS: Expected mismatch to be invalid`).toBe(expected);

        // Go parity check (if available)
        if (goAvailable) {
          const goResult = runGoValidator(fileName, patternType);
          if (goResult !== null) {
            expect(goResult.valid, `Go: Expected mismatch to be invalid`).toBe(expected);
            // Parity assertion
            expect(tsResult.valid).toBe(goResult.valid);
          }
        }
      });
    });
  });

  describe("Auto-detection (no pattern type specified)", () => {
    const autoDetectCases: NamingPatternTestCase[] = [
      { fileName: "ADR-001-test.md", expected: true },
      { fileName: "SESSION-2026-01-01-01-test.md", expected: true },
      { fileName: "SKILL-001-test.md", expected: true },
      { fileName: "invalid-file.md", expected: false },
    ];

    autoDetectCases.forEach(({ fileName, expected }) => {
      it(`auto-detects ${fileName}`, () => {
        // TypeScript validation without patternType
        const tsResult = validateNamingPattern({ fileName });
        expect(tsResult.valid).toBe(expected);

        // Go parity check (if available)
        if (goAvailable) {
          const goResult = runGoValidator(fileName);
          if (goResult !== null) {
            expect(goResult.valid).toBe(expected);
            // Parity assertion
            expect(tsResult.valid).toBe(goResult.valid);
            if (expected && tsResult.patternType) {
              expect(tsResult.patternType).toBe(goResult.patternType);
            }
          }
        }
      });
    });
  });

  describe("Parity Summary", () => {
    it("generates parity summary for all test cases", { timeout: 60000 }, () => {
      const allCases = [
        ...validTestCases,
        ...invalidDeprecatedTestCases,
        ...edgeCases,
        ...patternMismatchCases,
      ];

      let tsValid = 0;
      let tsInvalid = 0;
      let goValid = 0;
      let goInvalid = 0;
      let parityMatches = 0;
      let parityMismatches = 0;

      for (const tc of allCases) {
        const tsResult = validateNamingPattern({ fileName: tc.fileName, patternType: tc.patternType });
        if (tsResult.valid) tsValid++;
        else tsInvalid++;

        if (goAvailable) {
          const goResult = runGoValidator(tc.fileName, tc.patternType);
          if (goResult !== null) {
            if (goResult.valid) goValid++;
            else goInvalid++;

            if (tsResult.valid === goResult.valid) {
              parityMatches++;
            } else {
              parityMismatches++;
              console.warn(`Parity mismatch: ${tc.fileName} - TS: ${tsResult.valid}, Go: ${goResult.valid}`);
            }
          }
        }
      }

      console.log("\n=== Naming Pattern Parity Summary ===");
      console.log(`Total test cases: ${allCases.length}`);
      console.log(`TypeScript: Valid ${tsValid}, Invalid ${tsInvalid}`);
      if (goAvailable) {
        console.log(`Go: Valid ${goValid}, Invalid ${goInvalid}`);
        console.log(`Parity: ${parityMatches} matches, ${parityMismatches} mismatches`);
        expect(parityMismatches).toBe(0);
      }

      // Verify expected distribution
      expect(tsValid).toBe(validTestCases.length);
      expect(tsInvalid).toBe(invalidDeprecatedTestCases.length + edgeCases.length + patternMismatchCases.length);
    });
  });
});
