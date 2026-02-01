package internal

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	

)

// ValidateSessionProtocol performs comprehensive session protocol validation.
// It validates both session log completeness and protocol compliance per SESSION-PROTOCOL.md.
//
// Checks performed:
// - File exists and has correct naming pattern
// - Session Start checklist MUST items are completed
// - Session End checklist MUST items are completed
// - Brain MCP initialization evidence present
// - Brain note update evidence present
// - Git branch documented
// - All required sections present
func ValidateSessionProtocol(sessionLogPath string) SessionProtocolValidationResult {
	var checks []Check
	allPassed := true

	result := SessionProtocolValidationResult{
		SessionLogPath: sessionLogPath,
	}

	// Check 1: File exists
	if _, err := os.Stat(sessionLogPath); os.IsNotExist(err) {
		return SessionProtocolValidationResult{
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
		result.ValidationResult = ValidationResult{
			Valid:       false,
			Message:     "Could not read session log",
			Checks:      checks,
			Remediation: "Ensure file is readable",
		}
		return result
	}

	contentStr := string(content)

	// Check 3: Required sections present
	requiredSections := []string{
		"Session Info",
		"Protocol Compliance",
		"Session Start",
		"Session End",
	}

	for _, section := range requiredSections {
		sectionKey := "section_" + strings.ToLower(strings.ReplaceAll(section, " ", "_"))
		if containsSection(contentStr, section) {
			checks = append(checks, Check{
				Name:    sectionKey,
				Passed:  true,
				Message: "Section present: " + section,
			})
		} else {
			checks = append(checks, Check{
				Name:    sectionKey,
				Passed:  false,
				Message: "Missing required section: " + section,
			})
			allPassed = false
		}
	}

	// Check 4: Session Start checklist validation
	startChecklist := ValidateChecklist(contentStr, "Session Start")
	result.StartChecklist = startChecklist

	if startChecklist.TotalMustItems > 0 {
		if startChecklist.CompletedMustItems == startChecklist.TotalMustItems {
			checks = append(checks, Check{
				Name:    "start_must_items",
				Passed:  true,
				Message: fmt.Sprintf("All %d Session Start MUST items completed", startChecklist.TotalMustItems),
			})
		} else {
			checks = append(checks, Check{
				Name:    "start_must_items",
				Passed:  false,
				Message: fmt.Sprintf("Session Start: %d/%d MUST items completed. Missing: %s",
					startChecklist.CompletedMustItems, startChecklist.TotalMustItems,
					strings.Join(startChecklist.MissingMustItems, ", ")),
			})
			allPassed = false
		}
	}

	// Check 5: Session End checklist validation
	endChecklist := ValidateChecklist(contentStr, "Session End")
	result.EndChecklist = endChecklist

	if endChecklist.TotalMustItems > 0 {
		if endChecklist.CompletedMustItems == endChecklist.TotalMustItems {
			checks = append(checks, Check{
				Name:    "end_must_items",
				Passed:  true,
				Message: fmt.Sprintf("All %d Session End MUST items completed", endChecklist.TotalMustItems),
			})
		} else {
			checks = append(checks, Check{
				Name:    "end_must_items",
				Passed:  false,
				Message: fmt.Sprintf("Session End: %d/%d MUST items completed. Missing: %s",
					endChecklist.CompletedMustItems, endChecklist.TotalMustItems,
					strings.Join(endChecklist.MissingMustItems, ", ")),
			})
			allPassed = false
		}
	}

	// Check 6: Brain MCP initialization evidence
	brainInitialized := CheckBrainInitialization(contentStr)
	result.BrainInitialized = brainInitialized

	if brainInitialized {
		checks = append(checks, Check{
			Name:    "brain_initialized",
			Passed:  true,
			Message: "Brain MCP initialization evidence found",
		})
	} else {
		checks = append(checks, Check{
			Name:    "brain_initialized",
			Passed:  false,
			Message: "No Brain MCP initialization evidence (mcp__plugin_brain_brain__build_context or bootstrap_context)",
		})
		allPassed = false
	}

	// Check 7: Brain note update evidence
	brainUpdated := CheckBrainUpdate(contentStr)
	result.BrainUpdated = brainUpdated

	if brainUpdated {
		checks = append(checks, Check{
			Name:    "brain_updated",
			Passed:  true,
			Message: "Brain note update evidence found",
		})
	} else {
		checks = append(checks, Check{
			Name:    "brain_updated",
			Passed:  false,
			Message: "No Brain note update evidence (write_note, edit_note, or 'Note write confirmed')",
		})
		// This is a MUST requirement per SESSION-PROTOCOL.md
		allPassed = false
	}

	// Check 8: Git branch documented
	branchDocumented := CheckBranchDocumented(contentStr)
	if branchDocumented {
		checks = append(checks, Check{
			Name:    "branch_documented",
			Passed:  true,
			Message: "Git branch documented in session log",
		})
	} else {
		checks = append(checks, Check{
			Name:    "branch_documented",
			Passed:  false,
			Message: "Git branch not documented in Session Info or Branch Verification section",
		})
		allPassed = false
	}

	// Check 9: Commit SHA evidence (for Session End)
	commitEvidence := CheckCommitEvidence(contentStr)
	if commitEvidence {
		checks = append(checks, Check{
			Name:    "commit_evidence",
			Passed:  true,
			Message: "Commit SHA evidence found in session log",
		})
	} else {
		checks = append(checks, Check{
			Name:    "commit_evidence",
			Passed:  false,
			Message: "No commit SHA evidence found (expected: Commit SHA: [hash])",
		})
		allPassed = false
	}

	// Check 10: Markdown lint evidence
	lintEvidence := CheckLintEvidence(contentStr)
	if lintEvidence {
		checks = append(checks, Check{
			Name:    "lint_evidence",
			Passed:  true,
			Message: "Markdown lint execution evidence found",
		})
	} else {
		checks = append(checks, Check{
			Name:    "lint_evidence",
			Passed:  false,
			Message: "No markdown lint evidence found",
		})
		allPassed = false
	}

	// Build final result
	result.ValidationResult = ValidationResult{
		Valid:  allPassed,
		Checks: checks,
	}

	if allPassed {
		result.Message = "Session protocol validation passed"
	} else {
		result.Message = "Session protocol validation failed"
		result.Remediation = buildRemediation(checks)
	}

	return result
}

// containsSection checks if a section header exists in the content.
func containsSection(content, section string) bool {
	// Check for ## or ### heading format
	patterns := []string{
		"## " + section,
		"### " + section,
	}
	for _, pattern := range patterns {
		if strings.Contains(content, pattern) {
			return true
		}
	}
	return false
}

// ValidateChecklist extracts and validates checklist items from a section.
func ValidateChecklist(content, sectionName string) ChecklistValidation {
	result := ChecklistValidation{}

	// Find section content
	sectionContent := ExtractSection(content, sectionName)
	if sectionContent == "" {
		return result
	}

	// Parse table rows for checklist items
	// Format: | Req | Step | Status | Evidence |
	// Status is [ ] (unchecked) or [x] (checked)
	lines := strings.Split(sectionContent, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "|") {
			continue
		}

		// Split table row into cells
		cells := strings.Split(line, "|")
		if len(cells) < 4 {
			continue
		}

		// Extract requirement level (MUST, SHOULD, MAY)
		reqCell := strings.TrimSpace(cells[1])
		reqLevel := strings.ToUpper(reqCell)

		// Extract step description
		stepCell := strings.TrimSpace(cells[2])
		if stepCell == "" || stepCell == "Step" {
			continue // Skip header row
		}

		// Extract status
		statusCell := strings.TrimSpace(cells[3])
		completed := strings.Contains(statusCell, "[x]") || strings.Contains(statusCell, "[X]")

		// Count based on requirement level
		switch reqLevel {
		case "MUST":
			result.TotalMustItems++
			if completed {
				result.CompletedMustItems++
			} else {
				// Truncate step description for readability
				shortDesc := TruncateString(stepCell, 50)
				result.MissingMustItems = append(result.MissingMustItems, shortDesc)
			}
		case "SHOULD":
			result.TotalShouldItems++
			if completed {
				result.CompletedShouldItems++
			} else {
				shortDesc := TruncateString(stepCell, 50)
				result.MissingShouldItems = append(result.MissingShouldItems, shortDesc)
			}
		}
	}

	return result
}

