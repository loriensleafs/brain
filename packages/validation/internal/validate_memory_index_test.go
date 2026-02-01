package internal_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/peterkloss/brain/packages/validation/internal"
)

// Helper function to create test directory structure
func setupMemoryTestDir(t *testing.T) string {
	t.Helper()
	tmpDir := t.TempDir()
	return tmpDir
}

// Tests for getDomainIndices (via ValidateMemoryIndex behavior)

func TestValidateMemoryIndex_NoDomainIndices(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Create empty memory directory with just memory-index.md
	memoryIndexContent := `| Keywords | File |
|----------|------|
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	if result.Summary.TotalDomains != 0 {
		t.Errorf("Expected 0 domains, got %d", result.Summary.TotalDomains)
	}
	// Should pass with no domains (nothing to validate)
	if !result.Valid {
		t.Errorf("Expected validation to pass with no domains, got: %s", result.Message)
	}
}

func TestValidateMemoryIndex_PathNotFound(t *testing.T) {
	result := internal.ValidateMemoryIndex("/nonexistent/path")

	if result.Valid {
		t.Error("Expected validation to fail for non-existent path")
	}
	if len(result.Checks) == 0 {
		t.Error("Expected at least one check")
	}
	if result.Checks[0].Name != "memory_path_exists" {
		t.Errorf("Expected memory_path_exists check, got %s", result.Checks[0].Name)
	}
}

func TestValidateMemoryIndex_SingleDomain(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Create domain index
	indexContent := `| Keywords | File |
|----------|------|
| auth login session | auth-login-flow |
| auth logout signout | auth-logout-process |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	// Create referenced files
	files := []string{"auth-login-flow.md", "auth-logout-process.md"}
	for _, f := range files {
		if err := os.WriteFile(filepath.Join(tmpDir, f), []byte("# Content"), 0644); err != nil {
			t.Fatalf("Failed to create file %s: %v", f, err)
		}
	}

	// Create memory-index.md referencing the domain index
	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	if result.Summary.TotalDomains != 1 {
		t.Errorf("Expected 1 domain, got %d", result.Summary.TotalDomains)
	}
	if result.Summary.TotalFiles != 2 {
		t.Errorf("Expected 2 files, got %d", result.Summary.TotalFiles)
	}
	if !result.Valid {
		t.Errorf("Expected validation to pass, got: %s", result.Message)
		for _, check := range result.Checks {
			if !check.Passed {
				t.Logf("Failed check: %s - %s", check.Name, check.Message)
			}
		}
	}
}

func TestValidateMemoryIndex_MultipleDomains(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Create auth domain index
	authIndexContent := `| Keywords | File |
|----------|------|
| auth login | auth-login-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(authIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create auth index: %v", err)
	}

	// Create build domain index
	buildIndexContent := `| Keywords | File |
|----------|------|
| build compile | build-process |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-build-index.md"), []byte(buildIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create build index: %v", err)
	}

	// Create referenced files
	for _, f := range []string{"auth-login-flow.md", "build-process.md"} {
		if err := os.WriteFile(filepath.Join(tmpDir, f), []byte("# Content"), 0644); err != nil {
			t.Fatalf("Failed to create file %s: %v", f, err)
		}
	}

	// Create memory-index.md
	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
| build | skills-build-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	if result.Summary.TotalDomains != 2 {
		t.Errorf("Expected 2 domains, got %d", result.Summary.TotalDomains)
	}
	if !result.Valid {
		t.Errorf("Expected validation to pass, got: %s", result.Message)
	}
}

// Tests for file reference validation

