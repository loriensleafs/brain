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

// NamingPatterns defines the regex patterns for artifact naming conventions.
var NamingPatterns = map[string]*regexp.Regexp{
	"epic":    regexp.MustCompile(`^EPIC-\d{3}-[\w-]+\.md$`),
	"adr":     regexp.MustCompile(`^ADR-\d{3}-[\w-]+\.md$`),
	"prd":     regexp.MustCompile(`^prd-[\w-]+\.md$`),
	"tasks":   regexp.MustCompile(`^tasks-[\w-]+\.md$`),
	"plan":    regexp.MustCompile(`^\d{3}-[\w-]+-plan\.md$|^(implementation-plan|plan)-[\w-]+\.md$`),
	"tm":      regexp.MustCompile(`^TM-\d{3}-[\w-]+\.md$`),
	"req":     regexp.MustCompile(`^REQ-\d{3}-[\w-]+\.md$`),
	"design":  regexp.MustCompile(`^DESIGN-\d{3}-[\w-]+\.md$`),
	"task":    regexp.MustCompile(`^TASK-\d{3}-[\w-]+\.md$`),
	"skill":   regexp.MustCompile(`^Skill-[\w]+-\d{3}\.md$`),
	"retro":   regexp.MustCompile(`^\d{4}-\d{2}-\d{2}-[\w-]+\.md$`),
	"session": regexp.MustCompile(`^\d{4}-\d{2}-\d{2}-session-\d+\.md$`),
}

// NamingPatternInput represents input for naming pattern validation.
type NamingPatternInput struct {
	FileName    string `json:"fileName"`
	PatternType string `json:"patternType,omitempty"`
}

var (
	namingPatternSchemaOnce     sync.Once
	namingPatternSchemaCompiled *jsonschema.Schema
	namingPatternSchemaErr      error
	namingPatternSchemaData     []byte
)

// SetNamingPatternSchemaData sets the schema data for naming pattern validation.
func SetNamingPatternSchemaData(data []byte) {
	namingPatternSchemaData = data
}

// getNamingPatternSchema returns the compiled naming pattern schema.
func getNamingPatternSchema() (*jsonschema.Schema, error) {
	namingPatternSchemaOnce.Do(func() {
		if namingPatternSchemaData == nil {
			namingPatternSchemaErr = fmt.Errorf("naming pattern schema data not set; call SetNamingPatternSchemaData first")
			return
		}

		var schemaDoc any
		if err := json.Unmarshal(namingPatternSchemaData, &schemaDoc); err != nil {
			namingPatternSchemaErr = fmt.Errorf("failed to parse naming pattern schema: %w", err)
			return
		}

		c := jsonschema.NewCompiler()
		if err := c.AddResource("naming-pattern.schema.json", schemaDoc); err != nil {
			namingPatternSchemaErr = fmt.Errorf("failed to add naming pattern schema resource: %w", err)
			return
		}

		namingPatternSchemaCompiled, namingPatternSchemaErr = c.Compile("naming-pattern.schema.json")
	})
	return namingPatternSchemaCompiled, namingPatternSchemaErr
}

// ValidateNamingPatternInput validates naming pattern input against the JSON Schema.
func ValidateNamingPatternInput(input NamingPatternInput) bool {
	schema, err := getNamingPatternSchema()
	if err != nil {
		return false
	}

	data, err := json.Marshal(input)
	if err != nil {
		return false
	}

	var inputMap any
	if err := json.Unmarshal(data, &inputMap); err != nil {
		return false
	}

	return schema.Validate(inputMap) == nil
}

// GetNamingPatternInputErrors returns validation errors for naming pattern input.
func GetNamingPatternInputErrors(input NamingPatternInput) []ValidationError {
	schema, err := getNamingPatternSchema()
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "schema",
			Message:    err.Error(),
		}}
	}

	data, err := json.Marshal(input)
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "marshal",
			Message:    err.Error(),
		}}
	}

	var inputMap any
	if err := json.Unmarshal(data, &inputMap); err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "unmarshal",
			Message:    err.Error(),
		}}
	}

	err = schema.Validate(inputMap)
	if err == nil {
		return []ValidationError{}
	}

	return ExtractValidationErrors(err)
}

