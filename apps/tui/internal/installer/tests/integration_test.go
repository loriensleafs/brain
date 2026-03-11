package installer_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/tidwall/gjson"

	"github.com/peterkloss/brain-tui/internal/installer"
)

// --- Helpers ---

// ccIntegConfig builds a ToolConfig matching the real claude-code entry but
// with temp-dir paths. Name is "claude-code" so brain.config.json platform
// lookup works. Tests must call cleanupManifest at the end.
func ccIntegConfig(configDir, pluginDir string) *installer.ToolConfig {
	return &installer.ToolConfig{
		Name:        "claude-code",
		DisplayName: "Claude Code",
		Prefix:      false,
		ConfigDir:   configDir,
		Scopes: map[string]string{
			"global": configDir,
			"plugin": pluginDir,
		},
		DefaultScope: "plugin",
		Agents: installer.AgentConfig{
			Frontmatter: []string{"name", "model", "description", "tools"},
		},
		Rules: installer.RuleConfig{
			Extension:        ".md",
			ExtraFrontmatter: map[string]any{},
			Routing:          map[string]string{},
		},
		Hooks: installer.ConfigFileConfig{Strategy: "direct", Target: "hooks/hooks.json"},
		MCP:   installer.ConfigFileConfig{Strategy: "direct", Target: ".mcp.json"},
		Manifest:  installer.ManifestConfig{Type: "marketplace"},
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

// curIntegConfig builds a ToolConfig matching the real cursor entry but with
// temp-dir paths. Name is "cursor" so brain.config.json platform lookup works.
func curIntegConfig(configDir string) *installer.ToolConfig {
	return &installer.ToolConfig{
		Name:        "cursor",
		DisplayName: "Cursor",
		Prefix:      true,
		ConfigDir:   configDir,
		Scopes: map[string]string{
			"global": configDir,
		},
		DefaultScope: "global",
		Agents: installer.AgentConfig{
			Frontmatter: []string{"description"},
		},
		Rules: installer.RuleConfig{
			Extension:        ".mdc",
			ExtraFrontmatter: map[string]any{"alwaysApply": true},
			Routing:          map[string]string{},
		},
		Hooks: installer.ConfigFileConfig{Strategy: "merge", Target: "hooks.json"},
		MCP:   installer.ConfigFileConfig{Strategy: "merge", Target: "mcp.json"},
		Manifest:  installer.ManifestConfig{Type: "file_list"},
		Detection: installer.DetectionConfig{
			BrainInstalled: installer.DetectionCheck{
				Type: "prefix_scan",
				Dirs: []string{"agents", "rules"},
			},
		},
		Placement: "copy_and_merge",
	}
}

func cleanupManifest(t *testing.T, name string) {
	t.Helper()
	installer.RemoveManifest(name)
}

// --- Claude Code Full Install (marketplace placement) ---

func TestIntegrationGeneric_ClaudeCodeFullInstall(t *testing.T) {
	srcDir := fixtureSourceDir(t)
	src := installer.NewFilesystemSource(srcDir)

	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, ".claude")
	pluginDir := filepath.Join(tmpDir, ".claude", "plugins", "marketplaces", "brain")

	tc := ccIntegConfig(configDir, pluginDir)
	g := installer.NewToolInstaller(tc)
	defer cleanupManifest(t, g.Name())

	if err := g.Install(context.Background(), src); err != nil {
		t.Fatalf("Install() failed: %v", err)
	}

	// 1. Plugin directory should exist.
	if _, err := os.Stat(pluginDir); err != nil {
		t.Fatal("expected plugin directory to exist after install")
	}

	// 2. Verify agent file was placed (no prefix for Claude Code).
	agentPath := filepath.Join(pluginDir, "agents", "test-agent.md")
	agentData, err := os.ReadFile(agentPath)
	if err != nil {
		t.Fatalf("agent file not placed: %v", err)
	}
	if !strings.Contains(string(agentData), "test agent") {
		t.Error("agent file content missing expected body text")
	}

	// 3. Verify rules file was placed.
	rulesPath := filepath.Join(pluginDir, "rules", "TEST-PROTOCOL.md")
	if _, err := os.Stat(rulesPath); err != nil {
		t.Fatalf("rules file not placed: %v", err)
	}

	// 4. Verify skills directory was placed.
	skillPath := filepath.Join(pluginDir, "skills", "test-skill", "SKILL.md")
	if _, err := os.Stat(skillPath); err != nil {
		t.Fatalf("skill file not placed: %v", err)
	}

	// 5. Verify commands file was placed.
	cmdPath := filepath.Join(pluginDir, "commands", "test-cmd.md")
	if _, err := os.Stat(cmdPath); err != nil {
		t.Fatalf("commands file not placed: %v", err)
	}

	// 6. Verify plugin.json was generated in the marketplace dir.
	pluginJSON := filepath.Join(pluginDir, "plugin.json")
	data, err := os.ReadFile(pluginJSON)
	if err != nil {
		t.Fatalf("plugin.json not found: %v", err)
	}
	var pluginMeta map[string]any
	if err := json.Unmarshal(data, &pluginMeta); err != nil {
		t.Fatalf("plugin.json is invalid JSON: %v", err)
	}
	if pluginMeta["name"] != "brain" {
		t.Errorf("plugin.json name = %v, want %q", pluginMeta["name"], "brain")
	}

	// 7. Verify marketplace.json was generated.
	mktJSON := filepath.Join(pluginDir, "marketplace.json")
	data, err = os.ReadFile(mktJSON)
	if err != nil {
		t.Fatalf("marketplace.json not found: %v", err)
	}
	var mktMeta map[string]any
	if err := json.Unmarshal(data, &mktMeta); err != nil {
		t.Fatalf("marketplace.json is invalid JSON: %v", err)
	}

	// 8. Verify known_marketplaces.json was written in config dir.
	kmPath := filepath.Join(configDir, "plugins", "known_marketplaces.json")
	data, err = os.ReadFile(kmPath)
	if err != nil {
		t.Fatalf("known_marketplaces.json not found: %v", err)
	}
	if !gjson.GetBytes(data, "brain").Exists() {
		t.Error("brain key missing from known_marketplaces.json")
	}
	if gjson.GetBytes(data, "brain.installLocation").String() != pluginDir {
		t.Errorf("installLocation = %q, want %q",
			gjson.GetBytes(data, "brain.installLocation").String(), pluginDir)
	}

	// 9. Verify manifest was written.
	m, err := installer.ReadManifest(g.Name())
	if err != nil {
		t.Fatalf("manifest not found: %v", err)
	}
	if m.Tool != g.Name() {
		t.Errorf("manifest tool = %q, want %q", m.Tool, g.Name())
	}
	if len(m.Files) == 0 {
		t.Error("manifest has no files listed")
	}
	// Verify manifest paths point into the plugin dir.
	for _, f := range m.Files {
		if !strings.HasPrefix(f, pluginDir) {
			t.Errorf("manifest file %q does not start with plugin dir %q", f, pluginDir)
		}
	}
}

// --- Cursor Full Install (copy_and_merge placement) ---

func TestIntegrationGeneric_CursorFullInstall(t *testing.T) {
	srcDir := fixtureSourceDir(t)
	src := installer.NewFilesystemSource(srcDir)

	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, ".cursor")

	tc := curIntegConfig(configDir)
	g := installer.NewToolInstaller(tc)
	defer cleanupManifest(t, g.Name())

	if err := g.Install(context.Background(), src); err != nil {
		t.Fatalf("Install() failed: %v", err)
	}

	brainPrefix := installer.BrainEmoji + "-"

	// 1. Verify agent file was placed with brain emoji prefix.
	agentPath := filepath.Join(configDir, "agents", brainPrefix+"test-agent.md")
	agentData, err := os.ReadFile(agentPath)
	if err != nil {
		t.Fatalf("prefixed agent file not placed: %v", err)
	}
	if !strings.Contains(string(agentData), "test agent") {
		t.Error("agent file content missing expected body text")
	}

	// 2. Verify rules file was placed with brain prefix and .mdc extension.
	rulesPath := filepath.Join(configDir, "rules", brainPrefix+"TEST-PROTOCOL.mdc")
	rulesData, err := os.ReadFile(rulesPath)
	if err != nil {
		t.Fatalf("prefixed rules file not placed: %v", err)
	}
	// Cursor rules should have alwaysApply frontmatter.
	if !strings.Contains(string(rulesData), "alwaysApply") {
		t.Error("rules file missing alwaysApply frontmatter")
	}

	// 3. Verify skills directory with brain prefix.
	skillPath := filepath.Join(configDir, "skills", brainPrefix+"test-skill", "SKILL.md")
	if _, err := os.Stat(skillPath); err != nil {
		t.Fatalf("prefixed skill file not placed: %v", err)
	}

	// 4. Verify commands file with brain prefix.
	cmdPath := filepath.Join(configDir, "commands", brainPrefix+"test-cmd.md")
	if _, err := os.Stat(cmdPath); err != nil {
		t.Fatalf("prefixed command file not placed: %v", err)
	}

	// 5. Verify hooks were merged (Cursor uses merge strategy).
	hooksPath := filepath.Join(configDir, "hooks.json")
	hooksData, err := os.ReadFile(hooksPath)
	if err != nil {
		t.Fatalf("hooks.json not found after merge: %v", err)
	}
	if !gjson.GetBytes(hooksData, "hooks").Exists() {
		t.Error("hooks.json missing 'hooks' key after merge")
	}

	// 6. Verify MCP was merged (Cursor uses merge strategy).
	mcpPath := filepath.Join(configDir, "mcp.json")
	mcpData, err := os.ReadFile(mcpPath)
	if err != nil {
		t.Fatalf("mcp.json not found after merge: %v", err)
	}
	if !gjson.GetBytes(mcpData, "mcpServers").Exists() {
		t.Error("mcp.json missing 'mcpServers' key after merge")
	}

	// 7. Verify manifest was written.
	m, err := installer.ReadManifest(g.Name())
	if err != nil {
		t.Fatalf("manifest not found: %v", err)
	}
	if m.Tool != g.Name() {
		t.Errorf("manifest tool = %q, want %q", m.Tool, g.Name())
	}
	if len(m.Files) == 0 {
		t.Error("manifest has no files listed")
	}
}

