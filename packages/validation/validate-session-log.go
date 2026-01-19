package validation

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// SessionLogValidationResult extends ValidationResult with session-specific fields.
type SessionLogValidationResult struct {
	ValidationResult
	SessionLogPath string `json:"sessionLogPath,omitempty"`
}

// ValidateSessionLog validates a session log file for completeness.
// It checks:
// - File exists
// - Filename matches YYYY-MM-DD-session-NN.md pattern
// - Required sections are present
// - Session End checklist items are completed
func ValidateSessionLog(sessionLogPath string) SessionLogValidationResult {
	var checks []Check
	allPassed := true

	// Check 1: File exists
	if _, err := os.Stat(sessionLogPath); os.IsNotExist(err) {
		return SessionLogValidationResult{
			ValidationResult: ValidationResult{
				Valid:       false,
				Message:     "Session log file not found",
				Remediation: "Create session log at: " + sessionLogPath,
				Checks: []Check{{
					Name:    "file_exists",
					Passed:  false,
					Message: "File not found: " + sessionLogPath,
				}},
			},
			SessionLogPath: sessionLogPath,
		}
	}
	checks = append(checks, Check{
		Name:    "file_exists",
		Passed:  true,
		Message: "Session log file exists",
	})

	// Check 2: Filename format
	filename := filepath.Base(sessionLogPath)
	filenamePattern := regexp.MustCompile(`^\d{4}-\d{2}-\d{2}-session-\d+\.md$`)
	if filenamePattern.MatchString(filename) {
		checks = append(checks, Check{
			Name:    "filename_format",
			Passed:  true,
			Message: "Filename matches YYYY-MM-DD-session-NN.md pattern",
		})
	} else {
		checks = append(checks, Check{
			Name:    "filename_format",
			Passed:  false,
			Message: "Filename does not match expected pattern: " + filename,
		})
		allPassed = false
	}

	// Read file content
	content, err := os.ReadFile(sessionLogPath)
	if err != nil {
		checks = append(checks, Check{
			Name:    "file_readable",
			Passed:  false,
			Message: "Could not read file: " + err.Error(),
		})
		return SessionLogValidationResult{
			ValidationResult: ValidationResult{
				Valid:       false,
				Message:     "Could not read session log",
				Checks:      checks,
				Remediation: "Ensure file is readable",
			},
			SessionLogPath: sessionLogPath,
		}
	}

	contentStr := string(content)

	// Check 3: Required sections present
	requiredSections := []string{
		"Session Start",
		"Session End",
	}

	for _, section := range requiredSections {
		if strings.Contains(contentStr, "## "+section) || strings.Contains(contentStr, "### "+section) {
			checks = append(checks, Check{
				Name:    "section_" + strings.ToLower(strings.ReplaceAll(section, " ", "_")),
				Passed:  true,
				Message: "Section present: " + section,
			})
		} else {
			checks = append(checks, Check{
				Name:    "section_" + strings.ToLower(strings.ReplaceAll(section, " ", "_")),
				Passed:  false,
				Message: "Missing required section: " + section,
			})
			allPassed = false
		}
	}

	// Check 4: Session End checklist completion
	// Look for unchecked items in Session End section
	sessionEndIdx := strings.Index(contentStr, "Session End")
	if sessionEndIdx >= 0 {
		sessionEndContent := contentStr[sessionEndIdx:]

		// Find next section or end of file
		nextSectionIdx := strings.Index(sessionEndContent[1:], "\n## ")
		if nextSectionIdx > 0 {
			sessionEndContent = sessionEndContent[:nextSectionIdx+1]
		}

		// Count unchecked items ([ ] pattern)
		uncheckedPattern := regexp.MustCompile(`\[ \]`)
		uncheckedMatches := uncheckedPattern.FindAllString(sessionEndContent, -1)

		if len(uncheckedMatches) == 0 {
			checks = append(checks, Check{
				Name:    "checklist_complete",
				Passed:  true,
				Message: "All Session End checklist items completed",
			})
		} else {
			checks = append(checks, Check{
				Name:    "checklist_complete",
				Passed:  false,
				Message: fmt.Sprintf("Uncompleted checklist items: %d", len(uncheckedMatches)),
			})
			allPassed = false
		}
	}

	// Check 5: Brain memory update evidence
	if strings.Contains(contentStr, "Brain") && (strings.Contains(contentStr, "memory") || strings.Contains(contentStr, "MCP")) {
		checks = append(checks, Check{
			Name:    "brain_reference",
			Passed:  true,
			Message: "Brain memory referenced in session",
		})
	} else {
		checks = append(checks, Check{
			Name:    "brain_reference",
			Passed:  false,
			Message: "No Brain memory reference found",
		})
		// This is a warning, not a failure
	}

	result := SessionLogValidationResult{
		ValidationResult: ValidationResult{
			Valid:  allPassed,
			Checks: checks,
		},
		SessionLogPath: sessionLogPath,
	}

	if allPassed {
		result.Message = "Session log validation passed"
	} else {
		result.Message = "Session log validation failed"
		result.Remediation = "Complete all checklist items and ensure required sections are present"
	}

	return result
}

