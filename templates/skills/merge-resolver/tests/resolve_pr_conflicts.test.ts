/**
 * Tests for resolve_pr_conflicts.ts
 *
 * Covers:
 * - Security validation (branch names and worktree paths)
 * - Auto-resolvable file classification
 * - GitHub runner detection
 * - Result structure
 */

import { describe, test, expect } from "bun:test";
import { tmpdir } from "os";
import { mkdtempSync } from "fs";
import { join } from "path";

import {
  AUTO_RESOLVABLE_PATTERNS,
  getSafeWorktreePath,
  isAutoResolvable,
  isGithubRunner,
  isSafeBranchName,
  resolvePrConflicts,
} from "../scripts/resolve_pr_conflicts";

// --- Security Validation - Branch Names ---

describe("isSafeBranchName", () => {
  test.each(["feature/my-branch", "fix/issue-123", "main", "release/v1.0.0"])(
    "accepts valid branch name: %s",
    (branch) => {
      expect(isSafeBranchName(branch)).toBe(true);
    },
  );

  test("rejects empty string", () => {
    expect(isSafeBranchName("")).toBe(false);
  });

  test("rejects whitespace only", () => {
    expect(isSafeBranchName("   ")).toBe(false);
  });

  test("rejects starts with hyphen", () => {
    expect(isSafeBranchName("--exec=malicious")).toBe(false);
  });

  test("rejects path traversal", () => {
    expect(isSafeBranchName("../../../etc/passwd")).toBe(false);
  });

  test("rejects control characters", () => {
    expect(isSafeBranchName("main\x00secret")).toBe(false);
  });

  test.each(["main~1", "main^1", "main:file"])(
    "rejects git special characters: %s",
    (branch) => {
      expect(isSafeBranchName(branch)).toBe(false);
    },
  );

  test("rejects semicolon command injection", () => {
    expect(isSafeBranchName("main;rm -rf /")).toBe(false);
  });

  test("rejects pipe command injection", () => {
    expect(isSafeBranchName("main|cat /etc/passwd")).toBe(false);
  });

  test("rejects backtick command substitution", () => {
    expect(isSafeBranchName("main`whoami`")).toBe(false);
  });

  test("rejects dollar sign", () => {
    expect(isSafeBranchName("main$HOME")).toBe(false);
  });

  test("rejects ampersand", () => {
    expect(isSafeBranchName("main&whoami")).toBe(false);
  });
});

// --- Security Validation - Worktree Path ---

describe("getSafeWorktreePath", () => {
  test("rejects negative PR number", () => {
    expect(() => getSafeWorktreePath("/tmp", -1)).toThrow("Invalid PR number");
  });

  test("rejects zero PR number", () => {
    expect(() => getSafeWorktreePath("/tmp", 0)).toThrow("Invalid PR number");
  });

  test("constructs valid path", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "merge-test-"));
    const result = getSafeWorktreePath(tmpDir, 123);
    expect(result).toContain("pr-123");
    expect(result).toContain(tmpDir);
  });

  test("rejects nonexistent base path", () => {
    expect(() => getSafeWorktreePath("/nonexistent/path", 1)).toThrow();
  });
});

// --- Auto-Resolvable Files ---

describe("isAutoResolvable", () => {
  test("HANDOFF.md is auto-resolvable", () => {
    expect(isAutoResolvable(".agents/HANDOFF.md")).toBe(true);
  });

  test("session files are auto-resolvable", () => {
    expect(isAutoResolvable(".agents/sessions/2026-01-01.json")).toBe(true);
  });

  test("lock files are auto-resolvable", () => {
    expect(isAutoResolvable("package-lock.json")).toBe(true);
    expect(isAutoResolvable("pnpm-lock.yaml")).toBe(true);
    expect(isAutoResolvable("bun.lock")).toBe(true);
    expect(isAutoResolvable("yarn.lock")).toBe(true);
  });

  test("source code is not auto-resolvable", () => {
    expect(isAutoResolvable("src/main.py")).toBe(false);
  });

  test("README is not auto-resolvable", () => {
    expect(isAutoResolvable("README.md")).toBe(false);
  });

  test("patterns list is nonempty", () => {
    expect(AUTO_RESOLVABLE_PATTERNS.length).toBeGreaterThan(0);
  });
});

// --- GitHub Runner Detection ---

describe("isGithubRunner", () => {
  test("detects local environment", () => {
    const original = process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_ACTIONS;
    expect(isGithubRunner()).toBe(false);
    if (original !== undefined) process.env.GITHUB_ACTIONS = original;
  });
});

// --- Result Structure ---

describe("resolvePrConflicts", () => {
  test("unsafe branch returns failure", () => {
    const result = resolvePrConflicts(1, "main;rm -rf /", "main");
    expect(result.success).toBe(false);
    expect(result.message).toContain("unsafe branch name");
    expect(result.files_resolved).toEqual([]);
    expect(result.files_blocked).toEqual([]);
  });

  test("unsafe target branch returns failure", () => {
    const result = resolvePrConflicts(1, "feature/ok", "main|hack");
    expect(result.success).toBe(false);
    expect(result.message).toContain("unsafe target branch");
  });
});
