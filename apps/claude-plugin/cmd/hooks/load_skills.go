package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// LoadSkillsInput represents the input for load-skills command
type LoadSkillsInput struct {
	Skills    []string `json:"skills,omitempty"`
	Scenario  string   `json:"scenario,omitempty"`
	SkillsDir string   `json:"skillsDir,omitempty"`
}

// LoadSkillsOutput represents the output for load-skills command
type LoadSkillsOutput struct {
	Success     bool              `json:"success"`
	Content     string            `json:"content,omitempty"`
	Skills      []SkillInfo       `json:"skills,omitempty"`
	SkillsDir   string            `json:"skillsDir,omitempty"`
	Error       string            `json:"error,omitempty"`
	FilesLoaded []string          `json:"filesLoaded,omitempty"`
}

// SkillInfo represents information about a loaded skill
type SkillInfo struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	Content string `json:"content,omitempty"`
}

// RunLoadSkills handles the load-skills command
// It loads skill markdown files from the skills/ directory
func RunLoadSkills() error {
	// Read input from stdin (optional)
	input, _ := io.ReadAll(os.Stdin)

	var loadInput LoadSkillsInput
	if len(input) > 0 {
		// Try to parse as JSON
		json.Unmarshal(input, &loadInput)
	}

	// Resolve skills directory
	skillsDir := loadInput.SkillsDir
	if skillsDir == "" {
		skillsDir = resolveSkillsPath()
	}

	if skillsDir == "" {
		return outputJSON(LoadSkillsOutput{
			Success: false,
			Error:   "Could not locate skills directory",
		})
	}

	output := LoadSkillsOutput{
		Success:     true,
		SkillsDir:   skillsDir,
		FilesLoaded: []string{},
	}

	var contentBuilder strings.Builder

	// If specific skills requested, load only those
	if len(loadInput.Skills) > 0 {
		for _, skillName := range loadInput.Skills {
			skillContent, files, err := loadSkill(skillsDir, skillName)
			if err != nil {
				// Continue with other skills
				continue
			}
			output.Skills = append(output.Skills, SkillInfo{
				Name:    skillName,
				Path:    filepath.Join(skillsDir, skillName),
				Content: skillContent,
			})
			output.FilesLoaded = append(output.FilesLoaded, files...)
			contentBuilder.WriteString(skillContent)
			contentBuilder.WriteString("\n\n---\n\n")
		}
	} else if loadInput.Scenario != "" {
		// Load skills relevant to scenario
		skills := getSkillsForScenario(loadInput.Scenario)
		for _, skillName := range skills {
			skillContent, files, err := loadSkill(skillsDir, skillName)
			if err != nil {
				continue
			}
			output.Skills = append(output.Skills, SkillInfo{
				Name:    skillName,
				Path:    filepath.Join(skillsDir, skillName),
				Content: skillContent,
			})
			output.FilesLoaded = append(output.FilesLoaded, files...)
			contentBuilder.WriteString(skillContent)
			contentBuilder.WriteString("\n\n---\n\n")
		}
	} else {
		// Load all skills
		entries, err := os.ReadDir(skillsDir)
		if err != nil {
			return outputJSON(LoadSkillsOutput{
				Success: false,
				Error:   fmt.Sprintf("Failed to read skills directory: %v", err),
			})
		}

		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			skillName := entry.Name()
			skillContent, files, err := loadSkill(skillsDir, skillName)
			if err != nil {
				continue
			}
			output.Skills = append(output.Skills, SkillInfo{
				Name:    skillName,
				Path:    filepath.Join(skillsDir, skillName),
				Content: skillContent,
			})
			output.FilesLoaded = append(output.FilesLoaded, files...)
			contentBuilder.WriteString(skillContent)
			contentBuilder.WriteString("\n\n---\n\n")
		}
	}

	output.Content = contentBuilder.String()

	return outputJSON(output)
}

// loadSkill loads a single skill and all its markdown files
func loadSkill(skillsDir, skillName string) (string, []string, error) {
	skillPath := filepath.Join(skillsDir, skillName)

	// Check if skill directory exists
	if _, err := os.Stat(skillPath); os.IsNotExist(err) {
		return "", nil, fmt.Errorf("skill not found: %s", skillName)
	}

	var contentBuilder strings.Builder
	var filesLoaded []string

	// Load main SKILL.md first
	mainSkillFile := filepath.Join(skillPath, "SKILL.md")
	if content, err := os.ReadFile(mainSkillFile); err == nil {
		contentBuilder.WriteString(fmt.Sprintf("# Skill: %s\n\n", skillName))
		contentBuilder.Write(content)
		contentBuilder.WriteString("\n\n")
		filesLoaded = append(filesLoaded, mainSkillFile)
	}

	// Load other top-level markdown files
	topLevelFiles := []string{"ANALYSIS.md", "PLANNING.md", "CODING.md"}
	for _, fileName := range topLevelFiles {
		filePath := filepath.Join(skillPath, fileName)
		if content, err := os.ReadFile(filePath); err == nil {
			contentBuilder.WriteString(fmt.Sprintf("## %s\n\n", strings.TrimSuffix(fileName, ".md")))
			contentBuilder.Write(content)
			contentBuilder.WriteString("\n\n")
			filesLoaded = append(filesLoaded, filePath)
		}
	}

	// Load scenarios subdirectory
	scenariosDir := filepath.Join(skillPath, "scenarios")
	if entries, err := os.ReadDir(scenariosDir); err == nil {
		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
				continue
			}
			filePath := filepath.Join(scenariosDir, entry.Name())
			if content, err := os.ReadFile(filePath); err == nil {
				scenarioName := strings.TrimSuffix(entry.Name(), ".md")
				contentBuilder.WriteString(fmt.Sprintf("## Scenario: %s\n\n", scenarioName))
				contentBuilder.Write(content)
				contentBuilder.WriteString("\n\n")
				filesLoaded = append(filesLoaded, filePath)
			}
		}
	}

	// Load templates subdirectory
	templatesDir := filepath.Join(skillPath, "templates")
	if entries, err := os.ReadDir(templatesDir); err == nil {
		contentBuilder.WriteString("## Templates\n\n")
		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
				continue
			}
			filePath := filepath.Join(templatesDir, entry.Name())
			if content, err := os.ReadFile(filePath); err == nil {
				templateName := strings.TrimSuffix(entry.Name(), ".md")
				contentBuilder.WriteString(fmt.Sprintf("### Template: %s\n\n", templateName))
				contentBuilder.Write(content)
				contentBuilder.WriteString("\n\n")
				filesLoaded = append(filesLoaded, filePath)
			}
		}
	}

	return contentBuilder.String(), filesLoaded, nil
}

// getSkillsForScenario returns the skills relevant to a scenario
func getSkillsForScenario(scenario string) []string {
	scenarioSkills := map[string][]string{
		"ANALYSIS": {"coding-workflow", "writing-notes"},
		"RESEARCH": {"writing-notes"},
		"DECISION": {"writing-notes"},
		"FEATURE":  {"coding-workflow", "writing-notes"},
		"SPEC":     {"coding-workflow", "writing-notes"},
		"TESTING":  {"coding-workflow", "writing-notes"},
		"BUG":      {"coding-workflow", "writing-notes"},
	}

	if skills, ok := scenarioSkills[strings.ToUpper(scenario)]; ok {
		return skills
	}

	// Default to all skills
	return []string{"coding-workflow", "writing-notes"}
}
