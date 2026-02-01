package internal

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// TraceabilityValidationResult extends ValidationResult with traceability-specific fields.
type TraceabilityValidationResult struct {
	ValidationResult
	SpecsPath string              `json:"specsPath,omitempty"`
	Strict    bool                `json:"strict"`
	Stats     TraceabilityStats   `json:"stats"`
	Errors    []TraceabilityIssue `json:"errors,omitempty"`
	Warnings  []TraceabilityIssue `json:"warnings,omitempty"`
	Info      []TraceabilityIssue `json:"info,omitempty"`
	ExitCode  int                 `json:"exitCode"`
}

// TraceabilityStats contains counts of specs and valid chains.
type TraceabilityStats struct {
	Requirements int `json:"requirements"`
	Designs      int `json:"designs"`
	Tasks        int `json:"tasks"`
	ValidChains  int `json:"validChains"`
}

// TraceabilityIssue represents a single traceability violation.
type TraceabilityIssue struct {
	Rule    string `json:"rule"`
	Source  string `json:"source"`
	Target  string `json:"target,omitempty"`
	Message string `json:"message"`
}

// SpecFrontmatter represents parsed YAML frontmatter from a spec file.
type SpecFrontmatter struct {
	Type     string   `json:"type"`
	ID       string   `json:"id"`
	Status   string   `json:"status"`
	Related  []string `json:"related"`
	FilePath string   `json:"filePath"`
}

// SpecCollection holds all loaded specifications organized by type.
type SpecCollection struct {
	Requirements map[string]*SpecFrontmatter
	Designs      map[string]*SpecFrontmatter
	Tasks        map[string]*SpecFrontmatter
	All          map[string]*SpecFrontmatter
}

// ValidateTraceability validates traceability cross-references between spec artifacts.
// specsPath is the path to the specs directory (default: ".agents/specs").
// strict determines whether warnings cause failure (exit code 2 vs 0).
func ValidateTraceability(specsPath string, strict bool) TraceabilityValidationResult {
	result := TraceabilityValidationResult{
		SpecsPath: specsPath,
		Strict:    strict,
		Stats:     TraceabilityStats{},
		Errors:    []TraceabilityIssue{},
		Warnings:  []TraceabilityIssue{},
		Info:      []TraceabilityIssue{},
	}

	// Resolve and validate specs path
	absPath, err := filepath.Abs(specsPath)
	if err != nil {
		result.Valid = false
		result.Message = "Invalid specs path: " + err.Error()
		result.ExitCode = 1
		return result
	}

	if !DirExists(absPath) {
		result.Valid = false
		result.Message = "Specs path not found: " + specsPath
		result.ExitCode = 1
		return result
	}

	// Load all specs
	specs := LoadAllSpecs(absPath)
	result.Stats.Requirements = len(specs.Requirements)
	result.Stats.Designs = len(specs.Designs)
	result.Stats.Tasks = len(specs.Tasks)

	// Run traceability validation
	testResult := TestTraceabilityRules(specs)
	result.Errors = testResult.Errors
	result.Warnings = testResult.Warnings
	result.Info = testResult.Info
	result.Stats.ValidChains = testResult.ValidChains

	// Build checks for ValidationResult
	var checks []Check

	// Add error checks
	for _, e := range result.Errors {
		checks = append(checks, Check{
			Name:    e.Rule,
			Passed:  false,
			Message: e.Message,
		})
	}

	// Add warning checks (pass unless strict)
	for _, w := range result.Warnings {
		checks = append(checks, Check{
			Name:    w.Rule,
			Passed:  !strict,
			Message: w.Message,
		})
	}

	// Add info checks (always pass)
	for _, i := range result.Info {
		checks = append(checks, Check{
			Name:    i.Rule,
			Passed:  true,
			Message: i.Message,
		})
	}

	result.Checks = checks

	// Determine exit code and validity
	if len(result.Errors) > 0 {
		result.Valid = false
		result.ExitCode = 1
		result.Message = "Traceability validation failed with errors"
	} else if len(result.Warnings) > 0 && strict {
		result.Valid = false
		result.ExitCode = 2
		result.Message = "Traceability validation failed with warnings (strict mode)"
	} else {
		result.Valid = true
		result.ExitCode = 0
		if len(result.Warnings) > 0 {
			result.Message = "Traceability validation passed with warnings"
		} else {
			result.Message = "All traceability checks passed"
		}
	}

	return result
}

