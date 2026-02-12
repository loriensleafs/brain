package installer_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/peterkloss/brain-tui/internal/installer"
)

// ---- Test Fixtures ----------------------------------------------------------

// testProjectRoot creates a temporary project structure with templates and
// brain.config.json, returning the project root path.
func testProjectRoot(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	templatesDir := filepath.Join(root, "templates")

	// Create template directories
	for _, dir := range []string{
		installer.AgentsDir,
		installer.SkillsDir + "/my-skill",
		installer.CommandsDir,
		installer.ProtocolsDir,
		installer.ConfigsDir,
		installer.HooksDir + "/scripts",
	} {
		if err := os.MkdirAll(filepath.Join(templatesDir, dir), 0755); err != nil {
			t.Fatal(err)
		}
	}

	// Write a canonical agent file
	writeTestFile(t, filepath.Join(templatesDir, installer.AgentsDir, "architect.md"), `---
description: System designer
---

# Architect Agent

You are an architect.
`)

	// Write a skill file
	writeTestFile(t, filepath.Join(templatesDir, installer.SkillsDir, "my-skill", "SKILL.md"), `# My Skill

Do things.
`)

	// Write a command file
	writeTestFile(t, filepath.Join(templatesDir, installer.CommandsDir, "deploy.md"), `# Deploy

Run deployment.
`)

	// Write a protocol file
	writeTestFile(t, filepath.Join(templatesDir, installer.ProtocolsDir, "AGENT-INSTRUCTIONS.md"), `# Agent Instructions

Follow these rules.
`)

	writeTestFile(t, filepath.Join(templatesDir, installer.ProtocolsDir, "AGENT-SYSTEM.md"), `# Agent System

System reference doc.
`)

	// Write MCP config
	mcpConfig := map[string]any{
		"mcpServers": map[string]any{
			"brain": map[string]any{
				"command": "node",
				"args":    []string{"./packages/mcp/dist/index.js"},
			},
		},
	}
	mcpData, _ := json.MarshalIndent(mcpConfig, "", "  ")
	writeTestFile(t, filepath.Join(templatesDir, installer.ConfigsDir, "mcp.json"), string(mcpData))

	// Write Claude Code hooks source
	hooksJSON := `{"hooks": {"PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "echo test"}]}]}}`
	writeTestFile(t, filepath.Join(templatesDir, installer.HooksDir, "claude-code.json"), hooksJSON)

	// Write Cursor hooks source
	cursorHooksJSON := `{"hooks": {"save": [{"matcher": "*.go", "hooks": [{"type": "command", "command": "go fmt"}]}]}}`
	writeTestFile(t, filepath.Join(templatesDir, installer.HooksDir, "cursor.json"), cursorHooksJSON)

	// Write hook scripts
	writeTestFile(t, filepath.Join(templatesDir, installer.HooksDir, "scripts", "lint.js"), `// lint script`)

	// Write brain.config.json
	brainConfig := map[string]any{
		"version": "2.0.0",
		"targets": map[string]any{
			"claude-code": map[string]any{"prefix": false},
			"cursor":      map[string]any{"prefix": true},
		},
		"agents": map[string]any{
			"architect": map[string]any{
				"claude-code": map[string]any{
					"model":       "claude-sonnet-4-5-20250929",
					"description": "System designer",
					"memory":      "edit",
					"color":       "#FF6B6B",
					"tools":       []string{"Read", "Glob"},
				},
				"cursor": map[string]any{
					"description": "System designer for Cursor",
				},
			},
		},
		"hooks": map[string]any{
			"claude-code": map[string]any{
				"source":  "hooks/claude-code.json",
				"scripts": "hooks/scripts",
			},
		},
		"skills":    map[string]any{},
		"commands":  map[string]any{},
		"protocols": map[string]any{},
	}
	brainData, _ := json.MarshalIndent(brainConfig, "", "  ")
	writeTestFile(t, filepath.Join(root, installer.ConfigFile), string(brainData))

	return root
}

func writeTestFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
}

