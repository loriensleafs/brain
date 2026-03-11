/**
 * Tests for detect_adr_changes.ts
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  main,
  getAdrStatus,
  getDependentAdrs,
  parseArgs,
} from "../scripts/detect_adr_changes.ts";

/** Create a minimal git repo in a temp directory and return its path. */
async function createGitRepo(): Promise<string> {
  const tmpDir = mkdtempSync(join(tmpdir(), "adr-test-"));

  const gitInit = Bun.spawn(["git", "init"], {
    cwd: tmpDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  await gitInit.exited;

  const gitEmail = Bun.spawn(
    ["git", "config", "user.email", "test@test.com"],
    { cwd: tmpDir, stdout: "pipe", stderr: "pipe" },
  );
  await gitEmail.exited;

  const gitName = Bun.spawn(["git", "config", "user.name", "Test"], {
    cwd: tmpDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  await gitName.exited;

  // Create initial commit
  writeFileSync(join(tmpDir, "README.md"), "init");
  const gitAdd = Bun.spawn(["git", "add", "."], {
    cwd: tmpDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  await gitAdd.exited;

  const gitCommit = Bun.spawn(["git", "commit", "-m", "init"], {
    cwd: tmpDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  await gitCommit.exited;

  return tmpDir;
}

/** Run git add + commit in a repo. */
async function gitAddAndCommit(
  repoPath: string,
  message: string,
): Promise<void> {
  const add = Bun.spawn(["git", "add", "."], {
    cwd: repoPath,
    stdout: "pipe",
    stderr: "pipe",
  });
  await add.exited;

  const commit = Bun.spawn(["git", "commit", "-m", message], {
    cwd: repoPath,
    stdout: "pipe",
    stderr: "pipe",
  });
  await commit.exited;
}

/**
 * Capture stdout from main() by temporarily replacing console.log.
 * Returns { exitCode, stdout, stderr }.
 */
async function captureMain(
  argv: string[],
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  const origLog = console.log;
  const origError = console.error;

  console.log = (...args: unknown[]) => {
    stdoutLines.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    stderrLines.push(args.map(String).join(" "));
  };

  try {
    const exitCode = await main(argv);
    return {
      exitCode,
      stdout: stdoutLines.join("\n"),
      stderr: stderrLines.join("\n"),
    };
  } finally {
    console.log = origLog;
    console.error = origError;
  }
}

describe("parseArgs", () => {
  test("returns defaults when no arguments provided", () => {
    const result = parseArgs([]);
    expect(result).not.toBeNull();
    expect(result!.basePath).toBe(".");
    expect(result!.sinceCommit).toBe("HEAD~1");
    expect(result!.includeUntracked).toBe(false);
  });

  test("parses custom arguments", () => {
    const result = parseArgs([
      "--base-path",
      "/tmp/repo",
      "--since-commit",
      "abc123",
      "--include-untracked",
    ]);
    expect(result).not.toBeNull();
    expect(result!.basePath).toBe("/tmp/repo");
    expect(result!.sinceCommit).toBe("abc123");
    expect(result!.includeUntracked).toBe(true);
  });

  test("returns null for --help", () => {
    // Capture console.log to suppress output
    const origLog = console.log;
    console.log = () => {};
    try {
      const result = parseArgs(["--help"]);
      expect(result).toBeNull();
    } finally {
      console.log = origLog;
    }
  });
});

describe("getAdrStatus", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "adr-status-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns unknown for missing file", () => {
    expect(getAdrStatus(join(tmpDir, "nonexistent.md"))).toBe("unknown");
  });

  test("extracts status from frontmatter", () => {
    const adrPath = join(tmpDir, "ADR-001.md");
    writeFileSync(adrPath, "---\nstatus: accepted\n---\n# Title\n");
    expect(getAdrStatus(adrPath)).toBe("accepted");
  });

  test("returns proposed when no status in content", () => {
    const adrPath = join(tmpDir, "ADR-001.md");
    writeFileSync(adrPath, "# ADR-001\nNo frontmatter here\n");
    expect(getAdrStatus(adrPath)).toBe("proposed");
  });
});

describe("getDependentAdrs", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "adr-deps-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("finds ADRs that reference a given ADR name", () => {
    const adrDir = join(tmpDir, "decisions");
    mkdirSync(adrDir, { recursive: true });
    writeFileSync(join(adrDir, "ADR-001-base.md"), "# Base ADR");
    writeFileSync(
      join(adrDir, "ADR-002-child.md"),
      "Supersedes ADR-001-base",
    );

    const result = getDependentAdrs("ADR-001-base", tmpDir);
    expect(result.length).toBe(1);
    expect(result[0]).toContain("ADR-002-child.md");
  });

  test("returns empty array when no dependents exist", () => {
    const adrDir = join(tmpDir, "decisions");
    mkdirSync(adrDir, { recursive: true });
    writeFileSync(join(adrDir, "ADR-001.md"), "# Standalone");

    const result = getDependentAdrs("ADR-999", tmpDir);
    expect(result).toEqual([]);
  });
});

describe("main", () => {
  let gitRepo: string;

  beforeEach(async () => {
    gitRepo = await createGitRepo();
  });

  afterEach(() => {
    rmSync(gitRepo, { recursive: true, force: true });
  });

  test("returns 1 for non-git directory", async () => {
    const nonGitDir = mkdtempSync(join(tmpdir(), "adr-nogit-"));
    try {
      const { exitCode, stderr } = await captureMain([
        "--base-path",
        nonGitDir,
      ]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Not a git repository");
    } finally {
      rmSync(nonGitDir, { recursive: true, force: true });
    }
  });

  test("detects no changes when comparing HEAD to itself", async () => {
    const adrDir = join(gitRepo, "decisions");
    mkdirSync(adrDir, { recursive: true });
    writeFileSync(join(adrDir, "ADR-001.md"), "# Test");
    await gitAddAndCommit(gitRepo, "add adr");

    const { exitCode, stdout } = await captureMain([
      "--base-path",
      gitRepo,
      "--since-commit",
      "HEAD",
    ]);
    expect(exitCode).toBe(0);
    const output = JSON.parse(stdout);
    expect(output.HasChanges).toBe(false);
  });

  test("detects created ADR files", async () => {
    const adrDir = join(gitRepo, "decisions");
    mkdirSync(adrDir, { recursive: true });
    writeFileSync(join(adrDir, "ADR-001.md"), "# New ADR");
    await gitAddAndCommit(gitRepo, "add adr");

    const { exitCode, stdout } = await captureMain([
      "--base-path",
      gitRepo,
      "--since-commit",
      "HEAD~1",
    ]);
    expect(exitCode).toBe(0);
    const output = JSON.parse(stdout);
    expect(output.HasChanges).toBe(true);
    expect(output.Created.length).toBe(1);
    expect(output.RecommendedAction).toBe("review");
  });

  test("includes untracked ADR files when flag is set", async () => {
    const adrDir = join(gitRepo, "decisions");
    mkdirSync(adrDir, { recursive: true });
    writeFileSync(join(adrDir, "ADR-099.md"), "# Untracked");

    const { exitCode, stdout } = await captureMain([
      "--base-path",
      gitRepo,
      "--since-commit",
      "HEAD",
      "--include-untracked",
    ]);
    expect(exitCode).toBe(0);
    const output = JSON.parse(stdout);
    expect(output.HasChanges).toBe(true);
    expect(output.Created.some((f: string) => f.includes("ADR-099"))).toBe(
      true,
    );
  });

  test("returns 0 with help flag", async () => {
    const origLog = console.log;
    console.log = () => {};
    try {
      const exitCode = await main(["--help"]);
      expect(exitCode).toBe(0);
    } finally {
      console.log = origLog;
    }
  });
});
