#!/usr/bin/env bun
/**
 * Detect ADR file changes and prompt Claude to invoke adr-review skill.
 *
 * Claude Code hook that checks for ADR file changes at session start.
 * When changes are detected, outputs a blocking gate message that prompts
 * Claude to invoke the adr-review skill for multi-agent consensus.
 *
 * Hook Type: SessionStart
 * Exit Codes:
 *   0 = Success, stdout added to Claude's context
 */

import { join, resolve } from "path";
import { skipIfConsumerRepo } from "../lib/guards.ts";

function getProjectRoot(): string | null {
  const scriptDir = resolve(import.meta.dir);
  const envDir = (process.env["CLAUDE_PROJECT_DIR"] ?? "").trim();

  if (envDir) {
    const resolvedScript = resolve(scriptDir);
    const resolvedRoot = resolve(envDir);
    // CWE-22 path traversal protection
    if (
      !resolvedScript.startsWith(resolvedRoot + "/") &&
      resolvedScript !== resolvedRoot
    ) {
      console.error(
        `Path traversal attempt detected via CLAUDE_PROJECT_DIR. ` +
          `Project: '${envDir}', Script: '${scriptDir}'`,
      );
      return null;
    }
    return envDir;
  }

  // Walk up: hooks/scripts -> hooks -> project root
  return resolve(scriptDir, "..", "..");
}

async function main(): Promise<number> {
  if (await skipIfConsumerRepo("adr-change-detection")) {
    return 0;
  }

  const projectRoot = getProjectRoot();
  if (projectRoot === null) {
    return 0; // Fail-open
  }

  // Validate the resolved path is a git repository
  const gitDir = Bun.file(join(projectRoot, ".git"));
  const gitDirCheck =
    await Bun.spawn(["test", "-e", join(projectRoot, ".git")], {
      stdout: "pipe",
      stderr: "pipe",
    }).exited;
  if (gitDirCheck !== 0) {
    console.error(
      `ADR detection: ProjectRoot '${projectRoot}' is not a git repository`,
    );
    return 0;
  }

  const detectScript = join(
    projectRoot,
    ".claude",
    "skills",
    "adr-review",
    "scripts",
    "detect_adr_changes.ts",
  );

  const detectFile = Bun.file(detectScript);
  if (!(await detectFile.exists())) {
    return 0;
  }

  try {
    const proc = Bun.spawn(
      ["bun", "run", detectScript, "--base-path", projectRoot, "--include-untracked"],
      {
        stdout: "pipe",
        stderr: "pipe",
        timeout: 10_000,
      },
    );

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderrText = await new Response(proc.stderr).text();
      console.error(
        `ADR detection script exited with code ${exitCode}`,
      );
      if (stderrText.trim()) {
        console.error(`Output: ${stderrText.trim()}`);
      }
      return 0; // Non-blocking
    }

    const stdoutText = await new Response(proc.stdout).text();
    const detection = JSON.parse(stdoutText);

    if (!detection.HasChanges) {
      return 0;
    }

    const lines: string[] = [
      "",
      "## ADR Changes Detected - Review Required",
      "",
      "**BLOCKING GATE**: ADR changes detected - invoke /adr-review before commit",
      "",
      "### Changes Found",
      "",
    ];

    const created: string[] = detection.Created ?? [];
    const modified: string[] = detection.Modified ?? [];
    const deleted: string[] = detection.Deleted ?? [];

    if (created.length > 0) {
      lines.push(`**Created**: ${created.join(", ")}`);
    }
    if (modified.length > 0) {
      lines.push(`**Modified**: ${modified.join(", ")}`);
    }
    if (deleted.length > 0) {
      lines.push(`**Deleted**: ${deleted.join(", ")}`);
    }

    lines.push(
      "",
      "### Required Action",
      "",
      "Invoke the adr-review skill for multi-agent consensus:",
      "",
      "```text",
      "/adr-review [ADR-path]",
      "```",
      "",
      "This ensures 6-agent debate (architect, critic, independent-thinker, " +
        "security, analyst, high-level-advisor) before ADR acceptance.",
      "",
      "**Skill**: `.claude/skills/adr-review/SKILL.md`",
      "",
    );

    console.log(lines.join("\n"));
    return 0;
  } catch (exc) {
    console.error(`ADR change detection failed: ${exc}`);
    console.error(
      "ADR detection skipped. Run detection manually if needed:",
    );
    console.error(`  bun run ${detectScript}`);
    return 0;
  }
}

process.exit(await main());
