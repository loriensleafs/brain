package internal

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// SlashCommandValidationResult extends ValidationResult with slash command-specific fields.
type SlashCommandValidationResult struct {
	ValidationResult
	FilePath           string                      `json:"filePath,omitempty"`
	FrontmatterPresent bool                        `json:"frontmatterPresent"`
	Frontmatter        SlashCommandFrontmatter     `json:"frontmatter"`
	FieldValidation    SlashCommandFieldValidation `json:"fieldValidation"`
	ArgumentConsistent bool                        `json:"argumentConsistent"`
	SecurityCompliant  bool                        `json:"securityCompliant"`
	LineCount          int                         `json:"lineCount"`
	LengthWarning      bool                        `json:"lengthWarning"`
}

// SlashCommandFrontmatter represents the parsed frontmatter from a slash command file.
type SlashCommandFrontmatter struct {
	Description  string   `json:"description,omitempty"`
	ArgumentHint string   `json:"argumentHint,omitempty"`
	AllowedTools []string `json:"allowedTools,omitempty"`
	RawYAML      string   `json:"rawYaml,omitempty"`
}

// SlashCommandFieldValidation represents validation results for individual frontmatter fields.
type SlashCommandFieldValidation struct {
	DescriptionPresent bool   `json:"descriptionPresent"`
	DescriptionValid   bool   `json:"descriptionValid"`
	DescriptionError   string `json:"descriptionError,omitempty"`
	ArgumentHintValid  bool   `json:"argumentHintValid"`
	ArgumentHintError  string `json:"argumentHintError,omitempty"`
	AllowedToolsValid  bool   `json:"allowedToolsValid"`
	AllowedToolsError  string `json:"allowedToolsError,omitempty"`
	YAMLSyntaxValid    bool   `json:"yamlSyntaxValid"`
	YAMLSyntaxError    string `json:"yamlSyntaxError,omitempty"`
}

// Maximum line count before warning to convert to skill.
const maxSlashCommandLines = 200

// Pattern to match description field value and action verbs.
var descriptionActionPattern = regexp.MustCompile(`^(Use when|Generate|Research|Invoke|Create|Analyze|Review|Search)`)

// Patterns to detect argument usage in prompt content.
var argumentUsagePattern = regexp.MustCompile(`\$ARGUMENTS|\$1|\$2|\$3`)

// Pattern to detect bash execution markers (! followed by command).
var bashExecutionPattern = regexp.MustCompile(`!\s*\w+`)

// Pattern to detect allowed-tools field with array value.
var allowedToolsPattern = regexp.MustCompile(`allowed-tools:\s*\[([^\]]+)\]`)

// Pattern to detect MCP-scoped wildcards (valid).
var mcpWildcardPattern = regexp.MustCompile(`^mcp__`)

var (
	slashCommandSchemaOnce     sync.Once
	slashCommandSchemaCompiled *jsonschema.Schema
	slashCommandSchemaErr      error
	slashCommandSchemaData     []byte
)

// SetSlashCommandFrontmatterSchemaData sets the schema data for slash command frontmatter validation.
// This must be called before any validation functions are used.
// The data is typically embedded by the parent package.
func SetSlashCommandFrontmatterSchemaData(data []byte) {
	slashCommandSchemaData = data
}

// getSlashCommandFrontmatterSchema returns the compiled slash command frontmatter schema, loading it once.
func getSlashCommandFrontmatterSchema() (*jsonschema.Schema, error) {
	slashCommandSchemaOnce.Do(func() {
		if slashCommandSchemaData == nil {
			slashCommandSchemaErr = fmt.Errorf("slash command frontmatter schema data not set; call SetSlashCommandFrontmatterSchemaData first")
			return
		}

		// Parse JSON schema into interface{}
		var schemaDoc any
		if err := json.Unmarshal(slashCommandSchemaData, &schemaDoc); err != nil {
			slashCommandSchemaErr = fmt.Errorf("failed to parse slash command frontmatter schema: %w", err)
			return
		}

		c := jsonschema.NewCompiler()
		if err := c.AddResource("slash-command-frontmatter.schema.json", schemaDoc); err != nil {
			slashCommandSchemaErr = fmt.Errorf("failed to add slash command frontmatter schema resource: %w", err)
			return
		}

		slashCommandSchemaCompiled, slashCommandSchemaErr = c.Compile("slash-command-frontmatter.schema.json")
	})
	return slashCommandSchemaCompiled, slashCommandSchemaErr
}

