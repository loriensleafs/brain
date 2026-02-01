/**
 * Error handling utilities for Inngest workflows.
 *
 * Provides NonRetriableError wrappers for permanent failures that should not
 * be retried by Inngest. Use these for validation errors, configuration errors,
 * and agent failures that will not resolve with retry.
 *
 * @example
 * ```typescript
 * import { createNonRetriableError, WorkflowErrorType } from "../errors";
 *
 * if (!featureId) {
 *   throw createNonRetriableError(
 *     WorkflowErrorType.VALIDATION_ERROR,
 *     "Feature ID is required"
 *   );
 * }
 * ```
 */

import { NonRetriableError } from "inngest";
import { logger } from "../utils/internal/logger";

/**
 * Error type constants for workflow failures.
 *
 * - VALIDATION_ERROR: Invalid input data (missing required fields, wrong format)
 * - CONFIGURATION_ERROR: Missing or invalid configuration
 * - AGENT_FAILURE: Agent execution failed in a non-recoverable way
 */
export const WorkflowErrorType = {
	VALIDATION_ERROR: "VALIDATION_ERROR",
	CONFIGURATION_ERROR: "CONFIGURATION_ERROR",
	AGENT_FAILURE: "AGENT_FAILURE",
} as const;

export type WorkflowErrorType =
	(typeof WorkflowErrorType)[keyof typeof WorkflowErrorType];

/**
 * Extended error info attached to NonRetriableError.
 */
export interface WorkflowErrorInfo {
	/** Error type category */
	type: WorkflowErrorType;
	/** Human-readable error message */
	message: string;
	/** Original error if wrapping another error */
	cause?: unknown;
	/** Additional context for debugging */
	context?: Record<string, unknown>;
}

/**
 * Create a NonRetriableError for permanent workflow failures.
 *
 * Use this when an error will not resolve with retry:
 * - Invalid feature ID format
 * - Missing required context
 * - Agent internal errors that indicate bad state
 *
 * @param type - Error type category
 * @param message - Human-readable error description
 * @param options - Additional error options
 * @returns NonRetriableError instance
 *
 * @example
 * ```typescript
 * // Validation error
 * throw createNonRetriableError(
 *   WorkflowErrorType.VALIDATION_ERROR,
 *   "Feature ID cannot be empty"
 * );
 *
 * // With cause
 * try {
 *   await someOperation();
 * } catch (err) {
 *   throw createNonRetriableError(
 *     WorkflowErrorType.AGENT_FAILURE,
 *     "Agent execution failed",
 *     { cause: err, context: { agentName: "qa" } }
 *   );
 * }
 * ```
 */
export function createNonRetriableError(
	type: WorkflowErrorType,
	message: string,
	options?: {
		cause?: unknown;
		context?: Record<string, unknown>;
	},
): NonRetriableError {
	const fullMessage = `[${type}] ${message}`;

	logger.error(
		{
			errorType: type,
			message,
			cause: options?.cause,
			context: options?.context,
		},
		"Creating non-retriable error",
	);

	return new NonRetriableError(fullMessage, {
		cause: options?.cause
			? {
					type,
					originalError: serializeError(options.cause),
					context: options.context,
				}
			: { type, context: options?.context },
	});
}

/**
 * Check if an error should be retried by Inngest.
 *
 * Returns false for:
 * - NonRetriableError instances
 * - Errors with specific messages indicating permanent failure
 *
 * @param error - Error to check
 * @returns true if error might resolve with retry, false otherwise
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (err) {
 *   if (!isRetriable(err)) {
 *     throw err; // Let Inngest handle non-retry
 *   }
 *   // Handle retriable error
 * }
 * ```
 */
export function isRetriable(error: unknown): boolean {
	if (error instanceof NonRetriableError) {
		return false;
	}

	// Check for known non-retriable error patterns
	if (error instanceof Error) {
		const nonRetriablePatterns = [
			/invalid.*id/i,
			/not found/i,
			/missing required/i,
			/configuration error/i,
			/validation failed/i,
		];

		return !nonRetriablePatterns.some((pattern) => pattern.test(error.message));
	}

	// Unknown error types are considered retriable
	return true;
}

/**
 * Validate feature ID format and throw NonRetriableError if invalid.
 *
 * @param featureId - Feature ID to validate
 * @param agentName - Name of the calling agent for error context
 * @throws NonRetriableError if featureId is invalid
 *
 * @example
 * ```typescript
 * export async function runQaAgent(featureId: string, context: Record<string, unknown>) {
 *   validateFeatureId(featureId, "qa");
 *   // ... rest of agent logic
 * }
 * ```
 */
export function validateFeatureId(featureId: string, agentName: string): void {
	if (!featureId || typeof featureId !== "string") {
		throw createNonRetriableError(
			WorkflowErrorType.VALIDATION_ERROR,
			"Feature ID is required and must be a non-empty string",
			{ context: { agentName, providedValue: featureId } },
		);
	}

	if (featureId.trim().length === 0) {
		throw createNonRetriableError(
			WorkflowErrorType.VALIDATION_ERROR,
			"Feature ID cannot be empty or whitespace only",
			{ context: { agentName, providedValue: featureId } },
		);
	}
}

/**
 * Validate required context fields and throw NonRetriableError if missing.
 *
 * @param context - Context object to validate
 * @param requiredFields - Array of required field names
 * @param agentName - Name of the calling agent for error context
 * @throws NonRetriableError if any required fields are missing
 *
 * @example
 * ```typescript
 * validateRequiredContext(context, ["featurePath", "projectRoot"], "architect");
 * ```
 */
export function validateRequiredContext(
	context: Record<string, unknown>,
	requiredFields: string[],
	agentName: string,
): void {
	const missingFields = requiredFields.filter(
		(field) => context[field] === undefined || context[field] === null,
	);

	if (missingFields.length > 0) {
		throw createNonRetriableError(
			WorkflowErrorType.VALIDATION_ERROR,
			`Missing required context fields: ${missingFields.join(", ")}`,
			{
				context: {
					agentName,
					requiredFields,
					missingFields,
					providedFields: Object.keys(context),
				},
			},
		);
	}
}

/**
 * Wrap an agent execution with error handling.
 *
 * Catches errors and wraps non-retriable ones appropriately.
 * Logs all errors for debugging.
 *
 * @param agentName - Name of the agent for error context
 * @param operation - Async operation to execute
 * @returns Result of the operation
 * @throws NonRetriableError for permanent failures
 *
 * @example
 * ```typescript
 * return wrapAgentExecution("qa", async () => {
 *   // Agent logic here
 *   return { agent: "qa", verdict: "PASS" };
 * });
 * ```
 */
export async function wrapAgentExecution<T>(
	agentName: string,
	operation: () => Promise<T>,
): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		// Re-throw if already a NonRetriableError
		if (error instanceof NonRetriableError) {
			throw error;
		}

		// Check if error should be retriable
		if (!isRetriable(error)) {
			throw createNonRetriableError(
				WorkflowErrorType.AGENT_FAILURE,
				`Agent ${agentName} failed with non-retriable error`,
				{ cause: error, context: { agentName } },
			);
		}

		// Log retriable error and re-throw for Inngest retry
		logger.warn(
			{
				agentName,
				error: serializeError(error),
			},
			"Agent encountered retriable error",
		);

		throw error;
	}
}

/**
 * Serialize an error for logging and transmission.
 *
 * @param error - Error to serialize
 * @returns Serialized error object
 */
function serializeError(error: unknown): Record<string, unknown> {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
		};
	}

	if (typeof error === "object" && error !== null) {
		return { ...error };
	}

	return { value: String(error) };
}
