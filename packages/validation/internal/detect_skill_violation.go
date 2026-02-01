package internal

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// SkillViolation represents a detected violation of skill usage policy.
type SkillViolation struct {
	File    string `json:"file"`
	Line    int    `json:"line"`
	Pattern string `json:"pattern"`
	Command string `json:"command,omitempty"`
}

// SkillViolationResult represents the result of skill violation detection.
type SkillViolationResult struct {
	ValidationResult
	SkillsDir      string           `json:"skillsDir,omitempty"`
	FilesChecked   int              `json:"filesChecked"`
	Violations     []SkillViolation `json:"violations,omitempty"`
	CapabilityGaps []string         `json:"capabilityGaps,omitempty"`
}

var (
	skillViolationSchemaOnce     sync.Once
	skillViolationSchemaCompiled *jsonschema.Schema
	skillViolationSchemaErr      error
	skillViolationSchemaData     []byte
)

// SetSkillViolationSchemaData sets the schema data for skill violation result validation.
func SetSkillViolationSchemaData(data []byte) {
	skillViolationSchemaData = data
}

// getSkillViolationSchema returns the compiled skill violation schema.
func getSkillViolationSchema() (*jsonschema.Schema, error) {
	skillViolationSchemaOnce.Do(func() {
		if skillViolationSchemaData == nil {
			skillViolationSchemaErr = fmt.Errorf("skill violation schema data not set; call SetSkillViolationSchemaData first")
			return
		}

		var schemaDoc any
		if err := json.Unmarshal(skillViolationSchemaData, &schemaDoc); err != nil {
			skillViolationSchemaErr = fmt.Errorf("failed to parse skill violation schema: %w", err)
			return
		}

		c := jsonschema.NewCompiler()
		if err := c.AddResource("skill-violation.schema.json", schemaDoc); err != nil {
			skillViolationSchemaErr = fmt.Errorf("failed to add skill violation schema resource: %w", err)
			return
		}

		skillViolationSchemaCompiled, skillViolationSchemaErr = c.Compile("skill-violation.schema.json")
	})
	return skillViolationSchemaCompiled, skillViolationSchemaErr
}

// ValidateSkillViolationResult validates a SkillViolationResult against the JSON Schema.
func ValidateSkillViolationResult(result SkillViolationResult) bool {
	schema, err := getSkillViolationSchema()
	if err != nil {
		return false
	}

	data, err := json.Marshal(result)
	if err != nil {
		return false
	}

	var resultMap any
	if err := json.Unmarshal(data, &resultMap); err != nil {
		return false
	}

	return schema.Validate(resultMap) == nil
}

// GetSkillViolationResultErrors returns validation errors for a SkillViolationResult.
func GetSkillViolationResultErrors(result SkillViolationResult) []ValidationError {
	schema, err := getSkillViolationSchema()
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "schema",
			Message:    err.Error(),
		}}
	}

	data, err := json.Marshal(result)
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "marshal",
			Message:    err.Error(),
		}}
	}

	var resultMap any
	if err := json.Unmarshal(data, &resultMap); err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "unmarshal",
			Message:    err.Error(),
		}}
	}

	err = schema.Validate(resultMap)
	if err == nil {
		return []ValidationError{}
	}

	return ExtractValidationErrors(err)
}

// GhCommandPatterns defines regex patterns for detecting raw gh CLI usage.
var GhCommandPatterns = []*regexp.Regexp{
	regexp.MustCompile(`gh\s+pr\s+(create|merge|close|view|list|diff)`),
	regexp.MustCompile(`gh\s+issue\s+(create|close|view|list)`),
	regexp.MustCompile(`gh\s+api\s+`),
	regexp.MustCompile(`gh\s+repo\s+`),
}

// DefaultSkillsPath is the default path to GitHub skills directory.
const DefaultSkillsPath = ".claude/skills/github/scripts"

