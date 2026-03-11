/**
 * Git repository information helpers.
 *
 * Provides functions to extract git state for session initialization.
 * Retrieves repository root, current branch, commit SHA, and working tree status.
 */

import { ApplicationFailedError } from "./common_types.ts";

export interface GitInfo {
  repo_root: string;
  branch: string;
  commit: string;
  status: "clean" | "dirty";
}

async function runGit(...args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const detail = (stderr || stdout).trim();
    throw new Error(
      `Git command 'git ${args.join(" ")}' failed (exit ${exitCode}): ${detail}`
    );
  }

  return stdout.trim();
}

export async function getGitInfo(): Promise<GitInfo> {
  try {
    const repoRoot = (await runGit("rev-parse", "--show-toplevel")) || "";

    let branch = "";
    try {
      branch = await runGit("branch", "--show-current");
    } catch {
      branch = "";
    }

    const commit = await runGit("rev-parse", "--short", "HEAD");

    const statusOutput = await runGit("status", "--short");
    const gitStatus: "clean" | "dirty" = statusOutput ? "dirty" : "clean";

    return { repo_root: repoRoot, branch, commit, status: gitStatus };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Git command")) {
      throw e;
    }
    throw new ApplicationFailedError(
      `UNEXPECTED ERROR in getGitInfo\n` +
        `Exception Type: ${(e as Error).constructor.name}\n` +
        `Message: ${e}\n\n` +
        `This is a bug. Please report this error with the above details.`
    );
  }
}
