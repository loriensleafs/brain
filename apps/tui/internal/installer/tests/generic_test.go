package installer_test

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/peterkloss/brain-tui/internal/installer"
)

// testToolConfig returns a minimal valid ToolConfig for testing.
func testToolConfig(name, configDir string) *installer.ToolConfig {
	return &installer.ToolConfig{
		Name:         name,
		DisplayName:  "Test " + name,
		Prefix:       false,
		ConfigDir:    configDir,
		Scopes:       map[string]string{"global": configDir},
		DefaultScope: "global",
		Agents:       installer.AgentConfig{Frontmatter: []string{"name"}},
		Rules:        installer.RuleConfig{Extension: ".md"},
		Hooks:        installer.ConfigFileConfig{Strategy: "none", Target: ""},
		MCP:          installer.ConfigFileConfig{Strategy: "none", Target: ""},
		Manifest:     installer.ManifestConfig{Type: "file_list"},
		Detection: installer.DetectionConfig{
			BrainInstalled: installer.DetectionCheck{
				Type: "json_key",
				File: "brain.json",
				Key:  "brain",
			},
		},
		Placement: "copy_and_merge",
	}
}

func TestToolInstallerName(t *testing.T) {
	tc := testToolConfig("test-tool", "/tmp/test")
	g := installer.NewToolInstaller(tc)

	if g.Name() != "test-tool" {
		t.Errorf("Name() = %q, want %q", g.Name(), "test-tool")
	}
}

func TestToolInstallerDisplayName(t *testing.T) {
	tc := testToolConfig("test-tool", "/tmp/test")
	g := installer.NewToolInstaller(tc)

	if g.DisplayName() != "Test test-tool" {
		t.Errorf("DisplayName() = %q, want %q", g.DisplayName(), "Test test-tool")
	}
}

func TestToolInstallerAdapterTarget(t *testing.T) {
	tc := testToolConfig("test-tool", "/tmp/test")
	g := installer.NewToolInstaller(tc)

	if g.AdapterTarget() != "test-tool" {
		t.Errorf("AdapterTarget() = %q, want %q", g.AdapterTarget(), "test-tool")
	}
}

func TestToolInstallerConfigDir(t *testing.T) {
	tmpDir := t.TempDir()
	tc := testToolConfig("test-tool", tmpDir)
	g := installer.NewToolInstaller(tc)

	if g.ConfigDir() != tmpDir {
		t.Errorf("ConfigDir() = %q, want %q", g.ConfigDir(), tmpDir)
	}
}

func TestToolInstallerConfigDirExpandsHome(t *testing.T) {
	tc := testToolConfig("test-tool", "~/.test-tool")
	g := installer.NewToolInstaller(tc)

	home, err := os.UserHomeDir()
	if err != nil {
		t.Skipf("cannot determine home dir: %v", err)
	}
	want := filepath.Join(home, ".test-tool")
	if g.ConfigDir() != want {
		t.Errorf("ConfigDir() = %q, want %q", g.ConfigDir(), want)
	}
}

func TestToolInstallerIsToolInstalled(t *testing.T) {
	tmpDir := t.TempDir()

	tc := testToolConfig("test-tool", tmpDir)
	g := installer.NewToolInstaller(tc)
	if !g.IsToolInstalled() {
		t.Error("IsToolInstalled() should return true when config dir exists")
	}

	tc2 := testToolConfig("test-tool", filepath.Join(tmpDir, "nonexistent"))
	g2 := installer.NewToolInstaller(tc2)
	if g2.IsToolInstalled() {
		t.Error("IsToolInstalled() should return false when config dir does not exist")
	}
}