// ConsistencyValidationResult extends ValidationResult with consistency-specific fields.
type ConsistencyValidationResult struct {
	ValidationResult
	BasePath            string                    `json:"basePath,omitempty"`
	Feature             string                    `json:"feature,omitempty"`
	Checkpoint          int                       `json:"checkpoint"`
	Artifacts           FeatureArtifacts          `json:"artifacts"`
	ScopeAlignment      ScopeAlignmentResult      `json:"scopeAlignment"`
	RequirementCoverage RequirementCoverageResult `json:"requirementCoverage"`
	NamingConventions   NamingConventionsResult   `json:"namingConventions"`
	CrossReferences     CrossReferencesResult     `json:"crossReferences"`
	TaskCompletion      TaskCompletionResult      `json:"taskCompletion"`
}

// FeatureArtifacts represents artifacts found for a feature.
type FeatureArtifacts struct {
	Epic  string `json:"epic,omitempty"`
	PRD   string `json:"prd,omitempty"`
	Tasks string `json:"tasks,omitempty"`
	Plan  string `json:"plan,omitempty"`
}

// ScopeAlignmentResult represents the result of scope alignment validation.
type ScopeAlignmentResult struct {
	Passed bool     `json:"passed"`
	Issues []string `json:"issues,omitempty"`
}

// RequirementCoverageResult represents the result of requirement coverage validation.
type RequirementCoverageResult struct {
	Passed           bool     `json:"passed"`
	Issues           []string `json:"issues,omitempty"`
	RequirementCount int      `json:"requirementCount"`
	TaskCount        int      `json:"taskCount"`
}

// NamingConventionsResult represents the result of naming conventions validation.
type NamingConventionsResult struct {
	Passed bool     `json:"passed"`
	Issues []string `json:"issues,omitempty"`
}

// CrossReferencesResult represents the result of cross-reference validation.
type CrossReferencesResult struct {
	Passed     bool     `json:"passed"`
	Issues     []string `json:"issues,omitempty"`
	References []string `json:"references,omitempty"`
}

// TaskCompletionResult represents the result of task completion validation.
type TaskCompletionResult struct {
	Passed       bool     `json:"passed"`
	Issues       []string `json:"issues,omitempty"`
	Total        int      `json:"total"`
	Completed    int      `json:"completed"`
	P0Incomplete []string `json:"p0Incomplete,omitempty"`
	P1Incomplete []string `json:"p1Incomplete,omitempty"`
}

