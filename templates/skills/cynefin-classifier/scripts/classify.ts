#!/usr/bin/env bun
/**
 * Cynefin Framework Problem Classifier
 *
 * Classifies problems into Cynefin domains based on cause-effect characteristics
 * and recommends appropriate response strategies.
 *
 * Exit Codes:
 *   0: Classification complete
 *   1: Invalid arguments
 *   2: Insufficient information (Confusion domain)
 */

type Domain = "Clear" | "Complicated" | "Complex" | "Chaotic" | "Confusion";
type Confidence = "HIGH" | "MEDIUM" | "LOW";

interface ClassificationResult {
  problem: string;
  domain: Domain;
  confidence: Confidence;
  rationale: string;
  strategy: string;
  actions: string[];
  pitfall: string;
  temporalNote: string | null;
  boundaryNote: string | null;
  compoundNote: string | null;
}

const STRATEGIES: Record<Domain, string> = {
  Clear: "Sense-Categorize-Respond",
  Complicated: "Sense-Analyze-Respond",
  Complex: "Probe-Sense-Respond",
  Chaotic: "Act-Sense-Respond",
  Confusion: "Gather Information",
};

const PITFALLS: Record<Domain, string> = {
  Clear: "Over-complicating simple problems. Creating abstractions where none needed.",
  Complicated:
    "Analysis paralysis OR acting without sufficient expertise. Balance thoroughness with timely action.",
  Complex: "Trying to fully analyze before acting. Expecting predictable outcomes from experiments.",
  Chaotic: "Forming committees. Waiting for consensus. Deep analysis during active crisis.",
  Confusion: "Assuming a domain without evidence. Acting before gathering sufficient information.",
};

const DOMAIN_KEYWORDS: Record<Domain, string[]> = {
  Clear: [
    "typo",
    "simple fix",
    "known issue",
    "documented",
    "standard",
    "obvious",
    "trivial",
    "best practice",
    "procedure exists",
    "follow guideline",
  ],
  Complicated: [
    "analyze",
    "expert",
    "root cause",
    "investigate",
    "debug",
    "profile",
    "evaluate options",
    "trade-off",
    "assessment",
    "audit",
    "memory leak",
    "performance",
  ],
  Complex: [
    "unpredictable",
    "user behavior",
    "team dynamics",
    "experiment",
    "try and see",
    "emergent",
    "multiple factors",
    "new technology",
    "architecture decision",
    "adoption",
    "a/b test",
    "flaky",
    "intermittent",
    "randomly",
    "sometimes works",
    "race condition",
    "timing",
    "works locally",
    "fails in ci",
    "non-deterministic",
  ],
  Chaotic: [
    "outage",
    "down",
    "crisis",
    "breach",
    "urgent",
    "emergency",
    "critical",
    "immediate",
    "customers affected",
    "data loss",
    "unresponsive",
  ],
  Confusion: [
    "unclear",
    "vague",
    "sometimes",
    "intermittent",
    "not sure",
    "depends",
    "more information",
    "reproduce",
    "inconsistent",
  ],
};

const DOMAINS: Domain[] = ["Clear", "Complicated", "Complex", "Chaotic", "Confusion"];

function countKeywordMatches(text: string, domain: Domain): number {
  const textLower = text.toLowerCase();
  return DOMAIN_KEYWORDS[domain].filter((kw) => textLower.includes(kw)).length;
}

function generateRationale(domain: Domain): string {
  const rationales: Record<Domain, string> = {
    Clear:
      "Cause-effect relationships are clear. Standard procedures or best practices apply. Predictable outcome with established approach.",
    Complicated:
      "Cause-effect relationships are discoverable through expert analysis. The problem has knowable solution but requires systematic investigation.",
    Complex:
      "Multiple interacting factors make cause-effect unclear upfront. Outcomes are emergent and only visible in retrospect. Experimentation required to find patterns.",
    Chaotic:
      "Crisis situation with active harm occurring. No time for analysis. Immediate stabilization required. Act first, analyze later.",
    Confusion:
      "Insufficient information to determine domain. Need more data before choosing an approach.",
  };
  return rationales[domain];
}

function generateActions(domain: Domain): string[] {
  const actions: Record<Domain, string[]> = {
    Clear: [
      "Identify the established best practice or procedure",
      "Apply the standard solution",
      "Document if this is a recurring pattern",
    ],
    Complicated: [
      "Gather relevant data and metrics",
      "Consult domain experts or documentation",
      "Analyze systematically using proven techniques",
      "Implement solution based on analysis findings",
    ],
    Complex: [
      "Design safe-to-fail experiments with clear success criteria",
      "Run small probes to gather empirical data",
      "Observe patterns and amplify what works",
      "Iterate based on emerging insights",
    ],
    Chaotic: [
      "Execute immediate stabilization actions",
      "Restore basic functionality first",
      "Communicate status to stakeholders",
      "After stable: investigate root cause",
    ],
    Confusion: [
      "List specific unknowns that block classification",
      "Gather minimum viable information",
      "Decompose into smaller sub-problems if possible",
      "Re-classify once information is available",
    ],
  };
  return actions[domain];
}