// --- Uninstall Flow ---

func TestIntegrationGeneric_UninstallClaudeCode(t *testing.T) {
	srcDir := fixtureSourceDir(t)
	src := installer.NewFilesystemSource(srcDir)

	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, ".claude")
	pluginDir := filepath.Join(tmpDir, ".claude", "plugins", "marketplaces", "brain")

	tc := ccIntegConfig(configDir, pluginDir)
	g := installer.NewToolInstaller(tc)

	// Install first.
	if err := g.Install(context.Background(), src); err != nil {
		t.Fatalf("Install() failed: %v", err)
	}

	// Verify installed.
	m, err := installer.ReadManifest(g.Name())
	if err != nil {
		t.Fatalf("manifest not found after install: %v", err)
	}
	installedFiles := m.Files

	// Uninstall.
	if err := g.Uninstall(context.Background()); err != nil {
		t.Fatalf("Uninstall() failed: %v", err)
	}

	// Verify all manifest files were removed.
	for _, f := range installedFiles {
		if _, err := os.Stat(f); !os.IsNotExist(err) {
			t.Errorf("expected file %q to be removed after uninstall", f)
		}
	}

	// Verify manifest itself was removed.
	if _, err := installer.ReadManifest(g.Name()); err == nil {
		t.Error("manifest should be removed after uninstall")
	}
}