// ValidateConsistency validates cross-document consistency for a feature.
// basePath is the root directory to search from (typically project root).
// feature is the name of the feature to validate.
// checkpoint is which validation checkpoint (1 = Pre-Critic, 2 = Post-Implementation).
func ValidateConsistency(basePath, feature string, checkpoint int) ConsistencyValidationResult {
	var checks []Check
	allPassed := true

	result := ConsistencyValidationResult{
		BasePath:   basePath,
		Feature:    feature,
		Checkpoint: checkpoint,
	}

	// Find artifacts for the feature
	artifacts := FindFeatureArtifacts(feature, basePath)
	result.Artifacts = artifacts

	// Run Checkpoint 1 validations
	if checkpoint >= 1 {
		// Scope Alignment
		scopeResult := ValidateScopeAlignment(artifacts.Epic, artifacts.PRD)
		result.ScopeAlignment = scopeResult
		if !scopeResult.Passed {
			allPassed = false
			for _, issue := range scopeResult.Issues {
				checks = append(checks, Check{
					Name:    "scope_alignment",
					Passed:  false,
					Message: issue,
				})
			}
		} else {
			checks = append(checks, Check{
				Name:    "scope_alignment",
				Passed:  true,
				Message: "PRD scope aligns with Epic outcomes",
			})
		}

		// Requirement Coverage
		coverageResult := ValidateRequirementCoverage(artifacts.PRD, artifacts.Tasks)
		result.RequirementCoverage = coverageResult
		if !coverageResult.Passed {
			allPassed = false
			for _, issue := range coverageResult.Issues {
				checks = append(checks, Check{
					Name:    "requirement_coverage",
					Passed:  false,
					Message: issue,
				})
			}
		} else {
			checks = append(checks, Check{
				Name:    "requirement_coverage",
				Passed:  true,
				Message: "All requirements have corresponding tasks",
			})
		}

		// Naming Conventions
		namingResult := ValidateNamingConventions(artifacts)
		result.NamingConventions = namingResult
		if !namingResult.Passed {
			allPassed = false
			for _, issue := range namingResult.Issues {
				checks = append(checks, Check{
					Name:    "naming_conventions",
					Passed:  false,
					Message: issue,
				})
			}
		} else {
			checks = append(checks, Check{
				Name:    "naming_conventions",
				Passed:  true,
				Message: "All artifacts follow naming conventions",
			})
		}

		// Cross-References
		crossRefResult := ValidateCrossReferences(artifacts, basePath)
		result.CrossReferences = crossRefResult
		if !crossRefResult.Passed {
			allPassed = false
			for _, issue := range crossRefResult.Issues {
				checks = append(checks, Check{
					Name:    "cross_references",
					Passed:  false,
					Message: issue,
				})
			}
		} else {
			checks = append(checks, Check{
				Name:    "cross_references",
				Passed:  true,
				Message: "All cross-references point to existing files",
			})
		}
	}

	// Run Checkpoint 2 validations
	if checkpoint >= 2 {
		taskResult := ValidateTaskCompletion(artifacts.Tasks)
		result.TaskCompletion = taskResult
		if !taskResult.Passed {
			allPassed = false
			for _, issue := range taskResult.Issues {
				checks = append(checks, Check{
					Name:    "task_completion",
					Passed:  false,
					Message: issue,
				})
			}
		} else {
			checks = append(checks, Check{
				Name:    "task_completion",
				Passed:  true,
				Message: "All P0 tasks completed",
			})
		}
	}

	result.ValidationResult = ValidationResult{
		Valid:  allPassed,
		Checks: checks,
	}

	if allPassed {
		result.Message = "Consistency validation passed"
	} else {
		result.Message = "Consistency validation failed"
		result.Remediation = buildConsistencyRemediation(checks)
	}

	return result
}

// ValidateNamingConvention checks if a file name matches expected pattern.
func ValidateNamingConvention(filePath, expectedPattern string) bool {
	fileName := filepath.Base(filePath)

	pattern, ok := NamingPatterns[expectedPattern]
	if !ok {
		// Unknown pattern, skip validation
		return true
	}

	return pattern.MatchString(fileName)
}

// FindFeatureArtifacts finds all artifacts related to a feature name.
func FindFeatureArtifacts(featureName, basePath string) FeatureArtifacts {
	artifacts := FeatureArtifacts{}
	agentsPath := filepath.Join(basePath, ".agents")

	// Find Epic
	epicPath := filepath.Join(agentsPath, "roadmap")
	if DirExists(epicPath) {
		pattern := filepath.Join(epicPath, "EPIC-*-*"+featureName+"*.md")
		matches, _ := filepath.Glob(pattern)
		if len(matches) > 0 {
			artifacts.Epic = matches[0]
		}
	}

	// Find PRD, Tasks, Plan
	planningPath := filepath.Join(agentsPath, "planning")
	if DirExists(planningPath) {
		// PRD
		prdPattern := filepath.Join(planningPath, "prd-*"+featureName+"*.md")
		prdMatches, _ := filepath.Glob(prdPattern)
		if len(prdMatches) > 0 {
			artifacts.PRD = prdMatches[0]
		}

		// Tasks
		tasksPattern := filepath.Join(planningPath, "tasks-*"+featureName+"*.md")
		tasksMatches, _ := filepath.Glob(tasksPattern)
		if len(tasksMatches) > 0 {
			artifacts.Tasks = tasksMatches[0]
		}

		// Plan (multiple patterns)
		planPatterns := []string{
			filepath.Join(planningPath, "*plan*"+featureName+"*.md"),
			filepath.Join(planningPath, "*-"+featureName+"-plan.md"),
		}
		for _, planPattern := range planPatterns {
			planMatches, _ := filepath.Glob(planPattern)
			if len(planMatches) > 0 {
				artifacts.Plan = planMatches[0]
				break
			}
		}
	}

	return artifacts
}

