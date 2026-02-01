/**
 * Unit tests for copy manifest module.
 *
 * Tests TASK-020-26 requirements:
 * - CopyManifest interface and implementation
 * - Track completed/pending files with checksums
 * - createCopyManifest(): Generate manifest before copy
 * - markEntryCopied(): Update after each file
 * - rollbackPartialCopy(): Remove only copied files
 * - recoverIncompleteMigrations(): Startup recovery
 */

import * as path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Track mock checksum value
let mockChecksumValue = "abc123def456";

// Mock filesystem
const mockFs = {
	existsSync: vi.fn<(p: string) => boolean>(() => false),
	mkdirSync: vi.fn<(p: string, opts: unknown) => void>(() => undefined),
	writeFileSync: vi.fn<(p: string, content: string, opts: unknown) => void>(
		() => undefined,
	),
	readFileSync: vi.fn<(p: string | Buffer, encoding?: string) => string | Buffer>(
		() => Buffer.from("test content"),
	),
	renameSync: vi.fn<(from: string, to: string) => void>(() => undefined),
	unlinkSync: vi.fn<(p: string) => void>(() => undefined),
	rmdirSync: vi.fn<(p: string) => void>(() => undefined),
	readdirSync: vi.fn<(p: string) => string[]>(() => [] as string[]),
	createReadStream: vi.fn(() => {
		// Create a simple event emitter-like object for streams
		const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
		const stream = {
			on: (event: string, handler: (...args: unknown[]) => void) => {
				if (!handlers[event]) handlers[event] = [];
				handlers[event].push(handler);
				// Schedule events
				if (event === "end") {
					setTimeout(() => {
						if (handlers.data) {
							handlers.data.forEach((h) => h(Buffer.from("test")));
						}
						handler();
					}, 1);
				}
				return stream;
			},
		};
		return stream;
	}),
};

vi.mock("fs", () => mockFs);

// Mock crypto with controllable checksum
const mockCrypto = {
	createHash: () => ({
		update: function (this: unknown) {
			return this;
		},
		digest: () => mockChecksumValue,
	}),
	randomBytes: () => Buffer.from("12345678", "hex"),
};

vi.mock("crypto", () => mockCrypto);

// Mock logger
const mockLogger = {
	debug: vi.fn(() => undefined),
	info: vi.fn(() => undefined),
	warn: vi.fn(() => undefined),
	error: vi.fn(() => undefined),
};

vi.mock("../../utils/internal/logger", () => ({
	logger: mockLogger,
}));

import {
	type CopyManifest,
	type CopyManifestEntry,
	computeFileChecksumSync,
	createCopyManifest,
	getFailedEntries,
	getManifestDir,
	getPendingEntries,
	getProgress,
	getStatusCounts,
	isIncomplete,
	markEntryCopied,
	markEntryFailed,
	markManifestCompleted,
	recoverIncompleteMigrations,
	rollbackPartialCopy,
	verifyEntry,
} from "../copy-manifest";

describe("createCopyManifest", () => {
	beforeEach(() => {
		mockFs.existsSync.mockReset();
		mockFs.mkdirSync.mockReset();
		mockFs.writeFileSync.mockReset();
		mockFs.readFileSync.mockReset();
		mockFs.renameSync.mockReset();

		mockFs.existsSync.mockReturnValue(false);
		mockChecksumValue = "abc123def456";

		// Mock readFileSync to return valid JSON for verification
		mockFs.readFileSync.mockImplementation((p: unknown) => {
			if (typeof p === "string" && p.endsWith(".tmp")) {
				return JSON.stringify({ migrationId: "test" });
			}
			return Buffer.from("test content");
		});
	});

	test("creates manifest with all entries as pending", async () => {
		const manifest = await createCopyManifest(
			"test-project",
			"/source",
			"/target",
			["file1.md", "file2.md"],
		);

		expect(manifest.project).toBe("test-project");
		expect(manifest.sourceRoot).toBe("/source");
		expect(manifest.targetRoot).toBe("/target");
		expect(manifest.entries.length).toBe(2);
		expect(manifest.entries[0].status).toBe("pending");
		expect(manifest.entries[1].status).toBe("pending");
		expect(manifest.completedAt).toBeNull();
	});

	test("generates unique migration ID", async () => {
		const manifest1 = await createCopyManifest("test", "/src", "/dst", [
			"a.md",
		]);

		expect(manifest1.migrationId).toContain("migration-");
	});

	test("saves manifest to disk", async () => {
		await createCopyManifest("test", "/source", "/target", ["file.md"]);

		expect(mockFs.writeFileSync).toHaveBeenCalled();
		expect(mockFs.renameSync).toHaveBeenCalled();
	});

	test("sets correct paths for entries", async () => {
		const manifest = await createCopyManifest(
			"test",
			"/source/root",
			"/target/root",
			["docs/file.md"],
		);

		expect(manifest.entries[0].sourcePath).toBe(
			path.join("/source/root", "docs/file.md"),
		);
		expect(manifest.entries[0].targetPath).toBe(
			path.join("/target/root", "docs/file.md"),
		);
	});
});

