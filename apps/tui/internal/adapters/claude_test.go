package adapters

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// ─── TransformClaudeAgent ────────────────────────────────────────────────────

func TestTransformClaudeAgent_NilConfig(t *testing.T) {
	agent := CanonicalAgent{
		Name: "orchestrator-cursor",
		Body: "# Cursor Orchestrator",
	}
	got := TransformClaudeAgent(agent, nil)
	if got != nil {
		t.Errorf("expected nil for nil config, got %+v", got)
	}
}

func TestTransformClaudeAgent_WithConfig(t *testing.T) {
	agent := CanonicalAgent{
		Name: "architect",
		Body: "# Architect Agent\n\nYou are a software architect.",
	}

	config := &AgentPlatformConfig{
		Model:        "opus",
		AllowedTools: []string{"Read", "Grep", "Glob"},
		Color:        "#7B68EE",
		Skills:       []string{"memory", "adr-creation"},
	}

	got := TransformClaudeAgent(agent, config)
	if got == nil {
		t.Fatal("expected non-nil result")
	}

	if got.RelativePath != "agents/\U0001F9E0-architect.md" {
		t.Errorf("relativePath = %q, want agents/\U0001F9E0-architect.md", got.RelativePath)
	}

	checks := []string{
		"name: \U0001F9E0-architect",
		"model: opus",
		`color: "#7B68EE"`,
		"  - Read",
		"  - Grep",
		"  - memory",
		"# Architect Agent",
		"You are a software architect.",
	}
	for _, want := range checks {
		if !strings.Contains(got.Content, want) {
			t.Errorf("content missing %q", want)
		}
	}
}

func TestTransformClaudeAgent_DescriptionAndArgumentHint(t *testing.T) {
	agent := CanonicalAgent{
		Name: "analyst",
		Body: "# Analyst",
	}

	config := &AgentPlatformConfig{
		Model:        "sonnet",
		Description:  "Technical investigator",
		ArgumentHint: "Describe what to investigate",
	}

	got := TransformClaudeAgent(agent, config)
	if got == nil {
		t.Fatal("expected non-nil result")
	}

	if !strings.Contains(got.Content, "description: Technical investigator") {
		t.Error("content missing description")
	}
	if !strings.Contains(got.Content, "argument-hint: Describe what to investigate") {
		t.Error("content missing argument-hint")
	}
}

// ─── TransformClaudeCode (integration) ───────────────────────────────────────

func setupTestProject(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()

	// Create directory structure
	for _, d := range []string{
		"templates/agents",
		"templates/skills/memory",
		"templates/commands",
		"templates/protocols",
		"templates/hooks/scripts",
	} {
		if err := os.MkdirAll(filepath.Join(dir, d), 0755); err != nil {
			t.Fatal(err)
		}
	}

	return dir
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
}

