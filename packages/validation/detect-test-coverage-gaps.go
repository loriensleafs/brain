package validation

import (
	"bufio"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

// TestCoverageGapResult represents the outcome of test coverage gap detection.
type TestCoverageGapResult struct {
	ValidationResult
	BasePath          string            `json:"basePath,omitempty"`
	Language          string            `json:"language,omitempty"`
	StagedOnly        bool              `json:"stagedOnly"`
	TotalSourceFiles  int               `json:"totalSourceFiles"`
	FilesWithTests    int               `json:"filesWithTests"`
	FilesWithoutTests int               `json:"filesWithoutTests"`
	CoveragePercent   float64           `json:"coveragePercent"`
	Threshold         float64           `json:"threshold"`
	MissingTests      []MissingTestFile `json:"missingTests,omitempty"`
	IgnorePatterns    []string          `json:"ignorePatterns,omitempty"`
}

// MissingTestFile represents a source file without a corresponding test file.
type MissingTestFile struct {
	SourceFile   string `json:"sourceFile"`
	ExpectedTest string `json:"expectedTest"`
	Language     string `json:"language,omitempty"`
}

// LanguageConfig defines test file conventions for a programming language.
type LanguageConfig struct {
	Extensions    []string       // Source file extensions (e.g., ".go", ".ps1")
	TestSuffix    string         // Test file suffix (e.g., "_test.go", ".Tests.ps1")
	TestPattern   *regexp.Regexp // Pattern to identify test files
	DefaultIgnore []string       // Default patterns to ignore
}

// LanguageConfigs maps language names to their configurations.
var LanguageConfigs = map[string]LanguageConfig{
	"go": {
		Extensions:  []string{".go"},
		TestSuffix:  "_test.go",
		TestPattern: regexp.MustCompile(`_test\.go$`),
		DefaultIgnore: []string{
			`_test\.go$`, // Test files themselves
			`/testdata/`, // Test data directories
			`/vendor/`,   // Vendor directory
			`/mocks?/`,   // Mock directories
			`doc\.go$`,   // Documentation files
			`/cmd/`,      // Command entry points (often thin)
			`/wasm/`,     // WASM entry points
			`main\.go$`,  // Main entry points
		},
	},
	"powershell": {
		Extensions:  []string{".ps1", ".psm1"},
		TestSuffix:  ".Tests.ps1",
		TestPattern: regexp.MustCompile(`\.Tests\.ps1$`),
		DefaultIgnore: []string{
			`\.Tests\.ps1$`,   // Test files themselves
			`tests?[\\/]`,     // Test directories
			`build[\\/]`,      // Build scripts
			`\.github[\\/]`,   // GitHub workflows
			`install.*\.ps1$`, // Installation scripts
			`Common\.psm1$`,   // Common modules
		},
	},
	"typescript": {
		Extensions:  []string{".ts", ".tsx"},
		TestSuffix:  ".test.ts",
		TestPattern: regexp.MustCompile(`\.(test|spec)\.(ts|tsx)$`),
		DefaultIgnore: []string{
			`\.(test|spec)\.(ts|tsx)$`, // Test files
			`/node_modules/`,           // Dependencies
			`/__tests__/`,              // Test directories
			`/__mocks__/`,              // Mock directories
			`\.d\.ts$`,                 // Type definitions
			`index\.ts$`,               // Index/barrel files
		},
	},
	"javascript": {
		Extensions:  []string{".js", ".jsx"},
		TestSuffix:  ".test.js",
		TestPattern: regexp.MustCompile(`\.(test|spec)\.(js|jsx)$`),
		DefaultIgnore: []string{
			`\.(test|spec)\.(js|jsx)$`, // Test files
			`/node_modules/`,           // Dependencies
			`/__tests__/`,              // Test directories
			`/__mocks__/`,              // Mock directories
		},
	},
	"python": {
		Extensions:  []string{".py"},
		TestSuffix:  "_test.py",
		TestPattern: regexp.MustCompile(`([\\/]test_[^\\/]+\.py$|_test\.py$)`),
		DefaultIgnore: []string{
			`[\\/]test_[^\\/]+\.py$`, // Test files (test_*.py)
			`_test\.py$`,             // Test files (*_test.py)
			`__pycache__`,            // Cache directories
			`/tests?/`,               // Test directories
			`setup\.py$`,             // Setup files
			`conftest\.py$`,          // pytest fixtures
		},
	},
	"csharp": {
		Extensions:  []string{".cs"},
		TestSuffix:  "Tests.cs",
		TestPattern: regexp.MustCompile(`Tests?\.cs$`),
		DefaultIgnore: []string{
			`Tests?\.cs$`,       // Test files
			`/obj/`,             // Build output
			`/bin/`,             // Build output
			`\.Designer\.cs$`,   // Generated files
			`AssemblyInfo\.cs$`, // Assembly info
			`GlobalUsings\.cs$`, // Global usings
		},
	},
}

// TestCoverageGapOptions configures the test coverage gap detection.
type TestCoverageGapOptions struct {
	BasePath       string   // Root path to scan
	Language       string   // Language to check (empty = auto-detect)
	StagedOnly     bool     // Only check git-staged files
	IgnoreFile     string   // Path to file containing patterns to ignore
	Threshold      float64  // Coverage threshold (0-100)
	CustomPatterns []string // Additional ignore patterns
}

// DetectTestCoverageGaps identifies source files without corresponding test files.
func DetectTestCoverageGaps(opts TestCoverageGapOptions) TestCoverageGapResult {
	result := TestCoverageGapResult{
		BasePath:   opts.BasePath,
		Language:   opts.Language,
		StagedOnly: opts.StagedOnly,
		Threshold:  opts.Threshold,
	}

	if opts.BasePath == "" {
		opts.BasePath = "."
	}

	// Resolve to absolute path
	absPath, err := filepath.Abs(opts.BasePath)
	if err != nil {
		result.Valid = false
		result.Message = "Failed to resolve path: " + err.Error()
		return result
	}
	result.BasePath = absPath

	// Find git repo root
	repoRoot := findGitRepoRoot(absPath)
	if repoRoot == "" {
		result.Valid = false
		result.Message = "Not in a git repository"
		return result
	}

	// Auto-detect language if not specified
	if opts.Language == "" {
		opts.Language = detectLanguage(absPath)
	}
	result.Language = opts.Language

	// Get language config
	langConfig, ok := LanguageConfigs[opts.Language]
	if !ok {
		result.Valid = false
		result.Message = "Unsupported language: " + opts.Language
		return result
	}

	// Build ignore patterns
	ignorePatterns := buildIgnorePatterns(langConfig, opts)
	result.IgnorePatterns = ignorePatterns

	// Get files to check
	var filesToCheck []string
	if opts.StagedOnly {
		filesToCheck = getGitStagedSourceFiles(repoRoot, langConfig)
	} else {
		filesToCheck = getAllSourceFiles(absPath, repoRoot, langConfig)
	}

	// Filter out ignored files
	filesToCheck = filterIgnoredFiles(filesToCheck, ignorePatterns)

	if len(filesToCheck) == 0 {
		result.Valid = true
		result.Message = "No source files to check for test coverage"
		result.CoveragePercent = 100.0
		return result
	}

	result.TotalSourceFiles = len(filesToCheck)

	// Check each file for corresponding test
	var missingTests []MissingTestFile
	var checks []Check

	for _, file := range filesToCheck {
		testPath := findExpectedTestPath(file, langConfig, repoRoot)
		hasTest := testFileExists(file, langConfig, repoRoot)

		if !hasTest {
			missingTests = append(missingTests, MissingTestFile{
				SourceFile:   makeRelativePath(file, repoRoot),
				ExpectedTest: makeRelativePath(testPath, repoRoot),
				Language:     opts.Language,
			})
		}
	}

	result.MissingTests = missingTests
	result.FilesWithoutTests = len(missingTests)
	result.FilesWithTests = result.TotalSourceFiles - result.FilesWithoutTests

	// Calculate coverage percentage
	if result.TotalSourceFiles > 0 {
		result.CoveragePercent = float64(result.FilesWithTests) / float64(result.TotalSourceFiles) * 100.0
	} else {
		result.CoveragePercent = 100.0
	}

	// Determine if valid based on threshold
	if opts.Threshold > 0 && result.CoveragePercent < opts.Threshold {
		result.Valid = false
		checks = append(checks, Check{
			Name:    "coverage_threshold",
			Passed:  false,
			Message: "Test coverage " + formatCoveragePercent(result.CoveragePercent) + " below threshold " + formatCoveragePercent(opts.Threshold),
		})
	} else {
		result.Valid = true
		checks = append(checks, Check{
			Name:    "coverage_threshold",
			Passed:  true,
			Message: "Test coverage " + formatCoveragePercent(result.CoveragePercent) + " meets threshold",
		})
	}

	// Add check for missing tests
	if len(missingTests) > 0 {
		checks = append(checks, Check{
			Name:    "missing_tests",
			Passed:  true, // Non-blocking warning
			Message: itoa(len(missingTests)) + " files without test coverage",
		})
	} else {
		checks = append(checks, Check{
			Name:    "missing_tests",
			Passed:  true,
			Message: "All source files have test coverage",
		})
	}

	result.Checks = checks

	if result.Valid {
		if len(missingTests) > 0 {
			result.Message = "Test coverage gaps detected (non-blocking)"
		} else {
			result.Message = "All source files have test coverage"
		}
	} else {
		result.Message = "Test coverage below threshold"
		result.Remediation = buildCoverageRemediation(missingTests, opts.Language)
	}

	return result
}

// DetectTestCoverageGapsForLanguage is a convenience function for single-language detection.
func DetectTestCoverageGapsForLanguage(basePath, language string, threshold float64) TestCoverageGapResult {
	return DetectTestCoverageGaps(TestCoverageGapOptions{
		BasePath:  basePath,
		Language:  language,
		Threshold: threshold,
	})
}

// DetectTestCoverageGapsStaged checks only git-staged files.
func DetectTestCoverageGapsStaged(basePath, language string) TestCoverageGapResult {
	return DetectTestCoverageGaps(TestCoverageGapOptions{
		BasePath:   basePath,
		Language:   language,
		StagedOnly: true,
	})
}

// findGitRepoRoot finds the git repository root from a starting directory.
func findGitRepoRoot(startDir string) string {
	cmd := exec.Command("git", "-C", startDir, "rev-parse", "--show-toplevel")
	output, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(output))
}

