package internal

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// SessionProtocolConfig holds schema-driven configuration for session protocol validation.
// This replaces hardcoded values with schema-defined patterns.
type SessionProtocolConfig struct {
	FilenamePattern             string   `json:"filenamePattern"`
	RequiredSections            []string `json:"requiredSections"`
	BrainInitializationPatterns []string `json:"brainInitializationPatterns"`
	BrainUpdatePatterns         []string `json:"brainUpdatePatterns"`
	BranchPatterns              []string `json:"branchPatterns"`
	BranchPlaceholders          []string `json:"branchPlaceholders"`
	CommitSHAPatterns           []string `json:"commitShaPatterns"`
	LintEvidencePatterns        []string `json:"lintEvidencePatterns"`
}

// DefaultSessionProtocolConfig returns the default configuration values.
// These match the schema defaults in session-protocol.schema.json.
var DefaultSessionProtocolConfig = SessionProtocolConfig{
	FilenamePattern: `^SESSION-\d{4}-\d{2}-\d{2}_\d{2}-.+\.md$`,
	RequiredSections: []string{
		"Session Info",
		"Protocol Compliance",
		"Session Start",
		"Session End",
	},
	BrainInitializationPatterns: []string{
		"mcp__plugin_brain_brain__build_context",
		"mcp__plugin_brain_brain__bootstrap_context",
		"brain__build_context",
		"brain__bootstrap_context",
		"Brain MCP initialized",
		"Initialize Brain",
	},
	BrainUpdatePatterns: []string{
		"mcp__plugin_brain_brain__write_note",
		"mcp__plugin_brain_brain__edit_note",
		"brain__write_note",
		"brain__edit_note",
		"Note write confirmed",
		"note write confirmed",
		"Brain note updated",
		"Update Brain note",
	},
	BranchPatterns: []string{
		"**Branch**:",
		"Branch:",
		"Current Branch:",
		"- Branch:",
	},
	BranchPlaceholders: []string{
		"[branch name]",
		"[branch name - REQUIRED]",
	},
	CommitSHAPatterns: []string{
		`Commit SHA:\s*[a-f0-9]{7,40}`,
		"`[a-f0-9]{7,40}`\\s*-\\s*",
		`SHA:\s*[a-f0-9]{7,40}`,
	},
	LintEvidencePatterns: []string{
		"markdownlint",
		"Lint output",
		"lint output",
		"Lint Output",
		"npx markdownlint-cli2",
	},
}

var (
	sessionProtocolSchemaOnce     sync.Once
	sessionProtocolSchemaCompiled *jsonschema.Schema
	sessionProtocolSchemaErr      error
	sessionProtocolSchemaData     []byte
)

// SetSessionProtocolSchemaData sets the schema data for session protocol validation.
// This must be called before any schema-based validation functions are used.
// The data is typically embedded by the parent package.
func SetSessionProtocolSchemaData(data []byte) {
	sessionProtocolSchemaData = data
}

// getSessionProtocolSchema returns the compiled session protocol schema, loading it once.
func getSessionProtocolSchema() (*jsonschema.Schema, error) {
	sessionProtocolSchemaOnce.Do(func() {
		if sessionProtocolSchemaData == nil {
			sessionProtocolSchemaErr = fmt.Errorf("session protocol schema data not set; call SetSessionProtocolSchemaData first")
			return
		}

		var schemaDoc any
		if err := json.Unmarshal(sessionProtocolSchemaData, &schemaDoc); err != nil {
			sessionProtocolSchemaErr = fmt.Errorf("failed to parse session protocol schema: %w", err)
			return
		}

		c := jsonschema.NewCompiler()
		if err := c.AddResource("session-protocol.schema.json", schemaDoc); err != nil {
			sessionProtocolSchemaErr = fmt.Errorf("failed to add session protocol schema resource: %w", err)
			return
		}

		sessionProtocolSchemaCompiled, sessionProtocolSchemaErr = c.Compile("session-protocol.schema.json")
	})
	return sessionProtocolSchemaCompiled, sessionProtocolSchemaErr
}

// ValidateSessionProtocolConfig validates configuration data against the session protocol schema.
// Returns true if valid, false otherwise.
func ValidateSessionProtocolConfigInput(data any) bool {
	schema, err := getSessionProtocolSchema()
	if err != nil {
		return false
	}

	err = schema.Validate(data)
	return err == nil
}

