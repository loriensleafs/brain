/**
 * discover_skills.ts - Scan all skill sources and build a searchable index
 *
 * Part of the skillforge skill.
 *
 * Responsibilities:
 * - Scan custom skills, superpowers, and plugin marketplaces
 * - Extract skill metadata (name, triggers, keywords, domain)
 * - Build searchable JSON index for fast matching
 *
 * Usage:
 *    bun discover_skills.ts
 *    bun discover_skills.ts --verbose
 *    bun discover_skills.ts --output custom_path.json
 *
 * Exit Codes:
 *    0  - Success
 *    1  - General failure
 *    3  - Directory not found
 */

import { resolve, join } from "path";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { Glob } from "bun";
import { SEMVER_REGEX } from "./_constants";

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

// ===========================================================================
// SKILL SOURCES
// ===========================================================================

const HOME = process.env.HOME ?? Bun.env.HOME ?? "~";

interface SkillSource {
  name: string;
  path: string;
  pattern: string;
  priority: number;
}

const SKILL_SOURCES: SkillSource[] = [
  {
    name: "custom",
    path: join(HOME, ".claude", "skills"),
    pattern: "*/SKILL.md",
    priority: 1,
  },
  {
    name: "superpowers",
    path: join(HOME, ".claude", "plugins", "cache", "superpowers", "skills"),
    pattern: "*/*.md",
    priority: 2,
  },
  {
    name: "anthropic-agent-skills",
    path: join(
      HOME,
      ".claude",
      "plugins",
      "marketplaces",
      "anthropic-agent-skills",
    ),
    pattern: "skills/*/skill.md",
    priority: 3,
  },
  {
    name: "claude-code-workflows",
    path: join(
      HOME,
      ".claude",
      "plugins",
      "marketplaces",
      "claude-code-workflows",
    ),
    pattern: "plugins/*/skills/*/skill.md",
    priority: 4,
  },
  {
    name: "claude-code-plugins",
    path: join(
      HOME,
      ".claude",
      "plugins",
      "marketplaces",
      "claude-code-plugins",
    ),
    pattern: "*/skills/*/skill.md",
    priority: 5,
  },
];

// ===========================================================================
// UNIVERSAL DOMAIN CLASSIFICATION
// ===========================================================================

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  spreadsheet: [
    "excel",
    "xlsx",
    "xls",
    "csv",
    "spreadsheet",
    "workbook",
    "tabular",
  ],
  document: ["word", "docx", "doc", "document", "report", "write"],
  presentation: [
    "powerpoint",
    "pptx",
    "slides",
    "presentation",
    "deck",
    "keynote",
  ],
  pdf: ["pdf", "portable document"],
  debugging: [
    "debug",
    "error",
    "trace",
    "exception",
    "stack trace",
    "fix bug",
    "investigate",
    "root cause",
  ],
  testing: [
    "test",
    "tdd",
    "coverage",
    "e2e",
    "unit",
    "integration",
    "cypress",
    "jest",
    "pytest",
    "spec",
  ],
  security: [
    "security",
    "owasp",
    "vulnerability",
    "audit",
    "pentest",
    "xss",
    "injection",
  ],
  code_quality: [
    "review",
    "refactor",
    "lint",
    "code smell",
    "solid",
    "pr review",
    "code review",
  ],
  database: [
    "database",
    "db",
    "sql",
    "postgres",
    "mysql",
    "mongodb",
    "migration",
    "schema",
    "orm",
  ],
  api: ["api", "rest", "graphql", "openapi", "endpoint", "swagger", "http"],
  frontend: [
    "ui",
    "ux",
    "frontend",
    "react",
    "vue",
    "angular",
    "component",
    "css",
    "styling",
  ],
  accessibility: [
    "accessibility",
    "a11y",
    "wcag",
    "screen reader",
    "aria",
  ],
  performance: [
    "performance",
    "optimize",
    "slow",
    "speed",
    "cache",
    "profiling",
    "bottleneck",
  ],
  authentication: [
    "auth",
    "login",
    "authentication",
    "oauth",
    "jwt",
    "session",
    "password",
  ],
  deployment: ["deploy", "release", "ship", "hosting", "production"],
  devops: [
    "ci",
    "cd",
    "docker",
    "kubernetes",
    "k8s",
    "container",
    "helm",
    "terraform",
    "pipeline",
  ],
  documentation: [
    "documentation",
    "docs",
    "readme",
    "changelog",
    "jsdoc",
  ],
  architecture: [
    "architecture",
    "system design",
    "microservices",
    "monolith",
    "pattern",
  ],
  workflow: [
    "flowchart",
    "diagram",
    "workflow",
    "process",
    "swimlane",
    "sequence",
  ],
  ai_ml: [
    "ai",
    "ml",
    "llm",
    "rag",
    "langchain",
    "prompt",
    "embedding",
    "model",
  ],
  visual: ["visual", "image", "graphic", "art", "canvas", "brand"],
  meta: ["orchestrate", "compose", "skill", "maker", "proactive", "chain"],
};