// detectLanguage auto-detects the primary language based on file extensions.
func detectLanguage(basePath string) string {
	counts := make(map[string]int)

	filepath.Walk(basePath, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}

		// Skip common non-source directories
		if strings.Contains(path, "/node_modules/") ||
			strings.Contains(path, "/vendor/") ||
			strings.Contains(path, "/.git/") {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		for lang, config := range LanguageConfigs {
			for _, langExt := range config.Extensions {
				if ext == langExt && !config.TestPattern.MatchString(path) {
					counts[lang]++
				}
			}
		}
		return nil
	})

	// Find language with most files
	maxCount := 0
	detected := "go" // Default to Go
	for lang, count := range counts {
		if count > maxCount {
			maxCount = count
			detected = lang
		}
	}

	return detected
}

// buildIgnorePatterns builds the complete list of ignore patterns.
func buildIgnorePatterns(langConfig LanguageConfig, opts TestCoverageGapOptions) []string {
	patterns := make([]string, 0)

	// Add default ignores for the language
	patterns = append(patterns, langConfig.DefaultIgnore...)

	// Add custom patterns
	patterns = append(patterns, opts.CustomPatterns...)

	// Load patterns from ignore file
	if opts.IgnoreFile != "" {
		filePatterns := loadIgnoreFile(opts.IgnoreFile)
		patterns = append(patterns, filePatterns...)
	}

	return patterns
}

