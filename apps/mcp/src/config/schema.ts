/**
 * Brain Configuration Schema
 *
 * TypeScript types and validation for Brain's global configuration at ~/.config/brain/config.json.
 * This module re-exports types from @brain/validation which uses JSON Schema + AJV.
 *
 * @see ADR-020 for the configuration architecture decision
 * @see packages/validation/schemas/config/brain-config.schema.json for the canonical schema
 * @see translation-layer.ts for Brain -> basic-memory field mapping
 */

import {
	parseBrainConfig as ajvParse,
	validateBrainConfig as ajvValidate,
	type BrainConfig,
	type DefaultsConfig,
	getBrainConfigErrors,
	type LoggingConfig,
	type ProjectConfig,
	type SyncConfig,
	type ValidationError,
	type WatcherConfig,
} from "@brain/validation";

// Re-export types from @brain/validation
export type {
	BrainConfig,
	ProjectConfig,
	DefaultsConfig,
	SyncConfig,
	LoggingConfig,
	WatcherConfig,
};

/**
 * Memories mode determines where project memories are stored.
 *
 * - DEFAULT: ${memories_location}/${project_name}
 * - CODE: ${code_path}/docs
 * - CUSTOM: Explicit memories_path value
 */
export type MemoriesMode = "DEFAULT" | "CODE" | "CUSTOM";

/**
 * Log level for Brain operations.
 */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

/**
 * Validation result from validation operations.
 */
export interface ValidationResult<T> {
	success: boolean;
	data?: T;
	errors?: ValidationError[];
}

/**
 * Validate a Brain configuration object using JSON Schema + AJV.
 *
 * Returns a result object with success status and either parsed data or error details.
 * Use this instead of parse() when you need to handle validation errors gracefully.
 *
 * @param config - The configuration object to validate
 * @returns ValidationResult with success status and data or errors
 *
 * @example
 * ```typescript
 * const result = validateBrainConfig(unknownConfig);
 * if (result.success) {
 *   console.log("Valid config:", result.data);
 * } else {
 *   console.error("Invalid config:", result.errors);
 * }
 * ```
 */
export function validateBrainConfig(
	config: unknown,
): ValidationResult<BrainConfig> {
	// Deep clone to avoid mutating input
	const cloned =
		typeof config === "object" && config !== null
			? JSON.parse(JSON.stringify(config))
			: config;

	if (ajvValidate(cloned)) {
		return { success: true, data: cloned as BrainConfig };
	}

	const errors = getBrainConfigErrors(config);
	return { success: false, errors };
}

/**
 * Validate a single project configuration.
 *
 * @param project - The project configuration to validate
 * @returns ValidationResult with success status and data or errors
 */
export function validateProjectConfig(
	project: unknown,
): ValidationResult<ProjectConfig> {
	// Project validation is a subset - validate required fields
	if (typeof project !== "object" || project === null) {
		return {
			success: false,
			errors: [
				{
					field: "",
					constraint: "type",
					message: "Expected object",
				},
			],
		};
	}

	const p = project as Record<string, unknown>;

	if (typeof p.code_path !== "string" || p.code_path.length === 0) {
		return {
			success: false,
			errors: [
				{
					field: "/code_path",
					constraint: "required",
					message: "code_path is required",
				},
			],
		};
	}

	if (p.memories_mode !== undefined) {
		const validModes = ["DEFAULT", "CODE", "CUSTOM"];
		if (!validModes.includes(p.memories_mode as string)) {
			return {
				success: false,
				errors: [
					{
						field: "/memories_mode",
						constraint: "enum",
						message: `memories_mode must be one of: ${validModes.join(", ")}`,
					},
				],
			};
		}
	}

	return { success: true, data: project as ProjectConfig };
}

/**
 * Parse and validate Brain configuration.
 * Throws Error with structured message on validation failure.
 *
 * @param config - The configuration object to validate
 * @returns Validated BrainConfig
 * @throws Error if validation fails
 */
export function parseBrainConfig(config: unknown): BrainConfig {
	return ajvParse(config);
}

/**
 * Default Brain configuration for new installations.
 *
 * Used when no config file exists or when resetting to defaults.
 */
export const DEFAULT_BRAIN_CONFIG: BrainConfig = {
	$schema: "https://brain.dev/schemas/config-v2.json",
	version: "2.0.0",
	defaults: {
		memories_location: "~/memories",
		memories_mode: "DEFAULT",
	},
	projects: {},
	sync: {
		enabled: true,
		delay_ms: 500,
	},
	logging: {
		level: "info",
	},
	watcher: {
		enabled: true,
		debounce_ms: 2000,
	},
};
