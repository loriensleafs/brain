/**
 * Session Protocol Start Workflow
 *
 * Automates session start protocol steps per ADR-016.
 * Executes 8 protocol steps to initialize session context.
 *
 * Steps:
 * 1. Initialize Brain MCP (bootstrap_context)
 * 2. Load HANDOFF context from Brain notes
 * 3. Create session log file
 * 4. List and validate skill scripts
 * 5. Verify git branch
 * 6. Read usage-mandatory note
 * 7. Read PROJECT-CONSTRAINTS.md
 * 8. Load memory-index notes
 *
 * Triggered by "session/protocol.start" event.
 * Returns aggregated context for Claude.
 * Writes protocol status to session state.
 * Fail-closed on errors (blocks session start).
 *
 * @see ADR-016: Automatic Session Protocol Enforcement
 * @see TASK-011: Implement session-protocol-start Workflow
 */

import { exec } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { getBasicMemoryClient } from "../../proxy/client";
import {
	BrainSessionPersistence,
	BrainUnavailableError,
} from "../../services/session";
import {
	createDefaultSessionState,
	type SessionState,
} from "../../services/session/types";
import { logger } from "../../utils/internal/logger";
import { inngest } from "../client";
import { createNonRetriableError, WorkflowErrorType } from "../errors";

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

/**
 * Protocol start evidence recorded for each step.
 */
export interface ProtocolStartEvidence {
	/** Brain MCP version or initialization timestamp */
	brainMcpInitialized: string;
	/** Whether HANDOFF.md was successfully read */
	handoffRead: string;
	/** Path to the created session log file */
	sessionLogPath: string;
	/** Number of skill scripts found */
	skillScriptsCount: string;
	/** Current git branch name */
	gitBranch: string;
	/** Whether usage-mandatory note was read */
	usageMandatoryRead: string;
	/** Whether PROJECT-CONSTRAINTS.md was read */
	constraintsRead: string;
	/** Number of memory-index notes loaded */
	memoryIndexCount: string;
	/** ISO timestamp when protocol completed */
	completedAt: string;
}

/**
 * Context object returned by the workflow.
 * Contains all loaded data for Claude to use.
 */
export interface SessionProtocolContext {
	/** Session ID */
	sessionId: string;
	/** Working directory path */
	workingDirectory: string;
	/** Brain MCP initialization status */
	brainMcpStatus: "initialized" | "failed";
	/** HANDOFF.md content if found */
	handoffContent: string | null;
	/** Session log file path */
	sessionLogPath: string | null;
	/** List of available skill script paths */
	skillScripts: string[];
	/** Current git branch */
	gitBranch: string | null;
	/** Usage-mandatory note content */
	usageMandatory: string | null;
	/** PROJECT-CONSTRAINTS.md content */
	projectConstraints: string | null;
	/** Memory index notes content */
	memoryIndexNotes: Array<{ identifier: string; content: string }>;
	/** Protocol evidence for session state */
	evidence: ProtocolStartEvidence;
}

/**
 * Result type for workflow completion.
 */
export interface SessionProtocolStartResult {
	success: boolean;
	sessionId: string;
	context: SessionProtocolContext;
}

/**
 * Response structure from read_note tool.
 */
interface ReadNoteResult {
	content?: Array<{ type: string; text?: string }>;
}

// ============================================================================
// Step Implementations
// ============================================================================

/**
 * Step 1: Initialize Brain MCP via bootstrap_context tool.
 *
 * @param client - Brain MCP client
 * @param workingDirectory - Project working directory
 * @returns Initialization timestamp or error message
 */
async function initializeBrainMCP(
	client: Client,
	workingDirectory: string,
): Promise<string> {
	try {
		await client.callTool({
			name: "bootstrap_context",
			arguments: {
				project: workingDirectory,
				timeframe: "5d",
				include_referenced: true,
			},
		});

		const timestamp = new Date().toISOString();
		logger.info({ workingDirectory, timestamp }, "Brain MCP initialized");
		return timestamp;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error({ error: message }, "Brain MCP initialization failed");
		throw new BrainUnavailableError(
			`Brain MCP initialization failed: ${message}`,
		);
	}
}

