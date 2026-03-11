#!/usr/bin/env bun
/**
 * Automatically extracts skill learnings from session conversation with LLM fallback.
 *
 * Claude Code Stop hook that analyzes conversations for skill-related learnings
 * and updates skill observation memories automatically.
 *
 * Uses hybrid approach:
 * 1. Pattern-based heuristics with confidence scoring (fast, cost-free)
 * 2. LLM fallback with Claude Haiku when confidence < threshold (accurate but costs tokens)
 *
 * Confidence Levels:
 * - HIGH (0.8-1.0): Strong corrections, must fix
 * - MEDIUM (0.5-0.79): Patterns/preferences, should consider
 * - LOW (0.3-0.49): Repeated patterns, track for frequency
 *
 * Memory Storage: Uses Brain MCP (docs/) instead of .serena/memories/.
 * Skill observations are written to docs/skills/{skill-name}-observations.md.
 *
 * Hook Type: Stop (non-blocking)
 * Exit Codes: Always 0 (silent background learning)
 */

import { join, resolve, sep, basename } from "path";
import { Glob } from "bun";
import { skipIfConsumerRepo } from "../../lib/guards.ts";
import { getMemoriesDir } from "../../lib/utilities.ts";
import { loadSkillPatterns } from "./skill_pattern_loader.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HookInput {
  readonly cwd?: string;
  readonly messages?: ReadonlyArray<Message>;
}

interface Message {
  readonly role?: string;
  readonly content?: string;
}

interface Learning {
  type: string;
  source: string;
  context: string;
  confidence: number;
  method: string;
  category?: string;
}

interface LearningsByCategory {
  High: Learning[];
  Med: Learning[];
  Low: Learning[];
}

interface LlmClassification {
  is_learning?: boolean;
  type: string;
  confidence: number;
  category: string;
  extracted_learning?: string;
  reasoning?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base directory for all project operations to prevent path traversal. */
const SAFE_BASE_DIR = resolve(import.meta.dir, "..", "..", "..");
const OBSERVATIONS_SUFFIX = "-observations.md";

const CONFIDENCE_THRESHOLD = parseFloat(
  process.env["SKILL_LEARNING_CONFIDENCE_THRESHOLD"] ?? "0.7",
);
const USE_LLM_FALLBACK =
  (process.env["SKILL_LEARNING_USE_LLM"] ?? "true").toLowerCase() === "true";
const LLM_MODEL = "claude-haiku-4-5-20251001";
const LLM_MAX_TOKENS = 200;

// Module-level state
let SKILL_PATTERNS: Record<string, string[]> = {};
let COMMAND_TO_SKILL: Record<string, string> = {};
let patternsLoaded = false;
let PROJECT_DIR: string | null = null;

// Try dynamic import of Anthropic SDK (optional dependency)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Anthropic SDK may not be installed
let AnthropicClient: (new (opts: { apiKey: string }) => any) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic optional import
  const mod = await import("anthropic" as any);
  AnthropicClient = mod.default;
} catch {
  // SDK not available
}

// ---------------------------------------------------------------------------
// Path validation
// ---------------------------------------------------------------------------

function isRelativeTo(path: string, base: string): boolean {
  try {
    const resolvedPath = resolve(path);
    const resolvedBase = resolve(base);
    return resolvedPath.startsWith(resolvedBase + sep) || resolvedPath === resolvedBase;
  } catch {
    return false;
  }
}

function validatePathString(pathStr: string): string | null {
  if (typeof pathStr !== "string" || pathStr.includes("\0")) return null;
  if (/[\n\r\t\v\f]/.test(pathStr)) return null;
  const normalized = pathStr.replace(/\\/g, "/");
  if (normalized.includes("/../") || normalized.startsWith("../")) return null;
  return pathStr;
}

