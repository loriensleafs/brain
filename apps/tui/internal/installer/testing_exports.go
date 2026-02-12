package installer

// testing_exports.go exposes unexported identifiers for tests in the tests/ subdirectory.
// This file is NOT a _test.go file because _test.go files are only compiled when
// the declaring package is the test target, not when imported by other test packages.
// Since this is an internal package, these exports do not affect the public API.

// Scope exposes (*ToolInstaller).scope for external tests.
func (t *ToolInstaller) Scope() string {
	return t.scope()
}

// ResolveScopePath delegates to the package-level ResolveScopePath for external tests.
func (t *ToolInstaller) ResolveScopePath(scope string) (string, error) {
	return ResolveScopePath(t.config, scope)
}

// InstalledPaths exposes (*ToolInstaller).installedPaths for external tests.
func (t *ToolInstaller) InstalledPaths(scope string, output *BuildOutput) []string {
	return t.installedPaths(scope, output)
}

// PlacementFor exposes placementFor for external tests.
func PlacementFor(tool *ToolConfig) PlacementStrategy {
	return placementFor(tool)
}
