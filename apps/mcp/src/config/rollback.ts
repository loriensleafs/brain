/**
 * Config Rollback Manager
 *
 * Manages configuration snapshots and rollback operations to recover from:
 * - Migration failures
 * - Invalid manual edits
 * - Indexing verification failures
 * - Partial file writes
 *
 * Snapshot strategy:
 * - lastKnownGood: Baseline config from MCP server startup (always valid)
 * - rollbackHistory: Array of snapshots (max 10, FIFO eviction)
 *
 * @see ADR-020 for rollback requirements
 * @see TASK-020-24 for acceptance criteria
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { getBrainConfigDir, loadBrainConfig, saveBrainConfig } from "./brain-config";
import type { BrainConfig } from "./schema";
import { validateBrainConfig } from "./schema";
import { syncConfigToBasicMemory } from "./translation-layer";

/**
 * Maximum number of snapshots to retain in history.
 * Oldest snapshots are evicted when this limit is exceeded.
 */
const MAX_ROLLBACK_HISTORY = 10;

/**
 * Subdirectory within Brain config dir for rollback files.
 */
const ROLLBACK_DIR_NAME = "rollback";

/**
 * Filename for the last known good config snapshot.
 */
const LAST_KNOWN_GOOD_FILE = "last-known-good.json";

/**
 * Filename for the rollback history index.
 */
const HISTORY_INDEX_FILE = "history.json";

/**
 * File mode for snapshot files (owner read/write only).
 */
const FILE_MODE = 0o600;

/**
 * Directory mode for rollback directory (owner read/write/execute only).
 */
const DIR_MODE = 0o700;

/**
 * Snapshot of a Brain configuration with metadata.
 */
export interface RollbackSnapshot {
  /** Unique identifier for this snapshot */
  id: string;

  /** Timestamp when snapshot was created */
  createdAt: Date;

  /** Reason for creating this snapshot */
  reason: string;

  /** SHA-256 checksum of the config JSON */
  checksum: string;

  /** The configuration data */
  config: BrainConfig;
}

/**
 * Result of a rollback operation.
 */
export interface RollbackResult {
  /** Whether the rollback succeeded */
  success: boolean;

  /** Error message if rollback failed */
  error?: string;

  /** The config that was restored (if successful) */
  restoredConfig?: BrainConfig;

  /** The snapshot that was used for rollback */
  snapshot?: RollbackSnapshot;
}

/**
 * Rollback history index stored on disk.
 */
interface HistoryIndex {
  /** List of snapshot IDs in chronological order (oldest first) */
  snapshotIds: string[];

  /** Timestamp of last update */
  updatedAt: string;
}

/**
 * Configuration rollback manager.
 *
 * Provides snapshot creation, rollback operations, and crash recovery
 * for Brain configuration files.
 *
 * @example
 * ```typescript
 * const manager = new ConfigRollbackManager();
 *
 * // Initialize on MCP server startup
 * await manager.initialize();
 *
 * // Create snapshot before risky operation
 * manager.snapshot(currentConfig, "Before migration");
 *
 * // If operation fails, rollback
 * const result = await manager.rollback("lastKnownGood");
 * if (result.success) {
 *   console.log("Restored to:", result.restoredConfig);
 * }
 * ```
 */
export class ConfigRollbackManager {
  private lastKnownGood: RollbackSnapshot | null = null;
  private rollbackHistory: RollbackSnapshot[] = [];
  private rollbackDir: string;
  private initialized = false;

  constructor() {
    this.rollbackDir = path.join(getBrainConfigDir(), ROLLBACK_DIR_NAME);
  }