// GetSessionProtocolConfigErrors returns structured validation errors for configuration data.
// Returns empty slice if valid.
func GetSessionProtocolConfigErrors(data any) []ValidationError {
	schema, err := getSessionProtocolSchema()
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "schema",
			Message:    err.Error(),
		}}
	}

	err = schema.Validate(data)
	if err == nil {
		return []ValidationError{}
	}

	return ExtractValidationErrors(err)
}

// ValidateSessionProtocol performs comprehensive session protocol validation.
// It validates both session log completeness and protocol compliance per SESSION-PROTOCOL.md.
// Uses schema-driven configuration from DefaultSessionProtocolConfig.
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
	return ValidateSessionProtocolWithConfig(sessionLogPath, DefaultSessionProtocolConfig)
}

// ValidateSessionProtocolWithConfig performs session protocol validation using the provided configuration.
func ValidateSessionProtocolWithConfig(sessionLogPath string, config SessionProtocolConfig) SessionProtocolValidationResult {
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

	// Check 2: Filename format (using schema-defined pattern)
	filename := filepath.Base(sessionLogPath)
	filenamePattern := regexp.MustCompile(config.FilenamePattern)
	if filenamePattern.MatchString(filename) {
		checks = append(checks, Check{
			Name:    "filename_format",
			Passed:  true,
			Message: "Filename matches SESSION-YYYY-MM-DD_NN-topic.md pattern",
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

	// Check 3: Required sections present (using schema-defined sections)
	for _, section := range config.RequiredSections {
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
				Name:   "start_must_items",
				Passed: false,
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
				Name:   "end_must_items",
				Passed: false,
				Message: fmt.Sprintf("Session End: %d/%d MUST items completed. Missing: %s",
					endChecklist.CompletedMustItems, endChecklist.TotalMustItems,
					strings.Join(endChecklist.MissingMustItems, ", ")),
			})
			allPassed = false
		}
	}

	// Check 6: Brain MCP initialization evidence (using schema-defined patterns)
	brainInitialized := CheckBrainInitializationWithConfig(contentStr, config)
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

	// Check 7: Brain note update evidence (using schema-defined patterns)
	brainUpdated := CheckBrainUpdateWithConfig(contentStr, config)
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

	// Check 8: Git branch documented (using schema-defined patterns)
	branchDocumented := CheckBranchDocumentedWithConfig(contentStr, config)
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

	// Check 9: Commit SHA evidence (using schema-defined patterns)
	commitEvidence := CheckCommitEvidenceWithConfig(contentStr, config)
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

	// Check 10: Markdown lint evidence (using schema-defined patterns)
	lintEvidence := CheckLintEvidenceWithConfig(contentStr, config)
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
// Uses schema-driven patterns from DefaultSessionProtocolConfig.
func CheckBrainInitialization(content string) bool {
	return CheckBrainInitializationWithConfig(content, DefaultSessionProtocolConfig)
}

// CheckBrainInitializationWithConfig checks for Brain MCP initialization evidence using the provided configuration.
func CheckBrainInitializationWithConfig(content string, config SessionProtocolConfig) bool {
	contentLower := strings.ToLower(content)
	for _, pattern := range config.BrainInitializationPatterns {
		if strings.Contains(contentLower, strings.ToLower(pattern)) {
			return true
		}
	}
	return false
}

// CheckBrainUpdate checks for Brain note update evidence.
// Uses schema-driven patterns from DefaultSessionProtocolConfig.
func CheckBrainUpdate(content string) bool {
	return CheckBrainUpdateWithConfig(content, DefaultSessionProtocolConfig)
}

// CheckBrainUpdateWithConfig checks for Brain note update evidence using the provided configuration.
func CheckBrainUpdateWithConfig(content string, config SessionProtocolConfig) bool {
	contentLower := strings.ToLower(content)
	for _, pattern := range config.BrainUpdatePatterns {
		if strings.Contains(contentLower, strings.ToLower(pattern)) {
			return true
		}
	}
	return false
}

// CheckBranchDocumented checks if git branch is documented.
// Uses schema-driven patterns from DefaultSessionProtocolConfig.
func CheckBranchDocumented(content string) bool {
	return CheckBranchDocumentedWithConfig(content, DefaultSessionProtocolConfig)
}

// CheckBranchDocumentedWithConfig checks if git branch is documented using the provided configuration.
func CheckBranchDocumentedWithConfig(content string, config SessionProtocolConfig) bool {
	for _, pattern := range config.BranchPatterns {
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
				// Check it's not a placeholder (using schema-defined placeholders)
				if value != "" {
					isPlaceholder := false
					for _, placeholder := range config.BranchPlaceholders {
						if value == placeholder {
							isPlaceholder = true
							break
						}
					}
					if !isPlaceholder {
						return true
					}
				}
			}
		}
	}
	return false
}