// GetAllFeatures discovers all features from existing artifacts.
func GetAllFeatures(basePath string) []string {
	var features []string
	seen := make(map[string]bool)
	planningPath := filepath.Join(basePath, ".agents", "planning")

	if !DirExists(planningPath) {
		return features
	}

	// Extract feature names from prd-*.md files
	prdPattern := filepath.Join(planningPath, "prd-*.md")
	prdMatches, _ := filepath.Glob(prdPattern)
	for _, path := range prdMatches {
		name := extractFeatureName(filepath.Base(path), "prd-")
		if name != "" && !seen[name] {
			features = append(features, name)
			seen[name] = true
		}
	}

	// Also check tasks-*.md
	tasksPattern := filepath.Join(planningPath, "tasks-*.md")
	tasksMatches, _ := filepath.Glob(tasksPattern)
	for _, path := range tasksMatches {
		name := extractFeatureName(filepath.Base(path), "tasks-")
		if name != "" && !seen[name] {
			features = append(features, name)
			seen[name] = true
		}
	}

	return features
}

// ValidateScopeAlignment validates that PRD scope aligns with Epic outcomes.
func ValidateScopeAlignment(epicPath, prdPath string) ScopeAlignmentResult {
	result := ScopeAlignmentResult{
		Passed: true,
	}

	// If no epic, skip this check (not a failure)
	if epicPath == "" || !FileExists(epicPath) {
		result.Issues = append(result.Issues, "Epic file not found")
		return result // Not a failure, just noted
	}

	// If no PRD, this is a failure
	if prdPath == "" || !FileExists(prdPath) {
		result.Passed = false
		result.Issues = append(result.Issues, "PRD file not found")
		return result
	}

	epicContent, err := os.ReadFile(epicPath)
	if err != nil {
		result.Passed = false
		result.Issues = append(result.Issues, "Could not read Epic file: "+err.Error())
		return result
	}

	prdContent, err := os.ReadFile(prdPath)
	if err != nil {
		result.Passed = false
		result.Issues = append(result.Issues, "Could not read PRD file: "+err.Error())
		return result
	}

	// Check if PRD references the epic
	epicName := filepath.Base(epicPath)
	epicPattern := regexp.MustCompile(`EPIC-\d{3}`)
	if !strings.Contains(string(prdContent), epicName) && !epicPattern.Match(prdContent) {
		result.Issues = append(result.Issues, "PRD does not reference parent Epic")
	}

	// Extract success criteria from epic
	successCriteriaPattern := regexp.MustCompile(`(?s)### Success Criteria(.+?)(?:###|$)`)
	criteriaMatch := successCriteriaPattern.FindSubmatch(epicContent)
	if len(criteriaMatch) > 1 {
		criteriaContent := string(criteriaMatch[1])
		// Count checkbox items
		checkboxPattern := regexp.MustCompile(`- \[[ x]\]`)
		criteriaCount := len(checkboxPattern.FindAllString(criteriaContent, -1))

		if criteriaCount > 0 {
			// Check PRD has corresponding requirements
			requirementsPattern := regexp.MustCompile(`(?s)## Requirements(.+?)(?:##|$)`)
			reqMatch := requirementsPattern.FindSubmatch(prdContent)
			if len(reqMatch) > 1 {
				reqContent := string(reqMatch[1])
				// Count requirement items (checkboxes, numbered items, bullet points)
				reqPattern := regexp.MustCompile(`(?m)- \[[ x]\]|^\d+\.|^-\s`)
				reqCount := len(reqPattern.FindAllString(reqContent, -1))

				if reqCount < criteriaCount {
					result.Issues = append(result.Issues,
						"PRD has fewer requirements ("+Itoa(reqCount)+") than Epic success criteria ("+Itoa(criteriaCount)+")")
				}
			}
		}
	}

	if len(result.Issues) > 0 {
		result.Passed = false
	}

	return result
}