  /**
   * Initialize the rollback manager.
   *
   * Must be called on MCP server startup. Loads existing snapshots
   * and establishes the current config as lastKnownGood if valid.
   *
   * @returns true if initialization succeeded
   */
  async initialize(): Promise<boolean> {
    try {
      // Ensure rollback directory exists
      this.ensureRollbackDir();

      // Load existing lastKnownGood if available
      await this.loadLastKnownGood();

      // Load rollback history
      await this.loadHistory();

      // If no lastKnownGood exists, create one from current config
      if (this.lastKnownGood === null) {
        try {
          const currentConfig = await loadBrainConfig();
          await this.markAsGood(currentConfig, "Initial baseline on startup");
        } catch {
          // Config doesn't exist or is invalid - that's OK for first run
        }
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error("[RollbackManager] Initialization failed:", error);
      return false;
    }
  }

  /**
   * Check if the manager has been initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Create a snapshot of the given configuration.
   *
   * Snapshots are added to the rollback history and can be restored
   * using rollback("previous").
   *
   * @param config - Configuration to snapshot
   * @param reason - Human-readable reason for the snapshot
   * @returns The created snapshot
   */
  snapshot(config: BrainConfig, reason: string): RollbackSnapshot {
    const snapshot = this.createSnapshot(config, reason);

    // Add to history (most recent last)
    this.rollbackHistory.push(snapshot);

    // Enforce FIFO eviction if over limit
    while (this.rollbackHistory.length > MAX_ROLLBACK_HISTORY) {
      const evicted = this.rollbackHistory.shift();
      if (evicted) {
        this.deleteSnapshotFile(evicted.id);
      }
    }

    // Persist snapshot and history
    this.saveSnapshotFile(snapshot);
    this.saveHistory();

    return snapshot;
  }

  /**
   * Mark a configuration as "last known good".
   *
   * Call this after successful operations (migration completion,
   * successful validation, etc.) to update the baseline.
   *
   * @param config - Configuration to mark as good
   * @param reason - Reason for the update (for audit trail)
   */
  async markAsGood(config: BrainConfig, reason: string): Promise<void> {
    // Validate config before marking as good
    const validation = validateBrainConfig(config);
    if (!validation.success) {
      const errorMsg = validation.errors?.map((e) => e.message).join("; ") || "Validation failed";
      throw new Error(`Cannot mark invalid config as good: ${errorMsg}`);
    }

    // Create and save the lastKnownGood snapshot
    this.lastKnownGood = this.createSnapshot(config, reason);
    this.saveLastKnownGood();
  }

  /**
   * Rollback to a previous configuration state.
   *
   * @param target - Which config to restore:
   *   - "lastKnownGood": The baseline from startup or last markAsGood()
   *   - "previous": The most recent snapshot in rollback history
   * @returns RollbackResult indicating success/failure
   */
  async rollback(target: "lastKnownGood" | "previous"): Promise<RollbackResult> {
    let snapshot: RollbackSnapshot | null = null;

    if (target === "lastKnownGood") {
      snapshot = this.lastKnownGood;
      if (!snapshot) {
        return {
          success: false,
          error: "No lastKnownGood snapshot available",
        };
      }
    } else if (target === "previous") {
      if (this.rollbackHistory.length === 0) {
        return {
          success: false,
          error: "No snapshots in rollback history",
        };
      }
      // Get most recent snapshot
      snapshot = this.rollbackHistory[this.rollbackHistory.length - 1];
    }

    if (!snapshot) {
      return {
        success: false,
        error: `Invalid rollback target: ${target}`,
      };
    }

    try {
      // Verify checksum before restoring
      const expectedChecksum = snapshot.checksum;
      const actualChecksum = this.computeChecksum(snapshot.config);
      if (expectedChecksum !== actualChecksum) {
        return {
          success: false,
          error: "Snapshot checksum mismatch - data may be corrupted",
        };
      }

      // Restore the config
      await saveBrainConfig(snapshot.config);

      // Sync to basic-memory
      await syncConfigToBasicMemory(snapshot.config);

      return {
        success: true,
        restoredConfig: snapshot.config,
        snapshot,
      };
    } catch (error) {
      return {
        success: false,
        error: `Rollback failed: ${error instanceof Error ? error.message : "unknown error"}`,
      };
    }
  }

  /**
   * Revert to the last known good configuration.
   *
   * Convenience method that calls rollback("lastKnownGood").
   *
   * @returns RollbackResult indicating success/failure
   */
  async revert(): Promise<RollbackResult> {
    return this.rollback("lastKnownGood");
  }

  /**
   * Get the last known good configuration.
   *
   * @returns The lastKnownGood snapshot, or null if not set
   */
  getLastKnownGood(): RollbackSnapshot | null {
    return this.lastKnownGood;
  }

  /**
   * Get the rollback history.
   *
   * @returns Array of snapshots in chronological order (oldest first)
   */
  getHistory(): readonly RollbackSnapshot[] {
    return this.rollbackHistory;
  }

  /**
   * Get the most recent snapshot from history.
   *
   * @returns The most recent snapshot, or null if history is empty
   */
  getLastSnapshot(): RollbackSnapshot | null {
    if (this.rollbackHistory.length === 0) {
      return null;
    }
    return this.rollbackHistory[this.rollbackHistory.length - 1];
  }

  /**
   * Clear the rollback history.
   *
   * Does NOT clear lastKnownGood. Use with caution.
   */
  clearHistory(): void {
    for (const snapshot of this.rollbackHistory) {
      this.deleteSnapshotFile(snapshot.id);
    }
    this.rollbackHistory = [];
    this.saveHistory();
  }

  /**
   * Check if a config matches the lastKnownGood.
   *
   * @param config - Configuration to check
   * @returns true if checksums match
   */
  matchesLastKnownGood(config: BrainConfig): boolean {
    if (!this.lastKnownGood) {
      return false;
    }
    const checksum = this.computeChecksum(config);
    return checksum === this.lastKnownGood.checksum;
  }

  // --- Private methods ---

  /**
   * Create a snapshot object with metadata.
   */
  private createSnapshot(config: BrainConfig, reason: string): RollbackSnapshot {
    return {
      id: this.generateSnapshotId(),
      createdAt: new Date(),
      reason,
      checksum: this.computeChecksum(config),
      config: structuredClone(config), // Deep copy to prevent mutation
    };
  }

  /**
   * Generate a unique snapshot ID.
   */
  private generateSnapshotId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString("hex");
    return `snap-${timestamp}-${random}`;
  }

