// Package internal provides shared validation utilities for the Brain project.
package internal

import (
	"os"
)

// ResolveProject resolves the project using the hierarchy.
// Resolution priority:
// 1. Explicit parameter
// 2. BM_PROJECT env var
// 3. BM_ACTIVE_PROJECT env var (legacy)
// 4. BRAIN_PROJECT env var (Go-specific, for backwards compatibility)
// 5. Empty string (caller shows error)
//
// CWD matching was removed to make resolution more explicit and less confusing.
func ResolveProject(explicit string, _ string) string {
	// 1. Explicit parameter always wins
	if explicit != "" {
		return explicit
	}

	// 2. BM_PROJECT env var (preferred, matches TypeScript)
	if project := os.Getenv("BM_PROJECT"); project != "" {
		return project
	}

	// 3. BM_ACTIVE_PROJECT env var (legacy/internal)
	if project := os.Getenv("BM_ACTIVE_PROJECT"); project != "" {
		return project
	}

	// 4. BRAIN_PROJECT env var (Go-specific, backwards compatibility)
	if project := os.Getenv("BRAIN_PROJECT"); project != "" {
		return project
	}

	// 5. No project resolved
	return ""
}
