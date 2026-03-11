#!/usr/bin/env bun
/**
 * Resolve merge conflicts for a PR branch with auto-resolution support.
 *
 * Features:
 * - Security validation for branch names and paths
 * - Auto-resolves conflicts in HANDOFF.md and session files
 * - Handles both GitHub Actions runner and local worktree environments
 * - Pushes resolved branch on success
 *
 * Exit codes:
 *   0 - Success: No conflicts or conflicts auto-resolved
 *   1 - Error: Conflicts could not be auto-resolved
 */

import { parseArgs } from "util";
import { resolve } from "path";
import { existsSync } from "fs";
import { spawnSync, type SpawnSyncReturns } from "child_process";

// Files that can be auto-resolved by accepting target branch (main) version.
export const AUTO_RESOLVABLE_PATTERNS: string[] = [
  ".agents/HANDOFF.md",
  ".agents/sessions/*",
  ".agents/*",
  "package-lock.json",
  "pnpm-lock.yaml",
  "bun.lock",
  "yarn.lock",
  ".claude/skills/*",
  ".claude/skills/*/*",
  ".claude/skills/*/*/*",
  ".claude/commands/*",
  ".claude/agents/*",
  "templates/*",
  "templates/*/*",
  "templates/*/*/*",
  ".github/agents/*",
  ".github/prompts/*",
];

