/**
 * Unit tests for pathValidation security utilities
 *
 * Tests CWE-22 (Path Traversal) and CWE-59 (Symlink Attack) prevention.
 */

import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";

// vi.mock must use inline factory - cannot reference top-level variables
vi.mock("fs", () => ({
	existsSync: vi.fn(() => true),
	realpathSync: vi.fn((p: unknown) => String(p)),
	lstatSync: vi.fn(() => ({ isSymbolicLink: () => false })),
}));

import * as fs from "node:fs";
import {
	isSymlink,
	validateDeleteOperation,
	validateDeletePath,
	validateProjectName,
} from "../pathValidation";

// Type-safe reference to mocked fs
const mockFs = vi.mocked(fs);

describe("validateProjectName", () => {
	test("accepts valid project name", () => {
		const result = validateProjectName("my-project");
		expect(result.valid).toBe(true);
	});

	test("accepts project name with dots", () => {
		const result = validateProjectName("my.project.name");
		expect(result.valid).toBe(true);
	});

	test("accepts project name with underscores", () => {
		const result = validateProjectName("my_project_name");
		expect(result.valid).toBe(true);
	});

	test("rejects empty string", () => {
		const result = validateProjectName("");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("empty");
	});

	test("rejects name exceeding 255 characters", () => {
		const longName = "a".repeat(256);
		const result = validateProjectName(longName);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("maximum length");
	});

	test("rejects name with forward slash", () => {
		const result = validateProjectName("path/to/project");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("path separators");
	});

	test("rejects name with backslash", () => {
		const result = validateProjectName("path\\to\\project");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("path separators");
	});

	test("rejects name with double dot traversal", () => {
		const result = validateProjectName("..project");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("traversal");
	});

	test("rejects name with embedded double dots", () => {
		const result = validateProjectName("path..name");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("traversal");
	});

	test("rejects name with null byte", () => {
		const result = validateProjectName("project\0name");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("null bytes");
	});
});

describe("validateDeletePath", () => {
	const homeDir = os.homedir();

	beforeEach(() => {
		mockFs.existsSync.mockReset();
		mockFs.realpathSync.mockReset();
		mockFs.existsSync.mockReturnValue(true);
		mockFs.realpathSync.mockImplementation((p: unknown) => String(p));
	});

	test("accepts valid path under home directory", () => {
		const validPath = path.join(homeDir, "memories", "project");
		const result = validateDeletePath(validPath);
		expect(result.valid).toBe(true);
		expect(result.resolvedPath).toBe(validPath);
	});

	test("rejects non-existent path", () => {
		mockFs.existsSync.mockReturnValue(false);
		const result = validateDeletePath("/nonexistent/path");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("does not exist");
	});

	test("rejects root filesystem", () => {
		const result = validateDeletePath("/");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("root filesystem");
	});

	test("rejects home directory itself", () => {
		const result = validateDeletePath(homeDir);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("home directory");
	});

	test("rejects ~/.ssh", () => {
		const sshPath = path.join(homeDir, ".ssh");
		const result = validateDeletePath(sshPath);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("protected path");
	});

	test("rejects subdirectory of ~/.ssh", () => {
		const subPath = path.join(homeDir, ".ssh", "keys");
		const result = validateDeletePath(subPath);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("protected path");
	});

	test("rejects ~/.aws (cloud credentials)", () => {
		const awsPath = path.join(homeDir, ".aws");
		const result = validateDeletePath(awsPath);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("protected path");
	});

	test("rejects ~/.kube (kubernetes config)", () => {
		const kubePath = path.join(homeDir, ".kube");
		const result = validateDeletePath(kubePath);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("protected path");
	});

	test("rejects ~/Documents", () => {
		const docsPath = path.join(homeDir, "Documents");
		const result = validateDeletePath(docsPath);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("protected path");
	});

	test("rejects ~/Desktop", () => {
		const desktopPath = path.join(homeDir, "Desktop");
		const result = validateDeletePath(desktopPath);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("protected path");
	});

	test("rejects ~/Downloads", () => {
		const downloadsPath = path.join(homeDir, "Downloads");
		const result = validateDeletePath(downloadsPath);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("protected path");
	});

	test("rejects /etc system path", () => {
		const result = validateDeletePath("/etc");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("system path");
	});

	test("rejects /etc/passwd", () => {
		const result = validateDeletePath("/etc/passwd");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("system path");
	});

	test("rejects /usr system path", () => {
		const result = validateDeletePath("/usr");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("system path");
	});

	test("rejects /System (macOS)", () => {
		const result = validateDeletePath("/System");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("system path");
	});

	test("resolves symlinks before validation", () => {
		const symlinkPath = path.join(homeDir, "memories", "symlink");
		mockFs.realpathSync.mockImplementation((p: unknown) => {
			if (String(p) === symlinkPath) return "/etc";
			return String(p);
		});

		const result = validateDeletePath(symlinkPath);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("system path");
	});

	test("handles realpathSync failure gracefully", () => {
		mockFs.realpathSync.mockImplementation(() => {
			throw new Error("Permission denied");
		});

		const result = validateDeletePath("/some/path");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Failed to resolve");
	});
});

describe("validateDeleteOperation", () => {
	const homeDir = os.homedir();

	beforeEach(() => {
		mockFs.existsSync.mockReset();
		mockFs.realpathSync.mockReset();
		mockFs.existsSync.mockReturnValue(true);
		mockFs.realpathSync.mockImplementation((p: unknown) => String(p));
	});

	test("validates both project name and path when delete_notes=true", () => {
		const notesPath = path.join(homeDir, "memories", "project");
		const result = validateDeleteOperation("valid-project", notesPath, true);
		expect(result.valid).toBe(true);
		expect(result.resolvedPath).toBe(notesPath);
	});

	test("only validates project name when delete_notes=false", () => {
		// Path validation is skipped when delete_notes=false
		const result = validateDeleteOperation("valid-project", "/etc", false);
		expect(result.valid).toBe(true);
	});

	test("fails on invalid project name regardless of delete_notes", () => {
		const result = validateDeleteOperation("../invalid", null, false);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("path separator");
	});

	test("handles null notes path", () => {
		const result = validateDeleteOperation("valid-project", null, true);
		expect(result.valid).toBe(true);
	});

	test("handles undefined notes path", () => {
		const result = validateDeleteOperation("valid-project", undefined, true);
		expect(result.valid).toBe(true);
	});
});

describe("isSymlink", () => {
	beforeEach(() => {
		mockFs.lstatSync.mockReset();
	});

	test("returns true for symlinks", () => {
		mockFs.lstatSync.mockReturnValue({ isSymbolicLink: () => true });
		expect(isSymlink("/some/link")).toBe(true);
	});

	test("returns false for regular files", () => {
		mockFs.lstatSync.mockReturnValue({ isSymbolicLink: () => false });
		expect(isSymlink("/some/file")).toBe(false);
	});

	test("returns false when lstatSync throws", () => {
		mockFs.lstatSync.mockImplementation(() => {
			throw new Error("Not found");
		});
		expect(isSymlink("/nonexistent")).toBe(false);
	});
});
