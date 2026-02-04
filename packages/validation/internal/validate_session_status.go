// Package internal provides session status validation for session note frontmatter.
//
// These validators check session lifecycle status (IN_PROGRESS, PAUSED, COMPLETE).
//
// IMPORTANT: These validators must produce identical results to the TypeScript validators
// in packages/validation/src/session-status-validators.ts for cross-language parity.
package internal

import (
	"regexp"
)

// SessionStatus represents valid session lifecycle statuses.
type SessionStatus string

const (
	StatusInProgress SessionStatus = "IN_PROGRESS"
	StatusPaused     SessionStatus = "PAUSED"
	StatusComplete   SessionStatus = "COMPLETE"
)

// validStatuses contains all valid session status values.
var validStatuses = map[string]bool{
	"IN_PROGRESS": true,
	"PAUSED":      true,
	"COMPLETE":    true,
}

// sessionTitlePattern matches: SESSION-YYYY-MM-DD_NN-topic
// Example: SESSION-2026-02-04_01-feature-implementation
var sessionTitlePattern = regexp.MustCompile(`^SESSION-\d{4}-\d{2}-\d{2}_\d{2}-[\w-]+$`)

// isoDatePattern matches: YYYY-MM-DD with leading zeros
var isoDatePattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// SessionStatusValidation represents the result of session status validation.
type SessionStatusValidation struct {
	Valid  bool              `json:"valid"`
	Status string            `json:"status,omitempty"`
	Errors []ValidationError `json:"errors"`
}

// IsValidSessionStatus checks if a status string is a valid session status.
// Returns true if status is one of: IN_PROGRESS, PAUSED, COMPLETE.
func IsValidSessionStatus(status string) bool {
	return validStatuses[status]
}

// ValidateSessionStatus validates session note frontmatter for status compliance.
//
// Validation rules:
// 1. frontmatter MUST be a non-null map
// 2. status field MUST be present (string, not null/undefined)
// 3. status value MUST be one of: IN_PROGRESS, PAUSED, COMPLETE
// 4. type field MUST equal "session"
// 5. title field MUST match pattern SESSION-YYYY-MM-DD_NN-topic
// 6. date field MUST be valid ISO date (YYYY-MM-DD)
func ValidateSessionStatus(frontmatter map[string]interface{}) SessionStatusValidation {
	errors := GetSessionStatusErrors(frontmatter)

	if len(errors) == 0 {
		status, _ := frontmatter["status"].(string)
		return SessionStatusValidation{
			Valid:  true,
			Status: status,
			Errors: []ValidationError{},
		}
	}

	return SessionStatusValidation{
		Valid:  false,
		Errors: errors,
	}
}

// GetSessionStatusErrors returns validation errors for session note frontmatter.
// Returns empty slice if valid.
func GetSessionStatusErrors(frontmatter map[string]interface{}) []ValidationError {
	var errors []ValidationError

	// Rule 1: frontmatter MUST be a non-null map
	if frontmatter == nil {
		errors = append(errors, ValidationError{
			Field:      "",
			Constraint: "frontmatter_required",
			Message:    "Frontmatter is required and must be an object",
		})
		return errors
	}

	// Rule 5: title field MUST match pattern SESSION-YYYY-MM-DD_NN-topic
	titleVal, titleExists := frontmatter["title"]
	if !titleExists || titleVal == nil {
		errors = append(errors, ValidationError{
			Field:      "title",
			Constraint: "title_required",
			Message:    "Title field is required",
		})
	} else {
		titleStr, isString := titleVal.(string)
		if !isString {
			errors = append(errors, ValidationError{
				Field:      "title",
				Constraint: "title_invalid",
				Message:    "Title must be a string",
			})
		} else if !sessionTitlePattern.MatchString(titleStr) {
			errors = append(errors, ValidationError{
				Field:      "title",
				Constraint: "title_invalid",
				Message:    "Title must match pattern SESSION-YYYY-MM-DD_NN-topic",
			})
		}
	}

	// Rule 4: type field MUST equal "session"
	typeVal, typeExists := frontmatter["type"]
	if !typeExists || typeVal == nil {
		errors = append(errors, ValidationError{
			Field:      "type",
			Constraint: "type_required",
			Message:    "Type field is required",
		})
	} else {
		typeStr, isString := typeVal.(string)
		if !isString || typeStr != "session" {
			errors = append(errors, ValidationError{
				Field:      "type",
				Constraint: "type_invalid",
				Message:    `Type must be "session"`,
			})
		}
	}

	// Rule 2 & 3: status field MUST be present and valid
	statusVal, statusExists := frontmatter["status"]
	if !statusExists || statusVal == nil {
		errors = append(errors, ValidationError{
			Field:      "status",
			Constraint: "status_required",
			Message:    "Status field is required",
		})
	} else {
		statusStr, isString := statusVal.(string)
		if !isString || !IsValidSessionStatus(statusStr) {
			errors = append(errors, ValidationError{
				Field:      "status",
				Constraint: "status_invalid",
				Message:    "Status must be one of: IN_PROGRESS, PAUSED, COMPLETE",
			})
		}
	}

	// Rule 6: date field MUST be valid ISO date (YYYY-MM-DD)
	dateVal, dateExists := frontmatter["date"]
	if !dateExists || dateVal == nil {
		errors = append(errors, ValidationError{
			Field:      "date",
			Constraint: "date_required",
			Message:    "Date field is required",
		})
	} else {
		dateStr, isString := dateVal.(string)
		if !isString {
			errors = append(errors, ValidationError{
				Field:      "date",
				Constraint: "date_invalid",
				Message:    "Date must be a string",
			})
		} else if !isoDatePattern.MatchString(dateStr) {
			errors = append(errors, ValidationError{
				Field:      "date",
				Constraint: "date_invalid",
				Message:    "Date must be ISO format YYYY-MM-DD",
			})
		}
	}

	return errors
}

// ValidateSessionStatusFromAny validates session status from an arbitrary value.
// This handles the case where frontmatter might not be a map (e.g., from JSON parsing).
func ValidateSessionStatusFromAny(value interface{}) SessionStatusValidation {
	// Check if value is nil
	if value == nil {
		return SessionStatusValidation{
			Valid: false,
			Errors: []ValidationError{{
				Field:      "",
				Constraint: "frontmatter_required",
				Message:    "Frontmatter is required and must be an object",
			}},
		}
	}

	// Check if value is a map
	fm, ok := value.(map[string]interface{})
	if !ok {
		return SessionStatusValidation{
			Valid: false,
			Errors: []ValidationError{{
				Field:      "",
				Constraint: "frontmatter_required",
				Message:    "Frontmatter must be an object, not array or primitive",
			}},
		}
	}

	return ValidateSessionStatus(fm)
}