// ExtractSection extracts content from a specific section until the next section.
func ExtractSection(content, sectionName string) string {
	// Find section start
	patterns := []string{"### " + sectionName, "## " + sectionName}
	startIdx := -1
	for _, pattern := range patterns {
		idx := strings.Index(content, pattern)
		if idx >= 0 {
			startIdx = idx
			break
		}
	}

	if startIdx < 0 {
		return ""
	}

	// Find section end (next ## or ### header)
	sectionContent := content[startIdx:]
	nextSectionPattern := regexp.MustCompile(`\n#{2,3} [A-Z]`)
	loc := nextSectionPattern.FindStringIndex(sectionContent[1:])
	if loc != nil {
		sectionContent = sectionContent[:loc[0]+1]
	}

	return sectionContent
}

// CheckBrainInitialization checks for Brain MCP initialization evidence.
func CheckBrainInitialization(content string) bool {
	patterns := []string{
		"mcp__plugin_brain_brain__build_context",
		"mcp__plugin_brain_brain__bootstrap_context",
		"brain__build_context",
		"brain__bootstrap_context",
		"Brain MCP initialized",
		"Initialize Brain",
	}

	contentLower := strings.ToLower(content)
	for _, pattern := range patterns {
		if strings.Contains(contentLower, strings.ToLower(pattern)) {
			return true
		}
	}
	return false
}