func TestTransformClaudeCode_MinimalProject(t *testing.T) {
	dir := setupTestProject(t)

	// Create canonical agent
	writeFile(t, filepath.Join(dir, "templates", "agents", "architect.md"),
		"# Architect Agent\n\nYou design systems.")

	// Create command
	writeFile(t, filepath.Join(dir, "templates", "commands", "start-session.md"),
		"Start a new session.")

	// Create protocol
	writeFile(t, filepath.Join(dir, "templates", "protocols", "memory-architecture.md"),
		"# Memory Architecture\n\nRules for memory.")

	// Create skill file
	writeFile(t, filepath.Join(dir, "templates", "skills", "memory", "SKILL.md"),
		"# Memory Skill\n\nInstructions.")

	// Create mcp.json
	mcpJSON, _ := json.Marshal(map[string]any{
		"mcpServers": map[string]any{
			"brain": map[string]any{
				"command": "bun",
				"args":    []string{"run", "./apps/mcp/src/index.ts"},
				"env":     map[string]string{"BRAIN_TRANSPORT": "stdio"},
			},
		},
	})
	writeFile(t, filepath.Join(dir, "templates", "mcp.json"), string(mcpJSON))

	// Create hook source file
	writeFile(t, filepath.Join(dir, "templates", "hooks", "claude-code.json"), `{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bun run hooks/scripts/stop.ts",
            "timeout": 10
          }
        ]
      }
    ]
  }
}`)

	// Create brain.config.json
	config := &BrainConfig{
		Targets: map[string]json.RawMessage{
			"claude-code": json.RawMessage(`{}`),
		},
		Agents: map[string]AgentToolConfig{
			"architect": {
				"claude-code": json.RawMessage(`{
					"model": "opus",
					"tools": ["Read", "Grep"],
					"color": "#7B68EE"
				}`),
			},
		},
		Hooks: map[string]json.RawMessage{
			"claude-code": json.RawMessage(`{
				"source": "hooks/claude-code.json",
				"scripts": "hooks/scripts/"
			}`),
		},
	}

	output, err := TransformClaudeCode(dir, config)
	if err != nil {
		t.Fatalf("TransformClaudeCode error: %v", err)
	}

	// Agents
	if len(output.Agents) != 1 {
		t.Fatalf("expected 1 agent, got %d", len(output.Agents))
	}
	if output.Agents[0].RelativePath != "agents/\U0001F9E0-architect.md" {
		t.Errorf("agent path = %q", output.Agents[0].RelativePath)
	}
	if !strings.Contains(output.Agents[0].Content, "model: opus") {
		t.Error("agent content missing model")
	}

	// Skills
	if len(output.Skills) != 1 {
		t.Fatalf("expected 1 skill, got %d", len(output.Skills))
	}
	if output.Skills[0].RelativePath != "skills/\U0001F9E0-memory/SKILL.md" {
		t.Errorf("skill path = %q", output.Skills[0].RelativePath)
	}

	// Commands
	if len(output.Commands) != 1 {
		t.Fatalf("expected 1 command, got %d", len(output.Commands))
	}
	if output.Commands[0].RelativePath != "commands/\U0001F9E0-start-session.md" {
		t.Errorf("command path = %q", output.Commands[0].RelativePath)
	}

	// Rules (from protocols)
	if len(output.Rules) != 1 {
		t.Fatalf("expected 1 rule, got %d", len(output.Rules))
	}
	if output.Rules[0].RelativePath != "rules/\U0001F9E0-memory-architecture.md" {
		t.Errorf("rule path = %q", output.Rules[0].RelativePath)
	}

	// Hooks
	var hooksFile *GeneratedFile
	for i := range output.Hooks {
		if output.Hooks[i].RelativePath == "hooks/hooks.json" {
			hooksFile = &output.Hooks[i]
			break
		}
	}
	if hooksFile == nil {
		t.Fatal("expected hooks/hooks.json in output")
	}
	var parsed map[string]any
	if err := json.Unmarshal([]byte(hooksFile.Content), &parsed); err != nil {
		t.Fatalf("hooks.json parse error: %v", err)
	}
	hooks, ok := parsed["hooks"].(map[string]any)
	if !ok {
		t.Fatal("expected hooks key in hooks.json")
	}
	if _, ok := hooks["Stop"]; !ok {
		t.Error("expected Stop event in hooks.json")
	}

	// MCP
	if len(output.MCP) != 1 {
		t.Fatalf("expected 1 mcp file, got %d", len(output.MCP))
	}
	if output.MCP[0].RelativePath != ".mcp.json" {
		t.Errorf("mcp path = %q", output.MCP[0].RelativePath)
	}
	var mcpParsed map[string]any
	if err := json.Unmarshal([]byte(output.MCP[0].Content), &mcpParsed); err != nil {
		t.Fatalf("mcp.json parse error: %v", err)
	}
	servers := mcpParsed["mcpServers"].(map[string]any)
	brain := servers["brain"].(map[string]any)
	args := brain["args"].([]any)
	// ./apps/mcp/src/index.ts should be resolved to absolute path
	resolvedArg := args[1].(string)
	if !strings.HasPrefix(resolvedArg, dir) {
		t.Errorf("expected resolved path starting with %s, got %s", dir, resolvedArg)
	}
	if !strings.HasSuffix(resolvedArg, "apps/mcp/src/index.ts") {
		t.Errorf("expected path ending with apps/mcp/src/index.ts, got %s", resolvedArg)
	}

	// Plugin manifest
	if len(output.Plugin) != 1 {
		t.Fatalf("expected 1 plugin file, got %d", len(output.Plugin))
	}
	if output.Plugin[0].RelativePath != ".claude-plugin/plugin.json" {
		t.Errorf("plugin path = %q", output.Plugin[0].RelativePath)
	}
}

func TestTransformClaudeCode_SkipsNullConfig(t *testing.T) {
	dir := setupTestProject(t)

	writeFile(t, filepath.Join(dir, "templates", "agents", "orchestrator-cursor.md"),
		"# Cursor Orchestrator")

	config := &BrainConfig{
		Targets: map[string]json.RawMessage{
			"claude-code": json.RawMessage(`{}`),
			"cursor":      json.RawMessage(`{}`),
		},
		Agents: map[string]AgentToolConfig{
			"orchestrator-cursor": {
				"claude-code": json.RawMessage(`null`),
				"cursor":      json.RawMessage(`{"description": "Cursor orchestrator"}`),
			},
		},
	}

	output, err := TransformClaudeCode(dir, config)
	if err != nil {
		t.Fatalf("TransformClaudeCode error: %v", err)
	}

	if len(output.Agents) != 0 {
		t.Errorf("expected 0 agents, got %d", len(output.Agents))
	}
}