describe("markEntryCopied", () => {
	let manifest: CopyManifest;
	let entry: CopyManifestEntry;

	beforeEach(() => {
		mockFs.existsSync.mockReset();
		mockFs.writeFileSync.mockReset();
		mockFs.readFileSync.mockReset();
		mockFs.renameSync.mockReset();

		mockFs.existsSync.mockReturnValue(false);
		mockChecksumValue = "targetChecksum123";
		mockFs.readFileSync.mockReturnValue(
			JSON.stringify({ migrationId: "test" }),
		);

		manifest = {
			migrationId: "test-migration",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date(),
			completedAt: null,
			entries: [],
		};

		entry = {
			sourcePath: "/source/file.md",
			targetPath: "/target/file.md",
			sourceChecksum: "sourceChecksum123",
			targetChecksum: null,
			status: "pending",
			copiedAt: null,
			error: null,
		};

		manifest.entries.push(entry);
	});

	test("saves manifest after update", async () => {
		await markEntryCopied(manifest, entry);

		expect(mockFs.writeFileSync).toHaveBeenCalled();
	});
});

describe("verifyEntry", () => {
	let manifest: CopyManifest;
	let entry: CopyManifestEntry;

	beforeEach(() => {
		mockFs.existsSync.mockReset();
		mockFs.writeFileSync.mockReset();
		mockFs.readFileSync.mockReset();
		mockFs.renameSync.mockReset();

		mockFs.existsSync.mockReturnValue(false);
		mockFs.readFileSync.mockReturnValue(
			JSON.stringify({ migrationId: "test" }),
		);

		manifest = {
			migrationId: "test-migration",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date(),
			completedAt: null,
			entries: [],
		};

		entry = {
			sourcePath: "/source/file.md",
			targetPath: "/target/file.md",
			sourceChecksum: "matchingChecksum",
			targetChecksum: "matchingChecksum",
			status: "copied",
			copiedAt: new Date(),
			error: null,
		};

		manifest.entries.push(entry);
	});

	test("returns false for non-copied entries", async () => {
		entry.status = "pending";

		const result = await verifyEntry(manifest, entry);

		expect(result).toBe(false);
	});
});

describe("markEntryFailed", () => {
	beforeEach(() => {
		mockFs.existsSync.mockReset();
		mockFs.writeFileSync.mockReset();
		mockFs.readFileSync.mockReset();
		mockFs.renameSync.mockReset();

		mockFs.existsSync.mockReturnValue(false);
		mockFs.readFileSync.mockReturnValue(
			JSON.stringify({ migrationId: "test" }),
		);
	});

	test("updates entry status and error", () => {
		const manifest: CopyManifest = {
			migrationId: "test",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date(),
			completedAt: null,
			entries: [
				{
					sourcePath: "/source/file.md",
					targetPath: "/target/file.md",
					sourceChecksum: "abc",
					targetChecksum: null,
					status: "pending",
					copiedAt: null,
					error: null,
				},
			],
		};

		markEntryFailed(manifest, manifest.entries[0], "Copy operation failed");

		expect(manifest.entries[0].status).toBe("failed");
		expect(manifest.entries[0].error).toBe("Copy operation failed");
	});
});

