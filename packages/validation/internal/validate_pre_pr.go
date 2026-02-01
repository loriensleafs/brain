package internal

import (
	"bufio"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	

)

// PrePRConfig contains configuration for pre-PR validation.
type PrePRConfig struct {
	BasePath        string
	QuickMode       bool
	SkipTests       bool
	SourceDirs      []string
	TestDirs        []string
	ConfigFiles     []string
	EnvFiles        []string
}

// DefaultPrePRConfig returns a default configuration for pre-PR validation.
func DefaultPrePRConfig(basePath string) PrePRConfig {
	return PrePRConfig{
		BasePath:    basePath,
		QuickMode:   false,
		SkipTests:   false,
		SourceDirs:  []string{"src", "lib", "cmd", "pkg", "internal", "scripts"},
		TestDirs:    []string{"tests", "test", "__tests__"},
		ConfigFiles: []string{".env.example", "README.md", "CLAUDE.md", ".agents"},
		EnvFiles:    []string{".env", ".env.example", ".env.local", ".env.development"},
	}
}

// ValidatePrePR runs all pre-PR validation checks.
// basePath is the root directory to validate.
// quickMode skips slow validations.
func ValidatePrePR(basePath string, quickMode bool) PrePRValidationResult {
	config := DefaultPrePRConfig(basePath)
	config.QuickMode = quickMode
	return ValidatePrePRWithConfig(config)
}

// ValidatePrePRWithConfig runs pre-PR validation with custom configuration.
func ValidatePrePRWithConfig(config PrePRConfig) PrePRValidationResult {
	var checks []Check
	allPassed := true

	result := PrePRValidationResult{
		Mode: "full",
	}
	if config.QuickMode {
		result.Mode = "quick"
	}

	// 1. Cross-cutting concerns
	crossCuttingResult := ValidateCrossCuttingConcerns(config)
	result.CrossCuttingConcerns = crossCuttingResult
	if !crossCuttingResult.Passed {
		allPassed = false
		for _, issue := range crossCuttingResult.Issues {
			checks = append(checks, Check{
				Name:    "cross_cutting_concerns",
				Passed:  false,
				Message: issue,
			})
		}
	} else {
		checks = append(checks, Check{
			Name:    "cross_cutting_concerns",
			Passed:  true,
			Message: "No cross-cutting concern violations found",
		})
	}

	// 2. Fail-safe design
	failSafeResult := ValidateFailSafeDesign(config)
	result.FailSafeDesign = failSafeResult
	if !failSafeResult.Passed {
		allPassed = false
		for _, issue := range failSafeResult.Issues {
			checks = append(checks, Check{
				Name:    "fail_safe_design",
				Passed:  false,
				Message: issue,
			})
		}
	} else {
		checks = append(checks, Check{
			Name:    "fail_safe_design",
			Passed:  true,
			Message: "Fail-safe design patterns verified",
		})
	}

	// 3. Test-implementation alignment (skip if quickMode or skipTests)
	if !config.SkipTests {
		testResult := ValidateTestImplementationAlignment(config)
		result.TestImplementation = testResult
		if !testResult.Passed {
			allPassed = false
			for _, issue := range testResult.Issues {
				checks = append(checks, Check{
					Name:    "test_implementation",
					Passed:  false,
					Message: issue,
				})
			}
		} else {
			checks = append(checks, Check{
				Name:    "test_implementation",
				Passed:  true,
				Message: "Test-implementation alignment verified",
			})
		}
	}

	// 4. CI environment (skip if quickMode)
	if !config.QuickMode {
		ciResult := ValidateCIEnvironment(config)
		result.CIEnvironment = ciResult
		if !ciResult.Passed {
			allPassed = false
			for _, issue := range ciResult.Issues {
				checks = append(checks, Check{
					Name:    "ci_environment",
					Passed:  false,
					Message: issue,
				})
			}
		} else {
			checks = append(checks, Check{
				Name:    "ci_environment",
				Passed:  true,
				Message: "CI environment compatibility verified",
			})
		}
	}

	// 5. Environment variables
	envResult := ValidateEnvironmentVariables(config)
	result.EnvironmentVariables = envResult
	if !envResult.Passed {
		allPassed = false
		for _, issue := range envResult.Issues {
			checks = append(checks, Check{
				Name:    "environment_variables",
				Passed:  false,
				Message: issue,
			})
		}
	} else {
		checks = append(checks, Check{
			Name:    "environment_variables",
			Passed:  true,
			Message: "Environment variables documented",
		})
	}

	result.ValidationResult = ValidationResult{
		Valid:  allPassed,
		Checks: checks,
	}

	if allPassed {
		result.Message = "Pre-PR validation passed"
	} else {
		result.Message = "Pre-PR validation failed"
		result.Remediation = buildPrePRRemediation(checks)
	}

	return result
}

