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

// Skill name format: lowercase letters, numbers, and hyphens, 1-64 characters.
var skillNamePattern = regexp.MustCompile(`^[a-z0-9-]{1,64}$`)

// Pattern to detect bundled skills (multiple ## Skill-*-NNN: headers).
var bundledSkillPattern = regexp.MustCompile(`(?m)^## Skill-[A-Za-z]+-[0-9]+:`)

// Pattern to detect invalid 'skill-' prefix in filenames.
var skillPrefixPattern = regexp.MustCompile(`^skill-`)

// Maximum description length in characters.
const maxDescriptionLength = 1024

var (
	skillFrontmatterSchemaOnce     sync.Once
	skillFrontmatterSchemaCompiled *jsonschema.Schema
	skillFrontmatterSchemaErr      error
	skillFrontmatterSchemaData     []byte
)

// SetSkillFrontmatterSchemaData sets the schema data for skill frontmatter validation.
// This must be called before any validation functions are used.
// The data is typically embedded by the parent package.
func SetSkillFrontmatterSchemaData(data []byte) {
	skillFrontmatterSchemaData = data
}

// getSkillFrontmatterSchema returns the compiled skill frontmatter schema, loading it once.
func getSkillFrontmatterSchema() (*jsonschema.Schema, error) {
	skillFrontmatterSchemaOnce.Do(func() {
		if skillFrontmatterSchemaData == nil {
			skillFrontmatterSchemaErr = fmt.Errorf("skill frontmatter schema data not set; call SetSkillFrontmatterSchemaData first")
			return
		}

		// Parse JSON schema into interface{}
		var schemaDoc any
		if err := json.Unmarshal(skillFrontmatterSchemaData, &schemaDoc); err != nil {
			skillFrontmatterSchemaErr = fmt.Errorf("failed to parse skill frontmatter schema: %w", err)
			return
		}

		c := jsonschema.NewCompiler()
		if err := c.AddResource("skill-frontmatter.schema.json", schemaDoc); err != nil {
			skillFrontmatterSchemaErr = fmt.Errorf("failed to add skill frontmatter schema resource: %w", err)
			return
		}

		skillFrontmatterSchemaCompiled, skillFrontmatterSchemaErr = c.Compile("skill-frontmatter.schema.json")
	})
	return skillFrontmatterSchemaCompiled, skillFrontmatterSchemaErr
}

// ValidateSkillFrontmatter validates frontmatter data against the SkillFrontmatter JSON Schema.
// Returns true if valid, false otherwise.
func ValidateSkillFrontmatter(data any) bool {
	schema, err := getSkillFrontmatterSchema()
	if err != nil {
		return false
	}

	err = schema.Validate(data)
	return err == nil
}

// GetSkillFrontmatterErrors returns structured validation errors for frontmatter data.
// Returns empty slice if valid.
func GetSkillFrontmatterErrors(data any) []ValidationError {
	schema, err := getSkillFrontmatterSchema()
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

// ValidateSkillFormat validates a skill file for format and frontmatter compliance.
// filePath is the path to the skill file to validate.
func ValidateSkillFormat(filePath string) SkillFormatValidationResult {
	result := SkillFormatValidationResult{
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
			Message:     "Skill format validation failed",
			Remediation: "Ensure the file exists at the specified path.",
		}
		return result
	}

	// Validate filename prefix
	fileName := filepath.Base(filePath)
	if skillPrefixPattern.MatchString(fileName) {
		result.PrefixViolation = true
	}

	return ValidateSkillFormatFromContent(string(content), fileName)
}

// ValidateSkillFormatFromContent validates skill format from content string.
// content is the file content, fileName is used for prefix validation.
func ValidateSkillFormatFromContent(content, fileName string) SkillFormatValidationResult {
	var checks []Check
	allPassed := true

	result := SkillFormatValidationResult{
		FilePath: fileName,
	}

	// Check filename prefix violation
	if skillPrefixPattern.MatchString(fileName) {
		result.PrefixViolation = true
		checks = append(checks, Check{
			Name:    "filename_prefix",
			Passed:  false,
			Message: "Filename uses invalid 'skill-' prefix. Use {domain}-{description} format.",
		})
		allPassed = false
	} else {
		checks = append(checks, Check{
			Name:    "filename_prefix",
			Passed:  true,
			Message: "Filename follows {domain}-{description} convention",
		})
	}

	// Check for bundled skills
	bundledMatches := bundledSkillPattern.FindAllString(content, -1)
	if len(bundledMatches) > 1 {
		result.BundledSkills = bundledMatches
		checks = append(checks, Check{
			Name:    "single_skill",
			Passed:  false,
			Message: "File contains " + Itoa(len(bundledMatches)) + " bundled skills. One skill per file required.",
		})
		allPassed = false
	} else {
		checks = append(checks, Check{
			Name:    "single_skill",
			Passed:  true,
			Message: "File contains at most one skill definition",
		})
	}

	// Check frontmatter presence and parse it
	frontmatter, yamlErr := ParseFrontmatter(content)
	if frontmatter.RawYAML == "" {
		result.FrontmatterPresent = false
		result.FieldValidation.YAMLSyntaxValid = false
		result.FieldValidation.YAMLSyntaxError = "Frontmatter not found. File must start with '---' on line 1."
		checks = append(checks, Check{
			Name:    "frontmatter_present",
			Passed:  false,
			Message: "Frontmatter not found. File must start with '---' on line 1.",
		})
		allPassed = false
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
				Message: "YAML syntax error: " + yamlErr,
			})
			allPassed = false
		} else {
			result.FieldValidation.YAMLSyntaxValid = true
			checks = append(checks, Check{
				Name:    "yaml_syntax",
				Passed:  true,
				Message: "YAML syntax is valid",
			})
		}

		// Validate name field using regex pattern (primary validation)
		nameResult := validateNameField(frontmatter.Name)
		result.FieldValidation.NamePresent = nameResult.present
		result.FieldValidation.NameValid = nameResult.valid
		result.FieldValidation.NameError = nameResult.err

		if !nameResult.present {
			checks = append(checks, Check{
				Name:    "name_required",
				Passed:  false,
				Message: "Required field 'name' is missing",
			})
			allPassed = false
		} else if !nameResult.valid {
			checks = append(checks, Check{
				Name:    "name_format",
				Passed:  false,
				Message: nameResult.err,
			})
			allPassed = false
		} else {
			checks = append(checks, Check{
				Name:    "name_format",
				Passed:  true,
				Message: "Name field is valid: " + frontmatter.Name,
			})
		}

		// Validate description field using length check (primary validation)
		descResult := validateDescriptionField(frontmatter.Description)
		result.FieldValidation.DescriptionPresent = descResult.present
		result.FieldValidation.DescriptionValid = descResult.valid
		result.FieldValidation.DescriptionError = descResult.err

		if !descResult.present {
			checks = append(checks, Check{
				Name:    "description_required",
				Passed:  false,
				Message: "Required field 'description' is missing",
			})
			allPassed = false
		} else if !descResult.valid {
			checks = append(checks, Check{
				Name:    "description_length",
				Passed:  false,
				Message: descResult.err,
			})
			allPassed = false
		} else {
			checks = append(checks, Check{
				Name:    "description_length",
				Passed:  true,
				Message: "Description field is valid (" + Itoa(len(frontmatter.Description)) + " chars)",
			})
		}
	}

	result.ValidationResult = ValidationResult{
		Valid:  allPassed,
		Checks: checks,
	}

	if allPassed {
		result.Message = "Skill format validation passed"
	} else {
		result.Message = "Skill format validation failed"
		result.Remediation = buildSkillRemediation(checks)
	}

	return result
}