const CONTROL_CHARS_RE = /[\x00-\x1f\x7f]/;
const GIT_SPECIAL_RE = /[~^:?*[\]\\]/;
const SHELL_META_RE = /[`$;&|<>(){}]/;

export function isSafeBranchName(branchName: string): boolean {
  if (!branchName || branchName.trim().length === 0) return false;
  if (branchName.startsWith("-")) return false;
  if (branchName.includes("..")) return false;
  if (CONTROL_CHARS_RE.test(branchName)) return false;
  if (GIT_SPECIAL_RE.test(branchName)) return false;
  if (SHELL_META_RE.test(branchName)) return false;
  return true;
}

export function getSafeWorktreePath(basePath: string, prNumber: number): string {
  if (prNumber <= 0) throw new Error(`Invalid PR number: ${prNumber}`);
  const base = resolve(basePath);
  if (!existsSync(base)) throw new Error(`Base path does not exist: ${basePath}`);

  let repoName = "plugin";
  try {
    const info = getRepoInfo();
    repoName = info.repo;
  } catch {
    // Use default
  }

  const worktreeName = `${repoName}-pr-${prNumber}`;
  const worktreePath = resolve(base, worktreeName);

  if (!worktreePath.startsWith(base)) {
    throw new Error(`Worktree path escapes base directory: ${worktreePath}`);
  }
  return worktreePath;
}

interface RepoInfo {
  owner: string;
  repo: string;
}

function getRepoInfo(): RepoInfo {
  const result = runGit("remote", "get-url", "origin");
  if (result.status !== 0) throw new Error("Not in a git repository or no origin remote");
  const match = /github\.com[:/]([^/]+)\/([^/.]+)/.exec(result.stdout.trim());
  if (!match) throw new Error(`Could not parse GitHub repository from remote: ${result.stdout.trim()}`);
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

export function isGithubRunner(): boolean {
  return process.env.GITHUB_ACTIONS !== undefined;
}

export function isAutoResolvable(filePath: string): boolean {
  for (const pattern of AUTO_RESOLVABLE_PATTERNS) {
    if (filePath === pattern) return true;
    // Simple glob matching
    const regex = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*") + "$");
    if (regex.test(filePath)) return true;
  }
  return false;
}

function runGit(...args: string[]): SpawnSyncReturns<string>;
function runGit(args: string[], cwd?: string): SpawnSyncReturns<string>;
function runGit(...argsOrArray: unknown[]): SpawnSyncReturns<string> {
  let args: string[];
  let cwd: string | undefined;
  if (Array.isArray(argsOrArray[0])) {
    args = argsOrArray[0] as string[];
    cwd = argsOrArray[1] as string | undefined;
  } else {
    args = argsOrArray as string[];
  }
  return spawnSync("git", args, { encoding: "utf-8", cwd });
}

interface ConflictResult {
  success: boolean;
  message: string;
  files_resolved: string[];
  files_blocked: string[];
}

function resolveConflictsRunner(branchName: string, targetBranch: string, dryRun: boolean): ConflictResult {
  const result: ConflictResult = { success: false, message: "", files_resolved: [], files_blocked: [] };

  if (dryRun) {
    result.message = `[DryRun] Would resolve conflicts for branch ${branchName} in GitHub runner mode`;
    result.success = true;
    return result;
  }

  if (runGit("fetch", "origin", branchName).status !== 0) { result.message = `Failed to fetch branch ${branchName}`; return result; }
  if (runGit("fetch", "origin", targetBranch).status !== 0) { result.message = `Failed to fetch target branch ${targetBranch}`; return result; }
  if (runGit("checkout", branchName).status !== 0) { result.message = `Failed to checkout branch ${branchName}`; return result; }

  const mergeResult = runGit("merge", `origin/${targetBranch}`);
  if (mergeResult.status !== 0) {
    const conflicts = runGit("diff", "--name-only", "--diff-filter=U").stdout.trim().split("\n").filter(Boolean);
    let canAutoResolve = true;

    for (const file of conflicts) {
      if (isAutoResolvable(file)) {
        if (runGit("checkout", "--theirs", file).status !== 0) { result.message = `Failed to checkout --theirs for ${file}`; return result; }
        if (runGit("add", file).status !== 0) { result.message = `Failed to git add ${file}`; return result; }
        result.files_resolved.push(file);
      } else {
        canAutoResolve = false;
        result.files_blocked.push(file);
      }
    }

    if (!canAutoResolve) {
      runGit("merge", "--abort");
      result.message = `Conflicts in non-auto-resolvable files: ${result.files_blocked.join(", ")}`;
      return result;
    }

    if (runGit("diff", "--cached", "--quiet").status !== 0) {
      const msg = `Merge ${targetBranch} into ${branchName} - auto-resolve conflicts`;
      if (runGit("commit", "-m", msg).status !== 0) { result.message = "Failed to commit merge"; return result; }
    }
  }

  const pushResult = runGit("push", "origin", branchName);
  if (pushResult.status !== 0) { result.message = `Git push failed: ${pushResult.stderr}`; return result; }

  result.success = true;
  result.message = `Successfully resolved conflicts for branch ${branchName}`;
  return result;
}

function resolveConflictsWorktree(branchName: string, targetBranch: string, prNumber: number, worktreeBasePath: string, dryRun: boolean): ConflictResult {
  const result: ConflictResult = { success: false, message: "", files_resolved: [], files_blocked: [] };
  const repoRoot = runGit("rev-parse", "--show-toplevel").stdout.trim();

  let worktreePath: string;
  try {
    worktreePath = getSafeWorktreePath(worktreeBasePath, prNumber);
  } catch (e) {
    result.message = `Failed to get safe worktree path for PR #${prNumber}: ${e}`;
    return result;
  }

  if (dryRun) {
    result.message = `[DryRun] Would create worktree at ${worktreePath} and resolve conflicts for PR #${prNumber}`;
    result.success = true;
    return result;
  }

  try {
    if (runGit(["worktree", "add", worktreePath, branchName]).status !== 0) { result.message = `Failed to create worktree for ${branchName}`; return result; }
    if (runGit(["fetch", "origin", targetBranch], worktreePath).status !== 0) { result.message = `Failed to fetch target branch ${targetBranch}`; return result; }

    const mergeResult = runGit(["merge", `origin/${targetBranch}`], worktreePath);
    if (mergeResult.status !== 0) {
      const conflicts = runGit(["diff", "--name-only", "--diff-filter=U"], worktreePath).stdout.trim().split("\n").filter(Boolean);
      let canAutoResolve = true;

      for (const file of conflicts) {
        if (isAutoResolvable(file)) {
          if (runGit(["checkout", "--theirs", file], worktreePath).status !== 0) { result.message = `Failed to checkout --theirs for ${file}`; return result; }
          if (runGit(["add", file], worktreePath).status !== 0) { result.message = `Failed to git add ${file}`; return result; }
          result.files_resolved.push(file);
        } else {
          canAutoResolve = false;
          result.files_blocked.push(file);
        }
      }

      if (!canAutoResolve) {
        runGit(["merge", "--abort"], worktreePath);
        result.message = `Conflicts in non-auto-resolvable files: ${result.files_blocked.join(", ")}`;
        return result;
      }

      if (runGit(["diff", "--cached", "--quiet"], worktreePath).status !== 0) {
        const msg = `Merge ${targetBranch} into ${branchName} - auto-resolve conflicts`;
        if (runGit(["commit", "-m", msg], worktreePath).status !== 0) { result.message = "Failed to commit merge"; return result; }
      }
    }

    const pushResult = runGit(["push", "origin", branchName], worktreePath);
    if (pushResult.status !== 0) { result.message = `Git push failed: ${pushResult.stderr}`; return result; }

    result.success = true;
    result.message = `Successfully resolved conflicts for PR #${prNumber}`;
    return result;
  } catch (e) {
    result.message = `Failed to resolve conflicts for PR #${prNumber}: ${e}`;
    return result;
  } finally {
    if (existsSync(worktreePath)) {
      runGit(["-C", repoRoot, "worktree", "remove", worktreePath, "--force"]);
    }
  }
}

