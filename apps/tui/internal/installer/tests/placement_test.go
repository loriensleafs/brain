package installer_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/peterkloss/brain-tui/internal/installer"
	"github.com/tidwall/gjson"
)

// testToolConfig returns a ToolConfig for testing marketplace placement.
func testMarketplaceToolConfig(configDir, marketplaceDir string) *installer.ToolConfig {
	return &installer.ToolConfig{
		Name:         "claude-code",
		DisplayName:  "Claude Code",
		Prefix:       false,
		ConfigDir:    configDir,
		Scopes:       map[string]string{"plugin": marketplaceDir},
		DefaultScope: "plugin",
		Hooks:        installer.ConfigFileConfig{Strategy: "direct", Target: "hooks/hooks.json"},
		MCP:          installer.ConfigFileConfig{Strategy: "direct", Target: ".mcp.json"},
		Manifest:     installer.ManifestConfig{Type: "marketplace"},
		Placement:    "marketplace",
	}
}

// testCopyMergeToolConfig returns a ToolConfig for testing copy-and-merge placement.
func testCopyMergeToolConfig(targetDir string) *installer.ToolConfig {
	return &installer.ToolConfig{
		Name:         "cursor",
		DisplayName:  "Cursor",
		Prefix:       true,
		ConfigDir:    targetDir,
		Scopes:       map[string]string{"global": targetDir},
		DefaultScope: "global",
		Hooks:        installer.ConfigFileConfig{Strategy: "merge", Target: "hooks.json"},
		MCP:          installer.ConfigFileConfig{Strategy: "merge", Target: "mcp.json"},
		Manifest:     installer.ManifestConfig{Type: "file_list"},
		Placement:    "copy_and_merge",
	}
}

func TestPlacementFor(t *testing.T) {
	tests := []struct {
		placement string
		wantType  string
	}{
		{"marketplace", "*installer.MarketplacePlacement"},
		{"copy_and_merge", "*installer.CopyAndMergePlacement"},
	}

	for _, tt := range tests {
		tc := &installer.ToolConfig{Placement: tt.placement}
		strategy := installer.PlacementFor(tc)
		if strategy == nil {
			t.Errorf("PlacementFor(%q) returned nil", tt.placement)
		}
	}
}