// CheckBrainUpdate checks for Brain note update evidence.
func CheckBrainUpdate(content string) bool {
	patterns := []string{
		"mcp__plugin_brain_brain__write_note",
		"mcp__plugin_brain_brain__edit_note",
		"brain__write_note",
		"brain__edit_note",
		"Note write confirmed",
		"note write confirmed",
		"Brain note updated",
		"Update Brain note",
	}

	contentLower := strings.ToLower(content)
	for _, pattern := range patterns {
		if strings.Contains(contentLower, strings.ToLower(pattern)) {
			return true
		}
	}
	return false
}

// CheckBranchDocumented checks if git branch is documented.
func CheckBranchDocumented(content string) bool {
	patterns := []string{
		"**Branch**:",
		"Branch:",
		"Current Branch:",
		"- Branch:",
	}

	for _, pattern := range patterns {
		if strings.Contains(content, pattern) {
			// Verify there's actual content after the pattern (not just placeholder)
			idx := strings.Index(content, pattern)
			if idx >= 0 {
				afterPattern := content[idx+len(pattern):]
				// Get first line after pattern
				endIdx := strings.Index(afterPattern, "\n")
				if endIdx < 0 {
					endIdx = len(afterPattern)
				}
				value := strings.TrimSpace(afterPattern[:endIdx])
				// Check it's not a placeholder
				if value != "" && value != "[branch name]" && value != "[branch name - REQUIRED]" {
					return true
				}
			}
		}
	}
	return false
}

// CheckCommitEvidence checks for commit SHA evidence.
func CheckCommitEvidence(content string) bool {
	// Look for commit SHA patterns
	patterns := []regexp.Regexp{
		*regexp.MustCompile(`Commit SHA:\s*[a-f0-9]{7,40}`),
		*regexp.MustCompile(`\x60[a-f0-9]{7,40}\x60\s*-\s*`), // `SHA` - message format
		*regexp.MustCompile(`SHA:\s*[a-f0-9]{7,40}`),
	}

	for _, pattern := range patterns {
		if pattern.MatchString(content) {
			return true
		}
	}
	return false
}

// CheckLintEvidence checks for markdown lint evidence.
func CheckLintEvidence(content string) bool {
	patterns := []string{
		"markdownlint",
		"Lint output",
		"lint output",
		"Lint Output",
		"npx markdownlint-cli2",
	}

	contentLower := strings.ToLower(content)
	for _, pattern := range patterns {
		if strings.Contains(contentLower, strings.ToLower(pattern)) {
			return true
		}
	}
	return false
}

// TruncateString truncates a string to maxLen characters with ellipsis.
func TruncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// buildRemediation builds a remediation message from failed checks.
func buildRemediation(checks []Check) string {
	var failedChecks []string
	for _, check := range checks {
		if !check.Passed {
			failedChecks = append(failedChecks, check.Name)
		}
	}

	if len(failedChecks) == 0 {
		return ""
	}

	return fmt.Sprintf("Fix the following checks: %s. See SESSION-PROTOCOL.md for requirements.",
		strings.Join(failedChecks, ", "))
}

