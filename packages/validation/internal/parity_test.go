package internal

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// ParityTestCase represents a single test case for cross-language parity testing.
type ParityTestCase struct {
	Name               string `json:"name"`
	Data               any    `json:"data"`
	ExpectedConstraint string `json:"expectedConstraint,omitempty"`
}

// ParityTestSuite represents test cases for a single schema.
type ParityTestSuite struct {
	Valid   []ParityTestCase `json:"valid"`
	Invalid []ParityTestCase `json:"invalid"`
}

// ParityTestFixtures represents all test fixtures.
type ParityTestFixtures struct {
	Search           ParityTestSuite `json:"search"`
	BootstrapContext ParityTestSuite `json:"bootstrap-context"`
	SessionState     ParityTestSuite `json:"session-state"`
	BrainConfig      ParityTestSuite `json:"brain-config"`
}

// ParityResult represents the validation result for parity comparison.
type ParityResult struct {
	Valid     bool              `json:"valid"`
	Errors    []ValidationError `json:"errors,omitempty"`
	Validator string            `json:"validator"`
}

func loadParityFixtures(t *testing.T) *ParityTestFixtures {
	_, currentFile, _, _ := runtime.Caller(0)
	packageRoot := filepath.Dir(filepath.Dir(currentFile))
	fixturePath := filepath.Join(packageRoot, "src", "__tests__", "fixtures", "parity-test-cases.json")

	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("Failed to load parity test fixtures: %v", err)
	}

	var fixtures ParityTestFixtures
	if err := json.Unmarshal(data, &fixtures); err != nil {
		t.Fatalf("Failed to parse parity test fixtures: %v", err)
	}

	return &fixtures
}

func TestSearchArgsParity(t *testing.T) {
	fixtures := loadParityFixtures(t)

	t.Run("valid cases", func(t *testing.T) {
		for _, tc := range fixtures.Search.Valid {
			tc := tc // capture
			t.Run(tc.Name, func(t *testing.T) {
				// Handle array test cases (multiple inputs)
				switch data := tc.Data.(type) {
				case []any:
					for i, item := range data {
						if !ValidateSearchArgs(item) {
							t.Errorf("Case %d: Expected valid but got invalid", i)
						}
					}
				default:
					if !ValidateSearchArgs(tc.Data) {
						errors := GetSearchArgsErrors(tc.Data)
						t.Errorf("Expected valid but got invalid. Errors: %v", errors)
					}
				}
			})
		}
	})

	t.Run("invalid cases", func(t *testing.T) {
		for _, tc := range fixtures.Search.Invalid {
			tc := tc
			t.Run(tc.Name, func(t *testing.T) {
				if ValidateSearchArgs(tc.Data) {
					t.Error("Expected invalid but got valid")
					return
				}

				errors := GetSearchArgsErrors(tc.Data)
				if len(errors) == 0 {
					t.Error("Expected errors but got none")
					return
				}

				// Verify expected constraint is in errors
				if tc.ExpectedConstraint != "" {
					found := false
					for _, e := range errors {
						if e.Constraint == tc.ExpectedConstraint {
							found = true
							break
						}
					}
					if !found {
						t.Errorf("Expected constraint %q not found in errors: %v", tc.ExpectedConstraint, errors)
					}
				}
			})
		}
	})
}

func TestBootstrapContextArgsParity(t *testing.T) {
	fixtures := loadParityFixtures(t)

	t.Run("valid cases", func(t *testing.T) {
		for _, tc := range fixtures.BootstrapContext.Valid {
			tc := tc
			t.Run(tc.Name, func(t *testing.T) {
				switch data := tc.Data.(type) {
				case []any:
					for i, item := range data {
						if !ValidateBootstrapContextArgs(item) {
							t.Errorf("Case %d: Expected valid but got invalid", i)
						}
					}
				default:
					if !ValidateBootstrapContextArgs(tc.Data) {
						errors := GetBootstrapContextArgsErrors(tc.Data)
						t.Errorf("Expected valid but got invalid. Errors: %v", errors)
					}
				}
			})
		}
	})

	t.Run("invalid cases", func(t *testing.T) {
		for _, tc := range fixtures.BootstrapContext.Invalid {
			tc := tc
			t.Run(tc.Name, func(t *testing.T) {
				if ValidateBootstrapContextArgs(tc.Data) {
					t.Error("Expected invalid but got valid")
					return
				}

				errors := GetBootstrapContextArgsErrors(tc.Data)
				if len(errors) == 0 {
					t.Error("Expected errors but got none")
					return
				}

				if tc.ExpectedConstraint != "" {
					found := false
					for _, e := range errors {
						if e.Constraint == tc.ExpectedConstraint {
							found = true
							break
						}
					}
					if !found {
						t.Errorf("Expected constraint %q not found in errors: %v", tc.ExpectedConstraint, errors)
					}
				}
			})
		}
	})
}

