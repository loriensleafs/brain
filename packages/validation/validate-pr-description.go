package validation

import (
	"regexp"
	"strings"
)

// PRDescriptionValidationResult extends ValidationResult with PR description-specific fields.
type PRDescriptionValidationResult struct {
	ValidationResult
	PRNumber           int                     `json:"prNumber,omitempty"`
	FilesInPR          []string                `json:"filesInPR"`
	MentionedFiles     []string                `json:"mentionedFiles"`
	Issues             []PRDescriptionIssue    `json:"issues"`
	CriticalCount      int                     `json:"criticalCount"`
	WarningCount       int                     `json:"warningCount"`
}

// PRDescriptionIssue represents a single issue found in PR description validation.
type PRDescriptionIssue struct {
	Severity string `json:"severity"` // CRITICAL or WARNING
	Type     string `json:"type"`
	File     string `json:"file"`
	Message  string `json:"message"`
}

// PRDescriptionConfig contains configuration for PR description validation.
type PRDescriptionConfig struct {
	// Description is the PR body/description text
	Description string
	// FilesInPR is the list of files changed in the PR
	FilesInPR []string
	// SignificantExtensions are file extensions considered significant for warning
	SignificantExtensions []string
	// SignificantPaths are path prefixes for files that should be mentioned
	SignificantPaths []string
}

// DefaultPRDescriptionConfig returns default configuration.
func DefaultPRDescriptionConfig() PRDescriptionConfig {
	return PRDescriptionConfig{
		SignificantExtensions: []string{".ps1", ".cs", ".ts", ".js", ".py", ".yml", ".yaml", ".go"},
		SignificantPaths:      []string{".github", "scripts", "src", ".agents", "cmd", "pkg", "internal"},
	}
}

// filePatterns are regex patterns to extract file references from PR description.
var filePatterns = []*regexp.Regexp{
	// Inline code with common extensions
	regexp.MustCompile("`([^`]+\\.(ps1|psm1|md|yml|yaml|json|cs|ts|tsx|js|jsx|py|sh|bash|go|rs|java|kt))`"),
	// Bold text with extensions
	regexp.MustCompile(`\*\*([^*]+\.(ps1|psm1|md|yml|yaml|json|cs|ts|tsx|js|jsx|py|sh|bash|go|rs|java|kt))\*\*`),
	// List items starting with file paths (exclude backticks and asterisks to avoid matching formatted text)
	regexp.MustCompile(`(?m)^\s*[-*+]\s+([^\s\x60*]+\.(ps1|psm1|md|yml|yaml|json|cs|ts|tsx|js|jsx|py|sh|bash|go|rs|java|kt))(?:\s|$)`),
	// Markdown links with file extensions (link text, not URL)
	regexp.MustCompile(`\[([^\]]+\.(ps1|psm1|md|yml|yaml|json|cs|ts|tsx|js|jsx|py|sh|bash|go|rs|java|kt))\]`),
}

// ValidatePRDescription validates PR description against actual file changes.
// description is the PR body text, filesInPR is the list of files changed in the PR.
func ValidatePRDescription(description string, filesInPR []string) PRDescriptionValidationResult {
	config := DefaultPRDescriptionConfig()
	config.Description = description
	config.FilesInPR = filesInPR
	return ValidatePRDescriptionWithConfig(config)
}

// ValidatePRDescriptionWithConfig validates PR description with custom configuration.
func ValidatePRDescriptionWithConfig(config PRDescriptionConfig) PRDescriptionValidationResult {
	var checks []Check
	var issues []PRDescriptionIssue

	result := PRDescriptionValidationResult{
		FilesInPR: config.FilesInPR,
	}

	// Extract files mentioned in description
	mentionedFiles := extractMentionedFiles(config.Description)
	result.MentionedFiles = mentionedFiles

	// Check 1: Files mentioned but not in diff (CRITICAL)
	for _, mentioned := range mentionedFiles {
		if !fileInPR(mentioned, config.FilesInPR) {
			issue := PRDescriptionIssue{
				Severity: "CRITICAL",
				Type:     "File mentioned but not in diff",
				File:     mentioned,
				Message:  "Description claims this file was changed, but it is not in the PR diff",
			}
			issues = append(issues, issue)
			result.CriticalCount++
		}
	}

	// Check 2: Significant files changed but not mentioned (WARNING)
	significantChanges := filterSignificantFiles(config.FilesInPR, config.SignificantExtensions)
	for _, changed := range significantChanges {
		if !fileIsMentioned(changed, mentionedFiles) {
			// Only warn about files in key directories
			if isInSignificantPath(changed, config.SignificantPaths) {
				issue := PRDescriptionIssue{
					Severity: "WARNING",
					Type:     "Significant file not mentioned",
					File:     changed,
					Message:  "This file was changed but not mentioned in the description",
				}
				issues = append(issues, issue)
				result.WarningCount++
			}
		}
	}

	result.Issues = issues

	// Build checks for validation result
	if result.CriticalCount > 0 {
		checks = append(checks, Check{
			Name:    "files_mentioned_not_in_diff",
			Passed:  false,
			Message: itoa(result.CriticalCount) + " file(s) mentioned in description are not in the PR diff",
		})
	} else {
		checks = append(checks, Check{
			Name:    "files_mentioned_not_in_diff",
			Passed:  true,
			Message: "All mentioned files exist in PR diff",
		})
	}

	if result.WarningCount > 0 {
		checks = append(checks, Check{
			Name:    "significant_files_not_mentioned",
			Passed:  true, // Warnings are non-blocking
			Message: itoa(result.WarningCount) + " significant file(s) changed but not mentioned (warning only)",
		})
	} else {
		checks = append(checks, Check{
			Name:    "significant_files_not_mentioned",
			Passed:  true,
			Message: "All significant files are mentioned in description",
		})
	}

	result.ValidationResult = ValidationResult{
		Valid:  result.CriticalCount == 0,
		Checks: checks,
	}

	if result.CriticalCount == 0 && result.WarningCount == 0 {
		result.Message = "PR description matches diff (no mismatches found)"
	} else if result.CriticalCount == 0 {
		result.Message = "PR description valid with " + itoa(result.WarningCount) + " warning(s)"
	} else {
		result.Message = "PR description has " + itoa(result.CriticalCount) + " critical issue(s)"
		result.Remediation = "Update PR description to match actual changes. Remove references to files not in the diff."
	}

	return result
}