// loadIgnoreFile loads ignore patterns from a file.
func loadIgnoreFile(path string) []string {
	var patterns []string

	file, err := os.Open(path)
	if err != nil {
		return patterns
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		// Skip empty lines and comments
		if line != "" && !strings.HasPrefix(line, "#") {
			patterns = append(patterns, line)
		}
	}

	return patterns
}

// getGitStagedSourceFiles gets git-staged source files for a specific language.
func getGitStagedSourceFiles(repoRoot string, langConfig LanguageConfig) []string {
	var files []string

	cmd := exec.Command("git", "-C", repoRoot, "diff", "--cached", "--name-only", "--diff-filter=ACMR")
	output, err := cmd.Output()
	if err != nil {
		return files
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Check if file has matching extension
		ext := filepath.Ext(line)
		for _, langExt := range langConfig.Extensions {
			if ext == langExt && !langConfig.TestPattern.MatchString(line) {
				fullPath := filepath.Join(repoRoot, line)
				files = append(files, fullPath)
				break
			}
		}
	}

	return files
}

// getAllSourceFiles gets all source files in the path.
func getAllSourceFiles(basePath, repoRoot string, langConfig LanguageConfig) []string {
	var files []string

	filepath.Walk(basePath, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}

		// Skip .git directory
		if strings.Contains(path, "/.git/") || strings.Contains(path, "\\.git\\") {
			return nil
		}

		// Check extension
		ext := filepath.Ext(path)
		for _, langExt := range langConfig.Extensions {
			if ext == langExt && !langConfig.TestPattern.MatchString(path) {
				files = append(files, path)
				break
			}
		}

		return nil
	})

	return files
}

