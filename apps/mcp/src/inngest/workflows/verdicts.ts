/**
 * Verdict Aggregation Module
 *
 * Provides mergeVerdicts() function that aggregates verdicts from parallel agents
 * into a final workflow verdict with clear blocking rules.
 */

import type { AgentVerdict, Verdict } from "../agents";

/**
 * Blocking verdicts that fail the entire workflow.
 * Ordered by priority (highest first).
 */
const BLOCKING_VERDICTS: readonly Verdict[] = [
  "CRITICAL_FAIL",
  "REJECTED",
  "FAIL",
  "NEEDS_REVIEW",
] as const;

/**
 * Warning verdicts that pass with caveats.
 * Ordered by priority (highest first).
 */
const WARNING_VERDICTS: readonly Verdict[] = ["WARN", "PARTIAL"] as const;

/**
 * Success verdicts indicating full compliance.
 * COMPLIANT takes precedence over PASS.
 */
const SUCCESS_VERDICTS: readonly Verdict[] = ["COMPLIANT", "PASS"] as const;

/**
 * Final verdict structure with aggregated results.
 */
export interface FinalVerdict {
  /** Aggregated verdict from all agents */
  verdict: Verdict;
  /** Whether the verdict blocks the workflow */
  isBlocking: boolean;
  /** Human-readable reason for the verdict */
  reason: string;
  /** Individual agent verdicts keyed by agent name */
  agentResults: Record<string, AgentVerdict>;
  /** Agents that returned blocking verdicts */
  blockingAgents: string[];
  /** Agents that returned warning verdicts */
  warningAgents: string[];
  /** Agents that passed successfully */
  passingAgents: string[];
}

/**
 * Check if a verdict is blocking.
 */
function isBlockingVerdict(verdict: Verdict): boolean {
  return BLOCKING_VERDICTS.includes(verdict);
}

/**
 * Check if a verdict is a warning.
 */
function isWarningVerdict(verdict: Verdict): boolean {
  return WARNING_VERDICTS.includes(verdict);
}

/**
 * Build a reason string for blocking verdicts.
 */
function buildBlockingReason(
  blockingAgents: Array<{ agent: string; verdict: Verdict; details?: string }>
): string {
  if (blockingAgents.length === 0) {
    return "";
  }

  if (blockingAgents.length === 1) {
    const { agent, verdict, details } = blockingAgents[0];
    const base = `Blocked by ${agent} agent with ${verdict}`;
    return details ? `${base}: ${details}` : base;
  }

  const agentList = blockingAgents
    .map(({ agent, verdict }) => `${agent} (${verdict})`)
    .join(", ");
  return `Blocked by ${blockingAgents.length} agents: ${agentList}`;
}

/**
 * Build a reason string for warning verdicts.
 */
function buildWarningReason(
  warningAgents: Array<{ agent: string; verdict: Verdict; details?: string }>
): string {
  if (warningAgents.length === 0) {
    return "";
  }

  if (warningAgents.length === 1) {
    const { agent, verdict, details } = warningAgents[0];
    const base = `Warning from ${agent} agent with ${verdict}`;
    return details ? `${base}: ${details}` : base;
  }

  const agentList = warningAgents
    .map(({ agent, verdict }) => `${agent} (${verdict})`)
    .join(", ");
  return `Warnings from ${warningAgents.length} agents: ${agentList}`;
}

/**
 * Merge multiple agent verdicts into a single final verdict.
 *
 * Priority rules (highest to lowest):
 * 1. CRITICAL_FAIL - Any critical failure fails the workflow (blocking)
 * 2. REJECTED - Any rejection fails the workflow (blocking)
 * 3. FAIL - Any failure fails the workflow (blocking)
 * 4. NEEDS_REVIEW - Requires human review before proceeding (blocking)
 * 5. WARN - Passed with warnings (non-blocking)
 * 6. PARTIAL - Partially complete (non-blocking)
 * 7. COMPLIANT - All compliant (non-blocking)
 * 8. PASS - All passed (non-blocking)
 *
 * @param verdicts - Array of agent verdicts to aggregate
 * @returns FinalVerdict with aggregated result and metadata
 */
export function mergeVerdicts(verdicts: AgentVerdict[]): FinalVerdict {
  // Build agent results map and categorize agents
  const agentResults: Record<string, AgentVerdict> = {};
  const blockingAgentData: Array<{
    agent: string;
    verdict: Verdict;
    details?: string;
  }> = [];
  const warningAgentData: Array<{
    agent: string;
    verdict: Verdict;
    details?: string;
  }> = [];
  const passingAgents: string[] = [];

  for (const v of verdicts) {
    agentResults[v.agent] = v;

    if (isBlockingVerdict(v.verdict)) {
      blockingAgentData.push({
        agent: v.agent,
        verdict: v.verdict,
        details: v.details,
      });
    } else if (isWarningVerdict(v.verdict)) {
      warningAgentData.push({
        agent: v.agent,
        verdict: v.verdict,
        details: v.details,
      });
    } else {
      passingAgents.push(v.agent);
    }
  }

  // Determine final verdict based on priority
  let finalVerdict: Verdict;
  let isBlocking = false;
  let reason: string;

  if (blockingAgentData.length > 0) {
    // Find highest priority blocking verdict
    for (const blockingVerdict of BLOCKING_VERDICTS) {
      const found = blockingAgentData.find((a) => a.verdict === blockingVerdict);
      if (found) {
        finalVerdict = blockingVerdict;
        break;
      }
    }
    finalVerdict = finalVerdict! || "FAIL";
    isBlocking = true;
    reason = buildBlockingReason(blockingAgentData);
  } else if (warningAgentData.length > 0) {
    // Find highest priority warning verdict
    for (const warningVerdict of WARNING_VERDICTS) {
      const found = warningAgentData.find((a) => a.verdict === warningVerdict);
      if (found) {
        finalVerdict = warningVerdict;
        break;
      }
    }
    finalVerdict = finalVerdict! || "WARN";
    isBlocking = false;
    reason = buildWarningReason(warningAgentData);
  } else {
    // All agents passed - check if any are COMPLIANT
    const hasCompliant = verdicts.some((v) => v.verdict === "COMPLIANT");
    finalVerdict = hasCompliant ? "COMPLIANT" : "PASS";
    isBlocking = false;
    reason =
      verdicts.length === 0
        ? "No verdicts to aggregate"
        : `All ${verdicts.length} agents passed validation`;
  }

  return {
    verdict: finalVerdict,
    isBlocking,
    reason,
    agentResults,
    blockingAgents: blockingAgentData.map((a) => a.agent),
    warningAgents: warningAgentData.map((a) => a.agent),
    passingAgents,
  };
}

/**
 * Convenience function to check if a final verdict allows proceeding.
 */
export function canProceed(finalVerdict: FinalVerdict): boolean {
  return !finalVerdict.isBlocking;
}
