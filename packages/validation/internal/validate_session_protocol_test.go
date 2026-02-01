package internal_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/peterkloss/brain/packages/validation/internal"
)

// Tests for exported helper functions

func TestCheckBrainInitialization(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		expected bool
	}{
		{
			name:     "mcp__plugin_brain_brain__build_context",
			content:  "Called mcp__plugin_brain_brain__build_context successfully",
			expected: true,
		},
		{
			name:     "bootstrap_context",
			content:  "Called mcp__plugin_brain_brain__bootstrap_context",
			expected: true,
		},
		{
			name:     "Brain MCP initialized",
			content:  "Brain MCP initialized successfully",
			expected: true,
		},
		{
			name:     "No evidence",
			content:  "Just some random content",
			expected: false,
		},
		{
			name:     "Case insensitive",
			content:  "BRAIN MCP INITIALIZED",
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.CheckBrainInitialization(tt.content)
			if result != tt.expected {
				t.Errorf("CheckBrainInitialization(%q) = %v, expected %v", tt.content, result, tt.expected)
			}
		})
	}
}

func TestCheckBrainUpdate(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		expected bool
	}{
		{
			name:     "write_note",
			content:  "Called mcp__plugin_brain_brain__write_note",
			expected: true,
		},
		{
			name:     "edit_note",
			content:  "Using mcp__plugin_brain_brain__edit_note",
			expected: true,
		},
		{
			name:     "Note write confirmed",
			content:  "| MUST | Update Brain note | [x] | Note write confirmed |",
			expected: true,
		},
		{
			name:     "No evidence",
			content:  "Just some random content",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.CheckBrainUpdate(tt.content)
			if result != tt.expected {
				t.Errorf("CheckBrainUpdate(%q) = %v, expected %v", tt.content, result, tt.expected)
			}
		})
	}
}

func TestCheckBranchDocumented(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		expected bool
	}{
		{
			name:     "Bold branch format",
			content:  "**Branch**: feature/test\n",
			expected: true,
		},
		{
			name:     "Simple branch format",
			content:  "Branch: main\n",
			expected: true,
		},
		{
			name:     "Current Branch format",
			content:  "Current Branch: develop\n",
			expected: true,
		},
		{
			name:     "Placeholder only",
			content:  "**Branch**: [branch name]\n",
			expected: false,
		},
		{
			name:     "Empty value",
			content:  "**Branch**:\n",
			expected: false,
		},
		{
			name:     "No branch",
			content:  "Just some content",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.CheckBranchDocumented(tt.content)
			if result != tt.expected {
				t.Errorf("CheckBranchDocumented(%q) = %v, expected %v", tt.content, result, tt.expected)
			}
		})
	}
}

func TestCheckCommitEvidence(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		expected bool
	}{
		{
			name:     "Commit SHA format",
			content:  "Commit SHA: abc1234",
			expected: true,
		},
		{
			name:     "Full SHA",
			content:  "Commit SHA: abc1234567890abcdef1234567890abcdef123456",
			expected: true,
		},
		{
			name:     "Backtick format",
			content:  "- `abc1234` - test commit",
			expected: true,
		},
		{
			name:     "SHA label",
			content:  "SHA: def5678",
			expected: true,
		},
		{
			name:     "No commit evidence",
			content:  "Just some content",
			expected: false,
		},
		{
			name:     "Placeholder",
			content:  "Commit SHA: _______",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.CheckCommitEvidence(tt.content)
			if result != tt.expected {
				t.Errorf("CheckCommitEvidence(%q) = %v, expected %v", tt.content, result, tt.expected)
			}
		})
	}
}

func TestCheckLintEvidence(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		expected bool
	}{
		{
			name:     "markdownlint",
			content:  "Ran markdownlint successfully",
			expected: true,
		},
		{
			name:     "Lint output section",
			content:  "### Lint Output\n\nNo issues",
			expected: true,
		},
		{
			name:     "npx command",
			content:  "npx markdownlint-cli2 --fix",
			expected: true,
		},
		{
			name:     "No lint evidence",
			content:  "Just some content",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.CheckLintEvidence(tt.content)
			if result != tt.expected {
				t.Errorf("CheckLintEvidence(%q) = %v, expected %v", tt.content, result, tt.expected)
			}
		})
	}
}

