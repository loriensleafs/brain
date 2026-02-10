/**
 * Scenario detection for brain-hooks.
 *
 * Ported from packages/validation/internal/detect_scenario.go.
 * Detects scenario type from a prompt based on keyword matching.
 */
import type { ScenarioConfig, ScenarioResult } from "./types.ts";

/** Scenario configurations keyed by scenario name. */
const scenarioConfigs: Record<string, ScenarioConfig> = {
  BUG: {
    keywords: [
      "bug",
      "error",
      "issue",
      "broken",
      "fix",
      "debug",
      "crash",
      "not working",
      "fails",
    ],
    recommended: "Create bug note in bugs/ before proceeding",
    directory: "bugs",
    noteType: "bug",
  },
  FEATURE: {
    keywords: [
      "implement",
      "build feature",
      "create feature",
      "add feature",
      "new feature",
      "develop",
    ],
    recommended: "Create feature note in features/ before proceeding",
    directory: "features",
    noteType: "feature-overview",
  },
  SPEC: {
    keywords: [
      "define",
      "spec",
      "specification",
      "api",
      "interface",
      "contract",
      "schema",
    ],
    recommended: "Create spec note in specs/ before proceeding",
    directory: "specs",
    noteType: "spec",
  },
  ANALYSIS: {
    keywords: [
      "analyze",
      "examine",
      "review",
      "investigate",
      "study",
      "assess",
      "audit",
    ],
    recommended: "Create analysis note in analysis/ before proceeding",
    directory: "analysis",
    noteType: "analysis-overview",
  },
  RESEARCH: {
    keywords: [
      "research",
      "explore",
      "discover",
      "learn about",
      "understand",
      "look into",
    ],
    recommended: "Create research note in research/ before proceeding",
    directory: "research",
    noteType: "research-overview",
  },
  DECISION: {
    keywords: [
      "decide",
      "choose",
      "vs",
      " or ",
      "compare",
      "evaluate options",
      "should i",
      "which",
    ],
    recommended: "Create decision note in decisions/ before proceeding",
    directory: "decisions",
    noteType: "decision",
  },
  TESTING: {
    keywords: [
      "test",
      "validate",
      "verify",
      "check",
      "qa",
      "quality assurance",
    ],
    recommended: "Create testing note in testing/ before proceeding",
    directory: "testing",
    noteType: "testing-overview",
  },
};

/** Priority order for scenario checking. */
const scenarioPriority = [
  "BUG",
  "FEATURE",
  "SPEC",
  "ANALYSIS",
  "RESEARCH",
  "DECISION",
  "TESTING",
];

/**
 * Detect the scenario type from a prompt based on keywords.
 * Returns the detected scenario with matched keywords and metadata.
 */
export function detectScenario(prompt: string): ScenarioResult {
  const promptLower = prompt.toLowerCase();

  for (const scenarioName of scenarioPriority) {
    const config = scenarioConfigs[scenarioName];
    const matchedKeywords: string[] = [];

    for (const keyword of config.keywords) {
      if (promptLower.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }

    if (matchedKeywords.length > 0) {
      return {
        detected: true,
        scenario: scenarioName,
        keywords: matchedKeywords,
        recommended: config.recommended,
        directory: config.directory,
        noteType: config.noteType,
      };
    }
  }

  return {
    detected: false,
    scenario: "",
    keywords: [],
    recommended: "",
    directory: "",
    noteType: "",
  };
}