func TestToolInstallerIsBrainInstalledJSONKey(t *testing.T) {
	tmpDir := t.TempDir()
	tc := testToolConfig("test-tool", tmpDir)
	tc.Detection.BrainInstalled = installer.DetectionCheck{
		Type: "json_key",
		File: "brain.json",
		Key:  "brain",
	}
	g := installer.NewToolInstaller(tc)

	// No file -> not installed.
	if g.IsBrainInstalled() {
		t.Error("IsBrainInstalled() should return false when detection file does not exist")
	}

	// Empty JSON -> not installed.
	jsonPath := filepath.Join(tmpDir, "brain.json")
	os.WriteFile(jsonPath, []byte("{}"), 0600)
	if g.IsBrainInstalled() {
		t.Error("IsBrainInstalled() should return false when key not present")
	}

	// With key -> installed.
	os.WriteFile(jsonPath, []byte(`{"brain": {"installed": true}}`), 0600)
	if !g.IsBrainInstalled() {
		t.Error("IsBrainInstalled() should return true when key is present")
	}
}

func TestToolInstallerIsBrainInstalledPrefixScan(t *testing.T) {
	tmpDir := t.TempDir()
	tc := testToolConfig("test-tool", tmpDir)
	tc.Detection.BrainInstalled = installer.DetectionCheck{
		Type: "prefix_scan",
		Dirs: []string{"agents", "rules"},
	}
	g := installer.NewToolInstaller(tc)

	// No dirs -> not installed.
	if g.IsBrainInstalled() {
		t.Error("IsBrainInstalled() should return false when scan dirs do not exist")
	}

	// Empty dirs -> not installed.
	os.MkdirAll(filepath.Join(tmpDir, "agents"), 0755)
	os.MkdirAll(filepath.Join(tmpDir, "rules"), 0755)
	if g.IsBrainInstalled() {
		t.Error("IsBrainInstalled() should return false when no brain-prefixed files exist")
	}

	// Non-prefixed file -> not installed.
	os.WriteFile(filepath.Join(tmpDir, "agents", "regular.md"), []byte("test"), 0644)
	if g.IsBrainInstalled() {
		t.Error("IsBrainInstalled() should return false when files lack brain prefix")
	}

	// Brain-prefixed file -> installed.
	brainFile := installer.BrainEmoji + "-agent.md"
	os.WriteFile(filepath.Join(tmpDir, "agents", brainFile), []byte("test"), 0644)
	if !g.IsBrainInstalled() {
		t.Error("IsBrainInstalled() should return true when brain-prefixed file exists")
	}
}

func TestToolInstallerIsBrainInstalledUnknownType(t *testing.T) {
	tmpDir := t.TempDir()
	tc := testToolConfig("test-tool", tmpDir)
	tc.Detection.BrainInstalled = installer.DetectionCheck{Type: "unknown"}
	g := installer.NewToolInstaller(tc)

	if g.IsBrainInstalled() {
		t.Error("IsBrainInstalled() should return false for unknown detection type")
	}
}

func TestToolInstallerUninstallNoManifest(t *testing.T) {
	tmpDir := t.TempDir()
	tc := testToolConfig("test-uninstall-no-manifest", tmpDir)
	g := installer.NewToolInstaller(tc)

	// Uninstall without a manifest should not error.
	if err := g.Uninstall(context.Background()); err != nil {
		t.Fatalf("Uninstall() should not error without manifest: %v", err)
	}
}

func TestToolInstallerUninstallWithManifest(t *testing.T) {
	tmpDir := t.TempDir()
	tc := testToolConfig("test-uninstall-manifest", tmpDir)
	g := installer.NewToolInstaller(tc)

	// Create a file and write a manifest pointing to it.
	testFile := filepath.Join(tmpDir, "agents", "test.md")
	os.MkdirAll(filepath.Dir(testFile), 0755)
	os.WriteFile(testFile, []byte("content"), 0644)
	installer.WriteManifest(g.Name(), []string{testFile})

	// Uninstall should remove the file.
	if err := g.Uninstall(context.Background()); err != nil {
		t.Fatalf("Uninstall() failed: %v", err)
	}

	if _, err := os.Stat(testFile); !os.IsNotExist(err) {
		t.Error("expected installed file to be removed after uninstall")
	}

	// Manifest should be gone.
	if _, err := installer.ReadManifest(g.Name()); err == nil {
		t.Error("expected manifest to be removed after uninstall")
	}
}

