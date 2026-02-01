/**
 * Unit tests for Config Diff Detection module.
 *
 * Tests TASK-020-23 requirements:
 * - detectConfigDiff(): Compare old vs new config
 * - Identify which fields changed
 * - Determine if migration required
 * - Return structured diff with affected projects
 */

import { describe, expect, test } from "vitest";
import {
	detectConfigDiff,
	detectDetailedConfigDiff,
	getAffectedProjects,
	getDefaultModeAffectedProjects,
	isProjectAffected,
	summarizeConfigDiff,
} from "../diff";
import type { BrainConfig } from "../schema";
import { DEFAULT_BRAIN_CONFIG } from "../schema";

/**
 * Create a test config with specified overrides.
 */
function createTestConfig(overrides: Partial<BrainConfig> = {}): BrainConfig {
	return {
		...DEFAULT_BRAIN_CONFIG,
		...overrides,
		defaults: {
			...DEFAULT_BRAIN_CONFIG.defaults,
			...(overrides.defaults || {}),
		},
		sync: {
			...DEFAULT_BRAIN_CONFIG.sync,
			...(overrides.sync || {}),
		},
		logging: {
			...DEFAULT_BRAIN_CONFIG.logging,
			...(overrides.logging || {}),
		},
		watcher: {
			...DEFAULT_BRAIN_CONFIG.watcher,
			...(overrides.watcher || {}),
		},
		projects: overrides.projects || {},
	};
}

