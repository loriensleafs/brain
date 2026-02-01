/**
 * Hierarchical Locking for Configuration and Migration Operations
 *
 * Implements two-level lock hierarchy:
 * - Global lock: Required for multi-project migrations, config schema changes
 * - Project lock: Required for single-project migrations
 *
 * Rules:
 * - Global lock blocks all project locks
 * - Project locks don't block each other
 * - Deadlock prevention via sorted alphabetical acquisition
 *
 * Security controls:
 * - CWE-362: Race condition prevention via file-based locking
 * - CWE-367: TOCTOU mitigation via atomic operations
 *
 * @see ADR-020 for the configuration architecture decision
 * @see TASK-020-25 for implementation requirements
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { logger } from "../utils/internal/logger";

/**
 * Lock file directory for Brain operations.
 */
const LOCK_DIR = path.join(os.homedir(), ".config", "brain", "locks");

/**
 * Global lock file name.
 */
const GLOBAL_LOCK_FILE = "global.lock";

/**
 * Project lock file prefix.
 */
const PROJECT_LOCK_PREFIX = "project-";

/**
 * Lock file suffix.
 */
const LOCK_SUFFIX = ".lock";

/**
 * Default timeout for global lock acquisition in milliseconds.
 */
const DEFAULT_GLOBAL_LOCK_TIMEOUT_MS = 60000;

/**
 * Default timeout for project lock acquisition in milliseconds.
 */
const DEFAULT_PROJECT_LOCK_TIMEOUT_MS = 30000;

/**
 * Retry interval for lock acquisition attempts.
 */
const LOCK_RETRY_INTERVAL_MS = 100;

/**
 * Stale lock threshold - locks older than this are considered abandoned.
 */
const STALE_LOCK_THRESHOLD_MS = 120000;

/**
 * Result of a lock acquisition attempt.
 */
export interface LockResult {
  /** Whether the lock was successfully acquired. */
  acquired: boolean;
  /** Error message if acquisition failed. */
  error?: string;
}

/**
 * Options for lock operations.
 */
export interface LockOptions {
  /** Timeout in milliseconds for lock acquisition. */
  timeoutMs?: number;
}

/**
 * Lock information stored in lock files for debugging.
 */
interface LockInfo {
  pid: number;
  timestamp: number;
  hostname: string;
  lockType: "global" | "project";
  project?: string;
}

/**
 * LockManager provides hierarchical locking for configuration and migration operations.
 *
 * Usage:
 * ```typescript
 * const lockManager = new LockManager();
 *
 * // For multi-project operations
 * const result = await lockManager.acquireGlobalLock();
 * if (result.acquired) {
 *   try {
 *     // perform operation
 *   } finally {
 *     lockManager.releaseGlobalLock();
 *   }
 * }
 *
 * // For single-project operations
 * const result = await lockManager.acquireProjectLock("brain");
 * if (result.acquired) {
 *   try {
 *     // perform operation
 *   } finally {
 *     lockManager.releaseProjectLock("brain");
 *   }
 * }
 * ```
 */
export class LockManager {
  private globalLockHeld = false;
  private projectLocksHeld: Set<string> = new Set();