func TestBrainConfigParity(t *testing.T) {
	fixtures := loadParityFixtures(t)

	t.Run("valid cases", func(t *testing.T) {
		for _, tc := range fixtures.BrainConfig.Valid {
			tc := tc
			t.Run(tc.Name, func(t *testing.T) {
				switch data := tc.Data.(type) {
				case []any:
					for i, item := range data {
						if !ValidateBrainConfig(item) {
							errors := GetBrainConfigErrors(item)
							t.Errorf("Case %d: Expected valid but got invalid. Errors: %v", i, errors)
						}
					}
				default:
					if !ValidateBrainConfig(tc.Data) {
						errors := GetBrainConfigErrors(tc.Data)
						t.Errorf("Expected valid but got invalid. Errors: %v", errors)
					}
				}
			})
		}
	})

	t.Run("invalid cases", func(t *testing.T) {
		for _, tc := range fixtures.BrainConfig.Invalid {
			tc := tc
			t.Run(tc.Name, func(t *testing.T) {
				if ValidateBrainConfig(tc.Data) {
					t.Error("Expected invalid but got valid")
					return
				}

				errors := GetBrainConfigErrors(tc.Data)
				if len(errors) == 0 {
					t.Error("Expected errors but got none")
					return
				}

				if tc.ExpectedConstraint != "" {
					found := false
					for _, e := range errors {
						if e.Constraint == tc.ExpectedConstraint {
							found = true
							break
						}
					}
					if !found {
						t.Errorf("Expected constraint %q not found in errors: %v", tc.ExpectedConstraint, errors)
					}
				}
			})
		}
	})
}

// TestParityOutput generates JSON output for cross-language comparison.
// This is used by the TypeScript parity test to compare results.
func TestParityOutput(t *testing.T) {
	if os.Getenv("PARITY_OUTPUT") != "1" {
		t.Skip("Skipping parity output test (set PARITY_OUTPUT=1 to run)")
	}

	fixtures := loadParityFixtures(t)
	results := make(map[string]map[string][]ParityResult)

	// Search validation
	searchResults := make(map[string][]ParityResult)
	for _, tc := range fixtures.Search.Valid {
		switch data := tc.Data.(type) {
		case []any:
			for _, item := range data {
				valid := ValidateSearchArgs(item)
				errors := GetSearchArgsErrors(item)
				searchResults["valid"] = append(searchResults["valid"], ParityResult{
					Valid:     valid,
					Errors:    errors,
					Validator: "go",
				})
			}
		default:
			valid := ValidateSearchArgs(tc.Data)
			errors := GetSearchArgsErrors(tc.Data)
			searchResults["valid"] = append(searchResults["valid"], ParityResult{
				Valid:     valid,
				Errors:    errors,
				Validator: "go",
			})
		}
	}
	for _, tc := range fixtures.Search.Invalid {
		valid := ValidateSearchArgs(tc.Data)
		errors := GetSearchArgsErrors(tc.Data)
		searchResults["invalid"] = append(searchResults["invalid"], ParityResult{
			Valid:     valid,
			Errors:    errors,
			Validator: "go",
		})
	}
	results["search"] = searchResults

	// Bootstrap validation
	bootstrapResults := make(map[string][]ParityResult)
	for _, tc := range fixtures.BootstrapContext.Valid {
		switch data := tc.Data.(type) {
		case []any:
			for _, item := range data {
				valid := ValidateBootstrapContextArgs(item)
				errors := GetBootstrapContextArgsErrors(item)
				bootstrapResults["valid"] = append(bootstrapResults["valid"], ParityResult{
					Valid:     valid,
					Errors:    errors,
					Validator: "go",
				})
			}
		default:
			valid := ValidateBootstrapContextArgs(tc.Data)
			errors := GetBootstrapContextArgsErrors(tc.Data)
			bootstrapResults["valid"] = append(bootstrapResults["valid"], ParityResult{
				Valid:     valid,
				Errors:    errors,
				Validator: "go",
			})
		}
	}
	for _, tc := range fixtures.BootstrapContext.Invalid {
		valid := ValidateBootstrapContextArgs(tc.Data)
		errors := GetBootstrapContextArgsErrors(tc.Data)
		bootstrapResults["invalid"] = append(bootstrapResults["invalid"], ParityResult{
			Valid:     valid,
			Errors:    errors,
			Validator: "go",
		})
	}
	results["bootstrap-context"] = bootstrapResults

	// BrainConfig validation
	brainConfigResults := make(map[string][]ParityResult)
	for _, tc := range fixtures.BrainConfig.Valid {
		switch data := tc.Data.(type) {
		case []any:
			for _, item := range data {
				valid := ValidateBrainConfig(item)
				errors := GetBrainConfigErrors(item)
				brainConfigResults["valid"] = append(brainConfigResults["valid"], ParityResult{
					Valid:     valid,
					Errors:    errors,
					Validator: "go",
				})
			}
		default:
			valid := ValidateBrainConfig(tc.Data)
			errors := GetBrainConfigErrors(tc.Data)
			brainConfigResults["valid"] = append(brainConfigResults["valid"], ParityResult{
				Valid:     valid,
				Errors:    errors,
				Validator: "go",
			})
		}
	}
	for _, tc := range fixtures.BrainConfig.Invalid {
		valid := ValidateBrainConfig(tc.Data)
		errors := GetBrainConfigErrors(tc.Data)
		brainConfigResults["invalid"] = append(brainConfigResults["invalid"], ParityResult{
			Valid:     valid,
			Errors:    errors,
			Validator: "go",
		})
	}
	results["brain-config"] = brainConfigResults

	// Output JSON
	output, _ := json.MarshalIndent(results, "", "  ")
	t.Logf("Parity Results:\n%s", string(output))
}