describe("markManifestCompleted", () => {
	beforeEach(() => {
		mockFs.existsSync.mockReset();
		mockFs.writeFileSync.mockReset();
		mockFs.readFileSync.mockReset();
		mockFs.renameSync.mockReset();

		mockFs.existsSync.mockReturnValue(false);
		mockFs.readFileSync.mockReturnValue(
			JSON.stringify({ migrationId: "test" }),
		);
	});

	test("sets completedAt timestamp", () => {
		const manifest: CopyManifest = {
			migrationId: "test",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date(),
			completedAt: null,
			entries: [],
		};

		markManifestCompleted(manifest);

		expect(manifest.completedAt).not.toBeNull();
		expect(manifest.completedAt).toBeInstanceOf(Date);
	});
});

describe("rollbackPartialCopy", () => {
	beforeEach(() => {
		mockFs.existsSync.mockReset();
		mockFs.writeFileSync.mockReset();
		mockFs.readFileSync.mockReset();
		mockFs.renameSync.mockReset();
		mockFs.unlinkSync.mockReset();
		mockFs.rmdirSync.mockReset();
		mockFs.readdirSync.mockReset();
	});

	test("removes only copied files", async () => {
		const manifest: CopyManifest = {
			migrationId: "test",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date(),
			completedAt: null,
			entries: [
				{
					sourcePath: "/source/file1.md",
					targetPath: "/target/file1.md",
					sourceChecksum: "abc",
					targetChecksum: "abc",
					status: "verified",
					copiedAt: new Date(),
					error: null,
				},
				{
					sourcePath: "/source/file2.md",
					targetPath: "/target/file2.md",
					sourceChecksum: "def",
					targetChecksum: null,
					status: "pending",
					copiedAt: null,
					error: null,
				},
				{
					sourcePath: "/source/file3.md",
					targetPath: "/target/file3.md",
					sourceChecksum: "ghi",
					targetChecksum: "ghi",
					status: "copied",
					copiedAt: new Date(),
					error: null,
				},
			],
		};

		mockFs.existsSync.mockReturnValue(true);

		const result = await rollbackPartialCopy(manifest);

		expect(result.filesRolledBack).toBe(2); // verified + copied
		expect(mockFs.unlinkSync).toHaveBeenCalledTimes(3); // 2 files + 1 manifest
	});

	test("does not remove pending files", async () => {
		const manifest: CopyManifest = {
			migrationId: "test",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date(),
			completedAt: null,
			entries: [
				{
					sourcePath: "/source/file.md",
					targetPath: "/target/file.md",
					sourceChecksum: "abc",
					targetChecksum: null,
					status: "pending",
					copiedAt: null,
					error: null,
				},
			],
		};

		const result = await rollbackPartialCopy(manifest);

		expect(result.filesRolledBack).toBe(0);
	});

	test("reports failures for files that cannot be deleted", async () => {
		const manifest: CopyManifest = {
			migrationId: "test",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date(),
			completedAt: null,
			entries: [
				{
					sourcePath: "/source/file.md",
					targetPath: "/target/file.md",
					sourceChecksum: "abc",
					targetChecksum: "abc",
					status: "copied",
					copiedAt: new Date(),
					error: null,
				},
			],
		};

		mockFs.existsSync.mockReturnValue(true);
		mockFs.unlinkSync.mockImplementation(() => {
			throw new Error("Permission denied");
		});

		const result = await rollbackPartialCopy(manifest);

		expect(result.success).toBe(false);
		expect(result.failures.length).toBe(1);
		expect(result.failures[0].error).toContain("Permission denied");
	});

	test("removes empty target directory", async () => {
		const manifest: CopyManifest = {
			migrationId: "test",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date(),
			completedAt: null,
			entries: [],
		};

		mockFs.existsSync.mockReturnValue(true);
		mockFs.readdirSync.mockReturnValue([]);

		await rollbackPartialCopy(manifest);

		expect(mockFs.rmdirSync).toHaveBeenCalledWith("/target");
	});

	test("deletes manifest file after rollback", async () => {
		const manifest: CopyManifest = {
			migrationId: "test-migration",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date(),
			completedAt: null,
			entries: [],
		};

		mockFs.existsSync.mockReturnValue(true);
		mockFs.readdirSync.mockReturnValue(["other-file"]);

		await rollbackPartialCopy(manifest);

		// Manifest should be deleted
		const unlinkCalls = mockFs.unlinkSync.mock.calls;
		const manifestDeleted = unlinkCalls.some((call) =>
			String(call[0]).includes("test-migration"),
		);
		expect(manifestDeleted).toBe(true);
	});
});