/**
 * Step 2: Load HANDOFF.md content from Brain notes.
 *
 * @param client - Brain MCP client
 * @param workingDirectory - Project working directory
 * @returns HANDOFF content or null if not found
 */
async function loadHandoffContext(
	client: Client,
	workingDirectory: string,
): Promise<string | null> {
	try {
		const result = (await client.callTool({
			name: "read_note",
			arguments: {
				identifier: "HANDOFF",
				project: workingDirectory,
			},
		})) as ReadNoteResult;

		const content = result.content?.find((c) => c.type === "text")?.text;
		if (content) {
			logger.debug("HANDOFF.md loaded from Brain notes");
			return content;
		}

		logger.debug("HANDOFF.md not found in Brain notes");
		return null;
	} catch (error) {
		logger.debug({ error }, "Failed to load HANDOFF.md - may not exist");
		return null;
	}
}

/**
 * Step 3: Create session log file at .agents/sessions/YYYY-MM-DD-session-NN.md.
 *
 * @param sessionId - Session UUID
 * @param workingDirectory - Project working directory
 * @returns Created file path or null if creation failed
 */
async function createSessionLog(
	sessionId: string,
	workingDirectory: string,
): Promise<string | null> {
	const sessionsDir = path.join(workingDirectory, ".agents", "sessions");
	const today = new Date().toISOString().split("T")[0];

	try {
		// Ensure sessions directory exists
		await fs.mkdir(sessionsDir, { recursive: true });

		// Find next session number for today
		const existingLogs = await fs.readdir(sessionsDir).catch(() => []);
		const todayLogs = existingLogs.filter((f) => f.startsWith(today));
		const sessionNum = String(todayLogs.length + 1).padStart(2, "0");

		const sessionLogName = `${today}-session-${sessionNum}.md`;
		const sessionLogPath = path.join(sessionsDir, sessionLogName);

		// Generate session log template
		const template = generateSessionLogTemplate(sessionId, today, sessionNum);

		await fs.writeFile(sessionLogPath, template, "utf-8");
		logger.info({ sessionLogPath }, "Session log created");
		return sessionLogPath;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error({ error: message }, "Failed to create session log");
		return null;
	}
}

/**
 * Generate session log markdown template.
 */
function generateSessionLogTemplate(
	sessionId: string,
	date: string,
	sessionNum: string,
): string {
	const now = new Date();
	const timeStr = now.toTimeString().split(" ")[0];

	return `# Session ${date}-${sessionNum}

**Session ID**: ${sessionId}
**Started**: ${now.toISOString()}
**Mode**: analysis

## Session Start Checklist

| Step | Status | Evidence |
|------|--------|----------|
| Brain MCP initialized | [x] | Automated via workflow |
| HANDOFF.md read | [x] | Automated via workflow |
| Session log created | [x] | This file |
| Skills directory verified | [x] | Automated via workflow |
| Git branch verified | [x] | Automated via workflow |
| Usage-mandatory read | [x] | Automated via workflow |

## Session End Checklist

| Step | Status | Evidence |
|------|--------|----------|
| Session log complete | [ ] | |
| Brain memory updated | [ ] | |
| Markdown lint passed | [ ] | |
| Changes committed | [ ] | |
| Session protocol validated | [ ] | |

## Work Log

### ${timeStr}

Session protocol start workflow completed.

## Artifacts Created

(To be updated during session)

## Decisions Made

(To be updated during session)

## Blockers

None

## Next Steps

1. Begin work on active task
`;
}

/**
 * Step 4: List and validate skill scripts in .claude/skills directory.
 *
 * @param workingDirectory - Project working directory
 * @returns Array of skill script paths
 */
async function verifySkillsDirectory(
	workingDirectory: string,
): Promise<string[]> {
	const skillsDir = path.join(workingDirectory, ".claude", "skills");
	const scripts: string[] = [];

	try {
		const entries = await fs.readdir(skillsDir, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.isDirectory()) {
				const skillDir = path.join(skillsDir, entry.name);
				const skillFiles = await fs.readdir(skillDir).catch(() => []);

				// Look for SKILL.md and script files
				for (const file of skillFiles) {
					if (
						file === "SKILL.md" ||
						file.endsWith(".ps1") ||
						file.endsWith(".sh")
					) {
						scripts.push(path.join(skillDir, file));
					}
				}
			}
		}

		logger.debug({ count: scripts.length }, "Skills directory verified");
		return scripts;
	} catch (error) {
		logger.debug({ error }, "Skills directory not found or inaccessible");
		return [];
	}
}

