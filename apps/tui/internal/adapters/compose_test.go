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
	input := `name: test
sections:
  - 00-header
  - 01-identity
`
	got := parseOrderYAML(input)
	if got.Name != "test" {
		t.Errorf("name = %q, want test", got.Name)
	}
	if len(got.Sections) != 2 {
		t.Fatalf("sections len = %d, want 2", len(got.Sections))
	}
	if got.Sections[0] != "00-header" {
		t.Errorf("sections[0] = %q", got.Sections[0])
	}
	if got.Sections[1] != "01-identity" {
		t.Errorf("sections[1] = %q", got.Sections[1])
	}
}

func TestParseOrderYAML_WithVariants(t *testing.T) {
	input := `name: orchestrator
sections:
  - 00-header
  - VARIANT_INSERT
  - 01-shared

variants:
  claude-code:
    frontmatter: _frontmatter.yaml
    variables: _variables.yaml
    overrides:
      00-header: 00-header
    inserts_at_VARIANT_INSERT:
      - 04-tools
      - 05-lifecycle
  cursor:
    variables: _variables.yaml
    inserts_at_VARIANT_INSERT:
      - 04-tools
`
	got := parseOrderYAML(input)

	if len(got.Sections) != 3 {
		t.Fatalf("sections len = %d, want 3", len(got.Sections))
	}
	if got.Sections[1] != "VARIANT_INSERT" {
		t.Errorf("sections[1] = %q, want VARIANT_INSERT", got.Sections[1])
	}

	cc := got.Variants["claude-code"]
	if cc.Frontmatter != "_frontmatter.yaml" {
		t.Errorf("claude-code frontmatter = %q", cc.Frontmatter)
	}
	if cc.Variables != "_variables.yaml" {
		t.Errorf("claude-code variables = %q", cc.Variables)
	}
	if cc.Overrides["00-header"] != "00-header" {
		t.Errorf("claude-code override = %q", cc.Overrides["00-header"])
	}
	if len(cc.Inserts) != 2 {
		t.Fatalf("claude-code inserts len = %d, want 2", len(cc.Inserts))
	}

	cur := got.Variants["cursor"]
	if len(cur.Inserts) != 1 {
		t.Fatalf("cursor inserts len = %d, want 1", len(cur.Inserts))
	}
	if cur.Inserts[0] != "04-tools" {
		t.Errorf("cursor inserts[0] = %q", cur.Inserts[0])
	}
}

func TestParseOrderYAML_InlineComments(t *testing.T) {
	input := `sections:
  - 00-header
  - VARIANT_INSERT             # Variant-specific sections inject here
  - 01-shared
`
	got := parseOrderYAML(input)
	if len(got.Sections) != 3 {
		t.Fatalf("sections len = %d, want 3", len(got.Sections))
	}
	if got.Sections[1] != "VARIANT_INSERT" {
		t.Errorf("sections[1] = %q, want VARIANT_INSERT (comment not stripped)", got.Sections[1])
	}
}

func TestParseOrderYAML_Empty(t *testing.T) {
	got := parseOrderYAML("")
	if len(got.Sections) != 0 {
		t.Errorf("expected empty, got %d entries", len(got.Sections))
	}
}

// ─── parseVariablesYAML ─────────────────────────────────────────────────────

func TestParseVariablesYAML_Flat(t *testing.T) {
	input := `worker: teammate
workers: teammates
tool_name: "Claude Code"
`
	got := parseVariablesYAML(input)
	if got["worker"] != "teammate" {
		t.Errorf("worker = %q", got["worker"])
	}
	if got["tool_name"] != "Claude Code" {
		t.Errorf("tool_name = %q", got["tool_name"])
	}
}

func TestParseVariablesYAML_Empty(t *testing.T) {
	got := parseVariablesYAML("")
	if len(got) != 0 {
		t.Errorf("expected empty, got %d", len(got))
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

// ─── IsComposableDir ────────────────────────────────────────────────────────

func TestIsComposableDir_WithOrderYaml(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "_order.yaml"), "sections:\n  - a\n")
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
	order, err := ReadComposableDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if order != nil {
		t.Error("expected nil for non-composable dir")
	}
}

func TestReadComposableDir_WithFiles(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "_order.yaml"), `name: test
sections:
  - a
  - b
`)
	order, err := ReadComposableDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if order == nil {
		t.Fatal("expected non-nil")
	}
	if len(order.Sections) != 2 {
		t.Errorf("sections len = %d, want 2", len(order.Sections))
	}
}

// ─── ComposeFromDir ─────────────────────────────────────────────────────────

func setupComposableDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()

	for _, d := range []string{"sections", "claude-code", "cursor"} {
		if err := os.MkdirAll(filepath.Join(dir, d), 0755); err != nil {
			t.Fatal(err)
		}
	}

	writeFile(t, filepath.Join(dir, "_order.yaml"), `name: test-agent
sections:
  - 00-header
  - 01-identity
  - VARIANT_INSERT
  - 02-shared

variants:
  claude-code:
    variables: _variables.yaml
    overrides:
      01-identity: 01-identity
    inserts_at_VARIANT_INSERT:
      - 03-tools
  cursor:
    variables: _variables.yaml
    overrides:
      01-identity: 01-identity
    inserts_at_VARIANT_INSERT:
      - 03-delegation
`)

	// Variant variables
	writeFile(t, filepath.Join(dir, "claude-code", "_variables.yaml"),
		"worker: teammate\ntool_name: Claude Code\n")
	writeFile(t, filepath.Join(dir, "cursor", "_variables.yaml"),
		"worker: agent\ntool_name: Cursor\n")

	// Shared sections
	writeFile(t, filepath.Join(dir, "sections", "00-header.md"),
		"# Agent System\n\nThis document defines the {tool_name} agent system.")
	writeFile(t, filepath.Join(dir, "sections", "02-shared.md"),
		"## Shared Rules\n\nSpawn a {worker} to do work.")

	// Claude Code variant sections
	writeFile(t, filepath.Join(dir, "claude-code", "01-identity.md"),
		"## Identity\n\nYou are the Team Lead. Use {worker} delegation.")
	writeFile(t, filepath.Join(dir, "claude-code", "03-tools.md"),
		"## Tools\n\nUse Teammate tool.")

	// Cursor variant sections
	writeFile(t, filepath.Join(dir, "cursor", "01-identity.md"),
		"## Identity\n\nYou are the Orchestrator. Use {worker} delegation.")
	writeFile(t, filepath.Join(dir, "cursor", "03-delegation.md"),
		"## Delegation\n\nUse Task tool.")

	return dir
}

func TestComposeFromDir_ClaudeCode(t *testing.T) {
	dir := setupComposableDir(t)

	result, err := ComposeFromDir(dir, "claude-code", nil)
	if err != nil {
		t.Fatal(err)
	}

	if !strings.Contains(result, "Claude Code agent system") {
		t.Error("missing tool_name substitution in header")
	}
	if !strings.Contains(result, "You are the Team Lead") {
		t.Error("missing Claude Code identity override")
	}
	if !strings.Contains(result, "Use Teammate tool") {
		t.Error("missing Claude Code variant insert")
	}
	if !strings.Contains(result, "Spawn a teammate to do work") {
		t.Error("missing worker substitution in shared section")
	}
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

	if !strings.Contains(result, "Cursor agent system") {
		t.Error("missing tool_name substitution")
	}
	if !strings.Contains(result, "You are the Orchestrator") {
		t.Error("missing Cursor identity override")
	}
	if !strings.Contains(result, "Use Task tool") {
		t.Error("missing Cursor variant insert")
	}
	if !strings.Contains(result, "Spawn a agent to do work") {
		t.Error("missing worker substitution in shared section")
	}
}

func TestComposeFromDir_ExtraVars(t *testing.T) {
	dir := setupComposableDir(t)

	result, err := ComposeFromDir(dir, "claude-code", map[string]string{
		"tool_name": "Overridden Tool",
	})
	if err != nil {
		t.Fatal(err)
	}

	if !strings.Contains(result, "Overridden Tool agent system") {
		t.Error("extra vars did not override variant vars")
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

	if gen.RelativePath != "agents/\U0001F9E0-orchestrator.md" {
		t.Errorf("path = %q", gen.RelativePath)
	}
	if !strings.Contains(gen.Content, "name: \U0001F9E0-orchestrator") {
		t.Error("missing name frontmatter")
	}
	if !strings.Contains(gen.Content, "model: opus") {
		t.Error("missing model frontmatter")
	}
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

	if !strings.Contains(gen.Content, "description: Cursor orchestrator") {
		t.Error("missing description frontmatter")
	}
	if strings.Contains(gen.Content, "model:") {
		t.Error("cursor should not have model frontmatter")
	}
	if !strings.Contains(gen.Content, "You are the Orchestrator") {
		t.Error("missing cursor identity")
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

// ─── ComposeCommand ─────────────────────────────────────────────────────────

func TestComposeCommand_Basic(t *testing.T) {
	dir := t.TempDir()
	cmdDir := filepath.Join(dir, "bootstrap")
	if err := os.MkdirAll(filepath.Join(cmdDir, "sections"), 0755); err != nil {
		t.Fatal(err)
	}

	writeFile(t, filepath.Join(cmdDir, "_order.yaml"), `sections:
  - 01-init
  - 02-identity
`)
	writeFile(t, filepath.Join(cmdDir, "sections", "01-init.md"),
		"Initialize the session.")
	writeFile(t, filepath.Join(cmdDir, "sections", "02-identity.md"),
		"You are the team lead.")

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