export function resolvePrConflicts(
  prNumber: number, branchName: string, targetBranch = "main",
  worktreeBasePath = "..", _owner = "", _repo = "", dryRun = false,
): ConflictResult {
  if (!isSafeBranchName(branchName)) {
    return { success: false, message: `Rejecting PR #${prNumber} due to unsafe branch name: ${branchName}`, files_resolved: [], files_blocked: [] };
  }
  if (!isSafeBranchName(targetBranch)) {
    return { success: false, message: `Rejecting PR #${prNumber} due to unsafe target branch: ${targetBranch}`, files_resolved: [], files_blocked: [] };
  }
  if (isGithubRunner()) return resolveConflictsRunner(branchName, targetBranch, dryRun);
  return resolveConflictsWorktree(branchName, targetBranch, prNumber, worktreeBasePath, dryRun);
}

export function buildParser(): ReturnType<typeof parseArgs> {
  return parseArgs({
    args: Bun.argv.slice(2),
    options: {
      owner: { type: "string", default: "" },
      repo: { type: "string", default: "" },
      "pr-number": { type: "string" },
      "branch-name": { type: "string" },
      "target-branch": { type: "string", default: "main" },
      "worktree-base-path": { type: "string", default: ".." },
      "dry-run": { type: "boolean", default: false },
    },
    strict: false,
  });
}

function main(): number {
  const { values } = buildParser();

  const prNumber = parseInt(values["pr-number"] as string, 10);
  const branchName = values["branch-name"] as string;

  if (isNaN(prNumber) || !branchName) {
    console.error("Required: --pr-number and --branch-name");
    return 1;
  }

  let owner = values.owner as string;
  let repo = values.repo as string;
  if (!owner || !repo) {
    try {
      const info = getRepoInfo();
      owner = owner || info.owner;
      repo = repo || info.repo;
    } catch (e) {
      console.log(JSON.stringify({ success: false, message: String(e) }));
      return 1;
    }
  }

  const result = resolvePrConflicts(
    prNumber, branchName,
    values["target-branch"] as string,
    values["worktree-base-path"] as string,
    owner, repo,
    values["dry-run"] as boolean,
  );

  console.log(JSON.stringify(result));
  return result.success ? 0 : 1;
}

// Only run main when executed directly
if (import.meta.main) {
  process.exit(main());
}