// ValidateRequirementCoverage validates that all PRD requirements have corresponding tasks.
func ValidateRequirementCoverage(prdPath, tasksPath string) RequirementCoverageResult {
	result := RequirementCoverageResult{
		Passed: true,
	}

	// If no PRD, skip
	if prdPath == "" || !FileExists(prdPath) {
		return result
	}

	// If no tasks file, this is a failure
	if tasksPath == "" || !FileExists(tasksPath) {
		result.Passed = false
		result.Issues = append(result.Issues, "Tasks file not found for PRD")
		return result
	}

	prdContent, err := os.ReadFile(prdPath)
	if err != nil {
		result.Passed = false
		result.Issues = append(result.Issues, "Could not read PRD file: "+err.Error())
		return result
	}

	tasksContent, err := os.ReadFile(tasksPath)
	if err != nil {
		result.Passed = false
		result.Issues = append(result.Issues, "Could not read Tasks file: "+err.Error())
		return result
	}

	// Count requirements in PRD (checkbox lists or numbered items)
	reqPattern := regexp.MustCompile(`(?m)^[\s]*[-*]\s+\[[ x]\]|^[\s]*\d+\.\s+`)
	reqMatches := reqPattern.FindAllString(string(prdContent), -1)
	result.RequirementCount = len(reqMatches)

	// Count tasks
	taskPattern := regexp.MustCompile(`(?m)^[\s]*[-*]\s+\[[ x]\]|^###\s+Task`)
	taskMatches := taskPattern.FindAllString(string(tasksContent), -1)
	result.TaskCount = len(taskMatches)

	if result.TaskCount < result.RequirementCount {
		result.Passed = false
		result.Issues = append(result.Issues,
			"Fewer tasks ("+Itoa(result.TaskCount)+") than requirements ("+Itoa(result.RequirementCount)+")")
	}

	return result
}

// ValidateNamingConventions validates all artifact naming conventions.
func ValidateNamingConventions(artifacts FeatureArtifacts) NamingConventionsResult {
	result := NamingConventionsResult{
		Passed: true,
	}

	checks := []struct {
		Path string
		Type string
		Name string
	}{
		{artifacts.Epic, "epic", "Epic"},
		{artifacts.PRD, "prd", "PRD"},
		{artifacts.Tasks, "tasks", "Tasks"},
		{artifacts.Plan, "plan", "Plan"},
	}

	for _, check := range checks {
		if check.Path != "" && FileExists(check.Path) {
			if !ValidateNamingConvention(check.Path, check.Type) {
				result.Passed = false
				fileName := filepath.Base(check.Path)
				result.Issues = append(result.Issues, check.Name+" naming violation: "+fileName)
			}
		}
	}

	return result
}

// ValidateCrossReferences validates that cross-references point to existing files.
func ValidateCrossReferences(artifacts FeatureArtifacts, basePath string) CrossReferencesResult {
	result := CrossReferencesResult{
		Passed: true,
	}

	artifactPaths := []string{artifacts.Epic, artifacts.PRD, artifacts.Tasks, artifacts.Plan}

	for _, artifactPath := range artifactPaths {
		if artifactPath == "" || !FileExists(artifactPath) {
			continue
		}

		refResult := validateFileReferences(artifactPath)
		if !refResult.Passed {
			result.Passed = false
			result.Issues = append(result.Issues, refResult.Issues...)
		}
		result.References = append(result.References, refResult.References...)
	}

	return result
}

// validateFileReferences validates cross-references in a single file.
func validateFileReferences(filePath string) CrossReferencesResult {
	result := CrossReferencesResult{
		Passed: true,
	}

	content, err := os.ReadFile(filePath)
	if err != nil {
		return result
	}

	fileDir := filepath.Dir(filePath)

	// Find markdown links: [text](path)
	linkPattern := regexp.MustCompile(`\[([^\]]+)\]\(([^)]+)\)`)
	matches := linkPattern.FindAllSubmatch(content, -1)

	for _, match := range matches {
		linkPath := string(match[2])

		// Skip URLs and anchors
		if strings.HasPrefix(linkPath, "http://") ||
			strings.HasPrefix(linkPath, "https://") ||
			strings.HasPrefix(linkPath, "#") {
			continue
		}

		// Remove anchor from path
		if idx := strings.Index(linkPath, "#"); idx >= 0 {
			linkPath = linkPath[:idx]
		}

		if linkPath == "" {
			continue
		}

		result.References = append(result.References, linkPath)

		// Resolve relative path
		var fullPath string
		if filepath.IsAbs(linkPath) {
			fullPath = linkPath
		} else {
			fullPath = filepath.Join(fileDir, linkPath)
		}

		if !FileExists(fullPath) {
			result.Passed = false
			result.Issues = append(result.Issues, "Broken reference in "+filepath.Base(filePath)+": "+linkPath)
		}
	}

	return result
}

