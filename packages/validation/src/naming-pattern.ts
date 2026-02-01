/**
 * Naming Pattern Validators for artifact file names.
 *
 * Validates file names against the 13 naming patterns defined in ADR-023.
 * These patterns match the Go validators in validate_consistency.go.
 *
 * Usage:
 *   import { validateNamingPattern, parseNamingPattern } from '@brain/validation';
 *
 *   const result = validateNamingPattern({ fileName: 'ADR-001-my-decision.md' });
 *   if (result.valid) {
 *     console.log(`Matched pattern: ${result.patternType}`);
 *   }
 *
 *   // Or use parse function that throws on invalid
 *   const parsed = parseNamingPattern({ fileName: 'ADR-001-my-decision.md' });
 */

import type { NamingPatternValidation } from "../generated/types";

/**
 * Pattern type identifiers matching the JSON Schema enum.
 */
export type PatternType =
  | "decision"
  | "session"
  | "requirement"
  | "design"
  | "task"
  | "analysis"
  | "feature"
  | "epic"
  | "critique"
  | "test-report"
  | "security"
  | "retrospective"
  | "skill";

/**
 * Naming patterns map matching Go implementation.
 * Each pattern validates a specific artifact type.
 *
 * Source: ADR-023 Phase 1, naming-pattern.schema.json $defs.patterns
 */
export const NamingPatterns: Record<PatternType, RegExp> = {
  decision: /^ADR-\d{3}-[\w-]+\.md$/,
  session: /^SESSION-\d{4}-\d{2}-\d{2}-\d{2}-[\w-]+\.md$/,
  requirement: /^REQ-\d{3}-[\w-]+\.md$/,
  design: /^DESIGN-\d{3}-[\w-]+\.md$/,
  task: /^TASK-\d{3}-[\w-]+\.md$/,
  analysis: /^ANALYSIS-\d{3}-[\w-]+\.md$/,
  feature: /^FEATURE-\d{3}-[\w-]+\.md$/,
  epic: /^EPIC-\d{3}-[\w-]+\.md$/,
  critique: /^CRIT-\d{3}-[\w-]+\.md$/,
  "test-report": /^QA-\d{3}-[\w-]+\.md$/,
  security: /^SEC-\d{3}-[\w-]+\.md$/,
  retrospective: /^RETRO-\d{4}-\d{2}-\d{2}-[\w-]+\.md$/,
  skill: /^SKILL-\d{3}-[\w-]+\.md$/,
};

/**
 * Deprecated patterns that should be rejected.
 * These are old formats that were used before ADR-023.
 */
export const DeprecatedPatterns: Record<string, RegExp> = {
  // Old skill format: Skill-Category-001.md
  oldSkill: /^Skill-[\w]+-\d{3}\.md$/,
  // Old session format: YYYY-MM-DD-session-NN.md
  oldSession: /^\d{4}-\d{2}-\d{2}-session-\d+\.md$/,
  // Old threat model format: TM-NNN-*.md
  oldThreatModel: /^TM-\d{3}-[\w-]+\.md$/,
  // Old retrospective format: YYYY-MM-DD-topic.md (without RETRO prefix)
  oldRetro: /^\d{4}-\d{2}-\d{2}-[\w-]+\.md$/,
};

/**
 * Result of naming pattern validation.
 */
export interface NamingPatternResult {
  /** Whether the file name matches a valid pattern */
  valid: boolean;
  /** The matched pattern type, if valid */
  patternType?: PatternType;
  /** Error message if invalid */
  error?: string;
  /** Whether the file name matches a deprecated pattern */
  isDeprecated?: boolean;
  /** The deprecated pattern that matched */
  deprecatedPattern?: string;
}

/**
 * Validate a file name against naming patterns.
 *
 * If patternType is provided, validates against that specific pattern.
 * Otherwise, checks if the file name matches any valid pattern.
 *
 * @param input - Input containing fileName and optional patternType
 * @returns Validation result with pattern type if matched
 */