// ===========================================================================
// PARSING FUNCTIONS
// ===========================================================================

function extractFrontmatter(content: string): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {};

  if (!content.startsWith("---")) return frontmatter;

  const parts = content.split("---", 3);
  if (parts.length < 3) return frontmatter;

  const yamlContent = parts[1].trim();

  // Basic key-value parsing (no external YAML dependency)
  let currentKey: string | null = null;
  for (const line of yamlContent.split("\n")) {
    if (line.includes(":") && !line.startsWith(" ") && !line.startsWith("\t")) {
      const colonIdx = line.indexOf(":");
      currentKey = line.slice(0, colonIdx).trim();
      frontmatter[currentKey] = line.slice(colonIdx + 1).trim();
    } else if (
      line.startsWith("  ") &&
      currentKey === "metadata"
    ) {
      if (
        !frontmatter["metadata"] ||
        typeof frontmatter["metadata"] !== "object"
      ) {
        frontmatter["metadata"] = {};
      }
      if (line.includes(":")) {
        const colonIdx = line.indexOf(":");
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        (frontmatter["metadata"] as Record<string, string>)[key] = value;
      }
    }
  }

  return frontmatter;
}

function getVersion(frontmatter: Record<string, unknown>): string {
  if (typeof frontmatter["version"] === "string") {
    return frontmatter["version"];
  }

  if (
    frontmatter["metadata"] &&
    typeof frontmatter["metadata"] === "object"
  ) {
    const meta = frontmatter["metadata"] as Record<string, unknown>;
    if (typeof meta["version"] === "string") {
      return meta["version"];
    }
  }

  return "1.0.0";
}