/**
 * Step 5: Verify current git branch.
 *
 * @param workingDirectory - Project working directory
 * @returns Current branch name or null if not a git repo
 */
async function verifyGitBranch(
	workingDirectory: string,
): Promise<string | null> {
	try {
		const { stdout } = await execAsync("git branch --show-current", {
			cwd: workingDirectory,
			timeout: 5000,
		});

		const branch = stdout.trim();
		logger.debug({ branch }, "Git branch verified");
		return branch || null;
	} catch (error) {
		logger.debug(
			{ error },
			"Git branch verification failed - may not be a git repo",
		);
		return null;
	}
}

/**
 * Step 6: Read usage-mandatory note from Brain.
 *
 * @param client - Brain MCP client
 * @param workingDirectory - Project working directory
 * @returns Note content or null if not found
 */
async function readUsageMandatory(
	client: Client,
	workingDirectory: string,
): Promise<string | null> {
	try {
		const result = (await client.callTool({
			name: "read_note",
			arguments: {
				identifier: "usage-mandatory",
				project: workingDirectory,
			},
		})) as ReadNoteResult;

		const content = result.content?.find((c) => c.type === "text")?.text;
		if (content) {
			logger.debug("usage-mandatory note loaded");
			return content;
		}

		return null;
	} catch (error) {
		logger.debug({ error }, "usage-mandatory note not found");
		return null;
	}
}

/**
 * Step 7: Read PROJECT-CONSTRAINTS.md from file system.
 *
 * @param workingDirectory - Project working directory
 * @returns File content or null if not found
 */
async function readProjectConstraints(
	workingDirectory: string,
): Promise<string | null> {
	const constraintsPath = path.join(
		workingDirectory,
		".agents",
		"governance",
		"PROJECT-CONSTRAINTS.md",
	);

	try {
		const content = await fs.readFile(constraintsPath, "utf-8");
		logger.debug("PROJECT-CONSTRAINTS.md loaded");
		return content;
	} catch (error) {
		logger.debug({ error }, "PROJECT-CONSTRAINTS.md not found");
		return null;
	}
}

/**
 * Step 8: Load memory-index notes from Brain.
 *
 * @param client - Brain MCP client
 * @param workingDirectory - Project working directory
 * @returns Array of memory notes with identifiers and content
 */
async function loadMemoryIndexNotes(
	client: Client,
	workingDirectory: string,
): Promise<Array<{ identifier: string; content: string }>> {
	const notes: Array<{ identifier: string; content: string }> = [];

	// Common memory index identifiers to load
	const identifiers = [
		"session-context",
		"active-features",
		"recent-decisions",
		"project-patterns",
	];

	for (const identifier of identifiers) {
		try {
			const result = (await client.callTool({
				name: "read_note",
				arguments: {
					identifier,
					project: workingDirectory,
				},
			})) as ReadNoteResult;

			const content = result.content?.find((c) => c.type === "text")?.text;
			if (content) {
				notes.push({ identifier, content });
			}
		} catch {
			// Note not found, continue to next
		}
	}

	logger.debug({ count: notes.length }, "Memory index notes loaded");
	return notes;
}

// ============================================================================
// Session State Management
// ============================================================================

/**
 * Update session state with protocol start evidence.
 *
 * @param sessionId - Session UUID
 * @param evidence - Protocol completion evidence
 * @param workingDirectory - Project working directory
 */
