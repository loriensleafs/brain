/**
 * Inngest configuration - LOCAL ONLY.
 *
 * Inngest runs in local dev mode exclusively. No cloud connections.
 * Run `npx inngest-cli@latest dev` to start the local Inngest dev server.
 *
 * Schema: packages/validation/schemas/config/inngest.schema.json
 * @see ADR-022 for Zod to JSON Schema + AJV migration rationale
 */

import inngestSchema from "@brain/validation/schemas/config/inngest.schema.json";
import Ajv from "ajv";

/**
 * Inngest configuration type - local dev mode only.
 */
export interface InngestConfig {
	/** Always true - local dev mode only */
	dev: true;
}

/**
 * AJV instance with secure configuration.
 */
const ajv = new Ajv({
	allErrors: true,
	useDefaults: true,
	coerceTypes: false,
	strict: true,
});

/**
 * Compiled validator for InngestConfig.
 */
const validateInngestConfig = ajv.compile<InngestConfig>(inngestSchema);

/**
 * Parse and validate Inngest configuration.
 * Returns validated data with defaults applied.
 * Throws Error with structured message on validation failure.
 */
export function parseInngestConfig(data: unknown): InngestConfig {
	const cloned = typeof data === "object" && data !== null ? { ...data } : data;

	if (validateInngestConfig(cloned)) {
		return cloned;
	}

	const errors = validateInngestConfig.errors ?? [];
	const message = errors
		.map((e) => `${e.instancePath || "root"}: ${e.message} (${e.keyword})`)
		.join("; ");
	throw new Error(message || "Validation failed");
}

/**
 * Inngest configuration - always local dev mode.
 */
export const inngestConfig: InngestConfig = {
	dev: true,
};