func TestRegisterFromConfigSkipsExisting(t *testing.T) {
	installer.ResetRegistry()

	// Pre-register a tool so we can test that RegisterFromParsed skips it.
	preReg := installer.NewToolInstaller(testToolConfig("claude-code", "/tmp/cc-pre"))
	installer.Register(preReg)

	// Create a config that includes the pre-registered tool plus a new one.
	tmpDir := t.TempDir()
	cfg := &installer.ToolsConfig{
		Tools: map[string]*installer.ToolConfig{
			"claude-code": testToolConfig("claude-code", "/tmp/cc"),
			"new-tool":    testToolConfig("new-tool", tmpDir),
		},
	}

	// RegisterFromParsed should not panic (would if duplicate).
	installer.RegisterFromParsed(cfg)

	// The new tool should be registered.
	ti, ok := installer.Get("new-tool")
	if !ok {
		t.Fatal("expected new-tool to be registered")
	}
	if ti.Name() != "new-tool" {
		t.Errorf("Name() = %q, want %q", ti.Name(), "new-tool")
	}
	if ti.DisplayName() != "Test new-tool" {
		t.Errorf("DisplayName() = %q, want %q", ti.DisplayName(), "Test new-tool")
	}

	// Pre-registered tool should still be the original instance.
	cc, _ := installer.Get("claude-code")
	if cc.ConfigDir() != "/tmp/cc-pre" {
		t.Errorf("expected pre-registered ConfigDir /tmp/cc-pre, got %q", cc.ConfigDir())
	}
}

func TestRegisterFromConfigFile(t *testing.T) {
	tmpDir := t.TempDir()

	// Write a minimal tools.config.yaml with a unique tool name.
	configContent := `tools:
  test-yaml-tool:
    display_name: "YAML Tool"
    prefix: false
    config_dir: ` + tmpDir + `
    scopes:
      global: ` + tmpDir + `
    default_scope: global
    agents:
      frontmatter:
        - name
    rules:
      extension: .md
    hooks:
      strategy: none
      target: ""
    mcp:
      strategy: none
      target: ""
    manifest:
      type: file_list
    detection:
      brain_installed:
        type: json_key
        file: test.json
        key: brain
    placement: copy_and_merge
`
	configPath := filepath.Join(tmpDir, "tools.config.yaml")
	os.WriteFile(configPath, []byte(configContent), 0644)

	if err := installer.RegisterFromConfig(configPath); err != nil {
		t.Fatalf("RegisterFromConfig() failed: %v", err)
	}

	ti, ok := installer.Get("test-yaml-tool")
	if !ok {
		t.Fatal("expected test-yaml-tool to be registered from config file")
	}
	if ti.DisplayName() != "YAML Tool" {
		t.Errorf("DisplayName() = %q, want %q", ti.DisplayName(), "YAML Tool")
	}
}

func TestToolInstallerImplementsTool(t *testing.T) {
	tc := testToolConfig("test-impl", "/tmp/test")
	var _ installer.Tool = installer.NewToolInstaller(tc)
}

func TestToolInstallerInstalledPaths(t *testing.T) {
	tmpDir := t.TempDir()
	tc := testToolConfig("test-collect", tmpDir)
	g := installer.NewToolInstaller(tc)

	output := &installer.BuildOutput{
		Agents: []installer.GeneratedFile{
			{RelativePath: "agents/test.md", Content: "test"},
		},
		Rules: []installer.GeneratedFile{
			{RelativePath: "rules/test.md", Content: "test"},
		},
	}

	paths := g.InstalledPaths("global", output)
	if len(paths) != 2 {
		t.Fatalf("expected 2 paths, got %d", len(paths))
	}

	expected := []string{
		filepath.Join(tmpDir, "agents/test.md"),
		filepath.Join(tmpDir, "rules/test.md"),
	}
	for i, want := range expected {
		if paths[i] != want {
			t.Errorf("paths[%d] = %q, want %q", i, paths[i], want)
		}
	}
}