func TestIntegrationGeneric_UninstallCursor(t *testing.T) {
	srcDir := fixtureSourceDir(t)
	src := installer.NewFilesystemSource(srcDir)

	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, ".cursor")

	tc := curIntegConfig(configDir)
	g := installer.NewToolInstaller(tc)

	// Install first.
	if err := g.Install(context.Background(), src); err != nil {
		t.Fatalf("Install() failed: %v", err)
	}

	// Read manifest to track installed files.
	m, err := installer.ReadManifest(g.Name())
	if err != nil {
		t.Fatalf("manifest not found after install: %v", err)
	}
	installedFiles := m.Files

	// Uninstall.
	if err := g.Uninstall(context.Background()); err != nil {
		t.Fatalf("Uninstall() failed: %v", err)
	}

	// Verify all manifest files were removed.
	for _, f := range installedFiles {
		if _, err := os.Stat(f); !os.IsNotExist(err) {
			t.Errorf("expected file %q to be removed after uninstall", f)
		}
	}

	// Verify manifest is removed.
	if _, err := installer.ReadManifest(g.Name()); err == nil {
		t.Error("manifest should be removed after uninstall")
	}
}

// --- Detection (IsBrainInstalled) ---

func TestIntegrationGeneric_DetectionJSONKey(t *testing.T) {
	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, ".claude")
	pluginDir := filepath.Join(tmpDir, ".claude", "plugins", "marketplaces", "brain")

	tc := ccIntegConfig(configDir, pluginDir)
	g := installer.NewToolInstaller(tc)

	// Before install: not detected.
	if g.IsBrainInstalled() {
		t.Error("IsBrainInstalled() should be false before install")
	}

	// Create the detection file with the expected key.
	kmDir := filepath.Join(configDir, "plugins")
	os.MkdirAll(kmDir, 0755)
	kmData := []byte(`{"brain":{"installLocation":"` + pluginDir + `"}}`)
	os.WriteFile(filepath.Join(kmDir, "known_marketplaces.json"), kmData, 0600)

	// After creating detection file: detected.
	if !g.IsBrainInstalled() {
		t.Error("IsBrainInstalled() should be true when json_key detection file has 'brain' key")
	}

	// Remove the key.
	os.WriteFile(filepath.Join(kmDir, "known_marketplaces.json"), []byte(`{}`), 0600)
	if g.IsBrainInstalled() {
		t.Error("IsBrainInstalled() should be false when brain key is removed")
	}
}

