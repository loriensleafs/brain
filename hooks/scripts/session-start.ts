#!/usr/bin/env bun
/**
 * Session start hook handler for brain-hooks.
 *
 * Ported from apps/claude-plugin/cmd/hooks/session_start.go (670 LOC).
 * Called by Claude Code on session start. Reads hook input from stdin,
 * resolves project, gets git context, bootstrap context, and workflow state.
 * Outputs Claude Code hook JSON to stdout.
 */
import { execCommand } from "./exec";
import { resolveProjectWithCwd } from "./project-resolve";
import { normalizeEvent } from "./normalize";
import type {
  ActiveSession,
  BootstrapContextResult,
  BootstrapResponse,
  GitContextInfo,
  HookInput,
  HookOutput,
  OpenSession,
  SessionStartOutput,
  WorkflowStateInfo,
} from "./types";

/**
 * Identify the active project for session start.
 */
export async function identifyProject(cwd: string): Promise<string | null> {
  const resolvedCwd = cwd || process.cwd();
  const project = await resolveProjectWithCwd("", resolvedCwd);
  return project || null;
}

/**
 * Get git repository context.
 */
export function getGitContext(): GitContextInfo {
  const context: GitContextInfo = {};

  try {
    const branch = execCommand("git", ["branch", "--show-current"]);
    context.branch = branch.trim();
  } catch { /* graceful degradation */ }

  try {
    const log = execCommand("git", ["log", "--oneline", "-5"]);
    const lines = log.trim().split("\n");
    if (lines.length > 0 && lines[0] !== "") {
      context.recentCommits = lines;
    }
  } catch { /* graceful degradation */ }

  try {
    const status = execCommand("git", ["status", "--porcelain"]);
    context.status = status.length === 0 ? "clean" : "dirty";
  } catch { /* graceful degradation */ }

  return context;
}

/**
 * Get bootstrap context from brain CLI.
 */
