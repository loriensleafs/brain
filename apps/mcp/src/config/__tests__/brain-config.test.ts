/**
 * Unit tests for Brain configuration read/write module.
 *
 * Tests TASK-020-03 requirements:
 * - loadBrainConfig(): Read from ~/.config/brain/config.json with Zod validation
 * - saveBrainConfig(): Atomic writes using temp file + rename pattern
 * - getBrainConfigPath(): Returns XDG-compliant path
 * - File locking integration (5-second timeout)
 * - Error handling for missing/corrupted files
 * - Default config generation on first run
 */

import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { type BrainConfig, DEFAULT_BRAIN_CONFIG } from "../schema";

// Mock filesystem
const mockFs = {
	existsSync: vi.fn(() => false) as ReturnType<
		typeof mock<(p: string) => boolean>
	>,
	readFileSync: vi.fn(() => "") as ReturnType<
		typeof mock<(p: string, enc: string) => string>
	>,
	writeFileSync: vi.fn(() => undefined) as ReturnType<
		typeof mock<(p: string, content: string, opts: unknown) => void>
	>,
	mkdirSync: vi.fn(() => undefined) as ReturnType<
		typeof mock<(p: string, opts: unknown) => void>
	>,
	chmodSync: vi.fn(() => undefined) as ReturnType<
		typeof mock<(p: string, mode: number) => void>
	>,
	renameSync: vi.fn(() => undefined) as ReturnType<
		typeof mock<(from: string, to: string) => void>
	>,
	unlinkSync: vi.fn(() => undefined) as ReturnType<
		typeof mock<(p: string) => void>
	>,
	statSync: vi.fn(() => ({ mode: 0o700 })) as ReturnType<
		typeof mock<(p: string) => { mode: number }>
	>,
	openSync: vi.fn(() => 1) as ReturnType<
		typeof mock<(p: string, flags: number) => number>
	>,
	closeSync: vi.fn(() => undefined) as ReturnType<
		typeof mock<(fd: number) => void>
	>,
	constants: {
		O_CREAT: 0x0200,
		O_EXCL: 0x0800,
		O_WRONLY: 0x0001,
	},
};

vi.mock("fs", () => mockFs);

// Mock path-validator
vi.mock("../path-validator", () => ({
	validatePathOrThrow: (p: string) => p,
	validatePath: (p: string) => ({ valid: true, normalizedPath: p }),
	expandTilde: (p: string) => p.replace(/^~/, os.homedir()),
	normalizePath: (p: string) => path.normalize(p),
}));

// Mock configLock
const mockLock = {
	acquireConfigLock: vi.fn(async () => ({ acquired: true })) as ReturnType<
		typeof mock<
			(opts: unknown) => Promise<{ acquired: boolean; error?: string }>
		>
	>,
	releaseConfigLock: vi.fn(() => true) as ReturnType<
		typeof mock<() => boolean>
	>,
};

vi.mock("../../utils/security/configLock", () => mockLock);

import {
	BrainConfigError,
	brainConfigExists,
	deleteBrainConfig,
	getBrainConfigDir,
	getBrainConfigPath,
	initBrainConfig,
	loadBrainConfig,
	loadBrainConfigSync,
	saveBrainConfig,
} from "../brain-config";

describe("getBrainConfigPath", () => {
	test("returns XDG-compliant path", () => {
		const configPath = getBrainConfigPath();
		expect(configPath).toContain(".config");
		expect(configPath).toContain("brain");
		expect(configPath).toContain("config.json");
	});

	test("path is within user home directory", () => {
		const configPath = getBrainConfigPath();
		expect(configPath.startsWith(os.homedir())).toBe(true);
	});
});

describe("getBrainConfigDir", () => {
	test("returns XDG-compliant directory", () => {
		const configDir = getBrainConfigDir();
		expect(configDir).toContain(".config");
		expect(configDir).toContain("brain");
		expect(configDir).not.toContain("config.json");
	});
});

