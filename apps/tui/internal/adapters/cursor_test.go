package adapters

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// ─── CursorTransformAgent ───────────────────────────────────────────────────

func TestCursorTransformAgent_NilConfig(t *testing.T) {
	agent := CanonicalAgent{Name: "test", Body: "# Test Agent\n\nBody here."}
	result := CursorTransformAgent(agent, nil)
	if result != nil {
		t.Fatal("expected nil for nil config")
	}
}

func TestCursorTransformAgent_DescriptionOnly(t *testing.T) {
	agent := CanonicalAgent{
		Name: "analyst",
		Body: "# Analyst\n\nResearch specialist.",
	}
	config := &AgentPlatformConfig{
		Description: "Research and investigation specialist",
	}

	result := CursorTransformAgent(agent, config)
	if result == nil {
		t.Fatal("expected non-nil result")
	}

	// Check path uses .mdc extension and brain prefix
	expectedPath := "rules/\U0001F9E0-analyst.mdc"
	if result.RelativePath != expectedPath {
		t.Errorf("path = %q, want %q", result.RelativePath, expectedPath)
	}

	// Check content has frontmatter with description
	if !strings.Contains(result.Content, "description: Research and investigation specialist") {
		t.Error("content missing description in frontmatter")
	}

	// Check body is preserved
	if !strings.Contains(result.Content, "# Analyst") {
		t.Error("content missing agent body")
	}
}

func TestCursorTransformAgent_EmptyDescription(t *testing.T) {
	agent := CanonicalAgent{
		Name: "minimal",
		Body: "Body only.",
	}
	config := &AgentPlatformConfig{}

	result := CursorTransformAgent(agent, config)
	if result == nil {
		t.Fatal("expected non-nil result")
	}

	// With no description, frontmatter should be empty and body returned as-is
	if strings.Contains(result.Content, "---") {
		t.Error("should not have frontmatter when no fields are set")
	}
	if !strings.Contains(result.Content, "Body only.") {
		t.Error("body should be preserved")
	}
}

func TestCursorTransformAgent_IgnoresNonCursorFields(t *testing.T) {
	agent := CanonicalAgent{
		Name: "implementer",
		Body: "# Implementer",
	}
	config := &AgentPlatformConfig{
		Model:        "claude-opus-4-6",
		Description:  "Production code specialist",
		AllowedTools: []string{"Read", "Write", "Bash"},
		Memory:       "/tmp/memory",
		Color:        "#ff0000",
	}

	result := CursorTransformAgent(agent, config)
	if result == nil {
		t.Fatal("expected non-nil result")
	}

	// Only description should appear in Cursor output
	if !strings.Contains(result.Content, "description: Production code specialist") {
		t.Error("missing description")
	}

	// Claude Code fields should NOT appear
	for _, field := range []string{"model:", "tools:", "memory:", "color:"} {
		if strings.Contains(result.Content, field) {
			t.Errorf("Cursor output should not contain %q", field)
		}
	}
}

// ─── CursorTransformAgents ──────────────────────────────────────────────────

