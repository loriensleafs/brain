package validation

import "strings"

// ScenarioConfig holds configuration for a scenario
type ScenarioConfig struct {
	Keywords    []string
	Recommended string
	Directory   string
	NoteType    string
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
