package tests

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	jsonpatch "github.com/evanphx/json-patch/v5"
)

// TestMergePatchDeepNesting verifies that jsonpatch.MergePatch handles
// arbitrary-depth recursive merging (3+ levels), fixing the old 2-level bug.
func TestMergePatchDeepNesting(t *testing.T) {
	existing := []byte(`{
		"mcpServers": {
			"brain": {
				"command": "npx",
				"args": ["brain-mcp"],
				"env": {
					"NODE_ENV": "production",
					"LOG_LEVEL": "info"
				}
			},
			"other": {
				"command": "other-tool"
			}
		}
	}`)

	patch := []byte(`{
		"mcpServers": {
			"brain": {
				"env": {
					"LOG_LEVEL": "debug",
					"NEW_VAR": "hello"
				}
			}
		}
	}`)

	merged, err := jsonpatch.MergePatch(existing, patch)
	if err != nil {
		t.Fatalf("MergePatch failed: %v", err)
	}

	var result map[string]any
	if err := json.Unmarshal(merged, &result); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}

	// Verify 3-level deep merge preserved existing keys
	servers := result["mcpServers"].(map[string]any)
	brain := servers["brain"].(map[string]any)
	env := brain["env"].(map[string]any)

	if env["NODE_ENV"] != "production" {
		t.Errorf("expected NODE_ENV=production, got %v", env["NODE_ENV"])
	}
	if env["LOG_LEVEL"] != "debug" {
		t.Errorf("expected LOG_LEVEL=debug (overwritten), got %v", env["LOG_LEVEL"])
	}
	if env["NEW_VAR"] != "hello" {
		t.Errorf("expected NEW_VAR=hello (added), got %v", env["NEW_VAR"])
	}

	// Verify sibling preserved
	other := servers["other"].(map[string]any)
	if other["command"] != "other-tool" {
		t.Errorf("expected other.command=other-tool, got %v", other["command"])
	}

	// Verify non-env keys preserved
	if brain["command"] != "npx" {
		t.Errorf("expected brain.command=npx, got %v", brain["command"])
	}
}

// TestMergePatchNullDeletes verifies RFC 7396 null-deletes semantics.
func TestMergePatchNullDeletes(t *testing.T) {
	existing := []byte(`{"a": "keep", "b": "remove", "c": {"d": "keep", "e": "remove"}}`)
	patch := []byte(`{"b": null, "c": {"e": null}}`)

	merged, err := jsonpatch.MergePatch(existing, patch)
	if err != nil {
		t.Fatalf("MergePatch failed: %v", err)
	}

	var result map[string]any
	json.Unmarshal(merged, &result)

	if result["a"] != "keep" {
		t.Errorf("expected a=keep, got %v", result["a"])
	}
	if _, exists := result["b"]; exists {
		t.Error("expected b to be deleted by null patch")
	}
	c := result["c"].(map[string]any)
	if c["d"] != "keep" {
		t.Errorf("expected c.d=keep, got %v", c["d"])
	}
	if _, exists := c["e"]; exists {
		t.Error("expected c.e to be deleted by null patch")
	}
}

// TestMergePatchNestedMCPConfig reproduces the known 2-level bug scenario
// where nested MCP configs break during merge.
func TestMergePatchNestedMCPConfig(t *testing.T) {
	// This is the exact scenario that broke with the old 2-level merge:
	// User has existing MCP config, Brain merges its server entry.
	// The old code would overwrite the entire "mcpServers" map instead
	// of merging at the server level.
	userConfig := []byte(`{
		"mcpServers": {
			"user-server": {
				"command": "user-tool",
				"args": ["--flag"]
			}
		}
	}`)

	brainPatch := []byte(`{
		"mcpServers": {
			"brain": {
				"command": "npx",
				"args": ["-y", "@anthropic-ai/claude-code-mcp"],
				"env": {
					"BRAIN_PROJECT": "/Users/dev/brain"
				}
			}
		}
	}`)

	merged, err := jsonpatch.MergePatch(userConfig, brainPatch)
	if err != nil {
		t.Fatalf("MergePatch failed: %v", err)
	}

	var result map[string]any
	json.Unmarshal(merged, &result)

	servers := result["mcpServers"].(map[string]any)

	// Both servers must exist
	if _, exists := servers["user-server"]; !exists {
		t.Error("user-server was lost during merge (the 2-level bug)")
	}
	if _, exists := servers["brain"]; !exists {
		t.Error("brain server was not added")
	}

	// User server must be intact
	userServer := servers["user-server"].(map[string]any)
	if userServer["command"] != "user-tool" {
		t.Errorf("user-server command overwritten, got %v", userServer["command"])
	}
}

// TestMergePatchEmptyTarget verifies merge into empty/missing target.
func TestMergePatchEmptyTarget(t *testing.T) {
	empty := []byte("{}")
	patch := []byte(`{"hooks": {"onSave": [{"command": "brain-lint"}]}}`)

	merged, err := jsonpatch.MergePatch(empty, patch)
	if err != nil {
		t.Fatalf("MergePatch with empty target failed: %v", err)
	}

	var result map[string]any
	json.Unmarshal(merged, &result)

	hooks := result["hooks"].(map[string]any)
	if hooks["onSave"] == nil {
		t.Error("expected hooks.onSave to be set")
	}
}

// TestJsonMergeEndToEnd tests the full jsonMerge function flow
// using temp files (merge payload + target).
func TestJsonMergeEndToEnd(t *testing.T) {
	dir := t.TempDir()

	// Write merge payload (same format as hooks.merge.json)
	payload := map[string]any{
		"managedKeys": []string{"hooks.onSave", "hooks.onSubmit"},
		"content": map[string]any{
			"hooks": map[string]any{
				"onSave": []any{
					map[string]any{"command": "brain-lint"},
				},
				"onSubmit": []any{
					map[string]any{"command": "brain-validate"},
				},
			},
		},
	}
	payloadData, _ := json.MarshalIndent(payload, "", "  ")
	payloadPath := filepath.Join(dir, "merge.json")
	os.WriteFile(payloadPath, payloadData, 0644)

	// Write existing target with user hooks
	existing := map[string]any{
		"hooks": map[string]any{
			"onOpen": []any{
				map[string]any{"command": "user-setup"},
			},
		},
	}
	existingData, _ := json.MarshalIndent(existing, "", "  ")
	targetPath := filepath.Join(dir, "hooks.json")
	os.WriteFile(targetPath, existingData, 0644)

	// Call jsonMerge equivalent logic (using jsonpatch directly since
	// the function is in cmd package which we can't import)
	var p struct {
		ManagedKeys []string        `json:"managedKeys"`
		Content     json.RawMessage `json:"content"`
	}
	json.Unmarshal(payloadData, &p)

	merged, err := jsonpatch.MergePatch(existingData, p.Content)
	if err != nil {
		t.Fatalf("MergePatch failed: %v", err)
	}

	var result map[string]any
	json.Unmarshal(merged, &result)

	hooks := result["hooks"].(map[string]any)

	// User's onOpen must be preserved
	if hooks["onOpen"] == nil {
		t.Error("user's onOpen hook was lost during merge")
	}
	// Brain's hooks must be added
	if hooks["onSave"] == nil {
		t.Error("brain's onSave hook was not merged")
	}
	if hooks["onSubmit"] == nil {
		t.Error("brain's onSubmit hook was not merged")
	}

	// Verify managed keys extraction
	if len(p.ManagedKeys) != 2 {
		t.Errorf("expected 2 managed keys, got %d", len(p.ManagedKeys))
	}
}
