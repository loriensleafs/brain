package main

import (
	"os"

	"github.com/peterkloss/brain/packages/utils"
)

// resolveProjectFromEnv resolves the project using environment variables only.
// Resolution priority:
// 1. Explicit parameter
// 2. BRAIN_PROJECT env var
// 3. BM_PROJECT env var
// 4. BM_ACTIVE_PROJECT env var (legacy)
// 5. Empty string (caller shows error)
//
// NOTE: This function does NOT do CWD matching. That is intentional.
// For CWD matching, use utils.ResolveProject from @brain/utils.
func resolveProjectFromEnv(explicit string) string {
	// 1. Explicit parameter always wins
	if explicit != "" {
		return explicit
	}

	// 2. BRAIN_PROJECT env var (preferred)
	if project := GetEnv("BRAIN_PROJECT"); project != "" {
		return project
	}

	// 3. BM_PROJECT env var (matches TypeScript)
	if project := GetEnv("BM_PROJECT"); project != "" {
		return project
	}

	// 4. BM_ACTIVE_PROJECT env var (legacy/internal)
	if project := GetEnv("BM_ACTIVE_PROJECT"); project != "" {
		return project
	}

	// 5. No project resolved
	return ""
}

// resolveProjectWithCwd resolves the project with CWD matching as fallback.
// Uses utils.ResolveProjectFromCwd for CWD matching against Brain config.
func resolveProjectWithCwd(explicit string, cwd string) string {
	// First try env vars
	project := resolveProjectFromEnv(explicit)
	if project != "" {
		return project
	}

	// Fall back to CWD matching via utils package
	return utils.ResolveProjectFromCwd(cwd)
}

// GetEnv is a testable wrapper around os.Getenv.
// It can be mocked in tests by replacing the function variable.
var GetEnv = os.Getenv
