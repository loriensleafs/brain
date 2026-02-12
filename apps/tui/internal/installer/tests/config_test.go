package installer_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/peterkloss/brain-tui/internal/installer"
)

// validYAML returns a minimal valid tools.config.yaml for testing.
func validYAML() string {
	return `
tools:
  test-tool:
    display_name: "Test Tool"
    prefix: false
    config_dir: ~/.test
    scopes:
      global: ~/.test/
    default_scope: global
    agents:
      frontmatter:
        - description
    rules:
      extension: .md
      extra_frontmatter: {}
    hooks:
      strategy: direct
      target: hooks.json
    mcp:
      strategy: direct
      target: mcp.json
    manifest:
      type: marketplace
    detection:
      brain_installed:
        type: json_key
        file: known.json
        key: brain
    placement: marketplace
`
}

// writeConfig writes YAML content to a temp file and returns the path.
func writeConfig(t *testing.T, content string) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "tools.config.yaml")
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestLoadToolConfigs_ValidConfig(t *testing.T) {
	path := writeConfig(t, validYAML())
	cfg, err := installer.LoadToolConfigs(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cfg.Tools) != 1 {
		t.Fatalf("expected 1 tool, got %d", len(cfg.Tools))
	}
	tc := cfg.Tools["test-tool"]
	if tc == nil {
		t.Fatal("expected test-tool to exist")
	}
	if tc.Name != "test-tool" {
		t.Errorf("expected Name to be derived from map key, got %q", tc.Name)
	}
	if tc.DisplayName != "Test Tool" {
		t.Errorf("expected DisplayName %q, got %q", "Test Tool", tc.DisplayName)
	}
	if tc.Prefix != false {
		t.Error("expected Prefix to be false")
	}
	if tc.ConfigDir != "~/.test" {
		t.Errorf("expected ConfigDir %q, got %q", "~/.test", tc.ConfigDir)
	}
	if tc.DefaultScope != "global" {
		t.Errorf("expected DefaultScope %q, got %q", "global", tc.DefaultScope)
	}
	if len(tc.Agents.Frontmatter) != 1 || tc.Agents.Frontmatter[0] != "description" {
		t.Errorf("unexpected agents.frontmatter: %v", tc.Agents.Frontmatter)
	}
	if tc.Rules.Extension != ".md" {
		t.Errorf("expected rules.extension %q, got %q", ".md", tc.Rules.Extension)
	}
	if tc.Hooks.Strategy != "direct" {
		t.Errorf("expected hooks.strategy %q, got %q", "direct", tc.Hooks.Strategy)
	}
	if tc.MCP.Strategy != "direct" {
		t.Errorf("expected mcp.strategy %q, got %q", "direct", tc.MCP.Strategy)
	}
	if tc.Manifest.Type != "marketplace" {
		t.Errorf("expected manifest.type %q, got %q", "marketplace", tc.Manifest.Type)
	}
	if tc.Placement != "marketplace" {
		t.Errorf("expected placement %q, got %q", "marketplace", tc.Placement)
	}
	if tc.Detection.BrainInstalled.Type != "json_key" {
		t.Errorf("expected detection type %q, got %q", "json_key", tc.Detection.BrainInstalled.Type)
	}
}

