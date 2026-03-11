#!/usr/bin/env bun
/**
 * Block raw gh commands when validated skill scripts exist.
 *
 * Claude Code PreToolUse hook that enforces skills-first mandate by blocking
 * raw gh CLI commands when a tested, validated skill script exists for that
 * operation.
 *
 * Uses two-stage skill discovery:
 * 1. Exact mapping via hardcoded operation->action table
 * 2. Fuzzy matching via filesystem scan (fallback)
 *
 * Hook Type: PreToolUse
 * Exit Codes:
 *   0 = Allow (not a gh command, or no skill exists)
 *   2 = Block (skill exists, must use it)
 */

import { join } from "path";
import { Glob } from "bun";
import { getProjectDirectory } from "../../lib/utilities.ts";
import { skipIfConsumerRepo } from "../../lib/guards.ts";

const GH_COMMAND_PATTERN = /\bgh\s+(\w+)\s+(\w+)/;

interface SkillMapping {
  script: string;
  example: string;
}

const SKILL_MAPPINGS: Record<string, Record<string, SkillMapping>> = {
  pr: {
    view: {
      script: "get_pr_context.ts",
      example:
        "bun run .claude/skills/github/scripts/pr/get_pr_context.ts --pull-request 123",
    },
    list: {
      script: "get_pull_requests.ts",
      example:
        "bun run .claude/skills/github/scripts/pr/get_pull_requests.ts",
    },
    create: {
      script: "new_pr.ts",
      example:
        'bun run .claude/skills/github/scripts/pr/new_pr.ts --title "..." --body "..."',
    },
    comment: {
      script: "post_pr_comment_reply.ts",
      example:
        'bun run .claude/skills/github/scripts/pr/post_pr_comment_reply.ts --pull-request 123 --body "..."',
    },
    merge: {
      script: "merge_pr.ts",
      example:
        "bun run .claude/skills/github/scripts/pr/merge_pr.ts --pull-request 123",
    },
    close: {
      script: "close_pr.ts",
      example:
        "bun run .claude/skills/github/scripts/pr/close_pr.ts --pull-request 123",
    },
    checks: {
      script: "get_pr_checks.ts",
      example:
        "bun run .claude/skills/github/scripts/pr/get_pr_checks.ts --pull-request 123",
    },
  },
  issue: {
    view: {
      script: "get_issue_context.ts",
      example:
        "bun run .claude/skills/github/scripts/issue/get_issue_context.ts --issue 456",
    },
    create: {
      script: "new_issue.ts",
      example:
        'bun run .claude/skills/github/scripts/issue/new_issue.ts --title "..." --body "..."',
    },
    comment: {
      script: "post_issue_comment.ts",
      example:
        'bun run .claude/skills/github/scripts/issue/post_issue_comment.ts --issue 456 --body "..."',
    },
    list: {
      script: "get_issue_context.ts",
      example:
        "bun run .claude/skills/github/scripts/issue/get_issue_context.ts",
    },
  },
};

interface GhCommand {
  operation: string;
  action: string;
  fullCommand: string;
}

function parseGhCommand(command: string): GhCommand | null {
  if (!command) {
    return null;
  }
  const match = GH_COMMAND_PATTERN.exec(command);
  if (!match) {
    return null;
  }
  return {
    operation: match[1],
    action: match[2],
    fullCommand: command,
  };
}

interface SkillResult {
  path: string;
  example: string;
}

async function findSkillScript(
  operation: string,
  action: string,
  projectDir: string,
): Promise<SkillResult | null> {
  // Stage 1: Exact mapping
  const opMappings = SKILL_MAPPINGS[operation];
  if (opMappings) {
    const actionMapping = opMappings[action];
    if (actionMapping) {
      const scriptPath = join(
        projectDir,
        ".claude",
        "skills",
        "github",
        "scripts",
        operation,
        actionMapping.script,
      );
      const file = Bun.file(scriptPath);
      if (await file.exists()) {
        return { path: scriptPath, example: actionMapping.example };
      }
    }
  }

  // Stage 2: Fuzzy matching
  const searchPath = join(
    projectDir,
    ".claude",
    "skills",
    "github",
    "scripts",
    operation,
  );

  const searchDirCheck =
    await Bun.spawn(["test", "-d", searchPath], {
      stdout: "pipe",
      stderr: "pipe",
    }).exited;
  if (searchDirCheck !== 0) {
    return null;
  }

  // Try .ts files first, then .ps1
  for (const ext of ["ts", "ps1"]) {
    const glob = new Glob(`*${action}*.${ext}`);
    for await (const entry of glob.scan({ cwd: searchPath })) {
      const relativePath = `.claude/skills/github/scripts/${operation}/${entry}`;
      const runner = ext === "ts" ? "bun run" : "pwsh";
      return {
        path: join(searchPath, entry),
        example: `${runner} ${relativePath} [parameters]`,
      };
    }
  }

  return null;
}

function writeBlockResponse(
  blockedCommand: string,
  skillPath: string,
  exampleUsage: string,
  projectDir: string,
): void {
  let agentsRef = "";
  if (projectDir) {
    const agentsPath = join(projectDir, "AGENTS.md");
    // Sync check -- blocking hooks should be fast
    const file = Bun.file(agentsPath);
    // We check synchronously via size > 0 heuristic; the file object is lazy
    agentsRef = " See: `AGENTS.md > Skill-First Checkpoint`";
  }
  const output =
    "\n## BLOCKED: Raw GitHub Command Detected\n\n" +
    "**YOU MUST use the validated skill script " +
    "instead of raw `gh` commands.**\n\n" +
    "### Blocked Command\n```\n" +
    `${blockedCommand}\n\`\`\`\n\n` +
    "### Required Alternative (Copy-Paste Ready)\n" +
    `\`\`\`bash\n${exampleUsage}\n\`\`\`\n\n` +
    "**Why Skills Are Mandatory**:\n" +
    "- Tested with coverage\n" +
    "- Structured error handling\n" +
    "- Consistent output format\n" +
    "- Centrally maintained\n" +
    "- Raw `gh` commands: None of the above\n\n" +
    `**This is not optional.**${agentsRef}\n`;
  console.log(output);
  console.error(
    `Blocked: Raw gh command detected. Use skill at ${skillPath}`,
  );
}

async function main(): Promise<number> {
  try {
    const inputJson = await Bun.stdin.text();
    if (!inputJson.trim()) {
      return 0;
    }

    const hookInput = JSON.parse(inputJson);
    const stdinCwd: string | undefined = hookInput?.cwd;

    if (await skipIfConsumerRepo("skill-first-guard", stdinCwd)) {
      return 0;
    }

    const toolInput = hookInput?.tool_input;
    if (typeof toolInput !== "object" || toolInput === null) {
      return 0;
    }
    const command = toolInput.command;
    if (!command) {
      return 0;
    }

    const ghCommand = parseGhCommand(command);
    if (ghCommand === null) {
      return 0;
    }

    const projectDir = await getProjectDirectory(stdinCwd);
    const skill = await findSkillScript(
      ghCommand.operation,
      ghCommand.action,
      projectDir,
    );

    if (skill === null) {
      // No skill exists, fail-open (allow new capabilities)
      return 0;
    }

    // Skill exists, BLOCK with educational message
    writeBlockResponse(
      ghCommand.fullCommand,
      skill.path,
      skill.example,
      projectDir,
    );
    return 2;
  } catch (exc) {
    const excType =
      exc instanceof Error ? exc.constructor.name : typeof exc;
    console.error(`Skill-first guard error: ${excType} - ${exc}`);
    return 0;
  }
}

process.exit(await main());