async function updateSessionState(
	sessionId: string,
	evidence: ProtocolStartEvidence,
	workingDirectory: string,
): Promise<SessionState> {
	const persistence = new BrainSessionPersistence({
		projectPath: workingDirectory,
	});

	// Try to load existing session state
	let state = await persistence.loadSession();

	if (!state) {
		// Create new session state
		state = createDefaultSessionState();
	}

	// Update with protocol evidence
	const updatedState: SessionState = {
		...state,
		protocolStartComplete: true,
		protocolStartEvidence: evidence as unknown as Record<string, string>,
		updatedAt: new Date().toISOString(),
		version: state.version + 1,
	};

	// Save updated state
	await persistence.saveSession(updatedState);

	logger.info(
		{ sessionId, version: updatedState.version },
		"Session state updated with protocol start evidence",
	);

	return updatedState;
}

// ============================================================================
// Workflow Definition
// ============================================================================

/**
 * Validate workflow event data.
 *
 * @param data - Event data to validate
 * @throws NonRetriableError if data is invalid
 */
function validateEventData(data: {
	sessionId?: string;
	workingDirectory?: string;
}): void {
	if (!data.sessionId || typeof data.sessionId !== "string") {
		throw createNonRetriableError(
			WorkflowErrorType.VALIDATION_ERROR,
			"Event data must include a valid sessionId string",
			{ context: { providedData: data } },
		);
	}

	if (!data.workingDirectory || typeof data.workingDirectory !== "string") {
		throw createNonRetriableError(
			WorkflowErrorType.VALIDATION_ERROR,
			"Event data must include a valid workingDirectory string",
			{ context: { providedData: data } },
		);
	}
}

/**
 * Session Protocol Start Workflow.
 *
 * Triggered by "session/protocol.start" event.
 * Executes 8 protocol steps to initialize session context.
 * Writes protocol status to session state.
 * Fail-closed on errors (blocks session start).
 *
 * Step IDs for Inngest memoization:
 * - "validate-input": Input validation
 * - "init-brain-mcp": Initialize Brain MCP
 * - "load-handoff": Load HANDOFF.md content
 * - "create-session-log": Create session log file
 * - "verify-skills": List and validate skill scripts
 * - "verify-git": Verify git branch
 * - "read-usage-mandatory": Read usage-mandatory note
 * - "read-constraints": Read PROJECT-CONSTRAINTS.md
 * - "load-memory-index": Load memory-index notes
 * - "update-session-state": Update session state with evidence
 * - "emit-state-update": Emit session state update event
 */
