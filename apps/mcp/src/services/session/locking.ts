/**
 * Optimistic Locking for Session State
 *
 * Implements optimistic locking with version field and conflict resolution.
 * Ensures session state integrity during concurrent updates.
 *
 * Requirements:
 * - TASK-004: Optimistic locking mechanism
 * - Version field incremented on every update
 * - 3-retry conflict resolution with exponential backoff
 *
 * Algorithm:
 * 1. Read current state and capture version
 * 2. Apply updates to state
 * 3. Increment version
 * 4. Attempt write
 * 5. Verify written version matches expected
 * 6. On conflict: retry with exponential backoff (max 3 retries)
 * 7. After max retries: throw VersionConflictError
 */

import { logger } from "../../utils/internal/logger";
import type { SessionState } from "./types";

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum retry attempts for version conflicts.
 */
export const DEFAULT_MAX_RETRIES = 3;

/**
 * Base delay for exponential backoff (milliseconds).
 * Actual delay = BASE_BACKOFF_MS * 2^attempt
 */
export const BASE_BACKOFF_MS = 50;

/**
 * Maximum backoff delay (milliseconds).
 * Caps exponential growth to prevent excessive waits.
 */
export const MAX_BACKOFF_MS = 500;

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when version conflict cannot be resolved after max retries.
 *
 * Contains diagnostic information:
 * - expectedVersion: Version we expected to write
 * - actualVersion: Version found during verification
 * - retryCount: Number of retries attempted
 */
export class VersionConflictError extends Error {
	public readonly expectedVersion: number;
	public readonly actualVersion: number;
	public readonly retryCount: number;

	constructor(
		expectedVersion: number,
		actualVersion: number,
		retryCount: number,
	) {
		super(
			`Version conflict for session: ` +
				`expected version ${expectedVersion}, found ${actualVersion}. ` +
				`Failed after ${retryCount} retries.`,
		);
		this.name = "VersionConflictError";
		this.expectedVersion = expectedVersion;
		this.actualVersion = actualVersion;
		this.retryCount = retryCount;
	}
}

// ============================================================================
// Types
// ============================================================================

/**
 * Update function that transforms current state into new state.
 * Returns the updated state with version already incremented.
 *
 * @param current - Current session state
 * @returns Updated session state (caller should NOT increment version)
 */
export type SessionUpdateFn = (current: SessionState) => SessionState;

/**
 * Partial updates to apply to session state.
 * Used by the simplified update API.
 */
export type SessionPartialUpdate = Partial<
	Omit<SessionState, "version" | "createdAt">
>;

/**
 * Storage adapter interface for session state persistence.
 * Abstracts the underlying storage mechanism (memory, file, Brain note).
 */
export interface SessionStorage {
	/**
	 * Read session state from storage.
	 * @returns Current state or null if not found
	 */
	read(): Promise<SessionState | null>;

	/**
	 * Write session state to storage.
	 * @param state - State to write (includes new version)
	 */
	write(state: SessionState): Promise<void>;
}

/**
 * Options for update operation.
 */
export interface UpdateOptions {
	/**
	 * Maximum retry attempts (default: 3)
	 */
	maxRetries?: number;

	/**
	 * Storage adapter (required)
	 */
	storage: SessionStorage;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate backoff delay with exponential growth and jitter.
 *
 * Formula: min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2^attempt) + jitter
 * Jitter: random 0-20% of calculated delay
 *
 * @param attempt - Current attempt number (0-indexed)
 * @returns Delay in milliseconds
 */
export function calculateBackoff(attempt: number): number {
	const exponentialDelay = BASE_BACKOFF_MS * 2 ** attempt;
	const cappedDelay = Math.min(MAX_BACKOFF_MS, exponentialDelay);
	// Add jitter (0-20% of delay) to prevent thundering herd
	const jitter = Math.random() * 0.2 * cappedDelay;
	return Math.round(cappedDelay + jitter);
}

/**
 * Sleep for specified milliseconds.
 *
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Increment version number in session state.
 * Returns new state object (immutable update).
 *
 * @param state - Current state
 * @returns New state with incremented version and updated timestamp
 */
