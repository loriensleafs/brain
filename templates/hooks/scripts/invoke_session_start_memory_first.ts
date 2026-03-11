#!/usr/bin/env bun
/**
 * Enforce Memory-First Architecture at session start.
 *
 * Claude Code hook that injects memory-first requirements into the session context.
 * Outputs blocking gate requirements that Claude receives before processing any user prompts.
 *
 * Hook Type: SessionStart
 * Exit Codes:
 *   0 = Success, stdout added to Claude's context
 */

import { join, resolve } from "path";
import { skipIfConsumerRepo } from "../lib/guards.ts";

async function main(): Promise<number> {
  const input = await Bun.file("/dev/stdin").json().catch(() => ({}));

  if (await skipIfConsumerRepo("session-start-memory-first", input?.cwd)) {
    return 0;
  }

  const scriptDir = resolve(import.meta.dir);

  // Brain MCP status (connection check disabled to prevent issues in async handling)
  const brainStatus = "Brain MCP: initialize via bootstrap_context";

  let agentsRef = "";
  const projectRoot = resolve(scriptDir, "..", "..");
  const agentsFile = Bun.file(join(projectRoot, "AGENTS.md"));
  if (await agentsFile.exists()) {
    agentsRef = " Protocol: AGENTS.md > Session Protocol Gates.";
  }
  console.log(`Memory-First active. ${brainStatus}.${agentsRef}`);
  return 0;
}

process.exit(await main());
