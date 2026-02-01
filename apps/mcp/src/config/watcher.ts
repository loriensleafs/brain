/**
 * Config File Watcher
 *
 * Watches ~/.config/brain/config.json for manual edits and triggers
 * live reconfiguration. Uses chokidar for reliable cross-platform file watching
 * with debouncing to handle editor chunked writes.
 *
 * Behavior:
 * 1. Watch config file for changes
 * 2. Debounce events (2 seconds default) to avoid reacting to partial writes
 * 3. Validate new config via schema validator
 * 4. If valid: detect diff and trigger reconfiguration
 * 5. If invalid: log error and rollback to last known good
 *
 * @see ADR-020 for the config change protocol
 * @see TASK-020-22 for acceptance criteria
 */

import { watch, type FSWatcher } from "chokidar";
import type { BrainConfig } from "./schema";
import { validateBrainConfig, DEFAULT_BRAIN_CONFIG } from "./schema";
import {
  getBrainConfigPath,
  loadBrainConfig,
  loadBrainConfigSync,
} from "./brain-config";
import { detectConfigDiff, summarizeConfigDiff, type ConfigDiff } from "./diff";
import { rollbackManager, type RollbackResult } from "./rollback";
import { syncConfigToBasicMemory } from "./translation-layer";

/**
 * Default debounce delay in milliseconds.
 * Matches the watcher.debounce_ms in schema.ts default.
 */
const DEFAULT_DEBOUNCE_MS = 2000;

/**
 * awaitWriteFinish settings for chokidar.
 * Waits for file to stabilize before emitting change event.
 */
const AWAIT_WRITE_FINISH = {
  stabilityThreshold: 1000, // Wait 1s for file to stop changing
  pollInterval: 100, // Check every 100ms
};

/**
 * Event types emitted by the watcher.
 */
export type WatcherEventType =
  | "change"
  | "error"
  | "validation_error"
  | "rollback"
  | "reconfigure";

/**
 * Event payload for watcher callbacks.
 */
export interface WatcherEvent {
  type: WatcherEventType;
  timestamp: Date;
  message: string;
  config?: BrainConfig;
  diff?: ConfigDiff;
  error?: Error;
  rollbackResult?: RollbackResult;
}

/**
 * Callback function for watcher events.
 */
export type WatcherEventCallback = (event: WatcherEvent) => void;

/**
 * Options for configuring the watcher.
 */
export interface WatcherOptions {
  /** Debounce delay in milliseconds (default: 2000) */
  debounceMs?: number;

  /** Whether to automatically rollback on invalid config (default: true) */
  autoRollback?: boolean;

  /** Whether to sync to basic-memory on valid changes (default: true) */
  autoSync?: boolean;

  /** Event callback for watcher events */
  onEvent?: WatcherEventCallback;
}

/**
 * State of the config file watcher.
 */
export type WatcherState = "stopped" | "starting" | "running" | "error";

/**
 * Configuration file watcher that detects manual edits and triggers reconfiguration.
 *
 * @example
 * ```typescript
 * const watcher = new ConfigFileWatcher({
 *   debounceMs: 2000,
 *   autoRollback: true,
 *   onEvent: (event) => console.log(event.type, event.message)
 * });
 *
 * // Start watching on MCP server init
 * await watcher.start();
 *
 * // Stop when shutting down
 * watcher.stop();
 * ```
 */
export class ConfigFileWatcher {
  private watcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastConfig: BrainConfig | null = null;
  private state: WatcherState = "stopped";
  private migrationInProgress = false;
  private pendingChange = false;

  private readonly debounceMs: number;
  private readonly autoRollback: boolean;
  private readonly autoSync: boolean;
  private readonly onEvent: WatcherEventCallback | null;
  private readonly configPath: string;

  constructor(options: WatcherOptions = {}) {
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.autoRollback = options.autoRollback ?? true;
    this.autoSync = options.autoSync ?? true;
    this.onEvent = options.onEvent ?? null;
    this.configPath = getBrainConfigPath();
  }