// LoadAllSpecs loads all specification files from the specs directory.
func LoadAllSpecs(basePath string) *SpecCollection {
	specs := &SpecCollection{
		Requirements: make(map[string]*SpecFrontmatter),
		Designs:      make(map[string]*SpecFrontmatter),
		Tasks:        make(map[string]*SpecFrontmatter),
		All:          make(map[string]*SpecFrontmatter),
	}

	// Load requirements
	reqPath := filepath.Join(basePath, "requirements")
	if DirExists(reqPath) {
		loadSpecsFromDir(reqPath, "REQ-*.md", specs.Requirements, specs.All)
	}

	// Load designs
	designPath := filepath.Join(basePath, "design")
	if DirExists(designPath) {
		loadSpecsFromDir(designPath, "DESIGN-*.md", specs.Designs, specs.All)
	}

	// Load tasks
	taskPath := filepath.Join(basePath, "tasks")
	if DirExists(taskPath) {
		loadSpecsFromDir(taskPath, "TASK-*.md", specs.Tasks, specs.All)
	}

	return specs
}

// loadSpecsFromDir loads spec files matching pattern from directory into maps.
func loadSpecsFromDir(dirPath, pattern string, typeMap, allMap map[string]*SpecFrontmatter) {
	matches, err := filepath.Glob(filepath.Join(dirPath, pattern))
	if err != nil {
		return
	}

	for _, filePath := range matches {
		spec := ParseYAMLFrontmatter(filePath)
		if spec != nil && spec.ID != "" {
			typeMap[spec.ID] = spec
			allMap[spec.ID] = spec
		}
	}
}

// ParseYAMLFrontmatter extracts YAML frontmatter from a markdown file.
func ParseYAMLFrontmatter(filePath string) *SpecFrontmatter {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil
	}

	contentStr := string(content)

	// Match YAML front matter between --- markers
	yamlPattern := regexp.MustCompile(`(?s)^---\r?\n(.+?)\r?\n---`)
	match := yamlPattern.FindStringSubmatch(contentStr)
	if len(match) < 2 {
		return nil
	}

	yaml := match[1]
	result := &SpecFrontmatter{
		FilePath: filePath,
		Related:  []string{},
	}

	// Parse type
	typePattern := regexp.MustCompile(`(?m)^type:\s*(.+)$`)
	if typeMatch := typePattern.FindStringSubmatch(yaml); len(typeMatch) > 1 {
		result.Type = strings.TrimSpace(typeMatch[1])
	}

	// Parse id
	idPattern := regexp.MustCompile(`(?m)^id:\s*(.+)$`)
	if idMatch := idPattern.FindStringSubmatch(yaml); len(idMatch) > 1 {
		result.ID = strings.TrimSpace(idMatch[1])
	}

	// Parse status
	statusPattern := regexp.MustCompile(`(?m)^status:\s*(.+)$`)
	if statusMatch := statusPattern.FindStringSubmatch(yaml); len(statusMatch) > 1 {
		result.Status = strings.TrimSpace(statusMatch[1])
	}

	// Parse related (array) - supports both numeric and alphanumeric IDs
	relatedPattern := regexp.MustCompile(`(?s)related:\s*\r?\n((?:\s+-\s+.+\r?\n?)+)`)
	if relatedMatch := relatedPattern.FindStringSubmatch(yaml); len(relatedMatch) > 1 {
		relatedBlock := relatedMatch[1]
		itemPattern := regexp.MustCompile(`-\s+([A-Z]+-[A-Z0-9]+)`)
		items := itemPattern.FindAllStringSubmatch(relatedBlock, -1)
		for _, item := range items {
			if len(item) > 1 {
				result.Related = append(result.Related, item[1])
			}
		}
	}

	return result
}