// ValidateSlashCommandFrontmatter validates frontmatter data against the SlashCommandFrontmatter JSON Schema.
// Returns true if valid, false otherwise.
func ValidateSlashCommandFrontmatter(data any) bool {
	schema, err := getSlashCommandFrontmatterSchema()
	if err != nil {
		return false
	}

	err = schema.Validate(data)
	return err == nil
}

// GetSlashCommandFrontmatterErrors returns structured validation errors for frontmatter data.
// Returns empty slice if valid.
func GetSlashCommandFrontmatterErrors(data any) []ValidationError {
	schema, err := getSlashCommandFrontmatterSchema()
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

// ValidateSlashCommand validates a slash command file for format and quality compliance.
// filePath is the path to the slash command .md file to validate.
func ValidateSlashCommand(filePath string) SlashCommandValidationResult {
	result := SlashCommandValidationResult{
		FilePath: filePath,
	}

	// Check file exists
	content, err := os.ReadFile(filePath)
	if err != nil {
		result.ValidationResult = ValidationResult{
			Valid: false,
			Checks: []Check{
				{
					Name:    "file_exists",
					Passed:  false,
					Message: "File not found: " + filePath,
				},
			},
			Message:     "Slash command validation failed",
			Remediation: "Ensure the file exists at the specified path.",
		}
		return result
	}

	return ValidateSlashCommandFromContent(string(content), filepath.Base(filePath))
}

// ValidateSlashCommandFromContent validates slash command format from content string.
// content is the file content, fileName is used for reporting.
func ValidateSlashCommandFromContent(content, fileName string) SlashCommandValidationResult {
	var checks []Check
	allPassed := true
	hasBlockingViolation := false

	result := SlashCommandValidationResult{
		FilePath: fileName,
	}

	// Count lines
	lines := strings.Split(content, "\n")
	result.LineCount = len(lines)

	// 1. Frontmatter Validation
	frontmatter, yamlErr := parseSlashCommandFrontmatter(content)
	if frontmatter.RawYAML == "" {
		result.FrontmatterPresent = false
		result.FieldValidation.YAMLSyntaxValid = false
		result.FieldValidation.YAMLSyntaxError = "Missing YAML frontmatter block"
		checks = append(checks, Check{
			Name:    "frontmatter_present",
			Passed:  false,
			Message: "BLOCKING: Missing YAML frontmatter block. File must start with '---' on line 1.",
		})
		allPassed = false
		hasBlockingViolation = true
	} else {
		result.FrontmatterPresent = true
		result.Frontmatter = frontmatter

		// YAML syntax check
		if yamlErr != "" {
			result.FieldValidation.YAMLSyntaxValid = false
			result.FieldValidation.YAMLSyntaxError = yamlErr
			checks = append(checks, Check{
				Name:    "yaml_syntax",
				Passed:  false,
				Message: "BLOCKING: YAML syntax error: " + yamlErr,
			})
			allPassed = false
			hasBlockingViolation = true
		} else {
			result.FieldValidation.YAMLSyntaxValid = true
			checks = append(checks, Check{
				Name:    "yaml_syntax",
				Passed:  true,
				Message: "YAML syntax is valid",
			})
		}

		// Convert frontmatter to map for JSON Schema validation
		frontmatterMap := map[string]any{}
		if frontmatter.Description != "" {
			frontmatterMap["description"] = frontmatter.Description
		}
		if frontmatter.ArgumentHint != "" {
			frontmatterMap["argument-hint"] = frontmatter.ArgumentHint
		}
		if len(frontmatter.AllowedTools) > 0 {
			frontmatterMap["allowed-tools"] = frontmatter.AllowedTools
		}

		// Validate using JSON Schema for basic structure
		schemaErrors := GetSlashCommandFrontmatterErrors(frontmatterMap)
		hasSchemaDescError := false
		for _, err := range schemaErrors {
			field := strings.TrimPrefix(err.Field, "/")
			if field == "description" || strings.HasPrefix(field, "description") {
				hasSchemaDescError = true
				break
			}
		}

		// Validate description field (required)
		if frontmatter.Description == "" || hasSchemaDescError {
			result.FieldValidation.DescriptionPresent = false
			result.FieldValidation.DescriptionValid = false
			result.FieldValidation.DescriptionError = "Missing 'description' in frontmatter"
			checks = append(checks, Check{
				Name:    "description_required",
				Passed:  false,
				Message: "BLOCKING: Missing 'description' in frontmatter",
			})
			allPassed = false
			hasBlockingViolation = true
		} else {
			result.FieldValidation.DescriptionPresent = true

			// Validate description starts with action verb
			if !descriptionActionPattern.MatchString(frontmatter.Description) {
				result.FieldValidation.DescriptionValid = false
				result.FieldValidation.DescriptionError = "Description should start with action verb or 'Use when...'"
				checks = append(checks, Check{
					Name:    "description_format",
					Passed:  false,
					Message: "WARNING: Description should start with action verb or 'Use when...'",
				})
				// This is a warning, not blocking
			} else {
				result.FieldValidation.DescriptionValid = true
				checks = append(checks, Check{
					Name:    "description_format",
					Passed:  true,
					Message: "Description starts with action verb",
				})
			}
		}
	}

	// 2. Argument Validation
	hasArgHint := frontmatter.ArgumentHint != ""
	usesArguments := argumentUsagePattern.MatchString(content)

	if usesArguments && !hasArgHint {
		result.ArgumentConsistent = false
		result.FieldValidation.ArgumentHintValid = false
		result.FieldValidation.ArgumentHintError = "Prompt uses arguments but no 'argument-hint' in frontmatter"
		checks = append(checks, Check{
			Name:    "argument_consistency",
			Passed:  false,
			Message: "BLOCKING: Prompt uses arguments ($ARGUMENTS, $1, $2, $3) but no 'argument-hint' in frontmatter",
		})
		allPassed = false
		hasBlockingViolation = true
	} else if hasArgHint && !usesArguments {
		result.ArgumentConsistent = false
		result.FieldValidation.ArgumentHintValid = false
		result.FieldValidation.ArgumentHintError = "Frontmatter has 'argument-hint' but prompt doesn't use arguments"
		checks = append(checks, Check{
			Name:    "argument_consistency",
			Passed:  false,
			Message: "WARNING: Frontmatter has 'argument-hint' but prompt doesn't use arguments",
		})
		// This is a warning, not blocking
	} else {
		result.ArgumentConsistent = true
		result.FieldValidation.ArgumentHintValid = true
		checks = append(checks, Check{
			Name:    "argument_consistency",
			Passed:  true,
			Message: "Argument usage is consistent",
		})
	}

	// 3. Security Validation
	usesBashExecution := bashExecutionPattern.MatchString(content)

	if usesBashExecution {
		if len(frontmatter.AllowedTools) == 0 {
			result.SecurityCompliant = false
			result.FieldValidation.AllowedToolsValid = false
			result.FieldValidation.AllowedToolsError = "Prompt uses bash execution (!) but no 'allowed-tools' in frontmatter"
			checks = append(checks, Check{
				Name:    "security_allowed_tools",
				Passed:  false,
				Message: "BLOCKING: Prompt uses bash execution (!) but no 'allowed-tools' in frontmatter",
			})
			allPassed = false
			hasBlockingViolation = true
		} else {
			// Check for overly permissive wildcards
			hasOverlyPermissive := false
			for _, tool := range frontmatter.AllowedTools {
				tool = strings.TrimSpace(tool)
				if strings.Contains(tool, "*") && !mcpWildcardPattern.MatchString(tool) {
					hasOverlyPermissive = true
					break
				}
			}

			if hasOverlyPermissive {
				result.SecurityCompliant = false
				result.FieldValidation.AllowedToolsValid = false
				result.FieldValidation.AllowedToolsError = "'allowed-tools' has overly permissive wildcard (use mcp__* for scoped namespaces)"
				checks = append(checks, Check{
					Name:    "security_wildcard",
					Passed:  false,
					Message: "BLOCKING: 'allowed-tools' has overly permissive wildcard (use mcp__* for scoped namespaces)",
				})
				allPassed = false
				hasBlockingViolation = true
			} else {
				result.SecurityCompliant = true
				result.FieldValidation.AllowedToolsValid = true
				checks = append(checks, Check{
					Name:    "security_allowed_tools",
					Passed:  true,
					Message: "Security: allowed-tools configured for bash execution",
				})
			}
		}
	} else {
		result.SecurityCompliant = true
		result.FieldValidation.AllowedToolsValid = true
		checks = append(checks, Check{
			Name:    "security_allowed_tools",
			Passed:  true,
			Message: "No bash execution detected (allowed-tools not required)",
		})
	}

	// 4. Length Validation
	if result.LineCount > maxSlashCommandLines {
		result.LengthWarning = true
		checks = append(checks, Check{
			Name:    "length_check",
			Passed:  false,
			Message: "WARNING: File has " + strconv.Itoa(result.LineCount) + " lines (>" + strconv.Itoa(maxSlashCommandLines) + "). Consider converting to skill.",
		})
		// This is a warning, not blocking
	} else {
		result.LengthWarning = false
		checks = append(checks, Check{
			Name:    "length_check",
			Passed:  true,
			Message: "File length is acceptable (" + strconv.Itoa(result.LineCount) + " lines)",
		})
	}

	result.ValidationResult = ValidationResult{
		Valid:  !hasBlockingViolation,
		Checks: checks,
	}

	if hasBlockingViolation {
		result.Message = "Slash command validation failed"
		result.Remediation = buildSlashCommandRemediation(checks)
	} else if !allPassed {
		result.Message = "Slash command validation passed with warnings"
	} else {
		result.Message = "Slash command validation passed"
	}

	return result
}

// ValidateSlashCommandDirectory validates all slash command files in a directory.
// dirPath is the path to the directory containing slash command files.
// Returns a slice of validation results, one per file.
func ValidateSlashCommandDirectory(dirPath string) []SlashCommandValidationResult {
	var results []SlashCommandValidationResult

	files, err := os.ReadDir(dirPath)
	if err != nil {
		return results
	}

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		// Only validate .md files
		if !strings.HasSuffix(file.Name(), ".md") {
			continue
		}

		filePath := filepath.Join(dirPath, file.Name())
		result := ValidateSlashCommand(filePath)
		results = append(results, result)
	}

	return results
}

