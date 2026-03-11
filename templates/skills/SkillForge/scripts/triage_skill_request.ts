/**
 * triage_skill_request.ts - Intelligent skill routing from any user input
 *
 * Part of the skillforge skill (Phase 0: Skill Triage).
 *
 * Analyzes ANY user input (prompt, error, code, URL, question, request) and
 * determines the best action:
 * - USE_EXISTING: Existing skill handles this perfectly
 * - IMPROVE_EXISTING: Existing skill is close but needs enhancement
 * - CREATE_NEW: No good match, create new skill
 * - COMPOSE: Multiple skills needed, suggest chain
 * - CLARIFY: Ambiguous input, need more information
 *
 * Usage:
 *    bun triage_skill_request.ts "create a skill for code review"
 *    bun triage_skill_request.ts "help me debug this error" --json
 *    bun triage_skill_request.ts "TypeError: Cannot read property 'map'"
 *
 * Exit Codes:
 *    0 - Success
 *    1 - General failure
 *    2 - Skill index not found (run discover_skills.ts first)
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

// ===========================================================================
// RESULT TYPES
// ===========================================================================

interface Result {
  success: boolean;
  message: string;
  data: Record<string, unknown>;
  errors: string[];
  warnings: string[];
}

function resultToDict(result: Result): Record<string, unknown> {
  return {
    success: result.success,
    message: result.message,
    data: result.data,
    errors: result.errors,
    warnings: result.warnings,
    timestamp: new Date().toISOString(),
  };
}

const Action = {
  USE_EXISTING: "USE_EXISTING",
  IMPROVE_EXISTING: "IMPROVE_EXISTING",
  CREATE_NEW: "CREATE_NEW",
  COMPOSE: "COMPOSE",
  CLARIFY: "CLARIFY",
} as const;

const InputCategory = {
  EXPLICIT_CREATE: "explicit_create",
  EXPLICIT_IMPROVE: "explicit_improve",
  SKILL_QUESTION: "skill_question",
  TASK_REQUEST: "task_request",
  ERROR_MESSAGE: "error_message",
  CODE_SNIPPET: "code_snippet",
  URL_CONTENT: "url_content",
  GENERAL: "general",
} as const;

// ===========================================================================
// INPUT CLASSIFICATION
// ===========================================================================

const EXPLICIT_CREATE_PATTERNS = [
  /\b(?:create|build|make|design|develop)\s+(?:a\s+)?(?:new\s+)?skill\b/i,
  /\bskillforge[:\s]/i,
  /\b(?:new|custom)\s+skill\s+(?:for|to)\b/i,
  /\bultimate\s+skill\b/i,
];

const EXPLICIT_IMPROVE_PATTERNS = [
  /\b(?:improve|enhance|update|upgrade|fix|extend)\s+(?:the\s+)?(?:\w+\s+)?skill\b/i,
  /\bskill\s+(?:needs?|could\s+use|should\s+have)\b/i,
  /\b(?:add|include)\s+(?:to|in)\s+(?:the\s+)?\w+\s+skill\b/i,
];

const SKILL_QUESTION_PATTERNS = [
  /\bdo\s+(?:i|we)\s+have\s+(?:a\s+)?skill\b/i,
  /\bwhich\s+skill\b/i,
  /\bwhat\s+skill\b/i,
  /\brecommend\s+(?:a\s+)?skill\b/i,
  /\bskill\s+for\b/i,
  /\bfind\s+(?:a\s+)?skill\b/i,
  /\bsuggest\s+(?:a\s+)?skill\b/i,
  /\bis\s+there\s+(?:a\s+)?skill\b/i,
];

const TASK_REQUEST_PATTERNS = [
  /\b(?:help|assist)\s+(?:me\s+)?(?:with|to)\b/i,
  /\bi\s+need\s+to\b/i,
  /\bhow\s+(?:do\s+i|can\s+i|to)\b/i,
  /\bcan\s+you\b/i,
  /\bplease\b.*\b(?:help|do|make|create|fix|build)\b/i,
];

const ERROR_PATTERNS = [
  /Error:/,
  /Exception:/,
  /TypeError:/,
  /ReferenceError:/,
  /SyntaxError:/,
  /at\s+\S+\s+\(/,
  /Traceback \(most recent call/,
  /File "[^"]+", line \d+/,
];

const CODE_PATTERNS = [
  /^\s*(function|const|let|var|class|import|export|def|async|await)\s+/m,
  /^\s*<[a-zA-Z][^>]*>/m,
  /=>/,
  /^\s*@\w+/m,
];

const URL_PATTERNS = [/https?:\/\/[^\s]+/];

interface Signals {
  has_skill_mention: boolean;
  has_error: boolean;
  has_code: boolean;
  has_url: boolean;
  mentioned_skill_name: string | null;
  extracted_purpose: string | null;
}

function classifyInput(
  query: string,
): { category: string; signals: Signals } {
  const queryLower = query.toLowerCase();
  const signals: Signals = {
    has_skill_mention: queryLower.includes("skill"),
    has_error: false,
    has_code: false,
    has_url: false,
    mentioned_skill_name: null,
    extracted_purpose: null,
  };

  for (const pattern of EXPLICIT_CREATE_PATTERNS) {
    if (pattern.test(queryLower)) {
      const purposeMatch = queryLower.match(
        /skill\s+(?:for|to)\s+([a-zA-Z0-9 \-,'"]{1,200})/,
      );
      if (purposeMatch) {
        signals.extracted_purpose = purposeMatch[1].trim();
      }
      return { category: InputCategory.EXPLICIT_CREATE, signals };
    }
  }

  for (const pattern of EXPLICIT_IMPROVE_PATTERNS) {
    if (pattern.test(queryLower)) {
      const skillMatch = queryLower.match(
        /(?:improve|enhance|update|fix)\s+(?:the\s+)?(\w+(?:-\w+)*)\s+skill/,
      );
      if (skillMatch) {
        signals.mentioned_skill_name = skillMatch[1];
      }
      return { category: InputCategory.EXPLICIT_IMPROVE, signals };
    }
  }

  for (const pattern of SKILL_QUESTION_PATTERNS) {
    if (pattern.test(queryLower)) {
      return { category: InputCategory.SKILL_QUESTION, signals };
    }
  }

  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(query)) {
      signals.has_error = true;
      return { category: InputCategory.ERROR_MESSAGE, signals };
    }
  }

  for (const pattern of CODE_PATTERNS) {
    if (pattern.test(query)) {
      signals.has_code = true;
      return { category: InputCategory.CODE_SNIPPET, signals };
    }
  }

  for (const pattern of URL_PATTERNS) {
    if (pattern.test(query)) {
      signals.has_url = true;
      return { category: InputCategory.URL_CONTENT, signals };
    }
  }

  for (const pattern of TASK_REQUEST_PATTERNS) {
    if (pattern.test(queryLower)) {
      return { category: InputCategory.TASK_REQUEST, signals };
    }
  }

  return { category: InputCategory.GENERAL, signals };
}

// ===========================================================================
// SKILL MATCHING
// ===========================================================================

const HOME = process.env.HOME ?? "";

function getIndexPath(): string {
  return join(HOME, ".cache", "skillrecommender", "skill_index.json");
}

function loadSkillIndex(): Record<string, unknown> | null {
  const indexPath = getIndexPath();
  if (!existsSync(indexPath)) return null;
  try {
    return JSON.parse(readFileSync(indexPath, "utf-8"));
  } catch {
    return null;
  }
}

// ===========================================================================
// UNIVERSAL DOMAIN SYNONYMS
// ===========================================================================

const DOMAIN_SYNONYMS: Record<string, string[]> = {
  spreadsheet: ["excel", "xlsx", "xls", "csv", "workbook", "tabular", "data table", "cells", "rows columns"],
  document: ["word", "docx", "doc", "text document", "write document", "report"],
  presentation: ["powerpoint", "pptx", "slides", "deck", "slide deck", "keynote", "pitch"],
  pdf: ["pdf", "export pdf", "portable document"],
  debugging: ["debug", "error", "exception", "stack trace", "traceback", "crash", "fix bug", "breakpoint", "investigate"],
  testing: ["test", "unit test", "integration test", "e2e", "coverage", "spec", "tdd", "jest", "vitest", "pytest", "mocha"],
  security: ["security", "vulnerability", "owasp", "audit", "secure", "penetration", "pentest", "xss", "injection"],
  code_quality: ["review", "code review", "pr review", "pull request", "refactor", "clean code", "code smell", "lint"],
  database: ["database", "db", "schema", "migration", "sql", "postgres", "mysql", "mongodb", "data model", "orm"],
  api: ["api", "rest", "graphql", "endpoint", "openapi", "swagger", "restful", "http"],
  frontend: ["ui", "ux", "frontend", "react", "vue", "angular", "css", "styling", "component", "user interface"],
  accessibility: ["accessibility", "a11y", "wcag", "screen reader", "aria", "keyboard navigation"],
  performance: ["performance", "optimize", "slow", "speed", "fast", "bottleneck", "profiling", "cache"],
  authentication: ["auth", "login", "authentication", "oauth", "jwt", "session", "sign in", "sign up", "password"],
  deployment: ["deploy", "deployment", "production", "release", "ship", "hosting", "ci", "cd", "pipeline"],
  devops: ["docker", "kubernetes", "k8s", "container", "helm", "terraform", "infrastructure"],
  documentation: ["documentation", "docs", "readme", "changelog", "api docs", "jsdoc"],
  architecture: ["architecture", "system design", "design pattern", "microservices", "monolith"],
  workflow: ["flowchart", "diagram", "workflow", "process", "swimlane", "sequence diagram", "uml"],
  ai_ml: ["ai", "ml", "machine learning", "llm", "rag", "embedding", "langchain", "prompt", "model"],
  visual: ["visual", "image", "graphic", "art", "canvas", "design"],
};

function detectQueryDomains(
  query: string,
): Array<{ domain: string; terms: string[] }> {
  const queryLower = query.toLowerCase();
  const detected: Array<{ domain: string; terms: string[] }> = [];

  for (const [domain, synonyms] of Object.entries(DOMAIN_SYNONYMS)) {
    const matchedTerms = synonyms.filter((term) =>
      queryLower.includes(term),
    );
    if (matchedTerms.length > 0) {
      detected.push({ domain, terms: matchedTerms });
    }
  }

  detected.sort((a, b) => b.terms.length - a.terms.length);
  return detected;
}

interface SkillRecord {
  name: string;
  keywords: string[];
  triggers: string[];
  domains: string[];
  description: string;
  source: string;
}

function calculateMatchScore(
  query: string,
  skill: SkillRecord,
): { score: number; reasons: string[] } {
  const queryLower = query.toLowerCase();
  const queryWords = new Set(queryLower.split(/\s+/));
  const skillName = skill.name.toLowerCase();
  const skillKeywords = new Set(skill.keywords.map((k) => k.toLowerCase()));
  const skillTriggers = new Set(skill.triggers.map((t) => t.toLowerCase()));
  const skillDomains = new Set(skill.domains.map((d) => d.toLowerCase()));
  const skillDescription = skill.description.toLowerCase();

  let score = 0;
  const reasons: string[] = [];

  const queryDomains = detectQueryDomains(query);

  // Domain match
  for (const { domain, terms } of queryDomains) {
    if (skillDomains.has(domain)) {
      const domainScore = Math.min(50, 35 + terms.length * 5);
      score += domainScore;
      reasons.push(`domain: ${domain} (${terms.slice(0, 2).join(", ")})`);
      break;
    }
  }

  // Keyword match
  for (const { terms } of queryDomains) {
    let found = false;
    for (const term of terms) {
      if (skillKeywords.has(term)) {
        score += 15;
        reasons.push(`keyword: ${term}`);
        found = true;
        break;
      }
    }
    if (found) break;
  }

  // Description match
  for (const { domain, terms } of queryDomains) {
    let found = false;
    for (const term of terms) {
      if (skillDescription.includes(term)) {
        score += 10;
        reasons.push(`description: ${term}`);
        found = true;
        break;
      }
    }
    if (found) break;
    if (skillDescription.includes(domain)) {
      score += 10;
      reasons.push(`description: ${domain}`);
      break;
    }
  }

  // Name match
  if (queryLower.includes(skillName)) {
    score += 35;
    reasons.push(`name match: ${skillName}`);
  } else {
    const nameWords = new Set(skillName.replace(/[-_]/g, " ").split(" "));
    const overlap = [...queryWords].filter((w) => nameWords.has(w));
    if (overlap.length > 0 && overlap.some((w) => w.length > 3)) {
      score += 20;
      reasons.push(`partial name: ${overlap.join(", ")}`);
    }
  }

  // Trigger match
  for (const trigger of skillTriggers) {
    if (queryLower.includes(trigger)) {
      score += 25;
      reasons.push(`trigger: ${trigger}`);
      break;
    }
  }

  // General keyword overlap
  const keywordOverlap = [...queryWords].filter((w) =>
    skillKeywords.has(w) && w.length > 3,
  );
  if (keywordOverlap.length > 0) {
    score += Math.min(20, keywordOverlap.length * 6);
    if (!reasons.some((r) => r.startsWith("keyword:"))) {
      reasons.push(`keywords: ${keywordOverlap.slice(0, 3).join(", ")}`);
    }
  }

  return { score: Math.min(100, score), reasons };
}

interface MatchResult {
  name: string;
  score: number;
  reasons: string[];
  source: string;
  description: string;
  domains: string[];
}

function findMatchingSkills(
  query: string,
  skills: SkillRecord[],
  signals: Signals,
  limit: number = 5,
): MatchResult[] {
  const matches: MatchResult[] = [];

  for (const skill of skills) {
    let { score, reasons } = calculateMatchScore(query, skill);
    const skillDomains = skill.domains.map((d) => d.toLowerCase());

    if (signals.has_error && skillDomains.includes("debugging")) {
      score += 25;
      reasons.push("error context boost");
    }
    if (signals.has_code && skillDomains.includes("code_quality")) {
      score += 15;
      reasons.push("code context boost");
    }
    if (signals.has_url) {
      if (skillDomains.some((d) => ["code_quality", "api", "documentation"].includes(d))) {
        score += 10;
        reasons.push("URL context boost");
      }
    }

    if (score > 0) {
      matches.push({
        name: skill.name,
        score: Math.min(100, score),
        reasons,
        source: skill.source,
        description: (skill.description ?? "").slice(0, 100),
        domains: skill.domains,
      });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}

// ===========================================================================
// TRIAGE DECISION
// ===========================================================================

function makeTriageDecision(
  category: string,
  signals: Signals,
  matches: MatchResult[],
): { action: string; details: Record<string, unknown> } {
  const topMatch = matches[0] ?? null;
  const topScore = topMatch?.score ?? 0;

  let multiDomain = false;
  if (matches.length >= 3) {
    const allDomains = new Set<string>();
    for (const m of matches.slice(0, 3)) {
      for (const d of m.domains) allDomains.add(d);
    }
    multiDomain = allDomains.size >= 3;
  }

  const details: Record<string, unknown> = {
    category,
    top_match: topMatch,
    top_score: topScore,
    match_count: matches.length,
    multi_domain: multiDomain,
  };

  if (category === InputCategory.EXPLICIT_CREATE) {
    if (topScore >= 80) {
      return {
        action: Action.CLARIFY,
        details: {
          ...details,
          reason: `Existing skill '${topMatch?.name}' (${topScore}%) may already handle this. Create anyway or use existing?`,
        },
      };
    } else if (topScore >= 50) {
      return {
        action: Action.CLARIFY,
        details: {
          ...details,
          reason: `Existing skill '${topMatch?.name}' (${topScore}%) is similar. Create new or improve existing?`,
        },
      };
    } else {
      return {
        action: Action.CREATE_NEW,
        details: {
          ...details,
          reason: "No strong existing match found. Proceeding with skill creation.",
          purpose: signals.extracted_purpose,
        },
      };
    }
  }

  if (category === InputCategory.EXPLICIT_IMPROVE) {
    const skillName = signals.mentioned_skill_name;
    if (skillName) {
      for (const m of matches) {
        if (m.name.toLowerCase().includes(skillName.toLowerCase())) {
          return {
            action: Action.IMPROVE_EXISTING,
            details: { ...details, reason: `Improving existing skill: ${m.name}`, target_skill: m.name },
          };
        }
      }
    }
    return {
      action: Action.CLARIFY,
      details: { ...details, reason: "Could not identify which skill to improve" },
    };
  }

  if (category === InputCategory.SKILL_QUESTION) {
    if (topScore >= 60) {
      return {
        action: Action.USE_EXISTING,
        details: {
          ...details,
          reason: `Recommending existing skill: ${topMatch?.name} (${topScore}%)`,
          recommended_skills: matches.slice(0, 3).map((m) => m.name),
        },
      };
    }
    return {
      action: Action.CREATE_NEW,
      details: { ...details, reason: "No good existing skill matches. Consider creating one." },
    };
  }

  if (category === InputCategory.ERROR_MESSAGE) {
    const debugSkills = matches.filter((m) =>
      m.domains.some((d) => d.toLowerCase() === "debugging"),
    );
    const bestDebug = debugSkills[0];
    if (bestDebug && bestDebug.score >= 50) {
      return {
        action: Action.USE_EXISTING,
        details: {
          ...details,
          reason: `Error detected - recommending: ${bestDebug.name} (${bestDebug.score}%)`,
          recommended_skills: [bestDebug.name],
        },
      };
    }
    if (topScore >= 50) {
      return {
        action: Action.USE_EXISTING,
        details: {
          ...details,
          reason: `Error handling skill: ${topMatch?.name} (${topScore}%)`,
          recommended_skills: matches.slice(0, 3).map((m) => m.name),
        },
      };
    }
    return {
      action: Action.CREATE_NEW,
      details: { ...details, reason: "No error handling skill found. Consider creating one." },
    };
  }

  if ([InputCategory.CODE_SNIPPET, InputCategory.URL_CONTENT, InputCategory.TASK_REQUEST].includes(category as never)) {
    if (multiDomain && topScore >= 50) {
      return {
        action: Action.COMPOSE,
        details: {
          ...details,
          reason: "Multiple domains detected. Suggest skill composition.",
          recommended_chain: matches.slice(0, 3).map((m) => m.name),
        },
      };
    }
    if (topScore >= 80) {
      return {
        action: Action.USE_EXISTING,
        details: {
          ...details,
          reason: `Strong match: ${topMatch?.name} (${topScore}%)`,
          recommended_skills: matches.slice(0, 3).map((m) => m.name),
        },
      };
    }
    if (topScore >= 50) {
      return {
        action: Action.IMPROVE_EXISTING,
        details: {
          ...details,
          reason: `Partial match: ${topMatch?.name} (${topScore}%) could be enhanced`,
          target_skill: topMatch?.name,
        },
      };
    }
    return {
      action: Action.CREATE_NEW,
      details: { ...details, reason: "No good existing skill handles this. Consider creating one." },
    };
  }

  // General
  if (topScore >= 70) {
    return {
      action: Action.USE_EXISTING,
      details: {
        ...details,
        reason: `Best match: ${topMatch?.name} (${topScore}%)`,
        recommended_skills: matches.slice(0, 3).map((m) => m.name),
      },
    };
  }
  if (topScore >= 40) {
    return {
      action: Action.CLARIFY,
      details: { ...details, reason: "Unclear intent. Partial matches found." },
    };
  }
  return {
    action: Action.CLARIFY,
    details: { ...details, reason: "Unclear intent and no good skill matches" },
  };
}

// ===========================================================================
// MAIN TRIAGE FUNCTION
// ===========================================================================

function triageRequest(query: string): Result {
  const { category, signals } = classifyInput(query);

  const index = loadSkillIndex();
  if (!index) {
    return {
      success: false,
      message: "Skill index not found. Run discover_skills.ts first.",
      data: {},
      errors: ["Index file missing: ~/.cache/skillrecommender/skill_index.json"],
      warnings: [],
    };
  }

  const skills = (index["skills"] ?? []) as SkillRecord[];
  const matches = findMatchingSkills(query, skills, signals);
  const { action, details } = makeTriageDecision(category, signals, matches);

  return {
    success: true,
    message: `Triage complete: ${action}`,
    data: {
      action,
      details,
      input_category: category,
      signals,
      top_matches: matches.slice(0, 5),
      total_skills_scanned: skills.length,
    },
    errors: [],
    warnings: [],
  };
}

// ===========================================================================
// CLI
// ===========================================================================

function formatOutput(result: Result): string {
  const lines: string[] = [];
  const data = result.data;
  const action = (data["action"] ?? "UNKNOWN") as string;
  const details = (data["details"] ?? {}) as Record<string, unknown>;

  lines.push(`\n${"=".repeat(60)}`);
  lines.push(`SKILL TRIAGE RESULT: ${action}`);
  lines.push(`${"=".repeat(60)}`);
  lines.push(`\nInput Category: ${data["input_category"] ?? "unknown"}`);

  if (details["reason"]) {
    lines.push(`Reason: ${details["reason"]}`);
  }

  const matches = (data["top_matches"] ?? []) as MatchResult[];
  if (matches.length > 0) {
    lines.push("\nTop Skill Matches:");
    for (let i = 0; i < Math.min(3, matches.length); i++) {
      const m = matches[i];
      lines.push(`  ${i + 1}. ${m.name} (${m.score}%)`);
      lines.push(`     ${(m.description ?? "").slice(0, 60)}...`);
      if (m.reasons.length > 0) {
        lines.push(`     Matched: ${m.reasons.slice(0, 2).join(", ")}`);
      }
    }
  }

  lines.push(`\n${"-".repeat(60)}`);
  lines.push("RECOMMENDED NEXT STEP:");

  if (action === Action.USE_EXISTING) {
    const skills = (details["recommended_skills"] ?? []) as string[];
    lines.push(`  Invoke existing skill: ${skills[0] ?? "unknown"}`);
  } else if (action === Action.IMPROVE_EXISTING) {
    lines.push(`  Improve skill: ${details["target_skill"] ?? "unknown"}`);
  } else if (action === Action.CREATE_NEW) {
    const purpose = details["purpose"] ?? "the requested functionality";
    lines.push(`  Create new skill for: ${purpose}`);
  } else if (action === Action.COMPOSE) {
    const chain = (details["recommended_chain"] ?? []) as string[];
    lines.push(`  Compose skill chain: ${chain.join(" -> ")}`);
  } else if (action === Action.CLARIFY) {
    lines.push(`  ${details["suggested_action"] ?? "Clarify your intent"}`);
  }

  lines.push(`${"-".repeat(60)}\n`);
  return lines.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  let query = "";
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--json") {
      jsonOutput = true;
    } else if (args[i] === "--verbose" || args[i] === "-v") {
      // verbose mode (no-op for now)
    } else {
      query = args[i];
    }
  }

  if (!query) {
    console.log("Usage: bun triage_skill_request.ts <query> [--json]");
    process.exit(1);
  }

  const result = triageRequest(query);

  if (jsonOutput) {
    console.log(JSON.stringify(resultToDict(result), null, 2));
  } else {
    if (result.success) {
      console.log(formatOutput(result));
    } else {
      console.error(`Error: ${result.message}`);
      for (const error of result.errors) {
        console.error(`  ${error}`);
      }
    }
  }

  if (!result.success) {
    process.exit(result.message.toLowerCase().includes("index") ? 2 : 1);
  }
  process.exit(0);
}

main();
