// Package internal provides shared validation utilities for the Brain project.
package internal

import (
	"os"

	"github.com/peterkloss/brain/packages/utils"
)

// ResolveProjectFromEnv resolves the project using environment variables only.
// Resolution priority:
// 1. Explicit parameter
// 2. BRAIN_PROJECT env var
// 3. BM_PROJECT env var
// 4. BM_ACTIVE_PROJECT env var (legacy)
// 5. Empty string (caller shows error)
//
// For CWD matching, use utils.ResolveProject from @brain/utils.
func ResolveProjectFromEnv(explicit string) string {
	// 1. Explicit parameter always wins
	if explicit != "" {
		return explicit
	}

	// 2. BRAIN_PROJECT env var (preferred)
	if project := os.Getenv("BRAIN_PROJECT"); project != "" {
		return project
	}

	// 3. BM_PROJECT env var (matches TypeScript)
	if project := os.Getenv("BM_PROJECT"); project != "" {
		return project
	}

	// 4. BM_ACTIVE_PROJECT env var (legacy/internal)
	if project := os.Getenv("BM_ACTIVE_PROJECT"); project != "" {
		return project
	}

	// 5. No project resolved
	return ""
}

// ResolveProject resolves the project with CWD matching as fallback.
// Resolution priority:
// 1. Explicit parameter
// 2. BRAIN_PROJECT env var
// 3. BM_PROJECT env var
// 4. BM_ACTIVE_PROJECT env var (legacy)
// 5. CWD matching against Brain config code_paths
// 6. Empty string (caller shows error)
func ResolveProject(explicit string, cwd string) string {
	// First try env vars
	project := ResolveProjectFromEnv(explicit)
	if project != "" {
		return project
	}

	// Fall back to CWD matching via utils package
	return utils.ResolveProjectFromCwd(cwd)
}