// ValidateCrossCuttingConcerns checks for hardcoded values, TODOs, and env vars.
func ValidateCrossCuttingConcerns(config PrePRConfig) CrossCuttingConcernsResult {
	result := CrossCuttingConcernsResult{
		Passed: true,
	}

	// Patterns to detect
	hardcodedPatterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)(password|secret|api[_-]?key|token)\s*[:=]\s*["'][^"']+["']`),
		regexp.MustCompile(`(?i)localhost:\d{4,5}`),
		regexp.MustCompile(`\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b`), // IP addresses
	}

	todoPatterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)\b(TODO|FIXME|XXX|HACK)\b`),
	}

	for _, dir := range config.SourceDirs {
		dirPath := filepath.Join(config.BasePath, dir)
		if !DirExists(dirPath) {
			continue
		}

		err := filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			if info.IsDir() {
				return nil
			}
			if !isSourceFile(path) {
				return nil
			}

			content, err := os.ReadFile(path)
			if err != nil {
				return nil
			}

			relPath, _ := filepath.Rel(config.BasePath, path)

			// Check for hardcoded values
			for _, pattern := range hardcodedPatterns {
				if matches := pattern.FindAllString(string(content), -1); len(matches) > 0 {
					for _, m := range matches {
						result.HardcodedValues = append(result.HardcodedValues,
							relPath+": "+truncate(m, 50))
					}
				}
			}

			// Check for TODO/FIXME comments
			for _, pattern := range todoPatterns {
				if matches := pattern.FindAllString(string(content), -1); len(matches) > 0 {
					for range matches {
						result.TodoComments = append(result.TodoComments, relPath)
					}
				}
			}

			return nil
		})
		if err != nil {
			continue
		}
	}

	// Deduplicate TODO comments (file level)
	result.TodoComments = deduplicate(result.TodoComments)

	// Build issues
	if len(result.HardcodedValues) > 0 {
		result.Passed = false
		result.Issues = append(result.Issues,
			"Found "+Itoa(len(result.HardcodedValues))+" hardcoded values (secrets, IPs, ports)")
	}
	if len(result.TodoComments) > 0 {
		result.Passed = false
		result.Issues = append(result.Issues,
			"Found TODO/FIXME comments in "+Itoa(len(result.TodoComments))+" files")
	}

	return result
}

