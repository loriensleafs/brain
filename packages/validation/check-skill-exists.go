package validation

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// SkillExistsResult represents the outcome of a skill existence check.
type SkillExistsResult struct {
	Exists      bool    `json:"exists"`
	SkillName   string  `json:"skillName"`
	SkillPath   string  `json:"skillPath,omitempty"`
	Name        string  `json:"name,omitempty"`
	Description string  `json:"description,omitempty"`
	Message     string  `json:"message"`
	Checks      []Check `json:"checks"`
}

// CheckSkillExists verifies if a skill exists and validates its frontmatter.
// It checks for the skill file at basePath/.claude/skills/{skillName}/SKILL.md
// and validates that the frontmatter contains required name and description fields.
//
// Parameters:
//   - basePath: The repository root path (e.g., "/path/to/repo")
//   - skillName: The name of the skill to check (e.g., "adr-review")
//
// Returns:
//   - SkillExistsResult with existence status, frontmatter data, and validation checks
func CheckSkillExists(basePath, skillName string) SkillExistsResult {
	var checks []Check
	result := SkillExistsResult{
		SkillName: skillName,
	}

	if skillName == "" {
		return SkillExistsResult{
			Exists:    false,
			SkillName: skillName,
			Message:   "Skill name is required",
			Checks: []Check{{
				Name:    "skill_name_provided",
				Passed:  false,
				Message: "Skill name cannot be empty",
			}},
		}
	}

	// Construct path to SKILL.md
	skillPath := filepath.Join(basePath, ".claude", "skills", skillName, "SKILL.md")
	result.SkillPath = skillPath

	// Check 1: File exists
	if _, err := os.Stat(skillPath); os.IsNotExist(err) {
		return SkillExistsResult{
			Exists:    false,
			SkillName: skillName,
			SkillPath: skillPath,
			Message:   "Skill not found",
			Checks: []Check{{
				Name:    "file_exists",
				Passed:  false,
				Message: "SKILL.md not found at: " + skillPath,
			}},
		}
	}
	checks = append(checks, Check{
		Name:    "file_exists",
		Passed:  true,
		Message: "SKILL.md file exists",
	})

	// Check 2: File is readable
	content, err := os.ReadFile(skillPath)
	if err != nil {
		checks = append(checks, Check{
			Name:    "file_readable",
			Passed:  false,
			Message: "Could not read SKILL.md: " + err.Error(),
		})
		return SkillExistsResult{
			Exists:    false,
			SkillName: skillName,
			SkillPath: skillPath,
			Message:   "Skill file not readable",
			Checks:    checks,
		}
	}
	checks = append(checks, Check{
		Name:    "file_readable",
		Passed:  true,
		Message: "SKILL.md file is readable",
	})

	// Check 3: Parse frontmatter using shared function from validate-skill-format.go
	frontmatter, yamlErr := parseFrontmatter(string(content))
	if frontmatter.RawYAML == "" {
		checks = append(checks, Check{
			Name:    "frontmatter_valid",
			Passed:  false,
			Message: "Invalid frontmatter: no frontmatter found (file must start with ---)",
		})
		return SkillExistsResult{
			Exists:    true, // File exists but frontmatter is missing
			SkillName: skillName,
			SkillPath: skillPath,
			Message:   "Skill exists but has invalid frontmatter",
			Checks:    checks,
		}
	}

	if yamlErr != "" {
		checks = append(checks, Check{
			Name:    "frontmatter_valid",
			Passed:  false,
			Message: "Invalid frontmatter: " + yamlErr,
		})
		return SkillExistsResult{
			Exists:    true, // File exists but frontmatter is invalid
			SkillName: skillName,
			SkillPath: skillPath,
			Message:   "Skill exists but has invalid frontmatter",
			Checks:    checks,
		}
	}
	checks = append(checks, Check{
		Name:    "frontmatter_valid",
		Passed:  true,
		Message: "Frontmatter parsed successfully",
	})

	// Check 4: Name field present
	if frontmatter.Name == "" {
		checks = append(checks, Check{
			Name:    "name_present",
			Passed:  false,
			Message: "Frontmatter missing required 'name' field",
		})
	} else {
		checks = append(checks, Check{
			Name:    "name_present",
			Passed:  true,
			Message: "Name field present: " + frontmatter.Name,
		})
		result.Name = frontmatter.Name
	}

	// Check 5: Description field present
	if frontmatter.Description == "" {
		checks = append(checks, Check{
			Name:    "description_present",
			Passed:  false,
			Message: "Frontmatter missing required 'description' field",
		})
	} else {
		checks = append(checks, Check{
			Name:    "description_present",
			Passed:  true,
			Message: "Description field present",
		})
		result.Description = frontmatter.Description
	}

	// Determine overall validity
	allPassed := true
	for _, check := range checks {
		if !check.Passed {
			allPassed = false
			break
		}
	}

	result.Exists = true
	result.Checks = checks

	if allPassed {
		result.Message = "Skill exists and is valid"
	} else {
		result.Message = "Skill exists but has validation issues"
	}

	return result
}