describe("detectConfigDiff", () => {
	describe("project changes", () => {
		test("detects added projects", () => {
			const oldConfig = createTestConfig({
				projects: {},
			});
			const newConfig = createTestConfig({
				projects: {
					"project-a": { code_path: "/dev/a" },
				},
			});

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.projectsAdded).toEqual(["project-a"]);
			expect(diff.projectsRemoved).toEqual([]);
			expect(diff.projectsModified).toEqual([]);
			expect(diff.hasChanges).toBe(true);
			expect(diff.requiresMigration).toBe(true);
		});

		test("detects removed projects", () => {
			const oldConfig = createTestConfig({
				projects: {
					"project-a": { code_path: "/dev/a" },
				},
			});
			const newConfig = createTestConfig({
				projects: {},
			});

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.projectsAdded).toEqual([]);
			expect(diff.projectsRemoved).toEqual(["project-a"]);
			expect(diff.projectsModified).toEqual([]);
			expect(diff.hasChanges).toBe(true);
			expect(diff.requiresMigration).toBe(true);
		});

		test("detects modified projects - code_path change", () => {
			const oldConfig = createTestConfig({
				projects: {
					"project-a": { code_path: "/dev/a" },
				},
			});
			const newConfig = createTestConfig({
				projects: {
					"project-a": { code_path: "/dev/a-new" },
				},
			});

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.projectsAdded).toEqual([]);
			expect(diff.projectsRemoved).toEqual([]);
			expect(diff.projectsModified).toEqual(["project-a"]);
			expect(diff.hasChanges).toBe(true);
			expect(diff.requiresMigration).toBe(true);
		});

		test("detects modified projects - memories_mode change", () => {
			const oldConfig = createTestConfig({
				projects: {
					"project-a": { code_path: "/dev/a", memories_mode: "DEFAULT" },
				},
			});
			const newConfig = createTestConfig({
				projects: {
					"project-a": { code_path: "/dev/a", memories_mode: "CODE" },
				},
			});

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.projectsModified).toEqual(["project-a"]);
			expect(diff.requiresMigration).toBe(true);
		});

		test("detects modified projects - memories_path change", () => {
			const oldConfig = createTestConfig({
				projects: {
					"project-a": {
						code_path: "/dev/a",
						memories_mode: "CUSTOM",
						memories_path: "/custom/path",
					},
				},
			});
			const newConfig = createTestConfig({
				projects: {
					"project-a": {
						code_path: "/dev/a",
						memories_mode: "CUSTOM",
						memories_path: "/custom/path-new",
					},
				},
			});

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.projectsModified).toEqual(["project-a"]);
			expect(diff.requiresMigration).toBe(true);
		});

		test("handles multiple project changes", () => {
			const oldConfig = createTestConfig({
				projects: {
					"project-a": { code_path: "/dev/a" },
					"project-b": { code_path: "/dev/b" },
					"project-c": { code_path: "/dev/c" },
				},
			});
			const newConfig = createTestConfig({
				projects: {
					"project-b": { code_path: "/dev/b-new" },
					"project-c": { code_path: "/dev/c" },
					"project-d": { code_path: "/dev/d" },
				},
			});

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.projectsAdded).toEqual(["project-d"]);
			expect(diff.projectsRemoved).toEqual(["project-a"]);
			expect(diff.projectsModified).toEqual(["project-b"]);
			expect(diff.hasChanges).toBe(true);
		});
	});

	describe("global field changes", () => {
		test("detects defaults.memories_location change", () => {
			const oldConfig = createTestConfig({
				defaults: { memories_location: "~/memories", memories_mode: "DEFAULT" },
			});
			const newConfig = createTestConfig({
				defaults: {
					memories_location: "~/memories-new",
					memories_mode: "DEFAULT",
				},
			});

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.globalFieldsChanged).toContain("defaults");
			expect(diff.hasChanges).toBe(true);
			expect(diff.requiresMigration).toBe(true);
		});

		test("detects defaults.memories_mode change", () => {
			const oldConfig = createTestConfig({
				defaults: { memories_location: "~/memories", memories_mode: "DEFAULT" },
			});
			const newConfig = createTestConfig({
				defaults: { memories_location: "~/memories", memories_mode: "CODE" },
			});

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.globalFieldsChanged).toContain("defaults");
		});

		test("detects sync.enabled change", () => {
			const oldConfig = createTestConfig({
				sync: { enabled: true, delay_ms: 500 },
			});
			const newConfig = createTestConfig({
				sync: { enabled: false, delay_ms: 500 },
			});

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.globalFieldsChanged).toContain("sync");
			expect(diff.hasChanges).toBe(true);
		});

		test("detects sync.delay_ms change", () => {
			const oldConfig = createTestConfig({
				sync: { enabled: true, delay_ms: 500 },
			});
			const newConfig = createTestConfig({
				sync: { enabled: true, delay_ms: 1000 },
			});

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.globalFieldsChanged).toContain("sync");
		});

		test("detects logging.level change", () => {
			const oldConfig = createTestConfig({
				logging: { level: "info" },
			});
			const newConfig = createTestConfig({
				logging: { level: "debug" },
			});

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.globalFieldsChanged).toContain("logging");
			expect(diff.hasChanges).toBe(true);
		});

		test("detects watcher.enabled change", () => {
			const oldConfig = createTestConfig({
				watcher: { enabled: true, debounce_ms: 2000 },
			});
			const newConfig = createTestConfig({
				watcher: { enabled: false, debounce_ms: 2000 },
			});

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.globalFieldsChanged).toContain("watcher");
		});

		test("detects watcher.debounce_ms change", () => {
			const oldConfig = createTestConfig({
				watcher: { enabled: true, debounce_ms: 2000 },
			});
			const newConfig = createTestConfig({
				watcher: { enabled: true, debounce_ms: 3000 },
			});

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.globalFieldsChanged).toContain("watcher");
		});
	});

	describe("identical configs", () => {
		test("returns empty diff for identical configs", () => {
			const config = createTestConfig({
				projects: {
					"project-a": { code_path: "/dev/a" },
				},
			});

			const diff = detectConfigDiff(config, config);

			expect(diff.projectsAdded).toEqual([]);
			expect(diff.projectsRemoved).toEqual([]);
			expect(diff.projectsModified).toEqual([]);
			expect(diff.globalFieldsChanged).toEqual([]);
			expect(diff.hasChanges).toBe(false);
			expect(diff.requiresMigration).toBe(false);
		});

		test("handles empty projects in both configs", () => {
			const oldConfig = createTestConfig({ projects: {} });
			const newConfig = createTestConfig({ projects: {} });

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.hasChanges).toBe(false);
		});
	});

	describe("null oldConfig (initial configuration)", () => {
		test("treats all projects as added when oldConfig is null", () => {
			const newConfig = createTestConfig({
				projects: {
					"project-a": { code_path: "/dev/a" },
					"project-b": { code_path: "/dev/b" },
				},
			});

			const diff = detectConfigDiff(null, newConfig);

			expect(diff.projectsAdded).toEqual(["project-a", "project-b"]);
			expect(diff.projectsRemoved).toEqual([]);
			expect(diff.projectsModified).toEqual([]);
			expect(diff.globalFieldsChanged).toContain("defaults");
			expect(diff.globalFieldsChanged).toContain("sync");
			expect(diff.globalFieldsChanged).toContain("logging");
			expect(diff.globalFieldsChanged).toContain("watcher");
			expect(diff.hasChanges).toBe(true);
			expect(diff.requiresMigration).toBe(true);
		});

		test("handles null oldConfig with empty projects", () => {
			const newConfig = createTestConfig({ projects: {} });

			const diff = detectConfigDiff(null, newConfig);

			expect(diff.projectsAdded).toEqual([]);
			expect(diff.hasChanges).toBe(true);
			expect(diff.requiresMigration).toBe(false);
		});
	});

	describe("requiresMigration flag", () => {
		test("true when projects are added", () => {
			const oldConfig = createTestConfig({ projects: {} });
			const newConfig = createTestConfig({
				projects: { "project-a": { code_path: "/dev/a" } },
			});

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.requiresMigration).toBe(true);
		});

		test("true when projects are removed", () => {
			const oldConfig = createTestConfig({
				projects: { "project-a": { code_path: "/dev/a" } },
			});
			const newConfig = createTestConfig({ projects: {} });

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.requiresMigration).toBe(true);
		});

		test("true when memories_location changes", () => {
			const oldConfig = createTestConfig({
				defaults: { memories_location: "~/memories", memories_mode: "DEFAULT" },
			});
			const newConfig = createTestConfig({
				defaults: {
					memories_location: "~/new-memories",
					memories_mode: "DEFAULT",
				},
			});

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.requiresMigration).toBe(true);
		});

		test("false when only logging changes", () => {
			const oldConfig = createTestConfig({ logging: { level: "info" } });
			const newConfig = createTestConfig({ logging: { level: "debug" } });

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.requiresMigration).toBe(false);
		});

		test("false when only sync settings change", () => {
			const oldConfig = createTestConfig({
				sync: { enabled: true, delay_ms: 500 },
			});
			const newConfig = createTestConfig({
				sync: { enabled: false, delay_ms: 1000 },
			});

			const diff = detectConfigDiff(oldConfig, newConfig);

			expect(diff.requiresMigration).toBe(false);
		});
	});
});