// ValidateTaskCompletion validates task completion status for Checkpoint 2.
func ValidateTaskCompletion(tasksPath string) TaskCompletionResult {
	result := TaskCompletionResult{
		Passed: true,
	}

	if tasksPath == "" || !FileExists(tasksPath) {
		return result
	}

	content, err := os.ReadFile(tasksPath)
	if err != nil {
		return result
	}

	lines := strings.Split(string(content), "\n")
	currentPriority := "P2"

	priorityPattern := regexp.MustCompile(`##.*P([012])|Priority:\s*P([012])|### P([012])`)
	taskPattern := regexp.MustCompile(`^\s*[-*]\s+\[([x ])\]\s+(.+)$`)

	for _, line := range lines {
		// Detect priority sections
		if matches := priorityPattern.FindStringSubmatch(line); len(matches) > 0 {
			for _, m := range matches[1:] {
				if m != "" {
					currentPriority = "P" + m
					break
				}
			}
		}

		// Count tasks
		if matches := taskPattern.FindStringSubmatch(line); len(matches) > 0 {
			result.Total++
			isComplete := strings.ToLower(matches[1]) == "x"
			taskName := strings.TrimSpace(matches[2])

			if isComplete {
				result.Completed++
			} else {
				switch currentPriority {
				case "P0":
					result.P0Incomplete = append(result.P0Incomplete, taskName)
				case "P1":
					result.P1Incomplete = append(result.P1Incomplete, taskName)
				}
			}
		}
	}

	if len(result.P0Incomplete) > 0 {
		result.Passed = false
		result.Issues = append(result.Issues, "P0 tasks incomplete: "+Itoa(len(result.P0Incomplete)))
	}

	return result
}

// ValidateAllFeatures validates consistency for all features found in basePath.
func ValidateAllFeatures(basePath string, checkpoint int) []ConsistencyValidationResult {
	var results []ConsistencyValidationResult

	features := GetAllFeatures(basePath)
	for _, feature := range features {
		result := ValidateConsistency(basePath, feature, checkpoint)
		results = append(results, result)
	}

	return results
}

// ValidateArtifactNaming validates that an artifact file follows naming conventions.
// Returns true if valid, false otherwise.
func ValidateArtifactNaming(filePath string) (bool, string) {
	fileName := filepath.Base(filePath)

	// Check patterns in priority order (more specific patterns first)
	// Session pattern must be checked before retro since both start with YYYY-MM-DD
	patternOrder := []string{
		"session", // YYYY-MM-DD-session-NN.md (most specific date pattern)
		"retro",   // YYYY-MM-DD-*.md (less specific date pattern)
		"epic",
		"adr",
		"prd",
		"tasks",
		"plan",
		"tm",
		"req",
		"design",
		"task",
		"skill",
	}

	for _, patternName := range patternOrder {
		pattern := NamingPatterns[patternName]
		if pattern.MatchString(fileName) {
			return true, patternName
		}
	}

	// Check if it's in a known directory that implies a pattern
	dir := filepath.Base(filepath.Dir(filePath))
	switch dir {
	case "roadmap":
		if NamingPatterns["epic"].MatchString(fileName) {
			return true, "epic"
		}
	case "architecture":
		if NamingPatterns["adr"].MatchString(fileName) {
			return true, "adr"
		}
	case "security":
		if NamingPatterns["tm"].MatchString(fileName) {
			return true, "tm"
		}
	case "planning":
		for _, pType := range []string{"prd", "tasks", "plan"} {
			if NamingPatterns[pType].MatchString(fileName) {
				return true, pType
			}
		}
	case "sessions":
		if NamingPatterns["session"].MatchString(fileName) {
			return true, "session"
		}
	case "retrospective":
		if NamingPatterns["retro"].MatchString(fileName) {
			return true, "retro"
		}
	case "skills":
		if NamingPatterns["skill"].MatchString(fileName) {
			return true, "skill"
		}
	case "requirements":
		if NamingPatterns["req"].MatchString(fileName) {
			return true, "req"
		}
	case "design":
		if NamingPatterns["design"].MatchString(fileName) {
			return true, "design"
		}
	case "tasks":
		if NamingPatterns["task"].MatchString(fileName) {
			return true, "task"
		}
	}

	return false, ""
}

