package adapters

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// ─── parseOrderYAML ─────────────────────────────────────────────────────────

func TestParseOrderYAML_Basic(t *testing.T) {
	input := `# Comment
sections:
  - sections/010-header.md
  - sections/020-identity.md
`
	got := parseOrderYAML(input)
	want := []string{"sections/010-header.md", "sections/020-identity.md"}

	if len(got) != len(want) {
		t.Fatalf("len = %d, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("got[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestParseOrderYAML_QuotedEntries(t *testing.T) {
	input := `sections:
  - sections/010-header.md
  - "{tool}/040-memory-delegation.md"
  - '{tool}/050-execution-model.md'
`
	got := parseOrderYAML(input)
	want := []string{
		"sections/010-header.md",
		"{tool}/040-memory-delegation.md",
		"{tool}/050-execution-model.md",
	}

	if len(got) != len(want) {
		t.Fatalf("len = %d, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("got[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestParseOrderYAML_Empty(t *testing.T) {
	got := parseOrderYAML("")
	if len(got) != 0 {
		t.Errorf("expected empty, got %d entries", len(got))
	}
}

func TestParseOrderYAML_CommentsAndBlanks(t *testing.T) {
	input := `# Top comment
sections:

  # Sub-comment
  - sections/one.md

  - sections/two.md
`
	got := parseOrderYAML(input)
	if len(got) != 2 {
		t.Fatalf("expected 2 entries, got %d: %v", len(got), got)
	}
}

// ─── parseVariablesYAML ─────────────────────────────────────────────────────

func TestParseVariablesYAML_TwoVariants(t *testing.T) {
	input := `claude-code:
  worker: "teammate"
  workers: "teammates"

cursor:
  worker: "agent"
  workers: "agents"
`
	got := parseVariablesYAML(input)

	if got["claude-code"]["worker"] != "teammate" {
		t.Errorf("claude-code.worker = %q, want teammate", got["claude-code"]["worker"])
	}
	if got["claude-code"]["workers"] != "teammates" {
		t.Errorf("claude-code.workers = %q, want teammates", got["claude-code"]["workers"])
	}
	if got["cursor"]["worker"] != "agent" {
		t.Errorf("cursor.worker = %q, want agent", got["cursor"]["worker"])
	}
	if got["cursor"]["workers"] != "agents" {
		t.Errorf("cursor.workers = %q, want agents", got["cursor"]["workers"])
	}
}

func TestParseVariablesYAML_UnquotedValues(t *testing.T) {
	input := `variant:
  key: value
`
	got := parseVariablesYAML(input)
	if got["variant"]["key"] != "value" {
		t.Errorf("variant.key = %q, want value", got["variant"]["key"])
	}
}

func TestParseVariablesYAML_Empty(t *testing.T) {
	got := parseVariablesYAML("")
	if len(got) != 0 {
		t.Errorf("expected empty, got %d variants", len(got))
	}
}

// ─── substituteVariables ────────────────────────────────────────────────────

func TestSubstituteVariables_Basic(t *testing.T) {
	content := "You are the {role_title}. Spawn {workers} to do work."
	vars := map[string]string{
		"role_title": "Team Lead",
		"workers":    "teammates",
	}
	got := substituteVariables(content, vars)
	want := "You are the Team Lead. Spawn teammates to do work."
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestSubstituteVariables_NoMatch(t *testing.T) {
	content := "No placeholders here."
	vars := map[string]string{"key": "value"}
	got := substituteVariables(content, vars)
	if got != content {
		t.Errorf("content was modified: %q", got)
	}
}

func TestSubstituteVariables_EmptyVars(t *testing.T) {
	content := "Keep {this} as is."
	got := substituteVariables(content, nil)
	if got != content {
		t.Errorf("content was modified: %q", got)
	}
}

func TestSubstituteVariables_MultipleOccurrences(t *testing.T) {
	content := "{w} and {w} and {w}"
	vars := map[string]string{"w": "x"}
	got := substituteVariables(content, vars)
	if got != "x and x and x" {
		t.Errorf("got %q", got)
	}
}

// ─── IsComposableDir ────────────────────────────────────────────────────────

func TestIsComposableDir_WithOrderYaml(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "_order.yaml"), "sections:\n  - sections/a.md\n")

	if !IsComposableDir(dir) {
		t.Error("expected true for dir with _order.yaml")
	}
}

func TestIsComposableDir_WithoutOrderYaml(t *testing.T) {
	dir := t.TempDir()
	if IsComposableDir(dir) {
		t.Error("expected false for dir without _order.yaml")
	}
}

// ─── ReadComposableDir ──────────────────────────────────────────────────────

func TestReadComposableDir_NonComposable(t *testing.T) {
	dir := t.TempDir()
	cd, err := ReadComposableDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if cd != nil {
		t.Error("expected nil for non-composable dir")
	}
}

func TestReadComposableDir_WithFiles(t *testing.T) {
	dir := t.TempDir()

	writeFile(t, filepath.Join(dir, "_order.yaml"), `sections:
  - sections/a.md
  - "{tool}/b.md"
`)
	writeFile(t, filepath.Join(dir, "_variables.yaml"), `v1:
  key: val1
v2:
  key: val2
`)

	cd, err := ReadComposableDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if cd == nil {
		t.Fatal("expected non-nil ComposableDir")
	}

	if len(cd.Order) != 2 {
		t.Errorf("order len = %d, want 2", len(cd.Order))
	}
	if cd.Variables["v1"]["key"] != "val1" {
		t.Errorf("v1.key = %q", cd.Variables["v1"]["key"])
	}
	if cd.Variables["v2"]["key"] != "val2" {
		t.Errorf("v2.key = %q", cd.Variables["v2"]["key"])
	}
}

// ─── ComposeFromDir ─────────────────────────────────────────────────────────

func setupComposableDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()

	// Create directory structure
	for _, d := range []string{"sections", "claude-code", "cursor"} {
		if err := os.MkdirAll(filepath.Join(dir, d), 0755); err != nil {
			t.Fatal(err)
		}
	}

	// _order.yaml
	writeFile(t, filepath.Join(dir, "_order.yaml"), `sections:
  - sections/010-header.md
  - "{tool}/020-identity.md"
  - sections/030-shared.md
`)

	// _variables.yaml
	writeFile(t, filepath.Join(dir, "_variables.yaml"), `claude-code:
  worker: "teammate"
  tool_name: "Claude Code"

cursor:
  worker: "agent"
  tool_name: "Cursor"
`)

	// Shared rule files
	writeFile(t, filepath.Join(dir, "sections", "010-header.md"),
		"# Agent System\n\nThis document defines the {tool_name} agent system.")

	writeFile(t, filepath.Join(dir, "sections", "030-shared.md"),
		"## Shared Rules\n\nSpawn a {worker} to do work.")

	// Claude Code variant
	writeFile(t, filepath.Join(dir, "claude-code", "020-identity.md"),
		"## Identity\n\nYou are the Team Lead. Use {worker} delegation.")

	// Cursor variant
	writeFile(t, filepath.Join(dir, "cursor", "020-identity.md"),
		"## Identity\n\nYou are the Orchestrator. Use {worker} delegation.")

	return dir
}

func TestComposeFromDir_ClaudeCode(t *testing.T) {
	dir := setupComposableDir(t)

	result, err := ComposeFromDir(dir, "claude-code", nil)
	if err != nil {
		t.Fatal(err)
	}

	// Check variable substitution
	if !strings.Contains(result, "Claude Code agent system") {
		t.Error("missing tool_name substitution in header")
	}
	if !strings.Contains(result, "Use teammate delegation") {
		t.Error("missing worker substitution in identity")
	}
	if !strings.Contains(result, "Spawn a teammate to do work") {
		t.Error("missing worker substitution in shared sections")
	}

	// Check Claude Code-specific identity section
	if !strings.Contains(result, "You are the Team Lead") {
		t.Error("missing Claude Code identity")
	}

	// Should NOT contain Cursor content
	if strings.Contains(result, "You are the Orchestrator") {
		t.Error("should not contain Cursor identity")
	}
}

func TestComposeFromDir_Cursor(t *testing.T) {
	dir := setupComposableDir(t)

	result, err := ComposeFromDir(dir, "cursor", nil)
	if err != nil {
		t.Fatal(err)
	}

	// Check variable substitution
	if !strings.Contains(result, "Cursor agent system") {
		t.Error("missing tool_name substitution")
	}
	if !strings.Contains(result, "Use agent delegation") {
		t.Error("missing worker substitution")
	}

	// Check Cursor-specific identity section
	if !strings.Contains(result, "You are the Orchestrator") {
		t.Error("missing Cursor identity")
	}
}

func TestComposeFromDir_ExtraVars(t *testing.T) {
	dir := setupComposableDir(t)

	extraVars := map[string]string{
		"tool_name": "Overridden Tool",
	}

	result, err := ComposeFromDir(dir, "claude-code", extraVars)
	if err != nil {
		t.Fatal(err)
	}

	// Extra vars should override variant vars
	if !strings.Contains(result, "Overridden Tool agent system") {
		t.Error("extra vars did not override variant vars")
	}
}

func TestComposeFromDir_MissingVariantFile(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "sections"), 0755); err != nil {
		t.Fatal(err)
	}

	writeFile(t, filepath.Join(dir, "_order.yaml"), `sections:
  - sections/010-header.md
  - "{tool}/020-optional.md"
`)
	writeFile(t, filepath.Join(dir, "sections", "010-header.md"), "# Header")

	// No claude-code/ directory -- variant file is optional
	result, err := ComposeFromDir(dir, "claude-code", nil)
	if err != nil {
		t.Fatal(err)
	}

	if !strings.Contains(result, "# Header") {
		t.Error("missing header")
	}
}

func TestComposeFromDir_NonComposable(t *testing.T) {
	dir := t.TempDir()
	_, err := ComposeFromDir(dir, "claude-code", nil)
	if err == nil {
		t.Error("expected error for non-composable dir")
	}
}

// ─── ComposeAgent ───────────────────────────────────────────────────────────

func TestComposeAgent_ClaudeCode(t *testing.T) {
	dir := setupComposableDir(t)

	// Rename dir to match an agent name in config
	agentDir := filepath.Join(filepath.Dir(dir), "orchestrator")
	if err := os.Rename(dir, agentDir); err != nil {
		t.Fatal(err)
	}

	config := &BrainConfig{
		Agents: map[string]AgentToolConfig{
			"orchestrator": {
				"claude-code": json.RawMessage(`{
					"model": "opus",
					"description": "Brain orchestrator",
					"color": "#7B68EE"
				}`),
			},
		},
	}

	gen, err := ComposeAgent(agentDir, "claude-code", config)
	if err != nil {
		t.Fatal(err)
	}
	if gen == nil {
		t.Fatal("expected non-nil result")
	}

	// Check output path
	if gen.RelativePath != "agents/\U0001F9E0-orchestrator.md" {
		t.Errorf("path = %q", gen.RelativePath)
	}

	// Check frontmatter injected
	if !strings.Contains(gen.Content, "name: \U0001F9E0-orchestrator") {
		t.Error("missing name frontmatter")
	}
	if !strings.Contains(gen.Content, "model: opus") {
		t.Error("missing model frontmatter")
	}

	// Check composed body
	if !strings.Contains(gen.Content, "You are the Team Lead") {
		t.Error("missing composed body content")
	}
}

func TestComposeAgent_Cursor(t *testing.T) {
	dir := setupComposableDir(t)

	agentDir := filepath.Join(filepath.Dir(dir), "orchestrator")
	if err := os.Rename(dir, agentDir); err != nil {
		t.Fatal(err)
	}

	config := &BrainConfig{
		Agents: map[string]AgentToolConfig{
			"orchestrator": {
				"cursor": json.RawMessage(`{
					"description": "Cursor orchestrator"
				}`),
			},
		},
	}

	gen, err := ComposeAgent(agentDir, "cursor", config)
	if err != nil {
		t.Fatal(err)
	}
	if gen == nil {
		t.Fatal("expected non-nil result")
	}

	// Check Cursor frontmatter (description only)
	if !strings.Contains(gen.Content, "description: Cursor orchestrator") {
		t.Error("missing description frontmatter")
	}

	// Should NOT have model, color, etc.
	if strings.Contains(gen.Content, "model:") {
		t.Error("cursor should not have model frontmatter")
	}
}

func TestComposeAgent_NoPlatformConfig(t *testing.T) {
	dir := setupComposableDir(t)

	agentDir := filepath.Join(filepath.Dir(dir), "orchestrator")
	if err := os.Rename(dir, agentDir); err != nil {
		t.Fatal(err)
	}

	config := &BrainConfig{
		Agents: map[string]AgentToolConfig{
			"orchestrator": {
				"claude-code": json.RawMessage(`null`),
			},
		},
	}

	gen, err := ComposeAgent(agentDir, "claude-code", config)
	if err != nil {
		t.Fatal(err)
	}
	if gen != nil {
		t.Error("expected nil for null platform config")
	}
}

func TestComposeAgent_NotInConfig(t *testing.T) {
	dir := setupComposableDir(t)

	agentDir := filepath.Join(filepath.Dir(dir), "unknown-agent")
	if err := os.Rename(dir, agentDir); err != nil {
		t.Fatal(err)
	}

	config := &BrainConfig{
		Agents: map[string]AgentToolConfig{},
	}

	gen, err := ComposeAgent(agentDir, "claude-code", config)
	if err != nil {
		t.Fatal(err)
	}
	if gen != nil {
		t.Error("expected nil for agent not in config")
	}
}

// ─── ComposeInstructions ────────────────────────────────────────────────────

func TestComposeInstructions_ClaudeCode(t *testing.T) {
	dir := setupComposableDir(t)

	gen, err := ComposeInstructions(dir, "claude-code")
	if err != nil {
		t.Fatal(err)
	}
	if gen == nil {
		t.Fatal("expected non-nil result")
	}

	if gen.RelativePath != "AGENTS.md" {
		t.Errorf("path = %q, want AGENTS.md", gen.RelativePath)
	}

	if !strings.Contains(gen.Content, "Claude Code agent system") {
		t.Error("missing variable substitution in content")
	}
}

// ─── ComposeCommand ─────────────────────────────────────────────────────────

func TestComposeCommand_Basic(t *testing.T) {
	dir := t.TempDir()
	cmdDir := filepath.Join(dir, "bootstrap")
	if err := os.MkdirAll(filepath.Join(cmdDir, "sections"), 0755); err != nil {
		t.Fatal(err)
	}

	writeFile(t, filepath.Join(cmdDir, "_order.yaml"), `sections:
  - sections/010-init.md
`)
	writeFile(t, filepath.Join(cmdDir, "sections", "010-init.md"),
		"Initialize the session.")

	gen, err := ComposeCommand(cmdDir, "claude-code")
	if err != nil {
		t.Fatal(err)
	}
	if gen == nil {
		t.Fatal("expected non-nil result")
	}

	if gen.RelativePath != "commands/\U0001F9E0-bootstrap.md" {
		t.Errorf("path = %q", gen.RelativePath)
	}
	if !strings.Contains(gen.Content, "Initialize the session.") {
		t.Error("missing content")
	}
}

// ─── Integration: TransformClaudeAgents with composable dir ─────────────────

func TestTransformClaudeAgents_ComposableDir(t *testing.T) {
	dir := t.TempDir()
	agentsDir := filepath.Join(dir, "templates", "agents")

	// Create a composable agent directory
	orchDir := filepath.Join(agentsDir, "orchestrator")
	for _, d := range []string{
		filepath.Join(orchDir, "sections"),
		filepath.Join(orchDir, "claude-code"),
	} {
		if err := os.MkdirAll(d, 0755); err != nil {
			t.Fatal(err)
		}
	}

	writeFile(t, filepath.Join(orchDir, "_order.yaml"), `sections:
  - sections/010-core.md
  - "{tool}/020-variant.md"
`)
	writeFile(t, filepath.Join(orchDir, "_variables.yaml"), `claude-code:
  worker: "teammate"
`)
	writeFile(t, filepath.Join(orchDir, "sections", "010-core.md"),
		"# Core\n\nShared content for {worker}.")
	writeFile(t, filepath.Join(orchDir, "claude-code", "020-variant.md"),
		"## Claude Code\n\nSpecific to Claude Code {worker}.")

	// Also create a regular single-file agent
	writeFile(t, filepath.Join(agentsDir, "analyst.md"),
		"# Analyst\n\nYou analyze things.")

	config := &BrainConfig{
		Agents: map[string]AgentToolConfig{
			"orchestrator": {
				"claude-code": json.RawMessage(`{
					"model": "opus",
					"description": "Orchestrator agent"
				}`),
			},
			"analyst": {
				"claude-code": json.RawMessage(`{
					"model": "sonnet",
					"description": "Analyst agent"
				}`),
			},
		},
	}

	results, err := TransformClaudeAgents(agentsDir, config)
	if err != nil {
		t.Fatal(err)
	}

	if len(results) != 2 {
		t.Fatalf("expected 2 agents, got %d", len(results))
	}

	// Find the orchestrator (composed) result
	var orchResult, analystResult *GeneratedFile
	for i := range results {
		if strings.Contains(results[i].RelativePath, "orchestrator") {
			orchResult = &results[i]
		}
		if strings.Contains(results[i].RelativePath, "analyst") {
			analystResult = &results[i]
		}
	}

	if orchResult == nil {
		t.Fatal("missing orchestrator agent")
	}
	if analystResult == nil {
		t.Fatal("missing analyst agent")
	}

	// Composed agent should have variable substitution
	if !strings.Contains(orchResult.Content, "Shared content for teammate") {
		t.Error("orchestrator missing variable substitution in shared content")
	}
	if !strings.Contains(orchResult.Content, "Specific to Claude Code teammate") {
		t.Error("orchestrator missing variable substitution in variant content")
	}
	if !strings.Contains(orchResult.Content, "model: opus") {
		t.Error("orchestrator missing frontmatter")
	}

	// Regular agent should be unchanged
	if !strings.Contains(analystResult.Content, "You analyze things") {
		t.Error("analyst missing body")
	}
	if !strings.Contains(analystResult.Content, "model: sonnet") {
		t.Error("analyst missing frontmatter")
	}
}

// ─── Integration: TransformCommands with composable dir ─────────────────────

func TestTransformCommands_ComposableDir(t *testing.T) {
	dir := t.TempDir()

	// Create a composable command directory
	bootDir := filepath.Join(dir, "bootstrap")
	if err := os.MkdirAll(filepath.Join(bootDir, "sections"), 0755); err != nil {
		t.Fatal(err)
	}

	writeFile(t, filepath.Join(bootDir, "_order.yaml"), `sections:
  - sections/010-init.md
  - sections/020-identity.md
`)
	writeFile(t, filepath.Join(bootDir, "sections", "010-init.md"),
		"Initialize the session.")
	writeFile(t, filepath.Join(bootDir, "sections", "020-identity.md"),
		"You are the team lead.")

	// Also create a regular single-file command
	writeFile(t, filepath.Join(dir, "start-session.md"),
		"Start a new session.")

	results, err := TransformCommands(dir, "claude-code")
	if err != nil {
		t.Fatal(err)
	}

	if len(results) != 2 {
		t.Fatalf("expected 2 commands, got %d", len(results))
	}

	// Find the composed and regular results
	var bootResult, startResult *GeneratedFile
	for i := range results {
		if strings.Contains(results[i].RelativePath, "bootstrap") {
			bootResult = &results[i]
		}
		if strings.Contains(results[i].RelativePath, "start-session") {
			startResult = &results[i]
		}
	}

	if bootResult == nil {
		t.Fatal("missing bootstrap command")
	}
	if startResult == nil {
		t.Fatal("missing start-session command")
	}

	// Composed command should have both sections
	if !strings.Contains(bootResult.Content, "Initialize the session.") {
		t.Error("bootstrap missing init section")
	}
	if !strings.Contains(bootResult.Content, "You are the team lead.") {
		t.Error("bootstrap missing identity section")
	}

	// Regular command should be unchanged
	if !strings.Contains(startResult.Content, "Start a new session.") {
		t.Error("start-session missing content")
	}
}
