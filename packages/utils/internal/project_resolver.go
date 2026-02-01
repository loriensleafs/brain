// Package internal provides shared utilities for Brain project resolution.
//
// Project resolution matches CWD against configured code_paths in Brain config.
// Configuration location: ~/.config/brain/config.json
//
// See ADR-020 for configuration architecture details.
package internal

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// BrainProjectConfig represents project-specific configuration.
type BrainProjectConfig struct {
	CodePath     string  `json:"code_path"`
	MemoriesPath *string `json:"memories_path,omitempty"`
	MemoriesMode *string `json:"memories_mode,omitempty"`
}

// BrainConfig represents the Brain configuration structure.
type BrainConfig struct {
	Version  string                        `json:"version"`
	Projects map[string]BrainProjectConfig `json:"projects"`
}

// ResolveOptions contains options for project resolution.
type ResolveOptions struct {
	// Explicit project name (highest priority)
	Explicit string
	// CWD for directory-based resolution
	CWD string
}

// GetBrainConfigPath returns the XDG-compliant Brain config path.
// Returns ~/.config/brain/config.json (or XDG_CONFIG_HOME if set).
var GetBrainConfigPath = func() string {
	xdgConfigHome := os.Getenv("XDG_CONFIG_HOME")
	if xdgConfigHome == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		xdgConfigHome = filepath.Join(homeDir, ".config")
	}
	return filepath.Join(xdgConfigHome, "brain", "config.json")
}

// LoadBrainConfig loads Brain configuration from disk.
// Returns empty config (not error) if file does not exist.
func LoadBrainConfig() (*BrainConfig, error) {
	configPath := GetBrainConfigPath()
	if configPath == "" {
		return &BrainConfig{Projects: make(map[string]BrainProjectConfig)}, nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &BrainConfig{Projects: make(map[string]BrainProjectConfig)}, nil
		}
		return nil, err
	}

	var config BrainConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	// Initialize map if nil
	if config.Projects == nil {
		config.Projects = make(map[string]BrainProjectConfig)
	}

	return &config, nil
}

// getBrainCliActiveProject calls "brain config get active-project" to get CLI active project.
// Returns empty string if brain CLI is not available or no active project is set.
func getBrainCliActiveProject() string {
	cmd := exec.Command("brain", "config", "get", "active-project")
	output, err := cmd.Output()
	if err != nil {
		return ""
	}
	result := strings.TrimSpace(string(output))
	// brain CLI returns "null" or empty when no active project
	if result == "" || result == "null" {
		return ""
	}
	return result
}

// ResolveProject resolves project name using the 6-level hierarchy:
//
// 1. Explicit parameter
// 2. Brain CLI active project (via "brain config get active-project")
// 3. BRAIN_PROJECT env var
// 4. BM_PROJECT env var
// 5. CWD matching against Brain config code_paths
// 6. Empty string (caller shows error)
//
// Parameters:
//   - opts: Resolution options (explicit project, CWD). Nil uses defaults.
//
// Returns:
//   - Project name if found, empty string otherwise.
func ResolveProject(opts *ResolveOptions) string {
	if opts == nil {
		opts = &ResolveOptions{}
	}

	// 1. Explicit parameter always wins
	if opts.Explicit != "" {
		return opts.Explicit
	}

	// 2. Brain CLI active project
	if project := getBrainCliActiveProject(); project != "" {
		return project
	}

	// 3. BRAIN_PROJECT env var
	if project := os.Getenv("BRAIN_PROJECT"); project != "" {
		return project
	}

	// 4. BM_PROJECT env var
	if project := os.Getenv("BM_PROJECT"); project != "" {
		return project
	}

	// 5. CWD matching against Brain config code_paths
	cwd := opts.CWD
	if cwd == "" {
		var err error
		cwd, err = os.Getwd()
		if err != nil {
			return ""
		}
	}

	if project := matchCwdToProject(cwd); project != "" {
		return project
	}

	// 6. No project resolved
	return ""
}

// ResolveProjectFromCwd resolves project by matching CWD only (no env vars or CLI).
// This is the low-level function for just directory matching.
//
// Parameters:
//   - cwd: Working directory to match. If empty, uses os.Getwd().
//
// Returns:
//   - Project name if found, empty string otherwise.
func ResolveProjectFromCwd(cwd string) string {
	config, err := LoadBrainConfig()
	if err != nil || config == nil {
		return ""
	}

	// Resolve CWD if not provided
	if cwd == "" {
		var err error
		cwd, err = os.Getwd()
		if err != nil {
			return ""
		}
	}

	return matchCwdToProjectWithConfig(cwd, config.Projects)
}

// matchCwdToProject matches CWD against configured code paths.
// Loads config internally.
func matchCwdToProject(cwd string) string {
	config, err := LoadBrainConfig()
	if err != nil || config == nil {
		return ""
	}
	return matchCwdToProjectWithConfig(cwd, config.Projects)
}

// matchCwdToProjectWithConfig matches the current working directory against configured code paths.
// Returns the project name if CWD is within a configured code path, empty string otherwise.
// When multiple projects match (nested paths), returns the deepest (most specific) match.
func matchCwdToProjectWithConfig(cwd string, projects map[string]BrainProjectConfig) string {
	if cwd == "" || len(projects) == 0 {
		return ""
	}

	// Normalize CWD path
	cwd = filepath.Clean(cwd)

	var bestMatch string
	var bestMatchLen int

	for projectName, project := range projects {
		if project.CodePath == "" {
			continue
		}

		projectPath := filepath.Clean(project.CodePath)

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

// GetProjectCodePaths returns all configured projects and their code paths.
// Returns empty map if no config or no projects configured.
func GetProjectCodePaths() map[string]string {
	result := make(map[string]string)

	config, err := LoadBrainConfig()
	if err != nil || config == nil {
		return result
	}

	for name, project := range config.Projects {
		if project.CodePath != "" {
			result[name] = project.CodePath
		}
	}

	return result
}