// claudeToolConfigFull returns a ToolConfig matching the Claude Code YAML config.
func claudeToolConfigFull() *installer.ToolConfig {
	return &installer.ToolConfig{
		Name:        "claude-code",
		DisplayName: "Claude Code",
		Prefix:      false,
		ConfigDir:   "~/.claude",
		Scopes: map[string]string{
			"global":  "~/.claude/",
			"plugin":  "~/.claude/plugins/marketplaces/brain/",
			"project": ".claude/",
		},
		DefaultScope: "plugin",
		Agents: installer.AgentConfig{
			Frontmatter: []string{"name", "model", "description", "memory", "color", "argument-hint", "tools", "skills"},
		},
		Rules: installer.RuleConfig{
			Extension:        ".md",
			ExtraFrontmatter: map[string]any{},
			Routing:          map[string]string{},
			InstructionsPath: "instructions/AGENTS.md",
		},
		Hooks: installer.ConfigFileConfig{
			Strategy: "direct",
			Target:   "hooks/hooks.json",
		},
		MCP: installer.ConfigFileConfig{
			Strategy: "direct",
			Target:   ".mcp.json",
		},
		Manifest: installer.ManifestConfig{
			Type: "marketplace",
		},
		Placement: "marketplace",
	}
}

// cursorToolConfigFull returns a ToolConfig matching the Cursor YAML config.
func cursorToolConfigFull() *installer.ToolConfig {
	return &installer.ToolConfig{
		Name:        "cursor",
		DisplayName: "Cursor",
		Prefix:      true,
		ConfigDir:   "~/.cursor",
		Scopes: map[string]string{
			"global":  "~/.cursor/",
			"project": ".cursor/",
		},
		DefaultScope: "global",
		Agents: installer.AgentConfig{
			Frontmatter: []string{"description"},
		},
		Rules: installer.RuleConfig{
			Extension:        ".mdc",
			ExtraFrontmatter: map[string]any{"alwaysApply": true},
			Routing: map[string]string{
				"AGENT-SYSTEM.md":     ".agents/",
				"SESSION-PROTOCOL.md": ".agents/",
			},
			InstructionsPath: "AGENTS.md",
		},
		Hooks: installer.ConfigFileConfig{
			Strategy: "merge",
			Target:   "hooks.json",
		},
		MCP: installer.ConfigFileConfig{
			Strategy: "merge",
			Target:   "mcp.json",
		},
		Manifest: installer.ManifestConfig{
			Type: "file_list",
		},
		Placement: "copy_and_merge",
	}
}

// ---- BuildAll Tests ---------------------------------------------------------

func TestBuildAll_ClaudeCode_Agents(t *testing.T) {
	root := testProjectRoot(t)
	src := installer.NewFilesystemSource(root)
	brainConfig, err := src.Config()
	if err != nil {
		t.Fatal(err)
	}
	tool := claudeToolConfigFull()

	out, err := installer.BuildAll(src, tool, brainConfig)
	if err != nil {
		t.Fatalf("BuildAll failed: %v", err)
	}

	if len(out.Agents) == 0 {
		t.Fatal("expected at least one agent")
	}

	// Find the architect agent
	var found *installer.GeneratedFile
	for i := range out.Agents {
		if strings.Contains(out.Agents[i].RelativePath, "architect") {
			found = &out.Agents[i]
			break
		}
	}
	if found == nil {
		t.Fatal("architect agent not found in output")
	}

	// Claude Code should have full frontmatter: name, model, description, memory, color, tools
	if !strings.Contains(found.Content, "name: architect") {
		t.Error("expected 'name: architect' in frontmatter")
	}
	if !strings.Contains(found.Content, "model: claude-sonnet-4-5-20250929") {
		t.Error("expected 'model:' in frontmatter")
	}
	if !strings.Contains(found.Content, "description: System designer") {
		t.Error("expected 'description:' in frontmatter")
	}
	if !strings.Contains(found.Content, "memory: edit") {
		t.Error("expected 'memory:' in frontmatter")
	}
	if !strings.Contains(found.Content, "color:") {
		t.Error("expected 'color:' in frontmatter")
	}
	if !strings.Contains(found.Content, "tools:") {
		t.Error("expected 'tools:' in frontmatter")
	}
	// Verify the agent body is present
	if !strings.Contains(found.Content, "You are an architect.") {
		t.Error("expected agent body content")
	}
}