// ListSkills returns all skill names found in the skills directory.
// It scans basePath/.claude/skills/ for directories containing SKILL.md files.
func ListSkills(basePath string) ([]string, error) {
	skillsDir := filepath.Join(basePath, ".claude", "skills")

	if _, err := os.Stat(skillsDir); os.IsNotExist(err) {
		return nil, nil // No skills directory, return empty list
	}

	entries, err := os.ReadDir(skillsDir)
	if err != nil {
		return nil, err
	}

	var skills []string
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		skillPath := filepath.Join(skillsDir, entry.Name(), "SKILL.md")
		if _, err := os.Stat(skillPath); err == nil {
			skills = append(skills, entry.Name())
		}
	}

	return skills, nil
}

// ValidateAllSkills validates all skills in the skills directory.
// Returns a map of skill name to validation result.
func ValidateAllSkills(basePath string) (map[string]SkillExistsResult, error) {
	skills, err := ListSkills(basePath)
	if err != nil {
		return nil, err
	}

	results := make(map[string]SkillExistsResult)
	for _, skill := range skills {
		results[skill] = CheckSkillExists(basePath, skill)
	}

	return results, nil
}

// CheckSkillScript verifies if a skill script exists for a given operation and action.
// This is compatible with the PowerShell Check-SkillExists.ps1 pattern.
//
// Parameters:
//   - basePath: The repository root path
//   - operation: The operation type (pr, issue, reactions, label, milestone)
//   - action: The action name to check for (uses substring matching)
//
// Returns:
//   - bool indicating if a matching script was found
//   - string with the matched script path (empty if not found)
func CheckSkillScript(basePath, operation, action string) (bool, string) {
	validOperations := map[string]bool{
		"pr":        true,
		"issue":     true,
		"reactions": true,
		"label":     true,
		"milestone": true,
	}

	if !validOperations[operation] {
		return false, ""
	}

	if action == "" {
		return false, ""
	}

	searchPath := filepath.Join(basePath, ".claude", "skills", "github", "scripts", operation)

	if _, err := os.Stat(searchPath); os.IsNotExist(err) {
		return false, ""
	}

	// Build pattern for matching
	pattern := regexp.MustCompile("(?i)" + regexp.QuoteMeta(action))

	entries, err := os.ReadDir(searchPath)
	if err != nil {
		return false, ""
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		if !strings.HasSuffix(strings.ToLower(name), ".ps1") {
			continue
		}

		if pattern.MatchString(name) {
			return true, filepath.Join(searchPath, name)
		}
	}

	return false, ""
}

// ListSkillScripts returns all skill scripts for a given operation.
// Returns nil if the operation directory does not exist.
func ListSkillScripts(basePath, operation string) ([]string, error) {
	searchPath := filepath.Join(basePath, ".claude", "skills", "github", "scripts", operation)

	if _, err := os.Stat(searchPath); os.IsNotExist(err) {
		return nil, nil
	}

	entries, err := os.ReadDir(searchPath)
	if err != nil {
		return nil, err
	}

	var scripts []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		if strings.HasSuffix(strings.ToLower(name), ".ps1") {
			// Return base name without extension
			scripts = append(scripts, strings.TrimSuffix(name, filepath.Ext(name)))
		}
	}

	return scripts, nil
}

// ListAllSkillScripts returns all skill scripts organized by operation type.
// This is the Go equivalent of Check-SkillExists.ps1 -ListAvailable.
func ListAllSkillScripts(basePath string) (map[string][]string, error) {
	operations := []string{"pr", "issue", "reactions", "label", "milestone"}
	result := make(map[string][]string)

	for _, op := range operations {
		scripts, err := ListSkillScripts(basePath, op)
		if err != nil {
			return nil, err
		}
		if scripts != nil && len(scripts) > 0 {
			result[op] = scripts
		}
	}

	return result, nil
}