// DetectSkillViolations scans files for raw gh command usage when GitHub skills exist.
// basePath is the root directory to scan from.
// stagedOnly when true, only checks git-staged files.
func DetectSkillViolations(basePath string, stagedOnly bool) SkillViolationResult {
	result := SkillViolationResult{
		ValidationResult: ValidationResult{
			Valid: true,
		},
	}

	// Resolve base path
	absBasePath, err := filepath.Abs(basePath)
	if err != nil {
		result.Valid = false
		result.Message = "Failed to resolve base path: " + err.Error()
		return result
	}

	// Find git repository root
	repoRoot := findGitRoot(absBasePath)
	if repoRoot == "" {
		result.Valid = false
		result.Message = "Could not find git repository root from: " + absBasePath
		return result
	}

	// Check if skills directory exists
	skillsDir := filepath.Join(repoRoot, DefaultSkillsPath)
	result.SkillsDir = skillsDir
	if !DirExists(skillsDir) {
		result.Message = "GitHub skills directory not found: " + skillsDir
		return result
	}

	// Get files to check
	filesToCheck := getFilesToCheck(repoRoot, stagedOnly)
	if len(filesToCheck) == 0 {
		result.Message = "No files to check for skill violations"
		return result
	}

	result.FilesChecked = len(filesToCheck)

	// Scan files for violations
	violations, capabilityGaps := scanFilesForViolations(repoRoot, filesToCheck)
	result.Violations = violations
	result.CapabilityGaps = capabilityGaps

	// Build checks
	var checks []Check
	if len(violations) > 0 {
		for _, v := range violations {
			checks = append(checks, Check{
				Name:    "skill_violation",
				Passed:  false,
				Message: v.File + ":" + Itoa(v.Line) + " - matches '" + v.Pattern + "'",
			})
		}
		result.Message = "Detected raw 'gh' command usage (skill violations)"
		result.Remediation = buildSkillViolationRemediation(capabilityGaps)
	} else {
		checks = append(checks, Check{
			Name:    "skill_violation",
			Passed:  true,
			Message: "No skill violations detected",
		})
		result.Message = "No skill violations detected"
	}

	result.Checks = checks
	// Note: violations are non-blocking warnings per the original PowerShell script
	// result.Valid remains true even with violations

	return result
}

// DetectSkillViolationsFromContent scans content strings for skill violations.
// Useful for testing or when content is already loaded.
func DetectSkillViolationsFromContent(contents map[string]string) SkillViolationResult {
	result := SkillViolationResult{
		ValidationResult: ValidationResult{
			Valid: true,
		},
		FilesChecked: len(contents),
	}

	var violations []SkillViolation
	capabilityGaps := make(map[string]bool)

	for filename, content := range contents {
		fileViolations := scanContentForViolations(filename, content)
		violations = append(violations, fileViolations...)

		for _, v := range fileViolations {
			if v.Command != "" {
				capabilityGaps[v.Command] = true
			}
		}
	}

	result.Violations = violations

	// Convert capability gaps map to slice
	for gap := range capabilityGaps {
		result.CapabilityGaps = append(result.CapabilityGaps, gap)
	}

	// Build checks
	var checks []Check
	if len(violations) > 0 {
		for _, v := range violations {
			checks = append(checks, Check{
				Name:    "skill_violation",
				Passed:  false,
				Message: v.File + ":" + Itoa(v.Line) + " - matches '" + v.Pattern + "'",
			})
		}
		result.Message = "Detected raw 'gh' command usage (skill violations)"
		result.Remediation = buildSkillViolationRemediation(result.CapabilityGaps)
	} else {
		checks = append(checks, Check{
			Name:    "skill_violation",
			Passed:  true,
			Message: "No skill violations detected",
		})
		result.Message = "No skill violations detected"
	}

	result.Checks = checks

	return result
}

// findGitRoot finds the git repository root from the given starting directory.
func findGitRoot(startDir string) string {
	cmd := exec.Command("git", "-C", startDir, "rev-parse", "--show-toplevel")
	output, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(output))
}

// getFilesToCheck returns a list of files to check for violations.
func getFilesToCheck(repoRoot string, stagedOnly bool) []string {
	var files []string

	if stagedOnly {
		files = getGitStagedMarkdownAndPowerShell(repoRoot)
	} else {
		files = getAllMarkdownAndPowerShellFiles(repoRoot)
	}

	return files
}

// getGitStagedMarkdownAndPowerShell returns git-staged .md, .ps1, .psm1 files.
func getGitStagedMarkdownAndPowerShell(repoRoot string) []string {
	cmd := exec.Command("git", "-C", repoRoot, "diff", "--cached", "--name-only", "--diff-filter=ACMR")
	output, err := cmd.Output()
	if err != nil {
		return nil
	}

	var files []string
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if isTargetFile(line) {
			files = append(files, line)
		}
	}

	return files
}