func TestBuildAll_Cursor_Agents(t *testing.T) {
	root := testProjectRoot(t)
	src := installer.NewFilesystemSource(root)
	brainConfig, err := src.Config()
	if err != nil {
		t.Fatal(err)
	}
	tool := cursorToolConfigFull()

	out, err := installer.BuildAll(src, tool, brainConfig)
	if err != nil {
		t.Fatalf("BuildAll failed: %v", err)
	}

	if len(out.Agents) == 0 {
		t.Fatal("expected at least one agent")
	}

	var found *installer.GeneratedFile
	for i := range out.Agents {
		if strings.Contains(out.Agents[i].RelativePath, "architect") {
			found = &out.Agents[i]
			break
		}
	}
	if found == nil {
		t.Fatal("architect agent not found in output")
	}

	// Cursor should have ONLY description frontmatter
	if !strings.Contains(found.Content, "description: System designer for Cursor") {
		t.Error("expected 'description:' in Cursor frontmatter")
	}
	// Should NOT have Claude-specific fields
	if strings.Contains(found.Content, "name:") {
		t.Error("Cursor agent should not have 'name:' in frontmatter")
	}
	if strings.Contains(found.Content, "model:") {
		t.Error("Cursor agent should not have 'model:' in frontmatter")
	}
	if strings.Contains(found.Content, "memory:") {
		t.Error("Cursor agent should not have 'memory:' in frontmatter")
	}
	if strings.Contains(found.Content, "tools:") {
		t.Error("Cursor agent should not have 'tools:' in frontmatter")
	}

	// Cursor should have brain emoji prefix
	if !strings.HasPrefix(filepath.Base(found.RelativePath), installer.BrainEmoji+"-") {
		t.Errorf("Cursor agent should be prefixed, got %q", found.RelativePath)
	}
}

func TestBuildAll_ClaudeCode_Skills(t *testing.T) {
	root := testProjectRoot(t)
	src := installer.NewFilesystemSource(root)
	brainConfig, err := src.Config()
	if err != nil {
		t.Fatal(err)
	}
	tool := claudeToolConfigFull()

	out, err := installer.BuildAll(src, tool, brainConfig)
	if err != nil {
		t.Fatalf("BuildAll failed: %v", err)
	}

	if len(out.Skills) == 0 {
		t.Fatal("expected at least one skill")
	}

	// Claude Code: no prefix
	found := false
	for _, s := range out.Skills {
		if strings.Contains(s.RelativePath, "my-skill/SKILL.md") {
			found = true
			if strings.Contains(s.RelativePath, installer.BrainEmoji) {
				t.Error("Claude Code skills should not be prefixed")
			}
			if !strings.Contains(s.Content, "Do things.") {
				t.Error("skill content missing")
			}
		}
	}
	if !found {
		t.Error("my-skill/SKILL.md not found in skills output")
	}
}

func TestBuildAll_Cursor_Skills(t *testing.T) {
	root := testProjectRoot(t)
	src := installer.NewFilesystemSource(root)
	brainConfig, err := src.Config()
	if err != nil {
		t.Fatal(err)
	}
	tool := cursorToolConfigFull()

	out, err := installer.BuildAll(src, tool, brainConfig)
	if err != nil {
		t.Fatalf("BuildAll failed: %v", err)
	}

	if len(out.Skills) == 0 {
		t.Fatal("expected at least one skill")
	}

	// Cursor: should be prefixed
	found := false
	for _, s := range out.Skills {
		if strings.Contains(s.RelativePath, "SKILL.md") {
			found = true
			if !strings.Contains(s.RelativePath, installer.BrainEmoji+"-my-skill") {
				t.Errorf("Cursor skills should be prefixed, got %q", s.RelativePath)
			}
		}
	}
	if !found {
		t.Error("SKILL.md not found in skills output")
	}
}

func TestBuildAll_ClaudeCode_Commands(t *testing.T) {
	root := testProjectRoot(t)
	src := installer.NewFilesystemSource(root)
	brainConfig, err := src.Config()
	if err != nil {
		t.Fatal(err)
	}
	tool := claudeToolConfigFull()

	out, err := installer.BuildAll(src, tool, brainConfig)
	if err != nil {
		t.Fatalf("BuildAll failed: %v", err)
	}

	if len(out.Commands) == 0 {
		t.Fatal("expected at least one command")
	}

	found := false
	for _, c := range out.Commands {
		if strings.Contains(c.RelativePath, "deploy") {
			found = true
			// Claude Code: no prefix
			if strings.Contains(c.RelativePath, installer.BrainEmoji) {
				t.Error("Claude Code commands should not be prefixed")
			}
			if !strings.Contains(c.Content, "Run deployment.") {
				t.Error("command content missing")
			}
		}
	}
	if !found {
		t.Error("deploy command not found")
	}
}

