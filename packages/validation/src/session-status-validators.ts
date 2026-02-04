/**
 * Session Status Validators
 *
 * Validates session note frontmatter for status field compliance.
 * These validators check session lifecycle status (IN_PROGRESS, PAUSED, COMPLETE).
 *
 * IMPORTANT: These validators must produce identical results to the Go validators
 * in packages/validation/internal/validate_session_status.go for cross-language parity.
 *
 * Usage:
 *   import { validateSessionStatus, isValidSessionStatus } from '@brain/validation';
 *
 *   const result = validateSessionStatus(frontmatter);
 *   if (result.valid) {
 *     console.log(`Status: ${result.status}`);
 *   }
 */

/**
 * Valid session status values.
 * Matches the session state machine: IN_PROGRESS <-> PAUSED -> COMPLETE
 */
export type SessionStatus = "IN_PROGRESS" | "PAUSED" | "COMPLETE";

/**
 * Valid session status values as a Set for O(1) lookup.
 */
const VALID_STATUSES = new Set<string>(["IN_PROGRESS", "PAUSED", "COMPLETE"]);

/**
 * Session title pattern: SESSION-YYYY-MM-DD_NN-topic
 * Matches: SESSION-2026-02-04_01-feature-implementation
 * Does NOT match: 2026-02-04-session-01 (old format)
 */
const SESSION_TITLE_PATTERN = /^SESSION-\d{4}-\d{2}-\d{2}_\d{2}-[\w-]+$/;

/**
 * ISO date pattern: YYYY-MM-DD
 * Requires leading zeros for month and day.
 */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Structured validation error for session status validation.
 * Matches the ValidationError interface from validate.ts.
 */
export interface ValidationError {
  field: string;
  constraint: string;
  message: string;
}

/**
 * Result of session status validation.
 * Uses discriminated union for proper TypeScript narrowing.
 */
export interface StatusValidation {
  valid: boolean;
  status?: SessionStatus;
  errors: ValidationError[];
}

/**
 * Check if a status string is a valid session status.
 *
 * @param status - Status string to validate
 * @returns true if status is one of: IN_PROGRESS, PAUSED, COMPLETE
 */
export function isValidSessionStatus(status: string): status is SessionStatus {
  return VALID_STATUSES.has(status);
}

/**
 * Validate session note frontmatter for status compliance.
 *
 * Validation rules:
 * 1. frontmatter MUST be a non-null object
 * 2. status field MUST be present (string, not null/undefined)
 * 3. status value MUST be one of: IN_PROGRESS, PAUSED, COMPLETE
 * 4. type field MUST equal "session"
 * 5. title field MUST match pattern SESSION-YYYY-MM-DD_NN-topic
 * 6. date field MUST be valid ISO date (YYYY-MM-DD)
 *
 * @param frontmatter - Session note frontmatter object
 * @returns StatusValidation with valid flag, status (if valid), and errors
 */
export function validateSessionStatus(frontmatter: unknown): StatusValidation {
  const errors = getSessionStatusErrors(frontmatter);

  if (errors.length === 0) {
    // Type assertion safe here - we validated all fields
    const fm = frontmatter as Record<string, unknown>;
    return {
      valid: true,
      status: fm.status as SessionStatus,
      errors: [],
    };
  }

  return {
    valid: false,
    errors,
  };
}

/**
 * Get validation errors for session note frontmatter.
 *
 * @param frontmatter - Session note frontmatter object
 * @returns Array of ValidationError (empty if valid)
 */
export function getSessionStatusErrors(frontmatter: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  // Rule 1: frontmatter MUST be a non-null object
  if (frontmatter === null || frontmatter === undefined) {
    errors.push({
      field: "",
      constraint: "frontmatter_required",
      message: "Frontmatter is required and must be an object",
    });
    return errors;
  }

  if (typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
    errors.push({
      field: "",
      constraint: "frontmatter_required",
      message: "Frontmatter must be an object, not array or primitive",
    });
    return errors;
  }

  const fm = frontmatter as Record<string, unknown>;

  // Rule 5: title field MUST match pattern SESSION-YYYY-MM-DD_NN-topic
  if (!("title" in fm) || fm.title === undefined || fm.title === null) {
    errors.push({
      field: "title",
      constraint: "title_required",
      message: "Title field is required",
    });
  } else if (typeof fm.title !== "string") {
    errors.push({
      field: "title",
      constraint: "title_invalid",
      message: "Title must be a string",
    });
  } else if (!SESSION_TITLE_PATTERN.test(fm.title)) {
    errors.push({
      field: "title",
      constraint: "title_invalid",
      message: "Title must match pattern SESSION-YYYY-MM-DD_NN-topic",
    });
  }

  // Rule 4: type field MUST equal "session"
  if (!("type" in fm) || fm.type === undefined || fm.type === null) {
    errors.push({
      field: "type",
      constraint: "type_required",
      message: "Type field is required",
    });
  } else if (fm.type !== "session") {
    errors.push({
      field: "type",
      constraint: "type_invalid",
      message: 'Type must be "session"',
    });
  }

  // Rule 2 & 3: status field MUST be present and valid
  if (!("status" in fm) || fm.status === undefined || fm.status === null) {
    errors.push({
      field: "status",
      constraint: "status_required",
      message: "Status field is required",
    });
  } else if (typeof fm.status !== "string" || !isValidSessionStatus(fm.status)) {
    errors.push({
      field: "status",
      constraint: "status_invalid",
      message: "Status must be one of: IN_PROGRESS, PAUSED, COMPLETE",
    });
  }

  // Rule 6: date field MUST be valid ISO date (YYYY-MM-DD)
  if (!("date" in fm) || fm.date === undefined || fm.date === null) {
    errors.push({
      field: "date",
      constraint: "date_required",
      message: "Date field is required",
    });
  } else if (typeof fm.date !== "string") {
    errors.push({
      field: "date",
      constraint: "date_invalid",
      message: "Date must be a string",
    });
  } else if (!ISO_DATE_PATTERN.test(fm.date)) {
    errors.push({
      field: "date",
      constraint: "date_invalid",
      message: "Date must be ISO format YYYY-MM-DD",
    });
  }

  return errors;
}
