/**
 * Session State Workflow
 *
 * Persists critical session context that survives Claude context compaction.
 * State includes: current mode, mode history, active feature, and active task.
 *
 * Triggered by "session/state.update" event to update session state.
 * Integrates with consolidated session service for state persistence.
 * Emits "session/mode.changed" events on mode transitions for downstream workflows.
 */

import {
	createDefaultSessionState,
	getSession,
	type SessionState,
	setSession,
	type WorkflowMode,
	withFeatureChange,
	withModeChange,
	withTaskChange,
} from "../../services/session";
import { logger } from "../../utils/internal/logger";
import { inngest } from "../client";

/**
 * Validate workflow state (basic validation without WASM).
 *
 * @param state - Workflow state to validate
 * @returns Validation result with checks
 */
function validateWorkflow(state: { mode: string; task?: string }): {
	valid: boolean;
	checks: Array<{ name: string; passed: boolean; message: string }>;
	message: string;
	remediation?: string;
} {
	const validModes = ["analysis", "planning", "coding", "disabled"];
	const checks: Array<{ name: string; passed: boolean; message: string }> = [];

	// Check mode validity
	const modeValid = validModes.includes(state.mode);
	checks.push({
		name: "mode-valid",
		passed: modeValid,
		message: modeValid ? "Mode is valid" : `Invalid mode: ${state.mode}`,
	});

	// Check task requirement in coding mode
	if (state.mode === "coding" && !state.task) {
		checks.push({
			name: "task-required",
			passed: false,
			message: "Task is required in coding mode",
		});
	}

	const allPassed = checks.every((c) => c.passed);
	return {
		valid: allPassed,
		checks,
		message: allPassed ? "Valid" : "Validation failed",
		remediation: allPassed
			? undefined
			: "Ensure mode is valid and task is set for coding mode",
	};
}

/**
 * Get or create session state.
 * Uses consolidated session service as single source of truth.
 *
 * @returns Session state (existing or newly created)
 */
async function getOrCreateState(): Promise<SessionState> {
	let state = await getSession();
	if (!state) {
		state = createDefaultSessionState();
		await setSession({}); // Initialize in session service
		logger.info("Created new session state via session service");
	}
	return state;
}

/**
 * Session state update workflow.
 *
 * Triggered by "session/state.update" event.
 * Handles mode changes, feature changes, and task changes.
 * Emits "session/mode.changed" event on successful mode transitions.
 *
 * Step IDs for Inngest memoization:
 * - "init-validation": Initialize WASM validation module
 * - "get-current-state": Retrieve or create current session state
 * - "apply-update": Apply the requested update to state
 * - "persist-state": Store the updated state via session service
 * - "emit-mode-changed": Emit mode change event (mode updates only)
 */
export const sessionStateWorkflow = inngest.createFunction(
	{
		id: "session-state-update",
		name: "Session State Update",
	},
	{ event: "session/state.update" },
	async ({ event, step }) => {
		const { updateType, mode, feature, task } = event.data;

		logger.info(
			{ updateType, mode, feature, task },
			"Processing session state update",
		);

		// Step 1: Get current state from session service
		const currentState = await step.run(
			"get-current-state",
			async (): Promise<SessionState> => {
				return getOrCreateState();
			},
		);

		// Track previous mode for event emission
		const previousMode = currentState.currentMode;

		// Step 2: Apply the update based on type
		const updatedState = await step.run(
			"apply-update",
			async (): Promise<SessionState> => {
				switch (updateType) {
					case "init":
						// Initialize new session (return current/default state)
						return currentState;

					case "mode": {
						if (!mode) {
							logger.warn("Mode update requested but no mode provided");
							return currentState;
						}
						// Validate the mode before accepting the change
						const validationResult = validateWorkflow({
							mode,
							task: task ?? currentState.activeTask,
						});
						if (!validationResult.valid) {
							const failedChecks = validationResult.checks
								.filter((c) => !c.passed)
								.map((c) => c.message)
								.join("; ");
							logger.error(
								{
									mode,
									checks: failedChecks,
									remediation: validationResult.remediation,
								},
								"Mode change rejected: validation failed",
							);
							throw new Error(
								`Invalid mode change: ${failedChecks}. ${validationResult.remediation ?? ""}`,
							);
						}
						logger.debug({ mode }, "Mode validated successfully");
						return withModeChange(currentState, mode as WorkflowMode);
					}

					case "feature":
						// Feature can be undefined to clear active feature
						return withFeatureChange(currentState, feature);

					case "task":
						// Task can be undefined to clear active task
						return withTaskChange(currentState, task);

					default:
						logger.warn({ updateType }, "Unknown update type");
						return currentState;
				}
			},
		);

		// Step 3: Persist the updated state via session service
		await step.run("persist-state", async (): Promise<void> => {
			await setSession({
				mode: updatedState.currentMode,
				feature: updatedState.activeFeature,
				task: updatedState.activeTask,
			});
			logger.debug(
				{
					currentMode: updatedState.currentMode,
					activeFeature: updatedState.activeFeature,
					activeTask: updatedState.activeTask,
				},
				"Session state persisted via session service",
			);
		});

		// Step 4: Emit mode.changed event if mode actually changed
		if (updateType === "mode" && mode && previousMode !== mode) {
			await step.sendEvent("emit-mode-changed", {
				name: "session/mode.changed",
				data: {
					previousMode,
					newMode: mode as WorkflowMode,
					changedAt: new Date().toISOString(),
					activeFeature: updatedState.activeFeature,
					activeTask: updatedState.activeTask,
				},
			});
			logger.info(
				{ previousMode, newMode: mode },
				"Emitted session/mode.changed event",
			);
		}

		logger.info(
			{
				updateType,
				currentMode: updatedState.currentMode,
				modeHistoryCount: updatedState.modeHistory.length,
				activeFeature: updatedState.activeFeature,
				activeTask: updatedState.activeTask,
			},
			"Session state update complete",
		);

		return updatedState;
	},
);

/**
 * Session state query workflow.
 *
 * Triggered by "session/state.query" event.
 * Returns the current state for a session from session service.
 *
 * Note: For simple queries, direct function call is preferred.
 * This workflow exists for consistency and potential future
 * cross-service state retrieval.
 */
export const sessionStateQueryWorkflow = inngest.createFunction(
	{
		id: "session-state-query",
		name: "Session State Query",
	},
	{ event: "session/state.query" },
	async ({ step }) => {
		logger.debug("Processing session state query");

		const state = await step.run(
			"get-state",
			async (): Promise<SessionState> => {
				return getOrCreateState();
			},
		);

		return state;
	},
);

/**
 * Get session state directly (for non-workflow access).
 * Uses consolidated session service as single source of truth.
 *
 * @returns Current session state or undefined if not found
 */
export async function getSessionState(): Promise<SessionState | undefined> {
	return (await getSession()) ?? undefined;
}

/**
 * Check if a session state exists.
 * Checks consolidated session service.
 *
 * @returns True if session state exists
 */
export async function hasSessionState(): Promise<boolean> {
	return (await getSession()) !== null;
}

/**
 * Get all active session IDs.
 * @deprecated No longer applicable - single session per project
 */
export function getActiveSessionIds(): string[] {
	logger.warn("getActiveSessionIds is deprecated - single session per project");
	return [];
}

/**
 * Clear session state.
 * @deprecated No longer applicable - single session per project
 */
export function clearSessionState(): boolean {
	logger.warn("clearSessionState is deprecated - single session per project");
	return true;
}
