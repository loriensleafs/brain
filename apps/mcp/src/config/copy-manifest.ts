/**
 * Copy Manifest for Partial Copy Tracking
 *
 * Tracks file copy progress with checksums for integrity verification
 * and partial rollback during migrations.
 *
 * Key capabilities:
 * - Track completed/pending files with SHA-256 checksums
 * - Rollback removes only copied files (not source files)
 * - Crash recovery detects incomplete manifests on startup
 *
 * Security controls:
 * - CWE-354: Integrity verification via checksums
 * - CWE-362: Race condition prevention via manifest atomicity
 *
 * @see ADR-020 for the configuration architecture decision
 * @see TASK-020-26 for implementation requirements
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { logger } from "../utils/internal/logger";

/**
 * Directory for manifest storage.
 */
const MANIFEST_DIR = path.join(os.homedir(), ".config", "brain", "manifests");

/**
 * Manifest file extension.
 */
const MANIFEST_EXTENSION = ".manifest.json";

/**
 * Status of a copy operation for a single file.
 */
export type CopyStatus = "pending" | "copied" | "verified" | "failed";

/**
 * Entry in the copy manifest representing a single file.
 */
export interface CopyManifestEntry {
  /** Source file path. */
  sourcePath: string;
  /** Target file path. */
  targetPath: string;
  /** SHA-256 checksum of source file. */
  sourceChecksum: string;
  /** SHA-256 checksum of target file (null if not yet copied). */
  targetChecksum: string | null;
  /** Current status of the copy operation. */
  status: CopyStatus;
  /** Timestamp when file was copied (null if not yet copied). */
  copiedAt: Date | null;
  /** Error message if copy failed. */
  error: string | null;
}

/**
 * Complete copy manifest for a migration operation.
 */
export interface CopyManifest {
  /** Unique identifier for this migration. */
  migrationId: string;
  /** Project being migrated. */
  project: string;
  /** Root directory of source files. */
  sourceRoot: string;
  /** Root directory of target files. */
  targetRoot: string;
  /** Timestamp when migration started. */
  startedAt: Date;
  /** Timestamp when migration completed (null if incomplete). */
  completedAt: Date | null;
  /** Array of file entries. */
  entries: CopyManifestEntry[];
}

/**
 * Result of a rollback operation.
 */
export interface RollbackResult {
  /** Whether rollback was successful. */
  success: boolean;
  /** Number of files successfully rolled back. */
  filesRolledBack: number;
  /** Files that failed to rollback. */
  failures: Array<{ path: string; error: string }>;
}

/**
 * Result of an incomplete migration recovery.
 */
export interface RecoveryResult {
  /** Number of incomplete migrations found. */
  found: number;
  /** Number of migrations successfully recovered (rolled back). */
  recovered: number;
  /** Migration IDs that failed recovery. */
  failures: string[];
}

/**
 * Serializable format for manifest storage.
 */
interface SerializedManifest {
  migrationId: string;
  project: string;
  sourceRoot: string;
  targetRoot: string;
  startedAt: string;
  completedAt: string | null;
  entries: Array<{
    sourcePath: string;
    targetPath: string;
    sourceChecksum: string;
    targetChecksum: string | null;
    status: CopyStatus;
    copiedAt: string | null;
    error: string | null;
  }>;
}

/**
 * Generate a unique migration ID.
 *
 * @returns Unique migration ID
 */
function generateMigrationId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString("hex");
  return `migration-${timestamp}-${random}`;
}

/**
 * Get the manifest directory path.
 *
 * @returns Path to manifest directory
 */
export function getManifestDir(): string {
  return MANIFEST_DIR;
}

/**
 * Get the path to a manifest file.
 *
 * @param migrationId - Migration identifier
 * @returns Path to manifest file
 */
function getManifestPath(migrationId: string): string {
  // Sanitize migration ID to prevent path traversal
  const sanitized = migrationId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(MANIFEST_DIR, `${sanitized}${MANIFEST_EXTENSION}`);
}

/**
 * Ensure the manifest directory exists.
 */