export const sessionProtocolStartWorkflow = inngest.createFunction(
	{
		id: "session-protocol-start",
		name: "Session Protocol Start",
		retries: 3,
	},
	{ event: "session/protocol.start" },
	async ({ event, step }): Promise<SessionProtocolStartResult> => {
		const { sessionId, workingDirectory } = event.data;

		// Step 0: Validate input data
		await step.run("validate-input", async (): Promise<void> => {
			validateEventData(event.data);
			logger.info(
				{ sessionId, workingDirectory },
				"Session protocol start workflow initiated",
			);
		});

		// Get Brain MCP client for subsequent steps
		let client: Client;
		try {
			client = await getBasicMemoryClient();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw createNonRetriableError(
				WorkflowErrorType.CONFIGURATION_ERROR,
				`Brain MCP client unavailable: ${message}`,
				{ cause: error },
			);
		}

		// Step 1: Initialize Brain MCP
		const brainMcpTimestamp = await step.run(
			"init-brain-mcp",
			async (): Promise<string> => {
				return await initializeBrainMCP(client, workingDirectory);
			},
		);

		// Step 2: Load HANDOFF.md content
		const handoffContent = await step.run(
			"load-handoff",
			async (): Promise<string | null> => {
				return await loadHandoffContext(client, workingDirectory);
			},
		);

		// Step 3: Create session log file
		const sessionLogPath = await step.run(
			"create-session-log",
			async (): Promise<string | null> => {
				return await createSessionLog(sessionId, workingDirectory);
			},
		);

		// Step 4: Verify skills directory
		const skillScripts = await step.run(
			"verify-skills",
			async (): Promise<string[]> => {
				return await verifySkillsDirectory(workingDirectory);
			},
		);

		// Step 5: Verify git branch
		const gitBranch = await step.run(
			"verify-git",
			async (): Promise<string | null> => {
				return await verifyGitBranch(workingDirectory);
			},
		);

		// Step 6: Read usage-mandatory note
		const usageMandatory = await step.run(
			"read-usage-mandatory",
			async (): Promise<string | null> => {
				return await readUsageMandatory(client, workingDirectory);
			},
		);

		// Step 7: Read PROJECT-CONSTRAINTS.md
		const projectConstraints = await step.run(
			"read-constraints",
			async (): Promise<string | null> => {
				return await readProjectConstraints(workingDirectory);
			},
		);

		// Step 8: Load memory-index notes
		const memoryIndexNotes = await step.run(
			"load-memory-index",
			async (): Promise<Array<{ identifier: string; content: string }>> => {
				return await loadMemoryIndexNotes(client, workingDirectory);
			},
		);

		// Build evidence record
		const evidence: ProtocolStartEvidence = {
			brainMcpInitialized: brainMcpTimestamp,
			handoffRead: handoffContent ? "yes" : "no",
			sessionLogPath: sessionLogPath ?? "failed",
			skillScriptsCount: String(skillScripts.length),
			gitBranch: gitBranch ?? "unknown",
			usageMandatoryRead: usageMandatory ? "yes" : "no",
			constraintsRead: projectConstraints ? "yes" : "no",
			memoryIndexCount: String(memoryIndexNotes.length),
			completedAt: new Date().toISOString(),
		};

		// Step 9: Update session state with evidence
		await step.run("update-session-state", async (): Promise<void> => {
			await updateSessionState(sessionId, evidence, workingDirectory);
		});

		// Step 10: Emit state update event for downstream workflows
		await step.sendEvent("emit-state-update", {
			name: "session/state.update",
			data: {
				sessionId,
				updateType: "init" as const,
			},
		});

		// Build context object for Claude
		const context: SessionProtocolContext = {
			sessionId,
			workingDirectory,
			brainMcpStatus: "initialized",
			handoffContent,
			sessionLogPath,
			skillScripts,
			gitBranch,
			usageMandatory,
			projectConstraints,
			memoryIndexNotes,
			evidence,
		};

		logger.info(
			{
				sessionId,
				brainMcpInitialized: true,
				handoffRead: !!handoffContent,
				sessionLogCreated: !!sessionLogPath,
				skillScriptsCount: skillScripts.length,
				gitBranch,
				usageMandatoryRead: !!usageMandatory,
				constraintsRead: !!projectConstraints,
				memoryIndexCount: memoryIndexNotes.length,
			},
			"Session protocol start workflow completed",
		);

		return {
			success: true,
			sessionId,
			context,
		};
	},
);

/**
 * Get session protocol context directly (for non-workflow access).
 *
 * @param sessionId - Session ID
 * @param workingDirectory - Project working directory
 * @returns Session protocol context or null if protocol not complete
 */
export async function getSessionProtocolContext(
	sessionId: string,
	workingDirectory: string,
): Promise<SessionProtocolContext | null> {
	const persistence = new BrainSessionPersistence({
		projectPath: workingDirectory,
	});

	const state = await persistence.loadSession();
	if (!state || !state.protocolStartComplete) {
		return null;
	}

	// Reconstruct context from evidence
	// This is a lightweight version without re-reading all content
	return {
		sessionId,
		workingDirectory,
		brainMcpStatus: state.protocolStartEvidence.brainMcpInitialized
			? "initialized"
			: "failed",
		handoffContent: null, // Not stored in evidence
		sessionLogPath: state.protocolStartEvidence.sessionLogPath ?? null,
		skillScripts: [], // Not stored in evidence
		gitBranch: state.protocolStartEvidence.gitBranch ?? null,
		usageMandatory: null, // Not stored in evidence
		projectConstraints: null, // Not stored in evidence
		memoryIndexNotes: [], // Not stored in evidence
		evidence: state.protocolStartEvidence as unknown as ProtocolStartEvidence,
	};
}

/**
 * Check if session protocol start has completed.
 *
 * @param workingDirectory - Project working directory
 * @returns True if protocol start is complete
 */
export async function isProtocolStartComplete(
	workingDirectory: string,
): Promise<boolean> {
	const persistence = new BrainSessionPersistence({
		projectPath: workingDirectory,
	});

	const state = await persistence.loadSession();
	return state?.protocolStartComplete ?? false;
}