func TestToolInstallerInstalledPathsNilOutput(t *testing.T) {
	tmpDir := t.TempDir()
	tc := testToolConfig("test-nil", tmpDir)
	g := installer.NewToolInstaller(tc)

	paths := g.InstalledPaths("global", nil)
	if paths != nil {
		t.Errorf("expected nil paths for nil output, got %v", paths)
	}
}

func TestManifestRoundTrip(t *testing.T) {
	toolName := "test-manifest-roundtrip"
	installer.WriteManifest(toolName, []string{"/a", "/b"})
	defer installer.RemoveManifest(toolName)

	m, err := installer.ReadManifest(toolName)
	if err != nil {
		t.Fatalf("ReadManifest() failed: %v", err)
	}
	if m.Tool != toolName {
		t.Errorf("Tool = %q, want %q", m.Tool, toolName)
	}
	if len(m.Files) != 2 {
		t.Errorf("len(Files) = %d, want 2", len(m.Files))
	}
}

func TestReadManifestNotFound(t *testing.T) {
	_, err := installer.ReadManifest("nonexistent-tool-12345")
	if err == nil {
		t.Error("expected error for nonexistent manifest")
	}
}

// --- Scope Tests ---

func TestToolInstallerSetScopeValid(t *testing.T) {
	tc := testToolConfig("test-scope-valid", "/tmp/test")
	tc.Scopes = map[string]string{
		"global":  "~/.test/",
		"plugin":  "~/.test/plugins/brain/",
		"project": ".test/",
	}
	tc.DefaultScope = "plugin"
	g := installer.NewToolInstaller(tc)

	if err := g.SetScope("global"); err != nil {
		t.Fatalf("SetScope(global) should succeed: %v", err)
	}
	if g.Scope() != "global" {
		t.Errorf("Scope() = %q, want %q", g.Scope(), "global")
	}

	if err := g.SetScope("project"); err != nil {
		t.Fatalf("SetScope(project) should succeed: %v", err)
	}
	if g.Scope() != "project" {
		t.Errorf("Scope() = %q, want %q", g.Scope(), "project")
	}
}

func TestToolInstallerSetScopeInvalid(t *testing.T) {
	tc := testToolConfig("test-scope-invalid", "/tmp/test")
	tc.Scopes = map[string]string{
		"global":  "~/.test/",
		"project": ".test/",
	}
	tc.DefaultScope = "global"
	g := installer.NewToolInstaller(tc)

	err := g.SetScope("nonexistent")
	if err == nil {
		t.Fatal("SetScope(nonexistent) should return an error")
	}
	if !strings.Contains(err.Error(), "nonexistent") {
		t.Errorf("error should mention the invalid scope name, got: %v", err)
	}
	if !strings.Contains(err.Error(), "test-scope-invalid") {
		t.Errorf("error should mention the tool name, got: %v", err)
	}
	if !strings.Contains(err.Error(), "global") || !strings.Contains(err.Error(), "project") {
		t.Errorf("error should list available scopes, got: %v", err)
	}
}

func TestToolInstallerScopes(t *testing.T) {
	tc := testToolConfig("test-avail-scopes", "/tmp/test")
	tc.Scopes = map[string]string{
		"project": ".test/",
		"global":  "~/.test/",
		"plugin":  "~/.test/plugins/",
	}
	g := installer.NewToolInstaller(tc)

	scopes := g.Scopes()
	if len(scopes) != 3 {
		t.Fatalf("expected 3 scopes, got %d", len(scopes))
	}
	// Should be sorted alphabetically.
	expected := []string{"global", "plugin", "project"}
	for i, want := range expected {
		if scopes[i] != want {
			t.Errorf("scopes[%d] = %q, want %q", i, scopes[i], want)
		}
	}
}