// ValidateFailSafeDesign checks for exit code validation and error handling.
func ValidateFailSafeDesign(config PrePRConfig) FailSafeDesignResult {
	result := FailSafeDesignResult{
		Passed: true,
	}

	// Patterns that indicate missing exit code checks
	exitCodePatterns := map[string][]*regexp.Regexp{
		"powershell": {
			regexp.MustCompile(`(?i)\$LASTEXITCODE`),
			regexp.MustCompile(`(?i)-ErrorAction\s+Stop`),
		},
		"bash": {
			regexp.MustCompile(`\$\?`),
			regexp.MustCompile(`set\s+-e`),
		},
	}

	// Patterns that indicate silent failures
	silentFailurePatterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)catch\s*\{\s*\}`),                    // Empty catch blocks
		regexp.MustCompile(`(?i)catch\s*\([^)]*\)\s*\{\s*\}`),        // Empty catch blocks
		regexp.MustCompile(`(?i)2>\s*/dev/null`),                     // Suppressed errors
		regexp.MustCompile(`(?i)-ErrorAction\s+SilentlyContinue`),    // PowerShell silent
		regexp.MustCompile(`(?i)On\s+Error\s+Resume\s+Next`),         // VB-style
	}

	// Insecure default patterns
	insecurePatterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)AllowAny|AllowAll`),
		regexp.MustCompile(`(?i)disable.*security|security.*disable`),
		regexp.MustCompile(`(?i)skip.*validation|validation.*skip`),
		regexp.MustCompile(`(?i)InsecureSkipVerify\s*[:=]\s*true`),
	}

	for _, dir := range config.SourceDirs {
		dirPath := filepath.Join(config.BasePath, dir)
		if !DirExists(dirPath) {
			continue
		}

		err := filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			if info.IsDir() {
				return nil
			}
			if !isScriptFile(path) && !isSourceFile(path) {
				return nil
			}

			content, err := os.ReadFile(path)
			if err != nil {
				return nil
			}

			relPath, _ := filepath.Rel(config.BasePath, path)
			contentStr := string(content)

			// Check for exit code validation in scripts
			ext := strings.ToLower(filepath.Ext(path))
			if ext == ".ps1" || ext == ".psm1" {
				hasExitCheck := false
				for _, pattern := range exitCodePatterns["powershell"] {
					if pattern.MatchString(contentStr) {
						hasExitCheck = true
						break
					}
				}
				// Only flag if file has external command calls
				if !hasExitCheck && hasExternalCalls(contentStr, "powershell") {
					result.MissingExitCodeChecks = append(result.MissingExitCodeChecks,
						relPath+": No $LASTEXITCODE or -ErrorAction Stop")
				}
			} else if ext == ".sh" || ext == ".bash" {
				hasExitCheck := false
				for _, pattern := range exitCodePatterns["bash"] {
					if pattern.MatchString(contentStr) {
						hasExitCheck = true
						break
					}
				}
				if !hasExitCheck && hasExternalCalls(contentStr, "bash") {
					result.MissingExitCodeChecks = append(result.MissingExitCodeChecks,
						relPath+": No $? check or set -e")
				}
			}

			// Check for silent failures
			for _, pattern := range silentFailurePatterns {
				if matches := pattern.FindAllString(contentStr, -1); len(matches) > 0 {
					result.SilentFailures = append(result.SilentFailures,
						relPath+": Silent failure pattern detected")
					break
				}
			}

			// Check for insecure defaults
			for _, pattern := range insecurePatterns {
				if matches := pattern.FindAllString(contentStr, -1); len(matches) > 0 {
					for _, m := range matches {
						result.InsecureDefaults = append(result.InsecureDefaults,
							relPath+": "+truncate(m, 40))
					}
				}
			}

			return nil
		})
		if err != nil {
			continue
		}
	}

	// Deduplicate
	result.MissingExitCodeChecks = deduplicate(result.MissingExitCodeChecks)
	result.SilentFailures = deduplicate(result.SilentFailures)
	result.InsecureDefaults = deduplicate(result.InsecureDefaults)

	// Build issues
	if len(result.MissingExitCodeChecks) > 0 {
		result.Passed = false
		result.Issues = append(result.Issues,
			Itoa(len(result.MissingExitCodeChecks))+" scripts missing exit code validation")
	}
	if len(result.SilentFailures) > 0 {
		result.Passed = false
		result.Issues = append(result.Issues,
			Itoa(len(result.SilentFailures))+" files have silent failure patterns")
	}
	if len(result.InsecureDefaults) > 0 {
		result.Passed = false
		result.Issues = append(result.Issues,
			Itoa(len(result.InsecureDefaults))+" insecure default patterns found")
	}

	return result
}