func TestExpandHome(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skip("cannot get home dir")
	}

	tests := []struct {
		input string
		want  string
	}{
		{"~/foo", filepath.Join(home, "foo")},
		{"~/.claude", filepath.Join(home, ".claude")},
		{"/absolute/path", "/absolute/path"},
		{"relative/path", "relative/path"},
	}

	for _, tt := range tests {
		got, err := installer.ExpandHome(tt.input)
		if err != nil {
			t.Errorf("ExpandHome(%q) error: %v", tt.input, err)
			continue
		}
		if got != tt.want {
			t.Errorf("ExpandHome(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

// --------------------------------------------------------------------------
// MarketplacePlacement tests
// --------------------------------------------------------------------------

func TestMarketplacePlacement_Place(t *testing.T) {
	tmpDir := t.TempDir()
	marketplaceDir := filepath.Join(tmpDir, "marketplace")
	configDir := filepath.Join(tmpDir, "config")

	tool := testMarketplaceToolConfig(configDir, marketplaceDir)
	strategy := &installer.MarketplacePlacement{}

	output := &installer.BuildOutput{
		Agents: []installer.GeneratedFile{
			{RelativePath: "agents/architect.md", Content: "# Architect Agent\n"},
		},
		Rules: []installer.GeneratedFile{
			{RelativePath: "rules/brain-rules.md", Content: "# Rules\n"},
		},
	}

	err := strategy.Place(context.Background(), output, tool, "plugin")
	if err != nil {
		t.Fatalf("Place() error: %v", err)
	}

	// Verify agent file was written.
	agentPath := filepath.Join(marketplaceDir, "agents", "architect.md")
	data, err := os.ReadFile(agentPath)
	if err != nil {
		t.Fatalf("agent file not written: %v", err)
	}
	if string(data) != "# Architect Agent\n" {
		t.Errorf("agent content = %q, want %q", string(data), "# Architect Agent\n")
	}

	// Verify rules file was written.
	rulesPath := filepath.Join(marketplaceDir, "rules", "brain-rules.md")
	data, err = os.ReadFile(rulesPath)
	if err != nil {
		t.Fatalf("rules file not written: %v", err)
	}
	if string(data) != "# Rules\n" {
		t.Errorf("rules content = %q, want %q", string(data), "# Rules\n")
	}

	// Verify plugin.json was generated.
	pluginPath := filepath.Join(marketplaceDir, "plugin.json")
	data, err = os.ReadFile(pluginPath)
	if err != nil {
		t.Fatalf("plugin.json not written: %v", err)
	}
	var pluginJSON map[string]any
	if err := json.Unmarshal(data, &pluginJSON); err != nil {
		t.Fatalf("plugin.json invalid JSON: %v", err)
	}
	if pluginJSON["name"] != "brain" {
		t.Errorf("plugin.json name = %v, want %q", pluginJSON["name"], "brain")
	}

	// Verify marketplace.json was generated.
	mktPath := filepath.Join(marketplaceDir, "marketplace.json")
	data, err = os.ReadFile(mktPath)
	if err != nil {
		t.Fatalf("marketplace.json not written: %v", err)
	}
	var mktJSON map[string]any
	if err := json.Unmarshal(data, &mktJSON); err != nil {
		t.Fatalf("marketplace.json invalid JSON: %v", err)
	}
	if mktJSON["name"] != "brain" {
		t.Errorf("marketplace.json name = %v, want %q", mktJSON["name"], "brain")
	}

	// Verify known_marketplaces.json was updated.
	kmPath := filepath.Join(configDir, "plugins", "known_marketplaces.json")
	data, err = os.ReadFile(kmPath)
	if err != nil {
		t.Fatalf("known_marketplaces.json not written: %v", err)
	}
	if !gjson.GetBytes(data, "brain").Exists() {
		t.Error("brain key missing from known_marketplaces.json")
	}
	if gjson.GetBytes(data, "brain.installLocation").String() != marketplaceDir {
		t.Errorf("installLocation = %q, want %q",
			gjson.GetBytes(data, "brain.installLocation").String(), marketplaceDir)
	}
}

func TestMarketplacePlacement_Clean(t *testing.T) {
	tmpDir := t.TempDir()
	marketplaceDir := filepath.Join(tmpDir, "marketplace")
	configDir := filepath.Join(tmpDir, "config")

	// Create marketplace dir and known_marketplaces.json.
	os.MkdirAll(marketplaceDir, 0755)
	os.WriteFile(filepath.Join(marketplaceDir, "plugin.json"), []byte("{}"), 0644)

	kmDir := filepath.Join(configDir, "plugins")
	os.MkdirAll(kmDir, 0755)
	kmData := []byte(`{"brain":{"installLocation":"` + marketplaceDir + `"},"other":"keep"}`)
	os.WriteFile(filepath.Join(kmDir, "known_marketplaces.json"), kmData, 0600)

	tool := testMarketplaceToolConfig(configDir, marketplaceDir)
	strategy := &installer.MarketplacePlacement{}

	err := strategy.Clean(context.Background(), tool, "plugin")
	if err != nil {
		t.Fatalf("Clean() error: %v", err)
	}

	// Verify marketplace dir was removed.
	if _, err := os.Stat(marketplaceDir); !os.IsNotExist(err) {
		t.Error("marketplace dir still exists after Clean")
	}

	// Verify brain key was removed from known_marketplaces.json.
	kmPath := filepath.Join(kmDir, "known_marketplaces.json")
	data, err := os.ReadFile(kmPath)
	if err != nil {
		t.Fatalf("known_marketplaces.json missing after Clean: %v", err)
	}
	if gjson.GetBytes(data, "brain").Exists() {
		t.Error("brain key still present in known_marketplaces.json after Clean")
	}
	if !gjson.GetBytes(data, "other").Exists() {
		t.Error("non-brain key removed from known_marketplaces.json")
	}
}

func TestMarketplacePlacement_Place_CreatesDirectories(t *testing.T) {
	tmpDir := t.TempDir()
	// Use a deeply nested path that doesn't exist yet.
	marketplaceDir := filepath.Join(tmpDir, "a", "b", "c", "marketplace")
	configDir := filepath.Join(tmpDir, "config")

	tool := testMarketplaceToolConfig(configDir, marketplaceDir)
	strategy := &installer.MarketplacePlacement{}

	output := &installer.BuildOutput{
		Agents: []installer.GeneratedFile{
			{RelativePath: "agents/test.md", Content: "test"},
		},
	}

	err := strategy.Place(context.Background(), output, tool, "plugin")
	if err != nil {
		t.Fatalf("Place() should create missing dirs, got error: %v", err)
	}

	if _, err := os.Stat(filepath.Join(marketplaceDir, "agents", "test.md")); err != nil {
		t.Error("file not written through nested directory creation")
	}
}

// --------------------------------------------------------------------------
// CopyAndMergePlacement tests
// --------------------------------------------------------------------------

func TestCopyAndMergePlacement_Place_ContentFiles(t *testing.T) {
	tmpDir := t.TempDir()
	targetDir := filepath.Join(tmpDir, "cursor")

	tool := testCopyMergeToolConfig(targetDir)
	strategy := &installer.CopyAndMergePlacement{}

	output := &installer.BuildOutput{
		Agents: []installer.GeneratedFile{
			{RelativePath: "agents/\U0001F9E0-architect.md", Content: "# Architect\n"},
		},
		Rules: []installer.GeneratedFile{
			{RelativePath: "rules/\U0001F9E0-rules.mdc", Content: "# Rules\n"},
		},
		Commands: []installer.GeneratedFile{
			{RelativePath: "commands/\U0001F9E0-cmd.md", Content: "# Command\n"},
		},
	}

	err := strategy.Place(context.Background(), output, tool, "global")
	if err != nil {
		t.Fatalf("Place() error: %v", err)
	}

	// Verify content files were written.
	for _, tc := range []struct {
		rel  string
		want string
	}{
		{"agents/\U0001F9E0-architect.md", "# Architect\n"},
		{"rules/\U0001F9E0-rules.mdc", "# Rules\n"},
		{"commands/\U0001F9E0-cmd.md", "# Command\n"},
	} {
		data, err := os.ReadFile(filepath.Join(targetDir, tc.rel))
		if err != nil {
			t.Errorf("file %s not written: %v", tc.rel, err)
			continue
		}
		if string(data) != tc.want {
			t.Errorf("file %s content = %q, want %q", tc.rel, string(data), tc.want)
		}
	}
}

func TestCopyAndMergePlacement_Place_MergeHooks(t *testing.T) {
	tmpDir := t.TempDir()
	targetDir := filepath.Join(tmpDir, "cursor")
	os.MkdirAll(targetDir, 0755)

	// Pre-existing hooks.json with user content.
	existingHooks := `{"userHook": {"event": "test"}}` + "\n"
	os.WriteFile(filepath.Join(targetDir, "hooks.json"), []byte(existingHooks), 0600)

	tool := testCopyMergeToolConfig(targetDir)
	strategy := &installer.CopyAndMergePlacement{}

	// Merge payload matching the format from cursor.go.
	mergePayload := `{"managedKeys":["brainHook"],"content":{"brainHook":{"event":"save"}}}`

	output := &installer.BuildOutput{
		Hooks: []installer.GeneratedFile{
			{RelativePath: "hooks/hooks.merge.json", Content: mergePayload},
		},
	}

	err := strategy.Place(context.Background(), output, tool, "global")
	if err != nil {
		t.Fatalf("Place() error: %v", err)
	}

	// Verify merged result contains both user and brain hooks.
	data, err := os.ReadFile(filepath.Join(targetDir, "hooks.json"))
	if err != nil {
		t.Fatalf("hooks.json not found: %v", err)
	}

	if !gjson.GetBytes(data, "userHook").Exists() {
		t.Error("user hook was removed during merge")
	}
	if !gjson.GetBytes(data, "brainHook").Exists() {
		t.Error("brain hook was not merged in")
	}
	if gjson.GetBytes(data, "brainHook.event").String() != "save" {
		t.Errorf("brainHook.event = %q, want %q",
			gjson.GetBytes(data, "brainHook.event").String(), "save")
	}
}

func TestCopyAndMergePlacement_Place_MergeMCP(t *testing.T) {
	tmpDir := t.TempDir()
	targetDir := filepath.Join(tmpDir, "cursor")
	os.MkdirAll(targetDir, 0755)

	// Pre-existing mcp.json.
	existingMCP := `{"mcpServers":{"userServer":{"command":"test"}}}` + "\n"
	os.WriteFile(filepath.Join(targetDir, "mcp.json"), []byte(existingMCP), 0600)

	tool := testCopyMergeToolConfig(targetDir)
	strategy := &installer.CopyAndMergePlacement{}

	mergePayload := `{"managedKeys":["mcpServers.brain-memory"],"content":{"mcpServers":{"brain-memory":{"command":"brain-mcp"}}}}`

	output := &installer.BuildOutput{
		MCP: []installer.GeneratedFile{
			{RelativePath: "mcp/mcp.merge.json", Content: mergePayload},
		},
	}

	err := strategy.Place(context.Background(), output, tool, "global")
	if err != nil {
		t.Fatalf("Place() error: %v", err)
	}

	data, err := os.ReadFile(filepath.Join(targetDir, "mcp.json"))
	if err != nil {
		t.Fatalf("mcp.json not found: %v", err)
	}

	if !gjson.GetBytes(data, "mcpServers.userServer").Exists() {
		t.Error("user MCP server was removed during merge")
	}
	if !gjson.GetBytes(data, "mcpServers.brain-memory").Exists() {
		t.Error("brain MCP server was not merged in")
	}
}

func TestCopyAndMergePlacement_Place_CreatesMissingDir(t *testing.T) {
	tmpDir := t.TempDir()
	targetDir := filepath.Join(tmpDir, "nonexistent", "cursor")

	tool := testCopyMergeToolConfig(targetDir)
	strategy := &installer.CopyAndMergePlacement{}

	output := &installer.BuildOutput{
		Agents: []installer.GeneratedFile{
			{RelativePath: "agents/test.md", Content: "test"},
		},
	}

	err := strategy.Place(context.Background(), output, tool, "global")
	if err != nil {
		t.Fatalf("Place() should create missing dirs, got error: %v", err)
	}

	if _, err := os.Stat(filepath.Join(targetDir, "agents", "test.md")); err != nil {
		t.Error("file not written to newly created directory")
	}
}

func TestCopyAndMergePlacement_Clean(t *testing.T) {
	tmpDir := t.TempDir()
	targetDir := filepath.Join(tmpDir, "cursor")
	brainPrefix := installer.BrainEmoji + "-"

	// Create Brain-prefixed files and a non-brain file.
	for _, sub := range []string{"agents", "commands", "rules"} {
		dir := filepath.Join(targetDir, sub)
		os.MkdirAll(dir, 0755)
		os.WriteFile(filepath.Join(dir, brainPrefix+"brain-file.md"), []byte("brain"), 0644)
		os.WriteFile(filepath.Join(dir, "user-file.md"), []byte("user"), 0644)
	}

	// Create Brain-prefixed skill directory.
	skillsDir := filepath.Join(targetDir, "skills")
	os.MkdirAll(filepath.Join(skillsDir, brainPrefix+"brain-skill"), 0755)
	os.WriteFile(filepath.Join(skillsDir, brainPrefix+"brain-skill", "SKILL.md"), []byte("skill"), 0644)
	os.MkdirAll(filepath.Join(skillsDir, "user-skill"), 0755)

	// Create hooks.json with brain and user keys.
	hooksData := `{"brainHook":{"event":"save"},"userHook":{"event":"test"}}` + "\n"
	os.WriteFile(filepath.Join(targetDir, "hooks.json"), []byte(hooksData), 0600)

	// Create mcp.json with nested brain keys.
	mcpData := `{"mcpServers":{"brain-memory":{"cmd":"brain"},"userServer":{"cmd":"user"}}}` + "\n"
	os.WriteFile(filepath.Join(targetDir, "mcp.json"), []byte(mcpData), 0600)

	tool := testCopyMergeToolConfig(targetDir)
	strategy := &installer.CopyAndMergePlacement{}

	err := strategy.Clean(context.Background(), tool, "global")
	if err != nil {
		t.Fatalf("Clean() error: %v", err)
	}

	// Verify Brain files were removed but user files kept.
	for _, sub := range []string{"agents", "commands", "rules"} {
		brainFile := filepath.Join(targetDir, sub, brainPrefix+"brain-file.md")
		if _, err := os.Stat(brainFile); !os.IsNotExist(err) {
			t.Errorf("brain file %s still exists after Clean", brainFile)
		}
		userFile := filepath.Join(targetDir, sub, "user-file.md")
		if _, err := os.Stat(userFile); err != nil {
			t.Errorf("user file %s was removed by Clean", userFile)
		}
	}

	// Verify Brain skill directory was removed.
	brainSkill := filepath.Join(skillsDir, brainPrefix+"brain-skill")
	if _, err := os.Stat(brainSkill); !os.IsNotExist(err) {
		t.Error("brain skill directory still exists after Clean")
	}
	userSkill := filepath.Join(skillsDir, "user-skill")
	if _, err := os.Stat(userSkill); err != nil {
		t.Error("user skill directory was removed by Clean")
	}

	// Verify hooks.json: brain key removed, user key kept.
	hooksResult, err := os.ReadFile(filepath.Join(targetDir, "hooks.json"))
	if err != nil {
		t.Fatalf("hooks.json removed: %v", err)
	}
	if gjson.GetBytes(hooksResult, "brainHook").Exists() {
		t.Error("brainHook still in hooks.json after Clean")
	}
	if !gjson.GetBytes(hooksResult, "userHook").Exists() {
		t.Error("userHook removed from hooks.json by Clean")
	}

	// Verify mcp.json: brain-memory removed, userServer kept.
	mcpResult, err := os.ReadFile(filepath.Join(targetDir, "mcp.json"))
	if err != nil {
		t.Fatalf("mcp.json removed: %v", err)
	}
	if gjson.GetBytes(mcpResult, "mcpServers.brain-memory").Exists() {
		t.Error("brain-memory still in mcp.json after Clean")
	}
	if !gjson.GetBytes(mcpResult, "mcpServers.userServer").Exists() {
		t.Error("userServer removed from mcp.json by Clean")
	}
}

func TestCopyAndMergePlacement_Place_MergeCreatesFileFromScratch(t *testing.T) {
	tmpDir := t.TempDir()
	targetDir := filepath.Join(tmpDir, "cursor")
	os.MkdirAll(targetDir, 0755)
	// No pre-existing hooks.json.

	tool := testCopyMergeToolConfig(targetDir)
	strategy := &installer.CopyAndMergePlacement{}

	mergePayload := `{"managedKeys":["brainHook"],"content":{"brainHook":{"event":"save"}}}`

	output := &installer.BuildOutput{
		Hooks: []installer.GeneratedFile{
			{RelativePath: "hooks/hooks.merge.json", Content: mergePayload},
		},
	}

	err := strategy.Place(context.Background(), output, tool, "global")
	if err != nil {
		t.Fatalf("Place() error: %v", err)
	}

	data, err := os.ReadFile(filepath.Join(targetDir, "hooks.json"))
	if err != nil {
		t.Fatalf("hooks.json not created: %v", err)
	}

	if !gjson.GetBytes(data, "brainHook").Exists() {
		t.Error("brainHook not present in newly created hooks.json")
	}
}

func TestBuildOutput_AllFiles(t *testing.T) {
	output := &installer.BuildOutput{
		Agents:   []installer.GeneratedFile{{RelativePath: "a"}},
		Skills:   []installer.GeneratedFile{{RelativePath: "b"}},
		Commands: []installer.GeneratedFile{{RelativePath: "c"}},
		Rules:    []installer.GeneratedFile{{RelativePath: "d"}},
		Hooks:    []installer.GeneratedFile{{RelativePath: "e"}},
		MCP:      []installer.GeneratedFile{{RelativePath: "f"}},
	}

	all := output.AllFiles()
	if len(all) != 6 {
		t.Errorf("AllFiles() returned %d files, want 6", len(all))
	}

	want := []string{"a", "b", "c", "d", "e", "f"}
	for i, f := range all {
		if f.RelativePath != want[i] {
			t.Errorf("AllFiles()[%d].RelativePath = %q, want %q", i, f.RelativePath, want[i])
		}
	}
}

func TestResolveScopePath_MissingScope(t *testing.T) {
	tool := &installer.ToolConfig{
		Name:   "test",
		Scopes: map[string]string{"global": "/tmp/test"},
	}

	_, err := installer.ResolveScopePath(tool, "nonexistent")
	if err == nil {
		t.Error("ResolveScopePath should error on missing scope")
	}
}