function ensureManifestDir(): void {
  if (!fs.existsSync(MANIFEST_DIR)) {
    fs.mkdirSync(MANIFEST_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Compute SHA-256 checksum of a file.
 *
 * @param filePath - Path to file
 * @returns SHA-256 checksum as hex string
 * @throws Error if file cannot be read
 */
export async function computeFileChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

/**
 * Compute SHA-256 checksum of a file synchronously.
 *
 * @param filePath - Path to file
 * @returns SHA-256 checksum as hex string
 * @throws Error if file cannot be read
 */
export function computeFileChecksumSync(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Serialize a manifest for storage.
 *
 * @param manifest - Manifest to serialize
 * @returns Serialized manifest
 */
function serializeManifest(manifest: CopyManifest): SerializedManifest {
  return {
    migrationId: manifest.migrationId,
    project: manifest.project,
    sourceRoot: manifest.sourceRoot,
    targetRoot: manifest.targetRoot,
    startedAt: manifest.startedAt.toISOString(),
    completedAt: manifest.completedAt?.toISOString() ?? null,
    entries: manifest.entries.map((entry) => ({
      sourcePath: entry.sourcePath,
      targetPath: entry.targetPath,
      sourceChecksum: entry.sourceChecksum,
      targetChecksum: entry.targetChecksum,
      status: entry.status,
      copiedAt: entry.copiedAt?.toISOString() ?? null,
      error: entry.error,
    })),
  };
}

/**
 * Deserialize a manifest from storage.
 *
 * @param serialized - Serialized manifest
 * @returns Deserialized manifest
 */
function deserializeManifest(serialized: SerializedManifest): CopyManifest {
  return {
    migrationId: serialized.migrationId,
    project: serialized.project,
    sourceRoot: serialized.sourceRoot,
    targetRoot: serialized.targetRoot,
    startedAt: new Date(serialized.startedAt),
    completedAt: serialized.completedAt ? new Date(serialized.completedAt) : null,
    entries: serialized.entries.map((entry) => ({
      sourcePath: entry.sourcePath,
      targetPath: entry.targetPath,
      sourceChecksum: entry.sourceChecksum,
      targetChecksum: entry.targetChecksum,
      status: entry.status,
      copiedAt: entry.copiedAt ? new Date(entry.copiedAt) : null,
      error: entry.error,
    })),
  };
}

/**
 * Save a manifest to disk.
 *
 * Uses atomic write pattern (temp + rename) for safety.
 *
 * @param manifest - Manifest to save
 */
function saveManifest(manifest: CopyManifest): void {
  ensureManifestDir();

  const manifestPath = getManifestPath(manifest.migrationId);
  const tempPath = manifestPath + ".tmp";

  try {
    const content = JSON.stringify(serializeManifest(manifest), null, 2);
    fs.writeFileSync(tempPath, content, { encoding: "utf-8", mode: 0o600 });

    // Verify temp file
    const verifyContent = fs.readFileSync(tempPath, "utf-8");
    JSON.parse(verifyContent);

    // Atomic rename
    fs.renameSync(tempPath, manifestPath);
  } catch (error) {
    // Clean up temp file
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Load a manifest from disk.
 *
 * @param migrationId - Migration identifier
 * @returns Loaded manifest or null if not found
 */
function loadManifest(migrationId: string): CopyManifest | null {
  const manifestPath = getManifestPath(migrationId);

  try {
    if (!fs.existsSync(manifestPath)) {
      return null;
    }

    const content = fs.readFileSync(manifestPath, "utf-8");
    const serialized = JSON.parse(content) as SerializedManifest;
    return deserializeManifest(serialized);
  } catch (error) {
    logger.warn({ migrationId, error }, "Failed to load manifest");
    return null;
  }
}

/**
 * Delete a manifest from disk.
 *
 * @param migrationId - Migration identifier
 */
function deleteManifest(migrationId: string): void {
  const manifestPath = getManifestPath(migrationId);

  try {
    if (fs.existsSync(manifestPath)) {
      fs.unlinkSync(manifestPath);
    }
  } catch (error) {
    logger.warn({ migrationId, error }, "Failed to delete manifest");
  }
}

/**
 * List all manifest files in the manifest directory.
 *
 * @returns Array of migration IDs
 */
function listManifests(): string[] {
  ensureManifestDir();

  try {
    const files = fs.readdirSync(MANIFEST_DIR);
    return files
      .filter((f) => f.endsWith(MANIFEST_EXTENSION))
      .map((f) => f.slice(0, -MANIFEST_EXTENSION.length));
  } catch {
    return [];
  }
}

/**
 * Create a new copy manifest before starting a migration.
 *
 * Scans all source files and computes their checksums.
 *
 * @param project - Project being migrated
 * @param sourceRoot - Root directory of source files
 * @param targetRoot - Root directory of target files
 * @param files - Array of relative file paths to migrate
 * @returns Created manifest
 */
export async function createCopyManifest(
  project: string,
  sourceRoot: string,
  targetRoot: string,
  files: string[]
): Promise<CopyManifest> {
  const migrationId = generateMigrationId();
  const entries: CopyManifestEntry[] = [];

  for (const file of files) {
    const sourcePath = path.join(sourceRoot, file);
    const targetPath = path.join(targetRoot, file);

    // Compute source checksum
    let sourceChecksum: string;
    try {
      sourceChecksum = await computeFileChecksum(sourcePath);
    } catch (error) {
      logger.warn({ file, error }, "Failed to compute source checksum");
      sourceChecksum = "";
    }

    entries.push({
      sourcePath,
      targetPath,
      sourceChecksum,
      targetChecksum: null,
      status: "pending",
      copiedAt: null,
      error: null,
    });
  }

  const manifest: CopyManifest = {
    migrationId,
    project,
    sourceRoot,
    targetRoot,
    startedAt: new Date(),
    completedAt: null,
    entries,
  };

  saveManifest(manifest);
  logger.info(
    { migrationId, project, fileCount: files.length },
    "Copy manifest created"
  );

  return manifest;
}

/**
 * Mark a manifest entry as copied.
 *
 * Updates the entry status and computes target checksum.
 *
 * @param manifest - Manifest containing the entry
 * @param entry - Entry to mark as copied
 */
export async function markEntryCopied(
  manifest: CopyManifest,
  entry: CopyManifestEntry
): Promise<void> {
  // Compute target checksum
  try {
    entry.targetChecksum = await computeFileChecksum(entry.targetPath);
  } catch (error) {
    entry.status = "failed";
    entry.error = error instanceof Error ? error.message : "Checksum computation failed";
    saveManifest(manifest);
    return;
  }

  entry.status = "copied";
  entry.copiedAt = new Date();
  entry.error = null;

  saveManifest(manifest);
}

/**
 * Mark a manifest entry as verified.
 *
 * Checks that source and target checksums match.
 *
 * @param manifest - Manifest containing the entry
 * @param entry - Entry to verify
 * @returns true if verification passed
 */
export async function verifyEntry(
  manifest: CopyManifest,
  entry: CopyManifestEntry
): Promise<boolean> {
  if (entry.status !== "copied") {
    return false;
  }

  // Recompute target checksum to verify
  try {
    const currentChecksum = await computeFileChecksum(entry.targetPath);

    if (currentChecksum !== entry.sourceChecksum) {
      entry.status = "failed";
      entry.error = `Checksum mismatch: expected ${entry.sourceChecksum}, got ${currentChecksum}`;
      saveManifest(manifest);
      return false;
    }

    entry.status = "verified";
    saveManifest(manifest);
    return true;
  } catch (error) {
    entry.status = "failed";
    entry.error = error instanceof Error ? error.message : "Verification failed";
    saveManifest(manifest);
    return false;
  }
}

/**
 * Mark an entry as failed with an error message.
 *
 * @param manifest - Manifest containing the entry
 * @param entry - Entry to mark as failed
 * @param error - Error message
 */
export function markEntryFailed(
  manifest: CopyManifest,
  entry: CopyManifestEntry,
  error: string
): void {
  entry.status = "failed";
  entry.error = error;
  saveManifest(manifest);
}

/**
 * Mark a manifest as completed.
 *
 * @param manifest - Manifest to mark as completed
 */
export function markManifestCompleted(manifest: CopyManifest): void {
  manifest.completedAt = new Date();
  saveManifest(manifest);
  logger.info({ migrationId: manifest.migrationId }, "Migration completed");
}

/**
 * Rollback a partial copy operation.
 *
 * Removes only files that were successfully copied (status = copied or verified).
 * Does NOT remove source files.
 *
 * @param manifest - Manifest to rollback
 * @returns Rollback result
 */
export async function rollbackPartialCopy(manifest: CopyManifest): Promise<RollbackResult> {
  const failures: Array<{ path: string; error: string }> = [];
  let filesRolledBack = 0;

  for (const entry of manifest.entries) {
    // Only remove files that were copied
    if (entry.status === "copied" || entry.status === "verified") {
      try {
        if (fs.existsSync(entry.targetPath)) {
          fs.unlinkSync(entry.targetPath);
          filesRolledBack++;
          logger.debug({ path: entry.targetPath }, "Rolled back file");
        }
      } catch (error) {
        failures.push({
          path: entry.targetPath,
          error: error instanceof Error ? error.message : "Rollback failed",
        });
      }
    }
  }

  // Clean up empty directories in target
  try {
    const targetDir = manifest.targetRoot;
    if (fs.existsSync(targetDir)) {
      const files = fs.readdirSync(targetDir);
      if (files.length === 0) {
        fs.rmdirSync(targetDir);
        logger.debug({ path: targetDir }, "Removed empty target directory");
      }
    }
  } catch {
    // Ignore directory cleanup errors
  }

  // Delete the manifest
  deleteManifest(manifest.migrationId);

  const result: RollbackResult = {
    success: failures.length === 0,
    filesRolledBack,
    failures,
  };

  logger.info(
    { migrationId: manifest.migrationId, filesRolledBack, failures: failures.length },
    "Rollback completed"
  );

  return result;
}

/**
 * Check if a manifest represents an incomplete migration.
 *
 * A migration is incomplete if:
 * - completedAt is null
 * - Any entry is not verified
 *
 * @param manifest - Manifest to check
 * @returns true if migration is incomplete
 */
export function isIncomplete(manifest: CopyManifest): boolean {
  if (!manifest.completedAt) {
    return true;
  }

  return manifest.entries.some((entry) => entry.status !== "verified");
}

/**
 * Recover incomplete migrations on startup.
 *
 * Scans for incomplete manifests and rolls them back.
 *
 * @returns Recovery result
 */
export async function recoverIncompleteMigrations(): Promise<RecoveryResult> {
  const manifestIds = listManifests();
  const failures: string[] = [];
  let found = 0;
  let recovered = 0;

  for (const migrationId of manifestIds) {
    const manifest = loadManifest(migrationId);
    if (!manifest) {
      continue;
    }

    if (isIncomplete(manifest)) {
      found++;
      logger.info(
        { migrationId, project: manifest.project },
        "Found incomplete migration, rolling back"
      );

      try {
        const result = await rollbackPartialCopy(manifest);
        if (result.success) {
          recovered++;
        } else {
          failures.push(migrationId);
        }
      } catch (error) {
        logger.error({ migrationId, error }, "Failed to recover migration");
        failures.push(migrationId);
      }
    }
  }

  const result: RecoveryResult = {
    found,
    recovered,
    failures,
  };

  if (found > 0) {
    logger.info({ found, recovered, failures: failures.length }, "Migration recovery completed");
  }

  return result;
}

/**
 * Get a manifest by ID.
 *
 * @param migrationId - Migration identifier
 * @returns Manifest or null if not found
 */
export function getManifest(migrationId: string): CopyManifest | null {
  return loadManifest(migrationId);
}

/**
 * Get the count of entries by status.
 *
 * @param manifest - Manifest to analyze
 * @returns Object with counts by status
 */
export function getStatusCounts(manifest: CopyManifest): Record<CopyStatus, number> {
  const counts: Record<CopyStatus, number> = {
    pending: 0,
    copied: 0,
    verified: 0,
    failed: 0,
  };

  for (const entry of manifest.entries) {
    counts[entry.status]++;
  }

  return counts;
}

/**
 * Get all failed entries from a manifest.
 *
 * @param manifest - Manifest to analyze
 * @returns Array of failed entries
 */
export function getFailedEntries(manifest: CopyManifest): CopyManifestEntry[] {
  return manifest.entries.filter((entry) => entry.status === "failed");
}

/**
 * Get all pending entries from a manifest.
 *
 * @param manifest - Manifest to analyze
 * @returns Array of pending entries
 */
export function getPendingEntries(manifest: CopyManifest): CopyManifestEntry[] {
  return manifest.entries.filter((entry) => entry.status === "pending");
}

/**
 * Get progress information for a manifest.
 *
 * @param manifest - Manifest to analyze
 * @returns Progress object with counts and percentages
 */
export function getProgress(manifest: CopyManifest): {
  total: number;
  completed: number;
  pending: number;
  failed: number;
  percentComplete: number;
} {
  const counts = getStatusCounts(manifest);
  const total = manifest.entries.length;
  const completed = counts.verified + counts.copied;
  const pending = counts.pending;
  const failed = counts.failed;
  const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { total, completed, pending, failed, percentComplete };
}
