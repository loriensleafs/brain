/**
 * Unit tests for hierarchical locking module.
 *
 * Tests TASK-020-25 requirements:
 * - Two-level lock hierarchy (global > project)
 * - acquireGlobalLock(): For multi-project operations (60s timeout)
 * - acquireProjectLock(): For single-project operations (30s timeout)
 * - Deadlock prevention (sorted alphabetical acquisition)
 * - Global lock blocks all project locks
 * - Project locks don't block each other
 * - Lock timeout handling
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import * as os from "os";
import * as path from "path";

// Mock filesystem
const mockFs = {
  existsSync: mock(() => false) as ReturnType<typeof mock<(p: string) => boolean>>,
  mkdirSync: mock(() => undefined) as ReturnType<
    typeof mock<(p: string, opts: unknown) => void>
  >,
  openSync: mock(() => 3) as ReturnType<typeof mock<(p: string, flags: number, mode?: number) => number>>,
  writeSync: mock(() => undefined) as ReturnType<typeof mock<(fd: number, content: string) => void>>,
  closeSync: mock(() => undefined) as ReturnType<typeof mock<(fd: number) => void>>,
  unlinkSync: mock(() => undefined) as ReturnType<typeof mock<(p: string) => void>>,
  statSync: mock(() => ({ mtimeMs: Date.now() })) as ReturnType<
    typeof mock<(p: string) => { mtimeMs: number }>
  >,
  readdirSync: mock(() => [] as string[]) as ReturnType<typeof mock<(p: string) => string[]>>,
  constants: {
    O_CREAT: 0x0200,
    O_EXCL: 0x0800,
    O_WRONLY: 0x0001,
  },
};

mock.module("fs", () => mockFs);

// Mock logger
const mockLogger = {
  debug: mock(() => undefined),
  info: mock(() => undefined),
  warn: mock(() => undefined),
  error: mock(() => undefined),
};

mock.module("../../utils/internal/logger", () => ({
  logger: mockLogger,
}));

import {
  LockManager,
  getLockManager,
  acquireGlobalLock,
  releaseGlobalLock,
  acquireProjectLock,
  releaseProjectLock,
  withGlobalLock,
  withProjectLock,
  withProjectLocks,
  LockResult,
} from "../lock";

describe("LockManager", () => {
  let lockManager: LockManager;

  beforeEach(() => {
    // Reset all mocks
    mockFs.existsSync.mockReset();
    mockFs.mkdirSync.mockReset();
    mockFs.openSync.mockReset();
    mockFs.writeSync.mockReset();
    mockFs.closeSync.mockReset();
    mockFs.unlinkSync.mockReset();
    mockFs.statSync.mockReset();

    // Default mock implementations
    mockFs.existsSync.mockReturnValue(false);
    mockFs.openSync.mockReturnValue(3);
    mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() });

    // Create fresh lock manager for each test
    lockManager = new LockManager();
  });

  afterEach(() => {
    // Clean up any held locks
    lockManager.releaseAllLocks();
  });

  describe("acquireGlobalLock", () => {
    test("successfully acquires global lock when not held", async () => {
      const result = await lockManager.acquireGlobalLock();

      expect(result.acquired).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockFs.openSync).toHaveBeenCalled();
    });

    test("fails with timeout when lock is held by another process", async () => {
      // Simulate lock file exists (held by another process)
      mockFs.existsSync.mockReturnValue(true);
      mockFs.openSync.mockImplementation(() => {
        const error = new Error("Lock exists") as NodeJS.ErrnoException;
        error.code = "EEXIST";
        throw error;
      });
      mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() }); // Not stale

      const result = await lockManager.acquireGlobalLock({ timeoutMs: 200 });

      expect(result.acquired).toBe(false);
      expect(result.error).toContain("timed out");
    });

    test("removes stale lock and acquires", async () => {
      // First call: lock file exists and is stale, then removed successfully
      let existsCallCount = 0;
      mockFs.existsSync.mockImplementation(() => {
        existsCallCount++;
        // First two calls: lock exists (check + stale removal check)
        // After removal: lock doesn't exist
        return existsCallCount <= 2;
      });
      mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() - 150000 }); // 150s old = stale
      mockFs.unlinkSync.mockReturnValue(undefined);

      const result = await lockManager.acquireGlobalLock();

      expect(result.acquired).toBe(true);
      // Stale lock should have been removed
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    test("tracks global lock state correctly", async () => {
      expect(lockManager.isGlobalLocked()).toBe(false);

      await lockManager.acquireGlobalLock();

      expect(lockManager.isGlobalLocked()).toBe(true);

      lockManager.releaseGlobalLock();

      expect(lockManager.isGlobalLocked()).toBe(false);
    });
  });

  describe("releaseGlobalLock", () => {
    test("releases held global lock", async () => {
      await lockManager.acquireGlobalLock();
      expect(lockManager.isGlobalLocked()).toBe(true);

      mockFs.existsSync.mockReturnValue(true);
      lockManager.releaseGlobalLock();

      expect(lockManager.isGlobalLocked()).toBe(false);
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    test("does nothing when no lock is held", () => {
      lockManager.releaseGlobalLock();

      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe("acquireProjectLock", () => {
    test("successfully acquires project lock when not held", async () => {
      const result = await lockManager.acquireProjectLock("test-project");

      expect(result.acquired).toBe(true);
      expect(result.error).toBeUndefined();
      expect(lockManager.isProjectLocked("test-project")).toBe(true);
    });

    test("blocks when global lock is held by another process", async () => {
      // Simulate global lock held by another process
      let callCount = 0;
      mockFs.existsSync.mockImplementation((p: unknown) => {
        const pathStr = String(p);
        if (pathStr.includes("global.lock")) {
          return true; // Global lock exists
        }
        return callCount++ < 3; // Project lock check
      });
      mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() }); // Not stale
      mockFs.openSync.mockImplementation(() => {
        const error = new Error("Lock exists") as NodeJS.ErrnoException;
        error.code = "EEXIST";
        throw error;
      });

      const result = await lockManager.acquireProjectLock("test", { timeoutMs: 200 });

      expect(result.acquired).toBe(false);
      expect(result.error).toContain("timed out");
    });

    test("succeeds when global lock is held by same process", async () => {
      // First acquire global lock
      await lockManager.acquireGlobalLock();

      // Reset mock for project lock acquisition
      mockFs.openSync.mockReturnValue(4);

      // Should be able to acquire project lock
      const result = await lockManager.acquireProjectLock("test-project");

      expect(result.acquired).toBe(true);
    });

    test("project locks don't block each other", async () => {
      const result1 = await lockManager.acquireProjectLock("project-a");
      expect(result1.acquired).toBe(true);

      // Reset mock for second lock
      mockFs.openSync.mockReturnValue(5);
      mockFs.existsSync.mockImplementation((p: unknown) => {
        const pathStr = String(p);
        // Project-a lock exists, but we're acquiring project-b
        return pathStr.includes("project-a");
      });

      const result2 = await lockManager.acquireProjectLock("project-b");
      expect(result2.acquired).toBe(true);

      expect(lockManager.isProjectLocked("project-a")).toBe(true);
      expect(lockManager.isProjectLocked("project-b")).toBe(true);
    });

    test("sanitizes project name to prevent path traversal", async () => {
      await lockManager.acquireProjectLock("../../../etc/passwd");

      // Should have created a safe lock file name
      const openCalls = mockFs.openSync.mock.calls;
      const lockPath = String(openCalls[0][0]);

      // The path should not contain ".." or "/" traversal sequences
      expect(lockPath).not.toContain("../");
      expect(lockPath).not.toContain("..\\");
      // The actual dangerous paths should be sanitized
      expect(lockPath).not.toContain("/etc/");
      expect(lockPath).toContain("project-");
      // Sanitization replaces non-alphanumeric chars with underscore
      expect(lockPath).toContain("_");
    });
  });

  describe("releaseProjectLock", () => {
    test("releases held project lock", async () => {
      await lockManager.acquireProjectLock("test-project");
      expect(lockManager.isProjectLocked("test-project")).toBe(true);

      mockFs.existsSync.mockReturnValue(true);
      lockManager.releaseProjectLock("test-project");

      expect(lockManager.isProjectLocked("test-project")).toBe(false);
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    test("does nothing when project lock is not held", () => {
      lockManager.releaseProjectLock("nonexistent");

      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe("acquireProjectLocks", () => {
    test("acquires multiple locks in sorted order", async () => {
      const acquiredOrder: string[] = [];
      mockFs.openSync.mockImplementation((p: unknown) => {
        const pathStr = String(p);
        const match = pathStr.match(/project-([a-z]+)\./);
        if (match) {
          acquiredOrder.push(match[1]);
        }
        return 3;
      });

      const result = await lockManager.acquireProjectLocks(["charlie", "alpha", "bravo"]);

      expect(result.acquired).toBe(true);
      expect(acquiredOrder).toEqual(["alpha", "bravo", "charlie"]);
    });

    test("rolls back on failure", async () => {
      let callCount = 0;
      mockFs.openSync.mockImplementation(() => {
        callCount++;
        if (callCount > 2) {
          // Fail on third lock
          const error = new Error("Lock held") as NodeJS.ErrnoException;
          error.code = "EEXIST";
          throw error;
        }
        return callCount + 2;
      });
      // Return true only for lock files that exist (for release)
      mockFs.existsSync.mockImplementation((p: unknown) => {
        const pathStr = String(p);
        // Return true for locks directory check and existing lock files
        return pathStr.includes("locks") || pathStr.includes(".lock");
      });

      const result = await lockManager.acquireProjectLocks(
        ["alpha", "bravo", "charlie"],
        { timeoutMs: 200 }
      );

      expect(result.acquired).toBe(false);
      // Previously acquired locks should be released - the manager tracks which locks it holds
      // and releases them on rollback
      expect(lockManager.getHeldProjectLocks().length).toBe(0);
    });
  });

  describe("releaseAllLocks", () => {
    test("releases all held locks", async () => {
      await lockManager.acquireGlobalLock();
      mockFs.openSync.mockReturnValue(4);
      await lockManager.acquireProjectLock("project-a");
      mockFs.openSync.mockReturnValue(5);
      await lockManager.acquireProjectLock("project-b");

      expect(lockManager.isGlobalLocked()).toBe(true);
      expect(lockManager.isProjectLocked("project-a")).toBe(true);
      expect(lockManager.isProjectLocked("project-b")).toBe(true);

      mockFs.existsSync.mockReturnValue(true);
      lockManager.releaseAllLocks();

      expect(lockManager.isGlobalLocked()).toBe(false);
      expect(lockManager.isProjectLocked("project-a")).toBe(false);
      expect(lockManager.isProjectLocked("project-b")).toBe(false);
    });
  });

  describe("getHeldProjectLocks", () => {
    test("returns array of held project locks", async () => {
      await lockManager.acquireProjectLock("alpha");
      mockFs.openSync.mockReturnValue(4);
      await lockManager.acquireProjectLock("bravo");

      const held = lockManager.getHeldProjectLocks();

      expect(held).toContain("alpha");
      expect(held).toContain("bravo");
      expect(held.length).toBe(2);
    });

    test("returns empty array when no locks held", () => {
      const held = lockManager.getHeldProjectLocks();

      expect(held).toEqual([]);
    });
  });

  describe("isGlobalLockHeld", () => {
    test("returns true when global lock file exists and is fresh", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() });

      expect(lockManager.isGlobalLockHeld()).toBe(true);
    });

    test("returns false when global lock file does not exist", () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(lockManager.isGlobalLockHeld()).toBe(false);
    });

    test("returns false when global lock is stale", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() - 150000 }); // Stale

      expect(lockManager.isGlobalLockHeld()).toBe(false);
    });
  });

  describe("isProjectLockHeld", () => {
    test("returns true when project lock file exists and is fresh", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() });

      expect(lockManager.isProjectLockHeld("test")).toBe(true);
    });

    test("returns false when project lock file does not exist", () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(lockManager.isProjectLockHeld("test")).toBe(false);
    });
  });
});

describe("Convenience Functions", () => {
  beforeEach(() => {
    mockFs.existsSync.mockReset();
    mockFs.mkdirSync.mockReset();
    mockFs.openSync.mockReset();
    mockFs.writeSync.mockReset();
    mockFs.closeSync.mockReset();
    mockFs.unlinkSync.mockReset();
    mockFs.statSync.mockReset();

    mockFs.existsSync.mockReturnValue(false);
    mockFs.openSync.mockReturnValue(3);
    mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() });
  });

  afterEach(() => {
    releaseGlobalLock();
  });

  describe("acquireGlobalLock / releaseGlobalLock", () => {
    test("uses default lock manager", async () => {
      const result = await acquireGlobalLock();

      expect(result.acquired).toBe(true);

      mockFs.existsSync.mockReturnValue(true);
      releaseGlobalLock();
    });
  });

  describe("acquireProjectLock / releaseProjectLock", () => {
    test("uses default lock manager", async () => {
      const result = await acquireProjectLock("test-project");

      expect(result.acquired).toBe(true);

      mockFs.existsSync.mockReturnValue(true);
      releaseProjectLock("test-project");
    });
  });

  describe("withGlobalLock", () => {
    test("executes operation with lock held", async () => {
      let lockHeldDuringOperation = false;

      const result = await withGlobalLock(async () => {
        lockHeldDuringOperation = getLockManager().isGlobalLocked();
        return "success";
      });

      expect(result).toBe("success");
      expect(lockHeldDuringOperation).toBe(true);
      expect(getLockManager().isGlobalLocked()).toBe(false); // Released after
    });

    test("releases lock on error", async () => {
      try {
        await withGlobalLock(async () => {
          throw new Error("Operation failed");
        });
      } catch {
        // Expected
      }

      expect(getLockManager().isGlobalLocked()).toBe(false);
    });

    test("throws when lock cannot be acquired", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() }); // Not stale
      mockFs.openSync.mockImplementation(() => {
        const error = new Error("Lock exists") as NodeJS.ErrnoException;
        error.code = "EEXIST";
        throw error;
      });

      await expect(
        withGlobalLock(async () => "success", { timeoutMs: 100 })
      ).rejects.toThrow("timed out");
    });
  });

  describe("withProjectLock", () => {
    test("executes operation with lock held", async () => {
      let lockHeldDuringOperation = false;

      const result = await withProjectLock("test", async () => {
        lockHeldDuringOperation = getLockManager().isProjectLocked("test");
        return "success";
      });

      expect(result).toBe("success");
      expect(lockHeldDuringOperation).toBe(true);
      expect(getLockManager().isProjectLocked("test")).toBe(false);
    });

    test("releases lock on error", async () => {
      try {
        await withProjectLock("test", async () => {
          throw new Error("Operation failed");
        });
      } catch {
        // Expected
      }

      expect(getLockManager().isProjectLocked("test")).toBe(false);
    });
  });

  describe("withProjectLocks", () => {
    test("acquires multiple locks in order", async () => {
      const result = await withProjectLocks(["charlie", "alpha", "bravo"], async () => {
        const manager = getLockManager();
        return {
          alpha: manager.isProjectLocked("alpha"),
          bravo: manager.isProjectLocked("bravo"),
          charlie: manager.isProjectLocked("charlie"),
        };
      });

      expect(result.alpha).toBe(true);
      expect(result.bravo).toBe(true);
      expect(result.charlie).toBe(true);
    });

    test("releases all locks on error", async () => {
      try {
        await withProjectLocks(["alpha", "bravo"], async () => {
          throw new Error("Operation failed");
        });
      } catch {
        // Expected
      }

      const manager = getLockManager();
      expect(manager.isProjectLocked("alpha")).toBe(false);
      expect(manager.isProjectLocked("bravo")).toBe(false);
    });
  });
});

describe("getLockManager", () => {
  test("returns singleton instance", () => {
    const manager1 = getLockManager();
    const manager2 = getLockManager();

    expect(manager1).toBe(manager2);
  });
});