function extractTriggers(content: string): string[] {
  const triggers: Set<string> = new Set();

  const triggerPatterns = [
    /\*\*Triggers?:\*\*\s*`([^`]+)`/gi,
    /Triggers?:\s*`([^`]+)`/gi,
    /\|\s*`([^`]+)`\s*\|.*trigger/gi,
    /trigger[s]?.*`([^`]+)`/gi,
  ];

  for (const pattern of triggerPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      triggers.add(match[1]);
    }
  }

  // Extract from trigger tables
  const triggerStart = content.indexOf("Trigger");
  if (triggerStart !== -1) {
    let endMarker = content.indexOf("---", triggerStart);
    if (endMarker === -1) endMarker = content.length;
    const tableSection = content.slice(triggerStart, endMarker);
    const tablePattern = /\|\s*`([^`]+)`\s*\|/g;
    let match: RegExpExecArray | null;
    while ((match = tablePattern.exec(tableSection)) !== null) {
      triggers.add(match[1]);
    }
  }

  return [...triggers];
}

function extractKeywords(content: string, name: string): string[] {
  const keywords: Set<string> = new Set();

  keywords.add(name.toLowerCase());
  for (const word of name.toLowerCase().replace(/-/g, " ").split(" ")) {
    keywords.add(word);
  }

  const purposePattern = /(?:Purpose|Description)[:\s]+([^\n]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = purposePattern.exec(content)) !== null) {
    const words = match[1].toLowerCase().match(/\b[a-z]{4,}\b/g);
    if (words) {
      for (const w of words) keywords.add(w);
    }
  }

  return [...keywords];
}

function classifyDomain(keywords: string[], content: string): string[] {
  const domains: string[] = [];
  const contentLower = content.toLowerCase();

  for (const [domain, domainKeywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const kw of domainKeywords) {
      if (keywords.includes(kw) || contentLower.includes(kw)) {
        score++;
      }
    }
    if (score >= 2) {
      domains.push(domain);
    }
  }

  if (domains.length === 0) {
    domains.push("general");
  }

  return domains;
}

interface SkillData {
  name: string;
  source: string;
  path: string;
  priority: number;
  description: string;
  triggers: string[];
  keywords: string[];
  domains: string[];
  version: string;
}

function parseSkillFile(
  filePath: string,
  sourceName: string,
  priority: number,
): SkillData | null {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  const frontmatter = extractFrontmatter(content);
  const name =
    typeof frontmatter["name"] === "string"
      ? frontmatter["name"]
      : filePath.split("/").slice(-2, -1)[0];

  const triggers = extractTriggers(content);
  const keywords = extractKeywords(content, name);
  const domains = classifyDomain(keywords, content);

  let description =
    typeof frontmatter["description"] === "string"
      ? frontmatter["description"]
      : "";
  if (!description) {
    const lines = content.split("\n");
    for (const line of lines) {
      if (
        line.trim() &&
        !line.startsWith("#") &&
        !line.startsWith("-")
      ) {
        description = line.trim().slice(0, 200);
        break;
      }
    }
  }

  return {
    name,
    source: sourceName,
    path: filePath,
    priority,
    description,
    triggers,
    keywords,
    domains,
    version: getVersion(frontmatter),
  };
}

// ===========================================================================
// DISCOVERY
// ===========================================================================

function discoverSkills(verbose: boolean = false): Result {
  const skills: SkillData[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const source of SKILL_SOURCES) {
    if (!existsSync(source.path)) {
      warnings.push(`Source not found: ${source.name} (${source.path})`);
      continue;
    }

    if (verbose) {
      console.error(`Scanning ${source.name}: ${source.path}`);
    }

    // Find skill files using Bun's Glob
    const glob = new Glob(source.pattern);
    const skillFiles = [...glob.scanSync({ cwd: source.path, absolute: true })];

    for (const skillFile of skillFiles) {
      const skillData = parseSkillFile(skillFile, source.name, source.priority);
      if (skillData) {
        skills.push(skillData);
        if (verbose) {
          console.error(`  Found: ${skillData.name}`);
        }
      } else {
        warnings.push(`Failed to parse: ${skillFile}`);
      }
    }
  }

  // Sort by priority (lower = higher priority)
  skills.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

  // Build domain index
  const domainIndex: Record<string, string[]> = {};
  for (const skill of skills) {
    for (const domain of skill.domains) {
      if (!domainIndex[domain]) {
        domainIndex[domain] = [];
      }
      domainIndex[domain].push(skill.name);
    }
  }

  return {
    success: true,
    message: `Discovered ${skills.length} skills from ${SKILL_SOURCES.length} sources`,
    data: {
      skills,
      domains: domainIndex,
      sources: Object.fromEntries(
        SKILL_SOURCES.map((s) => [s.name, s.path]),
      ),
      total_count: skills.length,
    },
    warnings,
    errors,
  };
}

// ===========================================================================
// STATE MANAGEMENT
// ===========================================================================

function getIndexPath(): string {
  const cacheDir = join(HOME, ".cache", "skillrecommender");
  mkdirSync(cacheDir, { recursive: true });
  return join(cacheDir, "skill_index.json");
}

function saveIndex(result: Result, outputPath?: string): void {
  const path = outputPath ?? getIndexPath();
  const dir = resolve(path, "..");
  mkdirSync(dir, { recursive: true });

  const indexData = {
    version: "2.0.0",
    generated_at: new Date().toISOString(),
    skills: result.data["skills"],
    domains: result.data["domains"],
    sources: result.data["sources"],
    total_count: result.data["total_count"],
  };

  writeFileSync(path, JSON.stringify(indexData, null, 2));
}

// ===========================================================================
// CLI
// ===========================================================================

function parseArgs(): { output?: string; verbose: boolean; json: boolean } {
  const args = process.argv.slice(2);
  let output: string | undefined;
  let verbose = false;
  let json = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" || args[i] === "-o") {
      output = args[++i];
    } else if (args[i] === "--verbose" || args[i] === "-v") {
      verbose = true;
    } else if (args[i] === "--json") {
      json = true;
    }
  }

  return { output, verbose, json };
}

function main(): void {
  const opts = parseArgs();

  const result = discoverSkills(opts.verbose);

  saveIndex(result, opts.output);

  if (opts.json) {
    console.log(JSON.stringify(resultToDict(result), null, 2));
  } else {
    console.log(`Discovered ${result.data["total_count"]} skills`);
    const domains = result.data["domains"] as Record<string, string[]>;
    console.log(`Domains: ${Object.keys(domains).join(", ")}`);
    console.log(`Index saved to: ${opts.output ?? getIndexPath()}`);

    if (result.warnings.length > 0) {
      console.log("\nWarnings:");
      for (const warning of result.warnings) {
        console.log(`  - ${warning}`);
      }
    }
  }

  if (!result.success) {
    process.exit(1);
  } else if (
    (result.data["total_count"] as number) === 0 &&
    result.warnings.length === SKILL_SOURCES.length
  ) {
    process.exit(3);
  } else {
    process.exit(0);
  }
}

main();