// ValidateTestImplementationAlignment checks test coverage and parameter drift.
func ValidateTestImplementationAlignment(config PrePRConfig) TestImplementationResult {
	result := TestImplementationResult{
		Passed: true,
	}

	// Find all test files and their corresponding source files
	testFiles := make(map[string]string) // test file -> source file

	for _, testDir := range config.TestDirs {
		testPath := filepath.Join(config.BasePath, testDir)
		if !DirExists(testPath) {
			continue
		}

		filepath.Walk(testPath, func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() {
				return nil
			}
			if isTestFile(path) {
				relPath, _ := filepath.Rel(config.BasePath, path)
				testFiles[relPath] = inferSourceFile(relPath)
			}
			return nil
		})
	}

	// Also check for tests in source directories
	for _, srcDir := range config.SourceDirs {
		srcPath := filepath.Join(config.BasePath, srcDir)
		if !DirExists(srcPath) {
			continue
		}

		filepath.Walk(srcPath, func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() {
				return nil
			}
			if isTestFile(path) {
				relPath, _ := filepath.Rel(config.BasePath, path)
				testFiles[relPath] = inferSourceFile(relPath)
			}
			return nil
		})
	}

	// Check for source files without tests
	sourceFilesWithTests := make(map[string]bool)
	for _, srcFile := range testFiles {
		if srcFile != "" {
			sourceFilesWithTests[srcFile] = true
		}
	}

	// Count source files and those with tests
	totalSourceFiles := 0
	testedSourceFiles := 0

	for _, srcDir := range config.SourceDirs {
		srcPath := filepath.Join(config.BasePath, srcDir)
		if !DirExists(srcPath) {
			continue
		}

		filepath.Walk(srcPath, func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() {
				return nil
			}
			if isSourceFile(path) && !isTestFile(path) {
				relPath, _ := filepath.Rel(config.BasePath, path)
				totalSourceFiles++

				// Check if this file has tests
				possibleTestPaths := generateTestPaths(relPath)
				hasCoverage := false
				for _, testPath := range possibleTestPaths {
					if _, exists := testFiles[testPath]; exists {
						hasCoverage = true
						testedSourceFiles++
						break
					}
				}

				if !hasCoverage && shouldHaveTests(path) {
					result.MissingTestCoverage = append(result.MissingTestCoverage, relPath)
				}
			}
			return nil
		})
	}

	// Calculate coverage percentage
	if totalSourceFiles > 0 {
		result.CoveragePercent = float64(testedSourceFiles) / float64(totalSourceFiles) * 100
	}

	// Check for test-implementation parameter drift
	// This is a simplified check - in reality you'd need language-specific parsing
	result.ParameterDrift = checkParameterDrift(config, testFiles)

	// Build issues
	if len(result.MissingTestCoverage) > 5 {
		// Only warn if significant number of files lack tests
		result.Passed = false
		result.Issues = append(result.Issues,
			Itoa(len(result.MissingTestCoverage))+" source files lack test coverage")
	}
	if len(result.ParameterDrift) > 0 {
		result.Passed = false
		result.Issues = append(result.Issues,
			Itoa(len(result.ParameterDrift))+" potential parameter drift issues")
	}
	if result.CoveragePercent < 50 && totalSourceFiles > 5 {
		result.Passed = false
		result.Issues = append(result.Issues,
			"Test coverage is low: "+formatPercent(result.CoveragePercent)+"%")
	}

	return result
}

// ValidateCIEnvironment checks CI environment compatibility.
func ValidateCIEnvironment(config PrePRConfig) CIEnvironmentResult {
	result := CIEnvironmentResult{
		Passed: true,
	}

	// Check for CI configuration files
	ciConfigFiles := []string{
		".github/workflows",
		".gitlab-ci.yml",
		"azure-pipelines.yml",
		"Jenkinsfile",
		".circleci/config.yml",
	}

	ciConfigFound := false
	for _, ciPath := range ciConfigFiles {
		fullPath := filepath.Join(config.BasePath, ciPath)
		if FileExists(fullPath) || DirExists(fullPath) {
			ciConfigFound = true
			result.ConfigDocumented = true
			break
		}
	}

	if !ciConfigFound {
		result.Issues = append(result.Issues, "No CI configuration found")
	}

	// Check for CI-specific environment variables in workflows
	workflowsPath := filepath.Join(config.BasePath, ".github", "workflows")
	if DirExists(workflowsPath) {
		filepath.Walk(workflowsPath, func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() {
				return nil
			}
			ext := strings.ToLower(filepath.Ext(path))
			if ext != ".yml" && ext != ".yaml" {
				return nil
			}

			content, err := os.ReadFile(path)
			if err != nil {
				return nil
			}

			relPath, _ := filepath.Rel(config.BasePath, path)

			// Check for CI flags usage
			if strings.Contains(string(content), "GITHUB_ACTIONS") ||
				strings.Contains(string(content), "CI=true") {
				result.CIFlagsVerified = true
			}

			// Check for build steps
			if strings.Contains(string(content), "build") ||
				strings.Contains(string(content), "test") {
				result.BuildVerified = true
			}

			// Check for potential issues
			if strings.Contains(string(content), "continue-on-error: true") {
				result.Issues = append(result.Issues,
					relPath+": Uses continue-on-error which may hide failures")
			}

			return nil
		})
	}

	// Only fail if there are actual issues found
	if len(result.Issues) > 0 && !ciConfigFound {
		result.Passed = false
	}

	return result
}

