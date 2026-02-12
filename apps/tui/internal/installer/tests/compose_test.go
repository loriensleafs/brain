package installer_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/peterkloss/brain-tui/internal/installer"
)

// ---- ParseOrderYAML ---------------------------------------------------------

func TestParseOrderYAML_Basic(t *testing.T) {
	input := `name: test
sections:
  - 00-header
  - 01-identity
`
	got := installer.ParseOrderYAML(input)
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
	got := installer.ParseOrderYAML(input)

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
	got := installer.ParseOrderYAML(input)
	if len(got.Sections) != 3 {
		t.Fatalf("sections len = %d, want 3", len(got.Sections))
	}
	if got.Sections[1] != "VARIANT_INSERT" {
		t.Errorf("sections[1] = %q, want VARIANT_INSERT (comment not stripped)", got.Sections[1])
	}
}

func TestParseOrderYAML_Empty(t *testing.T) {
	got := installer.ParseOrderYAML("")
	if len(got.Sections) != 0 {
		t.Errorf("expected empty, got %d entries", len(got.Sections))
	}
}

// ---- ParseVariables ----------------------------------------------------

func TestParseVariables_Flat(t *testing.T) {
	input := `worker: teammate
workers: teammates
tool_name: "Claude Code"
`
	got := installer.ParseVariables(input)
	if got["worker"] != "teammate" {
		t.Errorf("worker = %q", got["worker"])
	}
	if got["tool_name"] != "Claude Code" {
		t.Errorf("tool_name = %q", got["tool_name"])
	}
}

func TestParseVariables_Empty(t *testing.T) {
	got := installer.ParseVariables("")
	if len(got) != 0 {
		t.Errorf("expected empty, got %d", len(got))
	}
}

// ---- ExpandVars ---------------------------------------------------

func TestExpandVars_Basic(t *testing.T) {
	content := "You are the {role_title}. Spawn {workers} to do work."
	vars := map[string]string{
		"role_title": "Team Lead",
		"workers":    "teammates",
	}
	got := installer.ExpandVars(content, vars)
	want := "You are the Team Lead. Spawn teammates to do work."
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestExpandVars_NoMatch(t *testing.T) {
	content := "No placeholders here."
	vars := map[string]string{"key": "value"}
	got := installer.ExpandVars(content, vars)
	if got != content {
		t.Errorf("content was modified: %q", got)
	}
}

func TestExpandVars_EmptyVars(t *testing.T) {
	content := "Keep {this} as is."
	got := installer.ExpandVars(content, nil)
	if got != content {
		t.Errorf("content was modified: %q", got)
	}
}

// ---- IsComposableDir -------------------------------------------------------

func TestIsComposableDir_WithOrderYaml(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "_order.yaml"), "sections:\n  - a\n")
	if !installer.IsComposableDir(dir) {
		t.Error("expected true for dir with _order.yaml")
	}
}

func TestIsComposableDir_WithoutOrderYaml(t *testing.T) {
	dir := t.TempDir()
	if installer.IsComposableDir(dir) {
		t.Error("expected false for dir without _order.yaml")
	}
}

// ---- ReadComposableDir -----------------------------------------------------

func TestReadComposableDir_NonComposable(t *testing.T) {
	dir := t.TempDir()
	order, err := installer.ReadComposableDir(dir)
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
	order, err := installer.ReadComposableDir(dir)
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

// ---- Compose ----------------------------------------------------------------

// setupComposableSource creates a temporary project with a composable directory
// under templates/test-agent/ and returns a TemplateSource rooted at the project.
func setupComposableSource(t *testing.T) (*installer.TemplateSource, string) {
	t.Helper()
	root := t.TempDir()
	dir := filepath.Join(root, "templates", "test-agent")

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

	return installer.NewFilesystemSource(root), "test-agent"
}

func TestCompose_ClaudeCode(t *testing.T) {
	src, relDir := setupComposableSource(t)

	result, err := installer.Compose(src, relDir, "claude-code", nil)
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

func TestCompose_Cursor(t *testing.T) {
	src, relDir := setupComposableSource(t)

	result, err := installer.Compose(src, relDir, "cursor", nil)
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

func TestCompose_ExtraVars(t *testing.T) {
	src, relDir := setupComposableSource(t)

	result, err := installer.Compose(src, relDir, "claude-code", map[string]string{
		"tool_name": "Overridden Tool",
	})
	if err != nil {
		t.Fatal(err)
	}

	if !strings.Contains(result, "Overridden Tool agent system") {
		t.Error("extra vars did not override variant vars")
	}
}

func TestCompose_NonComposable(t *testing.T) {
	root := t.TempDir()
	os.MkdirAll(filepath.Join(root, "templates", "empty"), 0755)
	src := installer.NewFilesystemSource(root)
	_, err := installer.Compose(src, "empty", "claude-code", nil)
	if err == nil {
		t.Error("expected error for non-composable dir")
	}
}

// ---- Helpers ---------------------------------------------------------------

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
}