// ValidateConsistencyFromContent validates consistency from content strings.
// Useful for testing or when content is already loaded.
func ValidateConsistencyFromContent(epicContent, prdContent, tasksContent, planContent string, feature string, checkpoint int) ConsistencyValidationResult {
	var checks []Check
	allPassed := true

	result := ConsistencyValidationResult{
		Feature:    feature,
		Checkpoint: checkpoint,
	}

	// Validate naming is skipped for content-based validation (no file paths)

	// Run Checkpoint 1 validations
	if checkpoint >= 1 {
		// Scope Alignment (content-based)
		scopeResult := validateScopeAlignmentFromContent(epicContent, prdContent)
		result.ScopeAlignment = scopeResult
		if !scopeResult.Passed {
			allPassed = false
			for _, issue := range scopeResult.Issues {
				checks = append(checks, Check{
					Name:    "scope_alignment",
					Passed:  false,
					Message: issue,
				})
			}
		} else {
			checks = append(checks, Check{
				Name:    "scope_alignment",
				Passed:  true,
				Message: "PRD scope aligns with Epic outcomes",
			})
		}

		// Requirement Coverage (content-based)
		coverageResult := validateRequirementCoverageFromContent(prdContent, tasksContent)
		result.RequirementCoverage = coverageResult
		if !coverageResult.Passed {
			allPassed = false
			for _, issue := range coverageResult.Issues {
				checks = append(checks, Check{
					Name:    "requirement_coverage",
					Passed:  false,
					Message: issue,
				})
			}
		} else {
			checks = append(checks, Check{
				Name:    "requirement_coverage",
				Passed:  true,
				Message: "All requirements have corresponding tasks",
			})
		}
	}

	// Run Checkpoint 2 validations
	if checkpoint >= 2 {
		taskResult := validateTaskCompletionFromContent(tasksContent)
		result.TaskCompletion = taskResult
		if !taskResult.Passed {
			allPassed = false
			for _, issue := range taskResult.Issues {
				checks = append(checks, Check{
					Name:    "task_completion",
					Passed:  false,
					Message: issue,
				})
			}
		} else {
			checks = append(checks, Check{
				Name:    "task_completion",
				Passed:  true,
				Message: "All P0 tasks completed",
			})
		}
	}

	result.ValidationResult = ValidationResult{
		Valid:  allPassed,
		Checks: checks,
	}

	if allPassed {
		result.Message = "Consistency validation passed"
	} else {
		result.Message = "Consistency validation failed"
		result.Remediation = buildConsistencyRemediation(checks)
	}

	return result
}

// validateScopeAlignmentFromContent validates scope alignment from content strings.
func validateScopeAlignmentFromContent(epicContent, prdContent string) ScopeAlignmentResult {
	result := ScopeAlignmentResult{
		Passed: true,
	}

	// If no epic content, skip
	if epicContent == "" {
		result.Issues = append(result.Issues, "Epic content not provided")
		return result
	}

	// If no PRD content, this is a failure
	if prdContent == "" {
		result.Passed = false
		result.Issues = append(result.Issues, "PRD content not provided")
		return result
	}

	// Check if PRD references the epic
	epicPattern := regexp.MustCompile(`EPIC-\d{3}`)
	if !epicPattern.MatchString(prdContent) {
		result.Issues = append(result.Issues, "PRD does not reference parent Epic")
	}

	// Extract success criteria from epic
	successCriteriaPattern := regexp.MustCompile(`(?s)### Success Criteria(.+?)(?:###|$)`)
	criteriaMatch := successCriteriaPattern.FindStringSubmatch(epicContent)
	if len(criteriaMatch) > 1 {
		criteriaContent := criteriaMatch[1]
		checkboxPattern := regexp.MustCompile(`- \[[ x]\]`)
		criteriaCount := len(checkboxPattern.FindAllString(criteriaContent, -1))

		if criteriaCount > 0 {
			requirementsPattern := regexp.MustCompile(`(?s)## Requirements(.+?)(?:##|$)`)
			reqMatch := requirementsPattern.FindStringSubmatch(prdContent)
			if len(reqMatch) > 1 {
				reqContent := reqMatch[1]
				reqPattern := regexp.MustCompile(`(?m)- \[[ x]\]|^\d+\.|^-\s`)
				reqCount := len(reqPattern.FindAllString(reqContent, -1))

				if reqCount < criteriaCount {
					result.Issues = append(result.Issues,
						"PRD has fewer requirements ("+Itoa(reqCount)+") than Epic success criteria ("+Itoa(criteriaCount)+")")
				}
			}
		}
	}

	if len(result.Issues) > 0 {
		result.Passed = false
	}

	return result
}

