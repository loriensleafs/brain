/**
 * Configuration file locking for concurrent operation safety.
 *
 * Security controls:
 * - CWE-362: Race condition prevention via file-based locking
 * - CWE-367: Time-of-check Time-of-use (TOCTOU) mitigation
 *
 * Implements retry logic with timeout as required by critic review (Issue 1).
 *
 * @module utils/security/configLock
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { logger } from "../internal/logger";

/**
 * Lock file path for brain config operations
 */
const CONFIG_LOCK_PATH = path.join(
  os.homedir(),
  ".basic-memory",
  ".brain-config.lock",
);

/**
 * Default timeout for lock acquisition in milliseconds
 */
const DEFAULT_LOCK_TIMEOUT_MS = 5000;

/**
 * Retry interval for lock acquisition attempts
 */
const LOCK_RETRY_INTERVAL_MS = 100;

/**
 * Stale lock threshold - locks older than this are considered abandoned
 */
const STALE_LOCK_THRESHOLD_MS = 30000;

export interface LockResult {
  acquired: boolean;
  error?: string;
}

export interface ConfigLockOptions {
  /** Timeout in milliseconds for lock acquisition (default: 5000ms) */
  timeoutMs?: number;
}

/**
 * Check if an existing lock is stale (orphaned from crashed process).
 *
 * @param lockPath - Path to lock file
 * @returns true if lock exists and is stale
 */
function isLockStale(lockPath: string): boolean {
  try {
    const stats = fs.statSync(lockPath);
    const age = Date.now() - stats.mtimeMs;
    return age > STALE_LOCK_THRESHOLD_MS;
  } catch {
    return false;
  }
}

/**
 * Attempt to acquire the config lock once.
 * Uses O_CREAT | O_EXCL flags for atomic creation.
 *
 * @param lockPath - Path to lock file
 * @returns true if lock was acquired
 */
function tryAcquireLock(lockPath: string): boolean {
  try {
    // O_CREAT | O_EXCL ensures atomic creation - fails if file exists
    const fd = fs.openSync(
      lockPath,
      fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY,
    );

    // Write process info for debugging stale locks
    const lockInfo = JSON.stringify({
      pid: process.pid,
      timestamp: Date.now(),
      hostname: os.hostname(),
    });
    fs.writeSync(fd, lockInfo);
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
 * Acquire the config lock with retry logic.
 * Implements timeout-based acquisition per critic review (Issue 1).
 *
 * @param options - Lock options including timeout
 * @returns LockResult indicating success or failure
 */
export async function acquireConfigLock(
  options: ConfigLockOptions = {},
): Promise<LockResult> {
  const { timeoutMs = DEFAULT_LOCK_TIMEOUT_MS } = options;
  const startTime = Date.now();

  // Ensure lock directory exists
  const lockDir = path.dirname(CONFIG_LOCK_PATH);
  if (!fs.existsSync(lockDir)) {
    fs.mkdirSync(lockDir, { recursive: true });
  }

  while (true) {
    // Check timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= timeoutMs) {
      logger.warn({ timeoutMs, elapsed }, "Config lock acquisition timed out");
      return {
        acquired: false,
        error: `Lock acquisition timed out after ${timeoutMs}ms`,
      };
    }

    // Check for stale lock
    if (fs.existsSync(CONFIG_LOCK_PATH) && isLockStale(CONFIG_LOCK_PATH)) {
      logger.info({ lockPath: CONFIG_LOCK_PATH }, "Removing stale config lock");
      try {
        fs.unlinkSync(CONFIG_LOCK_PATH);
      } catch {
        // Ignore removal errors - another process may have grabbed it
      }
    }

    // Attempt to acquire
    try {
      if (tryAcquireLock(CONFIG_LOCK_PATH)) {
        logger.debug({ pid: process.pid }, "Config lock acquired");
        return { acquired: true };
      }
    } catch (error) {
      // Non-EEXIST errors are real failures
      return {
        acquired: false,
        error: `Lock acquisition failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    // Wait before retry
    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_INTERVAL_MS));
  }
}

/**
 * Release the config lock.
 *
 * @returns true if lock was released, false if lock wasn't held
 */
export function releaseConfigLock(): boolean {
  try {
    if (fs.existsSync(CONFIG_LOCK_PATH)) {
      fs.unlinkSync(CONFIG_LOCK_PATH);
      logger.debug({ pid: process.pid }, "Config lock released");
      return true;
    }
    return false;
  } catch (error) {
    logger.warn({ error }, "Failed to release config lock");
    return false;
  }
}

/**
 * Execute an operation while holding the config lock.
 * Ensures lock is always released even if operation throws.
 *
 * @param operation - Async function to execute while holding lock
 * @param options - Lock options
 * @returns Result of operation
 * @throws If lock cannot be acquired or operation throws
 */
export async function withConfigLock<T>(
  operation: () => Promise<T>,
  options: ConfigLockOptions = {},
): Promise<T> {
  const lockResult = await acquireConfigLock(options);

  if (!lockResult.acquired) {
    throw new Error(lockResult.error || "Failed to acquire config lock");
  }

  try {
    return await operation();
  } finally {
    releaseConfigLock();
  }
}

/**
 * Synchronous version of withConfigLock for simple operations.
 * Uses busy-wait for lock acquisition (not recommended for long waits).
 *
 * @param operation - Sync function to execute while holding lock
 * @param options - Lock options
 * @returns Result of operation
 * @throws If lock cannot be acquired or operation throws
 */
export function withConfigLockSync<T>(
  operation: () => T,
  options: ConfigLockOptions = {},
): T {
  const { timeoutMs = DEFAULT_LOCK_TIMEOUT_MS } = options;
  const startTime = Date.now();

  // Ensure lock directory exists
  const lockDir = path.dirname(CONFIG_LOCK_PATH);
  if (!fs.existsSync(lockDir)) {
    fs.mkdirSync(lockDir, { recursive: true });
  }

  // Busy-wait loop for lock acquisition
  while (true) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= timeoutMs) {
      throw new Error(`Lock acquisition timed out after ${timeoutMs}ms`);
    }

    // Check for stale lock
    if (fs.existsSync(CONFIG_LOCK_PATH) && isLockStale(CONFIG_LOCK_PATH)) {
      try {
        fs.unlinkSync(CONFIG_LOCK_PATH);
      } catch {
        // Ignore
      }
    }

    if (tryAcquireLock(CONFIG_LOCK_PATH)) {
      break;
    }

    // Brief sleep using sync approach
    const sleepUntil = Date.now() + LOCK_RETRY_INTERVAL_MS;
    while (Date.now() < sleepUntil) {
      // Busy wait
    }
  }

  try {
    return operation();
  } finally {
    releaseConfigLock();
  }
}