func TestBuildAll_Cursor_Commands(t *testing.T) {
	root := testProjectRoot(t)
	src := installer.NewFilesystemSource(root)
	brainConfig, err := src.Config()
	if err != nil {
		t.Fatal(err)
	}
	tool := cursorToolConfigFull()

	out, err := installer.BuildAll(src, tool, brainConfig)
	if err != nil {
		t.Fatalf("BuildAll failed: %v", err)
	}

	if len(out.Commands) == 0 {
		t.Fatal("expected at least one command")
	}

	found := false
	for _, c := range out.Commands {
		if strings.Contains(c.RelativePath, "deploy") {
			found = true
			if !strings.Contains(c.RelativePath, installer.BrainEmoji+"-deploy") {
				t.Errorf("Cursor commands should be prefixed, got %q", c.RelativePath)
			}
		}
	}
	if !found {
		t.Error("deploy command not found")
	}
}

func TestBuildAll_ClaudeCode_Rules(t *testing.T) {
	root := testProjectRoot(t)
	src := installer.NewFilesystemSource(root)
	brainConfig, err := src.Config()
	if err != nil {
		t.Fatal(err)
	}
	tool := claudeToolConfigFull()

	out, err := installer.BuildAll(src, tool, brainConfig)
	if err != nil {
		t.Fatalf("BuildAll failed: %v", err)
	}

	if len(out.Rules) == 0 {
		t.Fatal("expected at least one rule")
	}

	// Claude Code: all protocols go to rules/ with .md extension, no extra frontmatter
	for _, r := range out.Rules {
		if strings.Contains(r.RelativePath, "AGENT-INSTRUCTIONS") {
			if !strings.HasSuffix(r.RelativePath, ".md") {
				t.Errorf("Claude Code rules should have .md extension, got %q", r.RelativePath)
			}
			// Should NOT have alwaysApply frontmatter
			if strings.Contains(r.Content, "alwaysApply") {
				t.Error("Claude Code rules should not have alwaysApply")
			}
			if !strings.Contains(r.Content, "Follow these rules.") {
				t.Error("rule content missing")
			}
		}
		if strings.Contains(r.RelativePath, "AGENT-SYSTEM") {
			// Claude Code: no routing, goes to rules/
			if !strings.HasPrefix(r.RelativePath, "rules/") {
				t.Errorf("Claude Code AGENT-SYSTEM should go to rules/, got %q", r.RelativePath)
			}
		}
	}
}

func TestBuildAll_Cursor_Rules(t *testing.T) {
	root := testProjectRoot(t)
	src := installer.NewFilesystemSource(root)
	brainConfig, err := src.Config()
	if err != nil {
		t.Fatal(err)
	}
	tool := cursorToolConfigFull()

	out, err := installer.BuildAll(src, tool, brainConfig)
	if err != nil {
		t.Fatalf("BuildAll failed: %v", err)
	}

	if len(out.Rules) == 0 {
		t.Fatal("expected at least one rule")
	}

	foundInstructions := false
	foundSystem := false
	for _, r := range out.Rules {
		// AGENT-INSTRUCTIONS should go to rules/ with .mdc extension and alwaysApply
		if strings.Contains(r.RelativePath, "AGENT-INSTRUCTIONS") {
			foundInstructions = true
			if !strings.HasSuffix(r.RelativePath, ".mdc") {
				t.Errorf("Cursor rules should have .mdc extension, got %q", r.RelativePath)
			}
			if !strings.HasPrefix(r.RelativePath, "rules/") {
				t.Errorf("AGENT-INSTRUCTIONS should be in rules/, got %q", r.RelativePath)
			}
			if !strings.Contains(r.Content, "alwaysApply: true") {
				t.Error("Cursor AGENT-INSTRUCTIONS should have alwaysApply: true")
			}
			if !strings.Contains(r.RelativePath, installer.BrainEmoji) {
				t.Error("Cursor rules should be prefixed")
			}
		}

		// AGENT-SYSTEM should be routed to .agents/ as .md (not rules/)
		if strings.Contains(r.RelativePath, "AGENT-SYSTEM") {
			foundSystem = true
			if !strings.HasPrefix(r.RelativePath, ".agents/") {
				t.Errorf("Cursor AGENT-SYSTEM should be routed to .agents/, got %q", r.RelativePath)
			}
			if !strings.HasSuffix(r.RelativePath, ".md") {
				t.Errorf("Routed files should keep .md extension, got %q", r.RelativePath)
			}
		}
	}

	if !foundInstructions {
		t.Error("AGENT-INSTRUCTIONS not found in Cursor rules")
	}
	if !foundSystem {
		t.Error("AGENT-SYSTEM not found in Cursor rules (routing)")
	}
}

