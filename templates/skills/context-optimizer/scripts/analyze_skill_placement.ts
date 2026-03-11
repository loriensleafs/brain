/**
 * Analyze skill content for optimal placement (Skill vs Passive Context vs Hybrid).
 *
 * This script evaluates a skill's SKILL.md content or directory to classify whether
 * it should be:
 * - Skill: Action-heavy, tool execution, user-triggered workflows
 * - Passive Context: Knowledge-heavy, reference data, always-needed information
 * - Hybrid: Both knowledge (passive) and actions (skill)
 *
 * Classification is based on Vercel research showing passive context achieves 100%
 * pass rates versus 53-79% for skills due to elimination of decision points.
 *
 * Exit Codes:
 *   0: Success - Analysis complete
 *   1: Error - Invalid input or analysis failure
 */

import { existsSync, statSync } from "fs";
import { join } from "path";
import { validatePathWithinRepo } from "./path_validation";

// --- Types ---

interface Metrics {
  readonly tool_calls: number;
  readonly action_verbs: number;
  readonly reference_content_ratio: number;
  readonly user_triggers: number;
  readonly always_needed: number;
}

interface Recommendations {
  readonly Passive: readonly string[];
  readonly Skill: readonly string[];
}

interface AnalysisResult {
  readonly classification: string;
  readonly confidence: number;
  readonly reasoning: string;
  readonly metrics: Metrics | null;
  readonly recommendations: Recommendations | null;
}

interface ClassificationScore {
  skillScore: number;
  passiveScore: number;
  reasons: string[];
}

// --- Content Loading ---

async function getSkillContent(path: string): Promise<string> {
  const resolvedPath = await validatePathWithinRepo(path);

  const stat = statSync(resolvedPath);
  if (stat.isDirectory()) {
    const skillMd = join(resolvedPath, "SKILL.md");
    if (!existsSync(skillMd)) {
      throw new Error(`SKILL.md not found in directory: ${resolvedPath}`);
    }
    return await Bun.file(skillMd).text();
  }

  if (!resolvedPath.endsWith(".md")) {
    throw new Error("Path must be a directory or .md file");
  }

  return await Bun.file(resolvedPath).text();
}

// --- Measurement Functions ---