func TestToolInstallerScopeDefault(t *testing.T) {
	tc := testToolConfig("test-eff-default", "/tmp/test")
	tc.Scopes = map[string]string{
		"global": "/tmp/test/",
		"plugin": "/tmp/test/plugins/",
	}
	tc.DefaultScope = "plugin"
	g := installer.NewToolInstaller(tc)

	if g.Scope() != "plugin" {
		t.Errorf("Scope() = %q, want %q", g.Scope(), "plugin")
	}
}

func TestToolInstallerScopeOverride(t *testing.T) {
	tc := testToolConfig("test-eff-override", "/tmp/test")
	tc.Scopes = map[string]string{
		"global": "/tmp/test/",
		"plugin": "/tmp/test/plugins/",
	}
	tc.DefaultScope = "plugin"
	g := installer.NewToolInstaller(tc)

	g.SetScope("global")
	if g.Scope() != "global" {
		t.Errorf("Scope() = %q, want %q", g.Scope(), "global")
	}
}

func TestToolInstallerResolveScopePathTilde(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skipf("cannot determine home dir: %v", err)
	}

	tc := testToolConfig("test-resolve-tilde", "/tmp/test")
	tc.Scopes = map[string]string{
		"global": "~/.test-tool/",
	}
	g := installer.NewToolInstaller(tc)

	resolved, err := g.ResolveScopePath("global")
	if err != nil {
		t.Fatalf("ResolveScopePath() failed: %v", err)
	}
	want := filepath.Join(home, ".test-tool")
	if resolved != want {
		t.Errorf("ResolveScopePath() = %q, want %q", resolved, want)
	}
}

func TestToolInstallerResolveScopePathRelative(t *testing.T) {
	tc := testToolConfig("test-resolve-rel", "/tmp/test")
	tc.Scopes = map[string]string{
		"project": ".test/",
	}
	g := installer.NewToolInstaller(tc)

	resolved, err := g.ResolveScopePath("project")
	if err != nil {
		t.Fatalf("ResolveScopePath() failed: %v", err)
	}

	cwd, _ := os.Getwd()
	want := filepath.Join(cwd, ".test")
	if resolved != want {
		t.Errorf("ResolveScopePath() = %q, want %q", resolved, want)
	}
}

func TestToolInstallerResolveScopePathAbsolute(t *testing.T) {
	tmpDir := t.TempDir()
	tc := testToolConfig("test-resolve-abs", tmpDir)
	tc.Scopes = map[string]string{
		"global": tmpDir,
	}
	g := installer.NewToolInstaller(tc)

	resolved, err := g.ResolveScopePath("global")
	if err != nil {
		t.Fatalf("ResolveScopePath() failed: %v", err)
	}
	if resolved != tmpDir {
		t.Errorf("ResolveScopePath() = %q, want %q", resolved, tmpDir)
	}
}

func TestToolInstallerResolveScopePathNotFound(t *testing.T) {
	tc := testToolConfig("test-resolve-404", "/tmp/test")
	g := installer.NewToolInstaller(tc)

	_, err := g.ResolveScopePath("nonexistent")
	if err == nil {
		t.Fatal("ResolveScopePath(nonexistent) should return an error")
	}
}

// --- Claude Code Scope Tests ---

// claudeCodeToolConfig returns a ToolConfig matching the claude-code entry in
// tools.config.yaml, using temp directories for isolation.
func claudeCodeToolConfig(globalDir, pluginDir, projectDir string) *installer.ToolConfig {
	return &installer.ToolConfig{
		Name:        "claude-code-scope-test",
		DisplayName: "Claude Code",
		Prefix:      false,
		ConfigDir:   globalDir,
		Scopes: map[string]string{
			"global":  globalDir,
			"plugin":  pluginDir,
			"project": projectDir,
		},
		DefaultScope: "plugin",
		Agents:       installer.AgentConfig{Frontmatter: []string{"name", "model", "description"}},
		Rules:        installer.RuleConfig{Extension: ".md"},
		Hooks:        installer.ConfigFileConfig{Strategy: "direct", Target: "hooks/hooks.json"},
		MCP:          installer.ConfigFileConfig{Strategy: "direct", Target: ".mcp.json"},
		Manifest:     installer.ManifestConfig{Type: "marketplace"},
		Detection: installer.DetectionConfig{
			BrainInstalled: installer.DetectionCheck{
				Type: "json_key",
				File: "plugins/known_marketplaces.json",
				Key:  "brain",
			},
		},
		Placement: "marketplace",
	}
}