  /**
   * Compute SHA-256 checksum of a config.
   *
   * Uses a stable JSON serialization (sorted keys at all levels)
   * to ensure identical configs produce identical checksums.
   */
  private computeChecksum(config: BrainConfig): string {
    const json = JSON.stringify(config, this.sortedReplacer);
    return crypto.createHash("sha256").update(json).digest("hex");
  }

  /**
   * JSON replacer function that sorts object keys for stable serialization.
   */
  private sortedReplacer(_key: string, value: unknown): unknown {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      // Sort keys and create a new object with sorted order
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(value as Record<string, unknown>).sort()) {
        sorted[k] = (value as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return value;
  }

  /**
   * Ensure the rollback directory exists.
   */
  private ensureRollbackDir(): void {
    if (!fs.existsSync(this.rollbackDir)) {
      fs.mkdirSync(this.rollbackDir, { recursive: true, mode: DIR_MODE });
    }
  }

  /**
   * Load the lastKnownGood snapshot from disk.
   */
  private async loadLastKnownGood(): Promise<void> {
    const filePath = path.join(this.rollbackDir, LAST_KNOWN_GOOD_FILE);

    if (!fs.existsSync(filePath)) {
      this.lastKnownGood = null;
      return;
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);

      // Validate the loaded config
      const validation = validateBrainConfig(data.config);
      if (!validation.success) {
        console.warn("[RollbackManager] lastKnownGood config is invalid, discarding");
        this.lastKnownGood = null;
        return;
      }

      // Reconstruct snapshot with proper Date object
      this.lastKnownGood = {
        id: data.id,
        createdAt: new Date(data.createdAt),
        reason: data.reason,
        checksum: data.checksum,
        config: data.config,
      };

      // Verify checksum
      const actualChecksum = this.computeChecksum(this.lastKnownGood.config);
      if (actualChecksum !== this.lastKnownGood.checksum) {
        console.warn("[RollbackManager] lastKnownGood checksum mismatch, discarding");
        this.lastKnownGood = null;
      }
    } catch (error) {
      console.warn("[RollbackManager] Failed to load lastKnownGood:", error);
      this.lastKnownGood = null;
    }
  }