  /**
   * Ensure the lock directory exists.
   */
  private ensureLockDir(): void {
    if (!fs.existsSync(LOCK_DIR)) {
      fs.mkdirSync(LOCK_DIR, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Get the path to the global lock file.
   */
  private getGlobalLockPath(): string {
    return path.join(LOCK_DIR, GLOBAL_LOCK_FILE);
  }

  /**
   * Get the path to a project lock file.
   *
   * @param project - Project name
   * @returns Path to project lock file
   */
  private getProjectLockPath(project: string): string {
    // Sanitize project name to prevent path traversal
    const sanitized = project.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(
      LOCK_DIR,
      `${PROJECT_LOCK_PREFIX}${sanitized}${LOCK_SUFFIX}`,
    );
  }

  /**
   * Check if an existing lock is stale (orphaned from crashed process).
   *
   * @param lockPath - Path to lock file
   * @returns true if lock exists and is stale
   */
  private isLockStale(lockPath: string): boolean {
    try {
      const stats = fs.statSync(lockPath);
      const age = Date.now() - stats.mtimeMs;
      return age > STALE_LOCK_THRESHOLD_MS;
    } catch {
      return false;
    }
  }

  /**
   * Attempt to acquire a lock once using atomic file creation.
   *
   * @param lockPath - Path to lock file
   * @param lockType - Type of lock being acquired
   * @param project - Project name (for project locks only)
   * @returns true if lock was acquired
   */
  private tryAcquireLock(
    lockPath: string,
    lockType: "global" | "project",
    project?: string,
  ): boolean {
    try {
      // O_CREAT | O_EXCL ensures atomic creation - fails if file exists
      const fd = fs.openSync(
        lockPath,
        fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY,
        0o600,
      );

      // Write lock info for debugging stale locks
      const lockInfo: LockInfo = {
        pid: process.pid,
        timestamp: Date.now(),
        hostname: os.hostname(),
        lockType,
        ...(project && { project }),
      };
      fs.writeSync(fd, JSON.stringify(lockInfo, null, 2));
      fs.closeSync(fd);

      return true;
    } catch (error) {
      // EEXIST means lock already held
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        return false;
      }
      // Other errors (permissions, etc.) should be thrown
      throw error;
    }
  }

  /**
   * Release a lock by removing the lock file.
   *
   * @param lockPath - Path to lock file
   * @returns true if lock was released
   */
  private releaseLock(lockPath: string): boolean {
    try {
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
        return true;
      }
      return false;
    } catch (error) {
      logger.warn({ error, lockPath }, "Failed to release lock");
      return false;
    }
  }

  /**
   * Remove stale lock if present.
   *
   * @param lockPath - Path to lock file
   */
  private removeStaleIfPresent(lockPath: string): void {
    if (fs.existsSync(lockPath) && this.isLockStale(lockPath)) {
      logger.info({ lockPath }, "Removing stale lock");
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // Ignore removal errors - another process may have grabbed it
      }
    }
  }