// ValidateSlashCommandDirectoryRecursive validates all slash command files recursively.
// dirPath is the root directory to search.
// Returns a slice of validation results, one per file.
func ValidateSlashCommandDirectoryRecursive(dirPath string) []SlashCommandValidationResult {
	var results []SlashCommandValidationResult

	err := filepath.WalkDir(dirPath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil // Skip directories with errors
		}

		if d.IsDir() {
			return nil
		}

		// Only validate .md files
		if !strings.HasSuffix(d.Name(), ".md") {
			return nil
		}

		result := ValidateSlashCommand(path)
		results = append(results, result)
		return nil
	})

	if err != nil {
		return results
	}

	return results
}

// ValidateSlashCommandFiles validates a list of specific slash command files.
// filePaths is a slice of file paths to validate.
// Returns a slice of validation results, one per file.
func ValidateSlashCommandFiles(filePaths []string) []SlashCommandValidationResult {
	var results []SlashCommandValidationResult

	for _, filePath := range filePaths {
		// Only validate .md files
		if !strings.HasSuffix(filePath, ".md") {
			continue
		}

		result := ValidateSlashCommand(filePath)
		results = append(results, result)
	}

	return results
}

// parseSlashCommandFrontmatter extracts and parses YAML frontmatter from content.
// Returns the parsed frontmatter and any YAML syntax error message.
func parseSlashCommandFrontmatter(content string) (SlashCommandFrontmatter, string) {
	var fm SlashCommandFrontmatter

	// Check if content starts with ---
	if !strings.HasPrefix(content, "---") {
		return fm, ""
	}

	// Find the closing ---
	lines := strings.Split(content, "\n")
	if len(lines) < 2 {
		return fm, "Frontmatter not closed"
	}

	endIdx := -1
	for i := 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) == "---" {
			endIdx = i
			break
		}
	}

	if endIdx == -1 {
		return fm, "Frontmatter not closed"
	}

	// Extract YAML content (excluding the --- delimiters)
	yamlLines := lines[1:endIdx]
	fm.RawYAML = strings.Join(yamlLines, "\n")

	// Simple YAML parsing for relevant fields
	yamlErr := ""
	for _, line := range yamlLines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Check for valid key: value format
		key, value, found := strings.Cut(line, ":")
		if !found {
			yamlErr = "Invalid YAML syntax: missing colon in line '" + truncateSlashLine(line) + "'"
			continue
		}

		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)

		// Remove quotes from value if present
		value = trimSlashQuotes(value)

		switch key {
		case "description":
			fm.Description = value
		case "argument-hint":
			fm.ArgumentHint = value
		case "allowed-tools":
			// Parse array format: [tool1, tool2]
			if match := allowedToolsPattern.FindStringSubmatch(line); len(match) > 1 {
				tools := strings.Split(match[1], ",")
				for _, tool := range tools {
					tool = strings.TrimSpace(tool)
					tool = trimSlashQuotes(tool)
					if tool != "" {
						fm.AllowedTools = append(fm.AllowedTools, tool)
					}
				}
			}
		}
	}

	return fm, yamlErr
}