describe("detectDetailedConfigDiff", () => {
	test("includes project field changes for modified projects", () => {
		const oldConfig = createTestConfig({
			projects: {
				"project-a": { code_path: "/dev/a", memories_mode: "DEFAULT" },
			},
		});
		const newConfig = createTestConfig({
			projects: {
				"project-a": {
					code_path: "/dev/a-new",
					memories_mode: "CUSTOM",
					memories_path: "/custom/path",
				},
			},
		});

		const diff = detectDetailedConfigDiff(oldConfig, newConfig);

		expect(diff.projectChanges["project-a"]).toEqual({
			fieldsAdded: ["memories_path"],
			fieldsRemoved: [],
			fieldsModified: ["code_path", "memories_mode"],
		});
	});

	test("includes global field change details", () => {
		const oldConfig = createTestConfig({
			logging: { level: "info" },
			sync: { enabled: true, delay_ms: 500 },
		});
		const newConfig = createTestConfig({
			logging: { level: "debug" },
			sync: { enabled: false, delay_ms: 1000 },
		});

		const diff = detectDetailedConfigDiff(oldConfig, newConfig);

		expect(diff.globalChanges).toContainEqual({
			field: "logging.level",
			oldValue: "info",
			newValue: "debug",
		});
		expect(diff.globalChanges).toContainEqual({
			field: "sync.enabled",
			oldValue: true,
			newValue: false,
		});
		expect(diff.globalChanges).toContainEqual({
			field: "sync.delay_ms",
			oldValue: 500,
			newValue: 1000,
		});
	});
});

describe("getAffectedProjects", () => {
	test("returns all affected project names", () => {
		const oldConfig = createTestConfig({
			projects: {
				"project-a": { code_path: "/dev/a" },
				"project-b": { code_path: "/dev/b" },
			},
		});
		const newConfig = createTestConfig({
			projects: {
				"project-b": { code_path: "/dev/b-new" },
				"project-c": { code_path: "/dev/c" },
			},
		});

		const diff = detectConfigDiff(oldConfig, newConfig);
		const affected = getAffectedProjects(diff);

		expect(affected).toContain("project-a"); // Removed
		expect(affected).toContain("project-b"); // Modified
		expect(affected).toContain("project-c"); // Added
		expect(affected).toHaveLength(3);
	});
});

