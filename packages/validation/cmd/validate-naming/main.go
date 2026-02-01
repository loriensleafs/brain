// Package main provides a CLI tool for validating naming patterns.
// This tool is used for cross-language parity testing with TypeScript.
//
// Usage:
//
//	go run ./cmd/validate-naming/main.go <fileName> [patternType]
//
// Output: JSON with validation result
//
//	{
//	  "valid": true,
//	  "patternType": "decision",
//	  "error": "",
//	  "isDeprecated": false,
//	  "deprecatedPattern": ""
//	}
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
)

// NamingPatterns defines the regex patterns for artifact naming conventions.
// These patterns must match the TypeScript implementation in naming-pattern.ts.
var NamingPatterns = map[string]*regexp.Regexp{
	"decision":      regexp.MustCompile(`^ADR-\d{3}-[\w-]+\.md$`),
	"session":       regexp.MustCompile(`^SESSION-\d{4}-\d{2}-\d{2}-\d{2}-[\w-]+\.md$`),
	"requirement":   regexp.MustCompile(`^REQ-\d{3}-[\w-]+\.md$`),
	"design":        regexp.MustCompile(`^DESIGN-\d{3}-[\w-]+\.md$`),
	"task":          regexp.MustCompile(`^TASK-\d{3}-[\w-]+\.md$`),
	"analysis":      regexp.MustCompile(`^ANALYSIS-\d{3}-[\w-]+\.md$`),
	"feature":       regexp.MustCompile(`^FEATURE-\d{3}-[\w-]+\.md$`),
	"epic":          regexp.MustCompile(`^EPIC-\d{3}-[\w-]+\.md$`),
	"critique":      regexp.MustCompile(`^CRIT-\d{3}-[\w-]+\.md$`),
	"test-report":   regexp.MustCompile(`^QA-\d{3}-[\w-]+\.md$`),
	"security":      regexp.MustCompile(`^SEC-\d{3}-[\w-]+\.md$`),
	"retrospective": regexp.MustCompile(`^RETRO-\d{4}-\d{2}-\d{2}-[\w-]+\.md$`),
	"skill":         regexp.MustCompile(`^SKILL-\d{3}-[\w-]+\.md$`),
}

// DeprecatedPatterns defines patterns that should be rejected.
// These are old formats that were used before ADR-023.
var DeprecatedPatterns = map[string]*regexp.Regexp{
	"oldSkill":       regexp.MustCompile(`^Skill-[\w]+-\d{3}\.md$`),
	"oldSession":     regexp.MustCompile(`^\d{4}-\d{2}-\d{2}-session-\d+\.md$`),
	"oldThreatModel": regexp.MustCompile(`^TM-\d{3}-[\w-]+\.md$`),
	"oldRetro":       regexp.MustCompile(`^\d{4}-\d{2}-\d{2}-[\w-]+\.md$`),
}

// CanonicalDirectories defines the single canonical directory for each pattern type.
// ADR-024: Only ONE canonical directory per entity type. No backward compatibility.
var CanonicalDirectories = map[string]string{
	"decision":      "decisions",
	"session":       "sessions",
	"requirement":   "specs/{name}/requirements",
	"design":        "specs/{name}/design",
	"task":          "specs/{name}/tasks",
	"analysis":      "analysis",
	"feature":       "planning",
	"epic":          "roadmap",
	"critique":      "critique",
	"test-report":   "qa",
	"security":      "security",
	"retrospective": "retrospectives",
	"skill":         "skills",
}

// DeprecatedDirectories maps deprecated directory paths to their canonical replacements.
// ADR-024: These paths were previously supported but are now invalid.
var DeprecatedDirectories = map[string]string{
	"architecture/decision":  "decisions",
	"architecture/decisions": "decisions",
	"architecture":           "decisions",
	"requirements":           "specs/{name}/requirements",
	"specs/requirements":     "specs/{name}/requirements",
	"design":                 "specs/{name}/design",
	"specs/design":           "specs/{name}/design",
	"tasks":                  "specs/{name}/tasks",
	"specs/tasks":            "specs/{name}/tasks",
	"features":               "planning",
	"epics":                  "roadmap",
	"reviews":                "critique",
	"test-reports":           "qa",
	"retrospective":          "retrospectives",
}

// ValidationResult represents the output of naming pattern validation.
type ValidationResult struct {
	Valid             bool   `json:"valid"`
	PatternType       string `json:"patternType,omitempty"`
	Error             string `json:"error,omitempty"`
	IsDeprecated      bool   `json:"isDeprecated,omitempty"`
	DeprecatedPattern string `json:"deprecatedPattern,omitempty"`
}

// validateNamingPattern validates a file name against naming patterns.
func validateNamingPattern(fileName string, patternType string) ValidationResult {
	// Validate fileName is non-empty
	if fileName == "" {
		return ValidationResult{
			Valid: false,
			Error: "fileName is required and must be non-empty",
		}
	}

	// Check for path traversal attempts
	if strings.Contains(fileName, "..") ||
		strings.Contains(fileName, "/") ||
		strings.Contains(fileName, "\\") {
		return ValidationResult{
			Valid: false,
			Error: "Path traversal detected: fileName must not contain .., /, or \\",
		}
	}

	// If specific pattern type requested, validate against it
	if patternType != "" {
		pattern, ok := NamingPatterns[patternType]
		if !ok {
			return ValidationResult{
				Valid: false,
				Error: fmt.Sprintf("Unknown pattern type: %s", patternType),
			}
		}

		if pattern.MatchString(fileName) {
			return ValidationResult{
				Valid:       true,
				PatternType: patternType,
			}
		}

		// Check if it matches a deprecated pattern
		deprecatedMatch := checkDeprecatedPattern(fileName)
		if deprecatedMatch != "" {
			return ValidationResult{
				Valid:             false,
				Error:             fmt.Sprintf("File name matches deprecated pattern '%s'. Use the new %s format.", deprecatedMatch, patternType),
				IsDeprecated:      true,
				DeprecatedPattern: deprecatedMatch,
			}
		}

		return ValidationResult{
			Valid: false,
			Error: fmt.Sprintf("File name does not match %s pattern: %s", patternType, pattern.String()),
		}
	}

	// No specific type requested - check all patterns
	for typeName, pattern := range NamingPatterns {
		if pattern.MatchString(fileName) {
			return ValidationResult{
				Valid:       true,
				PatternType: typeName,
			}
		}
	}

	// Check if it matches any deprecated pattern
	deprecatedMatch := checkDeprecatedPattern(fileName)
	if deprecatedMatch != "" {
		return ValidationResult{
			Valid:             false,
			Error:             fmt.Sprintf("File name matches deprecated pattern '%s'. Migrate to the new naming convention.", deprecatedMatch),
			IsDeprecated:      true,
			DeprecatedPattern: deprecatedMatch,
		}
	}

	return ValidationResult{
		Valid: false,
		Error: "File name does not match any known naming pattern",
	}
}

// checkDeprecatedPattern checks if a file name matches any deprecated pattern.
func checkDeprecatedPattern(fileName string) string {
	for name, pattern := range DeprecatedPatterns {
		if pattern.MatchString(fileName) {
			return name
		}
	}
	return ""
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: %s <fileName> [patternType]\n", os.Args[0])
		os.Exit(1)
	}

	fileName := os.Args[1]
	patternType := ""
	if len(os.Args) >= 3 {
		patternType = os.Args[2]
	}

	result := validateNamingPattern(fileName, patternType)

	output, err := json.Marshal(result)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to marshal result: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(string(output))
}
