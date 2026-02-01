package internal

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// ScenarioConfig holds configuration for a scenario
type ScenarioConfig struct {
	Keywords    []string `json:"keywords"`
	Recommended string   `json:"recommended"`
	Directory   string   `json:"directory"`
	NoteType    string   `json:"noteType"`
}

var (
	scenarioConfigSchemaOnce     sync.Once
	scenarioConfigSchemaCompiled *jsonschema.Schema
	scenarioConfigSchemaErr      error
	scenarioConfigSchemaData     []byte

	scenarioResultSchemaOnce     sync.Once
	scenarioResultSchemaCompiled *jsonschema.Schema
	scenarioResultSchemaErr      error
	scenarioResultSchemaData     []byte
)

// SetScenarioConfigSchemaData sets the schema data for scenario config validation.
func SetScenarioConfigSchemaData(data []byte) {
	scenarioConfigSchemaData = data
}

// SetScenarioResultSchemaData sets the schema data for scenario result validation.
func SetScenarioResultSchemaData(data []byte) {
	scenarioResultSchemaData = data
}

// getScenarioConfigSchema returns the compiled scenario config schema.
func getScenarioConfigSchema() (*jsonschema.Schema, error) {
	scenarioConfigSchemaOnce.Do(func() {
		if scenarioConfigSchemaData == nil {
			scenarioConfigSchemaErr = fmt.Errorf("scenario config schema data not set; call SetScenarioConfigSchemaData first")
			return
		}

		var schemaDoc any
		if err := json.Unmarshal(scenarioConfigSchemaData, &schemaDoc); err != nil {
			scenarioConfigSchemaErr = fmt.Errorf("failed to parse scenario config schema: %w", err)
			return
		}

		c := jsonschema.NewCompiler()
		if err := c.AddResource("scenario-config.schema.json", schemaDoc); err != nil {
			scenarioConfigSchemaErr = fmt.Errorf("failed to add scenario config schema resource: %w", err)
			return
		}

		scenarioConfigSchemaCompiled, scenarioConfigSchemaErr = c.Compile("scenario-config.schema.json")
	})
	return scenarioConfigSchemaCompiled, scenarioConfigSchemaErr
}

// getScenarioResultSchema returns the compiled scenario result schema.
func getScenarioResultSchema() (*jsonschema.Schema, error) {
	scenarioResultSchemaOnce.Do(func() {
		if scenarioResultSchemaData == nil {
			scenarioResultSchemaErr = fmt.Errorf("scenario result schema data not set; call SetScenarioResultSchemaData first")
			return
		}

		var schemaDoc any
		if err := json.Unmarshal(scenarioResultSchemaData, &schemaDoc); err != nil {
			scenarioResultSchemaErr = fmt.Errorf("failed to parse scenario result schema: %w", err)
			return
		}

		c := jsonschema.NewCompiler()
		if err := c.AddResource("scenario-result.schema.json", schemaDoc); err != nil {
			scenarioResultSchemaErr = fmt.Errorf("failed to add scenario result schema resource: %w", err)
			return
		}

		scenarioResultSchemaCompiled, scenarioResultSchemaErr = c.Compile("scenario-result.schema.json")
	})
	return scenarioResultSchemaCompiled, scenarioResultSchemaErr
}

// ValidateScenarioConfig validates a ScenarioConfig against the JSON Schema.
func ValidateScenarioConfig(config ScenarioConfig) bool {
	schema, err := getScenarioConfigSchema()
	if err != nil {
		return false
	}

	data, err := json.Marshal(config)
	if err != nil {
		return false
	}

	var configMap any
	if err := json.Unmarshal(data, &configMap); err != nil {
		return false
	}

	return schema.Validate(configMap) == nil
}

// GetScenarioConfigErrors returns validation errors for a ScenarioConfig.
func GetScenarioConfigErrors(config ScenarioConfig) []ValidationError {
	schema, err := getScenarioConfigSchema()
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "schema",
			Message:    err.Error(),
		}}
	}

	data, err := json.Marshal(config)
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "marshal",
			Message:    err.Error(),
		}}
	}

	var configMap any
	if err := json.Unmarshal(data, &configMap); err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "unmarshal",
			Message:    err.Error(),
		}}
	}

	err = schema.Validate(configMap)
	if err == nil {
		return []ValidationError{}
	}

	return ExtractValidationErrors(err)
}