function getSafeRootFromEnv(envValue: string): string {
  const validated = validatePathString(envValue);
  if (validated === null) return SAFE_BASE_DIR;
  try {
    const candidate = resolve(validated);
    if (!isRelativeTo(candidate, SAFE_BASE_DIR)) return SAFE_BASE_DIR;
    return candidate;
  } catch {
    return SAFE_BASE_DIR;
  }
}

// ---------------------------------------------------------------------------
// Project directory resolution
// ---------------------------------------------------------------------------

function getProjectDirectory(hookInput: HookInput): string {
  let rawDir: string | null = null;

  const envDir = process.env["CLAUDE_PROJECT_DIR"];
  if (envDir) {
    rawDir = envDir;
  } else if (typeof hookInput === "object" && hookInput !== null) {
    const cwdVal = hookInput.cwd;
    if (typeof cwdVal === "string" && cwdVal.trim()) {
      rawDir = cwdVal;
    }
  }

  if (!rawDir) rawDir = process.cwd();

  const validated = validatePathString(rawDir);
  if (validated === null) return SAFE_BASE_DIR;

  try {
    const candidate = resolve(validated);
    if (!isRelativeTo(candidate, SAFE_BASE_DIR)) return SAFE_BASE_DIR;
    return candidate;
  } catch {
    return SAFE_BASE_DIR;
  }
}

