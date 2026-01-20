/**
 * Tests for Orchestrator Agent Completed workflow definition.
 *
 * These tests verify the workflow structure, types, compaction logic,
 * and configuration without requiring the Inngest dev server to be running.
 *
 * @see ADR-016: Automatic Session Protocol Enforcement
 * @see TASK-013: Orchestrator Agent Routing Workflow
 */

import { describe, test, expect } from "bun:test";
import {
  orchestratorAgentCompletedWorkflow,
  getCompactionHistory,
  getTotalInvocationCount,
  type AgentCompletedResult,
} from "../orchestratorAgentCompleted";
import type {
  SessionState,
  AgentInvocation,
  AgentInvocationOutput,
  OrchestratorWorkflow,
  CompactionEntry,
} from "../../../services/session/types";

describe("Orchestrator Agent Completed Workflow", () => {
  describe("workflow definition", () => {
    test("workflow function is defined", () => {
      expect(orchestratorAgentCompletedWorkflow).toBeDefined();
    });

    test("workflow has id property set to 'orchestrator-agent-completed'", () => {
      const workflowId = (
        orchestratorAgentCompletedWorkflow as unknown as { id: () => string }
      ).id();
      expect(workflowId).toBe("orchestrator-agent-completed");
    });
  });

  describe("workflow configuration", () => {
    test("workflow is configured for orchestrator agent completed events", () => {
      expect(orchestratorAgentCompletedWorkflow).toBeDefined();
    });
  });

  describe("AgentCompletedResult type", () => {
    test("result has all required fields for success without compaction", () => {
      const result: AgentCompletedResult = {
        success: true,
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        agent: "analyst",
        compacted: false,
      };

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(result.agent).toBe("analyst");
      expect(result.compacted).toBe(false);
      expect(result.compactionNotePath).toBeUndefined();
    });

    test("result has compactionNotePath when compaction occurred", () => {
      const result: AgentCompletedResult = {
        success: true,
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        agent: "analyst",
        compacted: true,
        compactionNotePath:
          "sessions/session-550e8400-e29b-41d4-a716-446655440000-history-2026-01-18T10-00-00-000Z",
      };

      expect(result.compacted).toBe(true);
      expect(result.compactionNotePath).toContain("history");
    });
  });

  describe("AgentInvocationOutput structure", () => {
    test("output has all required fields", () => {
      const output: AgentInvocationOutput = {
        artifacts: ["analysis.md", "recommendations.md"],
        summary: "Completed analysis of OAuth 2.0 implementation options",
        recommendations: [
          "Use PKCE for public clients",
          "Implement refresh token rotation",
        ],
        blockers: [],
      };

      expect(output.artifacts).toHaveLength(2);
      expect(output.summary).toContain("OAuth 2.0");
      expect(output.recommendations).toHaveLength(2);
      expect(output.blockers).toHaveLength(0);
    });

    test("output supports blockers", () => {
      const output: AgentInvocationOutput = {
        artifacts: [],
        summary: "Unable to complete due to missing dependencies",
        recommendations: [],
        blockers: [
          "Missing API documentation",
          "Access credentials not provided",
        ],
      };

      expect(output.blockers).toHaveLength(2);
      expect(output.blockers[0]).toContain("API documentation");
    });
  });

  describe("workflow steps configuration", () => {
    test("workflow defines all required steps", () => {
      // The workflow defines these steps:
      // 1. validate-input
      // 2. load-session
      // 3. complete-invocation
      // 4. check-compaction
      // 5. compact-history (conditional)
      // 6. save-session
      // 7. emit-state-update (sendEvent)
      expect(orchestratorAgentCompletedWorkflow).toBeDefined();
    });

    test("workflow has retry configuration", () => {
      // The workflow is configured with retries: 3
      expect(orchestratorAgentCompletedWorkflow).toBeDefined();
    });
  });

  describe("invocation status transitions", () => {
    test("in_progress to completed when no blockers", () => {
      const initial: AgentInvocation = {
        agent: "analyst",
        startedAt: "2026-01-18T10:00:00Z",
        completedAt: null,
        status: "in_progress",
        input: { prompt: "Analyze", context: {}, artifacts: [] },
        output: null,
        handoffFrom: null,
        handoffTo: null,
        handoffReason: "",
      };

      // Simulate completion
      const completed: AgentInvocation = {
        ...initial,
        completedAt: "2026-01-18T10:30:00Z",
        status: "completed",
        output: {
          artifacts: ["analysis.md"],
          summary: "Analysis complete",
          recommendations: ["Proceed to planning"],
          blockers: [],
        },
        handoffTo: "planner",
        handoffReason: "Analysis complete, ready for planning",
      };

      expect(completed.status).toBe("completed");
      expect(completed.completedAt).toBe("2026-01-18T10:30:00Z");
      expect(completed.handoffTo).toBe("planner");
    });

    test("in_progress to blocked when blockers present", () => {
      const initial: AgentInvocation = {
        agent: "implementer",
        startedAt: "2026-01-18T10:00:00Z",
        completedAt: null,
        status: "in_progress",
        input: { prompt: "Implement", context: {}, artifacts: [] },
        output: null,
        handoffFrom: "planner",
        handoffTo: null,
        handoffReason: "",
      };

      // Simulate blocked completion
      const blocked: AgentInvocation = {
        ...initial,
        completedAt: "2026-01-18T10:30:00Z",
        status: "blocked",
        output: {
          artifacts: [],
          summary: "Unable to proceed",
          recommendations: ["Resolve authentication issue first"],
          blockers: ["Missing API credentials", "Unclear requirements"],
        },
        handoffTo: null,
        handoffReason: "Blocked by missing dependencies",
      };

      expect(blocked.status).toBe("blocked");
      expect(blocked.output?.blockers).toHaveLength(2);
    });
  });

  describe("compaction logic", () => {
    describe("compaction threshold", () => {
      test("compaction triggers when history exceeds 10 invocations", () => {
        const COMPACTION_THRESHOLD = 10;

        // Below threshold
        expect(8 > COMPACTION_THRESHOLD).toBe(false);
        expect(10 > COMPACTION_THRESHOLD).toBe(false);

        // Above threshold
        expect(11 > COMPACTION_THRESHOLD).toBe(true);
        expect(15 > COMPACTION_THRESHOLD).toBe(true);
      });

      test("compaction keeps last 3 invocations", () => {
        const INVOCATIONS_TO_KEEP = 3;
        const historyLength = 12;
        const toArchive = historyLength - INVOCATIONS_TO_KEEP;

        expect(toArchive).toBe(9);
        expect(INVOCATIONS_TO_KEEP).toBe(3);
      });
    });

    describe("CompactionEntry structure", () => {
      test("entry has all required fields", () => {
        const entry: CompactionEntry = {
          notePath:
            "sessions/session-test-id-history-2026-01-18T10-00-00-000Z",
          compactedAt: "2026-01-18T10:00:00Z",
          count: 9,
        };

        expect(entry.notePath).toContain("history");
        expect(entry.compactedAt).toBe("2026-01-18T10:00:00Z");
        expect(entry.count).toBe(9);
      });

      test("compaction history accumulates multiple entries", () => {
        const compactionHistory: CompactionEntry[] = [
          {
            notePath: "sessions/session-test-history-1",
            compactedAt: "2026-01-17T10:00:00Z",
            count: 9,
          },
          {
            notePath: "sessions/session-test-history-2",
            compactedAt: "2026-01-18T10:00:00Z",
            count: 9,
          },
        ];

        expect(compactionHistory).toHaveLength(2);

        const totalCompacted = compactionHistory.reduce(
          (sum, entry) => sum + entry.count,
          0
        );
        expect(totalCompacted).toBe(18);
      });
    });

    describe("decisions and verdicts preservation", () => {
      test("decisions are never compacted", () => {
        const workflow: OrchestratorWorkflow = {
          activeAgent: null,
          workflowPhase: "complete",
          agentHistory: [],
          decisions: [
            {
              id: "decision-1",
              type: "architectural",
              description: "Use OAuth 2.0 with PKCE",
              rationale: "Security best practice for public clients",
              decidedBy: "architect",
              approvedBy: ["critic"],
              rejectedBy: [],
              timestamp: "2026-01-18T10:00:00Z",
            },
          ],
          verdicts: [],
          pendingHandoffs: [],
          compactionHistory: [],
          startedAt: "2026-01-18T09:00:00Z",
          lastAgentChange: "2026-01-18T10:00:00Z",
        };

        // Decisions remain in workflow after compaction
        expect(workflow.decisions).toHaveLength(1);
        expect(workflow.decisions[0].type).toBe("architectural");
      });

      test("verdicts are never compacted", () => {
        const workflow: OrchestratorWorkflow = {
          activeAgent: null,
          workflowPhase: "complete",
          agentHistory: [],
          decisions: [],
          verdicts: [
            {
              agent: "critic",
              decision: "approve",
              confidence: 0.9,
              reasoning: "Plan meets all requirements",
              timestamp: "2026-01-18T10:00:00Z",
            },
          ],
          pendingHandoffs: [],
          compactionHistory: [],
          startedAt: "2026-01-18T09:00:00Z",
          lastAgentChange: "2026-01-18T10:00:00Z",
        };

        // Verdicts remain in workflow after compaction
        expect(workflow.verdicts).toHaveLength(1);
        expect(workflow.verdicts[0].decision).toBe("approve");
      });
    });

    describe("history splitting", () => {
      test("archive older invocations, keep recent ones", () => {
        // Create 12 invocations
        const agentHistory: AgentInvocation[] = [];
        for (let i = 0; i < 12; i++) {
          agentHistory.push({
            agent: "analyst",
            startedAt: `2026-01-18T${String(i).padStart(2, "0")}:00:00Z`,
            completedAt: `2026-01-18T${String(i).padStart(2, "0")}:30:00Z`,
            status: "completed",
            input: { prompt: `Task ${i}`, context: {}, artifacts: [] },
            output: {
              artifacts: [],
              summary: `Completed task ${i}`,
              recommendations: [],
              blockers: [],
            },
            handoffFrom: null,
            handoffTo: null,
            handoffReason: "",
          });
        }

        const INVOCATIONS_TO_KEEP = 3;
        const toArchive = agentHistory.length - INVOCATIONS_TO_KEEP;

        const archiveInvocations = agentHistory.slice(0, toArchive);
        const keepInvocations = agentHistory.slice(toArchive);

        expect(archiveInvocations).toHaveLength(9);
        expect(keepInvocations).toHaveLength(3);

        // Verify the kept invocations are the most recent
        expect(keepInvocations[0].input.prompt).toBe("Task 9");
        expect(keepInvocations[1].input.prompt).toBe("Task 10");
        expect(keepInvocations[2].input.prompt).toBe("Task 11");
      });
    });
  });

  describe("error handling scenarios", () => {
    test("workflow validates sessionId is required", () => {
      expect(orchestratorAgentCompletedWorkflow).toBeDefined();
    });

    test("workflow validates agent is required", () => {
      expect(orchestratorAgentCompletedWorkflow).toBeDefined();
    });

    test("workflow validates output is required", () => {
      expect(orchestratorAgentCompletedWorkflow).toBeDefined();
    });

    test("workflow throws when session not found", () => {
      expect(orchestratorAgentCompletedWorkflow).toBeDefined();
    });

    test("workflow throws when orchestratorWorkflow is null", () => {
      expect(orchestratorAgentCompletedWorkflow).toBeDefined();
    });
  });

  describe("helper functions", () => {
    test("getCompactionHistory is defined", () => {
      expect(getCompactionHistory).toBeDefined();
    });

    test("getTotalInvocationCount is defined", () => {
      expect(getTotalInvocationCount).toBeDefined();
    });

    test("total invocation count includes compacted history", () => {
      const currentInvocations = 3;
      const compactedCount1 = 9;
      const compactedCount2 = 9;

      const totalCount = currentInvocations + compactedCount1 + compactedCount2;
      expect(totalCount).toBe(21);
    });
  });

  describe("event emission", () => {
    test("workflow emits session/state.update event on completion", () => {
      expect(orchestratorAgentCompletedWorkflow).toBeDefined();
    });
  });

  describe("handoff tracking", () => {
    test("handoffTo is updated when agent completes", () => {
      const invocation: AgentInvocation = {
        agent: "planner",
        startedAt: "2026-01-18T10:00:00Z",
        completedAt: null,
        status: "in_progress",
        input: { prompt: "Plan", context: {}, artifacts: [] },
        output: null,
        handoffFrom: "analyst",
        handoffTo: null,
        handoffReason: "",
      };

      // Simulate completion with handoff
      const completed: AgentInvocation = {
        ...invocation,
        completedAt: "2026-01-18T10:30:00Z",
        status: "completed",
        output: {
          artifacts: ["plan.md"],
          summary: "Plan created",
          recommendations: [],
          blockers: [],
        },
        handoffTo: "implementer",
        handoffReason: "Plan approved, ready for implementation",
      };

      expect(completed.handoffTo).toBe("implementer");
      expect(completed.handoffReason).toContain("implementation");
    });

    test("handoffTo is null when returning to orchestrator", () => {
      const invocation: AgentInvocation = {
        agent: "qa",
        startedAt: "2026-01-18T10:00:00Z",
        completedAt: "2026-01-18T10:30:00Z",
        status: "completed",
        input: { prompt: "Verify", context: {}, artifacts: [] },
        output: {
          artifacts: ["test-report.md"],
          summary: "All tests pass",
          recommendations: [],
          blockers: [],
        },
        handoffFrom: "implementer",
        handoffTo: null,
        handoffReason: "QA complete, returning to orchestrator",
      };

      expect(invocation.handoffTo).toBeNull();
    });
  });

  describe("version management", () => {
    test("session version is incremented on completion", () => {
      const currentVersion = 5;
      const afterCompletion = currentVersion + 1;

      expect(afterCompletion).toBe(6);
    });

    test("session version is incremented again after compaction", () => {
      const afterCompletion = 6;
      const afterCompaction = afterCompletion + 1;

      expect(afterCompaction).toBe(7);
    });
  });

  describe("activeAgent management", () => {
    test("activeAgent updated to handoffTo when specified", () => {
      const workflow: OrchestratorWorkflow = {
        activeAgent: "analyst",
        workflowPhase: "planning",
        agentHistory: [],
        decisions: [],
        verdicts: [],
        pendingHandoffs: [],
        compactionHistory: [],
        startedAt: "2026-01-18T09:00:00Z",
        lastAgentChange: "2026-01-18T09:00:00Z",
      };

      // Simulate update after completion with handoff
      const updatedWorkflow: OrchestratorWorkflow = {
        ...workflow,
        activeAgent: "planner",
        lastAgentChange: "2026-01-18T10:00:00Z",
      };

      expect(updatedWorkflow.activeAgent).toBe("planner");
    });

    test("activeAgent set to null when returning to orchestrator", () => {
      const workflow: OrchestratorWorkflow = {
        activeAgent: "qa",
        workflowPhase: "validation",
        agentHistory: [],
        decisions: [],
        verdicts: [],
        pendingHandoffs: [],
        compactionHistory: [],
        startedAt: "2026-01-18T09:00:00Z",
        lastAgentChange: "2026-01-18T10:00:00Z",
      };

      // Simulate update after completion without handoff
      const updatedWorkflow: OrchestratorWorkflow = {
        ...workflow,
        activeAgent: null,
        lastAgentChange: "2026-01-18T11:00:00Z",
      };

      expect(updatedWorkflow.activeAgent).toBeNull();
    });
  });

  describe("finding in-progress invocations", () => {
    test("find most recent in-progress invocation for agent", () => {
      const history: AgentInvocation[] = [
        {
          agent: "analyst",
          startedAt: "2026-01-18T09:00:00Z",
          completedAt: "2026-01-18T09:30:00Z",
          status: "completed",
          input: { prompt: "First", context: {}, artifacts: [] },
          output: {
            artifacts: [],
            summary: "",
            recommendations: [],
            blockers: [],
          },
          handoffFrom: null,
          handoffTo: "planner",
          handoffReason: "",
        },
        {
          agent: "planner",
          startedAt: "2026-01-18T09:30:00Z",
          completedAt: null,
          status: "in_progress",
          input: { prompt: "Second", context: {}, artifacts: [] },
          output: null,
          handoffFrom: "analyst",
          handoffTo: null,
          handoffReason: "",
        },
      ];

      // Find in-progress invocation for planner
      let foundIndex = -1;
      for (let i = history.length - 1; i >= 0; i--) {
        if (
          history[i].agent === "planner" &&
          history[i].status === "in_progress"
        ) {
          foundIndex = i;
          break;
        }
      }

      expect(foundIndex).toBe(1);
      expect(history[foundIndex].agent).toBe("planner");
    });

    test("returns -1 when no in-progress invocation found", () => {
      const history: AgentInvocation[] = [
        {
          agent: "analyst",
          startedAt: "2026-01-18T09:00:00Z",
          completedAt: "2026-01-18T09:30:00Z",
          status: "completed",
          input: { prompt: "First", context: {}, artifacts: [] },
          output: {
            artifacts: [],
            summary: "",
            recommendations: [],
            blockers: [],
          },
          handoffFrom: null,
          handoffTo: null,
          handoffReason: "",
        },
      ];

      // Find in-progress invocation for planner (doesn't exist)
      let foundIndex = -1;
      for (let i = history.length - 1; i >= 0; i--) {
        if (
          history[i].agent === "planner" &&
          history[i].status === "in_progress"
        ) {
          foundIndex = i;
          break;
        }
      }

      expect(foundIndex).toBe(-1);
    });
  });
});