// extractMentionedFiles extracts file paths from PR description using common patterns.
func extractMentionedFiles(description string) []string {
	var files []string
	seen := make(map[string]bool)

	for _, pattern := range filePatterns {
		matches := pattern.FindAllStringSubmatch(description, -1)
		for _, match := range matches {
			if len(match) > 1 {
				file := normalizePath(match[1])
				if !seen[file] {
					seen[file] = true
					files = append(files, file)
				}
			}
		}
	}

	return files
}

// normalizePath normalizes a file path for comparison.
func normalizePath(path string) string {
	// Normalize path separators
	path = strings.ReplaceAll(path, "\\", "/")
	// Remove leading ./
	path = strings.TrimPrefix(path, "./")
	return strings.TrimSpace(path)
}

// fileInPR checks if a mentioned file exists in the PR file list.
// Supports both exact match and suffix matching.
func fileInPR(mentioned string, filesInPR []string) bool {
	mentioned = normalizePath(mentioned)

	for _, actual := range filesInPR {
		actual = normalizePath(actual)

		// Exact match
		if actual == mentioned {
			return true
		}

		// Suffix match: "file.ps1" matches "path/to/file.ps1"
		if strings.HasSuffix(actual, "/"+mentioned) {
			return true
		}

		// Check if mentioned is a full path and actual is the same file
		if strings.HasSuffix(mentioned, "/"+getFileName(actual)) && getFileName(mentioned) == getFileName(actual) {
			return true
		}
	}

	return false
}

// fileIsMentioned checks if a changed file is mentioned in the description.
func fileIsMentioned(changed string, mentionedFiles []string) bool {
	changed = normalizePath(changed)
	changedBase := getFileName(changed)

	for _, mentioned := range mentionedFiles {
		mentioned = normalizePath(mentioned)

		// Exact match
		if changed == mentioned {
			return true
		}

		// Suffix match
		if strings.HasSuffix(changed, "/"+mentioned) {
			return true
		}

		// Base name match for short references
		if mentioned == changedBase {
			return true
		}
	}

	return false
}

// getFileName extracts the file name from a path.
func getFileName(path string) string {
	path = normalizePath(path)
	idx := strings.LastIndex(path, "/")
	if idx >= 0 {
		return path[idx+1:]
	}
	return path
}

// filterSignificantFiles filters files by significant extensions.
func filterSignificantFiles(files []string, significantExts []string) []string {
	var significant []string
	extSet := make(map[string]bool)
	for _, ext := range significantExts {
		extSet[strings.ToLower(ext)] = true
	}

	for _, file := range files {
		ext := getFileExtension(file)
		if extSet[strings.ToLower(ext)] {
			significant = append(significant, file)
		}
	}

	return significant
}

// getFileExtension extracts the file extension including the dot.
func getFileExtension(path string) string {
	fileName := getFileName(path)
	idx := strings.LastIndex(fileName, ".")
	if idx >= 0 {
		return fileName[idx:]
	}
	return ""
}

// isInSignificantPath checks if a file is in a significant path.
func isInSignificantPath(file string, significantPaths []string) bool {
	file = normalizePath(file)

	for _, prefix := range significantPaths {
		prefix = normalizePath(prefix)
		if strings.HasPrefix(file, prefix+"/") || strings.HasPrefix(file, prefix) {
			return true
		}
	}

	return false
}

