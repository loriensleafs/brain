#!/usr/bin/env bun
/**
 * Investigate historical context of existing code or patterns.
 *
 * Performs git archaeology, PR/ADR search, and dependency analysis
 * to document why something exists before proposing changes.
 */

import { resolve, basename } from "path";
import { existsSync, readdirSync, readFileSync } from "fs";

interface InvestigationResult {
  target: string;
  proposedChange: string;
  originCommit: string;
  originDate: string;
  originAuthor: string;
  originMessage: string;
  relatedAdrs: string[];
  dependents: string[];
  warnings: string[];
}

function validatePathNoTraversal(targetPath: string): string {
  if (targetPath.includes("..")) {
    throw new Error(
      `Path traversal attempt detected: '${targetPath}' contains prohibited '..' sequence.`
    );
  }
  const resolvedPath = resolve(targetPath);
  if (!resolve(targetPath).startsWith(resolve("."))) {
    throw new Error(
      `Path traversal attempt detected: '${targetPath}' resolves outside the working directory.`
    );
  }
  return resolvedPath;
}

async function runGit(args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const text = await new Response(proc.stdout).text();
  await proc.exited;
  return text.trim();
}

async function findOriginCommit(
  target: string
): Promise<[string, string, string, string]> {
  if (existsSync(target)) {
    const logOutput = await runGit([
      "log",
      "--diff-filter=A",
      "--follow",
      "--format=%H%x00%aI%x00%an%x00%s",
      "--",
      target,
    ]);
    if (logOutput) {
      const lines = logOutput.split("\n");
      const lastLine = lines[lines.length - 1];
      const parts = lastLine.split("\x00", 4);
      if (parts.length === 4) {
        return [parts[0], parts[1], parts[2], parts[3]];
      }
    }
  }
  return ["", "", "", ""];
}

function findRelatedAdrs(target: string): string[] {
  const adrsDir = ".agents/architecture";
  if (!existsSync(adrsDir)) return [];

  const targetName = basename(target).replace(/\.[^/.]+$/, "");
  const related: string[] = [];

  const files = readdirSync(adrsDir)
    .filter((f) => f.startsWith("ADR-") && f.endsWith(".md"))
    .sort();

  for (const adrFile of files) {
    const content = readFileSync(`${adrsDir}/${adrFile}`, "utf-8");
    if (content.includes(targetName) || content.includes(target)) {
      const titleMatch = content.match(/^# (.+)$/m);
      const title = titleMatch ? titleMatch[1] : adrFile;
      related.push(`${adrFile}: ${title}`);
    }
  }

  return related;
}

async function findDependents(target: string): Promise<string[]> {
  const searchTerm = existsSync(target)
    ? basename(target).replace(/\.[^/.]+$/, "")
    : target;

  const proc = Bun.spawn(
    [
      "git",
      "grep",
      "-l",
      "-e",
      searchTerm,
      "--",
      "*.md",
      "*.ts",
      "*.py",
      "*.ps1",
      "*.yml",
      "*.yaml",
    ],
    { stdout: "pipe", stderr: "pipe" }
  );

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode === 0 && output.trim()) {
    return output
      .trim()
      .split("\n")
      .filter((f) => f !== target);
  }
  return [];
}

async function investigate(
  target: string,
  proposedChange: string
): Promise<InvestigationResult> {
  const result: InvestigationResult = {
    target,
    proposedChange,
    originCommit: "",
    originDate: "",
    originAuthor: "",
    originMessage: "",
    relatedAdrs: [],
    dependents: [],
    warnings: [],
  };

  const [commit, date, author, message] = await findOriginCommit(target);
  result.originCommit = commit;
  result.originDate = date;
  result.originAuthor = author;
  result.originMessage = message;

  if (!commit) {
    result.warnings.push(
      `Could not find origin commit for '${target}'. ` +
        "File may be untracked or the target may not be a file path."
    );
  }

  result.relatedAdrs = findRelatedAdrs(target);
  result.dependents = await findDependents(target);

  if (result.dependents.length > 0) {
    result.warnings.push(
      `Found ${result.dependents.length} files referencing this target. ` +
        "Changes may have cascading effects."
    );
  }

  return result;
}

function generateInlineReport(result: InvestigationResult): string {
  const lines = [
    `# Chesterton's Fence Investigation: ${result.target}`,
    "",
    "## Proposed Change",
    "",
    result.proposedChange,
    "",
    "## Git Archaeology",
    "",
  ];

  if (result.originCommit) {
    lines.push(
      `- **Origin commit**: ${result.originCommit}`,
      `- **Date**: ${result.originDate}`,
      `- **Author**: ${result.originAuthor}`,
      `- **Message**: ${result.originMessage}`
    );
  } else {
    lines.push("- No origin commit found.");
  }

  lines.push("", "## Related ADRs", "");
  if (result.relatedAdrs.length > 0) {
    for (const adr of result.relatedAdrs) lines.push(`- ${adr}`);
  } else {
    lines.push("- None found.");
  }

  lines.push("", "## Dependents", "");
  if (result.dependents.length > 0) {
    for (const dep of result.dependents) lines.push(`- ${dep}`);
  } else {
    lines.push("- None found.");
  }

  if (result.warnings.length > 0) {
    lines.push("", "## Warnings", "");
    for (const warning of result.warnings) lines.push(`- ${warning}`);
  }

  return lines.join("\n") + "\n";
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  let target = "";
  let change = "";
  let format = "text";

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--target":
        target = argv[++i] ?? "";
        break;
      case "--change":
        change = argv[++i] ?? "";
        break;
      case "--format":
        format = argv[++i] ?? "text";
        break;
      case "--help":
      case "-h":
        console.log(
          "Usage: bun run investigate.ts --target <path> --change <description> [--format text|json]"
        );
        return 0;
    }
  }

  if (!target || !change) {
    console.error("ERROR: --target and --change are required");
    return 1;
  }

  try {
    validatePathNoTraversal(target);
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    return 1;
  }

  const result = await investigate(target, change);

  if (format === "json") {
    const output = {
      target: result.target,
      proposed_change: result.proposedChange,
      origin: {
        commit: result.originCommit,
        date: result.originDate,
        author: result.originAuthor,
        message: result.originMessage,
      },
      related_adrs: result.relatedAdrs,
      dependents: result.dependents,
      warnings: result.warnings,
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(generateInlineReport(result));
  }

  return 0;
}

process.exit(await main());
