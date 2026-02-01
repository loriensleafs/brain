/**
 * Human-in-the-Loop (HITL) Approval Workflow
 *
 * Blocks execution until human approval is received or timeout expires.
 * Uses step.waitForEvent() to wait for approval/granted or approval/denied events.
 *
 * Timeout: 7 days - returns TIMEOUT status if no response received.
 */

import { logger } from "../../utils/internal/logger";
import { inngest } from "../client";

/**
 * Approval status values.
 */
export type ApprovalStatus = "APPROVED" | "DENIED" | "TIMEOUT";

/**
 * Result returned by the HITL approval workflow.
 */
export interface HitlApprovalResult {
  /** Status of the approval request */
  status: ApprovalStatus;
  /** The approval ID that was processed */
  approvalId: string;
  /** User who approved (only present if APPROVED) */
  approvedBy?: string;
  /** Comment from approver (only present if APPROVED) */
  comment?: string;
  /** User who denied (only present if DENIED) */
  deniedBy?: string;
  /** Reason for denial (only present if DENIED) */
  reason?: string;
}

/**
 * HITL Approval Workflow.
 *
 * Triggered by "approval/requested" event.
 * Waits for either "approval/granted" or "approval/denied" event.
 * Times out after 7 days with TIMEOUT status.
 *
 * Uses step.waitForEvent() with match on approvalId to correlate events.
 */
export const hitlApprovalWorkflow = inngest.createFunction(
  {
    id: "hitl-approval",
    name: "Human-in-the-Loop Approval",
  },
  { event: "approval/requested" },
  async ({ event, step }): Promise<HitlApprovalResult> => {
    const { approvalId, approvalType, description } = event.data;

    logger.info(
      { approvalId, approvalType, description },
      "HITL approval workflow started - waiting for human response",
    );

    // Wait for approval/granted event with matching approvalId
    // Uses step.waitForEvent() which blocks until event received or timeout
    const approval = await step.waitForEvent("wait-for-approval", {
      event: "approval/granted",
      timeout: "7d",
      match: "data.approvalId",
    });

    // If approval received, return APPROVED status
    if (approval) {
      logger.info(
        { approvalId, approvedBy: approval.data.approvedBy },
        "HITL approval granted",
      );

      return {
        status: "APPROVED",
        approvalId,
        approvedBy: approval.data.approvedBy,
        comment: approval.data.comment,
      };
    }

    // Timeout occurred - no approval received within 7 days
    logger.warn({ approvalId }, "HITL approval timed out after 7 days");

    return {
      status: "TIMEOUT",
      approvalId,
    };
  },
);