func TestClaudeCodeScopeGlobal(t *testing.T) {
	tmpDir := t.TempDir()
	globalDir := filepath.Join(tmpDir, "global")
	pluginDir := filepath.Join(tmpDir, "plugin")
	projectDir := filepath.Join(tmpDir, "project")
	os.MkdirAll(globalDir, 0755)

	tc := claudeCodeToolConfig(globalDir, pluginDir, projectDir)
	g := installer.NewToolInstaller(tc)

	if err := g.SetScope("global"); err != nil {
		t.Fatalf("SetScope(global) failed: %v", err)
	}
	if g.Scope() != "global" {
		t.Errorf("Scope() = %q, want %q", g.Scope(), "global")
	}

	resolved, err := g.ResolveScopePath("global")
	if err != nil {
		t.Fatalf("ResolveScopePath(global) failed: %v", err)
	}
	if resolved != globalDir {
		t.Errorf("ResolveScopePath(global) = %q, want %q", resolved, globalDir)
	}
}

func TestClaudeCodeScopePlugin(t *testing.T) {
	tmpDir := t.TempDir()
	globalDir := filepath.Join(tmpDir, "global")
	pluginDir := filepath.Join(tmpDir, "plugin")
	projectDir := filepath.Join(tmpDir, "project")

	tc := claudeCodeToolConfig(globalDir, pluginDir, projectDir)
	g := installer.NewToolInstaller(tc)

	// Plugin is the default scope.
	if g.Scope() != "plugin" {
		t.Errorf("Scope() should default to plugin, got %q", g.Scope())
	}

	resolved, err := g.ResolveScopePath("plugin")
	if err != nil {
		t.Fatalf("ResolveScopePath(plugin) failed: %v", err)
	}
	if resolved != pluginDir {
		t.Errorf("ResolveScopePath(plugin) = %q, want %q", resolved, pluginDir)
	}
}

func TestClaudeCodeScopeProject(t *testing.T) {
	tmpDir := t.TempDir()
	globalDir := filepath.Join(tmpDir, "global")
	pluginDir := filepath.Join(tmpDir, "plugin")
	projectDir := filepath.Join(tmpDir, "project")

	tc := claudeCodeToolConfig(globalDir, pluginDir, projectDir)
	g := installer.NewToolInstaller(tc)

	if err := g.SetScope("project"); err != nil {
		t.Fatalf("SetScope(project) failed: %v", err)
	}
	if g.Scope() != "project" {
		t.Errorf("Scope() = %q, want %q", g.Scope(), "project")
	}

	resolved, err := g.ResolveScopePath("project")
	if err != nil {
		t.Fatalf("ResolveScopePath(project) failed: %v", err)
	}
	if resolved != projectDir {
		t.Errorf("ResolveScopePath(project) = %q, want %q", resolved, projectDir)
	}
}

func TestClaudeCodeThreeScopes(t *testing.T) {
	tmpDir := t.TempDir()
	globalDir := filepath.Join(tmpDir, "global")
	pluginDir := filepath.Join(tmpDir, "plugin")
	projectDir := filepath.Join(tmpDir, "project")

	tc := claudeCodeToolConfig(globalDir, pluginDir, projectDir)
	g := installer.NewToolInstaller(tc)

	scopes := g.Scopes()
	if len(scopes) != 3 {
		t.Fatalf("Claude Code should have 3 scopes, got %d: %v", len(scopes), scopes)
	}
}

