package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// BrainConfig represents the brain configuration file structure.
type BrainConfig struct {
	CodePaths map[string]string `json:"code_paths"`
}

// brainConfigPath returns the path to the brain config file.
// This is a variable so it can be mocked in tests.
var brainConfigPath = func() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(homeDir, ".basic-memory", "brain-config.json")
}

// loadBrainConfig loads the brain configuration from disk.
// Returns empty config (not error) if file doesn't exist.
func loadBrainConfig() (*BrainConfig, error) {
	configPath := brainConfigPath()
	if configPath == "" {
		return &BrainConfig{CodePaths: make(map[string]string)}, nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &BrainConfig{CodePaths: make(map[string]string)}, nil
		}
		return nil, err
	}

	var config BrainConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	// Initialize map if nil
	if config.CodePaths == nil {
		config.CodePaths = make(map[string]string)
	}

	return &config, nil
}

// matchCwdToProject matches the current working directory against configured code paths.
// Returns the project name if CWD is within a configured code path, empty string otherwise.
// When multiple projects match (nested paths), returns the deepest (most specific) match.
//
// This function is ONLY used by session_start for auto-detection.
// CLI commands should NOT use CWD matching.
func matchCwdToProject(cwd string, codePaths map[string]string) string {
	if cwd == "" || len(codePaths) == 0 {
		return ""
	}

	// Normalize CWD path
	cwd = filepath.Clean(cwd)

	var bestMatch string
	var bestMatchLen int

	for projectName, projectPath := range codePaths {
		projectPath = filepath.Clean(projectPath)

		// Check if CWD is exactly the project path or a subdirectory
		if cwd == projectPath || strings.HasPrefix(cwd, projectPath+string(filepath.Separator)) {
			// Track the deepest match (longest path)
			if len(projectPath) > bestMatchLen {
				bestMatch = projectName
				bestMatchLen = len(projectPath)
			}
		}
	}

	return bestMatch
}

// resolveProject resolves the project using the hierarchy for CLI commands.
// Resolution priority:
// 1. Explicit parameter
// 2. BM_PROJECT env var
// 3. BM_ACTIVE_PROJECT env var (legacy)
// 4. BRAIN_PROJECT env var (Go-specific, for backwards compatibility)
// 5. Empty string (caller shows error)
//
// NOTE: This function does NOT do CWD matching. That is intentional.
// CWD matching is ONLY used by session_start hook, not CLI commands.
func resolveProject(explicit string, _ string) string {
	// 1. Explicit parameter always wins
	if explicit != "" {
		return explicit
	}

	// 2. BM_PROJECT env var (preferred, matches TypeScript)
	if project := GetEnv("BM_PROJECT"); project != "" {
		return project
	}

	// 3. BM_ACTIVE_PROJECT env var (legacy/internal)
	if project := GetEnv("BM_ACTIVE_PROJECT"); project != "" {
		return project
	}

	// 4. BRAIN_PROJECT env var (Go-specific, backwards compatibility)
	if project := GetEnv("BRAIN_PROJECT"); project != "" {
		return project
	}

	// 5. No project resolved
	return ""
}

// GetEnv is a testable wrapper around os.Getenv.
// It can be mocked in tests by replacing the function variable.
var GetEnv = os.Getenv