// getAllMarkdownAndPowerShellFiles returns all .md, .ps1, .psm1 files in the repo.
func getAllMarkdownAndPowerShellFiles(repoRoot string) []string {
	var files []string

	err := filepath.Walk(repoRoot, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Continue on error
		}

		// Skip .git and node_modules directories
		if info.IsDir() {
			name := info.Name()
			if name == ".git" || name == "node_modules" {
				return filepath.SkipDir
			}
			return nil
		}

		if isTargetFile(path) {
			// Convert to relative path
			relPath, err := filepath.Rel(repoRoot, path)
			if err == nil {
				files = append(files, filepath.ToSlash(relPath))
			}
		}

		return nil
	})

	if err != nil {
		return nil
	}

	return files
}

// isTargetFile returns true if the file should be checked for violations.
func isTargetFile(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	return ext == ".md" || ext == ".ps1" || ext == ".psm1"
}

// scanFilesForViolations scans files and returns violations and capability gaps.
func scanFilesForViolations(repoRoot string, files []string) ([]SkillViolation, []string) {
	var violations []SkillViolation
	capabilityGaps := make(map[string]bool)

	for _, file := range files {
		fullPath := filepath.Join(repoRoot, file)
		content, err := os.ReadFile(fullPath)
		if err != nil {
			continue
		}

		fileViolations := scanContentForViolations(file, string(content))
		if len(fileViolations) > 0 {
			// Only report first violation per file
			violations = append(violations, fileViolations[0])

			if fileViolations[0].Command != "" {
				capabilityGaps[fileViolations[0].Command] = true
			}
		}
	}

	// Convert map to slice
	var gaps []string
	for gap := range capabilityGaps {
		gaps = append(gaps, gap)
	}

	return violations, gaps
}

// scanContentForViolations scans content string for gh command violations.
func scanContentForViolations(filename, content string) []SkillViolation {
	var violations []SkillViolation

	lines := strings.Split(content, "\n")
	for lineNum, line := range lines {
		for _, pattern := range GhCommandPatterns {
			if pattern.MatchString(line) {
				violation := SkillViolation{
					File:    filename,
					Line:    lineNum + 1, // 1-indexed
					Pattern: pattern.String(),
					Command: extractGhCommand(line),
				}
				violations = append(violations, violation)
				break // Only report first match per line
			}
		}
	}

	return violations
}

// extractGhCommand extracts the gh subcommand from a line.
func extractGhCommand(line string) string {
	pattern := regexp.MustCompile(`gh\s+(\w+)`)
	matches := pattern.FindStringSubmatch(line)
	if len(matches) > 1 {
		return matches[1]
	}
	return ""
}

// buildSkillViolationRemediation builds remediation text for skill violations.
func buildSkillViolationRemediation(capabilityGaps []string) string {
	var sb strings.Builder

	sb.WriteString("These commands indicate missing GitHub skill capabilities.\n")
	sb.WriteString("Use .claude/skills/github/ scripts instead, or file an issue to add the capability.\n\n")

	if len(capabilityGaps) > 0 {
		sb.WriteString("Missing skill capabilities detected:\n")
		for _, gap := range capabilityGaps {
			sb.WriteString("  - gh " + gap + " (consider adding to .claude/skills/github/)\n")
		}
		sb.WriteString("\n")
	}

	sb.WriteString("REMINDER: Use GitHub skills for better error handling, consistency, and auditability.\n")
	sb.WriteString("Before using raw 'gh' commands, check: Get-ChildItem .claude/skills/github/scripts -Recurse\n")
	sb.WriteString("If the capability you need doesn't exist, create a skill script or file an issue.")

	return sb.String()
}

// ScanFileForViolations scans a single file for skill violations.
// Exported for direct file scanning without full validation setup.
func ScanFileForViolations(filePath string) ([]SkillViolation, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var violations []SkillViolation
	scanner := bufio.NewScanner(file)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()

		for _, pattern := range GhCommandPatterns {
			if pattern.MatchString(line) {
				violation := SkillViolation{
					File:    filePath,
					Line:    lineNum,
					Pattern: pattern.String(),
					Command: extractGhCommand(line),
				}
				violations = append(violations, violation)
				break // Only report first match per line
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return violations, err
	}

	return violations, nil
}

// HasSkillViolations returns true if any violations were detected.
func (r *SkillViolationResult) HasSkillViolations() bool {
	return len(r.Violations) > 0
}

// ViolationCount returns the number of violations detected.
func (r *SkillViolationResult) ViolationCount() int {
	return len(r.Violations)
}