// ValidatePRDescriptionSections validates that required PR template sections are present.
// This is a separate validation for template compliance.
func ValidatePRDescriptionSections(description string, requiredSections []string) ValidationResult {
	var checks []Check
	allPassed := true

	// Default required sections if not provided
	if len(requiredSections) == 0 {
		requiredSections = []string{"Summary", "Test Plan"}
	}

	for _, section := range requiredSections {
		// Check for section headers (## Section or ### Section)
		// Use (?im) for case-insensitive and multiline mode so ^ matches start of any line
		sectionPattern := regexp.MustCompile(`(?im)^##\s*` + regexp.QuoteMeta(section) + `|^###\s*` + regexp.QuoteMeta(section))
		if sectionPattern.MatchString(description) {
			checks = append(checks, Check{
				Name:    "section_" + strings.ToLower(strings.ReplaceAll(section, " ", "_")),
				Passed:  true,
				Message: "Section '" + section + "' present",
			})
		} else {
			allPassed = false
			checks = append(checks, Check{
				Name:    "section_" + strings.ToLower(strings.ReplaceAll(section, " ", "_")),
				Passed:  false,
				Message: "Required section '" + section + "' not found",
			})
		}
	}

	result := ValidationResult{
		Valid:  allPassed,
		Checks: checks,
	}

	if allPassed {
		result.Message = "All required PR sections present"
	} else {
		result.Message = "Missing required PR sections"
		result.Remediation = "Add missing sections to PR description per template requirements"
	}

	return result
}

// ValidatePRChecklist validates that checklist items in PR description are completed.
func ValidatePRChecklist(description string) ValidationResult {
	var checks []Check

	// Find all checklist items
	checklistPattern := regexp.MustCompile(`(?m)^\s*[-*]\s*\[([x ])\]\s*(.+)$`)
	matches := checklistPattern.FindAllStringSubmatch(description, -1)

	totalItems := len(matches)
	completedItems := 0
	incompleteItems := []string{}

	for _, match := range matches {
		if len(match) > 2 {
			isComplete := strings.ToLower(match[1]) == "x"
			itemText := strings.TrimSpace(match[2])

			if isComplete {
				completedItems++
			} else {
				incompleteItems = append(incompleteItems, itemText)
			}
		}
	}

	if totalItems == 0 {
		checks = append(checks, Check{
			Name:    "checklist_items",
			Passed:  true,
			Message: "No checklist items found",
		})
	} else if len(incompleteItems) == 0 {
		checks = append(checks, Check{
			Name:    "checklist_items",
			Passed:  true,
			Message: "All " + itoa(totalItems) + " checklist items completed",
		})
	} else {
		checks = append(checks, Check{
			Name:    "checklist_items",
			Passed:  false,
			Message: itoa(len(incompleteItems)) + " of " + itoa(totalItems) + " checklist items incomplete",
		})
	}

	allPassed := len(incompleteItems) == 0

	result := ValidationResult{
		Valid:  allPassed,
		Checks: checks,
	}

	if allPassed {
		result.Message = "PR checklist validation passed"
	} else {
		result.Message = "PR checklist has incomplete items"
		result.Remediation = "Complete all checklist items before merge: " + strings.Join(incompleteItems, "; ")
	}

	return result
}

// ValidatePRDescriptionFull performs complete PR description validation.
// This combines file mismatch detection, section validation, and checklist validation.
func ValidatePRDescriptionFull(description string, filesInPR []string, requiredSections []string) PRDescriptionValidationResult {
	// Start with file mismatch validation
	result := ValidatePRDescription(description, filesInPR)

	// Add section validation
	sectionResult := ValidatePRDescriptionSections(description, requiredSections)
	for _, check := range sectionResult.Checks {
		result.Checks = append(result.Checks, check)
		if !check.Passed {
			result.Valid = false
		}
	}

	// Add checklist validation
	checklistResult := ValidatePRChecklist(description)
	for _, check := range checklistResult.Checks {
		result.Checks = append(result.Checks, check)
		if !check.Passed {
			result.Valid = false
		}
	}

	// Update message
	if !result.Valid {
		var issues []string
		if result.CriticalCount > 0 {
			issues = append(issues, itoa(result.CriticalCount)+" file mismatch(es)")
		}
		if !sectionResult.Valid {
			issues = append(issues, "missing sections")
		}
		if !checklistResult.Valid {
			issues = append(issues, "incomplete checklist")
		}
		result.Message = "PR validation failed: " + strings.Join(issues, ", ")
		result.Remediation = "Fix: " + result.Remediation
		if !sectionResult.Valid {
			result.Remediation += "; " + sectionResult.Remediation
		}
		if !checklistResult.Valid {
			result.Remediation += "; " + checklistResult.Remediation
		}
	} else if result.WarningCount > 0 {
		result.Message = "PR validation passed with " + itoa(result.WarningCount) + " warning(s)"
	} else {
		result.Message = "PR validation passed"
	}

	return result
}