// CheckCommitEvidence checks for commit SHA evidence.
// Uses schema-driven patterns from DefaultSessionProtocolConfig.
func CheckCommitEvidence(content string) bool {
	return CheckCommitEvidenceWithConfig(content, DefaultSessionProtocolConfig)
}

// CheckCommitEvidenceWithConfig checks for commit SHA evidence using the provided configuration.
func CheckCommitEvidenceWithConfig(content string, config SessionProtocolConfig) bool {
	// Look for commit SHA patterns (using schema-defined patterns)
	for _, patternStr := range config.CommitSHAPatterns {
		pattern := regexp.MustCompile(patternStr)
		if pattern.MatchString(content) {
			return true
		}
	}
	return false
}

// CheckLintEvidence checks for markdown lint evidence.
// Uses schema-driven patterns from DefaultSessionProtocolConfig.
func CheckLintEvidence(content string) bool {
	return CheckLintEvidenceWithConfig(content, DefaultSessionProtocolConfig)
}

// CheckLintEvidenceWithConfig checks for markdown lint evidence using the provided configuration.
func CheckLintEvidenceWithConfig(content string, config SessionProtocolConfig) bool {
	contentLower := strings.ToLower(content)
	for _, pattern := range config.LintEvidencePatterns {
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
// Uses schema-driven configuration from DefaultSessionProtocolConfig.
func ValidateSessionProtocolFromContent(content string, sessionLogPath string) SessionProtocolValidationResult {
	return ValidateSessionProtocolFromContentWithConfig(content, sessionLogPath, DefaultSessionProtocolConfig)
}

// ValidateSessionProtocolFromContentWithConfig validates session protocol from content using the provided configuration.
func ValidateSessionProtocolFromContentWithConfig(content string, sessionLogPath string, config SessionProtocolConfig) SessionProtocolValidationResult {
	var checks []Check
	allPassed := true

	result := SessionProtocolValidationResult{
		SessionLogPath: sessionLogPath,
	}

	// Check 1: Filename format (if path provided) - using schema-defined pattern
	if sessionLogPath != "" {
		filename := filepath.Base(sessionLogPath)
		filenamePattern := regexp.MustCompile(config.FilenamePattern)
		if filenamePattern.MatchString(filename) {
			checks = append(checks, Check{
				Name:    "filename_format",
				Passed:  true,
				Message: "Filename matches SESSION-YYYY-MM-DD_NN-topic.md pattern",
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

	// Check 2: Required sections present (using schema-defined sections)
	for _, section := range config.RequiredSections {
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
				Name:   "start_must_items",
				Passed: false,
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
				Name:   "end_must_items",
				Passed: false,
				Message: fmt.Sprintf("Session End: %d/%d MUST items completed",
					endChecklist.CompletedMustItems, endChecklist.TotalMustItems),
			})
			allPassed = false
		}
	}

	// Check 5: Brain MCP initialization evidence (using schema-defined patterns)
	brainInitialized := CheckBrainInitializationWithConfig(content, config)
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

	// Check 6: Brain note update evidence (using schema-defined patterns)
	brainUpdated := CheckBrainUpdateWithConfig(content, config)
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

	// Check 7: Git branch documented (using schema-defined patterns)
	branchDocumented := CheckBranchDocumentedWithConfig(content, config)
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

	// Check 8: Commit SHA evidence (using schema-defined patterns)
	commitEvidence := CheckCommitEvidenceWithConfig(content, config)
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

	// Check 9: Markdown lint evidence (using schema-defined patterns)
	lintEvidence := CheckLintEvidenceWithConfig(content, config)
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