func TestIntegrationGeneric_DetectionPrefixScan(t *testing.T) {
	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, ".cursor")

	tc := curIntegConfig(configDir)
	g := installer.NewToolInstaller(tc)

	// Before any files: not detected.
	if g.IsBrainInstalled() {
		t.Error("IsBrainInstalled() should be false before install")
	}

	// Create directories without brain-prefixed files.
	os.MkdirAll(filepath.Join(configDir, "agents"), 0755)
	os.MkdirAll(filepath.Join(configDir, "rules"), 0755)
	os.WriteFile(filepath.Join(configDir, "agents", "user-agent.md"), []byte("user"), 0644)
	if g.IsBrainInstalled() {
		t.Error("IsBrainInstalled() should be false without brain-prefixed files")
	}

	// Add a brain-prefixed file.
	brainFile := installer.BrainEmoji + "-agent.md"
	os.WriteFile(filepath.Join(configDir, "agents", brainFile), []byte("brain"), 0644)
	if !g.IsBrainInstalled() {
		t.Error("IsBrainInstalled() should be true with brain-prefixed file in scan dir")
	}

	// Remove and verify detection in the other scan dir.
	os.Remove(filepath.Join(configDir, "agents", brainFile))
	if g.IsBrainInstalled() {
		t.Error("IsBrainInstalled() should be false after removing brain-prefixed file")
	}

	brainRule := installer.BrainEmoji + "-rule.mdc"
	os.WriteFile(filepath.Join(configDir, "rules", brainRule), []byte("brain"), 0644)
	if !g.IsBrainInstalled() {
		t.Error("IsBrainInstalled() should be true with brain-prefixed file in rules dir")
	}
}

// --- Manifest Content Verification ---