export function validateNamingPattern(
  input: NamingPatternValidation,
): NamingPatternResult {
  const { fileName, patternType } = input;

  // Validate fileName is non-empty
  if (!fileName || fileName.length === 0) {
    return {
      valid: false,
      error: "fileName is required and must be non-empty",
    };
  }

  // Check for path traversal attempts
  if (
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  ) {
    return {
      valid: false,
      error: "Path traversal detected: fileName must not contain .., /, or \\",
    };
  }

  // If specific pattern type requested, validate against it
  if (patternType) {
    const pattern = NamingPatterns[patternType as PatternType];
    if (!pattern) {
      return {
        valid: false,
        error: `Unknown pattern type: ${patternType}`,
      };
    }

    if (pattern.test(fileName)) {
      return {
        valid: true,
        patternType: patternType as PatternType,
      };
    }

    // Check if it matches a deprecated pattern
    const deprecatedMatch = checkDeprecatedPattern(fileName);
    if (deprecatedMatch) {
      return {
        valid: false,
        error: `File name matches deprecated pattern '${deprecatedMatch}'. Use the new ${patternType} format.`,
        isDeprecated: true,
        deprecatedPattern: deprecatedMatch,
      };
    }

    return {
      valid: false,
      error: `File name does not match ${patternType} pattern: ${pattern.source}`,
    };
  }

  // No specific type requested - check all patterns
  for (const [type, pattern] of Object.entries(NamingPatterns)) {
    if (pattern.test(fileName)) {
      return {
        valid: true,
        patternType: type as PatternType,
      };
    }
  }

  // Check if it matches any deprecated pattern
  const deprecatedMatch = checkDeprecatedPattern(fileName);
  if (deprecatedMatch) {
    return {
      valid: false,
      error: `File name matches deprecated pattern '${deprecatedMatch}'. Migrate to the new naming convention.`,
      isDeprecated: true,
      deprecatedPattern: deprecatedMatch,
    };
  }

  return {
    valid: false,
    error: "File name does not match any known naming pattern",
  };
}

/**
 * Check if a file name matches any deprecated pattern.
 *
 * @param fileName - File name to check
 * @returns The name of the deprecated pattern that matched, or undefined
 */
function checkDeprecatedPattern(fileName: string): string | undefined {
  for (const [name, pattern] of Object.entries(DeprecatedPatterns)) {
    if (pattern.test(fileName)) {
      return name;
    }
  }
  return undefined;
}

/**
 * Parse and validate a file name, throwing on invalid input.
 *
 * @param input - Input containing fileName and optional patternType
 * @returns Validated input with resolved pattern type
 * @throws Error if validation fails
 */
export function parseNamingPattern(
  input: NamingPatternValidation,
): NamingPatternValidation & { patternType: PatternType } {
  const result = validateNamingPattern(input);

  if (!result.valid) {
    throw new Error(result.error || "Validation failed");
  }

  return {
    fileName: input.fileName,
    patternType: result.patternType!,
  };
}

/**
 * Get all pattern types that match a file name.
 * Useful for detecting ambiguous file names.
 *
 * @param fileName - File name to check
 * @returns Array of matching pattern types
 */
export function getMatchingPatterns(fileName: string): PatternType[] {
  const matches: PatternType[] = [];

  for (const [type, pattern] of Object.entries(NamingPatterns)) {
    if (pattern.test(fileName)) {
      matches.push(type as PatternType);
    }
  }

  return matches;
}

/**
 * Check if a file name is valid (matches any pattern).
 *
 * @param fileName - File name to check
 * @returns true if valid, false otherwise
 */
export function isValidNamingPattern(fileName: string): boolean {
  return validateNamingPattern({ fileName }).valid;
}

/**
 * Get the pattern regex for a specific type.
 *
 * @param patternType - Pattern type to get
 * @returns RegExp for the pattern, or undefined if unknown type
 */
export function getPatternRegex(patternType: PatternType): RegExp | undefined {
  return NamingPatterns[patternType];
}

/**
 * Get all available pattern types.
 *
 * @returns Array of all pattern type names
 */
export function getPatternTypes(): PatternType[] {
  return Object.keys(NamingPatterns) as PatternType[];
}