func TestBuildAll_ClaudeCode_Hooks_Direct(t *testing.T) {
	root := testProjectRoot(t)
	src := installer.NewFilesystemSource(root)
	brainConfig, err := src.Config()
	if err != nil {
		t.Fatal(err)
	}
	tool := claudeToolConfigFull()

	out, err := installer.BuildAll(src, tool, brainConfig)
	if err != nil {
		t.Fatalf("BuildAll failed: %v", err)
	}

	if len(out.Hooks) == 0 {
		t.Fatal("expected hooks output")
	}

	// Should have hooks.json (direct copy) and scripts
	foundHooksJSON := false
	foundScript := false
	for _, h := range out.Hooks {
		if h.RelativePath == "hooks/hooks.json" {
			foundHooksJSON = true
			if !strings.Contains(h.Content, "PreToolUse") {
				t.Error("hooks.json should contain PreToolUse")
			}
		}
		if strings.Contains(h.RelativePath, "hooks/scripts/lint.js") {
			foundScript = true
		}
	}
	if !foundHooksJSON {
		t.Error("hooks/hooks.json not found (direct strategy)")
	}
	if !foundScript {
		t.Error("hooks/scripts/lint.js not found")
	}
}

func TestBuildAll_Cursor_Hooks_Merge(t *testing.T) {
	root := testProjectRoot(t)
	src := installer.NewFilesystemSource(root)
	brainConfig, err := src.Config()
	if err != nil {
		t.Fatal(err)
	}
	tool := cursorToolConfigFull()

	out, err := installer.BuildAll(src, tool, brainConfig)
	if err != nil {
		t.Fatalf("BuildAll failed: %v", err)
	}

	if len(out.Hooks) == 0 {
		t.Fatal("expected hooks output")
	}

	// Should have a merge payload file
	foundMerge := false
	for _, h := range out.Hooks {
		if strings.Contains(h.RelativePath, "merge.json") {
			foundMerge = true
			// Verify it's a valid merge payload
			var payload installer.MergePayload
			if err := json.Unmarshal([]byte(h.Content), &payload); err != nil {
				t.Errorf("hooks merge payload is not valid JSON: %v", err)
			}
			if len(payload.ManagedKeys) == 0 {
				t.Error("hooks merge payload should have managed keys")
			}
			if payload.Content == nil {
				t.Error("hooks merge payload should have content")
			}
		}
	}
	if !foundMerge {
		t.Error("hooks merge.json not found (merge strategy)")
	}
}

func TestBuildAll_ClaudeCode_MCP_Direct(t *testing.T) {
	root := testProjectRoot(t)
	src := installer.NewFilesystemSource(root)
	brainConfig, err := src.Config()
	if err != nil {
		t.Fatal(err)
	}
	tool := claudeToolConfigFull()

	out, err := installer.BuildAll(src, tool, brainConfig)
	if err != nil {
		t.Fatalf("BuildAll failed: %v", err)
	}

	if len(out.MCP) == 0 {
		t.Fatal("expected MCP output")
	}

	found := false
	for _, m := range out.MCP {
		if m.RelativePath == ".mcp.json" {
			found = true
			// Should have resolved paths
			if strings.Contains(m.Content, "./packages/") {
				t.Error("relative paths should be resolved to absolute")
			}
			if !strings.Contains(m.Content, "mcpServers") {
				t.Error("MCP config should contain mcpServers")
			}
		}
	}
	if !found {
		t.Error(".mcp.json not found (direct strategy)")
	}
}

func TestBuildAll_Cursor_MCP_Merge(t *testing.T) {
	root := testProjectRoot(t)
	src := installer.NewFilesystemSource(root)
	brainConfig, err := src.Config()
	if err != nil {
		t.Fatal(err)
	}
	tool := cursorToolConfigFull()

	out, err := installer.BuildAll(src, tool, brainConfig)
	if err != nil {
		t.Fatalf("BuildAll failed: %v", err)
	}

	if len(out.MCP) == 0 {
		t.Fatal("expected MCP output")
	}

	found := false
	for _, m := range out.MCP {
		if strings.Contains(m.RelativePath, "merge.json") {
			found = true
			var payload installer.MergePayload
			if err := json.Unmarshal([]byte(m.Content), &payload); err != nil {
				t.Errorf("MCP merge payload is not valid JSON: %v", err)
			}
			if len(payload.ManagedKeys) == 0 {
				t.Error("MCP merge payload should have managed keys")
			}
			// Managed key should reference the server
			foundBrainKey := false
			for _, k := range payload.ManagedKeys {
				if strings.Contains(k, "brain") {
					foundBrainKey = true
				}
			}
			if !foundBrainKey {
				t.Error("MCP merge payload should have brain managed key")
			}
		}
	}
	if !found {
		t.Error("mcp merge.json not found (merge strategy)")
	}
}

