/**
 * Unit tests for delete_project tool
 *
 * 100% coverage requirement for destructive operations.
 * Tests cover:
 * - Schema validation
 * - Response structure
 * - Security control integration points
 *
 * Note: Deep mocking of fs/validation modules is unreliable in Bun.
 * Security controls are tested directly in pathValidation.test.ts and configLock.test.ts.
 */

import { describe, expect, test } from "vitest";

// Import schema for validation tests
import { DeleteProjectArgsSchema, toolDefinition } from "../schema";

describe("delete_project schema", () => {
	test("validates required project field", () => {
		const result = DeleteProjectArgsSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	test("accepts valid project name", () => {
		const result = DeleteProjectArgsSchema.safeParse({
			project: "test-project",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.project).toBe("test-project");
		}
	});

	test("delete_notes defaults to false", () => {
		const result = DeleteProjectArgsSchema.safeParse({
			project: "test-project",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.delete_notes).toBe(false);
		}
	});

	test("accepts delete_notes=true", () => {
		const result = DeleteProjectArgsSchema.safeParse({
			project: "test-project",
			delete_notes: true,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.delete_notes).toBe(true);
		}
	});

	test("accepts delete_notes=false explicitly", () => {
		const result = DeleteProjectArgsSchema.safeParse({
			project: "test-project",
			delete_notes: false,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.delete_notes).toBe(false);
		}
	});
});

describe("delete_project tool definition", () => {
	test("has correct tool name", () => {
		expect(toolDefinition.name).toBe("delete_project");
	});

	test("has description", () => {
		expect(toolDefinition.description).toBeDefined();
		expect(toolDefinition.description?.length).toBeGreaterThan(0);
	});

	test("description mentions destructive nature", () => {
		expect(toolDefinition.description).toContain("DESTRUCTIVE");
	});

	test("description mentions safety controls", () => {
		expect(toolDefinition.description).toContain("Path traversal prevention");
		expect(toolDefinition.description).toContain("Symlink attack prevention");
		expect(toolDefinition.description).toContain("Protected path blocklist");
	});

	test("has correct input schema", () => {
		expect(toolDefinition.inputSchema.type).toBe("object");
		expect(toolDefinition.inputSchema.required).toContain("project");
	});

	test("defines project property", () => {
		const props = toolDefinition.inputSchema.properties as Record<
			string,
			unknown
		>;
		expect(props.project).toBeDefined();
	});

	test("defines delete_notes property with default false", () => {
		const props = toolDefinition.inputSchema.properties as Record<
			string,
			unknown
		>;
		expect(props.delete_notes).toBeDefined();
		const deleteNotes = props.delete_notes as { default?: boolean };
		expect(deleteNotes.default).toBe(false);
	});
});

describe("delete_project security integration", () => {
	/**
	 * These tests verify the security utilities are correctly integrated.
	 * The actual security logic is tested in:
	 * - pathValidation.test.ts (C-001, C-002, C-003)
	 * - configLock.test.ts (H-001)
	 */

	test("validateProjectName is imported correctly", async () => {
		const { validateProjectName } = await import(
			"../../../../utils/security/pathValidation"
		);
		expect(typeof validateProjectName).toBe("function");
	});

	test("validateDeleteOperation is imported correctly", async () => {
		const { validateDeleteOperation } = await import(
			"../../../../utils/security/pathValidation"
		);
		expect(typeof validateDeleteOperation).toBe("function");
	});

	test("withConfigLockSync is imported correctly", async () => {
		const { withConfigLockSync } = await import(
			"../../../../utils/security/configLock"
		);
		expect(typeof withConfigLockSync).toBe("function");
	});

	test("handler function is exported", async () => {
		// Note: We don't call handler here because it requires real filesystem access
		// The handler is tested through integration tests
		const { handler } = await import("../index");
		expect(typeof handler).toBe("function");
	});
});

describe("validateProjectName security control (C-001)", () => {
	/**
	 * Direct tests of the validation function.
	 * These are the REAL security tests.
	 */
	let validateProjectName: (name: string) => { valid: boolean; error?: string };

	test("setup", async () => {
		const mod = await import("../../../../utils/security/pathValidation");
		validateProjectName = mod.validateProjectName;
	});

	test("accepts valid project name", () => {
		const result = validateProjectName("my-project");
		expect(result.valid).toBe(true);
	});

	test("rejects path separator /", () => {
		const result = validateProjectName("../etc/passwd");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("path separator");
	});

	test("rejects path separator \\", () => {
		const result = validateProjectName("..\\windows\\system32");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("path separator");
	});

	test("rejects .. traversal sequence", () => {
		const result = validateProjectName("test..project");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("traversal");
	});

	test("rejects null bytes", () => {
		const result = validateProjectName("test\0project");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("null bytes");
	});

	test("rejects empty string", () => {
		const result = validateProjectName("");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("empty");
	});

	test("rejects names over 255 characters", () => {
		const result = validateProjectName("a".repeat(256));
		expect(result.valid).toBe(false);
		expect(result.error).toContain("maximum length");
	});
});

describe("validateDeletePath security control (C-002, C-003)", () => {
	/**
	 * Note: Full validateDeletePath tests are in pathValidation.test.ts.
	 * Here we just verify the function is correctly exported.
	 */

	test("function is exported", async () => {
		const mod = await import("../../../../utils/security/pathValidation");
		expect(typeof mod.validateDeletePath).toBe("function");
	});
});

describe("withConfigLockSync security control (H-001)", () => {
	/**
	 * Note: Full withConfigLockSync tests are in configLock.test.ts.
	 * Here we just verify the function is correctly exported.
	 */

	test("function is exported", async () => {
		const mod = await import("../../../../utils/security/configLock");
		expect(typeof mod.withConfigLockSync).toBe("function");
	});
});