// ValidateScenarioResult validates a ScenarioResult against the JSON Schema.
func ValidateScenarioResult(result ScenarioResult) bool {
	schema, err := getScenarioResultSchema()
	if err != nil {
		return false
	}

	data, err := json.Marshal(result)
	if err != nil {
		return false
	}

	var resultMap any
	if err := json.Unmarshal(data, &resultMap); err != nil {
		return false
	}

	return schema.Validate(resultMap) == nil
}

// GetScenarioResultErrors returns validation errors for a ScenarioResult.
func GetScenarioResultErrors(result ScenarioResult) []ValidationError {
	schema, err := getScenarioResultSchema()
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "schema",
			Message:    err.Error(),
		}}
	}

	data, err := json.Marshal(result)
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "marshal",
			Message:    err.Error(),
		}}
	}

	var resultMap any
	if err := json.Unmarshal(data, &resultMap); err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "unmarshal",
			Message:    err.Error(),
		}}
	}

	err = schema.Validate(resultMap)
	if err == nil {
		return []ValidationError{}
	}

	return ExtractValidationErrors(err)
}

// scenarioConfigs maps scenario names to their configurations
var scenarioConfigs = map[string]ScenarioConfig{
	"BUG": {
		Keywords:    []string{"bug", "error", "issue", "broken", "fix", "debug", "crash", "not working", "fails"},
		Recommended: "Create bug note in bugs/ before proceeding",
		Directory:   "bugs",
		NoteType:    "bug",
	},
	"FEATURE": {
		Keywords:    []string{"implement", "build feature", "create feature", "add feature", "new feature", "develop"},
		Recommended: "Create feature note in features/ before proceeding",
		Directory:   "features",
		NoteType:    "feature-overview",
	},
	"SPEC": {
		Keywords:    []string{"define", "spec", "specification", "api", "interface", "contract", "schema"},
		Recommended: "Create spec note in specs/ before proceeding",
		Directory:   "specs",
		NoteType:    "spec",
	},
	"ANALYSIS": {
		Keywords:    []string{"analyze", "examine", "review", "investigate", "study", "assess", "audit"},
		Recommended: "Create analysis note in analysis/ before proceeding",
		Directory:   "analysis",
		NoteType:    "analysis-overview",
	},
	"RESEARCH": {
		Keywords:    []string{"research", "explore", "discover", "learn about", "understand", "look into"},
		Recommended: "Create research note in research/ before proceeding",
		Directory:   "research",
		NoteType:    "research-overview",
	},
	"DECISION": {
		Keywords:    []string{"decide", "choose", "vs", " or ", "compare", "evaluate options", "should i", "which"},
		Recommended: "Create decision note in decisions/ before proceeding",
		Directory:   "decisions",
		NoteType:    "decision",
	},
	"TESTING": {
		Keywords:    []string{"test", "validate", "verify", "check", "qa", "quality assurance"},
		Recommended: "Create testing note in testing/ before proceeding",
		Directory:   "testing",
		NoteType:    "testing-overview",
	},
}

// scenarioPriority defines the order in which scenarios are checked
var scenarioPriority = []string{"BUG", "FEATURE", "SPEC", "ANALYSIS", "RESEARCH", "DECISION", "TESTING"}

// DetectScenario detects the scenario type from a prompt based on keywords.
// Returns the detected scenario with matched keywords and metadata.
func DetectScenario(prompt string) ScenarioResult {
	promptLower := strings.ToLower(prompt)

	// Check each scenario in priority order
	for _, scenarioName := range scenarioPriority {
		config := scenarioConfigs[scenarioName]
		matchedKeywords := []string{}

		for _, keyword := range config.Keywords {
			if strings.Contains(promptLower, keyword) {
				matchedKeywords = append(matchedKeywords, keyword)
			}
		}

		if len(matchedKeywords) > 0 {
			return ScenarioResult{
				Detected:    true,
				Scenario:    scenarioName,
				Keywords:    matchedKeywords,
				Recommended: config.Recommended,
				Directory:   config.Directory,
				NoteType:    config.NoteType,
			}
		}
	}

	return ScenarioResult{
		Detected: false,
	}
}