  /**
   * Acquire the global lock for multi-project operations.
   *
   * Global lock blocks all project lock acquisitions.
   * Timeout defaults to 60 seconds.
   *
   * @param options - Lock options
   * @returns LockResult indicating success or failure
   */
  async acquireGlobalLock(options: LockOptions = {}): Promise<LockResult> {
    const { timeoutMs = DEFAULT_GLOBAL_LOCK_TIMEOUT_MS } = options;
    const startTime = Date.now();
    const lockPath = this.getGlobalLockPath();

    this.ensureLockDir();

    while (true) {
      // Check timeout
      const elapsed = Date.now() - startTime;
      if (elapsed >= timeoutMs) {
        logger.warn(
          { timeoutMs, elapsed },
          "Global lock acquisition timed out",
        );
        return {
          acquired: false,
          error: `Global lock acquisition timed out after ${timeoutMs}ms`,
        };
      }

      // Check for and remove stale lock
      this.removeStaleIfPresent(lockPath);

      // Attempt to acquire
      try {
        if (this.tryAcquireLock(lockPath, "global")) {
          this.globalLockHeld = true;
          logger.debug({ pid: process.pid }, "Global lock acquired");
          return { acquired: true };
        }
      } catch (error) {
        return {
          acquired: false,
          error: `Global lock acquisition failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }

      // Wait before retry
      await new Promise((resolve) =>
        setTimeout(resolve, LOCK_RETRY_INTERVAL_MS),
      );
    }
  }

  /**
   * Release the global lock.
   */
  releaseGlobalLock(): void {
    if (!this.globalLockHeld) {
      return;
    }

    const lockPath = this.getGlobalLockPath();
    this.releaseLock(lockPath);
    this.globalLockHeld = false;
    logger.debug({ pid: process.pid }, "Global lock released");
  }

  /**
   * Acquire a project lock for single-project operations.
   *
   * Project lock will fail if global lock is held by another process.
   * Project locks don't block each other.
   * Timeout defaults to 30 seconds.
   *
   * @param project - Project name
   * @param options - Lock options
   * @returns LockResult indicating success or failure
   */
  async acquireProjectLock(
    project: string,
    options: LockOptions = {},
  ): Promise<LockResult> {
    const { timeoutMs = DEFAULT_PROJECT_LOCK_TIMEOUT_MS } = options;
    const startTime = Date.now();
    const projectLockPath = this.getProjectLockPath(project);
    const globalLockPath = this.getGlobalLockPath();

    this.ensureLockDir();

    while (true) {
      // Check timeout
      const elapsed = Date.now() - startTime;
      if (elapsed >= timeoutMs) {
        logger.warn(
          { project, timeoutMs, elapsed },
          "Project lock acquisition timed out",
        );
        return {
          acquired: false,
          error: `Project lock acquisition for '${project}' timed out after ${timeoutMs}ms`,
        };
      }

      // Check if global lock is held (by another process)
      if (fs.existsSync(globalLockPath) && !this.globalLockHeld) {
        // Check if global lock is stale
        if (this.isLockStale(globalLockPath)) {
          this.removeStaleIfPresent(globalLockPath);
        } else {
          // Wait for global lock to be released
          await new Promise((resolve) =>
            setTimeout(resolve, LOCK_RETRY_INTERVAL_MS),
          );
          continue;
        }
      }

      // Check for and remove stale project lock
      this.removeStaleIfPresent(projectLockPath);

      // Attempt to acquire
      try {
        if (this.tryAcquireLock(projectLockPath, "project", project)) {
          this.projectLocksHeld.add(project);
          logger.debug({ pid: process.pid, project }, "Project lock acquired");
          return { acquired: true };
        }
      } catch (error) {
        return {
          acquired: false,
          error: `Project lock acquisition failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }

      // Wait before retry
      await new Promise((resolve) =>
        setTimeout(resolve, LOCK_RETRY_INTERVAL_MS),
      );
    }
  }

  /**
   * Release a project lock.
   *
   * @param project - Project name
   */
  releaseProjectLock(project: string): void {
    if (!this.projectLocksHeld.has(project)) {
      return;
    }

    const lockPath = this.getProjectLockPath(project);
    this.releaseLock(lockPath);
    this.projectLocksHeld.delete(project);
    logger.debug({ pid: process.pid, project }, "Project lock released");
  }

  /**
   * Acquire multiple project locks in sorted order to prevent deadlocks.
   *
   * Projects are sorted alphabetically and locks are acquired in order.
   * If any lock fails, previously acquired locks are released.
   *
   * @param projects - Array of project names
   * @param options - Lock options (timeout applies to each lock individually)
   * @returns LockResult indicating success or failure
   */
  async acquireProjectLocks(
    projects: string[],
    options: LockOptions = {},
  ): Promise<LockResult> {
    // Sort alphabetically for deadlock prevention
    const sortedProjects = [...projects].sort();
    const acquiredProjects: string[] = [];

    for (const project of sortedProjects) {
      const result = await this.acquireProjectLock(project, options);
      if (!result.acquired) {
        // Rollback previously acquired locks
        for (const acquired of acquiredProjects) {
          this.releaseProjectLock(acquired);
        }
        return {
          acquired: false,
          error:
            result.error || `Failed to acquire lock for project '${project}'`,
        };
      }
      acquiredProjects.push(project);
    }

    return { acquired: true };
  }

  /**
   * Release multiple project locks.
   *
   * @param projects - Array of project names
   */
  releaseProjectLocks(projects: string[]): void {
    for (const project of projects) {
      this.releaseProjectLock(project);
    }
  }

  /**
   * Check if the global lock is held by this process.
   *
   * @returns true if global lock is held
   */
  isGlobalLocked(): boolean {
    return this.globalLockHeld;
  }

  /**
   * Check if a project lock is held by this process.
   *
   * @param project - Project name
   * @returns true if project lock is held
   */
  isProjectLocked(project: string): boolean {
    return this.projectLocksHeld.has(project);
  }

  /**
   * Check if any global lock exists (by any process).
   *
   * @returns true if global lock file exists
   */
  isGlobalLockHeld(): boolean {
    const lockPath = this.getGlobalLockPath();
    return fs.existsSync(lockPath) && !this.isLockStale(lockPath);
  }

  /**
   * Check if a project lock exists (by any process).
   *
   * @param project - Project name
   * @returns true if project lock file exists
   */
  isProjectLockHeld(project: string): boolean {
    const lockPath = this.getProjectLockPath(project);
    return fs.existsSync(lockPath) && !this.isLockStale(lockPath);
  }

  /**
   * Get all currently held project locks by this process.
   *
   * @returns Array of project names with held locks
   */
  getHeldProjectLocks(): string[] {
    return Array.from(this.projectLocksHeld);
  }

  /**
   * Release all locks held by this process.
   * Call this on cleanup/shutdown.
   */
  releaseAllLocks(): void {
    // Release project locks first
    const projects = Array.from(this.projectLocksHeld);
    for (const project of projects) {
      const lockPath = this.getProjectLockPath(project);
      this.releaseLock(lockPath);
    }
    this.projectLocksHeld.clear();

    // Release global lock
    if (this.globalLockHeld) {
      const lockPath = this.getGlobalLockPath();
      this.releaseLock(lockPath);
      this.globalLockHeld = false;
    }

    logger.debug({ pid: process.pid }, "All locks released");
  }
}

/**
 * Singleton instance of LockManager for convenience.
 */
let defaultLockManager: LockManager | null = null;

/**
 * Get the default LockManager instance.
 *
 * @returns Default LockManager instance
 */
export function getLockManager(): LockManager {
  if (!defaultLockManager) {
    defaultLockManager = new LockManager();
  }
  return defaultLockManager;
}

/**
 * Convenience function to acquire global lock using default manager.
 *
 * @param options - Lock options
 * @returns LockResult indicating success or failure
 */
export async function acquireGlobalLock(
  options: LockOptions = {},
): Promise<LockResult> {
  return getLockManager().acquireGlobalLock(options);
}

/**
 * Convenience function to release global lock using default manager.
 */
export function releaseGlobalLock(): void {
  getLockManager().releaseGlobalLock();
}

/**
 * Convenience function to acquire project lock using default manager.
 *
 * @param project - Project name
 * @param options - Lock options
 * @returns LockResult indicating success or failure
 */
export async function acquireProjectLock(
  project: string,
  options: LockOptions = {},
): Promise<LockResult> {
  return getLockManager().acquireProjectLock(project, options);
}

/**
 * Convenience function to release project lock using default manager.
 *
 * @param project - Project name
 */
export function releaseProjectLock(project: string): void {
  getLockManager().releaseProjectLock(project);
}

/**
 * Execute an operation while holding the global lock.
 * Ensures lock is always released even if operation throws.
 *
 * @param operation - Async function to execute while holding lock
 * @param options - Lock options
 * @returns Result of operation
 * @throws If lock cannot be acquired or operation throws
 */
export async function withGlobalLock<T>(
  operation: () => Promise<T>,
  options: LockOptions = {},
): Promise<T> {
  const manager = getLockManager();
  const lockResult = await manager.acquireGlobalLock(options);

  if (!lockResult.acquired) {
    throw new Error(lockResult.error || "Failed to acquire global lock");
  }

  try {
    return await operation();
  } finally {
    manager.releaseGlobalLock();
  }
}

/**
 * Execute an operation while holding a project lock.
 * Ensures lock is always released even if operation throws.
 *
 * @param project - Project name
 * @param operation - Async function to execute while holding lock
 * @param options - Lock options
 * @returns Result of operation
 * @throws If lock cannot be acquired or operation throws
 */
export async function withProjectLock<T>(
  project: string,
  operation: () => Promise<T>,
  options: LockOptions = {},
): Promise<T> {
  const manager = getLockManager();
  const lockResult = await manager.acquireProjectLock(project, options);

  if (!lockResult.acquired) {
    throw new Error(
      lockResult.error || `Failed to acquire project lock for '${project}'`,
    );
  }

  try {
    return await operation();
  } finally {
    manager.releaseProjectLock(project);
  }
}

/**
 * Execute an operation while holding multiple project locks.
 * Locks are acquired in sorted order to prevent deadlocks.
 * Ensures locks are always released even if operation throws.
 *
 * @param projects - Array of project names
 * @param operation - Async function to execute while holding locks
 * @param options - Lock options
 * @returns Result of operation
 * @throws If locks cannot be acquired or operation throws
 */
export async function withProjectLocks<T>(
  projects: string[],
  operation: () => Promise<T>,
  options: LockOptions = {},
): Promise<T> {
  const manager = getLockManager();
  const lockResult = await manager.acquireProjectLocks(projects, options);

  if (!lockResult.acquired) {
    throw new Error(lockResult.error || "Failed to acquire project locks");
  }

  try {
    return await operation();
  } finally {
    manager.releaseProjectLocks(projects);
  }
}

// Clean up locks on process exit
process.on("exit", () => {
  if (defaultLockManager) {
    defaultLockManager.releaseAllLocks();
  }
});

process.on("SIGINT", () => {
  if (defaultLockManager) {
    defaultLockManager.releaseAllLocks();
  }
  process.exit(130);
});

process.on("SIGTERM", () => {
  if (defaultLockManager) {
    defaultLockManager.releaseAllLocks();
  }
  process.exit(143);
});