// validateRequirementCoverageFromContent validates requirement coverage from content strings.
func validateRequirementCoverageFromContent(prdContent, tasksContent string) RequirementCoverageResult {
	result := RequirementCoverageResult{
		Passed: true,
	}

	if prdContent == "" {
		return result
	}

	if tasksContent == "" {
		result.Passed = false
		result.Issues = append(result.Issues, "Tasks content not provided for PRD")
		return result
	}

	// Count requirements in PRD
	reqPattern := regexp.MustCompile(`(?m)^[\s]*[-*]\s+\[[ x]\]|^[\s]*\d+\.\s+`)
	reqMatches := reqPattern.FindAllString(prdContent, -1)
	result.RequirementCount = len(reqMatches)

	// Count tasks
	taskPattern := regexp.MustCompile(`(?m)^[\s]*[-*]\s+\[[ x]\]|^###\s+Task`)
	taskMatches := taskPattern.FindAllString(tasksContent, -1)
	result.TaskCount = len(taskMatches)

	if result.TaskCount < result.RequirementCount {
		result.Passed = false
		result.Issues = append(result.Issues,
			"Fewer tasks ("+Itoa(result.TaskCount)+") than requirements ("+Itoa(result.RequirementCount)+")")
	}

	return result
}

// validateTaskCompletionFromContent validates task completion from content string.
func validateTaskCompletionFromContent(tasksContent string) TaskCompletionResult {
	result := TaskCompletionResult{
		Passed: true,
	}

	if tasksContent == "" {
		return result
	}

	lines := strings.Split(tasksContent, "\n")
	currentPriority := "P2"

	priorityPattern := regexp.MustCompile(`##.*P([012])|Priority:\s*P([012])|### P([012])`)
	taskPattern := regexp.MustCompile(`^\s*[-*]\s+\[([x ])\]\s+(.+)$`)

	for _, line := range lines {
		if matches := priorityPattern.FindStringSubmatch(line); len(matches) > 0 {
			for _, m := range matches[1:] {
				if m != "" {
					currentPriority = "P" + m
					break
				}
			}
		}

		if matches := taskPattern.FindStringSubmatch(line); len(matches) > 0 {
			result.Total++
			isComplete := strings.ToLower(matches[1]) == "x"
			taskName := strings.TrimSpace(matches[2])

			if isComplete {
				result.Completed++
			} else {
				switch currentPriority {
				case "P0":
					result.P0Incomplete = append(result.P0Incomplete, taskName)
				case "P1":
					result.P1Incomplete = append(result.P1Incomplete, taskName)
				}
			}
		}
	}

	if len(result.P0Incomplete) > 0 {
		result.Passed = false
		result.Issues = append(result.Issues, "P0 tasks incomplete: "+Itoa(len(result.P0Incomplete)))
	}

	return result
}

// Helper functions

func extractFeatureName(fileName, prefix string) string {
	if !strings.HasPrefix(fileName, prefix) {
		return ""
	}
	name := strings.TrimPrefix(fileName, prefix)
	name = strings.TrimSuffix(name, ".md")
	return name
}

func buildConsistencyRemediation(checks []Check) string {
	var failedChecks []string
	for _, check := range checks {
		if !check.Passed {
			failedChecks = append(failedChecks, check.Name)
		}
	}

	if len(failedChecks) == 0 {
		return ""
	}

	// Deduplicate
	seen := make(map[string]bool)
	var unique []string
	for _, c := range failedChecks {
		if !seen[c] {
			seen[c] = true
			unique = append(unique, c)
		}
	}

	return "Fix the following checks: " + strings.Join(unique, ", ") + ". See naming-conventions.md for requirements."
}
