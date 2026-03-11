#!/usr/bin/env bun
/**
 * Enforce Memory-First Architecture and pre-PR validation on user prompts.
 *
 * Claude Code UserPromptSubmit hook that:
 * 1. Checks user prompts for planning/implementation keywords and injects memory-first reminder
 * 2. Detects PR creation requests and injects pre-PR validation checklist
 * 3. Detects GitHub CLI commands and injects skill-first reminders
 *
 * Hook Type: UserPromptSubmit
 * Exit Codes:
 *   0 = Success, stdout added to Claude's context
 *   2 = Block prompt (not used here)
 */

import { join } from "path";
import { skipIfConsumerRepo } from "../lib/guards.ts";

// Keywords that suggest planning or implementation work
const PLANNING_KEYWORDS: string[] = [
  "plan",
  "implement",
  "design",
  "architect",
  "build",
  "create",
  "refactor",
  "fix",
  "add",
  "update",
  "feature",
  "issue",
  "pr",
];

// PR creation patterns
const PR_PATTERNS: RegExp[] = [
  /create pr/i,
  /open pr/i,
  /submit pr/i,
  /make pr/i,
  /create pull request/i,
  /open pull request/i,
  /gh pr create/i,
  /push.*pr/i,
];

// GitHub CLI commands that should use skills instead
const GH_CLI_PATTERNS: string[] = [
  "gh pr create",
  "gh pr list",
  "gh pr view",
  "gh pr merge",
  "gh pr close",
  "gh pr checks",
  "gh pr review",
  "gh pr comment",
  "gh pr diff",
  "gh pr ready",
  "gh pr status",
  "gh issue create",
  "gh issue list",
  "gh issue view",
  "gh issue close",
  "gh issue comment",
  "gh issue edit",
  "gh api",
  "gh run",
  "gh workflow",
];

async function isValidProjectRoot(cwd: string): Promise<boolean> {
  const indicators = [".claude/settings.json", ".git"];
  for (const indicator of indicators) {
    const checkPath = join(cwd, indicator);
    const check =
      await Bun.spawn(["test", "-e", checkPath], {
        stdout: "pipe",
        stderr: "pipe",
      }).exited;
    if (check === 0) {
      return true;
    }
  }
  return false;
}

function checkPlanningKeywords(prompt: string): string | null {
  for (const keyword of PLANNING_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, "i");
    if (pattern.test(prompt)) {
      return "**Memory-First**: Search Brain memories before proceeding. Evidence in session log.";
    }
  }
  return null;
}

function checkPrKeywords(prompt: string): string | null {
  for (const pattern of PR_PATTERNS) {
    if (pattern.test(prompt)) {
      return (
        "**Pre-PR gate**: Run tests, validate syntax, " +
        "check memory naming. " +
        "Read `validation-pre-pr-checklist` memory."
      );
    }
  }
  return null;
}

function checkGhCliPatterns(prompt: string): string | null {
  for (const cmd of GH_CLI_PATTERNS) {
    const pattern = new RegExp(cmd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (pattern.test(prompt)) {
      return (
        `**Skill-first**: \`${cmd}\` detected. ` +
        "Read `.claude/skills/github/SKILL.md` for skill alternative."
      );
    }
  }
  return null;
}

async function main(): Promise<number> {
  let inputJson: string;
  let inputData: Record<string, unknown> = {};
  try {
    inputJson = await Bun.stdin.text();
    if (!inputJson.trim()) {
      return 0;
    }
    inputData = JSON.parse(inputJson);
  } catch (exc) {
    console.error(
      `WARNING: User prompt memory check: stdin read/parse error: ${exc}`,
    );
    return 0;
  }

  const stdinCwd = typeof inputData?.cwd === "string" ? inputData.cwd : undefined;

  if (await skipIfConsumerRepo("user-prompt-memory-check", stdinCwd)) {
    return 0;
  }

  const cwd = stdinCwd?.trim() || process.cwd();
  if (!(await isValidProjectRoot(cwd))) {
    console.error(
      `WARNING: user_prompt_memory_check: CWD '${cwd}' does not appear ` +
        "to be a project root (missing .claude/settings.json or .git). " +
        "Failing open.",
    );
    return 0;
  }

  let promptText = "";
  const promptValue = inputData?.prompt;
  if (typeof promptValue === "string") {
    promptText = promptValue;
  }

  if (!promptText.trim()) {
    return 0;
  }

  const planningMsg = checkPlanningKeywords(promptText);
  if (planningMsg) {
    console.log(planningMsg);
  }

  const prMsg = checkPrKeywords(promptText);
  if (prMsg) {
    console.log(prMsg);
  }

  const ghMsg = checkGhCliPatterns(promptText);
  if (ghMsg) {
    console.log(ghMsg);
  }

  return 0;
}

process.exit(await main());
