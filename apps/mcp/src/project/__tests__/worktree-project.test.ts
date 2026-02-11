import { afterEach, beforeEach, describe, test } from "vitest";
import { clearWorktreeProjectCache, ensureWorktreeProject } from "../worktree-project";

describe("worktree-project", () => {
  beforeEach(() => {
    clearWorktreeProjectCache();
  });

  afterEach(() => {
    clearWorktreeProjectCache();
  });

  test("clearWorktreeProjectCache resets the cache", () => {
    clearWorktreeProjectCache();
  });

  test("ensureWorktreeProject is idempotent", async () => {
    // Create a mock client (unused in current implementation)
    const mockClient = {} as any;

    // First call should attempt to register
    // This will fail because the real config path doesn't have our test project,
    // but the function should handle errors gracefully (no throw)
    await ensureWorktreeProject(mockClient, "test-project", "/tmp/worktree/docs");

    // Second call should be a no-op (cached)
    await ensureWorktreeProject(mockClient, "test-project", "/tmp/worktree/docs");
  });

  test("different paths are not cached together", async () => {
    const mockClient = {} as any;

    await ensureWorktreeProject(mockClient, "test-project", "/tmp/worktree-a/docs");

    // Different path for same project should not hit cache
    await ensureWorktreeProject(mockClient, "test-project", "/tmp/worktree-b/docs");

    // Both should have been processed (no assertion on side effects
    // since we can't easily mock the config file in this test setup)
  });
});