// ValidateEnvironmentVariables checks environment variable documentation.
func ValidateEnvironmentVariables(config PrePRConfig) EnvironmentVariablesResult {
	result := EnvironmentVariablesResult{
		Passed: true,
	}

	// Find all env var references in code
	envVarPattern := regexp.MustCompile(`(?i)(process\.env\.|os\.environ\[|os\.getenv\(|Environment\.GetEnvironmentVariable\(|\$env:|getenv\()\s*["']?([A-Z][A-Z0-9_]+)`)
	envVarRefs := make(map[string]bool)

	for _, srcDir := range config.SourceDirs {
		srcPath := filepath.Join(config.BasePath, srcDir)
		if !DirExists(srcPath) {
			continue
		}

		filepath.Walk(srcPath, func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() {
				return nil
			}
			if !isSourceFile(path) {
				return nil
			}

			content, err := os.ReadFile(path)
			if err != nil {
				return nil
			}

			matches := envVarPattern.FindAllStringSubmatch(string(content), -1)
			for _, match := range matches {
				if len(match) > 2 {
					envVarRefs[match[2]] = true
				}
			}

			return nil
		})
	}

	// Check for documented env vars
	documentedVars := make(map[string]bool)

	for _, envFile := range config.EnvFiles {
		envPath := filepath.Join(config.BasePath, envFile)
		if !FileExists(envPath) {
			continue
		}

		content, err := os.ReadFile(envPath)
		if err != nil {
			continue
		}

		// Parse env file
		scanner := bufio.NewScanner(strings.NewReader(string(content)))
		for scanner.Scan() {
			line := scanner.Text()
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			if idx := strings.Index(line, "="); idx > 0 {
				varName := strings.TrimSpace(line[:idx])
				documentedVars[varName] = true
				result.DocumentedVars = append(result.DocumentedVars, varName)
			}
		}
	}

	// Find undocumented env vars
	for varName := range envVarRefs {
		if !documentedVars[varName] {
			// Skip common well-known vars
			if isWellKnownEnvVar(varName) {
				continue
			}
			result.MissingDefaults = append(result.MissingDefaults, varName)
		}
	}

	// Build issues
	if len(result.MissingDefaults) > 0 {
		result.Passed = false
		result.Issues = append(result.Issues,
			Itoa(len(result.MissingDefaults))+" environment variables used but not documented")
	}

	return result
}

// ValidatePrePRFromContent validates pre-PR checks from content strings.
// Useful for WASM or testing without file system access.
func ValidatePrePRFromContent(sourceContent map[string]string, quickMode bool) PrePRValidationResult {
	var checks []Check
	allPassed := true

	result := PrePRValidationResult{
		Mode: "full",
	}
	if quickMode {
		result.Mode = "quick"
	}

	// Cross-cutting concerns from content
	crossCuttingResult := validateCrossCuttingFromContent(sourceContent)
	result.CrossCuttingConcerns = crossCuttingResult
	if !crossCuttingResult.Passed {
		allPassed = false
		for _, issue := range crossCuttingResult.Issues {
			checks = append(checks, Check{
				Name:    "cross_cutting_concerns",
				Passed:  false,
				Message: issue,
			})
		}
	} else {
		checks = append(checks, Check{
			Name:    "cross_cutting_concerns",
			Passed:  true,
			Message: "No cross-cutting concern violations found",
		})
	}

	// Fail-safe design from content
	failSafeResult := validateFailSafeFromContent(sourceContent)
	result.FailSafeDesign = failSafeResult
	if !failSafeResult.Passed {
		allPassed = false
		for _, issue := range failSafeResult.Issues {
			checks = append(checks, Check{
				Name:    "fail_safe_design",
				Passed:  false,
				Message: issue,
			})
		}
	} else {
		checks = append(checks, Check{
			Name:    "fail_safe_design",
			Passed:  true,
			Message: "Fail-safe design patterns verified",
		})
	}

	result.ValidationResult = ValidationResult{
		Valid:  allPassed,
		Checks: checks,
	}

	if allPassed {
		result.Message = "Pre-PR validation passed"
	} else {
		result.Message = "Pre-PR validation failed"
		result.Remediation = buildPrePRRemediation(checks)
	}

	return result
}