  /**
   * Start watching the config file.
   *
   * Initializes the rollback manager and begins file watching.
   * Safe to call multiple times (no-op if already running).
   */
  async start(): Promise<void> {
    if (this.state === "running") {
      return; // Already running
    }

    this.state = "starting";

    try {
      // Initialize rollback manager if not already done
      if (!rollbackManager.isInitialized()) {
        await rollbackManager.initialize();
      }

      // Load current config as baseline
      try {
        this.lastConfig = await loadBrainConfig();
      } catch {
        // Use defaults if config doesn't exist or is invalid
        this.lastConfig = { ...DEFAULT_BRAIN_CONFIG };
      }

      // Create chokidar watcher
      this.watcher = watch(this.configPath, {
        persistent: true,
        ignoreInitial: true, // Don't emit on startup
        awaitWriteFinish: AWAIT_WRITE_FINISH,
      });

      // Set up event handlers
      this.watcher.on("change", () => this.handleChangeEvent());
      this.watcher.on("error", (error: unknown) => {
        const err = error instanceof Error ? error : new Error(String(error));
        this.handleError(err);
      });

      this.state = "running";

      this.emitEvent({
        type: "change",
        timestamp: new Date(),
        message: `Config watcher started for ${this.configPath}`,
      });
    } catch (error) {
      this.state = "error";
      this.emitEvent({
        type: "error",
        timestamp: new Date(),
        message: "Failed to start config watcher",
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Stop watching the config file.
   *
   * Cleans up watcher and any pending timers.
   * Safe to call multiple times (no-op if already stopped).
   */
  stop(): void {
    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Close watcher
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    this.state = "stopped";

    this.emitEvent({
      type: "change",
      timestamp: new Date(),
      message: "Config watcher stopped",
    });
  }

  /**
   * Get the current watcher state.
   */
  getState(): WatcherState {
    return this.state;
  }

  /**
   * Check if a migration is currently in progress.
   */
  isMigrationInProgress(): boolean {
    return this.migrationInProgress;
  }

  /**
   * Signal that a migration has started.
   *
   * While migration is in progress, config changes are queued
   * rather than processed immediately.
   */
  beginMigration(): void {
    this.migrationInProgress = true;
  }

  /**
   * Signal that a migration has completed.
   *
   * If changes were queued during migration, they will be processed.
   */
  async endMigration(): Promise<void> {
    this.migrationInProgress = false;

    // Process any pending change that occurred during migration
    if (this.pendingChange) {
      this.pendingChange = false;
      await this.processConfigChange();
    }
  }

  /**
   * Get the last known configuration.
   *
   * This is the config that was loaded at startup or after the last
   * successful change processing.
   */
  getLastConfig(): BrainConfig | null {
    return this.lastConfig;
  }

  // --- Private methods ---

  /**
   * Handle a file change event from chokidar.
   * Applies debouncing to avoid reacting to partial writes.
   */
  private handleChangeEvent(): void {
    // Clear any existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new debounce timer
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.processConfigChange().catch((error) => {
        this.emitEvent({
          type: "error",
          timestamp: new Date(),
          message: "Error processing config change",
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
    }, this.debounceMs);
  }

  /**
   * Process a config change after debounce period.
   */
  private async processConfigChange(): Promise<void> {
    // If migration in progress, queue the change for later
    if (this.migrationInProgress) {
      this.pendingChange = true;
      this.emitEvent({
        type: "change",
        timestamp: new Date(),
        message: "Config change detected during migration, queued for later",
      });
      return;
    }

    // Load and validate the new config
    let newConfig: BrainConfig;
    try {
      // Use sync load to avoid lock contention during rapid changes
      newConfig = loadBrainConfigSync();
    } catch (error) {
      await this.handleInvalidConfig(
        error instanceof Error ? error : new Error(String(error))
      );
      return;
    }

    // Validate the config
    const validation = validateBrainConfig(newConfig);
    if (!validation.success) {
      const errorMsg = validation.errors?.map(e => e.message).join("; ") || "Validation failed";
      await this.handleInvalidConfig(
        new Error(`Validation failed: ${errorMsg}`)
      );
      return;
    }

    // Detect changes from last known config
    const diff = detectConfigDiff(this.lastConfig, newConfig);

    if (!diff.hasChanges) {
      // No actual changes (e.g., file was saved without modifications)
      return;
    }

    this.emitEvent({
      type: "change",
      timestamp: new Date(),
      message: `Config changed:\n${summarizeConfigDiff(diff)}`,
      config: newConfig,
      diff,
    });

    // Create snapshot before applying changes
    rollbackManager.snapshot(this.lastConfig!, "Before manual config edit");

    // Sync to basic-memory if enabled
    if (this.autoSync) {
      try {
        await syncConfigToBasicMemory(newConfig);
      } catch (error) {
        this.emitEvent({
          type: "error",
          timestamp: new Date(),
          message: "Failed to sync config to basic-memory",
          error: error instanceof Error ? error : new Error(String(error)),
        });
        // Continue - sync failure shouldn't block reconfiguration
      }
    }

    // Update last known config
    this.lastConfig = newConfig;

    // Mark as good after successful processing
    await rollbackManager.markAsGood(newConfig, "After successful config change");

    this.emitEvent({
      type: "reconfigure",
      timestamp: new Date(),
      message: "Reconfiguration complete",
      config: newConfig,
      diff,
    });
  }

  /**
   * Handle an invalid configuration file.
   */
  private async handleInvalidConfig(error: Error): Promise<void> {
    this.emitEvent({
      type: "validation_error",
      timestamp: new Date(),
      message: `Invalid config detected: ${error.message}`,
      error,
    });

    // Auto-rollback if enabled
    if (this.autoRollback) {
      const result = await rollbackManager.revert();

      this.emitEvent({
        type: "rollback",
        timestamp: new Date(),
        message: result.success
          ? "Rolled back to last known good config"
          : `Rollback failed: ${result.error}`,
        rollbackResult: result,
        config: result.restoredConfig,
      });

      if (result.success && result.restoredConfig) {
        this.lastConfig = result.restoredConfig;
      }
    }
  }

  /**
   * Handle watcher errors.
   */
  private handleError(error: Error): void {
    this.state = "error";
    this.emitEvent({
      type: "error",
      timestamp: new Date(),
      message: `Watcher error: ${error.message}`,
      error,
    });
  }

  /**
   * Emit an event to the callback if configured.
   */
  private emitEvent(event: WatcherEvent): void {
    if (this.onEvent) {
      try {
        this.onEvent(event);
      } catch {
        // Ignore callback errors
      }
    }
  }
}

/**
 * Create and start a config file watcher with the given options.
 *
 * Convenience function for common use case.
 *
 * @param options - Watcher options
 * @returns Running watcher instance
 *
 * @example
 * ```typescript
 * const watcher = await createConfigWatcher({
 *   onEvent: (e) => logger.info(e.type, e.message)
 * });
 * ```
 */
export async function createConfigWatcher(
  options: WatcherOptions = {}
): Promise<ConfigFileWatcher> {
  const watcher = new ConfigFileWatcher(options);
  await watcher.start();
  return watcher;
}

/**
 * Singleton watcher instance for application-wide use.
 *
 * Initialize during MCP server startup:
 * ```typescript
 * import { configWatcher } from "./config/watcher";
 * await configWatcher.start();
 * ```
 */
export const configWatcher = new ConfigFileWatcher();