export function incrementVersion(state: SessionState): SessionState {
	return {
		...state,
		version: state.version + 1,
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Apply partial updates to session state.
 * Merges updates into current state without modifying version.
 *
 * @param current - Current state
 * @param updates - Partial updates to apply
 * @returns New state with updates applied
 */
export function applyPartialUpdates(
	current: SessionState,
	updates: SessionPartialUpdate,
): SessionState {
	const now = new Date().toISOString();

	// Handle mode change with history tracking
	if (updates.currentMode && updates.currentMode !== current.currentMode) {
		return {
			...current,
			...updates,
			modeHistory: [
				...current.modeHistory,
				{ mode: updates.currentMode, timestamp: now },
			],
			updatedAt: now,
		};
	}

	return {
		...current,
		...updates,
		updatedAt: now,
	};
}

// ============================================================================
// Core Locking Functions
// ============================================================================

/**
 * Update session state with optimistic locking.
 *
 * Process:
 * 1. Read current state from storage
 * 2. Apply update function to get new state
 * 3. Increment version
 * 4. Write to storage
 * 5. Verify version matches expected
 * 6. On conflict: retry with exponential backoff
 *
 * @param updateFn - Function to transform current state
 * @param options - Update options including storage adapter
 * @throws VersionConflictError after max retries exceeded
 *
 * @example
 * ```typescript
 * await updateSessionWithLocking(
 *   (state) => ({ ...state, currentMode: "coding" }),
 *   { storage: myStorage }
 * );
 * ```
 */
export async function updateSessionWithLocking(
	updateFn: SessionUpdateFn,
	options: UpdateOptions,
): Promise<void> {
	const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
	const { storage } = options;

	let lastAttemptedVersion = 0;
	let lastActualVersion = 0;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		// Log retry attempts (not first attempt)
		if (attempt > 0) {
			const backoff = calculateBackoff(attempt - 1);
			logger.debug(
				{
					attempt,
					maxRetries,
					backoffMs: backoff,
				},
				"Retrying session update after version conflict",
			);
			await sleep(backoff);
		}

		// Step 1: Read current state
		const current = await storage.read();

		if (!current) {
			throw new Error("Session not found. Cannot update non-existent session.");
		}

		const expectedVersion = current.version + 1;
		lastAttemptedVersion = expectedVersion;

		// Step 2: Apply updates
		let updated: SessionState;
		try {
			updated = updateFn(current);
		} catch (error) {
			logger.error({ error }, "Update function threw error");
			throw error;
		}

		// Step 3: Increment version
		updated = incrementVersion(updated);

		// Step 4: Write to storage
		await storage.write(updated);

		// Step 5: Verify version matches expected
		const verification = await storage.read();

		if (!verification) {
			throw new Error(
				"Session disappeared after write. Storage inconsistency.",
			);
		}

		lastActualVersion = verification.version;

		// Success: version matches
		if (verification.version === expectedVersion) {
			logger.debug(
				{
					version: expectedVersion,
					attempts: attempt + 1,
				},
				"Session updated successfully with optimistic locking",
			);
			return;
		}

		// Version mismatch: conflict detected
		logger.warn(
			{
				expectedVersion,
				actualVersion: verification.version,
				attempt: attempt + 1,
				maxRetries,
			},
			"Version conflict detected",
		);
	}

	// All retries exhausted
	throw new VersionConflictError(
		lastAttemptedVersion,
		lastActualVersion,
		maxRetries,
	);
}

/**
 * Update session state with partial updates and optimistic locking.
 *
 * Convenience wrapper around updateSessionWithLocking that accepts
 * partial updates instead of a transform function.
 *
 * @param updates - Partial updates to apply
 * @param options - Update options including storage adapter
 * @throws VersionConflictError after max retries exceeded
 *
 * @example
 * ```typescript
 * await updateSession({ currentMode: "coding" }, { storage });
 * ```
 */
export async function updateSession(
	updates: SessionPartialUpdate,
	options: UpdateOptions,
): Promise<void> {
	return updateSessionWithLocking(
		(current) => applyPartialUpdates(current, updates),
		options,
	);
}

// ============================================================================
// In-Memory Storage Adapter
// ============================================================================

/**
 * In-memory session storage adapter.
 *
 * Stores single session for testing and local development.
 * Thread-safe within a single process (JavaScript is single-threaded).
 */
export class InMemorySessionStorage implements SessionStorage {
	private state: SessionState | null = null;

	async read(): Promise<SessionState | null> {
		// Return deep copy to prevent external mutation
		return this.state ? JSON.parse(JSON.stringify(this.state)) : null;
	}

	async write(state: SessionState): Promise<void> {
		// Store deep copy to prevent external mutation
		this.state = JSON.parse(JSON.stringify(state));
	}

	/**
	 * Initialize session with given state.
	 * Used for testing.
	 */
	initialize(state: SessionState): void {
		this.state = JSON.parse(JSON.stringify(state));
	}

	/**
	 * Clear stored session.
	 * Used for testing.
	 */
	clear(): void {
		this.state = null;
	}

	/**
	 * Get current state without copying (for testing only).
	 */
	_getInternal(): SessionState | null {
		return this.state;
	}
}

// ============================================================================
// Simulated Concurrent Storage (for testing)
// ============================================================================

/**
 * Storage adapter that simulates concurrent modifications.
 *
 * Used for testing version conflict detection and retry logic.
 * Injects version increments on specified write operations to simulate
 * a concurrent writer "winning" the race.
 *
 * How it works:
 * 1. Write is intercepted on specified attempt numbers
 * 2. After our write, we increment version again (simulating concurrent write)
 * 3. Verification read sees higher version than expected
 */
export class SimulatedConcurrentStorage implements SessionStorage {
	private readonly underlying: SessionStorage;
	private writeCount = 0;
	private readonly conflictOnWrites: Set<number>;

	/**
	 * Create simulated concurrent storage.
	 *
	 * @param underlying - Real storage adapter
	 * @param conflictOnWrites - Which write operations should trigger conflicts (1-indexed)
	 */
	constructor(underlying: SessionStorage, conflictOnWrites: number[]) {
		this.underlying = underlying;
		this.conflictOnWrites = new Set(conflictOnWrites);
	}

	async read(): Promise<SessionState | null> {
		return this.underlying.read();
	}

	async write(state: SessionState): Promise<void> {
		this.writeCount++;

		// Write our state first
		await this.underlying.write(state);

		// Simulate concurrent modification after our write on specified attempts
		if (this.conflictOnWrites.has(this.writeCount)) {
			// Increment version in underlying storage to simulate concurrent writer
			const modified = incrementVersion(state);
			await this.underlying.write(modified);
			logger.debug(
				{
					writeCount: this.writeCount,
					ourVersion: state.version,
					concurrentVersion: modified.version,
				},
				"Simulated concurrent modification after write",
			);
		}
	}

	/**
	 * Reset write counter (for testing).
	 */
	resetCounter(): void {
		this.writeCount = 0;
	}

	/**
	 * Get current write count (for testing).
	 */
	getWriteCount(): number {
		return this.writeCount;
	}
}