// filterIgnoredFiles filters out files matching ignore patterns.
func filterIgnoredFiles(files []string, patterns []string) []string {
	var filtered []string

	compiledPatterns := make([]*regexp.Regexp, 0)
	for _, pattern := range patterns {
		re, err := regexp.Compile(pattern)
		if err == nil {
			compiledPatterns = append(compiledPatterns, re)
		}
	}

	for _, file := range files {
		ignored := false
		// Normalize path separators for matching
		normalizedPath := strings.ReplaceAll(file, "\\", "/")

		for _, re := range compiledPatterns {
			if re.MatchString(normalizedPath) {
				ignored = true
				break
			}
		}

		if !ignored {
			filtered = append(filtered, file)
		}
	}

	return filtered
}

// findExpectedTestPath calculates the expected test file path.
func findExpectedTestPath(sourcePath string, langConfig LanguageConfig, repoRoot string) string {
	dir := filepath.Dir(sourcePath)
	base := filepath.Base(sourcePath)
	ext := filepath.Ext(base)
	nameWithoutExt := strings.TrimSuffix(base, ext)

	var testFileName string
	switch langConfig.TestSuffix {
	case "_test.go":
		testFileName = nameWithoutExt + "_test.go"
	case ".Tests.ps1":
		testFileName = nameWithoutExt + ".Tests.ps1"
	case ".test.ts":
		testFileName = nameWithoutExt + ".test.ts"
	case ".test.js":
		testFileName = nameWithoutExt + ".test.js"
	case "_test.py":
		testFileName = "test_" + nameWithoutExt + ".py"
	case "Tests.cs":
		testFileName = nameWithoutExt + "Tests.cs"
	default:
		testFileName = nameWithoutExt + langConfig.TestSuffix
	}

	return filepath.Join(dir, testFileName)
}