// TraceabilityTestResult holds the results of traceability rule testing.
type TraceabilityTestResult struct {
	Errors      []TraceabilityIssue
	Warnings    []TraceabilityIssue
	Info        []TraceabilityIssue
	ValidChains int
}

// TestTraceabilityRules validates all traceability rules against loaded specs.
func TestTraceabilityRules(specs *SpecCollection) TraceabilityTestResult {
	result := TraceabilityTestResult{
		Errors:   []TraceabilityIssue{},
		Warnings: []TraceabilityIssue{},
		Info:     []TraceabilityIssue{},
	}

	// Build reference indices
	// reqRefs: REQ-ID -> [DESIGN-IDs that reference it]
	// designRefs: DESIGN-ID -> [TASK-IDs that reference it]
	reqRefs := make(map[string][]string)
	designRefs := make(map[string][]string)

	// Initialize ref arrays
	for reqID := range specs.Requirements {
		reqRefs[reqID] = []string{}
	}
	for designID := range specs.Designs {
		designRefs[designID] = []string{}
	}

	// Build forward references from tasks to designs
	for taskID, task := range specs.Tasks {
		hasDesignRef := false
		for _, relatedID := range task.Related {
			if strings.HasPrefix(relatedID, "DESIGN-") {
				hasDesignRef = true
				if _, exists := specs.Designs[relatedID]; exists {
					designRefs[relatedID] = append(designRefs[relatedID], taskID)
				} else {
					// Rule 4: Broken reference
					result.Errors = append(result.Errors, TraceabilityIssue{
						Rule:    "Rule 4: Reference Validity",
						Source:  taskID,
						Target:  relatedID,
						Message: "TASK '" + taskID + "' references non-existent DESIGN '" + relatedID + "'",
					})
				}
			}
		}

		// Rule 2: Backward Traceability - Task must reference at least one design
		if !hasDesignRef {
			result.Errors = append(result.Errors, TraceabilityIssue{
				Rule:    "Rule 2: Backward Traceability",
				Source:  taskID,
				Message: "TASK '" + taskID + "' has no DESIGN reference (untraced task)",
			})
		}
	}

	// Build forward references from designs to requirements
	for designID, design := range specs.Designs {
		for _, relatedID := range design.Related {
			if strings.HasPrefix(relatedID, "REQ-") {
				if _, exists := specs.Requirements[relatedID]; exists {
					reqRefs[relatedID] = append(reqRefs[relatedID], designID)
				} else {
					// Rule 4: Broken reference
					result.Errors = append(result.Errors, TraceabilityIssue{
						Rule:    "Rule 4: Reference Validity",
						Source:  designID,
						Target:  relatedID,
						Message: "DESIGN '" + designID + "' references non-existent REQ '" + relatedID + "'",
					})
				}
			}
		}
	}

	// Rule 1: Forward Traceability - Every REQ must trace to at least one DESIGN
	for reqID := range specs.Requirements {
		if len(reqRefs[reqID]) == 0 {
			result.Warnings = append(result.Warnings, TraceabilityIssue{
				Rule:    "Rule 1: Forward Traceability",
				Source:  reqID,
				Message: "REQ '" + reqID + "' has no DESIGN referencing it (orphaned requirement)",
			})
		}
	}

	// Rule 3: Complete Chain - Every DESIGN must have both REQ and TASK references
	for designID, design := range specs.Designs {
		hasReqRef := false
		for _, relatedID := range design.Related {
			if strings.HasPrefix(relatedID, "REQ-") {
				hasReqRef = true
				break
			}
		}
		hasTaskRef := len(designRefs[designID]) > 0

		if !hasReqRef {
			result.Warnings = append(result.Warnings, TraceabilityIssue{
				Rule:    "Rule 3: Complete Chain",
				Source:  designID,
				Message: "DESIGN '" + designID + "' has no REQ reference (missing backward trace)",
			})
		}

		if !hasTaskRef {
			result.Warnings = append(result.Warnings, TraceabilityIssue{
				Rule:    "Rule 3: Complete Chain",
				Source:  designID,
				Message: "DESIGN '" + designID + "' has no TASK referencing it (orphaned design)",
			})
		}

		if hasReqRef && hasTaskRef {
			result.ValidChains++
		}
	}

	// Rule 5: Status Consistency
	completedStatuses := map[string]bool{
		"complete":    true,
		"done":        true,
		"implemented": true,
	}

	for taskID, task := range specs.Tasks {
		if completedStatuses[strings.ToLower(task.Status)] {
			for _, relatedID := range task.Related {
				if strings.HasPrefix(relatedID, "DESIGN-") {
					if design, exists := specs.Designs[relatedID]; exists {
						if !completedStatuses[strings.ToLower(design.Status)] {
							result.Info = append(result.Info, TraceabilityIssue{
								Rule:    "Rule 5: Status Consistency",
								Source:  taskID,
								Target:  relatedID,
								Message: "TASK '" + taskID + "' is complete but DESIGN '" + relatedID + "' is '" + design.Status + "'",
							})
						}
					}
				}
			}
		}
	}

	return result
}

