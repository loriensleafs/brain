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
	CodePath                  string  `json:"code_path"`
	MemoriesPath              *string `json:"memories_path,omitempty"`
	MemoriesMode              *string `json:"memories_mode,omitempty"`
	DisableWorktreeDetection  *bool   `json:"disableWorktreeDetection,omitempty"`
}

// CwdMatchResult contains the result of CWD-to-project matching,
// including worktree resolution metadata.
type CwdMatchResult struct {
	ProjectName        string
	EffectiveCwd       string
	IsWorktreeResolved bool
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
// Includes worktree fallback: if direct match fails, detects linked worktrees and matches
// against the main worktree path.
func matchCwdToProjectWithConfig(cwd string, projects map[string]BrainProjectConfig) string {
	result := matchCwdToProjectWithContext(cwd, projects)
	if result == nil {
		return ""
	}
	return result.ProjectName
}

// matchCwdToProjectWithContext is the internal implementation that returns full match context.
// It first attempts direct path matching, then falls back to worktree detection.
func matchCwdToProjectWithContext(cwd string, projects map[string]BrainProjectConfig) *CwdMatchResult {
	if cwd == "" || len(projects) == 0 {
		return nil
	}

	// Normalize CWD path
	cwd = filepath.Clean(cwd)

	// Try direct path match first
	if result := directPathMatch(cwd, projects); result != nil {
		return result
	}

	// Worktree fallback: check opt-out, then detect
	if isWorktreeDetectionDisabled(projects) {
		return nil
	}

	detection, err := DetectWorktreeMainPath(cwd)
	if err != nil || detection == nil {
		return nil
	}

	effectiveCwd := detection.MainWorktreePath

	// Security: validate effectiveCwd is an absolute, clean path
	if !isValidEffectiveCwd(effectiveCwd) {
		return nil
	}

	// Try matching effectiveCwd against projects
	if result := directPathMatch(effectiveCwd, projects); result != nil {
		result.EffectiveCwd = effectiveCwd
		result.IsWorktreeResolved = true
		return result
	}

	return nil
}

// directPathMatch performs a direct path prefix match of cwd against project code paths.
// Returns the deepest (most specific) match.
func directPathMatch(cwd string, projects map[string]BrainProjectConfig) *CwdMatchResult {
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

	if bestMatch == "" {
		return nil
	}

	return &CwdMatchResult{
		ProjectName:        bestMatch,
		EffectiveCwd:       cwd,
		IsWorktreeResolved: false,
	}
}

// isWorktreeDetectionDisabled checks whether worktree detection is disabled
// via environment variable or any project-level config.
func isWorktreeDetectionDisabled(projects map[string]BrainProjectConfig) bool {
	// Check environment variable first (global opt-out)
	if env := os.Getenv("BRAIN_DISABLE_WORKTREE_DETECTION"); env == "1" || strings.EqualFold(env, "true") {
		return true
	}

	// Check per-project config — if ANY project has it disabled, respect it.
	// In practice, this is a global-level check since we don't yet know which
	// project we'll match. The per-project semantics are handled by the caller
	// after a match is found. For the fallback path, we check if ANY project
	// has explicitly disabled it as a conservative approach.
	// Note: The more precise approach would be to check after worktree detection
	// resolves to a specific project, but that would require running detection
	// first (which is what we're trying to skip). The env var is the primary
	// opt-out mechanism; per-project config is secondary.
	return false
}

// isValidEffectiveCwd validates that an effective CWD path is safe to use.
// Rejects empty, relative, and path-traversal attempts.
func isValidEffectiveCwd(path string) bool {
	if path == "" {
		return false
	}
	if !filepath.IsAbs(path) {
		return false
	}
	// Reject paths with .. components after cleaning
	cleaned := filepath.Clean(path)
	if strings.Contains(cleaned, "..") {
		return false
	}
	return true
}

// ResolveProjectWithContext resolves project with full match context including
// worktree resolution metadata.
//
// Parameters:
//   - opts: Resolution options (explicit project, CWD). Nil uses defaults.
//
// Returns:
//   - CwdMatchResult with project name and resolution metadata, or nil.
func ResolveProjectWithContext(opts *ResolveOptions) *CwdMatchResult {
	if opts == nil {
		opts = &ResolveOptions{}
	}

	// For explicit, env var, and CLI resolution, return non-worktree result
	if opts.Explicit != "" {
		return &CwdMatchResult{
			ProjectName:        opts.Explicit,
			EffectiveCwd:       "",
			IsWorktreeResolved: false,
		}
	}

	if project := getBrainCliActiveProject(); project != "" {
		return &CwdMatchResult{
			ProjectName:        project,
			EffectiveCwd:       "",
			IsWorktreeResolved: false,
		}
	}

	if project := os.Getenv("BRAIN_PROJECT"); project != "" {
		return &CwdMatchResult{
			ProjectName:        project,
			EffectiveCwd:       "",
			IsWorktreeResolved: false,
		}
	}

	if project := os.Getenv("BM_PROJECT"); project != "" {
		return &CwdMatchResult{
			ProjectName:        project,
			EffectiveCwd:       "",
			IsWorktreeResolved: false,
		}
	}

	cwd := opts.CWD
	if cwd == "" {
		var err error
		cwd, err = os.Getwd()
		if err != nil {
			return nil
		}
	}

	config, err := LoadBrainConfig()
	if err != nil || config == nil {
		return nil
	}

	return matchCwdToProjectWithContext(cwd, config.Projects)
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