// testFileExists checks if a test file exists for the source file.
func testFileExists(sourcePath string, langConfig LanguageConfig, repoRoot string) bool {
	dir := filepath.Dir(sourcePath)
	base := filepath.Base(sourcePath)
	ext := filepath.Ext(base)
	nameWithoutExt := strings.TrimSuffix(base, ext)

	// Check primary location (same directory)
	primaryTest := findExpectedTestPath(sourcePath, langConfig, repoRoot)
	if fileExists(primaryTest) {
		return true
	}

	// Check tests/ subdirectory
	testsSubdir := filepath.Join(dir, "tests")
	testInSubdir := filepath.Join(testsSubdir, filepath.Base(primaryTest))
	if fileExists(testInSubdir) {
		return true
	}

	// For Go, also check in a 'tests' directory relative to repo root
	if langConfig.TestSuffix == "_test.go" {
		// Calculate relative path from repo root
		relPath, err := filepath.Rel(repoRoot, dir)
		if err == nil {
			testsDir := filepath.Join(repoRoot, "tests", relPath)
			testInTestsDir := filepath.Join(testsDir, nameWithoutExt+"_test.go")
			if fileExists(testInTestsDir) {
				return true
			}
		}
	}

	// For Python, check test_*.py naming convention
	if langConfig.TestSuffix == "_test.py" {
		altTestName := "test_" + nameWithoutExt + ".py"
		altTestPath := filepath.Join(dir, altTestName)
		if fileExists(altTestPath) {
			return true
		}

		// Check in tests/ subdirectory
		altTestInSubdir := filepath.Join(testsSubdir, altTestName)
		if fileExists(altTestInSubdir) {
			return true
		}
	}

	// For TypeScript/JavaScript, check .spec.* variant
	if strings.HasSuffix(langConfig.TestSuffix, ".test.ts") || strings.HasSuffix(langConfig.TestSuffix, ".test.js") {
		specSuffix := strings.Replace(langConfig.TestSuffix, ".test.", ".spec.", 1)
		specTestPath := filepath.Join(dir, nameWithoutExt+specSuffix)
		if fileExists(specTestPath) {
			return true
		}
	}

	return false
}

// makeRelativePath converts an absolute path to relative path from repo root.
func makeRelativePath(absPath, repoRoot string) string {
	rel, err := filepath.Rel(repoRoot, absPath)
	if err != nil {
		return absPath
	}
	// Normalize to forward slashes for consistency
	return strings.ReplaceAll(rel, "\\", "/")
}

// formatCoveragePercent formats a coverage percentage value.
func formatCoveragePercent(value float64) string {
	return itoa(int(value)) + "%"
}

// buildCoverageRemediation builds remediation message for missing tests.
func buildCoverageRemediation(missing []MissingTestFile, language string) string {
	if len(missing) == 0 {
		return ""
	}

	var sb strings.Builder
	sb.WriteString("Add test files for the following source files:\n")

	// Show up to 10 examples
	maxShow := 10
	if len(missing) < maxShow {
		maxShow = len(missing)
	}

	for i := 0; i < maxShow; i++ {
		sb.WriteString("  - ")
		sb.WriteString(missing[i].SourceFile)
		sb.WriteString(" -> ")
		sb.WriteString(missing[i].ExpectedTest)
		sb.WriteString("\n")
	}

	if len(missing) > 10 {
		sb.WriteString("  ... and ")
		sb.WriteString(itoa(len(missing) - 10))
		sb.WriteString(" more files\n")
	}

	return sb.String()
}

// GetSupportedLanguages returns a list of supported language names.
func GetSupportedLanguages() []string {
	languages := make([]string, 0, len(LanguageConfigs))
	for lang := range LanguageConfigs {
		languages = append(languages, lang)
	}
	return languages
}

// AddLanguageConfig adds or updates a language configuration.
func AddLanguageConfig(name string, config LanguageConfig) {
	LanguageConfigs[name] = config
}