func TestIntegrationGeneric_ManifestContentClaudeCode(t *testing.T) {
	srcDir := fixtureSourceDir(t)
	src := installer.NewFilesystemSource(srcDir)

	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, ".claude")
	pluginDir := filepath.Join(tmpDir, ".claude", "plugins", "marketplaces", "brain")

	tc := ccIntegConfig(configDir, pluginDir)
	g := installer.NewToolInstaller(tc)
	defer cleanupManifest(t, g.Name())

	if err := g.Install(context.Background(), src); err != nil {
		t.Fatalf("Install() failed: %v", err)
	}

	m, err := installer.ReadManifest(g.Name())
	if err != nil {
		t.Fatalf("ReadManifest() failed: %v", err)
	}

	if m.Tool != g.Name() {
		t.Errorf("manifest tool = %q, want %q", m.Tool, g.Name())
	}

	// Each manifest entry should exist on disk.
	for _, f := range m.Files {
		if _, err := os.Stat(f); err != nil {
			t.Errorf("manifest references %q, but file does not exist", f)
		}
	}

	// Verify expected file categories are present.
	var hasAgent, hasRule, hasSkill, hasCmd bool
	for _, f := range m.Files {
		rel := strings.TrimPrefix(f, pluginDir+"/")
		switch {
		case strings.HasPrefix(rel, "agents/"):
			hasAgent = true
		case strings.HasPrefix(rel, "rules/"):
			hasRule = true
		case strings.HasPrefix(rel, "skills/"):
			hasSkill = true
		case strings.HasPrefix(rel, "commands/"):
			hasCmd = true
		}
	}
	if !hasAgent {
		t.Error("manifest missing agent files")
	}
	if !hasRule {
		t.Error("manifest missing rule files")
	}
	if !hasSkill {
		t.Error("manifest missing skill files")
	}
	if !hasCmd {
		t.Error("manifest missing command files")
	}
}

func TestIntegrationGeneric_ManifestContentCursor(t *testing.T) {
	srcDir := fixtureSourceDir(t)
	src := installer.NewFilesystemSource(srcDir)

	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, ".cursor")

	tc := curIntegConfig(configDir)
	g := installer.NewToolInstaller(tc)
	defer cleanupManifest(t, g.Name())

	if err := g.Install(context.Background(), src); err != nil {
		t.Fatalf("Install() failed: %v", err)
	}

	m, err := installer.ReadManifest(g.Name())
	if err != nil {
		t.Fatalf("ReadManifest() failed: %v", err)
	}

	if m.Tool != g.Name() {
		t.Errorf("manifest tool = %q, want %q", m.Tool, g.Name())
	}

	// Manifest entries: content files should exist on disk. Merge payload
	// files (*.merge.json) are intermediates consumed by the placement
	// strategy and do not persist -- skip them.
	for _, f := range m.Files {
		if strings.HasSuffix(f, ".merge.json") {
			continue
		}
		if _, err := os.Stat(f); err != nil {
			t.Errorf("manifest references %q, but file does not exist", f)
		}
	}
}

// --- Idempotent Re-run ---

func TestIntegrationGeneric_IdempotentRerun(t *testing.T) {
	srcDir := fixtureSourceDir(t)
	src := installer.NewFilesystemSource(srcDir)

	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, ".claude")
	pluginDir := filepath.Join(tmpDir, ".claude", "plugins", "marketplaces", "brain")

	tc := ccIntegConfig(configDir, pluginDir)
	g := installer.NewToolInstaller(tc)
	defer cleanupManifest(t, g.Name())

	// First install.
	if err := g.Install(context.Background(), src); err != nil {
		t.Fatalf("first Install() failed: %v", err)
	}
	firstPaths := collectRelPaths(t, pluginDir)

	// Second install (idempotent re-run).
	if err := g.Install(context.Background(), src); err != nil {
		t.Fatalf("second Install() failed: %v", err)
	}
	secondPaths := collectRelPaths(t, pluginDir)

	// File set should be identical.
	if !slicesEqual(firstPaths, secondPaths) {
		t.Errorf("idempotent re-run changed file list:\n  first:  %v\n  second: %v",
			firstPaths, secondPaths)
	}
}