export function getBootstrapContext(
  project: string,
): BootstrapContextResult | null {
  try {
    const args = ["bootstrap"];
    if (project) {
      args.push("-p", project);
    }

    const output = execCommand("brain", args);
    const result: BootstrapContextResult = {
      markdown: output,
      openSessions: [],
      parsedJSON: false,
    };

    // Try to parse as JSON first (new bootstrap_context format)
    try {
      const bootstrapResp = JSON.parse(output) as BootstrapResponse;
      result.openSessions = bootstrapResp.open_sessions ?? [];
      result.activeSession = bootstrapResp.active_session ?? undefined;
      result.parsedJSON = true;
    } catch {
      // Not JSON -- keep markdown as-is
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Parse open sessions from bootstrap markdown output (legacy fallback).
 */
export function parseOpenSessionsFromMarkdown(
  markdown: string,
): OpenSession[] {
  const sessions: OpenSession[] = [];

  // Find the Session State section
  let sectionStart = markdown.indexOf("### Session State");
  if (sectionStart === -1) {
    sectionStart = markdown.indexOf("### Open Sessions");
    if (sectionStart === -1) return sessions;
  }

  // Find the end of the section
  let sectionContent = markdown.slice(sectionStart);
  const nextSection = sectionContent.indexOf("###", 3);
  if (nextSection !== -1) {
    sectionContent = sectionContent.slice(0, nextSection);
  }

  // Parse session entries
  const sessionPattern =
    /-\s*(?:\[\[)?([^\]\s(]+(?:\s*-\s*[^\](\s]+)?)(?:\]\])?\s*(?:-\s*([^(]+))?\s*\((IN_PROGRESS|PAUSED|in_progress|paused)\)(?:\s*\(branch:\s*`?([^`\)]+)`?\))?/g;

  let match;
  while ((match = sessionPattern.exec(sectionContent)) !== null) {
    const sessionId = match[1].trim();
    const topic = match[2]?.trim() ?? "";
    const status = match[3].trim().toUpperCase();

    const session: OpenSession = {
      sessionId,
      status,
      topic,
      date: "",
      permalink: "",
    };

    // Extract date from session ID
    const dateMatch = sessionId.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      session.date = dateMatch[1];
    }

    // Extract branch if present
    if (match[4]) {
      session.branch = match[4].trim();
    }

    sessions.push(session);
  }

  return sessions;
}

/**
 * Format mandatory session instructions when no active session exists.
 */
export function formatSessionInstructions(
  openSessions: OpenSession[],
): string {
  let sb = "";

  sb +=
    "DO THE FOLLOWING IMMEDIATELY, without waiting for user input, BEFORE anything else:\n\n";

  if (openSessions.length > 0) {
    sb += "### Open Sessions Detected\n\n";
    sb += `Found ${openSessions.length} session(s) that can be resumed:\n\n`;

    for (let i = 0; i < openSessions.length; i++) {
      const session = openSessions[i];
      const displayName = session.topic
        ? `${session.sessionId} - ${session.topic}`
        : session.sessionId;
      sb += `${i + 1}. **${displayName}** (${session.status})\n`;
      if (session.date) {
        sb += `   - Date: ${session.date}\n`;
      }
      if (session.branch) {
        sb += `   - Branch: ${session.branch}\n`;
      }
    }

    sb +=
      "\n**MANDATORY ACTION**: Use the AskUserQuestion tool to ask the user:\n\n";
    sb += "```\n";
    sb += "I found open sessions. Would you like to:\n";
    sb += "1. Start a new session\n";
    for (let i = 0; i < openSessions.length; i++) {
      const session = openSessions[i];
      const displayName = session.topic
        ? `${session.sessionId} - ${session.topic}`
        : session.sessionId;
      sb += `${i + 2}. Continue session: ${displayName}\n`;
    }
    sb += "```\n\n";

    sb += "**AFTER user responds**:\n\n";
    sb +=
      "- If user selects existing session: Use MCP `session` tool with operation=`resume` and sessionId=`<selected session ID>`\n";
    sb +=
      "- If user selects new session: Use AskUserQuestion to ask about the session topic, then use MCP `session` tool with operation=`create` and topic=`<user's response>`\n\n";
  } else {
    sb += "### No Active Session\n\n";
    sb +=
      "**MANDATORY ACTION**: Use the AskUserQuestion tool to ask the user:\n\n";
    sb += "```\n";
    sb +=
      "What would you like to work on in this session? (This will be the session topic)\n";
    sb += "```\n\n";
    sb +=
      "**AFTER user responds**: Use MCP `session` tool with operation=`create` and topic=`<user's response>`\n\n";
  }

  sb += "**THEN** complete the session start protocol:\n";
  sb += "- Call bootstrap_context to load full project context\n";
  sb += "- Verify git branch with `git branch --show-current`\n";
  sb += "- Load and acknowledge session state\n";

  return sb;
}

/**
 * Format context when an active session already exists.
 */
export function formatActiveSessionContext(
  activeSession: ActiveSession,
): string {
  let sb = "";

  sb += "### Active Session\n\n";

  const displayName = activeSession.topic
    ? `${activeSession.sessionId} - ${activeSession.topic}`
    : activeSession.sessionId;

  sb += `**Session**: ${displayName}\n`;
  sb += `**Status**: ${activeSession.status}\n`;
  sb += `**Date**: ${activeSession.date}\n`;

  if (activeSession.branch) {
    sb += `**Branch**: ${activeSession.branch}\n`;
  }
  if (activeSession.mode) {
    sb += `**Mode**: ${activeSession.mode}\n`;
  }
  if (activeSession.task) {
    sb += `**Current Task**: ${activeSession.task}\n`;
  }

  if (activeSession.isValid) {
    sb += "\n**Validation**: All checks passed\n";
  } else {
    sb += "\n**Validation**: Some checks failed\n";
    for (const check of activeSession.checks) {
      const status = check.passed ? "PASS" : "FAIL";
      sb += `- ${check.name}: [${status}]\n`;
    }
  }

  sb += "\n**Continue with session start protocol**: Load context and verify state.\n";

  return sb;
}

/**
 * Load workflow state from brain CLI.
 */
export function loadWorkflowState(): WorkflowStateInfo | null {
  try {
    const output = execCommand("brain", ["session", "get-state"]);
    return JSON.parse(output) as WorkflowStateInfo;
  } catch {
    return null;
  }
}

/**
 * Set active project in the MCP server via brain CLI.
 */
export function setActiveProject(project: string): boolean {
  try {
    execCommand("brain", ["projects", "active", "-p", project]);
    return true;
  } catch {
    return false;
  }
}

/** Instructions when no project is identified. */
export function noProjectInstructions(): string {
  return `DO THE FOLLOWING IMMEDIATELY, DO NOT WAIT FOR THE USER TO PROMPT YOU.

No active project is set.

Use AskUserQuestion to ask the user which project they want to work with.

After the user selects a project:
1. Set the project: active_project with operation="set" and project=<selected>
2. Run full session start protocol:
   - Call bootstrap_context to load project context
   - Create session log at .agents/sessions/YYYY-MM-DD-session-NN.md
   - Load session state
   - Verify git branch and commit

Available projects can be found with: list_projects
`;
}

/**
 * Build the complete session start output.
 */
export async function buildSessionOutput(cwd: string): Promise<SessionStartOutput> {
  const output: SessionStartOutput = { success: true };

  // Identify project
  const project = await identifyProject(cwd);
  if (!project) {
    output.success = true;
    output.bootstrapInfo = { noProject: true };
    return output;
  }
  output.project = project;

  // Set active project
  if (!setActiveProject(project)) {
    output.bootstrapInfo = {
      warning: `Project identified but could not set active`,
    };
  }

  // Get git context
  output.gitContext = getGitContext();

  // Get bootstrap context
  const bootstrapResult = getBootstrapContext(project);
  if (!bootstrapResult) {
    output.bootstrapInfo = {
      warning: "Could not get bootstrap context",
    };
  } else {
    output.bootstrapInfo = {
      markdown: bootstrapResult.markdown,
      parsedJSON: bootstrapResult.parsedJSON,
    };

    if (bootstrapResult.parsedJSON) {
      output.openSessions = bootstrapResult.openSessions;
      output.activeSession = bootstrapResult.activeSession;
    } else {
      output.openSessions = parseOpenSessionsFromMarkdown(
        bootstrapResult.markdown,
      );
    }
  }

  // Get workflow state
  const workflowState = loadWorkflowState();
  output.workflowState = workflowState ?? {};

  return output;
}

/**
 * Format the session output as markdown for additionalContext.
 */
export function formatContextMarkdown(output: SessionStartOutput): string {
  let sb = "";

  // Handle error case
  if (!output.success) {
    sb += `**Error:** ${output.error}\n`;
    return sb;
  }

  // Handle no project case
  if (output.bootstrapInfo) {
    const noProject = output.bootstrapInfo.noProject;
    if (noProject === true) {
      return noProjectInstructions();
    }
  }

  // Git context header
  if (output.gitContext) {
    if (output.gitContext.branch) {
      sb += `**Branch:** ${output.gitContext.branch}\n`;
    }
    if (output.gitContext.status) {
      sb += `**Status:** ${output.gitContext.status}\n`;
    }
    sb += "\n";
  }

  // Session state logic per FEATURE-001
  if (output.activeSession) {
    sb += formatActiveSessionContext(output.activeSession);
  } else {
    sb += formatSessionInstructions(output.openSessions ?? []);
  }

  sb += "\n";

  // Bootstrap markdown
  if (output.bootstrapInfo) {
    const markdown = output.bootstrapInfo.markdown;
    if (typeof markdown === "string" && markdown) {
      sb += "\n---\n\n";
      sb += "### Project Context\n\n";
      sb += markdown;
      sb += "\n";
    }
    const warning = output.bootstrapInfo.warning;
    if (typeof warning === "string" && warning) {
      sb += `**Warning:** ${warning}\n`;
    }
  }

  // Workflow state
  if (output.workflowState && output.workflowState.mode) {
    sb += "\n### Workflow State\n";
    sb += `**Mode:** ${output.workflowState.mode}\n`;
    if (output.workflowState.task) {
      sb += `**Task:** ${output.workflowState.task}\n`;
    }
    if (output.workflowState.sessionId) {
      sb += `**Session:** ${output.workflowState.sessionId}\n`;
    }
  }

  return sb;
}

/**
 * Read hook input from stdin and normalize.
 */
async function readHookInput(): Promise<HookInput> {
  try {
    const data = await Bun.file("/dev/stdin").text();
    if (!data) return {};
    const parsed = JSON.parse(data) as Record<string, unknown>;
    // Normalize to extract cwd/session_id consistently
    const event = normalizeEvent(parsed, "SessionStart");
    return {
      session_id: event.sessionId || undefined,
      cwd: event.workspaceRoot || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Main entry point for session-start hook.
 */
export async function runSessionStart(): Promise<void> {
  const hookInput = await readHookInput();
  const output = await buildSessionOutput(hookInput.cwd ?? "");

  const hookOutput: HookOutput = {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: formatContextMarkdown(output),
    },
  };

  process.stdout.write(JSON.stringify(hookOutput, null, 2) + "\n");
}

// Run if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSessionStart();
}
