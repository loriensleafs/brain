/**
 * Integration tests for Session Service
 *
 * Tests:
 * - createDefaultSessionState factory
 * - getSession/setSession operations
 * - Mode changes and history tracking
 * - Serialization/deserialization
 * - Immutable state helpers
 */

import { describe, expect, test } from "vitest";
import {
	DEFAULT_MODE,
	deserializeSessionState,
	getRecentModeHistory,
	MODE_DESCRIPTIONS,
	serializeSessionState,
	withFeatureChange,
	withModeChange,
	withTaskChange,
} from "../index";
import { createDefaultSessionState } from "../types";

describe("Session Service", () => {
	describe("createDefaultSessionState", () => {
		test("creates state with analysis mode as default", () => {
			const state = createDefaultSessionState();

			expect(state.currentMode).toBe(DEFAULT_MODE);
			expect(state.currentMode).toBe("analysis");
			expect(state.modeHistory).toHaveLength(1);
			expect(state.modeHistory[0].mode).toBe("analysis");
			expect(state.activeFeature).toBeUndefined();
			expect(state.activeTask).toBeUndefined();
			expect(state.updatedAt).toBeDefined();
		});

		test("mode history includes initial entry with timestamp", () => {
			const before = new Date().toISOString();
			const state = createDefaultSessionState();
			const after = new Date().toISOString();

			expect(state.modeHistory).toHaveLength(1);
			expect(state.modeHistory[0].mode).toBe("analysis");
			expect(state.modeHistory[0].timestamp >= before).toBe(true);
			expect(state.modeHistory[0].timestamp <= after).toBe(true);
		});

		test("creates state with version 1", () => {
			const state = createDefaultSessionState();
			expect(state.version).toBe(1);
		});

		test("creates state with createdAt timestamp", () => {
			const before = new Date().toISOString();
			const state = createDefaultSessionState();
			const after = new Date().toISOString();

			expect(state.createdAt >= before).toBe(true);
			expect(state.createdAt <= after).toBe(true);
		});
	});

	describe("Immutable State Helpers", () => {
		test("withModeChange creates new state object", () => {
			const original = createDefaultSessionState();
			const updated = withModeChange(original, "coding");

			expect(original).not.toBe(updated);
			expect(original.currentMode).toBe("analysis");
			expect(updated.currentMode).toBe("coding");
		});

		test("withModeChange adds to history", () => {
			const original = createDefaultSessionState();
			const updated = withModeChange(original, "coding");

			expect(updated.modeHistory).toHaveLength(2);
			expect(updated.modeHistory[1].mode).toBe("coding");
		});

		test("withFeatureChange creates new state with cleared task", () => {
			let state = createDefaultSessionState();
			state = withTaskChange(state, "Task 1");
			state = withFeatureChange(state, "new-feature");

			expect(state.activeFeature).toBe("new-feature");
			expect(state.activeTask).toBeUndefined();
		});

		test("withTaskChange creates new state with task", () => {
			const original = createDefaultSessionState();
			const updated = withTaskChange(original, "New Task");

			expect(original).not.toBe(updated);
			expect(original.activeTask).toBeUndefined();
			expect(updated.activeTask).toBe("New Task");
		});
	});

	describe("Serialization", () => {
		test("serializeSessionState produces valid JSON", () => {
			const state = createDefaultSessionState();
			const json = serializeSessionState(state);

			expect(() => JSON.parse(json)).not.toThrow();

			const parsed = JSON.parse(json);
			expect(parsed.currentMode).toBe("analysis");
		});

		test("deserializeSessionState parses valid JSON", () => {
			const original = createDefaultSessionState();
			original.activeFeature = "feature-x";
			original.activeTask = "task-y";

			const json = serializeSessionState(original);
			const restored = deserializeSessionState(json);

			expect(restored).not.toBeNull();
			expect(restored?.currentMode).toBe(original.currentMode);
			expect(restored?.activeFeature).toBe("feature-x");
			expect(restored?.activeTask).toBe("task-y");
		});

		test("deserializeSessionState returns null for invalid JSON", () => {
			const result = deserializeSessionState("not valid json");

			expect(result).toBeNull();
		});

		test("deserializeSessionState returns null for invalid structure", () => {
			const invalidStructures = [
				JSON.stringify({ foo: "bar" }), // Missing required fields
				JSON.stringify({ currentMode: 123 }), // Wrong type for mode
				JSON.stringify({ currentMode: "analysis" }), // Missing modeHistory
			];

			for (const json of invalidStructures) {
				const result = deserializeSessionState(json);
				expect(result).toBeNull();
			}
		});
	});

	describe("getRecentModeHistory", () => {
		test("returns last N entries", () => {
			let state = createDefaultSessionState();

			// Add more history entries
			state = withModeChange(state, "planning");
			state = withModeChange(state, "coding");
			state = withModeChange(state, "analysis");
			state = withModeChange(state, "planning");
			state = withModeChange(state, "coding");
			state = withModeChange(state, "disabled");

			const recent = getRecentModeHistory(state, 3);

			expect(recent).toHaveLength(3);
			// History: analysis, planning, coding, analysis, planning, coding, disabled
			// Last 3: planning, coding, disabled
			expect(recent.map((h: { mode: string }) => h.mode)).toEqual([
				"planning",
				"coding",
				"disabled",
			] as const);
		});

		test("returns all entries if fewer than count", () => {
			const state = createDefaultSessionState();
			const recent = getRecentModeHistory(state, 5);

			expect(recent).toHaveLength(1);
			expect(recent[0].mode).toBe("analysis");
		});
	});

	describe("MODE_DESCRIPTIONS", () => {
		test("has descriptions for all modes", () => {
			expect(MODE_DESCRIPTIONS.analysis).toBeDefined();
			expect(MODE_DESCRIPTIONS.planning).toBeDefined();
			expect(MODE_DESCRIPTIONS.coding).toBeDefined();
			expect(MODE_DESCRIPTIONS.disabled).toBeDefined();

			// Verify they are non-empty strings
			expect(MODE_DESCRIPTIONS.analysis.length).toBeGreaterThan(0);
			expect(MODE_DESCRIPTIONS.planning.length).toBeGreaterThan(0);
			expect(MODE_DESCRIPTIONS.coding.length).toBeGreaterThan(0);
			expect(MODE_DESCRIPTIONS.disabled.length).toBeGreaterThan(0);
		});
	});

	describe("Session State Fields", () => {
		test("default state has all required fields", () => {
			const state = createDefaultSessionState();

			expect(state).toHaveProperty("currentMode");
			expect(state).toHaveProperty("modeHistory");
			expect(state).toHaveProperty("protocolStartComplete");
			expect(state).toHaveProperty("protocolEndComplete");
			expect(state).toHaveProperty("protocolStartEvidence");
			expect(state).toHaveProperty("protocolEndEvidence");
			expect(state).toHaveProperty("orchestratorWorkflow");
			expect(state).toHaveProperty("version");
			expect(state).toHaveProperty("createdAt");
			expect(state).toHaveProperty("updatedAt");
		});

		test("protocol fields initialized correctly", () => {
			const state = createDefaultSessionState();

			expect(state.protocolStartComplete).toBe(false);
			expect(state.protocolEndComplete).toBe(false);
			expect(state.protocolStartEvidence).toEqual({});
			expect(state.protocolEndEvidence).toEqual({});
		});

		test("orchestratorWorkflow is initially null", () => {
			const state = createDefaultSessionState();
			expect(state.orchestratorWorkflow).toBeNull();
		});
	});
});