func TestCursorTransformAgents_IntegrationWithConfig(t *testing.T) {
	// Set up temp directory with agent files
	tmpDir := t.TempDir()
	agentsDir := filepath.Join(tmpDir, "templates", "agents")
	os.MkdirAll(agentsDir, 0o755)

	// Write test agent
	os.WriteFile(filepath.Join(agentsDir, "analyst.md"), []byte(`---
name: analyst
---

# Analyst Agent

Research specialist.
`), 0o644)

	// Write agent that should be excluded from Cursor
	os.WriteFile(filepath.Join(agentsDir, "claude-only.md"), []byte(`# Claude Only

Only for Claude Code.
`), 0o644)

	// Build brain config
	config := &BrainConfig{
		Agents: map[string]AgentToolConfig{
			"analyst": {
				"cursor": json.RawMessage(`{"description": "Investigation specialist"}`),
			},
			"claude-only": {
				"cursor": json.RawMessage(`null`),
			},
		},
	}

	results, err := CursorTransformAgents(agentsDir, config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should only have analyst (claude-only is null)
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	if !strings.Contains(results[0].RelativePath, "analyst") {
		t.Errorf("expected analyst in path, got %q", results[0].RelativePath)
	}
}

// ─── CursorTransformProtocols ───────────────────────────────────────────────

func TestCursorTransformProtocols(t *testing.T) {
	tmpDir := t.TempDir()

	os.WriteFile(filepath.Join(tmpDir, "session-protocol.md"), []byte("# Session Protocol\n\nRules here."), 0o644)
	os.WriteFile(filepath.Join(tmpDir, "agent-system.md"), []byte("# Agent System\n\nMore rules."), 0o644)
	os.WriteFile(filepath.Join(tmpDir, ".gitkeep"), []byte(""), 0o644)

	results, err := CursorTransformProtocols(tmpDir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}

	// Check all use .mdc extension and brain prefix
	for _, r := range results {
		if !strings.HasSuffix(r.RelativePath, ".mdc") {
			t.Errorf("expected .mdc extension, got %q", r.RelativePath)
		}
		if !strings.Contains(r.RelativePath, "\U0001F9E0-") {
			t.Errorf("expected brain prefix, got %q", r.RelativePath)
		}
		if !strings.HasPrefix(r.RelativePath, "rules/") {
			t.Errorf("expected rules/ prefix, got %q", r.RelativePath)
		}
	}
}

func TestCursorTransformProtocols_MissingDir(t *testing.T) {
	results, err := CursorTransformProtocols("/nonexistent/dir")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if results != nil {
		t.Errorf("expected nil results for missing dir, got %d", len(results))
	}
}

// ─── CursorTransformHooks ───────────────────────────────────────────────────

func TestCursorTransformHooks_NoHooks(t *testing.T) {
	config := &BrainConfig{}
	results, err := CursorTransformHooks(t.TempDir(), config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected 0 results, got %d", len(results))
	}
}

func TestCursorTransformHooks_WithCursorHook(t *testing.T) {
	tmpDir := t.TempDir()
	scriptsDir := filepath.Join(tmpDir, "scripts")
	os.MkdirAll(scriptsDir, 0o755)
	os.WriteFile(filepath.Join(scriptsDir, "lint.js"), []byte("console.log('lint');"), 0o644)

	config := &BrainConfig{
		Hooks: map[string]json.RawMessage{
			"lint": json.RawMessage(`{
				"cursor": {
					"event": "afterSave",
					"matcher": "*.ts",
					"timeout": 5
				}
			}`),
		},
	}

	results, err := CursorTransformHooks(tmpDir, config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should have merge JSON + script
	if len(results) < 1 {
		t.Fatalf("expected at least 1 result, got %d", len(results))
	}

	// Check merge payload
	var foundMerge bool
	for _, r := range results {
		if r.RelativePath == "hooks/hooks.merge.json" {
			foundMerge = true

			var payload JsonMergePayload
			if err := json.Unmarshal([]byte(r.Content), &payload); err != nil {
				t.Fatalf("invalid merge JSON: %v", err)
			}

			if len(payload.ManagedKeys) == 0 {
				t.Error("expected managedKeys")
			}

			if _, ok := payload.Content["hooks"]; !ok {
				t.Error("expected hooks key in content")
			}
		}
	}

	if !foundMerge {
		t.Error("missing hooks.merge.json")
	}
}

func TestCursorTransformHooks_SkipsNonCursor(t *testing.T) {
	config := &BrainConfig{
		Hooks: map[string]json.RawMessage{
			"claude-only-hook": json.RawMessage(`{
				"claude-code": {
					"event": "beforeSave"
				}
			}`),
		},
	}

	results, err := CursorTransformHooks(t.TempDir(), config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(results) != 0 {
		t.Errorf("expected 0 results for non-cursor hook, got %d", len(results))
	}
}

// ─── CursorTransformMCP ────────────────────────────────────────────────────

func TestCursorTransformMCP_NoFile(t *testing.T) {
	results, err := CursorTransformMCP(t.TempDir())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if results != nil {
		t.Errorf("expected nil results, got %d", len(results))
	}
}

func TestCursorTransformMCP_ValidConfig(t *testing.T) {
	tmpDir := t.TempDir()

	mcpJSON := `{
		"mcpServers": {
			"brain": {
				"command": "node",
				"args": ["./dist/server.js", "--port", "3000"]
			}
		}
	}`
	os.MkdirAll(filepath.Join(tmpDir, "templates"), 0o755)
	os.WriteFile(filepath.Join(tmpDir, "templates", "mcp.json"), []byte(mcpJSON), 0o644)

	results, err := CursorTransformMCP(tmpDir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	if results[0].RelativePath != "mcp/mcp.merge.json" {
		t.Errorf("path = %q, want mcp/mcp.merge.json", results[0].RelativePath)
	}

	// Verify payload structure
	var payload JsonMergePayload
	if err := json.Unmarshal([]byte(results[0].Content), &payload); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	if len(payload.ManagedKeys) != 1 || payload.ManagedKeys[0] != "mcpServers.brain" {
		t.Errorf("managedKeys = %v, want [mcpServers.brain]", payload.ManagedKeys)
	}

	// Verify relative path was resolved to absolute
	servers := payload.Content["mcpServers"].(map[string]any)
	brain := servers["brain"].(map[string]any)
	args := brain["args"].([]any)
	firstArg := args[0].(string)
	if strings.HasPrefix(firstArg, "./") {
		t.Error("relative path should have been resolved to absolute")
	}
	if !strings.Contains(firstArg, tmpDir) {
		t.Errorf("resolved path should contain tmpDir, got %q", firstArg)
	}
}

func TestCursorTransformMCP_InvalidJSON(t *testing.T) {
	tmpDir := t.TempDir()
	os.WriteFile(filepath.Join(tmpDir, "templates", "mcp.json"), []byte("not json"), 0o644)

	results, err := CursorTransformMCP(tmpDir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if results != nil {
		t.Errorf("expected nil for invalid JSON, got %d results", len(results))
	}
}

// ─── CursorTransform (integration) ─────────────────────────────────────────

func TestCursorTransform_FullIntegration(t *testing.T) {
	tmpDir := t.TempDir()

	// Set up directory structure
	agentsDir := filepath.Join(tmpDir, "templates", "agents")
	protocolsDir := filepath.Join(tmpDir, "templates", "protocols")
	hooksDir := filepath.Join(tmpDir, "templates", "hooks")
	os.MkdirAll(agentsDir, 0o755)
	os.MkdirAll(protocolsDir, 0o755)
	os.MkdirAll(hooksDir, 0o755)

	// Write agent
	os.WriteFile(filepath.Join(agentsDir, "architect.md"), []byte("# Architect\n\nDesign governance."), 0o644)

	// Write protocol
	os.WriteFile(filepath.Join(protocolsDir, "session.md"), []byte("# Session Protocol\n\nRules."), 0o644)

	// Write brain.config.json
	brainConfigJSON := `{
		"version": "1.0.0",
		"targets": {},
		"agents": {
			"architect": {
				"cursor": {"description": "System designer"}
			}
		}
	}`
	os.WriteFile(filepath.Join(tmpDir, "templates", "brain.config.json"), []byte(brainConfigJSON), 0o644)

	config := &BrainConfig{
		Agents: map[string]AgentToolConfig{
			"architect": {
				"cursor": json.RawMessage(`{"description": "System designer"}`),
			},
		},
	}

	output, err := CursorTransform(tmpDir, config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(output.Agents) != 1 {
		t.Errorf("expected 1 agent, got %d", len(output.Agents))
	}

	if len(output.Rules) != 1 {
		t.Errorf("expected 1 rule, got %d", len(output.Rules))
	}

	// Verify agent output
	if len(output.Agents) > 0 {
		agent := output.Agents[0]
		if !strings.HasSuffix(agent.RelativePath, ".mdc") {
			t.Errorf("agent should use .mdc extension, got %q", agent.RelativePath)
		}
		if !strings.Contains(agent.Content, "System designer") {
			t.Error("agent content should contain description")
		}
	}

	// Verify protocol output
	if len(output.Rules) > 0 {
		rule := output.Rules[0]
		if !strings.HasSuffix(rule.RelativePath, ".mdc") {
			t.Errorf("rule should use .mdc extension, got %q", rule.RelativePath)
		}
	}
}

// ─── Shared Helpers ─────────────────────────────────────────────────────────

func TestBrainPrefix(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"architect", "\U0001F9E0-architect"},
		{"\U0001F9E0-analyst", "\U0001F9E0-analyst"}, // already prefixed
		{"my-agent", "\U0001F9E0-my-agent"},
	}

	for _, tt := range tests {
		got := BrainPrefix(tt.input)
		if got != tt.want {
			t.Errorf("BrainPrefix(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestParseFrontmatter(t *testing.T) {
	raw := "---\nname: test\ndescription: A test agent\n---\n\n# Test\n\nBody here."

	fm, body := ParseFrontmatter(raw)

	if fm["name"] != "test" {
		t.Errorf("name = %v, want test", fm["name"])
	}
	if fm["description"] != "A test agent" {
		t.Errorf("description = %v, want 'A test agent'", fm["description"])
	}
	if !strings.Contains(body, "# Test") {
		t.Error("body should contain # Test")
	}
}

func TestParseFrontmatter_None(t *testing.T) {
	raw := "# No Frontmatter\n\nJust body."
	fm, body := ParseFrontmatter(raw)

	if len(fm) != 0 {
		t.Errorf("expected empty frontmatter, got %v", fm)
	}
	if body != raw {
		t.Error("body should equal raw input when no frontmatter")
	}
}

func TestWithFrontmatter(t *testing.T) {
	fm := map[string]any{
		"description": "Test agent",
	}
	body := "# Agent\n\nBody."

	result := WithFrontmatter(fm, body)

	if !strings.HasPrefix(result, "---\n") {
		t.Error("should start with ---")
	}
	if !strings.Contains(result, "description: Test agent") {
		t.Error("should contain frontmatter")
	}
	if !strings.Contains(result, "# Agent") {
		t.Error("should contain body")
	}
}

func TestWithFrontmatter_Empty(t *testing.T) {
	fm := map[string]any{}
	body := "Just body."

	result := WithFrontmatter(fm, body)
	if result != "Just body." {
		t.Errorf("empty frontmatter should return body as-is, got %q", result)
	}
}

func TestParseSimpleYAML_InlineArray(t *testing.T) {
	yaml := "tools: [Read, Write, Bash]"
	result := ParseSimpleYAML(yaml)

	tools, ok := result["tools"].([]any)
	if !ok {
		t.Fatalf("tools should be []any, got %T", result["tools"])
	}
	if len(tools) != 3 {
		t.Fatalf("expected 3 tools, got %d", len(tools))
	}
	if tools[0] != "Read" {
		t.Errorf("first tool = %v, want Read", tools[0])
	}
}

func TestParseSimpleYAML_BlockArray(t *testing.T) {
	yaml := "skills:\n  - memory\n  - analysis\n  - research"
	result := ParseSimpleYAML(yaml)

	skills, ok := result["skills"].([]any)
	if !ok {
		t.Fatalf("skills should be []any, got %T", result["skills"])
	}
	if len(skills) != 3 {
		t.Fatalf("expected 3 skills, got %d", len(skills))
	}
}

func TestParseSimpleYAML_Boolean(t *testing.T) {
	yaml := "enabled: true\ndisabled: false"
	result := ParseSimpleYAML(yaml)

	if result["enabled"] != true {
		t.Errorf("enabled = %v, want true", result["enabled"])
	}
	if result["disabled"] != false {
		t.Errorf("disabled = %v, want false", result["disabled"])
	}
}

func TestParseSimpleYAML_QuotedString(t *testing.T) {
	yaml := `title: "My Agent: The Best"`
	result := ParseSimpleYAML(yaml)

	if result["title"] != "My Agent: The Best" {
		t.Errorf("title = %v, want 'My Agent: The Best'", result["title"])
	}
}

func TestParseSimpleYAML_Null(t *testing.T) {
	yaml := "value: null\nother: ~"
	result := ParseSimpleYAML(yaml)

	if result["value"] != nil {
		t.Errorf("value should be nil, got %v", result["value"])
	}
	if result["other"] != nil {
		t.Errorf("other should be nil, got %v", result["other"])
	}
}