function generateTemporalNote(domain: Domain): string {
  const notes: Record<Domain, string> = {
    Clear: "May shift to Complex/Chaotic if disrupted by unexpected change.",
    Complicated:
      "May simplify to Clear as expertise is codified, or shift to Complex if analysis reveals emergent factors.",
    Complex:
      "May shift to Complicated once patterns emerge, or to Chaotic if situation destabilizes.",
    Chaotic: "Should transition to Complex after stabilization. Do not linger in Chaotic.",
    Confusion:
      "Temporary state. Should resolve to another domain once information is gathered.",
  };
  return notes[domain];
}

function generateBoundaryNote(
  domain: Domain,
  scores: Record<Domain, number>
): string | null {
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return null;

  const closeDomains = DOMAINS.filter(
    (d) => scores[d] > 0 && scores[d] >= maxScore - 1 && d !== domain
  );

  if (closeDomains.length > 0) {
    return `Near boundary with ${closeDomains.join(", ")}. Re-evaluate if initial approach does not yield progress.`;
  }
  return null;
}

function classifyProblem(problem: string, context?: string): ClassificationResult {
  const combinedText = context ? `${problem} ${context}` : problem;

  const scores = Object.fromEntries(
    DOMAINS.map((d) => [d, countKeywordMatches(combinedText, d)])
  ) as Record<Domain, number>;

  const maxScore = Math.max(...Object.values(scores));

  let domain: Domain;
  let confidence: Confidence;
  let rationale: string;

  if (maxScore === 0) {
    domain = "Confusion";
    confidence = "LOW";
    rationale = "No clear indicators for any specific domain. Insufficient information to classify confidently.";
  } else {
    const topDomains = DOMAINS.filter((d) => scores[d] === maxScore);

    if (topDomains.length !== 1) {
      domain = "Confusion";
      confidence = "LOW";
      rationale = topDomains.length > 1
        ? `Mixed signals between ${topDomains.join(", ")}. Need more information to disambiguate.`
        : "No clear indicators for any specific domain. Insufficient information to classify confidently.";
    } else {
      domain = topDomains[0] as Domain;
      confidence = maxScore >= 3 ? "HIGH" : maxScore >= 2 ? "MEDIUM" : "LOW";
      rationale = generateRationale(domain);
    }
  }

  return {
    problem,
    domain,
    confidence,
    rationale,
    strategy: STRATEGIES[domain],
    actions: generateActions(domain),
    pitfall: PITFALLS[domain],
    temporalNote: generateTemporalNote(domain),
    boundaryNote: generateBoundaryNote(domain, scores),
    compoundNote: null,
  };
}

function toMarkdown(result: ClassificationResult): string {
  const lines = [
    "## Cynefin Classification",
    "",
    `**Problem**: ${result.problem}`,
    "",
    `### Domain: ${result.domain.toUpperCase()}`,
    "",
    `**Confidence**: ${result.confidence}`,
    "",
    "### Rationale",
    "",
    result.rationale,
    "",
    "### Response Strategy",
    "",
    `**Approach**: ${result.strategy}`,
    "",
    "### Recommended Actions",
    "",
  ];

  result.actions.forEach((action, i) => {
    lines.push(`${i + 1}. ${action}`);
  });

  lines.push("", "### Pitfall Warning", "", result.pitfall, "", "### Related Considerations", "");

  if (result.temporalNote) {
    lines.push(`- **Temporal**: ${result.temporalNote}`);
  }
  if (result.boundaryNote) {
    lines.push(`- **Boundary**: ${result.boundaryNote}`);
  }
  if (result.compoundNote) {
    lines.push(`- **Compound**: ${result.compoundNote}`);
  }

  return lines.join("\n");
}

function main(): number {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log("Usage: bun run classify.ts --problem <description> [--context <context>] [--json]");
    return 1;
  }

  let problem = "";
  let context: string | undefined;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--problem":
        problem = args[++i] ?? "";
        break;
      case "--context":
        context = args[++i];
        break;
      case "--json":
        jsonOutput = true;
        break;
    }
  }

  if (!problem.trim()) {
    console.error("Error: Problem description cannot be empty");
    return 1;
  }

  const result = classifyProblem(problem, context);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(toMarkdown(result));
  }

  if (result.domain === "Confusion") {
    return 2;
  }

  return 0;
}

process.exit(main());