func TestLoadToolConfigs_RealConfig(t *testing.T) {
	// Test parsing the actual tools.config.yaml that ships with the project.
	// This is a golden-file-style test that catches config/schema drift.
	// From tests/ subdirectory, the real config is at the project root (five levels up).
	path := filepath.Join("..", "..", "..", "..", "..", "tools.config.yaml")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Skip("tools.config.yaml not found (running outside project root)")
	}

	cfg, err := installer.LoadToolConfigs(path)
	if err != nil {
		t.Fatalf("real tools.config.yaml failed to load: %v", err)
	}

	// Verify both expected tools are present.
	for _, name := range []string{"claude-code", "cursor"} {
		if _, ok := cfg.Tools[name]; !ok {
			t.Errorf("expected tool %q in config", name)
		}
	}

	// Spot-check Claude Code config.
	cc := cfg.Tools["claude-code"]
	if cc.Prefix != false {
		t.Error("claude-code: expected prefix=false")
	}
	if cc.Hooks.Strategy != "direct" {
		t.Errorf("claude-code: expected hooks.strategy=direct, got %q", cc.Hooks.Strategy)
	}
	if cc.Placement != "marketplace" {
		t.Errorf("claude-code: expected placement=marketplace, got %q", cc.Placement)
	}
	if len(cc.Agents.Frontmatter) != 8 {
		t.Errorf("claude-code: expected 8 frontmatter fields, got %d", len(cc.Agents.Frontmatter))
	}

	// Spot-check Cursor config.
	cur := cfg.Tools["cursor"]
	if cur.Prefix != true {
		t.Error("cursor: expected prefix=true")
	}
	if cur.Hooks.Strategy != "merge" {
		t.Errorf("cursor: expected hooks.strategy=merge, got %q", cur.Hooks.Strategy)
	}
	if cur.Placement != "copy_and_merge" {
		t.Errorf("cursor: expected placement=copy_and_merge, got %q", cur.Placement)
	}
	if cur.Rules.Extension != ".mdc" {
		t.Errorf("cursor: expected rules.extension=.mdc, got %q", cur.Rules.Extension)
	}
}

func TestLoadToolConfigs_FileNotFound(t *testing.T) {
	_, err := installer.LoadToolConfigs("/nonexistent/tools.config.yaml")
	if err == nil {
		t.Fatal("expected error for missing file")
	}
	if !strings.Contains(err.Error(), "read tool config") {
		t.Errorf("expected 'read tool config' in error, got: %v", err)
	}
}

func TestLoadToolConfigs_InvalidYAML(t *testing.T) {
	path := writeConfig(t, "not: [valid: yaml: {{")
	_, err := installer.LoadToolConfigs(path)
	if err == nil {
		t.Fatal("expected error for invalid YAML")
	}
	if !strings.Contains(err.Error(), "parse tool config") {
		t.Errorf("expected 'parse tool config' in error, got: %v", err)
	}
}

func TestLoadToolConfigs_EmptyTools(t *testing.T) {
	path := writeConfig(t, "tools: {}")
	_, err := installer.LoadToolConfigs(path)
	if err == nil {
		t.Fatal("expected error for empty tools map")
	}
	if !strings.Contains(err.Error(), "no tools defined") {
		t.Errorf("expected 'no tools defined' in error, got: %v", err)
	}
}

func TestValidation_Rule2_DisplayName(t *testing.T) {
	yaml := strings.Replace(validYAML(), `display_name: "Test Tool"`, `display_name: ""`, 1)
	path := writeConfig(t, yaml)
	_, err := installer.LoadToolConfigs(path)
	if err == nil {
		t.Fatal("expected validation error")
	}
	if !strings.Contains(err.Error(), "display_name is required") {
		t.Errorf("expected 'display_name is required' in error, got: %v", err)
	}
}

func TestValidation_Rule3_ConfigDir(t *testing.T) {
	yaml := strings.Replace(validYAML(), `config_dir: ~/.test`, `config_dir: ""`, 1)
	path := writeConfig(t, yaml)
	_, err := installer.LoadToolConfigs(path)
	if err == nil {
		t.Fatal("expected validation error")
	}
	if !strings.Contains(err.Error(), "config_dir is required") {
		t.Errorf("expected 'config_dir is required' in error, got: %v", err)
	}
}

func TestValidation_Rule4_Scopes(t *testing.T) {
	yaml := strings.Replace(validYAML(), "scopes:\n      global: ~/.test/\n    default_scope: global", "scopes: {}\n    default_scope: global", 1)
	path := writeConfig(t, yaml)
	_, err := installer.LoadToolConfigs(path)
	if err == nil {
		t.Fatal("expected validation error")
	}
	if !strings.Contains(err.Error(), "at least one scope is required") {
		t.Errorf("expected scope error, got: %v", err)
	}
}