// ValidateSessionProtocolFromContent validates session protocol from content string.
// Useful for testing or when content is already loaded.
func ValidateSessionProtocolFromContent(content string, sessionLogPath string) SessionProtocolValidationResult {
	var checks []Check
	allPassed := true

	result := SessionProtocolValidationResult{
		SessionLogPath: sessionLogPath,
	}

	// Check 1: Filename format (if path provided)
	if sessionLogPath != "" {
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
	}

	// Check 2: Required sections present
	requiredSections := []string{
		"Session Info",
		"Protocol Compliance",
		"Session Start",
		"Session End",
	}

	for _, section := range requiredSections {
		sectionKey := "section_" + strings.ToLower(strings.ReplaceAll(section, " ", "_"))
		if containsSection(content, section) {
			checks = append(checks, Check{
				Name:    sectionKey,
				Passed:  true,
				Message: "Section present: " + section,
			})
		} else {
			checks = append(checks, Check{
				Name:    sectionKey,
				Passed:  false,
				Message: "Missing required section: " + section,
			})
			allPassed = false
		}
	}

	// Check 3: Session Start checklist validation
	startChecklist := ValidateChecklist(content, "Session Start")
	result.StartChecklist = startChecklist

	if startChecklist.TotalMustItems > 0 {
		if startChecklist.CompletedMustItems == startChecklist.TotalMustItems {
			checks = append(checks, Check{
				Name:    "start_must_items",
				Passed:  true,
				Message: fmt.Sprintf("All %d Session Start MUST items completed", startChecklist.TotalMustItems),
			})
		} else {
			checks = append(checks, Check{
				Name:    "start_must_items",
				Passed:  false,
				Message: fmt.Sprintf("Session Start: %d/%d MUST items completed",
					startChecklist.CompletedMustItems, startChecklist.TotalMustItems),
			})
			allPassed = false
		}
	}

	// Check 4: Session End checklist validation
	endChecklist := ValidateChecklist(content, "Session End")
	result.EndChecklist = endChecklist

	if endChecklist.TotalMustItems > 0 {
		if endChecklist.CompletedMustItems == endChecklist.TotalMustItems {
			checks = append(checks, Check{
				Name:    "end_must_items",
				Passed:  true,
				Message: fmt.Sprintf("All %d Session End MUST items completed", endChecklist.TotalMustItems),
			})
		} else {
			checks = append(checks, Check{
				Name:    "end_must_items",
				Passed:  false,
				Message: fmt.Sprintf("Session End: %d/%d MUST items completed",
					endChecklist.CompletedMustItems, endChecklist.TotalMustItems),
			})
			allPassed = false
		}
	}

	// Check 5: Brain MCP initialization evidence
	brainInitialized := CheckBrainInitialization(content)
	result.BrainInitialized = brainInitialized

	if brainInitialized {
		checks = append(checks, Check{
			Name:    "brain_initialized",
			Passed:  true,
			Message: "Brain MCP initialization evidence found",
		})
	} else {
		checks = append(checks, Check{
			Name:    "brain_initialized",
			Passed:  false,
			Message: "No Brain MCP initialization evidence",
		})
		allPassed = false
	}

	// Check 6: Brain note update evidence
	brainUpdated := CheckBrainUpdate(content)
	result.BrainUpdated = brainUpdated

	if brainUpdated {
		checks = append(checks, Check{
			Name:    "brain_updated",
			Passed:  true,
			Message: "Brain note update evidence found",
		})
	} else {
		checks = append(checks, Check{
			Name:    "brain_updated",
			Passed:  false,
			Message: "No Brain note update evidence",
		})
		allPassed = false
	}

	// Check 7: Git branch documented
	branchDocumented := CheckBranchDocumented(content)
	if branchDocumented {
		checks = append(checks, Check{
			Name:    "branch_documented",
			Passed:  true,
			Message: "Git branch documented in session log",
		})
	} else {
		checks = append(checks, Check{
			Name:    "branch_documented",
			Passed:  false,
			Message: "Git branch not documented",
		})
		allPassed = false
	}

	// Check 8: Commit SHA evidence
	commitEvidence := CheckCommitEvidence(content)
	if commitEvidence {
		checks = append(checks, Check{
			Name:    "commit_evidence",
			Passed:  true,
			Message: "Commit SHA evidence found",
		})
	} else {
		checks = append(checks, Check{
			Name:    "commit_evidence",
			Passed:  false,
			Message: "No commit SHA evidence found",
		})
		allPassed = false
	}

	// Check 9: Markdown lint evidence
	lintEvidence := CheckLintEvidence(content)
	if lintEvidence {
		checks = append(checks, Check{
			Name:    "lint_evidence",
			Passed:  true,
			Message: "Markdown lint execution evidence found",
		})
	} else {
		checks = append(checks, Check{
			Name:    "lint_evidence",
			Passed:  false,
			Message: "No markdown lint evidence found",
		})
		allPassed = false
	}

	// Build final result
	result.ValidationResult = ValidationResult{
		Valid:  allPassed,
		Checks: checks,
	}

	if allPassed {
		result.Message = "Session protocol validation passed"
	} else {
		result.Message = "Session protocol validation failed"
		result.Remediation = buildRemediation(checks)
	}

	return result
}