func TestBuildAll_ClaudeCode_Plugin(t *testing.T) {
	root := testProjectRoot(t)
	src := installer.NewFilesystemSource(root)
	brainConfig, err := src.Config()
	if err != nil {
		t.Fatal(err)
	}
	tool := claudeToolConfigFull()

	out, err := installer.BuildAll(src, tool, brainConfig)
	if err != nil {
		t.Fatalf("BuildAll failed: %v", err)
	}

	// Claude Code (marketplace) should generate plugin files
	if len(out.Plugin) == 0 {
		t.Fatal("expected plugin manifest files for marketplace tool")
	}

	foundPlugin := false
	foundMarketplace := false
	for _, p := range out.Plugin {
		if strings.Contains(p.RelativePath, "plugin.json") {
			foundPlugin = true
			if !strings.Contains(p.Content, installer.BrainEmoji) {
				t.Error("plugin.json should contain brain emoji")
			}
		}
		if strings.Contains(p.RelativePath, "marketplace.json") {
			foundMarketplace = true
		}
	}
	if !foundPlugin {
		t.Error("plugin.json not found")
	}
	if !foundMarketplace {
		t.Error("marketplace.json not found")
	}
}

func TestBuildAll_Cursor_NoPlugin(t *testing.T) {
	root := testProjectRoot(t)
	src := installer.NewFilesystemSource(root)
	brainConfig, err := src.Config()
	if err != nil {
		t.Fatal(err)
	}
	tool := cursorToolConfigFull()

	out, err := installer.BuildAll(src, tool, brainConfig)
	if err != nil {
		t.Fatalf("BuildAll failed: %v", err)
	}

	// Cursor (file_list) should NOT generate plugin files
	if len(out.Plugin) != 0 {
		t.Errorf("Cursor should not generate plugin files, got %d", len(out.Plugin))
	}
}

// ---- Agent Frontmatter Tests ------------------------------------------------

func TestBuildAgentFrontmatter_ClaudeCode(t *testing.T) {
	config := &installer.AgentFrontmatter{
		Model:        "claude-sonnet-4-5-20250929",
		Description:  "Test agent",
		Memory:       "edit",
		Color:        "#FF0000",
		ArgumentHint: "hint",
		AllowedTools: []string{"Read", "Write"},
		Skills:       []string{"my-skill"},
	}
	tool := claudeToolConfigFull()

	fm := installer.BuildAgentFrontmatter("test", config, tool)

	if fm["name"] != "test" {
		t.Errorf("expected name=test, got %v", fm["name"])
	}
	if fm["model"] != "claude-sonnet-4-5-20250929" {
		t.Errorf("expected model, got %v", fm["model"])
	}
	if fm["description"] != "Test agent" {
		t.Errorf("expected description, got %v", fm["description"])
	}
	if fm["memory"] != "edit" {
		t.Errorf("expected memory, got %v", fm["memory"])
	}
	if fm["color"] != "#FF0000" {
		t.Errorf("expected color, got %v", fm["color"])
	}
	if fm["argument-hint"] != "hint" {
		t.Errorf("expected argument-hint, got %v", fm["argument-hint"])
	}
	if fm["tools"] == nil {
		t.Error("expected tools field")
	}
	if fm["skills"] == nil {
		t.Error("expected skills field")
	}
}

func TestBuildAgentFrontmatter_Cursor(t *testing.T) {
	config := &installer.AgentFrontmatter{
		Model:        "claude-sonnet-4-5-20250929",
		Description:  "Test agent",
		Memory:       "edit",
		Color:        "#FF0000",
		AllowedTools: []string{"Read", "Write"},
	}
	tool := cursorToolConfigFull()

	fm := installer.BuildAgentFrontmatter("test", config, tool)

	// Cursor only lists "description" in frontmatter config
	if fm["description"] != "Test agent" {
		t.Errorf("expected description, got %v", fm["description"])
	}

	// All other fields should be absent
	for _, key := range []string{"name", "model", "memory", "color", "argument-hint", "tools", "skills"} {
		if _, ok := fm[key]; ok {
			t.Errorf("Cursor frontmatter should not contain %q", key)
		}
	}
}