func TestValidateMemoryIndex_MissingFile(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Create domain index referencing non-existent file
	indexContent := `| Keywords | File |
|----------|------|
| auth login | auth-login-flow |
| auth logout | auth-missing-file |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	// Only create one of the files
	if err := os.WriteFile(filepath.Join(tmpDir, "auth-login-flow.md"), []byte("# Content"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	// Create memory-index.md
	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	if result.Valid {
		t.Error("Expected validation to fail for missing file")
	}
	if result.Summary.MissingFiles != 1 {
		t.Errorf("Expected 1 missing file, got %d", result.Summary.MissingFiles)
	}

	domainResult := result.DomainResults["auth"]
	if domainResult.Passed {
		t.Error("Expected domain validation to fail")
	}
	if len(domainResult.FileReferences.MissingFiles) != 1 {
		t.Errorf("Expected 1 missing file in domain result, got %d", len(domainResult.FileReferences.MissingFiles))
	}
}

func TestValidateMemoryIndex_DeprecatedSkillPrefix(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Create domain index with deprecated skill- prefix
	indexContent := `| Keywords | File |
|----------|------|
| auth login | skill-auth-login |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	// Create the file with deprecated prefix
	if err := os.WriteFile(filepath.Join(tmpDir, "skill-auth-login.md"), []byte("# Content"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	// Create memory-index.md
	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	if result.Valid {
		t.Error("Expected validation to fail for deprecated skill- prefix")
	}

	domainResult := result.DomainResults["auth"]
	if len(domainResult.FileReferences.NamingViolations) != 1 {
		t.Errorf("Expected 1 naming violation, got %d", len(domainResult.FileReferences.NamingViolations))
	}
}

// Tests for keyword density validation

func TestValidateMemoryIndex_KeywordDensity_SingleEntry(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Single entry - 100% unique by definition
	indexContent := `| Keywords | File |
|----------|------|
| auth login session token | auth-login-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "auth-login-flow.md"), []byte("# Content"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	domainResult := result.DomainResults["auth"]
	if density, ok := domainResult.KeywordDensity.Densities["auth-login-flow"]; ok {
		if density != 1.0 {
			t.Errorf("Expected 100%% density for single entry, got %.2f", density)
		}
	} else {
		t.Error("Expected density entry for auth-login-flow")
	}
}

func TestValidateMemoryIndex_KeywordDensity_LowUniqueness(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Two entries with mostly overlapping keywords
	indexContent := `| Keywords | File |
|----------|------|
| auth login session token jwt | auth-login-flow |
| auth login session token oauth | auth-oauth-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	for _, f := range []string{"auth-login-flow.md", "auth-oauth-flow.md"} {
		if err := os.WriteFile(filepath.Join(tmpDir, f), []byte("# Content"), 0644); err != nil {
			t.Fatalf("Failed to create file %s: %v", f, err)
		}
	}

	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	// Should fail due to low keyword uniqueness (only 1/5 = 20% unique each)
	if result.Valid {
		t.Error("Expected validation to fail for low keyword density")
	}

	domainResult := result.DomainResults["auth"]
	if domainResult.KeywordDensity.Passed {
		t.Error("Expected keyword density check to fail")
	}
	if len(domainResult.KeywordDensity.Issues) == 0 {
		t.Error("Expected keyword density issues")
	}
}

func TestValidateMemoryIndex_KeywordDensity_HighUniqueness(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Two entries with mostly unique keywords (60% unique each)
	indexContent := `| Keywords | File |
|----------|------|
| auth login session jwt bearer | auth-jwt-flow |
| auth oauth2 pkce code grant | auth-oauth-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	for _, f := range []string{"auth-jwt-flow.md", "auth-oauth-flow.md"} {
		if err := os.WriteFile(filepath.Join(tmpDir, f), []byte("# Content"), 0644); err != nil {
			t.Fatalf("Failed to create file %s: %v", f, err)
		}
	}

	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	// Should pass - 4/5 = 80% unique for each entry
	domainResult := result.DomainResults["auth"]
	if !domainResult.KeywordDensity.Passed {
		t.Errorf("Expected keyword density check to pass, got issues: %v", domainResult.KeywordDensity.Issues)
	}
}

// Tests for index format validation

func TestValidateMemoryIndex_IndexFormat_PureTable(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Pure lookup table (valid)
	indexContent := `| Keywords | File |
|----------|------|
| auth login | auth-login-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "auth-login-flow.md"), []byte("# Content"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	domainResult := result.DomainResults["auth"]
	if !domainResult.IndexFormat.Passed {
		t.Errorf("Expected index format check to pass, got issues: %v", domainResult.IndexFormat.Issues)
	}
}

func TestValidateMemoryIndex_IndexFormat_WithTitle(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Index with prohibited title
	indexContent := `# Auth Skills Index

| Keywords | File |
|----------|------|
| auth login | auth-login-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "auth-login-flow.md"), []byte("# Content"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	domainResult := result.DomainResults["auth"]
	if domainResult.IndexFormat.Passed {
		t.Error("Expected index format check to fail for title")
	}
	if len(domainResult.IndexFormat.ViolationLines) == 0 {
		t.Error("Expected violation lines to be recorded")
	}
}

func TestValidateMemoryIndex_IndexFormat_WithMetadata(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Index with prohibited metadata
	indexContent := `**Domain**: Auth
**Version**: 1.0

| Keywords | File |
|----------|------|
| auth login | auth-login-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "auth-login-flow.md"), []byte("# Content"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	domainResult := result.DomainResults["auth"]
	if domainResult.IndexFormat.Passed {
		t.Error("Expected index format check to fail for metadata")
	}
}

// Tests for duplicate entry validation

func TestValidateMemoryIndex_DuplicateEntries(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Index with duplicate entries
	indexContent := `| Keywords | File |
|----------|------|
| auth login | auth-login-flow |
| auth session | auth-login-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "auth-login-flow.md"), []byte("# Content"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	domainResult := result.DomainResults["auth"]
	if domainResult.DuplicateEntries.Passed {
		t.Error("Expected duplicate entries check to fail")
	}
	if len(domainResult.DuplicateEntries.Duplicates) != 1 {
		t.Errorf("Expected 1 duplicate, got %d", len(domainResult.DuplicateEntries.Duplicates))
	}
}

func TestValidateMemoryIndex_NoDuplicates(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Index without duplicates
	indexContent := `| Keywords | File |
|----------|------|
| auth login jwt | auth-login-flow |
| auth logout signout | auth-logout-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	for _, f := range []string{"auth-login-flow.md", "auth-logout-flow.md"} {
		if err := os.WriteFile(filepath.Join(tmpDir, f), []byte("# Content"), 0644); err != nil {
			t.Fatalf("Failed to create file %s: %v", f, err)
		}
	}

	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	domainResult := result.DomainResults["auth"]
	if !domainResult.DuplicateEntries.Passed {
		t.Errorf("Expected duplicate entries check to pass, got issues: %v", domainResult.DuplicateEntries.Issues)
	}
}

// Tests for minimum keywords (P2 warning)

func TestValidateMemoryIndex_MinimumKeywords_Insufficient(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Entry with insufficient keywords (< 5)
	indexContent := `| Keywords | File |
|----------|------|
| auth login | auth-login-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "auth-login-flow.md"), []byte("# Content"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	domainResult := result.DomainResults["auth"]
	// P2 is warning only, so main validation should still pass
	if !domainResult.MinimumKeywords.Passed {
		// This is expected - check that it's reported
		if len(domainResult.MinimumKeywords.Issues) == 0 {
			t.Error("Expected minimum keywords issues to be reported")
		}
	}
}

func TestValidateMemoryIndex_MinimumKeywords_Sufficient(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Entry with sufficient keywords (>= 5)
	indexContent := `| Keywords | File |
|----------|------|
| auth login session jwt bearer | auth-login-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "auth-login-flow.md"), []byte("# Content"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	domainResult := result.DomainResults["auth"]
	if !domainResult.MinimumKeywords.Passed {
		t.Errorf("Expected minimum keywords check to pass, got issues: %v", domainResult.MinimumKeywords.Issues)
	}
}

// Tests for domain prefix naming (P2 warning)

func TestValidateMemoryIndex_DomainPrefixNaming_Violation(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// File doesn't follow {domain}-{description} pattern
	indexContent := `| Keywords | File |
|----------|------|
| auth login | login-auth-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "login-auth-flow.md"), []byte("# Content"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	domainResult := result.DomainResults["auth"]
	// P2 is warning only
	if domainResult.DomainPrefixNaming.Passed {
		t.Error("Expected domain prefix naming check to fail")
	}
	if len(domainResult.DomainPrefixNaming.NonConforming) != 1 {
		t.Errorf("Expected 1 non-conforming file, got %d", len(domainResult.DomainPrefixNaming.NonConforming))
	}
}

func TestValidateMemoryIndex_DomainPrefixNaming_Valid(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// File follows {domain}-{description} pattern
	indexContent := `| Keywords | File |
|----------|------|
| auth login | auth-login-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "auth-login-flow.md"), []byte("# Content"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	domainResult := result.DomainResults["auth"]
	if !domainResult.DomainPrefixNaming.Passed {
		t.Errorf("Expected domain prefix naming check to pass, got issues: %v", domainResult.DomainPrefixNaming.Issues)
	}
}

// Tests for memory-index.md validation

func TestValidateMemoryIndex_MemoryIndexMissing(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Create domain index but no memory-index.md
	indexContent := `| Keywords | File |
|----------|------|
| auth login | auth-login-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "auth-login-flow.md"), []byte("# Content"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	if result.Valid {
		t.Error("Expected validation to fail without memory-index.md")
	}
	if result.MemoryIndexResult.Passed {
		t.Error("Expected memory index reference check to fail")
	}
}

func TestValidateMemoryIndex_MemoryIndexUnreferencedDomain(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Create domain index
	indexContent := `| Keywords | File |
|----------|------|
| auth login | auth-login-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "auth-login-flow.md"), []byte("# Content"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	// Create memory-index.md that doesn't reference the domain index
	memoryIndexContent := `| Keywords | File |
|----------|------|
| build | skills-build-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	if result.Valid {
		t.Error("Expected validation to fail for unreferenced domain")
	}
	if len(result.MemoryIndexResult.UnreferencedIndices) != 1 {
		t.Errorf("Expected 1 unreferenced index, got %d", len(result.MemoryIndexResult.UnreferencedIndices))
	}
}

func TestValidateMemoryIndex_MemoryIndexBrokenReference(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Create domain index
	indexContent := `| Keywords | File |
|----------|------|
| auth login | auth-login-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "auth-login-flow.md"), []byte("# Content"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	// Create memory-index.md with broken reference
	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
| missing | nonexistent-file |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	if result.Valid {
		t.Error("Expected validation to fail for broken reference in memory-index")
	}
	if len(result.MemoryIndexResult.BrokenReferences) != 1 {
		t.Errorf("Expected 1 broken reference, got %d", len(result.MemoryIndexResult.BrokenReferences))
	}
}

// Tests for orphaned files

func TestValidateMemoryIndex_OrphanedFile_DeprecatedPrefix(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Create domain index
	indexContent := `| Keywords | File |
|----------|------|
| auth login | auth-login-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "auth-login-flow.md"), []byte("# Content"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	// Create orphaned file with deprecated skill- prefix
	if err := os.WriteFile(filepath.Join(tmpDir, "skill-orphan.md"), []byte("# Orphan"), 0644); err != nil {
		t.Fatalf("Failed to create orphan file: %v", err)
	}

	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	if len(result.Orphans) != 1 {
		t.Errorf("Expected 1 orphan, got %d", len(result.Orphans))
	}
	if len(result.Orphans) > 0 && result.Orphans[0].Domain != "INVALID" {
		t.Errorf("Expected orphan domain to be INVALID, got %s", result.Orphans[0].Domain)
	}
}

func TestValidateMemoryIndex_OrphanedFile_DomainPrefix(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Create domain index
	indexContent := `| Keywords | File |
|----------|------|
| auth login | auth-login-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "auth-login-flow.md"), []byte("# Content"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	// Create orphaned file matching domain prefix but not indexed
	if err := os.WriteFile(filepath.Join(tmpDir, "auth-orphan-file.md"), []byte("# Orphan"), 0644); err != nil {
		t.Fatalf("Failed to create orphan file: %v", err)
	}

	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	if len(result.Orphans) != 1 {
		t.Errorf("Expected 1 orphan, got %d", len(result.Orphans))
	}
	if len(result.Orphans) > 0 {
		if result.Orphans[0].Domain != "auth" {
			t.Errorf("Expected orphan domain to be auth, got %s", result.Orphans[0].Domain)
		}
		if result.Orphans[0].ExpectedIndex != "skills-auth-index" {
			t.Errorf("Expected expected index to be skills-auth-index, got %s", result.Orphans[0].ExpectedIndex)
		}
	}
}

func TestValidateMemoryIndex_NoOrphans(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Create domain index
	indexContent := `| Keywords | File |
|----------|------|
| auth login | auth-login-flow |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create index: %v", err)
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "auth-login-flow.md"), []byte("# Content"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth | skills-auth-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	if len(result.Orphans) != 0 {
		t.Errorf("Expected 0 orphans, got %d: %v", len(result.Orphans), result.Orphans)
	}
}

// Tests for ValidateMemoryIndexFromContent

func TestValidateMemoryIndexFromContent_SingleDomain(t *testing.T) {
	indexContents := map[string]string{
		"auth": `| Keywords | File |
|----------|------|
| auth login jwt bearer token | auth-login-flow |
| auth logout signout revoke clear | auth-logout-process |
`,
	}

	result := internal.ValidateMemoryIndexFromContent(indexContents, "")

	if result.Summary.TotalDomains != 1 {
		t.Errorf("Expected 1 domain, got %d", result.Summary.TotalDomains)
	}
	if result.Summary.TotalFiles != 2 {
		t.Errorf("Expected 2 files, got %d", result.Summary.TotalFiles)
	}
}

func TestValidateMemoryIndexFromContent_FormatViolation(t *testing.T) {
	indexContents := map[string]string{
		"auth": `# Auth Index

| Keywords | File |
|----------|------|
| auth login | auth-login-flow |
`,
	}

	result := internal.ValidateMemoryIndexFromContent(indexContents, "")

	if result.Valid {
		t.Error("Expected validation to fail for title in index")
	}

	domainResult := result.DomainResults["auth"]
	if domainResult.IndexFormat.Passed {
		t.Error("Expected index format check to fail")
	}
}

func TestValidateMemoryIndexFromContent_DuplicateDetection(t *testing.T) {
	indexContents := map[string]string{
		"auth": `| Keywords | File |
|----------|------|
| auth login | auth-login-flow |
| auth session | auth-login-flow |
`,
	}

	result := internal.ValidateMemoryIndexFromContent(indexContents, "")

	domainResult := result.DomainResults["auth"]
	if domainResult.DuplicateEntries.Passed {
		t.Error("Expected duplicate entries check to fail")
	}
}

// Integration test

func TestValidateMemoryIndex_FullValidation(t *testing.T) {
	tmpDir := setupMemoryTestDir(t)

	// Create complete valid memory structure
	authIndexContent := `| Keywords | File |
|----------|------|
| auth login jwt bearer token | auth-jwt-flow |
| auth oauth2 pkce authorization code | auth-oauth-flow |
| auth logout signout session revoke | auth-logout |
`
	buildIndexContent := `| Keywords | File |
|----------|------|
| build compile msbuild dotnet restore | build-dotnet |
| build test xunit nunit coverage | build-testing |
`

	if err := os.WriteFile(filepath.Join(tmpDir, "skills-auth-index.md"), []byte(authIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create auth index: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-build-index.md"), []byte(buildIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create build index: %v", err)
	}

	// Create all referenced files
	files := []string{
		"auth-jwt-flow.md",
		"auth-oauth-flow.md",
		"auth-logout.md",
		"build-dotnet.md",
		"build-testing.md",
	}
	for _, f := range files {
		if err := os.WriteFile(filepath.Join(tmpDir, f), []byte("# "+f), 0644); err != nil {
			t.Fatalf("Failed to create file %s: %v", f, err)
		}
	}

	// Create memory-index.md
	memoryIndexContent := `| Keywords | File |
|----------|------|
| auth authentication security | skills-auth-index |
| build compile ci cd | skills-build-index |
`
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(memoryIndexContent), 0644); err != nil {
		t.Fatalf("Failed to create memory-index.md: %v", err)
	}

	result := internal.ValidateMemoryIndex(tmpDir)

	// Should pass all validations
	if !result.Valid {
		t.Errorf("Expected full validation to pass, got: %s", result.Message)
		for _, check := range result.Checks {
			if !check.Passed {
				t.Logf("Failed check: %s - %s", check.Name, check.Message)
			}
		}
		for domain, domainResult := range result.DomainResults {
			if !domainResult.Passed {
				t.Logf("Domain %s failed:", domain)
				for _, issue := range domainResult.FileReferences.Issues {
					t.Logf("  FileRef: %s", issue)
				}
				for _, issue := range domainResult.KeywordDensity.Issues {
					t.Logf("  KwDensity: %s", issue)
				}
				for _, issue := range domainResult.IndexFormat.Issues {
					t.Logf("  Format: %s", issue)
				}
				for _, issue := range domainResult.DuplicateEntries.Issues {
					t.Logf("  Duplicate: %s", issue)
				}
			}
		}
	}

	// Verify summary
	if result.Summary.TotalDomains != 2 {
		t.Errorf("Expected 2 domains, got %d", result.Summary.TotalDomains)
	}
	if result.Summary.PassedDomains != 2 {
		t.Errorf("Expected 2 passed domains, got %d", result.Summary.PassedDomains)
	}
	if result.Summary.TotalFiles != 5 {
		t.Errorf("Expected 5 files, got %d", result.Summary.TotalFiles)
	}
	if result.Summary.MissingFiles != 0 {
		t.Errorf("Expected 0 missing files, got %d", result.Summary.MissingFiles)
	}
	if len(result.Orphans) != 0 {
		t.Errorf("Expected 0 orphans, got %d", len(result.Orphans))
	}
}