// --- Cursor Scope Tests ---

// cursorToolConfig returns a ToolConfig matching the cursor entry in
// tools.config.yaml, using temp directories for isolation.
func cursorToolConfig(globalDir, projectDir string) *installer.ToolConfig {
	return &installer.ToolConfig{
		Name:        "cursor-scope-test",
		DisplayName: "Cursor",
		Prefix:      true,
		ConfigDir:   globalDir,
		Scopes: map[string]string{
			"global":  globalDir,
			"project": projectDir,
		},
		DefaultScope: "global",
		Agents:       installer.AgentConfig{Frontmatter: []string{"description"}},
		Rules:        installer.RuleConfig{Extension: ".mdc", ExtraFrontmatter: map[string]any{"alwaysApply": true}},
		Hooks:        installer.ConfigFileConfig{Strategy: "merge", Target: "hooks.json"},
		MCP:          installer.ConfigFileConfig{Strategy: "merge", Target: "mcp.json"},
		Manifest:     installer.ManifestConfig{Type: "file_list"},
		Detection: installer.DetectionConfig{
			BrainInstalled: installer.DetectionCheck{
				Type: "prefix_scan",
				Dirs: []string{"agents", "rules"},
			},
		},
		Placement: "copy_and_merge",
	}
}

func TestCursorScopeGlobal(t *testing.T) {
	tmpDir := t.TempDir()
	globalDir := filepath.Join(tmpDir, "global")
	projectDir := filepath.Join(tmpDir, "project")

	tc := cursorToolConfig(globalDir, projectDir)
	g := installer.NewToolInstaller(tc)

	// Global is the default scope for Cursor.
	if g.Scope() != "global" {
		t.Errorf("Scope() should default to global, got %q", g.Scope())
	}

	resolved, err := g.ResolveScopePath("global")
	if err != nil {
		t.Fatalf("ResolveScopePath(global) failed: %v", err)
	}
	if resolved != globalDir {
		t.Errorf("ResolveScopePath(global) = %q, want %q", resolved, globalDir)
	}
}

func TestCursorScopeProject(t *testing.T) {
	tmpDir := t.TempDir()
	globalDir := filepath.Join(tmpDir, "global")
	projectDir := filepath.Join(tmpDir, "project")

	tc := cursorToolConfig(globalDir, projectDir)
	g := installer.NewToolInstaller(tc)

	if err := g.SetScope("project"); err != nil {
		t.Fatalf("SetScope(project) failed: %v", err)
	}
	if g.Scope() != "project" {
		t.Errorf("Scope() = %q, want %q", g.Scope(), "project")
	}

	resolved, err := g.ResolveScopePath("project")
	if err != nil {
		t.Fatalf("ResolveScopePath(project) failed: %v", err)
	}
	if resolved != projectDir {
		t.Errorf("ResolveScopePath(project) = %q, want %q", resolved, projectDir)
	}
}

func TestCursorTwoScopes(t *testing.T) {
	tmpDir := t.TempDir()
	globalDir := filepath.Join(tmpDir, "global")
	projectDir := filepath.Join(tmpDir, "project")

	tc := cursorToolConfig(globalDir, projectDir)
	g := installer.NewToolInstaller(tc)

	scopes := g.Scopes()
	if len(scopes) != 2 {
		t.Fatalf("Cursor should have 2 scopes, got %d: %v", len(scopes), scopes)
	}
}

func TestCursorScopePluginNotAvailable(t *testing.T) {
	tmpDir := t.TempDir()
	globalDir := filepath.Join(tmpDir, "global")
	projectDir := filepath.Join(tmpDir, "project")

	tc := cursorToolConfig(globalDir, projectDir)
	g := installer.NewToolInstaller(tc)

	err := g.SetScope("plugin")
	if err == nil {
		t.Fatal("Cursor should not have a plugin scope")
	}
}