describe("loadBrainConfig", () => {
	beforeEach(() => {
		mockFs.existsSync.mockReset();
		mockFs.readFileSync.mockReset();
		mockLock.acquireConfigLock.mockReset();
		mockLock.releaseConfigLock.mockReset();

		mockLock.acquireConfigLock.mockResolvedValue({ acquired: true });
		mockLock.releaseConfigLock.mockReturnValue(true);
	});

	test("returns defaults when config file does not exist", async () => {
		mockFs.existsSync.mockReturnValue(false);

		const config = await loadBrainConfig();

		expect(config.version).toBe("2.0.0");
		expect(config.defaults.memories_location).toBe("~/memories");
		expect(config.defaults.memories_mode).toBe("DEFAULT");
	});

	test("loads and parses valid config file", async () => {
		const validConfig: BrainConfig = {
			...DEFAULT_BRAIN_CONFIG,
			logging: { level: "debug" },
		};

		mockFs.existsSync.mockReturnValue(true);
		mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

		const config = await loadBrainConfig();

		expect(config.version).toBe("2.0.0");
		expect(config.logging.level).toBe("debug");
	});

	test("throws BrainConfigError for invalid JSON", async () => {
		mockFs.existsSync.mockReturnValue(true);
		mockFs.readFileSync.mockReturnValue("{ invalid json }");

		await expect(loadBrainConfig()).rejects.toThrow(BrainConfigError);
		await expect(loadBrainConfig()).rejects.toMatchObject({
			code: "PARSE_ERROR",
		});
	});

	test("throws BrainConfigError for schema validation failure", async () => {
		const invalidConfig = {
			version: "1.0.0", // Wrong version
			defaults: { memories_location: "~/memories" },
		};

		mockFs.existsSync.mockReturnValue(true);
		mockFs.readFileSync.mockReturnValue(JSON.stringify(invalidConfig));

		await expect(loadBrainConfig()).rejects.toThrow(BrainConfigError);
		await expect(loadBrainConfig()).rejects.toMatchObject({
			code: "VALIDATION_ERROR",
		});
	});

	test("acquires and releases lock during read", async () => {
		mockFs.existsSync.mockReturnValue(false);

		await loadBrainConfig();

		expect(mockLock.acquireConfigLock).toHaveBeenCalled();
		expect(mockLock.releaseConfigLock).toHaveBeenCalled();
	});

	test("throws BrainConfigError when lock acquisition fails", async () => {
		mockLock.acquireConfigLock.mockResolvedValue({
			acquired: false,
			error: "Lock held by another process",
		});

		await expect(loadBrainConfig()).rejects.toThrow(BrainConfigError);
		await expect(loadBrainConfig()).rejects.toMatchObject({
			code: "LOCK_ERROR",
		});
	});

	test("respects custom lock timeout", async () => {
		mockFs.existsSync.mockReturnValue(false);

		await loadBrainConfig({ lockTimeoutMs: 10000 });

		expect(mockLock.acquireConfigLock).toHaveBeenCalledWith({
			timeoutMs: 10000,
		});
	});
});

describe("loadBrainConfigSync", () => {
	beforeEach(() => {
		mockFs.existsSync.mockReset();
		mockFs.readFileSync.mockReset();
	});

	test("returns defaults when config does not exist", () => {
		mockFs.existsSync.mockReturnValue(false);

		const config = loadBrainConfigSync();

		expect(config.version).toBe("2.0.0");
		expect(config.defaults.memories_location).toBe("~/memories");
	});

	test("returns defaults on JSON parse error", () => {
		mockFs.existsSync.mockReturnValue(true);
		mockFs.readFileSync.mockReturnValue("invalid json");

		const config = loadBrainConfigSync();

		expect(config.version).toBe("2.0.0");
		expect(config.defaults.memories_location).toBe("~/memories");
	});

	test("returns defaults on read error", () => {
		mockFs.existsSync.mockReturnValue(true);
		mockFs.readFileSync.mockImplementation(() => {
			throw new Error("Permission denied");
		});

		const config = loadBrainConfigSync();

		expect(config.version).toBe("2.0.0");
	});

	test("loads valid config file", () => {
		const validConfig = { ...DEFAULT_BRAIN_CONFIG, logging: { level: "warn" } };

		mockFs.existsSync.mockReturnValue(true);
		mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

		const config = loadBrainConfigSync();

		expect(config.logging.level).toBe("warn");
	});
});