func TestValidateChecklist(t *testing.T) {
	content := `### Session Start (COMPLETE ALL before work)

| Req | Step | Status | Evidence |
|-----|------|--------|----------|
| MUST | Initialize Brain | [x] | Done |
| MUST | Load context | [ ] | Not done |
| SHOULD | Import notes | [x] | Done |
| SHOULD | Check status | [ ] | Not done |
| MAY | Optional step | [ ] | Skipped |
`

	result := internal.ValidateChecklist(content, "Session Start")

	if result.TotalMustItems != 2 {
		t.Errorf("Expected 2 MUST items, got %d", result.TotalMustItems)
	}

	if result.CompletedMustItems != 1 {
		t.Errorf("Expected 1 completed MUST item, got %d", result.CompletedMustItems)
	}

	if result.TotalShouldItems != 2 {
		t.Errorf("Expected 2 SHOULD items, got %d", result.TotalShouldItems)
	}

	if result.CompletedShouldItems != 1 {
		t.Errorf("Expected 1 completed SHOULD item, got %d", result.CompletedShouldItems)
	}

	if len(result.MissingMustItems) != 1 {
		t.Errorf("Expected 1 missing MUST item, got %d", len(result.MissingMustItems))
	}

	if len(result.MissingShouldItems) != 1 {
		t.Errorf("Expected 1 missing SHOULD item, got %d", len(result.MissingShouldItems))
	}
}

func TestExtractSection(t *testing.T) {
	content := `## Protocol Compliance

### Session Start (COMPLETE ALL before work)

| Req | Step | Status |
|-----|------|--------|
| MUST | Init | [x] |

### Session End (COMPLETE ALL before closing)

| Req | Step | Status |
|-----|------|--------|
| MUST | Commit | [x] |

## Work Log

Some work done.
`

	startSection := internal.ExtractSection(content, "Session Start")
	if startSection == "" {
		t.Error("Expected to extract Session Start section")
	}

	if !strings.Contains(startSection, "Session Start") {
		t.Error("Expected section to contain 'Session Start'")
	}

	// Should not contain next section
	if strings.Contains(startSection, "Session End") {
		t.Error("Expected section to NOT contain 'Session End'")
	}

	endSection := internal.ExtractSection(content, "Session End")
	if endSection == "" {
		t.Error("Expected to extract Session End section")
	}

	if !strings.Contains(endSection, "Session End") {
		t.Error("Expected section to contain 'Session End'")
	}
}

func TestTruncateString(t *testing.T) {
	tests := []struct {
		input    string
		maxLen   int
		expected string
	}{
		{"short", 10, "short"},
		{"this is a long string", 10, "this is..."},
		{"exact", 5, "exact"},
		{"ab", 5, "ab"},
	}

	for _, tt := range tests {
		result := internal.TruncateString(tt.input, tt.maxLen)
		if result != tt.expected {
			t.Errorf("TruncateString(%q, %d) = %q, expected %q", tt.input, tt.maxLen, result, tt.expected)
		}
	}
}

// Tests for main validation functions

func TestValidateSessionProtocol_FileNotFound(t *testing.T) {
	result := internal.ValidateSessionProtocol("/nonexistent/path/2024-01-01-session-01.md")

	if result.Valid {
		t.Error("Expected validation to fail for nonexistent file")
	}

	if len(result.Checks) != 1 {
		t.Errorf("Expected 1 check, got %d", len(result.Checks))
	}

	if result.Checks[0].Name != "file_exists" {
		t.Errorf("Expected file_exists check, got %s", result.Checks[0].Name)
	}

	if result.Checks[0].Passed {
		t.Error("Expected file_exists check to fail")
	}
}