func TestBuildAgentFrontmatter_EmptyFields(t *testing.T) {
	config := &installer.AgentFrontmatter{
		Description: "Only description",
	}
	tool := claudeToolConfigFull()

	fm := installer.BuildAgentFrontmatter("test", config, tool)

	if fm["name"] != "test" {
		t.Error("name should always be present for Claude")
	}
	if fm["description"] != "Only description" {
		t.Error("description should be present")
	}
	// Empty fields should not be in frontmatter
	if _, ok := fm["model"]; ok {
		t.Error("empty model should not be in frontmatter")
	}
	if _, ok := fm["memory"]; ok {
		t.Error("empty memory should not be in frontmatter")
	}
	if _, ok := fm["tools"]; ok {
		t.Error("empty tools should not be in frontmatter")
	}
}

// ---- Hooks Strategy Tests ---------------------------------------------------

func TestBuildHooks_None(t *testing.T) {
	src := installer.NewFilesystemSource(t.TempDir())
	tool := &installer.ToolConfig{
		Name: "test",
		Hooks: installer.ConfigFileConfig{
			Strategy: "none",
		},
	}
	brainConfig := &installer.Config{}

	hooks, err := installer.BuildHooks(src, tool, brainConfig)
	if err != nil {
		t.Fatal(err)
	}
	if len(hooks) != 0 {
		t.Errorf("none strategy should produce no hooks, got %d", len(hooks))
	}
}

func TestBuildHooks_InvalidStrategy(t *testing.T) {
	src := installer.NewFilesystemSource(t.TempDir())
	tool := &installer.ToolConfig{
		Name: "test",
		Hooks: installer.ConfigFileConfig{
			Strategy: "invalid",
		},
	}
	brainConfig := &installer.Config{}

	_, err := installer.BuildHooks(src, tool, brainConfig)
	if err == nil {
		t.Error("expected error for invalid strategy")
	}
}

// ---- MCP Strategy Tests -----------------------------------------------------

func TestBuildMCP_None(t *testing.T) {
	src := installer.NewFilesystemSource(t.TempDir())
	tool := &installer.ToolConfig{
		Name: "test",
		MCP: installer.ConfigFileConfig{
			Strategy: "none",
		},
	}

	mcp, err := installer.BuildMCP(src, tool)
	if err != nil {
		t.Fatal(err)
	}
	if len(mcp) != 0 {
		t.Errorf("none strategy should produce no mcp, got %d", len(mcp))
	}
}

func TestBuildMCP_InvalidStrategy(t *testing.T) {
	src := installer.NewFilesystemSource(t.TempDir())
	tool := &installer.ToolConfig{
		Name: "test",
		MCP: installer.ConfigFileConfig{
			Strategy: "invalid",
		},
	}

	_, err := installer.BuildMCP(src, tool)
	if err == nil {
		t.Error("expected error for invalid strategy")
	}
}

func TestResolveMCPPaths(t *testing.T) {
	mcpConfig := map[string]any{
		"mcpServers": map[string]any{
			"brain": map[string]any{
				"command": "node",
				"args":    []any{"./packages/mcp/dist/index.js", "--flag"},
			},
		},
	}

	installer.ResolveMCPPaths(mcpConfig, "/home/user/brain")

	servers := mcpConfig["mcpServers"].(map[string]any)
	brain := servers["brain"].(map[string]any)
	args := brain["args"].([]any)

	resolved := args[0].(string)
	if strings.HasPrefix(resolved, "./") {
		t.Error("relative path should be resolved")
	}
	if !strings.Contains(resolved, "packages/mcp/dist/index.js") {
		t.Errorf("resolved path should contain original suffix, got %q", resolved)
	}

	// Non-relative args should be unchanged
	if args[1] != "--flag" {
		t.Errorf("non-relative arg should be unchanged, got %q", args[1])
	}
}

// ---- Plugin Build Tests -----------------------------------------------------

func TestBuildPlugin_Marketplace(t *testing.T) {
	tool := &installer.ToolConfig{
		Manifest: installer.ManifestConfig{Type: "marketplace"},
	}
	files := installer.BuildPlugin(tool)
	if len(files) != 2 {
		t.Fatalf("expected 2 plugin files, got %d", len(files))
	}
}

func TestBuildPlugin_FileList(t *testing.T) {
	tool := &installer.ToolConfig{
		Manifest: installer.ManifestConfig{Type: "file_list"},
	}
	files := installer.BuildPlugin(tool)
	if len(files) != 0 {
		t.Fatalf("expected 0 plugin files for file_list, got %d", len(files))
	}
}