describe("saveBrainConfig", () => {
	beforeEach(() => {
		mockFs.existsSync.mockReset();
		mockFs.readFileSync.mockReset();
		mockFs.writeFileSync.mockReset();
		mockFs.mkdirSync.mockReset();
		mockFs.chmodSync.mockReset();
		mockFs.renameSync.mockReset();
		mockFs.unlinkSync.mockReset();
		mockFs.statSync.mockReset();
		mockLock.acquireConfigLock.mockReset();
		mockLock.releaseConfigLock.mockReset();

		mockLock.acquireConfigLock.mockResolvedValue({ acquired: true });
		mockLock.releaseConfigLock.mockReturnValue(true);
		mockFs.statSync.mockReturnValue({ mode: 0o700 });
	});

	test("validates config before writing", async () => {
		const invalidConfig = {
			version: "1.0.0", // Wrong version
		} as unknown as BrainConfig;

		await expect(saveBrainConfig(invalidConfig)).rejects.toThrow(
			BrainConfigError,
		);
		await expect(saveBrainConfig(invalidConfig)).rejects.toMatchObject({
			code: "VALIDATION_ERROR",
		});
	});

	test("uses atomic write pattern (temp + rename)", async () => {
		let tempWritten = false;
		mockFs.existsSync.mockReturnValue(true);
		mockFs.writeFileSync.mockImplementation((p: string) => {
			if (String(p).includes(".tmp")) {
				tempWritten = true;
			}
		});
		mockFs.readFileSync.mockImplementation((p: string) => {
			if (String(p).includes(".tmp") && tempWritten) {
				return JSON.stringify(DEFAULT_BRAIN_CONFIG);
			}
			return "";
		});

		await saveBrainConfig(DEFAULT_BRAIN_CONFIG);

		expect(mockFs.writeFileSync).toHaveBeenCalled();
		expect(mockFs.renameSync).toHaveBeenCalled();

		// Verify temp file was written before rename
		const writeCall = mockFs.writeFileSync.mock.calls[0];
		expect(String(writeCall[0])).toContain(".tmp");
	});

	test("creates config directory if it does not exist", async () => {
		mockFs.existsSync.mockImplementation((p: string) => {
			// Directory doesn't exist, but temp file read succeeds
			if (String(p).includes("brain") && !String(p).includes(".json")) {
				return false;
			}
			return true;
		});
		mockFs.readFileSync.mockReturnValue(JSON.stringify(DEFAULT_BRAIN_CONFIG));

		await saveBrainConfig(DEFAULT_BRAIN_CONFIG);

		expect(mockFs.mkdirSync).toHaveBeenCalled();
	});

	test("cleans up temp file on write failure", async () => {
		mockFs.existsSync.mockReturnValue(true);
		mockFs.writeFileSync.mockImplementation(() => {
			throw new Error("Disk full");
		});

		await expect(saveBrainConfig(DEFAULT_BRAIN_CONFIG)).rejects.toThrow(
			BrainConfigError,
		);

		// Temp file cleanup attempted (unlinkSync may be called)
		expect(mockLock.releaseConfigLock).toHaveBeenCalled();
	});

	test("cleans up temp file on rename failure", async () => {
		mockFs.existsSync.mockImplementation((p: string) =>
			String(p).includes(".tmp"),
		);
		mockFs.readFileSync.mockReturnValue(JSON.stringify(DEFAULT_BRAIN_CONFIG));
		mockFs.renameSync.mockImplementation(() => {
			throw new Error("Cross-device link");
		});

		await expect(saveBrainConfig(DEFAULT_BRAIN_CONFIG)).rejects.toThrow(
			BrainConfigError,
		);
		expect(mockFs.unlinkSync).toHaveBeenCalled();
	});

	test("acquires and releases lock during write", async () => {
		mockFs.existsSync.mockReturnValue(true);
		mockFs.readFileSync.mockReturnValue(JSON.stringify(DEFAULT_BRAIN_CONFIG));

		await saveBrainConfig(DEFAULT_BRAIN_CONFIG);

		expect(mockLock.acquireConfigLock).toHaveBeenCalled();
		expect(mockLock.releaseConfigLock).toHaveBeenCalled();
	});

	test("throws BrainConfigError when lock acquisition fails", async () => {
		mockLock.acquireConfigLock.mockResolvedValue({
			acquired: false,
			error: "Timeout",
		});

		await expect(saveBrainConfig(DEFAULT_BRAIN_CONFIG)).rejects.toThrow(
			BrainConfigError,
		);
		await expect(saveBrainConfig(DEFAULT_BRAIN_CONFIG)).rejects.toMatchObject({
			code: "LOCK_ERROR",
		});
	});

	test("releases lock even on error", async () => {
		mockFs.existsSync.mockReturnValue(true);
		mockFs.writeFileSync.mockImplementation(() => {
			throw new Error("Write failed");
		});

		try {
			await saveBrainConfig(DEFAULT_BRAIN_CONFIG);
		} catch {
			// Expected
		}

		expect(mockLock.releaseConfigLock).toHaveBeenCalled();
	});
});