func TestValidation_Rule5_DefaultScope(t *testing.T) {
	yaml := strings.Replace(validYAML(), `default_scope: global`, `default_scope: nonexistent`, 1)
	path := writeConfig(t, yaml)
	_, err := installer.LoadToolConfigs(path)
	if err == nil {
		t.Fatal("expected validation error")
	}
	if !strings.Contains(err.Error(), "default_scope") && !strings.Contains(err.Error(), "not found in scopes") {
		t.Errorf("expected default_scope error, got: %v", err)
	}
}

func TestValidation_Rule6_Frontmatter(t *testing.T) {
	yaml := strings.Replace(validYAML(), "frontmatter:\n        - description", "frontmatter: []", 1)
	path := writeConfig(t, yaml)
	_, err := installer.LoadToolConfigs(path)
	if err == nil {
		t.Fatal("expected validation error")
	}
	if !strings.Contains(err.Error(), "agents.frontmatter must list at least one field") {
		t.Errorf("expected frontmatter error, got: %v", err)
	}
}

func TestValidation_Rule7_Extension(t *testing.T) {
	yaml := strings.Replace(validYAML(), `extension: .md`, `extension: md`, 1)
	path := writeConfig(t, yaml)
	_, err := installer.LoadToolConfigs(path)
	if err == nil {
		t.Fatal("expected validation error")
	}
	if !strings.Contains(err.Error(), "rules.extension must start with '.'") {
		t.Errorf("expected extension error, got: %v", err)
	}
}

func TestValidation_Rule8_HooksStrategy(t *testing.T) {
	yaml := strings.Replace(validYAML(), "hooks:\n      strategy: direct\n      target: hooks.json",
		"hooks:\n      strategy: invalid\n      target: hooks.json", 1)
	path := writeConfig(t, yaml)
	_, err := installer.LoadToolConfigs(path)
	if err == nil {
		t.Fatal("expected validation error")
	}
	if !strings.Contains(err.Error(), "hooks.strategy") {
		t.Errorf("expected hooks.strategy error, got: %v", err)
	}
}

func TestValidation_Rule9_MCPStrategy(t *testing.T) {
	yaml := strings.Replace(validYAML(), "mcp:\n      strategy: direct\n      target: mcp.json",
		"mcp:\n      strategy: bad\n      target: mcp.json", 1)
	path := writeConfig(t, yaml)
	_, err := installer.LoadToolConfigs(path)
	if err == nil {
		t.Fatal("expected validation error")
	}
	if !strings.Contains(err.Error(), "mcp.strategy") {
		t.Errorf("expected mcp.strategy error, got: %v", err)
	}
}

func TestValidation_Rule10_Placement(t *testing.T) {
	yaml := strings.Replace(validYAML(), `placement: marketplace`, `placement: unknown`, 1)
	path := writeConfig(t, yaml)
	_, err := installer.LoadToolConfigs(path)
	if err == nil {
		t.Fatal("expected validation error")
	}
	if !strings.Contains(err.Error(), "placement") {
		t.Errorf("expected placement error, got: %v", err)
	}
}

func TestValidation_Rule11_ManifestType(t *testing.T) {
	yaml := strings.Replace(validYAML(), "manifest:\n      type: marketplace",
		"manifest:\n      type: bad", 1)
	path := writeConfig(t, yaml)
	_, err := installer.LoadToolConfigs(path)
	if err == nil {
		t.Fatal("expected validation error")
	}
	if !strings.Contains(err.Error(), "manifest.type") {
		t.Errorf("expected manifest.type error, got: %v", err)
	}
}

func TestValidation_MultipleErrors(t *testing.T) {
	yaml := `
tools:
  bad-tool:
    display_name: ""
    prefix: false
    config_dir: ""
    scopes: {}
    default_scope: missing
    agents:
      frontmatter: []
    rules:
      extension: md
    hooks:
      strategy: bad
      target: x
    mcp:
      strategy: bad
      target: x
    manifest:
      type: bad
    placement: bad
`
	path := writeConfig(t, yaml)
	_, err := installer.LoadToolConfigs(path)
	if err == nil {
		t.Fatal("expected validation error")
	}
	msg := err.Error()
	for _, expected := range []string{
		"display_name is required",
		"config_dir is required",
		"at least one scope is required",
		"default_scope",
		"agents.frontmatter",
		"rules.extension",
		"hooks.strategy",
		"mcp.strategy",
		"placement",
		"manifest.type",
	} {
		if !strings.Contains(msg, expected) {
			t.Errorf("expected error to contain %q, got:\n%s", expected, msg)
		}
	}
}