function measureToolCalls(text: string): number {
  const toolPatterns = [
    /\bBash\s*\(/gi,
    /\bRead\b/gi,
    /\bWrite\b/gi,
    /\bEdit\b/gi,
    /\bGrep\s*\(/gi,
    /\bGlob\s*\(/gi,
    /\bWebFetch\s*\(/gi,
    /\bWebSearch\s*\(/gi,
    /\bgh\s+\w+/gi,
    /\bgit\s+\w+/gi,
    /\bpwsh\s+/gi,
    /\bpython\s+/gi,
    /\bInvoke-\w+/gi,
    /\bSet-\w+/gi,
    /\bNew-\w+/gi,
  ];

  let count = 0;
  for (const pattern of toolPatterns) {
    const matches = text.match(pattern);
    count += matches?.length ?? 0;
  }
  return count;
}

function measureActionVerbs(text: string): number {
  const actionVerbs = [
    /\bcreate\b/gi,
    /\bupdate\b/gi,
    /\bdelete\b/gi,
    /\bexecute\b/gi,
    /\brun\b/gi,
    /\bmodify\b/gi,
    /\badd\b/gi,
    /\bremove\b/gi,
    /\bcommit\b/gi,
    /\bpush\b/gi,
    /\bmerge\b/gi,
    /\bclose\b/gi,
    /\bopen\b/gi,
    /\btrigger\b/gi,
    /\bgenerate\b/gi,
    /\bvalidate\b/gi,
    /\bpost\b/gi,
    /\bsend\b/gi,
  ];

  let count = 0;
  for (const pattern of actionVerbs) {
    const matches = text.match(pattern);
    count += matches?.length ?? 0;
  }
  return count;
}

function measureReferenceContent(text: string): number {
  const referenceMatches = text.match(/^\|.*\|/gm)?.length ?? 0;
  const listMatches = text.match(/^[-*]\s+/gm)?.length ?? 0;
  const codeBlockMatches = text.match(/```/gm)?.length ?? 0;
  const referenceIndicators = referenceMatches + listMatches + codeBlockMatches;

  const numberedListMatches = text.match(/^\d+\.\s+/gm)?.length ?? 0;
  const phaseMatches = text.match(/(?:Phase|Step|Stage)\s+\d+/gi)?.length ?? 0;
  const proceduralIndicators = numberedListMatches + phaseMatches;

  const total = referenceIndicators + proceduralIndicators;
  if (total === 0) return 0.5;

  return referenceIndicators / total;
}

function detectUserTriggerPatterns(text: string): number {
  const triggerPatterns = [
    /(?:when|if)\s+user/gi,
    /triggered\s+by/gi,
    /explicit\w*\s+request/gi,
    /slash\s*command/gi,
    /\/\w+/gi,
    /invok\w+\s+(?:by|when)/gi,
    /user\s+asks?/gi,
  ];

  let count = 0;
  for (const pattern of triggerPatterns) {
    const matches = text.match(pattern);
    count += matches?.length ?? 0;
  }
  return count;
}

function detectAlwaysNeededPatterns(text: string): number {
  const alwaysNeededPatterns = [
    /\balways\b/gi,
    /every\s+(?:turn|session)/gi,
    /required\s+(?:for|in)\s+all/gi,
    /\bmandatory\b/gi,
    /constant(?:ly)?/gi,
    /persistent/gi,
    /framework\s+knowledge/gi,
    /reference\s+data/gi,
    /decision\s+framework/gi,
    /routing\s+rules/gi,
  ];

  let count = 0;
  for (const pattern of alwaysNeededPatterns) {
    const matches = text.match(pattern);
    count += matches?.length ?? 0;
  }
  return count;
}

// --- Classification ---

function getClassification(
  toolCalls: number,
  actionVerbs: number,
  referenceRatio: number,
  userTriggers: number,
  alwaysNeeded: number,
): { classification: string; confidence: number; reasons: string[] } {
  const score: ClassificationScore = {
    skillScore: 0,
    passiveScore: 0,
    reasons: [],
  };

  if (toolCalls > 5) {
    score.skillScore += 3;
    score.reasons.push(`High tool execution (${toolCalls} calls)`);
  } else if (toolCalls > 0) {
    score.skillScore += 1;
    score.reasons.push(`Some tool execution (${toolCalls} calls)`);
  }

  if (actionVerbs > 10) {
    score.skillScore += 2;
    score.reasons.push(`Many action verbs (${actionVerbs})`);
  } else if (actionVerbs > 5) {
    score.skillScore += 1;
    score.reasons.push(`Moderate action verbs (${actionVerbs})`);
  }

  if (referenceRatio > 0.7) {
    score.passiveScore += 3;
    score.reasons.push(`High reference content ratio (${referenceRatio.toFixed(2)})`);
  } else if (referenceRatio > 0.5) {
    score.passiveScore += 1;
    score.reasons.push(`Moderate reference content (${referenceRatio.toFixed(2)})`);
  }

  if (userTriggers > 3) {
    score.skillScore += 2;
    score.reasons.push(`User-triggered workflow (${userTriggers} triggers)`);
  }

  if (alwaysNeeded > 3) {
    score.passiveScore += 2;
    score.reasons.push(`Always-needed information (${alwaysNeeded} indicators)`);
  }

  const diff = score.skillScore - score.passiveScore;

  if (diff >= 3) {
    return {
      classification: "Skill",
      confidence: Math.min(90, 50 + diff * 10),
      reasons: score.reasons,
    };
  }

  if (diff <= -3) {
    return {
      classification: "PassiveContext",
      confidence: Math.min(90, 50 + Math.abs(diff) * 10),
      reasons: score.reasons,
    };
  }

  score.reasons.push("Mixed indicators suggest hybrid approach");
  return {
    classification: "Hybrid",
    confidence: 60,
    reasons: score.reasons,
  };
}

function getHybridRecommendations(
  text: string,
  classification: string,
): Recommendations | null {
  if (classification !== "Hybrid") return null;

  const passiveItems: string[] = [];
  const skillItems: string[] = [];

  const headings = text.match(/^#{1,3}\s+(.+)$/gm) ?? [];

  for (const raw of headings) {
    const heading = raw.replace(/^#{1,3}\s+/, "").trim();

    if (/routing|classification|framework|reference|index|hierarchy|decision/i.test(heading)) {
      passiveItems.push(heading);
    } else if (/process|workflow|steps|execution|script|procedure/i.test(heading)) {
      skillItems.push(heading);
    }
  }

  // Script references go to skill
  const scriptRefs = text.match(/[\w-]+\.ts/g) ?? [];
  for (const script of scriptRefs) {
    if (!skillItems.includes(script)) {
      skillItems.push(script);
    }
  }

  return { Passive: passiveItems, Skill: skillItems };
}

// --- Analysis ---

export function analyzeContent(content: string, detailed: boolean = false): AnalysisResult {
  const toolCalls = measureToolCalls(content);
  const actionVerbs = measureActionVerbs(content);
  const referenceRatio = measureReferenceContent(content);
  const userTriggers = detectUserTriggerPatterns(content);
  const alwaysNeeded = detectAlwaysNeededPatterns(content);

  const { classification, confidence, reasons } = getClassification(
    toolCalls,
    actionVerbs,
    referenceRatio,
    userTriggers,
    alwaysNeeded,
  );

  const metrics: Metrics | null = detailed
    ? {
        tool_calls: toolCalls,
        action_verbs: actionVerbs,
        reference_content_ratio: Math.round(referenceRatio * 100) / 100,
        user_triggers: userTriggers,
        always_needed: alwaysNeeded,
      }
    : null;

  const recommendations = getHybridRecommendations(content, classification);

  return {
    classification,
    confidence,
    reasoning: reasons.join("; "),
    metrics,
    recommendations,
  };
}

// --- CLI ---

function printUsage(): void {
  console.error("Usage: bun run analyze_skill_placement.ts (-p <path> | -c <content>) [-d]");
  console.error("  -p, --path     Path to skill directory or SKILL.md file");
  console.error("  -c, --content  Direct content string to analyze");
  console.error("  -d, --detailed Include detailed metrics in output");
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);

  let path: string | undefined;
  let content: string | undefined;
  let detailed = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === "-p" || arg === "--path") && i + 1 < args.length) {
      path = args[++i];
    } else if ((arg === "-c" || arg === "--content") && i + 1 < args.length) {
      content = args[++i];
    } else if (arg === "-d" || arg === "--detailed") {
      detailed = true;
    } else {
      printUsage();
      return 1;
    }
  }

  if (!path && !content) {
    printUsage();
    return 1;
  }

  try {
    const text = path ? await getSkillContent(path) : content!;
    const result = analyzeContent(text, detailed);
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Error: ${message}`);
    return 1;
  }
}

process.exit(await main());