func TestValidateSessionProtocol_InvalidFilename(t *testing.T) {
	// Create temp file with invalid name
	tmpDir := t.TempDir()
	invalidPath := filepath.Join(tmpDir, "invalid-session-name.md")

	content := `# Session 01 - 2024-01-01

## Session Info

- **Branch**: feature/test

## Protocol Compliance

### Session Start (COMPLETE ALL before work)

| Req | Step | Status | Evidence |
|-----|------|--------|----------|
| MUST | Initialize Brain | [x] | Done |

### Session End (COMPLETE ALL before closing)

| Req | Step | Status | Evidence |
|-----|------|--------|----------|
| MUST | Complete session log | [x] | Done |
| MUST | Update Brain note | [x] | Note write confirmed |
| MUST | Run markdown lint | [x] | Lint output clean |
| MUST | Commit all changes | [x] | Commit SHA: abc1234 |
`
	if err := os.WriteFile(invalidPath, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	result := internal.ValidateSessionProtocol(invalidPath)

	// Find filename_format check
	var filenameCheck *internal.Check
	for i := range result.Checks {
		if result.Checks[i].Name == "filename_format" {
			filenameCheck = &result.Checks[i]
			break
		}
	}

	if filenameCheck == nil {
		t.Fatal("Expected filename_format check to be present")
	}

	if filenameCheck.Passed {
		t.Error("Expected filename_format check to fail for invalid filename")
	}
}

func TestValidateSessionProtocol_ValidSession(t *testing.T) {
	tmpDir := t.TempDir()
	validPath := filepath.Join(tmpDir, "2024-01-01-session-01.md")

	content := `# Session 01 - 2024-01-01

## Session Info

- **Date**: 2024-01-01
- **Branch**: feature/test
- **Starting Commit**: abc1234
- **Objective**: Test session

## Protocol Compliance

### Session Start (COMPLETE ALL before work)

| Req | Step | Status | Evidence |
|-----|------|--------|----------|
| MUST | Initialize Brain: mcp__plugin_brain_brain__build_context | [x] | Tool output present |
| MUST | Load initial context | [x] | Tool output present |
| MUST | Search Brain for cross-session context | [x] | Search results in context |
| MUST | Create this session log | [x] | This file exists |
| MUST | List skill scripts | [x] | Output documented below |
| MUST | Read usage-mandatory note | [x] | Content in context |
| MUST | Read PROJECT-CONSTRAINTS.md | [x] | Content in context |
| MUST | Read memory-index, load task-relevant notes | [x] | List notes loaded |
| SHOULD | Import shared notes | [x] | Import count: 5 |
| MUST | Verify and declare current branch | [x] | Branch documented below |
| MUST | Confirm not on main/master | [x] | On feature branch |
| SHOULD | Verify git status | [x] | Output documented below |
| SHOULD | Note starting commit | [x] | SHA documented below |

### Branch Verification

**Current Branch**: feature/test
**Matches Expected Context**: Yes

---

## Work Log

### Test Task

**Status**: Complete

---

### Session End (COMPLETE ALL before closing)

| Req | Step | Status | Evidence |
|-----|------|--------|----------|
| SHOULD | Export session notes | [x] | Export file: Skipped |
| MUST | Security review export | [x] | Scan result: Clean |
| MUST | Complete session log (all sections filled) | [x] | File complete |
| MUST | Update Brain note (cross-session context) | [x] | Note write confirmed |
| MUST | Run markdown lint | [x] | Lint output clean |
| MUST | Route to qa agent | [x] | SKIPPED: investigation-only |
| MUST | Commit all changes | [x] | Commit SHA: abc1234 |
| SHOULD | Update PROJECT-PLAN.md | [x] | Tasks checked off |
| SHOULD | Invoke retrospective | [x] | Skipped |
| SHOULD | Verify clean git status | [x] | Output below |

### Lint Output

No issues found.

### Final Git Status

Nothing to commit, working tree clean

### Commits This Session

- ` + "`abc1234`" + ` - test: add session protocol tests
`
	if err := os.WriteFile(validPath, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	result := internal.ValidateSessionProtocol(validPath)

	if !result.Valid {
		t.Errorf("Expected validation to pass, got message: %s", result.Message)
		for _, check := range result.Checks {
			if !check.Passed {
				t.Errorf("Failed check: %s - %s", check.Name, check.Message)
			}
		}
	}

	if !result.BrainInitialized {
		t.Error("Expected BrainInitialized to be true")
	}

	if !result.BrainUpdated {
		t.Error("Expected BrainUpdated to be true")
	}
}

func TestValidateSessionProtocol_MissingMustItems(t *testing.T) {
	tmpDir := t.TempDir()
	validPath := filepath.Join(tmpDir, "2024-01-01-session-01.md")

	content := `# Session 01 - 2024-01-01

## Session Info

- **Branch**: feature/test

## Protocol Compliance

### Session Start (COMPLETE ALL before work)

| Req | Step | Status | Evidence |
|-----|------|--------|----------|
| MUST | Initialize Brain | [x] | Done |
| MUST | Load initial context | [ ] | Not done |
| MUST | Create this session log | [x] | This file exists |

### Session End (COMPLETE ALL before closing)

| Req | Step | Status | Evidence |
|-----|------|--------|----------|
| MUST | Complete session log | [x] | Done |
| MUST | Update Brain note | [ ] | Not done |
| MUST | Run markdown lint | [x] | Lint output clean |
| MUST | Commit all changes | [x] | Commit SHA: abc1234 |
`
	if err := os.WriteFile(validPath, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	result := internal.ValidateSessionProtocol(validPath)

	if result.Valid {
		t.Error("Expected validation to fail due to missing MUST items")
	}

	// Check start checklist has incomplete items
	if result.StartChecklist.CompletedMustItems == result.StartChecklist.TotalMustItems {
		t.Error("Expected some Session Start MUST items to be incomplete")
	}

	// Check end checklist has incomplete items
	if result.EndChecklist.CompletedMustItems == result.EndChecklist.TotalMustItems {
		t.Error("Expected some Session End MUST items to be incomplete")
	}

	// Verify missing items are tracked
	if len(result.StartChecklist.MissingMustItems) == 0 {
		t.Error("Expected MissingMustItems to contain items")
	}

	if len(result.EndChecklist.MissingMustItems) == 0 {
		t.Error("Expected EndChecklist.MissingMustItems to contain items")
	}
}

func TestValidateSessionProtocolFromContent_AllChecks(t *testing.T) {
	content := `# Session 01 - 2024-01-01

## Session Info

- **Branch**: feature/test

## Protocol Compliance

### Session Start (COMPLETE ALL before work)

| Req | Step | Status | Evidence |
|-----|------|--------|----------|
| MUST | Initialize Brain: mcp__plugin_brain_brain__build_context | [x] | Done |
| SHOULD | Import notes | [x] | Done |

### Session End (COMPLETE ALL before closing)

| Req | Step | Status | Evidence |
|-----|------|--------|----------|
| MUST | Update Brain note | [x] | Note write confirmed |
| MUST | Run markdown lint | [x] | Lint output clean |
| MUST | Commit all changes | [x] | Commit SHA: abc1234 |
`

	result := internal.ValidateSessionProtocolFromContent(content, "2024-01-01-session-01.md")

	if result.StartChecklist.TotalMustItems != 1 {
		t.Errorf("Expected 1 Session Start MUST item, got %d", result.StartChecklist.TotalMustItems)
	}

	if result.StartChecklist.TotalShouldItems != 1 {
		t.Errorf("Expected 1 Session Start SHOULD item, got %d", result.StartChecklist.TotalShouldItems)
	}

	if result.StartChecklist.CompletedMustItems != 1 {
		t.Errorf("Expected 1 completed Session Start MUST item, got %d", result.StartChecklist.CompletedMustItems)
	}

	if result.EndChecklist.TotalMustItems != 3 {
		t.Errorf("Expected 3 Session End MUST items, got %d", result.EndChecklist.TotalMustItems)
	}
}