func TestDetectionCheck_JSONKey(t *testing.T) {
	path := writeConfig(t, validYAML())
	cfg, err := installer.LoadToolConfigs(path)
	if err != nil {
		t.Fatal(err)
	}
	det := cfg.Tools["test-tool"].Detection.BrainInstalled
	if det.Type != "json_key" {
		t.Errorf("expected type json_key, got %q", det.Type)
	}
	if det.File != "known.json" {
		t.Errorf("expected file known.json, got %q", det.File)
	}
	if det.Key != "brain" {
		t.Errorf("expected key brain, got %q", det.Key)
	}
}

func TestDetectionCheck_PrefixScan(t *testing.T) {
	yaml := `
tools:
  scanner:
    display_name: "Scanner"
    prefix: true
    config_dir: ~/.scanner
    scopes:
      global: ~/.scanner/
    default_scope: global
    agents:
      frontmatter:
        - description
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
        type: prefix_scan
        dirs:
          - agents
          - rules
    placement: copy_and_merge
`
	path := writeConfig(t, yaml)
	cfg, err := installer.LoadToolConfigs(path)
	if err != nil {
		t.Fatal(err)
	}
	det := cfg.Tools["scanner"].Detection.BrainInstalled
	if det.Type != "prefix_scan" {
		t.Errorf("expected type prefix_scan, got %q", det.Type)
	}
	if len(det.Dirs) != 2 || det.Dirs[0] != "agents" || det.Dirs[1] != "rules" {
		t.Errorf("expected dirs [agents rules], got %v", det.Dirs)
	}
}

func TestExtraFrontmatter(t *testing.T) {
	yaml := `
tools:
  fm-tool:
    display_name: "FM Tool"
    prefix: false
    config_dir: ~/.fm
    scopes:
      global: ~/.fm/
    default_scope: global
    agents:
      frontmatter:
        - description
    rules:
      extension: .mdc
      extra_frontmatter:
        alwaysApply: true
    hooks:
      strategy: direct
      target: hooks.json
    mcp:
      strategy: direct
      target: mcp.json
    manifest:
      type: marketplace
    detection:
      brain_installed:
        type: json_key
        file: known.json
        key: brain
    placement: marketplace
`
	path := writeConfig(t, yaml)
	cfg, err := installer.LoadToolConfigs(path)
	if err != nil {
		t.Fatal(err)
	}
	ef := cfg.Tools["fm-tool"].Rules.ExtraFrontmatter
	if ef == nil {
		t.Fatal("expected extra_frontmatter to be non-nil")
	}
	val, ok := ef["alwaysApply"]
	if !ok {
		t.Fatal("expected alwaysApply key")
	}
	if val != true {
		t.Errorf("expected alwaysApply=true, got %v", val)
	}
}

func TestMultipleScopes(t *testing.T) {
	yaml := `
tools:
  multi:
    display_name: "Multi"
    prefix: false
    config_dir: ~/.multi
    scopes:
      global: ~/.multi/
      plugin: ~/.multi/plugins/brain/
      project: .multi/
    default_scope: plugin
    agents:
      frontmatter:
        - name
        - description
    rules:
      extension: .md
    hooks:
      strategy: direct
      target: hooks.json
    mcp:
      strategy: direct
      target: .mcp.json
    manifest:
      type: marketplace
    detection:
      brain_installed:
        type: json_key
        file: plugins/known.json
        key: brain
    placement: marketplace
`
	path := writeConfig(t, yaml)
	cfg, err := installer.LoadToolConfigs(path)
	if err != nil {
		t.Fatal(err)
	}
	tc := cfg.Tools["multi"]
	if len(tc.Scopes) != 3 {
		t.Errorf("expected 3 scopes, got %d", len(tc.Scopes))
	}
	if tc.Scopes["plugin"] != "~/.multi/plugins/brain/" {
		t.Errorf("expected plugin scope path, got %q", tc.Scopes["plugin"])
	}
}