// fieldValidationResult holds the result of validating a single field.
type fieldValidationResult struct {
	present bool
	valid   bool
	err     string
}

// validateNameField validates the name field.
func validateNameField(name string) fieldValidationResult {
	result := fieldValidationResult{}

	if name == "" {
		result.present = false
		result.valid = false
		result.err = "Required field 'name' is missing"
		return result
	}

	result.present = true

	if !skillNamePattern.MatchString(name) {
		result.valid = false
		if len(name) > 64 {
			result.err = "Name exceeds 64 characters (" + Itoa(len(name)) + " chars)"
		} else {
			result.err = "Name must match pattern ^[a-z0-9-]{1,64}$. Found: '" + name + "'"
		}
		return result
	}

	result.valid = true
	return result
}

// validateDescriptionField validates the description field.
func validateDescriptionField(description string) fieldValidationResult {
	result := fieldValidationResult{}

	if description == "" {
		result.present = false
		result.valid = false
		result.err = "Required field 'description' is missing"
		return result
	}

	result.present = true

	if len(description) > maxDescriptionLength {
		result.valid = false
		result.err = "Description exceeds " + Itoa(maxDescriptionLength) + " characters (" + Itoa(len(description)) + " chars)"
		return result
	}

	result.valid = true
	return result
}

// ValidateSkillDirectory validates all skill files in a directory.
// dirPath is the path to the directory containing skill files.
// Returns a slice of validation results, one per file.
func ValidateSkillDirectory(dirPath string) []SkillFormatValidationResult {
	var results []SkillFormatValidationResult

	files, err := os.ReadDir(dirPath)
	if err != nil {
		return results
	}

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		// Skip non-markdown files
		if !strings.HasSuffix(file.Name(), ".md") {
			continue
		}

		// Skip index files
		if strings.HasPrefix(file.Name(), "skills-") && strings.HasSuffix(file.Name(), "-index.md") {
			continue
		}
		if file.Name() == "memory-index.md" {
			continue
		}

		filePath := filepath.Join(dirPath, file.Name())
		result := ValidateSkillFormat(filePath)
		results = append(results, result)
	}

	return results
}

// ValidateSkillFiles validates a list of specific skill files.
// filePaths is a slice of file paths to validate.
// Returns a slice of validation results, one per file.
func ValidateSkillFiles(filePaths []string) []SkillFormatValidationResult {
	var results []SkillFormatValidationResult

	for _, filePath := range filePaths {
		// Skip non-markdown files
		if !strings.HasSuffix(filePath, ".md") {
			continue
		}

		// Skip index files
		fileName := filepath.Base(filePath)
		if strings.HasPrefix(fileName, "skills-") && strings.HasSuffix(fileName, "-index.md") {
			continue
		}
		if fileName == "memory-index.md" {
			continue
		}

		result := ValidateSkillFormat(filePath)
		results = append(results, result)
	}

	return results
}

// buildSkillRemediation builds remediation advice from failed checks.
func buildSkillRemediation(checks []Check) string {
	var issues []string

	for _, check := range checks {
		if !check.Passed {
			switch check.Name {
			case "filename_prefix":
				issues = append(issues, "Rename file to use {domain}-{description} format (e.g., pr-001-reviewer-enumeration.md)")
			case "single_skill":
				issues = append(issues, "Split bundled skills into separate atomic files")
			case "frontmatter_present":
				issues = append(issues, "Add YAML frontmatter starting with '---' on line 1")
			case "yaml_syntax":
				issues = append(issues, "Fix YAML syntax errors in frontmatter")
			case "name_required", "name_format":
				issues = append(issues, "Add or fix 'name' field (lowercase letters, numbers, hyphens, 1-64 chars)")
			case "description_required", "description_length":
				issues = append(issues, "Add or fix 'description' field (max 1024 chars)")
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