describe("isProjectAffected", () => {
	test("returns true for added project", () => {
		const oldConfig = createTestConfig({ projects: {} });
		const newConfig = createTestConfig({
			projects: { "project-a": { code_path: "/dev/a" } },
		});

		const diff = detectConfigDiff(oldConfig, newConfig);

		expect(isProjectAffected(diff, "project-a")).toBe(true);
		expect(isProjectAffected(diff, "project-b")).toBe(false);
	});

	test("returns true for removed project", () => {
		const oldConfig = createTestConfig({
			projects: { "project-a": { code_path: "/dev/a" } },
		});
		const newConfig = createTestConfig({ projects: {} });

		const diff = detectConfigDiff(oldConfig, newConfig);

		expect(isProjectAffected(diff, "project-a")).toBe(true);
	});

	test("returns true for modified project", () => {
		const oldConfig = createTestConfig({
			projects: { "project-a": { code_path: "/dev/a" } },
		});
		const newConfig = createTestConfig({
			projects: { "project-a": { code_path: "/dev/a-new" } },
		});

		const diff = detectConfigDiff(oldConfig, newConfig);

		expect(isProjectAffected(diff, "project-a")).toBe(true);
	});
});

describe("getDefaultModeAffectedProjects", () => {
	test("returns projects using DEFAULT mode when memories_location changes", () => {
		const oldConfig = createTestConfig({
			defaults: { memories_location: "~/memories", memories_mode: "DEFAULT" },
			projects: {
				"project-a": { code_path: "/dev/a" }, // DEFAULT (implicit)
				"project-b": { code_path: "/dev/b", memories_mode: "DEFAULT" }, // DEFAULT (explicit)
				"project-c": { code_path: "/dev/c", memories_mode: "CODE" }, // CODE
				"project-d": {
					code_path: "/dev/d",
					memories_mode: "CUSTOM",
					memories_path: "/custom",
				}, // CUSTOM
			},
		});
		const newConfig = createTestConfig({
			defaults: {
				memories_location: "~/memories-new",
				memories_mode: "DEFAULT",
			},
			projects: {
				"project-a": { code_path: "/dev/a" },
				"project-b": { code_path: "/dev/b", memories_mode: "DEFAULT" },
				"project-c": { code_path: "/dev/c", memories_mode: "CODE" },
				"project-d": {
					code_path: "/dev/d",
					memories_mode: "CUSTOM",
					memories_path: "/custom",
				},
			},
		});

		const diff = detectConfigDiff(oldConfig, newConfig);
		const affected = getDefaultModeAffectedProjects(diff, oldConfig, newConfig);

		expect(affected).toContain("project-a");
		expect(affected).toContain("project-b");
		expect(affected).not.toContain("project-c");
		expect(affected).not.toContain("project-d");
	});

	test("returns empty array when memories_location unchanged", () => {
		const oldConfig = createTestConfig({
			defaults: { memories_location: "~/memories", memories_mode: "DEFAULT" },
			projects: {
				"project-a": { code_path: "/dev/a" },
			},
		});
		const newConfig = createTestConfig({
			defaults: { memories_location: "~/memories", memories_mode: "CODE" }, // Only mode changed
			projects: {
				"project-a": { code_path: "/dev/a" },
			},
		});

		const diff = detectConfigDiff(oldConfig, newConfig);
		const affected = getDefaultModeAffectedProjects(diff, oldConfig, newConfig);

		expect(affected).toEqual([]);
	});

	test("returns empty array when oldConfig is null", () => {
		const newConfig = createTestConfig({
			projects: { "project-a": { code_path: "/dev/a" } },
		});

		const diff = detectConfigDiff(null, newConfig);
		const affected = getDefaultModeAffectedProjects(diff, null, newConfig);

		expect(affected).toEqual([]);
	});
});

describe("summarizeConfigDiff", () => {
	test("returns message for no changes", () => {
		const config = createTestConfig();
		const diff = detectConfigDiff(config, config);

		const summary = summarizeConfigDiff(diff);

		expect(summary).toBe("No configuration changes detected.");
	});

	test("includes all change types in summary", () => {
		const oldConfig = createTestConfig({
			projects: {
				"project-a": { code_path: "/dev/a" },
				"project-b": { code_path: "/dev/b" },
			},
			logging: { level: "info" },
		});
		const newConfig = createTestConfig({
			projects: {
				"project-b": { code_path: "/dev/b-new" },
				"project-c": { code_path: "/dev/c" },
			},
			logging: { level: "debug" },
		});

		const diff = detectConfigDiff(oldConfig, newConfig);
		const summary = summarizeConfigDiff(diff);

		expect(summary).toContain("Projects added: project-c");
		expect(summary).toContain("Projects removed: project-a");
		expect(summary).toContain("Projects modified: project-b");
		expect(summary).toContain("Global settings changed: logging");
		expect(summary).toContain("Migration required: Yes");
	});
});
