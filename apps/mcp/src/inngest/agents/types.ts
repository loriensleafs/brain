/**
 * Agent verdict types for feature completion workflow.
 *
 * Each agent returns a verdict indicating the validation result.
 */

/**
 * Possible verdict values from agent validation.
 *
 * - PASS: Validation successful, no issues
 * - WARN: Validation passed with warnings
 * - FAIL: Validation failed
 * - NEEDS_REVIEW: Requires human review
 * - COMPLIANT: Meets compliance requirements
 * - PARTIAL: Partially complete
 * - REJECTED: Explicitly rejected
 * - CRITICAL_FAIL: Critical failure requiring immediate attention
 */
export type Verdict =
  | "PASS"
  | "WARN"
  | "FAIL"
  | "NEEDS_REVIEW"
  | "COMPLIANT"
  | "PARTIAL"
  | "REJECTED"
  | "CRITICAL_FAIL";

/**
 * Result structure returned by each agent.
 */
export interface AgentVerdict {
  /** Name of the agent that produced this verdict */
  agent: string;
  /** Validation verdict */
  verdict: Verdict;
  /** Optional details explaining the verdict */
  details?: string;
}

/**
 * Context passed to each agent for validation.
 */
export interface AgentContext {
  /** Unique identifier for the feature being validated */
  featureId: string;
  /** Additional context data */
  context: Record<string, unknown>;
}

/**
 * Function signature for agent validation steps.
 */
export type AgentFunction = (
  featureId: string,
  context: Record<string, unknown>
) => Promise<AgentVerdict>;