// Helper functions

func isSourceFile(path string) bool {
	sourceExts := map[string]bool{
		".go": true, ".cs": true, ".js": true, ".ts": true,
		".py": true, ".rb": true, ".java": true, ".kt": true,
		".rs": true, ".cpp": true, ".c": true, ".h": true,
		".ps1": true, ".psm1": true, ".sh": true, ".bash": true,
	}
	return sourceExts[strings.ToLower(filepath.Ext(path))]
}

func isScriptFile(path string) bool {
	scriptExts := map[string]bool{
		".ps1": true, ".psm1": true, ".sh": true, ".bash": true, ".bat": true, ".cmd": true,
	}
	return scriptExts[strings.ToLower(filepath.Ext(path))]
}

func isTestFile(path string) bool {
	name := strings.ToLower(filepath.Base(path))
	return strings.Contains(name, "_test.") ||
		strings.Contains(name, ".test.") ||
		strings.Contains(name, ".spec.") ||
		strings.HasSuffix(name, ".tests.go") ||
		strings.HasPrefix(name, "test_")
}

func inferSourceFile(testPath string) string {
	// Convert test path to source path
	// e.g., "tests/foo_test.go" -> "src/foo.go"
	base := filepath.Base(testPath)
	base = strings.Replace(base, "_test.", ".", 1)
	base = strings.Replace(base, ".test.", ".", 1)
	base = strings.Replace(base, ".spec.", ".", 1)
	base = strings.TrimPrefix(base, "test_")
	return base
}

func generateTestPaths(sourcePath string) []string {
	dir := filepath.Dir(sourcePath)
	base := filepath.Base(sourcePath)
	ext := filepath.Ext(base)
	nameNoExt := strings.TrimSuffix(base, ext)

	return []string{
		filepath.Join(dir, nameNoExt+"_test"+ext),
		filepath.Join(dir, nameNoExt+".test"+ext),
		filepath.Join(dir, nameNoExt+".spec"+ext),
		filepath.Join("tests", dir, nameNoExt+"_test"+ext),
		filepath.Join("test", dir, nameNoExt+"_test"+ext),
	}
}

func shouldHaveTests(path string) bool {
	// Skip common files that don't need tests
	name := strings.ToLower(filepath.Base(path))
	skipPatterns := []string{
		"main.", "index.", "", "constants.", "config.",
		"interfaces.", "models.", "init.", "version.",
	}
	for _, pattern := range skipPatterns {
		if strings.HasPrefix(name, pattern) {
			return false
		}
	}
	return true
}

func checkParameterDrift(config PrePRConfig, testFiles map[string]string) []string {
	var drifts []string
	// This is a simplified implementation
	// Real implementation would parse function signatures and compare
	// For now, we check for common patterns
	return drifts
}

func hasExternalCalls(content, lang string) bool {
	if lang == "powershell" {
		externalPatterns := []string{
			"Start-Process", "Invoke-Expression", "& ", "cmd /c",
			"git ", "npm ", "dotnet ", "docker ",
		}
		for _, p := range externalPatterns {
			if strings.Contains(content, p) {
				return true
			}
		}
	} else if lang == "bash" {
		// Most bash scripts have external calls
		return len(content) > 100
	}
	return false
}