func TestTransformClaudeCode_SkipsUnlistedAgent(t *testing.T) {
	dir := setupTestProject(t)

	writeFile(t, filepath.Join(dir, "templates", "agents", "unlisted.md"),
		"# Unlisted Agent")

	config := &BrainConfig{
		Targets: map[string]json.RawMessage{
			"claude-code": json.RawMessage(`{}`),
		},
		Agents: map[string]AgentToolConfig{},
	}

	output, err := TransformClaudeCode(dir, config)
	if err != nil {
		t.Fatalf("TransformClaudeCode error: %v", err)
	}

	if len(output.Agents) != 0 {
		t.Errorf("expected 0 agents, got %d", len(output.Agents))
	}
}

func TestTransformClaudeCode_MissingDirsNoError(t *testing.T) {
	// Empty temp dir with no subdirectories at all
	dir := t.TempDir()

	config := &BrainConfig{
		Agents: map[string]AgentToolConfig{},
	}

	output, err := TransformClaudeCode(dir, config)
	if err != nil {
		t.Fatalf("TransformClaudeCode error: %v", err)
	}

	if len(output.AllFiles()) != 1 {
		// Only the plugin manifest should be generated
		t.Errorf("expected 1 file (plugin manifest), got %d", len(output.AllFiles()))
	}
}

func TestTransformClaudeMCP_NoMCPFile(t *testing.T) {
	dir := t.TempDir()

	result, err := TransformClaudeMCP(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("expected 0 files, got %d", len(result))
	}
}

func TestTransformSkills_NestedFiles(t *testing.T) {
	dir := t.TempDir()

	// Create skill with nested subdirectory
	skillDir := filepath.Join(dir, "memory", "scripts")
	if err := os.MkdirAll(skillDir, 0755); err != nil {
		t.Fatal(err)
	}
	writeFile(t, filepath.Join(dir, "memory", "SKILL.md"), "# Memory")
	writeFile(t, filepath.Join(dir, "memory", "scripts", "extract.ps1"), "Write-Host ok")

	results, err := TransformSkills(dir)
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	if len(results) != 2 {
		t.Fatalf("expected 2 files, got %d", len(results))
	}

	// Check both files have brain prefix on the skill directory
	for _, f := range results {
		if !strings.HasPrefix(f.RelativePath, "skills/\U0001F9E0-memory/") {
			t.Errorf("expected brain prefix on skill dir, got %q", f.RelativePath)
		}
	}
}

func TestTransformCommands_AlreadyPrefixed(t *testing.T) {
	dir := t.TempDir()

	writeFile(t, filepath.Join(dir, "\U0001F9E0-bootstrap.md"), "Bootstrap command")

	results, err := TransformCommands(dir, "claude-code")
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 file, got %d", len(results))
	}

	// Should not double-prefix
	if results[0].RelativePath != "commands/\U0001F9E0-bootstrap.md" {
		t.Errorf("path = %q, expected no double prefix", results[0].RelativePath)
	}
}

func TestGenerateClaudePluginManifest(t *testing.T) {
	files := GenerateClaudePluginManifest()
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}

	var manifest map[string]any
	if err := json.Unmarshal([]byte(files[0].Content), &manifest); err != nil {
		t.Fatalf("parse error: %v", err)
	}

	if manifest["name"] != "\U0001F9E0" {
		t.Errorf("name = %q, want brain emoji", manifest["name"])
	}
	if manifest["description"] != "Brain knowledge graph + workflow mode management" {
		t.Errorf("unexpected description: %v", manifest["description"])
	}
}

func TestClaudeCodeOutput_AllFiles(t *testing.T) {
	output := ClaudeCodeOutput{
		Agents:   []GeneratedFile{{RelativePath: "a"}},
		Skills:   []GeneratedFile{{RelativePath: "b"}},
		Commands: []GeneratedFile{{RelativePath: "c"}},
		Rules:    []GeneratedFile{{RelativePath: "d"}},
		Hooks:    []GeneratedFile{{RelativePath: "e"}},
		MCP:      []GeneratedFile{{RelativePath: "f"}},
		Plugin:   []GeneratedFile{{RelativePath: "g"}},
	}

	all := output.AllFiles()
	if len(all) != 7 {
		t.Errorf("expected 7 files, got %d", len(all))
	}
}
