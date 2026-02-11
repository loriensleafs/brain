import { execFile } from "node:child_process";
import { mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, normalize } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { detectWorktreeMainPath } from "../worktree-detector";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const mockedExecFile = vi.mocked(execFile);

describe("worktree-detector", () => {
  let testDir: string;

  beforeEach(async () => {
    const rawDir = join(
      tmpdir(),
      `brain-worktree-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(rawDir, { recursive: true });
    // Resolve symlinks (macOS /var -> /private/var) for consistent path comparison
    testDir = await realpath(rawDir);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Edge Case 1: Nested worktree paths", () => {
    it("resolves main repo from deep inside a worktree", async () => {
      // Set up a .git file in worktree root (linked worktrees use a .git file, not dir)
      const worktreeRoot = join(testDir, "worktree-checkout");
      const deepPath = join(worktreeRoot, "packages", "utils", "src");
      const mainRepo = join(testDir, "main-repo");
      const mainGitDir = join(mainRepo, ".git");

      const worktreeGitDir = join(mainGitDir, "worktrees", "feature-1");

      await mkdir(deepPath, { recursive: true });
      await mkdir(worktreeGitDir, { recursive: true });
      // .git file points to worktree gitdir
      await writeFile(join(worktreeRoot, ".git"), `gitdir: ${worktreeGitDir}`);

      // Mock git rev-parse to return linked worktree info
      mockedExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const cb = callback as (err: Error | null, stdout: string) => void;
        cb(null, `${mainGitDir}\n${worktreeGitDir}\nfalse\n`);
        return undefined as never;
      });

      const result = await detectWorktreeMainPath(deepPath);
      expect(result).not.toBeNull();
      expect(result!.isLinkedWorktree).toBe(true);
      expect(normalize(result!.mainWorktreePath)).toBe(normalize(mainRepo));
    });
  });

  describe("Edge Case 2: Main worktree user", () => {
    it("returns null for main worktree (not linked)", async () => {
      const mainRepo = join(testDir, "main-repo");
      const gitDir = join(mainRepo, ".git");
      await mkdir(gitDir, { recursive: true });

      // commonDir == gitDir for main worktree
      mockedExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const cb = callback as (err: Error | null, stdout: string) => void;
        cb(null, `${gitDir}\n${gitDir}\nfalse\n`);
        return undefined as never;
      });

      const result = await detectWorktreeMainPath(mainRepo);
      expect(result).toBeNull();
    });
  });

  describe("Edge Case 3: Git not installed", () => {
    it("returns null when git is not available (ENOENT)", async () => {
      const repoPath = join(testDir, "repo");
      await mkdir(join(repoPath, ".git"), { recursive: true });

      mockedExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const cb = callback as (err: Error | null, stdout: string) => void;
        const error = new Error("spawn git ENOENT") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        cb(error, "");
        return undefined as never;
      });

      const result = await detectWorktreeMainPath(repoPath);
      expect(result).toBeNull();
    });
  });

  describe("Edge Case 4: Git version too old", () => {
    it("returns null when --path-format=absolute is unrecognized", async () => {
      const repoPath = join(testDir, "repo");
      await mkdir(join(repoPath, ".git"), { recursive: true });

      mockedExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const cb = callback as (err: Error | null, stdout: string) => void;
        cb(new Error("unknown option: path-format"), "");
        return undefined as never;
      });

      const result = await detectWorktreeMainPath(repoPath);
      expect(result).toBeNull();
    });
  });

  describe("Edge Case 5: Network-mounted repository (timeout)", () => {
    it("returns null on subprocess timeout", async () => {
      const repoPath = join(testDir, "repo");
      await mkdir(join(repoPath, ".git"), { recursive: true });

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      mockedExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const cb = callback as (err: Error | null, stdout: string) => void;
        const error = new Error("timed out") as NodeJS.ErrnoException & {
          killed: boolean;
        };
        error.killed = true;
        cb(error, "");
        return undefined as never;
      });

      const result = await detectWorktreeMainPath(repoPath);
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("timed out"));

      warnSpy.mockRestore();
    });
  });

  describe("Edge Case 6: Bare repository", () => {
    it("returns null for bare repository", async () => {
      const repoPath = join(testDir, "repo");
      await mkdir(join(repoPath, ".git"), { recursive: true });

      mockedExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const cb = callback as (err: Error | null, stdout: string) => void;
        cb(null, `/some/bare/repo\n/some/bare/repo\ntrue\n`);
        return undefined as never;
      });

      const result = await detectWorktreeMainPath(repoPath);
      expect(result).toBeNull();
    });
  });

  describe("Edge Case 7: Broken worktree", () => {
    it("returns null when main repo path no longer exists", async () => {
      const worktreeRoot = join(testDir, "worktree");
      await mkdir(worktreeRoot, { recursive: true });
      // .git file pointing to a non-existent location
      await writeFile(
        join(worktreeRoot, ".git"),
        "gitdir: /old/deleted/path/.git/worktrees/feature-1",
      );

      mockedExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const cb = callback as (err: Error | null, stdout: string) => void;
        cb(new Error("fatal: not a git repository"), "");
        return undefined as never;
      });

      const result = await detectWorktreeMainPath(worktreeRoot);
      expect(result).toBeNull();
    });
  });

  describe("Edge Case 8: Symlinked paths", () => {
    it("resolves symlinks in path comparison", async () => {
      const mainRepo = join(testDir, "main-repo");
      const gitDir = join(mainRepo, ".git");
      const worktreeGitDir = join(gitDir, "worktrees", "feature-1");
      await mkdir(worktreeGitDir, { recursive: true });

      const worktreeRoot = join(testDir, "worktree");
      await mkdir(worktreeRoot, { recursive: true });
      await writeFile(join(worktreeRoot, ".git"), `gitdir: ${worktreeGitDir}`);

      // Simulate that commonDir and gitDir resolve to different real paths
      mockedExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const cb = callback as (err: Error | null, stdout: string) => void;
        cb(null, `${gitDir}\n${worktreeGitDir}\nfalse\n`);
        return undefined as never;
      });

      const result = await detectWorktreeMainPath(worktreeRoot);
      expect(result).not.toBeNull();
      expect(result!.isLinkedWorktree).toBe(true);
      expect(normalize(result!.mainWorktreePath)).toBe(normalize(mainRepo));
    });
  });

  describe("not a git repository", () => {
    it("returns null when no .git exists in path hierarchy", async () => {
      const nonGitPath = join(testDir, "not-a-repo", "some", "deep", "path");
      await mkdir(nonGitPath, { recursive: true });

      const result = await detectWorktreeMainPath(nonGitPath);
      expect(result).toBeNull();
      // execFile should never be called since pre-check fails
      expect(mockedExecFile).not.toHaveBeenCalled();
    });
  });

  describe("unexpected git output", () => {
    it("returns null when git output has wrong number of lines", async () => {
      const repoPath = join(testDir, "repo");
      await mkdir(join(repoPath, ".git"), { recursive: true });

      mockedExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const cb = callback as (err: Error | null, stdout: string) => void;
        // Only 1 line instead of 3
        cb(null, "/some/path\n");
        return undefined as never;
      });

      const result = await detectWorktreeMainPath(repoPath);
      expect(result).toBeNull();
    });
  });

  describe("subprocess arguments", () => {
    it("uses execFile with correct arguments and timeout", async () => {
      const repoPath = join(testDir, "repo");
      await mkdir(join(repoPath, ".git"), { recursive: true });

      mockedExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const cb = callback as (err: Error | null, stdout: string) => void;
        const gitDir = join(repoPath, ".git");
        cb(null, `${gitDir}\n${gitDir}\nfalse\n`);
        return undefined as never;
      });

      await detectWorktreeMainPath(repoPath);

      expect(mockedExecFile).toHaveBeenCalledWith(
        "git",
        [
          "rev-parse",
          "--path-format=absolute",
          "--git-common-dir",
          "--git-dir",
          "--is-bare-repository",
        ],
        expect.objectContaining({
          cwd: repoPath,
          timeout: 3000,
        }),
        expect.any(Function),
      );
    });
  });
});