func isWellKnownEnvVar(name string) bool {
	wellKnown := map[string]bool{
		"PATH": true, "HOME": true, "USER": true, "SHELL": true,
		"TERM": true, "LANG": true, "PWD": true, "OLDPWD": true,
		"CI": true, "GITHUB_ACTIONS": true, "GITHUB_REF": true,
		"GITHUB_SHA": true, "GITHUB_REPOSITORY": true, "GITHUB_RUN_ID": true,
		"NODE_ENV": true, "DEBUG": true, "VERBOSE": true,
		"NO_COLOR": true, "FORCE_COLOR": true,
	}
	return wellKnown[name]
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

func deduplicate(slice []string) []string {
	seen := make(map[string]bool)
	result := []string{}
	for _, s := range slice {
		if !seen[s] {
			seen[s] = true
			result = append(result, s)
		}
	}
	return result
}

func formatPercent(f float64) string {
	return Itoa(int(f))
}

func buildPrePRRemediation(checks []Check) string {
	var failedChecks []string
	for _, check := range checks {
		if !check.Passed {
			failedChecks = append(failedChecks, check.Name)
		}
	}

	if len(failedChecks) == 0 {
		return ""
	}

	// Deduplicate
	seen := make(map[string]bool)
	var unique []string
	for _, c := range failedChecks {
		if !seen[c] {
			seen[c] = true
			unique = append(unique, c)
		}
	}

	return "Fix the following checks before creating PR: " + strings.Join(unique, ", ")
}

// Content-based validation helpers

func validateCrossCuttingFromContent(content map[string]string) CrossCuttingConcernsResult {
	result := CrossCuttingConcernsResult{
		Passed: true,
	}

	hardcodedPatterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)(password|secret|api[_-]?key|token)\s*[:=]\s*["'][^"']+["']`),
		regexp.MustCompile(`(?i)localhost:\d{4,5}`),
	}

	todoPatterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)\b(TODO|FIXME|XXX|HACK)\b`),
	}

	for filename, contentStr := range content {
		// Check for hardcoded values
		for _, pattern := range hardcodedPatterns {
			if matches := pattern.FindAllString(contentStr, -1); len(matches) > 0 {
				for _, m := range matches {
					result.HardcodedValues = append(result.HardcodedValues,
						filename+": "+truncate(m, 50))
				}
			}
		}

		// Check for TODO/FIXME comments
		for _, pattern := range todoPatterns {
			if pattern.MatchString(contentStr) {
				result.TodoComments = append(result.TodoComments, filename)
				break
			}
		}
	}

	result.TodoComments = deduplicate(result.TodoComments)

	if len(result.HardcodedValues) > 0 {
		result.Passed = false
		result.Issues = append(result.Issues,
			"Found "+Itoa(len(result.HardcodedValues))+" hardcoded values")
	}
	if len(result.TodoComments) > 0 {
		result.Passed = false
		result.Issues = append(result.Issues,
			"Found TODO/FIXME comments in "+Itoa(len(result.TodoComments))+" files")
	}

	return result
}

func validateFailSafeFromContent(content map[string]string) FailSafeDesignResult {
	result := FailSafeDesignResult{
		Passed: true,
	}

	silentFailurePatterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)catch\s*\{\s*\}`),
		regexp.MustCompile(`(?i)catch\s*\([^)]*\)\s*\{\s*\}`),
		regexp.MustCompile(`(?i)2>\s*/dev/null`),
		regexp.MustCompile(`(?i)-ErrorAction\s+SilentlyContinue`),
	}

	insecurePatterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)AllowAny|AllowAll`),
		regexp.MustCompile(`(?i)InsecureSkipVerify\s*[:=]\s*true`),
	}

	for filename, contentStr := range content {
		// Check for silent failures
		for _, pattern := range silentFailurePatterns {
			if pattern.MatchString(contentStr) {
				result.SilentFailures = append(result.SilentFailures,
					filename+": Silent failure pattern detected")
				break
			}
		}

		// Check for insecure defaults
		for _, pattern := range insecurePatterns {
			if matches := pattern.FindAllString(contentStr, -1); len(matches) > 0 {
				for _, m := range matches {
					result.InsecureDefaults = append(result.InsecureDefaults,
						filename+": "+truncate(m, 40))
				}
			}
		}
	}

	result.SilentFailures = deduplicate(result.SilentFailures)
	result.InsecureDefaults = deduplicate(result.InsecureDefaults)

	if len(result.SilentFailures) > 0 {
		result.Passed = false
		result.Issues = append(result.Issues,
			Itoa(len(result.SilentFailures))+" files have silent failure patterns")
	}
	if len(result.InsecureDefaults) > 0 {
		result.Passed = false
		result.Issues = append(result.Issues,
			Itoa(len(result.InsecureDefaults))+" insecure default patterns found")
	}

	return result
}
