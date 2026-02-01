/**
 * Unit tests for similarity utilities
 */

import { describe, expect, test } from "bun:test";
import { levenshteinDistance, similarity } from "../similarity";

describe("levenshteinDistance", () => {
	test("returns 0 for identical strings", () => {
		expect(levenshteinDistance("hello", "hello")).toBe(0);
		expect(levenshteinDistance("", "")).toBe(0);
	});

	test("calculates distance for single character difference", () => {
		expect(levenshteinDistance("hello", "hallo")).toBe(1);
		expect(levenshteinDistance("cat", "bat")).toBe(1);
	});

	test("calculates distance for completely different strings", () => {
		expect(levenshteinDistance("abc", "xyz")).toBe(3);
		expect(levenshteinDistance("hello", "world")).toBe(4);
	});

	test("handles empty strings", () => {
		expect(levenshteinDistance("", "hello")).toBe(5);
		expect(levenshteinDistance("hello", "")).toBe(5);
	});

	test("handles strings of different lengths", () => {
		expect(levenshteinDistance("hello", "helloworld")).toBe(5);
		expect(levenshteinDistance("short", "verylongstring")).toBe(12);
	});

	test("is case-sensitive", () => {
		expect(levenshteinDistance("Hello", "hello")).toBe(1);
		expect(levenshteinDistance("ABC", "abc")).toBe(3);
	});
});

describe("similarity", () => {
	test("returns 1 for identical strings", () => {
		expect(similarity("hello", "hello")).toBe(1);
		expect(similarity("test", "test")).toBe(1);
	});

	test("returns 1 when both strings are empty", () => {
		expect(similarity("", "")).toBe(1);
	});

	test("returns 0 for completely different strings of same length", () => {
		expect(similarity("abc", "xyz")).toBe(0);
	});

	test("returns approximately 0 for completely different strings", () => {
		const score = similarity("hello", "world");
		expect(score).toBeLessThan(0.3);
		expect(score).toBeGreaterThanOrEqual(0);
	});

	test("calculates partial similarity correctly", () => {
		// "kitten" vs "sitting" has distance of 3, maxLength 7
		// similarity = 1 - (3 / 7) ≈ 0.571
		const score = similarity("kitten", "sitting");
		expect(score).toBeCloseTo(0.571, 2);
	});

	test("handles empty string comparisons", () => {
		expect(similarity("", "hello")).toBe(0);
		expect(similarity("hello", "")).toBe(0);
	});

	test("is normalized between 0 and 1", () => {
		const testCases = [
			["hello", "hallo"],
			["test", "testing"],
			["abc", "xyz"],
			["similar", "similarity"],
		];

		testCases.forEach(([str1, str2]) => {
			const score = similarity(str1, str2);
			expect(score).toBeGreaterThanOrEqual(0);
			expect(score).toBeLessThanOrEqual(1);
		});
	});

	test("is case-sensitive", () => {
		const lowerScore = similarity("hello", "hello");
		const mixedScore = similarity("Hello", "hello");

		expect(lowerScore).toBe(1);
		expect(mixedScore).toBeLessThan(1);
	});

	test("handles single character changes", () => {
		// 1 character change in 5 character string
		// similarity = 1 - (1 / 5) = 0.8
		expect(similarity("hello", "hallo")).toBe(0.8);
	});
});