describe("recoverIncompleteMigrations", () => {
	beforeEach(() => {
		mockFs.existsSync.mockReset();
		mockFs.writeFileSync.mockReset();
		mockFs.readFileSync.mockReset();
		mockFs.renameSync.mockReset();
		mockFs.unlinkSync.mockReset();
		mockFs.readdirSync.mockReset();
		mockFs.mkdirSync.mockReset();
	});

	test("finds and rolls back incomplete migrations", async () => {
		// List manifests
		mockFs.readdirSync.mockReturnValue(["incomplete.manifest.json"]);
		mockFs.existsSync.mockReturnValue(true);

		// Manifest content - incomplete (no completedAt)
		const incompleteManifest = {
			migrationId: "incomplete",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date().toISOString(),
			completedAt: null,
			entries: [
				{
					sourcePath: "/source/file.md",
					targetPath: "/target/file.md",
					sourceChecksum: "abc",
					targetChecksum: "abc",
					status: "copied",
					copiedAt: new Date().toISOString(),
					error: null,
				},
			],
		};

		mockFs.readFileSync.mockReturnValue(JSON.stringify(incompleteManifest));

		const result = await recoverIncompleteMigrations();

		expect(result.found).toBe(1);
		expect(result.recovered).toBe(1);
		expect(result.failures.length).toBe(0);
	});

	test("skips completed migrations", async () => {
		mockFs.readdirSync.mockReturnValue(["complete.manifest.json"]);
		mockFs.existsSync.mockReturnValue(true);

		const completeManifest = {
			migrationId: "complete",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date().toISOString(),
			completedAt: new Date().toISOString(),
			entries: [
				{
					sourcePath: "/source/file.md",
					targetPath: "/target/file.md",
					sourceChecksum: "abc",
					targetChecksum: "abc",
					status: "verified",
					copiedAt: new Date().toISOString(),
					error: null,
				},
			],
		};

		mockFs.readFileSync.mockReturnValue(JSON.stringify(completeManifest));

		const result = await recoverIncompleteMigrations();

		expect(result.found).toBe(0);
		expect(result.recovered).toBe(0);
	});

	test("reports recovery failures", async () => {
		mockFs.readdirSync.mockReturnValue(["bad.manifest.json"]);
		mockFs.existsSync.mockReturnValue(true);
		mockFs.readFileSync.mockImplementation(() => {
			throw new Error("Read error");
		});

		const result = await recoverIncompleteMigrations();

		// Should continue without crashing
		expect(result.found).toBe(0);
	});
});

describe("isIncomplete", () => {
	test("returns true when completedAt is null", () => {
		const manifest: CopyManifest = {
			migrationId: "test",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date(),
			completedAt: null,
			entries: [],
		};

		expect(isIncomplete(manifest)).toBe(true);
	});

	test("returns true when any entry is not verified", () => {
		const manifest: CopyManifest = {
			migrationId: "test",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date(),
			completedAt: new Date(),
			entries: [
				{
					sourcePath: "/source/a.md",
					targetPath: "/target/a.md",
					sourceChecksum: "abc",
					targetChecksum: "abc",
					status: "verified",
					copiedAt: new Date(),
					error: null,
				},
				{
					sourcePath: "/source/b.md",
					targetPath: "/target/b.md",
					sourceChecksum: "def",
					targetChecksum: null,
					status: "pending",
					copiedAt: null,
					error: null,
				},
			],
		};

		expect(isIncomplete(manifest)).toBe(true);
	});

	test("returns false when all entries are verified and completedAt is set", () => {
		const manifest: CopyManifest = {
			migrationId: "test",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date(),
			completedAt: new Date(),
			entries: [
				{
					sourcePath: "/source/a.md",
					targetPath: "/target/a.md",
					sourceChecksum: "abc",
					targetChecksum: "abc",
					status: "verified",
					copiedAt: new Date(),
					error: null,
				},
			],
		};

		expect(isIncomplete(manifest)).toBe(false);
	});
});

