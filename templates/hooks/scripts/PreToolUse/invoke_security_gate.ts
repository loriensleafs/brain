#!/usr/bin/env bun
/**
 * Block Edit/Write on auth-related files without security review evidence.
 *
 * Claude Code PreToolUse hook that enforces the security gate.
 * Blocks modifications to authentication and authorization files
 * unless security review evidence exists in the current session.
 *
 * Hook Type: PreToolUse
 * Matcher: Edit, Write
 * Exit Codes:
 *   0 = Allow (not an auth file, or security review exists)
 *   2 = Block (auth file modification without security review)
 */

import { join } from "path";
import { Glob } from "bun";
import { getProjectDirectory } from "../../lib/utilities.ts";

// File path patterns that indicate auth-related code
const AUTH_PATH_PATTERNS = [
  /(^|[/\\])[Aa]uth[/\\]/,
  /(^|[/\\])[Aa]uthentication[/\\]/,
  /(^|[/\\])[Aa]uthorization[/\\]/,
  /\.auth\.(ts|js|py|cs|java|go|rb)$/,
  /(^|[/\\])middleware[/\\]auth/i,
];

// Session log patterns indicating security review was performed
const SECURITY_REVIEW_PATTERNS = [
  /security.*review/i,
  /security.*agent/i,
  /threat.*model/i,
  /OWASP/i,
  /\/security-scan/,
  /security-scan skill/,
  /subagent_type.*security/i,
];

const BLOCK_TEMPLATE = `
## BLOCKED: Security Review Required for Auth Files

**Security gate: Security review required before modifying authentication/authorization files.**

### File

\`\`\`
{file_path}
\`\`\`

### Required Action

Run the security agent before editing auth-related files:

\`\`\`
Task(subagent_type='security', prompt='Review auth-related changes for {file_path}')
\`\`\`

The security agent will assess:
- Authentication flow security
- Authorization model correctness
- OWASP Top 10 considerations
- Threat model updates

### Alternative: Create Security Report

Place a security review report in \`.agents/security/\` with today's date:

\`\`\`
.agents/security/YYYY-MM-DD-security-review.md
\`\`\`
`;

function isAuthPath(filePath: string): boolean {
  if (!filePath) {
    return false;
  }
  for (const pattern of AUTH_PATH_PATTERNS) {
    if (pattern.test(filePath)) {
      return true;
    }
  }
  return false;
}

async function findSecurityEvidence(
  projectDir: string,
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);

  // Check 1: Security report exists for today
  const securityDir = join(projectDir, ".agents", "security");
  const secDirCheck =
    await Bun.spawn(["test", "-d", securityDir], {
      stdout: "pipe",
      stderr: "pipe",
    }).exited;

  if (secDirCheck === 0) {
    try {
      const glob = new Glob(`*${today}*`);
      for await (const _entry of glob.scan({ cwd: securityDir })) {
        return true;
      }
    } catch {
      // ignore glob errors
    }
  }

  // Check 2: Session log contains security review evidence
  const sessionsDir = join(projectDir, ".agents", "sessions");
  const sessDirCheck =
    await Bun.spawn(["test", "-d", sessionsDir], {
      stdout: "pipe",
      stderr: "pipe",
    }).exited;

  if (sessDirCheck === 0) {
    try {
      const glob = new Glob(`${today}-session-*.json`);
      const logPaths: Array<{ path: string; mtime: number }> = [];
      for await (const entry of glob.scan({ cwd: sessionsDir })) {
        const fullPath = join(sessionsDir, entry);
        logPaths.push({
          path: fullPath,
          mtime: Bun.file(fullPath).lastModified,
        });
      }
      logPaths.sort((a, b) => b.mtime - a.mtime);

      for (const logEntry of logPaths) {
        const content = await Bun.file(logEntry.path).text();
        for (const pattern of SECURITY_REVIEW_PATTERNS) {
          if (pattern.test(content)) {
            return true;
          }
        }
      }
    } catch {
      // ignore errors
    }
  }

  return false;
}

async function main(): Promise<number> {
  try {
    const inputJson = await Bun.stdin.text();
    if (!inputJson.trim()) {
      return 0;
    }

    const hookInput = JSON.parse(inputJson);

    const toolInput = hookInput?.tool_input;
    if (typeof toolInput !== "object" || toolInput === null) {
      return 0;
    }

    const filePath: string = toolInput.file_path ?? "";
    if (!filePath) {
      return 0;
    }

    if (!isAuthPath(filePath)) {
      return 0;
    }

    const projectDir = await getProjectDirectory();

    if (await findSecurityEvidence(projectDir)) {
      return 0;
    }

    // Auth file edit without security review: block
    console.log(
      BLOCK_TEMPLATE.replaceAll("{file_path}", filePath),
    );
    console.error(
      `Blocked: Auth file edit without security review: ${filePath}`,
    );
    return 2;
  } catch (exc) {
    // Fail-open on infrastructure errors
    const excType =
      exc instanceof Error ? exc.constructor.name : typeof exc;
    console.error(`Security gate error: ${excType} - ${exc}`);
    return 0;
  }
}

process.exit(await main());