  /**
   * Save the lastKnownGood snapshot to disk.
   */
  private saveLastKnownGood(): void {
    if (!this.lastKnownGood) {
      return;
    }

    const filePath = path.join(this.rollbackDir, LAST_KNOWN_GOOD_FILE);
    const content = JSON.stringify(
      {
        id: this.lastKnownGood.id,
        createdAt: this.lastKnownGood.createdAt.toISOString(),
        reason: this.lastKnownGood.reason,
        checksum: this.lastKnownGood.checksum,
        config: this.lastKnownGood.config,
      },
      null,
      2,
    );

    fs.writeFileSync(filePath, content, { encoding: "utf-8", mode: FILE_MODE });
  }

  /**
   * Load rollback history from disk.
   */
  private async loadHistory(): Promise<void> {
    const indexPath = path.join(this.rollbackDir, HISTORY_INDEX_FILE);

    if (!fs.existsSync(indexPath)) {
      this.rollbackHistory = [];
      return;
    }

    try {
      const content = fs.readFileSync(indexPath, "utf-8");
      const index: HistoryIndex = JSON.parse(content);

      // Load each snapshot
      this.rollbackHistory = [];
      for (const id of index.snapshotIds) {
        const snapshot = this.loadSnapshotFile(id);
        if (snapshot) {
          this.rollbackHistory.push(snapshot);
        }
      }
    } catch (error) {
      console.warn("[RollbackManager] Failed to load history:", error);
      this.rollbackHistory = [];
    }
  }

  /**
   * Save rollback history index to disk.
   */
  private saveHistory(): void {
    const indexPath = path.join(this.rollbackDir, HISTORY_INDEX_FILE);
    const index: HistoryIndex = {
      snapshotIds: this.rollbackHistory.map((s) => s.id),
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), {
      encoding: "utf-8",
      mode: FILE_MODE,
    });
  }

  /**
   * Get the file path for a snapshot.
   */
  private getSnapshotPath(id: string): string {
    return path.join(this.rollbackDir, `${id}.json`);
  }

  /**
   * Load a snapshot from disk by ID.
   */
  private loadSnapshotFile(id: string): RollbackSnapshot | null {
    const filePath = this.getSnapshotPath(id);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);

      // Validate config
      const validation = validateBrainConfig(data.config);
      if (!validation.success) {
        return null;
      }

      const snapshot: RollbackSnapshot = {
        id: data.id,
        createdAt: new Date(data.createdAt),
        reason: data.reason,
        checksum: data.checksum,
        config: data.config,
      };

      // Verify checksum
      const actualChecksum = this.computeChecksum(snapshot.config);
      if (actualChecksum !== snapshot.checksum) {
        console.warn(`[RollbackManager] Snapshot ${id} checksum mismatch, skipping`);
        return null;
      }

      return snapshot;
    } catch {
      return null;
    }
  }

  /**
   * Save a snapshot to disk.
   */
  private saveSnapshotFile(snapshot: RollbackSnapshot): void {
    const filePath = this.getSnapshotPath(snapshot.id);
    const content = JSON.stringify(
      {
        id: snapshot.id,
        createdAt: snapshot.createdAt.toISOString(),
        reason: snapshot.reason,
        checksum: snapshot.checksum,
        config: snapshot.config,
      },
      null,
      2,
    );

    fs.writeFileSync(filePath, content, { encoding: "utf-8", mode: FILE_MODE });
  }

  /**
   * Delete a snapshot file from disk.
   */
  private deleteSnapshotFile(id: string): void {
    const filePath = this.getSnapshotPath(id);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore deletion errors
    }
  }
}

/**
 * Singleton instance for application-wide use.
 *
 * Initialize during MCP server startup:
 * ```typescript
 * import { rollbackManager } from "./config/rollback";
 * await rollbackManager.initialize();
 * ```
 */
export const rollbackManager = new ConfigRollbackManager();