// trimSlashQuotes removes surrounding quotes from a string.
func trimSlashQuotes(s string) string {
	if len(s) >= 2 {
		if (s[0] == '"' && s[len(s)-1] == '"') || (s[0] == '\'' && s[len(s)-1] == '\'') {
			return s[1 : len(s)-1]
		}
	}
	return s
}

// truncateSlashLine truncates a line for error messages.
func truncateSlashLine(line string) string {
	if len(line) > 50 {
		return line[:47] + "..."
	}
	return line
}

// buildSlashCommandRemediation builds remediation advice from failed checks.
func buildSlashCommandRemediation(checks []Check) string {
	var issues []string

	for _, check := range checks {
		if !check.Passed && strings.HasPrefix(check.Message, "BLOCKING:") {
			switch check.Name {
			case "frontmatter_present":
				issues = append(issues, "Add YAML frontmatter starting with '---' on line 1")
			case "yaml_syntax":
				issues = append(issues, "Fix YAML syntax errors in frontmatter")
			case "description_required":
				issues = append(issues, "Add 'description' field to frontmatter")
			case "argument_consistency":
				issues = append(issues, "Add 'argument-hint' field or remove $ARGUMENTS usage")
			case "security_allowed_tools":
				issues = append(issues, "Add 'allowed-tools' field when using bash execution (!)")
			case "security_wildcard":
				issues = append(issues, "Use scoped wildcards (mcp__*) instead of bare wildcards")
			}
		}
	}

	if len(issues) == 0 {
		return ""
	}

	// Deduplicate
	seen := make(map[string]bool)
	var unique []string
	for _, issue := range issues {
		if !seen[issue] {
			seen[issue] = true
			unique = append(unique, issue)
		}
	}

	return strings.Join(unique, "; ")
}

// CountBlockingViolations returns the number of blocking violations in validation results.
func CountBlockingViolations(results []SlashCommandValidationResult) int {
	count := 0
	for _, r := range results {
		if !r.Valid {
			count++
		}
	}
	return count
}

// CountWarnings returns the number of warnings (non-blocking failures) in validation results.
func CountWarnings(results []SlashCommandValidationResult) int {
	count := 0
	for _, r := range results {
		for _, check := range r.Checks {
			if !check.Passed && strings.HasPrefix(check.Message, "WARNING:") {
				count++
			}
		}
	}
	return count
}