// FormatTraceabilityResults formats the validation results in the specified format.
// format can be "console", "markdown", or "json".
func FormatTraceabilityResults(result TraceabilityValidationResult, format string) string {
	switch format {
	case "json":
		return formatTraceabilityJSON(result)
	case "markdown":
		return formatTraceabilityMarkdown(result)
	default:
		return formatTraceabilityConsole(result)
	}
}

func formatTraceabilityJSON(result TraceabilityValidationResult) string {
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return `{"error": "failed to marshal result"}`
	}
	return string(data)
}

func formatTraceabilityMarkdown(result TraceabilityValidationResult) string {
	var sb strings.Builder

	sb.WriteString("# Traceability Validation Report\n\n")
	sb.WriteString("## Summary\n\n")
	sb.WriteString("| Metric | Count |\n")
	sb.WriteString("|--------|-------|\n")
	sb.WriteString("| Requirements | " + Itoa(result.Stats.Requirements) + " |\n")
	sb.WriteString("| Designs | " + Itoa(result.Stats.Designs) + " |\n")
	sb.WriteString("| Tasks | " + Itoa(result.Stats.Tasks) + " |\n")
	sb.WriteString("| Valid Chains | " + Itoa(result.Stats.ValidChains) + " |\n")
	sb.WriteString("| Errors | " + Itoa(len(result.Errors)) + " |\n")
	sb.WriteString("| Warnings | " + Itoa(len(result.Warnings)) + " |\n")
	sb.WriteString("\n")

	if len(result.Errors) > 0 {
		sb.WriteString("## Errors\n\n")
		for _, e := range result.Errors {
			sb.WriteString("- **" + e.Rule + "**: " + e.Message + "\n")
		}
		sb.WriteString("\n")
	}

	if len(result.Warnings) > 0 {
		sb.WriteString("## Warnings\n\n")
		for _, w := range result.Warnings {
			sb.WriteString("- **" + w.Rule + "**: " + w.Message + "\n")
		}
		sb.WriteString("\n")
	}

	if len(result.Info) > 0 {
		sb.WriteString("## Info\n\n")
		for _, i := range result.Info {
			sb.WriteString("- **" + i.Rule + "**: " + i.Message + "\n")
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

func formatTraceabilityConsole(result TraceabilityValidationResult) string {
	var sb strings.Builder

	sb.WriteString("Traceability Validation Report\n")
	sb.WriteString("==============================\n\n")
	sb.WriteString("Stats:\n")
	sb.WriteString("  Requirements: " + Itoa(result.Stats.Requirements) + "\n")
	sb.WriteString("  Designs:      " + Itoa(result.Stats.Designs) + "\n")
	sb.WriteString("  Tasks:        " + Itoa(result.Stats.Tasks) + "\n")
	sb.WriteString("  Valid Chains: " + Itoa(result.Stats.ValidChains) + "\n\n")

	if len(result.Errors) > 0 {
		sb.WriteString("ERRORS (" + Itoa(len(result.Errors)) + "):\n")
		for _, e := range result.Errors {
			sb.WriteString("  [" + e.Rule + "] " + e.Message + "\n")
		}
		sb.WriteString("\n")
	}

	if len(result.Warnings) > 0 {
		sb.WriteString("WARNINGS (" + Itoa(len(result.Warnings)) + "):\n")
		for _, w := range result.Warnings {
			sb.WriteString("  [" + w.Rule + "] " + w.Message + "\n")
		}
		sb.WriteString("\n")
	}

	if len(result.Info) > 0 {
		sb.WriteString("INFO (" + Itoa(len(result.Info)) + "):\n")
		for _, i := range result.Info {
			sb.WriteString("  [" + i.Rule + "] " + i.Message + "\n")
		}
		sb.WriteString("\n")
	}

	if len(result.Errors) == 0 && len(result.Warnings) == 0 {
		sb.WriteString("All traceability checks passed!\n")
	}

	return sb.String()
}

// ValidateTraceabilityFromContent validates traceability from in-memory spec content.
// Useful for testing or when content is already loaded.
func ValidateTraceabilityFromContent(requirements, designs, tasks map[string]*SpecFrontmatter, strict bool) TraceabilityValidationResult {
	specs := &SpecCollection{
		Requirements: requirements,
		Designs:      designs,
		Tasks:        tasks,
		All:          make(map[string]*SpecFrontmatter),
	}

	// Populate All map
	for id, spec := range requirements {
		specs.All[id] = spec
	}
	for id, spec := range designs {
		specs.All[id] = spec
	}
	for id, spec := range tasks {
		specs.All[id] = spec
	}

	result := TraceabilityValidationResult{
		Strict:   strict,
		Stats:    TraceabilityStats{},
		Errors:   []TraceabilityIssue{},
		Warnings: []TraceabilityIssue{},
		Info:     []TraceabilityIssue{},
	}

	result.Stats.Requirements = len(specs.Requirements)
	result.Stats.Designs = len(specs.Designs)
	result.Stats.Tasks = len(specs.Tasks)

	// Run traceability validation
	testResult := TestTraceabilityRules(specs)
	result.Errors = testResult.Errors
	result.Warnings = testResult.Warnings
	result.Info = testResult.Info
	result.Stats.ValidChains = testResult.ValidChains

	// Build checks
	var checks []Check
	for _, e := range result.Errors {
		checks = append(checks, Check{
			Name:    e.Rule,
			Passed:  false,
			Message: e.Message,
		})
	}
	for _, w := range result.Warnings {
		checks = append(checks, Check{
			Name:    w.Rule,
			Passed:  !strict,
			Message: w.Message,
		})
	}
	for _, i := range result.Info {
		checks = append(checks, Check{
			Name:    i.Rule,
			Passed:  true,
			Message: i.Message,
		})
	}
	result.Checks = checks

	// Determine exit code and validity
	if len(result.Errors) > 0 {
		result.Valid = false
		result.ExitCode = 1
		result.Message = "Traceability validation failed with errors"
	} else if len(result.Warnings) > 0 && strict {
		result.Valid = false
		result.ExitCode = 2
		result.Message = "Traceability validation failed with warnings (strict mode)"
	} else {
		result.Valid = true
		result.ExitCode = 0
		if len(result.Warnings) > 0 {
			result.Message = "Traceability validation passed with warnings"
		} else {
			result.Message = "All traceability checks passed"
		}
	}

	return result
}