function getSafeProjectPath(projectDir: string): string | null {
  try {
    const rootRaw = process.env["CLAUDE_PROJECT_ROOT"] ?? process.cwd();
    const safeRoot = getSafeRootFromEnv(rootRaw);
    const resolvedProject = resolve(projectDir);
    if (!isRelativeTo(resolvedProject, safeRoot)) return null;
    return resolvedProject;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pattern loading
// ---------------------------------------------------------------------------

async function ensurePatternsLoaded(projectDir: string): Promise<void> {
  if (patternsLoaded) return;
  try {
    const [patterns, commands] = await loadSkillPatterns(projectDir);
    if (Object.keys(patterns).length > 0) SKILL_PATTERNS = patterns;
    if (Object.keys(commands).length > 0) COMMAND_TO_SKILL = commands;
  } catch (error) {
    console.log(`Warning: Failed to load skill patterns: ${error}`);
  }
  patternsLoaded = true;
}

// ---------------------------------------------------------------------------
// Conversation analysis
// ---------------------------------------------------------------------------

function getConversationMessages(hookInput: HookInput): ReadonlyArray<Message> {
  return hookInput.messages ?? [];
}

function detectSkillUsage(
  messages: ReadonlyArray<Message>,
): Record<string, number> {
  const detectedSkills: Record<string, number> = {};
  const conversationText = messages
    .filter((msg) => typeof msg.content === "string")
    .map((msg) => msg.content as string)
    .join(" ");

  // Detect skills from .claude/skills/{skill-name} references
  const skillPathPattern = /\.claude[/\\]skills[/\\]([a-z0-9-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = skillPathPattern.exec(conversationText)) !== null) {
    const skillName = match[1];
    detectedSkills[skillName] = (detectedSkills[skillName] ?? 0) + 1;
  }

  // Detect skills from slash commands using centralized mapping
  const slashCmdPattern = /\/([a-z][a-z0-9-]+)/g;
  while ((match = slashCmdPattern.exec(conversationText)) !== null) {
    const cmdName = match[1];
    if (cmdName in COMMAND_TO_SKILL) {
      const skillName = COMMAND_TO_SKILL[cmdName];
      detectedSkills[skillName] = (detectedSkills[skillName] ?? 0) + 1;
    }
  }

  // Pattern-based detection using centralized patterns
  for (const [skill, patterns] of Object.entries(SKILL_PATTERNS)) {
    let matchCount = 0;
    for (const msg of messages) {
      const content = msg.content;
      if (typeof content !== "string") continue;
      for (const pattern of patterns) {
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(escaped, "i").test(content)) {
          matchCount++;
        }
      }
    }
    if (matchCount >= 2) {
      detectedSkills[skill] = (detectedSkills[skill] ?? 0) + matchCount;
    }
  }

  return detectedSkills;
}

function checkSkillContext(text: string, skill: string): boolean {
  if (skill in SKILL_PATTERNS) {
    for (const pattern of SKILL_PATTERNS[skill]) {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(escaped, "i").test(text)) return true;
    }
    return false;
  }

  // Dynamically detected skills
  const nameEscaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(nameEscaped, "i").test(text)) return true;
  const pathEscaped = `.claude[/\\\\]skills[/\\\\]${nameEscaped}`;
  if (new RegExp(pathEscaped, "i").test(text)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// API key retrieval
// ---------------------------------------------------------------------------

async function getApiKey(): Promise<string | null> {
  const envKey = process.env["ANTHROPIC_API_KEY"];
  if (envKey) return envKey;

  let envRoot = PROJECT_DIR;
  if (envRoot === null) {
    const envValue = process.env["CLAUDE_PROJECT_DIR"];
    if (envValue) {
      try {
        const candidate = resolve(envValue);
        if (isRelativeTo(candidate, SAFE_BASE_DIR)) {
          envRoot = candidate;
        }
      } catch {
        // fall through
      }
    }
    if (envRoot === null) envRoot = SAFE_BASE_DIR;
  }

  const envFile = Bun.file(join(envRoot, ".env"));
  if (await envFile.exists()) {
    const content = await envFile.text();
    for (const line of content.split("\n")) {
      if (line.startsWith("ANTHROPIC_API_KEY=")) {
        return line.split("=", 2)[1].trim().replace(/^['"]|['"]$/g, "");
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// LLM classification
// ---------------------------------------------------------------------------

async function classifyLearningByLlm(
  assistantMsg: string,
  userResponse: string,
  skillName: string,
): Promise<Learning | null> {
  if (AnthropicClient === null) return null;

  const apiKey = await getApiKey();
  if (!apiKey) return null;

  try {
    const client = new AnthropicClient({ apiKey });

    const prompt = `Analyze this conversation exchange for skill-related learnings about the "${skillName}" skill.

Assistant said:
${assistantMsg.slice(0, 500)}

User responded:
${userResponse}

Is this a learning signal? If yes, extract the learning and classify it:

Categories:
- HIGH (correction): Strong user corrections ("no", "wrong", "never do", "must use")
- HIGH (chestertons_fence): Removed something without understanding why
- HIGH (immediate_correction): User immediately asked to debug/fix right after
- MED (preference): Tool/approach preferences ("instead of using", "prefer to", "should use X")
- MED (success): Success patterns ("perfect", "excellent", "exactly", "that's it") - no qualifiers like "but"
- MED (edge_case): Important edge cases ("what if the/this", "ensure that", "make sure")
- MED (documentation): Documentation feedback ("update the docs", "needs documentation")
- MED (question): Short clarifying question (may indicate confusion)
- LOW (command_pattern): Repeated command patterns

Respond in JSON format:
{
  "is_learning": true/false,
  "type": "correction|preference|success|edge_case|documentation|question|command_pattern|chestertons_fence|immediate_correction",
  "confidence": 0.0-1.0,
  "category": "High|Med|Low",
  "extracted_learning": "The key lesson learned",
  "reasoning": "Why this is/isn't a learning"
}`;

    const message = await client.messages.create({
      model: LLM_MODEL,
      max_tokens: LLM_MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText =
      message.content[0].type === "text"
        ? message.content[0].text.trim()
        : "";

    let jsonStr = responseText;
    const codeBlockMatch = /```(?:json)?\s*(\{.*?\})\s*```/s.exec(
      responseText,
    );
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }

    const result = JSON.parse(jsonStr) as LlmClassification;

    if (!result.is_learning) return null;

    const confidence = Number(result.confidence);
    if (isNaN(confidence) || confidence < 0 || confidence > 1) {
      console.log(`LLM confidence out of range: ${confidence}`);
      return null;
    }

    return {
      type: result.type,
      confidence,
      source: result.extracted_learning ?? userResponse.slice(0, 150),
      context: "",
      category: result.category,
      method: "haiku-llm",
    };
  } catch (error) {
    console.log(`LLM classification error: ${error}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Learning extraction
// ---------------------------------------------------------------------------

function extractLearnings(
  messages: ReadonlyArray<Message>,
  skillName: string,
): LearningsByCategory {
  const learnings: LearningsByCategory = {
    High: [],
    Med: [],
    Low: [],
  };

  const pendingLlm: Array<{
    learning: Learning;
    assistantContent: string;
    userResponse: string;
  }> = [];

  for (let i = 0; i < messages.length - 1; i++) {
    const msg = messages[i];
    const nextMsg = messages[i + 1];

    if (msg.role !== "assistant" || nextMsg.role !== "user") continue;

    const assistantContent = msg.content;
    const userResponse = nextMsg.content;

    if (typeof assistantContent !== "string" || typeof userResponse !== "string")
      continue;

    // Build context window
    let contextWindow = "";
    if (i > 0) {
      const prevContent = messages[i - 1].content;
      if (typeof prevContent === "string") contextWindow += prevContent + " ";
    }
    contextWindow += assistantContent + " " + userResponse;
    if (i + 2 < messages.length) {
      const nextContent = messages[i + 2].content;
      if (typeof nextContent === "string") contextWindow += " " + nextContent;
    }

    if (!checkSkillContext(contextWindow, skillName)) continue;

    let learning: Learning | null = null;

    // HIGH: Strong corrections (confidence 0.85-0.95)
    if (
      /\b(no\b|nope|not like that|that's wrong|incorrect|never do|always do|don't ever|must use|should not|avoid|stop)\b/i.test(
        userResponse,
      )
    ) {
      const wordCount = (
        userResponse.match(/\b(no|wrong|never|must)\b/gi) ?? []
      ).length;
      learning = {
        type: "correction",
        source: userResponse.slice(0, 150),
        context: assistantContent.slice(0, 150),
        confidence: wordCount > 1 ? 0.9 : 0.85,
        method: "pattern",
      };
    }

    // HIGH: Chesterton's Fence (confidence 0.95)
    else if (
      /trashed without understanding|removed without knowing|deleted without checking|why was this here/i.test(
        userResponse,
      )
    ) {
      learning = {
        type: "chestertons_fence",
        source: userResponse.slice(0, 150),
        context: assistantContent.slice(0, 150),
        confidence: 0.95,
        method: "pattern",
      };
    }

    // HIGH: Immediate corrections (confidence 0.8-0.85)
    else if (
      /\b(debug|root cause|correct|fix all|address|broken|error|issue|problem)\b/i.test(
        userResponse,
      ) &&
      userResponse.length < 200
    ) {
      learning = {
        type: "immediate_correction",
        source: userResponse.slice(0, 150),
        context: assistantContent.slice(0, 150),
        confidence: userResponse.length < 50 ? 0.85 : 0.8,
        method: "pattern",
      };
    }

    // MED: Tool preferences (confidence 0.7-0.75)
    else if (
      /\b((?:instead of|rather than)\s+(?:using|that|the|this)|prefer\s+(?:to|using|that)|should\s+use\s+\w+|use\s+\w+\s+(?:instead|rather)|better\s+to\s+(?:use|do|have))\b/i.test(
        userResponse,
      )
    ) {
      learning = {
        type: "preference",
        source: userResponse.slice(0, 150),
        context: assistantContent.slice(0, 150),
        confidence: /\b(prefer|should use)\b/i.test(userResponse) ? 0.75 : 0.7,
        method: "pattern",
      };
    }

    // MED: Success patterns (confidence 0.65-0.7)
    else if (
      /^(?:(?:ok|okay|yeah|yep|sure|alright)[,!\s]+)?(?:perfect(?![a-z])|excellent(?:!|\s*$)|exactly(?:!|\s*$)|that's\s+(?:it|right|correct)|good\s+job|well\s+done|works(?:\s+great|\s+perfectly|!)(?!\s+(?:but|however|except))|(?:yes|correct|right)(?:\s*[!.])?$)/i.test(
        userResponse,
      ) &&
      !/\b(but|however|except|although|though)\b/i.test(userResponse)
    ) {
      learning = {
        type: "success",
        source: userResponse.slice(0, 150),
        context: assistantContent.slice(0, 150),
        confidence: /\b(perfect|excellent)\b/i.test(userResponse) ? 0.7 : 0.65,
        method: "pattern",
      };
    }

    // MED: Edge cases (confidence 0.6-0.65)
    else if (
      /(?:what\s+if\s+(?:the|this|we|it|there|a\s+user)|how\s+(?:does|will|would)\s+(?:it|this|the)|what\s+about\s+(?:the|when|if|edge|corner|error)|(?:don't|do\s+not)\s+(?:want\s+to\s+)?forget|(?:ensure|make\s+sure|verify)\s+(?:that|the|it|we)).*\?/i.test(
        userResponse,
      ) &&
      !/\b(lunch|dinner|coffee|meeting|call|later|tomorrow)\b/i.test(
        userResponse,
      )
    ) {
      learning = {
        type: "edge_case",
        source: userResponse.slice(0, 150),
        context: assistantContent.slice(0, 150),
        confidence: /\b(ensure|make sure|verify)\b/i.test(userResponse)
          ? 0.65
          : 0.6,
        method: "pattern",
      };
    }

    // MED: Documentation feedback (confidence 0.6-0.65)
    else if (
      /\b((?:update|add|fix|improve)\s+(?:the\s+)?(?:docs?|documentation|readme)|(?:docs?|documentation|readme)\s+(?:is|are|needs?|should)|document(?:ed)?\s+(?:this|that|it|the)|add\s+(?:a\s+)?comment|(?:missing|lacking|needs?)\s+(?:docs?|documentation))\b/i.test(
        userResponse,
      )
    ) {
      learning = {
        type: "documentation",
        source: userResponse.slice(0, 150),
        context: assistantContent.slice(0, 150),
        confidence: /\b(must|should|needs?)\b/i.test(userResponse)
          ? 0.65
          : 0.6,
        method: "pattern",
      };
    }

    // MED: Clarifying questions (confidence 0.55-0.6)
    else if (
      /\?/.test(userResponse) &&
      userResponse.length < 50 &&
      /^(why|how|what|when|where|can|does|is|are)\b/i.test(userResponse)
    ) {
      learning = {
        type: "question",
        source: userResponse.slice(0, 150),
        context: assistantContent.slice(0, 150),
        confidence: userResponse.length < 30 ? 0.6 : 0.55,
        method: "pattern",
      };
    }

    // LOW: Command patterns (confidence 0.4-0.5)
    else if (/^(\.\/?|pwsh |gh |git )/i.test(userResponse)) {
      learning = {
        type: "command_pattern",
        source: userResponse.slice(0, 100),
        context: assistantContent.slice(0, 100),
        confidence: 0.45,
        method: "pattern",
      };
    }

    // LOW: Short acknowledgements (confidence 0.35-0.45)
    else if (
      /^(?:ok|okay|sure|got it|sounds good|thanks|thank you|yep|yeah|alright|fine|k|kk)(?:[.!,]?\s*)?$/i.test(
        userResponse.trim(),
      ) &&
      userResponse.trim().length < 30
    ) {
      learning = {
        type: "acknowledgement",
        source: userResponse.slice(0, 50),
        context: assistantContent.slice(0, 100),
        confidence: 0.4,
        method: "pattern",
      };
    }

    // LOW: Repeated tool/file mentions (confidence 0.35-0.45)
    else if (
      /\b(same|again|also|another|more|repeat|similar|like before|as usual)\b/i.test(
        userResponse,
      ) &&
      userResponse.length < 100
    ) {
      learning = {
        type: "repeated_pattern",
        source: userResponse.slice(0, 100),
        context: assistantContent.slice(0, 100),
        confidence: 0.4,
        method: "pattern",
      };
    }

    // Queue for LLM fallback if below threshold
    if (
      learning &&
      learning.confidence < CONFIDENCE_THRESHOLD &&
      USE_LLM_FALLBACK
    ) {
      pendingLlm.push({ learning, assistantContent, userResponse });
    }

    // Categorize by confidence
    if (learning) {
      if (learning.confidence >= 0.8) {
        learnings.High.push(learning);
      } else if (learning.confidence >= 0.5) {
        learnings.Med.push(learning);
      } else {
        learnings.Low.push(learning);
      }
    }
  }

  return learnings;
}

// Process LLM fallback calls (separate async pass after sync extraction)
async function applyLlmFallbacks(
  learnings: LearningsByCategory,
  messages: ReadonlyArray<Message>,
  skillName: string,
): Promise<void> {
  // Re-scan for items below threshold that could benefit from LLM
  const allLearnings = [
    ...learnings.High,
    ...learnings.Med,
    ...learnings.Low,
  ];

  for (const learning of allLearnings) {
    if (learning.confidence >= CONFIDENCE_THRESHOLD) continue;
    if (!USE_LLM_FALLBACK) continue;

    const llmResult = await classifyLearningByLlm(
      learning.context,
      learning.source,
      skillName,
    );
    if (llmResult && llmResult.confidence > learning.confidence) {
      // Replace in-place
      Object.assign(learning, llmResult);
    }
  }

  // Re-categorize after LLM adjustments
  const recat: LearningsByCategory = { High: [], Med: [], Low: [] };
  for (const l of allLearnings) {
    if (l.confidence >= 0.8) recat.High.push(l);
    else if (l.confidence >= 0.5) recat.Med.push(l);
    else recat.Low.push(l);
  }
  learnings.High = recat.High;
  learnings.Med = recat.Med;
  learnings.Low = recat.Low;
}

// ---------------------------------------------------------------------------
// Memory file update -- writes to docs/skills/ (Brain MCP compatible)
// ---------------------------------------------------------------------------

function escapeReplacementString(text: string): string {
  return text.replace(/\\/g, "\\\\");
}

async function updateSkillMemory(
  projectDir: string,
  skillName: string,
  learnings: LearningsByCategory,
  sessionId: string,
): Promise<boolean> {
  // Security: validate project_dir is within SAFE_BASE_DIR
  try {
    const allowedDir = resolve(projectDir);
    if (!isRelativeTo(allowedDir, SAFE_BASE_DIR)) {
      console.log(
        `Path traversal attempt detected: '${allowedDir}' is outside safe base directory`,
      );
      return false;
    }
  } catch (error) {
    console.log(`Path validation error for project_dir: ${error}`);
    return false;
  }

  // Validate skill_name
  if (!/^[A-Za-z0-9_-]+$/.test(skillName)) {
    console.log(
      `Invalid skill name: '${skillName}' contains unsupported characters`,
    );
    return false;
  }

  // Use docs/skills/ for Brain MCP compatibility
  const memoriesDir = join(resolve(projectDir), "docs", "skills");
  const memoryPath = join(memoriesDir, `${skillName}${OBSERVATIONS_SUFFIX}`);

  // Validate resolved path is within project directory
  const resolvedPath = resolve(memoryPath);
  if (!resolvedPath.startsWith(resolve(projectDir) + sep)) {
    console.log(
      `Path traversal attempt detected: '${resolvedPath}' is outside project directory`,
    );
    return false;
  }

  // Ensure directory exists
  const { mkdir } = await import("fs/promises");
  await mkdir(memoriesDir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);

  // Read existing or create new content
  let content: string;
  const file = Bun.file(resolvedPath);
  if (await file.exists()) {
    content = await file.text();
  } else {
    content = `# Skill Observations: ${skillName}

**Last Updated**: ${today}
**Sessions Analyzed**: 0

## Constraints (HIGH confidence)

## Preferences (MED confidence)

## Edge Cases (MED confidence)

## Documentation (MED confidence)

## Notes for Review (LOW confidence)

`;
  }

  // HIGH: Append to Constraints section
  if (learnings.High.length > 0) {
    let items = "";
    for (const l of learnings.High) {
      const source = escapeReplacementString(l.source);
      const methodTag = l.method === "haiku-llm" ? " [LLM]" : "";
      items += `- ${source}${methodTag} (Session ${sessionId}, ${today})\n`;
    }
    content = content.replace(
      /(## Constraints \(HIGH confidence\)\r?\n)/,
      `$1${items}`,
    );
  }

  // MED: Group by type
  if (learnings.Med.length > 0) {
    // Preferences
    let prefItems = "";
    for (const l of learnings.Med) {
      if (l.type === "success" || l.type === "preference") {
        const source = escapeReplacementString(l.source);
        const methodTag = l.method === "haiku-llm" ? " [LLM]" : "";
        prefItems += `- ${source}${methodTag} (Session ${sessionId}, ${today})\n`;
      }
    }
    if (prefItems) {
      content = content.replace(
        /(## Preferences \(MED confidence\)\r?\n)/,
        `$1${prefItems}`,
      );
    }

    // Edge Cases
    let edgeItems = "";
    for (const l of learnings.Med) {
      if (l.type === "edge_case" || l.type === "question") {
        const source = escapeReplacementString(l.source);
        const methodTag = l.method === "haiku-llm" ? " [LLM]" : "";
        edgeItems += `- ${source}${methodTag} (Session ${sessionId}, ${today})\n`;
      }
    }
    if (edgeItems) {
      content = content.replace(
        /(## Edge Cases \(MED confidence\)\r?\n)/,
        `$1${edgeItems}`,
      );
    }

    // Documentation feedback
    let docItems = "";
    for (const l of learnings.Med) {
      if (l.type === "documentation") {
        const source = escapeReplacementString(l.source);
        const methodTag = l.method === "haiku-llm" ? " [LLM]" : "";
        docItems += `- ${source}${methodTag} (Session ${sessionId}, ${today})\n`;
      }
    }
    if (docItems) {
      if (!content.includes("## Documentation (MED confidence)")) {
        content = content.replace(
          /(## Notes for Review \(LOW confidence\))/,
          "## Documentation (MED confidence)\n\n$1",
        );
      }
      content = content.replace(
        /(## Documentation \(MED confidence\)\r?\n)/,
        `$1${docItems}`,
      );
    }

    // Catch-all for MED learnings with types not handled above
    const handledMedTypes = new Set([
      "success",
      "preference",
      "edge_case",
      "question",
      "documentation",
    ]);
    let otherMedItems = "";
    for (const l of learnings.Med) {
      if (!handledMedTypes.has(l.type)) {
        const source = escapeReplacementString(l.source);
        const methodTag = l.method === "haiku-llm" ? " [LLM]" : "";
        otherMedItems += `- [${l.type}] ${source}${methodTag} (Session ${sessionId}, ${today})\n`;
      }
    }
    if (otherMedItems) {
      content = content.replace(
        /(## Preferences \(MED confidence\)\r?\n)/,
        `$1${otherMedItems}`,
      );
    }
  }

  // LOW: Command patterns
  if (learnings.Low.length > 0) {
    let lowItems = "";
    for (const l of learnings.Low) {
      const source = escapeReplacementString(l.source);
      lowItems += `- ${source} (Session ${sessionId}, ${today})\n`;
    }
    content = content.replace(
      /(## Notes for Review \(LOW confidence\)\r?\n)/,
      `$1${lowItems}`,
    );
  }

  // Update session count
  const countMatch = /Sessions Analyzed: (\d+)/.exec(content);
  if (countMatch) {
    const count = parseInt(countMatch[1], 10) + 1;
    content = content.replace(
      /Sessions Analyzed: \d+/,
      `Sessions Analyzed: ${count}`,
    );
  }

  // Update last updated date
  content = content.replace(
    /\*\*Last Updated\*\*: [\d-]+/,
    `**Last Updated**: ${today}`,
  );

  await Bun.write(resolvedPath, content);
  return true;
}

// ---------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------

function writeLearningNotification(
  skillName: string,
  highCount: number,
  medCount: number,
  lowCount: number,
): void {
  const total = highCount + medCount + lowCount;
  if (total > 0) {
    console.log(
      `Learned from session: ${skillName} (${highCount} HIGH, ${medCount} MED, ${lowCount} LOW)`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  try {
    const inputJson = await Bun.stdin.text();
    if (!inputJson.trim()) return 0;

    const hookInput = JSON.parse(inputJson) as HookInput;

    if (await skipIfConsumerRepo("skill-learning", hookInput.cwd)) return 0;
    const projectDir = getProjectDirectory(hookInput);
    const safeProjectPath = getSafeProjectPath(projectDir);
    if (safeProjectPath === null) return 0;

    PROJECT_DIR = safeProjectPath;

    await ensurePatternsLoaded(safeProjectPath);

    const messages = getConversationMessages(hookInput);
    if (messages.length === 0) return 0;

    const detectedSkills = detectSkillUsage(messages);
    if (Object.keys(detectedSkills).length === 0) return 0;

    // Get session ID from today's session log
    const memoriesDir = await getMemoriesDir(hookInput.cwd);
    const sessionsDir = memoriesDir
      ? join(memoriesDir, "sessions")
      : join(safeProjectPath, "docs", "sessions");
    const today = new Date().toISOString().slice(0, 10);

    let sessionId = `${today}-session-unknown`;
    const dirExists =
      (await Bun.spawn(["test", "-d", sessionsDir]).exited) === 0;
    if (dirExists) {
      const glob = new Glob(`${today}-session-*.json`);
      const matches: Array<{ path: string; mtime: number }> = [];
      try {
        for await (const entry of glob.scan({ cwd: sessionsDir })) {
          const fullPath = join(sessionsDir, entry);
          matches.push({
            path: fullPath,
            mtime: Bun.file(fullPath).lastModified,
          });
        }
        matches.sort((a, b) => b.mtime - a.mtime);
        if (matches.length > 0) {
          // Extract stem (filename without extension)
          const name = basename(matches[0].path);
          sessionId = name.replace(/\.json$/, "");
        }
      } catch {
        // use fallback session ID
      }
    }

    // Process each detected skill
    for (const skillName of Object.keys(detectedSkills)) {
      const learnings = extractLearnings(messages, skillName);

      // Apply LLM fallbacks for uncertain learnings
      await applyLlmFallbacks(learnings, messages, skillName);

      const highCount = learnings.High.length;
      const medCount = learnings.Med.length;
      const lowCount = learnings.Low.length;

      // Only update if learnings meet threshold
      if (highCount >= 1 || medCount >= 2 || lowCount >= 3) {
        const updated = await updateSkillMemory(
          safeProjectPath,
          skillName,
          learnings,
          sessionId,
        );
        if (updated) {
          writeLearningNotification(skillName, highCount, medCount, lowCount);
        }
      }
    }

    return 0;
  } catch (error) {
    console.log(`Skill learning hook error: ${error}`);
    return 0;
  }
}

process.exit(await main());