// ---- AllFiles Test ----------------------------------------------------------

func TestBuildOutput_AllFilesWithPlugin(t *testing.T) {
	out := &installer.BuildOutput{
		Agents:   []installer.GeneratedFile{{RelativePath: "a"}},
		Skills:   []installer.GeneratedFile{{RelativePath: "b"}},
		Commands: []installer.GeneratedFile{{RelativePath: "c"}},
		Rules:    []installer.GeneratedFile{{RelativePath: "d"}},
		Hooks:    []installer.GeneratedFile{{RelativePath: "e"}},
		MCP:      []installer.GeneratedFile{{RelativePath: "f"}},
		Plugin:   []installer.GeneratedFile{{RelativePath: "g"}},
	}
	all := out.AllFiles()
	if len(all) != 7 {
		t.Errorf("expected 7 files, got %d", len(all))
	}
}

// ---- Zero Per-Tool Branching Verification -----------------------------------

func TestBuildAll_ZeroBranching(t *testing.T) {
	// Verify that the same BuildAll function works for both tools
	// without any per-tool branching.
	root := testProjectRoot(t)
	src := installer.NewFilesystemSource(root)
	brainConfig, err := src.Config()
	if err != nil {
		t.Fatal(err)
	}

	claudeOut, err := installer.BuildAll(src, claudeToolConfigFull(), brainConfig)
	if err != nil {
		t.Fatalf("Claude BuildAll failed: %v", err)
	}

	cursorOut, err := installer.BuildAll(src, cursorToolConfigFull(), brainConfig)
	if err != nil {
		t.Fatalf("Cursor BuildAll failed: %v", err)
	}

	// Both should produce output (the function works for both)
	if len(claudeOut.AllFiles()) == 0 {
		t.Error("Claude should produce files")
	}
	if len(cursorOut.AllFiles()) == 0 {
		t.Error("Cursor should produce files")
	}

	// Verify the outputs are different (config drives the differences)
	// Claude: no prefix on agents, .md rules, direct hooks, plugin files
	// Cursor: prefix on agents, .mdc rules, merge hooks, no plugin files
	if len(claudeOut.Plugin) == len(cursorOut.Plugin) {
		t.Error("Claude should have plugin files, Cursor should not")
	}
}

// ---- MCP Merge Output Path Test ---------------------------------------------

func TestBuildMCPMerge_OutputPath(t *testing.T) {
	root := t.TempDir()
	templatesDir := filepath.Join(root, "templates", installer.ConfigsDir)
	os.MkdirAll(templatesDir, 0755)

	mcpConfig := map[string]any{
		"mcpServers": map[string]any{
			"brain": map[string]any{"command": "node"},
		},
	}
	data, _ := json.Marshal(mcpConfig)
	writeTestFile(t, filepath.Join(templatesDir, "mcp.json"), string(data))

	src := installer.NewFilesystemSource(root)
	tool := &installer.ToolConfig{
		Name: "cursor",
		MCP: installer.ConfigFileConfig{
			Strategy: "merge",
			Target:   "mcp.json",
		},
	}

	files, err := installer.BuildMCPMerge(src, tool)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}
	// Target is "mcp.json" -> merge file should be "mcp.merge.json"
	if files[0].RelativePath != "mcp.merge.json" {
		t.Errorf("expected mcp.merge.json, got %q", files[0].RelativePath)
	}
}

func TestBuildHooksMerge_OutputPath(t *testing.T) {
	root := t.TempDir()
	hooksDir := filepath.Join(root, "templates", installer.HooksDir)
	os.MkdirAll(hooksDir, 0755)

	writeTestFile(t, filepath.Join(hooksDir, "test-tool.json"), `{"hooks": {"save": []}}`)

	src := installer.NewFilesystemSource(root)
	tool := &installer.ToolConfig{
		Name: "test-tool",
		Hooks: installer.ConfigFileConfig{
			Strategy: "merge",
			Target:   "hooks.json",
		},
	}

	files, err := installer.BuildHooksMerge(src, tool)
	if err != nil {
		t.Fatal(err)
	}
	// Find the merge file (may also have scripts)
	foundMerge := false
	for _, f := range files {
		if f.RelativePath == "hooks.merge.json" {
			foundMerge = true
		}
	}
	if !foundMerge {
		t.Error("expected hooks.merge.json output")
	}
}