describe("getStatusCounts", () => {
	test("returns correct counts for each status", () => {
		const manifest: CopyManifest = {
			migrationId: "test",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date(),
			completedAt: null,
			entries: [
				{ status: "pending" } as CopyManifestEntry,
				{ status: "pending" } as CopyManifestEntry,
				{ status: "copied" } as CopyManifestEntry,
				{ status: "verified" } as CopyManifestEntry,
				{ status: "verified" } as CopyManifestEntry,
				{ status: "verified" } as CopyManifestEntry,
				{ status: "failed" } as CopyManifestEntry,
			],
		};

		const counts = getStatusCounts(manifest);

		expect(counts.pending).toBe(2);
		expect(counts.copied).toBe(1);
		expect(counts.verified).toBe(3);
		expect(counts.failed).toBe(1);
	});
});

describe("getFailedEntries", () => {
	test("returns only failed entries", () => {
		const manifest: CopyManifest = {
			migrationId: "test",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date(),
			completedAt: null,
			entries: [
				{ status: "verified", sourcePath: "/a" } as CopyManifestEntry,
				{
					status: "failed",
					sourcePath: "/b",
					error: "Error 1",
				} as CopyManifestEntry,
				{
					status: "failed",
					sourcePath: "/c",
					error: "Error 2",
				} as CopyManifestEntry,
			],
		};

		const failed = getFailedEntries(manifest);

		expect(failed.length).toBe(2);
		expect(failed[0].sourcePath).toBe("/b");
		expect(failed[1].sourcePath).toBe("/c");
	});
});

describe("getPendingEntries", () => {
	test("returns only pending entries", () => {
		const manifest: CopyManifest = {
			migrationId: "test",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date(),
			completedAt: null,
			entries: [
				{ status: "pending", sourcePath: "/a" } as CopyManifestEntry,
				{ status: "verified", sourcePath: "/b" } as CopyManifestEntry,
				{ status: "pending", sourcePath: "/c" } as CopyManifestEntry,
			],
		};

		const pending = getPendingEntries(manifest);

		expect(pending.length).toBe(2);
		expect(pending[0].sourcePath).toBe("/a");
		expect(pending[1].sourcePath).toBe("/c");
	});
});

describe("getProgress", () => {
	test("calculates progress correctly", () => {
		const manifest: CopyManifest = {
			migrationId: "test",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date(),
			completedAt: null,
			entries: [
				{ status: "verified" } as CopyManifestEntry,
				{ status: "verified" } as CopyManifestEntry,
				{ status: "copied" } as CopyManifestEntry,
				{ status: "pending" } as CopyManifestEntry,
				{ status: "failed" } as CopyManifestEntry,
			],
		};

		const progress = getProgress(manifest);

		expect(progress.total).toBe(5);
		expect(progress.completed).toBe(3); // 2 verified + 1 copied
		expect(progress.pending).toBe(1);
		expect(progress.failed).toBe(1);
		expect(progress.percentComplete).toBe(60);
	});

	test("handles empty manifest", () => {
		const manifest: CopyManifest = {
			migrationId: "test",
			project: "test",
			sourceRoot: "/source",
			targetRoot: "/target",
			startedAt: new Date(),
			completedAt: null,
			entries: [],
		};

		const progress = getProgress(manifest);

		expect(progress.total).toBe(0);
		expect(progress.percentComplete).toBe(0);
	});
});

describe("getManifestDir", () => {
	test("returns XDG-compliant path", () => {
		const manifestDir = getManifestDir();

		expect(manifestDir).toContain(".config");
		expect(manifestDir).toContain("brain");
		expect(manifestDir).toContain("manifests");
	});
});

describe("computeFileChecksumSync", () => {
	beforeEach(() => {
		mockFs.readFileSync.mockReset();
		mockChecksumValue = "sha256hash123";
	});

	test("computes SHA-256 checksum", () => {
		mockFs.readFileSync.mockReturnValue(Buffer.from("test content"));

		const checksum = computeFileChecksumSync("/path/to/file.md");

		expect(checksum).toBe("sha256hash123");
	});
});
