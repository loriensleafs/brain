// Package utils provides shared utilities for the Brain project.
// This file provides the public API, re-exporting internal implementations.
package utils

import (
	"github.com/peterkloss/brain/packages/utils/internal"
)

// Re-export core types
type (
	BrainConfig        = internal.BrainConfig
	BrainProjectConfig = internal.BrainProjectConfig
	ResolveOptions     = internal.ResolveOptions
)

// Re-export functions
var (
	// ResolveProject resolves project name using the 6-level hierarchy:
	// 1. Explicit parameter
	// 2. Brain CLI active project (via "brain config get active-project")
	// 3. BRAIN_PROJECT env var
	// 4. BM_PROJECT env var
	// 5. CWD matching against Brain config code_paths
	// 6. Empty string (caller shows error)
	ResolveProject = internal.ResolveProject

	// ResolveProjectFromCwd resolves project by matching CWD only (no env vars or CLI).
	ResolveProjectFromCwd = internal.ResolveProjectFromCwd

	// LoadBrainConfig loads Brain configuration from disk.
	LoadBrainConfig = internal.LoadBrainConfig

	// GetProjectCodePaths returns all configured projects and their code paths.
	GetProjectCodePaths = internal.GetProjectCodePaths
)

// GetBrainConfigPath returns the XDG-compliant Brain config path.
// This is a function variable that can be replaced for testing.
var GetBrainConfigPath = internal.GetBrainConfigPath

// SetBrainConfigPath allows tests to override the config path lookup.
// Use this in tests to inject a test config file.
func SetBrainConfigPath(fn func() string) {
	internal.GetBrainConfigPath = fn
}

// ResetBrainConfigPath resets the config path function to its default.
// Call this in test cleanup to restore original behavior.
func ResetBrainConfigPath() {
	internal.GetBrainConfigPath = GetBrainConfigPath
}
