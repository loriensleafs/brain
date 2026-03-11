#!/usr/bin/env bun
/**
 * Detect ADR file changes and inject /adr-review guidance.
 *
 * Claude Code PostToolUse hook that fires after Write, Edit, or Bash
 * operations targeting ADR files. Injects context reminding Claude that
 * /adr-review is required before committing ADR changes.
 *
 * This is shift-left from the commit-time gate (invoke_adr_review_guard).
 * Guidance is injected immediately when an ADR is created, modified, or deleted,
 * not deferred until commit.
 *
 * Detected operations:
 * - Write: New ADR file created or overwritten
 * - Edit: Existing ADR file modified
 * - Bash: rm, git rm, mv, git mv targeting ADR files
 *
 * Hook Type: PostToolUse
 * Exit Codes:
 *     0 = Always (non-blocking, injects guidance via stdout)
 */

import { skipIfConsumerRepo } from "../../lib/guards.ts";

interface HookInput {
  readonly cwd?: string;
  readonly tool_name?: string;
  readonly tool_input?: {
    readonly file_path?: string;
    readonly command?: string;
  };
}

const ADR_PATH_PATTERN = /ADR-\d+.*\.md$/i;
const DESTRUCTIVE_CMD_PATTERN = /\b(?:rm|git\s+rm|mv|git\s+mv)\b.*ADR-\d+/i;

const GUIDANCE_CREATE = (filePath: string): string => `
## ADR Change Detected: File Created

**${filePath}** was just created.

Before committing, you MUST run \`/adr-review\` for multi-agent consensus.
The commit-time gate will block without review evidence.
`;

const GUIDANCE_EDIT = (filePath: string): string => `
## ADR Change Detected: File Modified

**${filePath}** was just modified.

Before committing, you MUST run \`/adr-review\` for multi-agent consensus.
The commit-time gate will block without review evidence.
`;

const GUIDANCE_DELETE = (command: string): string => `
## ADR Change Detected: File Removed

An ADR file was targeted by a destructive operation: \`${command}\`

Before committing, you MUST run \`/adr-review\` to document the deprecation.
The commit-time gate will block without review evidence.
`;

function isAdrPath(filePath: string): boolean {
  return ADR_PATH_PATTERN.test(filePath);
}

function detectAdrInBash(command: string): boolean {
  return DESTRUCTIVE_CMD_PATTERN.test(command);
}

function detectWriteOrEdit(
  toolInput: HookInput["tool_input"],
): string | null {
  const filePath = String(toolInput?.file_path ?? "");
  if (!filePath) return null;
  return isAdrPath(filePath) ? filePath : null;
}

async function main(): Promise<number> {
  let raw = "";
  try {
    raw = await Bun.stdin.text();
    if (!raw.trim()) return 0;

    const hookInput = JSON.parse(raw) as HookInput;

    if (await skipIfConsumerRepo("adr-lifecycle-hook", hookInput.cwd)) return 0;
    const toolName = hookInput.tool_name ?? "";
    const toolInput = hookInput.tool_input;

    if (typeof toolInput !== "object" || toolInput === null) return 0;

    if (toolName === "Write" || toolName === "Edit") {
      const adrPath = detectWriteOrEdit(toolInput);
      if (adrPath) {
        const isNew = toolName === "Write";
        console.log(isNew ? GUIDANCE_CREATE(adrPath) : GUIDANCE_EDIT(adrPath));
      }
    } else if (toolName === "Bash") {
      const command = String(toolInput.command ?? "");
      if (command && detectAdrInBash(command)) {
        console.log(GUIDANCE_DELETE(command));
      }
    }
  } catch (error) {
    const inputSize = raw.length;
    console.error(
      `ADR lifecycle hook error (input_size=${inputSize}): ${error}`,
    );
  }

  return 0;
}

process.exit(await main());