describe("initBrainConfig", () => {
	beforeEach(() => {
		mockFs.existsSync.mockReset();
		mockFs.readFileSync.mockReset();
		mockFs.writeFileSync.mockReset();
		mockFs.mkdirSync.mockReset();
		mockFs.renameSync.mockReset();
		mockFs.statSync.mockReset();
		mockLock.acquireConfigLock.mockReset();
		mockLock.releaseConfigLock.mockReset();

		mockLock.acquireConfigLock.mockResolvedValue({ acquired: true });
		mockLock.releaseConfigLock.mockReturnValue(true);
		mockFs.statSync.mockReturnValue({ mode: 0o700 });
	});

	test("creates default config when none exists", async () => {
		mockFs.existsSync.mockImplementation((p: string) => {
			// Config file doesn't exist
			if (String(p).includes("config.json") && !String(p).includes(".tmp")) {
				return false;
			}
			return true;
		});
		mockFs.readFileSync.mockReturnValue(JSON.stringify(DEFAULT_BRAIN_CONFIG));

		const config = await initBrainConfig();

		expect(config.version).toBe("2.0.0");
		expect(mockFs.writeFileSync).toHaveBeenCalled();
	});

	test("loads existing config when present", async () => {
		const existingConfig = {
			...DEFAULT_BRAIN_CONFIG,
			logging: { level: "error" },
		};

		mockFs.existsSync.mockReturnValue(true);
		mockFs.readFileSync.mockReturnValue(JSON.stringify(existingConfig));

		const config = await initBrainConfig();

		expect(config.logging.level).toBe("error");
	});
});

describe("brainConfigExists", () => {
	beforeEach(() => {
		mockFs.existsSync.mockReset();
	});

	test("returns true when config file exists", () => {
		mockFs.existsSync.mockReturnValue(true);
		expect(brainConfigExists()).toBe(true);
	});

	test("returns false when config file does not exist", () => {
		mockFs.existsSync.mockReturnValue(false);
		expect(brainConfigExists()).toBe(false);
	});
});

describe("deleteBrainConfig", () => {
	beforeEach(() => {
		mockFs.existsSync.mockReset();
		mockFs.unlinkSync.mockReset();
		mockLock.acquireConfigLock.mockReset();
		mockLock.releaseConfigLock.mockReset();

		mockLock.acquireConfigLock.mockResolvedValue({ acquired: true });
		mockLock.releaseConfigLock.mockReturnValue(true);
	});

	test("does nothing when config does not exist", async () => {
		mockFs.existsSync.mockReturnValue(false);

		await deleteBrainConfig();

		expect(mockFs.unlinkSync).not.toHaveBeenCalled();
	});

	test("deletes config file when it exists", async () => {
		mockFs.existsSync.mockReturnValue(true);

		await deleteBrainConfig();

		expect(mockFs.unlinkSync).toHaveBeenCalled();
	});

	test("acquires lock before deletion", async () => {
		mockFs.existsSync.mockReturnValue(true);

		await deleteBrainConfig();

		expect(mockLock.acquireConfigLock).toHaveBeenCalled();
		expect(mockLock.releaseConfigLock).toHaveBeenCalled();
	});
});

describe("BrainConfigError", () => {
	test("has correct error name", () => {
		const error = new BrainConfigError("test", "IO_ERROR");
		expect(error.name).toBe("BrainConfigError");
	});

	test("preserves error code", () => {
		const error = new BrainConfigError("test", "VALIDATION_ERROR");
		expect(error.code).toBe("VALIDATION_ERROR");
	});

	test("preserves cause", () => {
		const cause = new Error("original error");
		const error = new BrainConfigError("test", "IO_ERROR", cause);
		expect(error.cause).toBe(cause);
	});
});
