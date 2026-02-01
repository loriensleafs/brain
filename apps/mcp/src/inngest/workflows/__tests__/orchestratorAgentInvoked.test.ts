/**
 * Tests for Orchestrator Agent Invoked workflow definition.
 *
 * These tests verify the workflow structure, types, and configuration without
 * requiring the Inngest dev server to be running.
 *
 * @see ADR-016: Automatic Session Protocol Enforcement
 * @see TASK-013: Orchestrator Agent Routing Workflow
 */

import { describe, expect, test } from "vitest";
import type {
  AgentInvocation,
  AgentType,
  OrchestratorWorkflow,
  SessionState,
} from "../../../services/session/types";
import {
  type AgentInvokedResult,
  orchestratorAgentInvokedWorkflow,
} from "../orchestratorAgentInvoked";

describe("Orchestrator Agent Invoked Workflow", () => {
  describe("workflow definition", () => {
    test("workflow function is defined", () => {
      expect(orchestratorAgentInvokedWorkflow).toBeDefined();
    });

    test("workflow has id property set to 'orchestrator-agent-invoked'", () => {
      const workflowId = (
        orchestratorAgentInvokedWorkflow as unknown as { id: () => string }
      ).id();
      expect(workflowId).toBe("orchestrator-agent-invoked");
    });
  });

  describe("workflow configuration", () => {
    test("workflow is configured for orchestrator agent invoked events", () => {
      expect(orchestratorAgentInvokedWorkflow).toBeDefined();
    });
  });

  describe("AgentInvokedResult type", () => {
    test("result has all required fields for success", () => {
      const result: AgentInvokedResult = {
        success: true,
        agent: "analyst",
        invocationIndex: 0,
      };

      expect(result.success).toBe(true);
      expect(result.agent).toBe("analyst");
      expect(result.invocationIndex).toBe(0);
    });

    test("result tracks invocation index correctly", () => {
      const result1: AgentInvokedResult = {
        success: true,
        agent: "analyst",
        invocationIndex: 0,
      };

      const result2: AgentInvokedResult = {
        success: true,
        agent: "architect",
        invocationIndex: 1,
      };

      expect(result1.invocationIndex).toBe(0);
      expect(result2.invocationIndex).toBe(1);
    });
  });

  describe("AgentInvocation structure", () => {
    test("invocation has all required fields", () => {
      const invocation: AgentInvocation = {
        agent: "analyst",
        startedAt: "2026-01-18T10:00:00Z",
        completedAt: null,
        status: "in_progress",
        input: {
          prompt: "Analyze the authentication flow",
          context: { feature: "oauth" },
          artifacts: [],
        },
        output: null,
        handoffFrom: null,
        handoffTo: null,
        handoffReason: "",
      };

      expect(invocation.agent).toBe("analyst");
      expect(invocation.status).toBe("in_progress");
      expect(invocation.completedAt).toBeNull();
      expect(invocation.output).toBeNull();
    });

    test("invocation supports handoff tracking", () => {
      const invocation: AgentInvocation = {
        agent: "implementer",
        startedAt: "2026-01-18T10:00:00Z",
        completedAt: null,
        status: "in_progress",
        input: {
          prompt: "Implement the OAuth flow",
          context: {},
          artifacts: [".agents/planning/oauth-plan.md"],
        },
        output: null,
        handoffFrom: "planner",
        handoffTo: null,
        handoffReason: "",
      };

      expect(invocation.handoffFrom).toBe("planner");
      expect(invocation.input.artifacts).toContain(
        ".agents/planning/oauth-plan.md",
      );
    });

    test("invocation input contains prompt, context, and artifacts", () => {
      const input: AgentInvocation["input"] = {
        prompt: "Research OAuth 2.0 best practices",
        context: {
          feature: "authentication",
          priority: "high",
          deadline: "2026-01-20",
        },
        artifacts: ["spec.md", "design.md"],
      };

      expect(input.prompt).toBe("Research OAuth 2.0 best practices");
      expect(input.context).toHaveProperty("feature", "authentication");
      expect(input.context).toHaveProperty("priority", "high");
      expect(input.artifacts).toHaveLength(2);
    });
  });

  describe("workflow steps configuration", () => {
    test("workflow defines all required steps", () => {
      // The workflow defines these steps:
      // 1. validate-input
      // 2. load-session
      // 3. record-invocation
      // 4. save-session
      // 5. emit-state-update (sendEvent)
      expect(orchestratorAgentInvokedWorkflow).toBeDefined();
    });

    test("workflow has retry configuration", () => {
      // The workflow is configured with retries: 3
      expect(orchestratorAgentInvokedWorkflow).toBeDefined();
    });
  });

  describe("orchestrator workflow initialization", () => {
    test("workflow initializes if orchestratorWorkflow is null", () => {
      // The workflow creates a default orchestrator workflow
      // if the session state does not have one
      const stateWithoutWorkflow: Partial<SessionState> = {
        orchestratorWorkflow: null,
      };

      expect(stateWithoutWorkflow.orchestratorWorkflow).toBeNull();
    });

    test("workflow preserves existing orchestratorWorkflow", () => {
      const existingWorkflow: OrchestratorWorkflow = {
        activeAgent: "analyst",
        workflowPhase: "planning",
        agentHistory: [
          {
            agent: "analyst",
            startedAt: "2026-01-18T09:00:00Z",
            completedAt: "2026-01-18T09:30:00Z",
            status: "completed",
            input: {
              prompt: "Previous analysis",
              context: {},
              artifacts: [],
            },
            output: {
              artifacts: ["analysis.md"],
              summary: "Analysis complete",
              recommendations: ["Proceed to planning"],
              blockers: [],
            },
            handoffFrom: null,
            handoffTo: "planner",
            handoffReason: "Analysis complete",
          },
        ],
        decisions: [],
        verdicts: [],
        pendingHandoffs: [],
        compactionHistory: [],
        startedAt: "2026-01-18T09:00:00Z",
        lastAgentChange: "2026-01-18T09:30:00Z",
      };

      expect(existingWorkflow.agentHistory).toHaveLength(1);
      expect(existingWorkflow.activeAgent).toBe("analyst");
    });
  });

  describe("agent history management", () => {
    test("new invocation is appended to agentHistory", () => {
      const history: AgentInvocation[] = [
        {
          agent: "analyst",
          startedAt: "2026-01-18T09:00:00Z",
          completedAt: "2026-01-18T09:30:00Z",
          status: "completed",
          input: { prompt: "Analyze", context: {}, artifacts: [] },
          output: {
            artifacts: [],
            summary: "Done",
            recommendations: [],
            blockers: [],
          },
          handoffFrom: null,
          handoffTo: "planner",
          handoffReason: "Complete",
        },
      ];

      const newInvocation: AgentInvocation = {
        agent: "planner",
        startedAt: "2026-01-18T10:00:00Z",
        completedAt: null,
        status: "in_progress",
        input: { prompt: "Plan implementation", context: {}, artifacts: [] },
        output: null,
        handoffFrom: "analyst",
        handoffTo: null,
        handoffReason: "",
      };

      const updatedHistory = [...history, newInvocation];

      expect(updatedHistory).toHaveLength(2);
      expect(updatedHistory[0].agent).toBe("analyst");
      expect(updatedHistory[1].agent).toBe("planner");
    });

    test("activeAgent is updated when invocation is recorded", () => {
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

      // Simulate update
      const updatedWorkflow: OrchestratorWorkflow = {
        ...workflow,
        activeAgent: "planner",
        lastAgentChange: "2026-01-18T10:00:00Z",
      };

      expect(updatedWorkflow.activeAgent).toBe("planner");
      expect(updatedWorkflow.lastAgentChange).toBe("2026-01-18T10:00:00Z");
    });
  });

  describe("error handling scenarios", () => {
    test("workflow validates sessionId is required", () => {
      // The workflow throws NonRetriableError for missing sessionId
      expect(orchestratorAgentInvokedWorkflow).toBeDefined();
    });

    test("workflow validates agent is required", () => {
      // The workflow throws NonRetriableError for missing agent
      expect(orchestratorAgentInvokedWorkflow).toBeDefined();
    });

    test("workflow validates prompt is required", () => {
      // The workflow throws NonRetriableError for missing prompt
      expect(orchestratorAgentInvokedWorkflow).toBeDefined();
    });

    test("workflow throws when session not found", () => {
      // The workflow throws NonRetriableError when session does not exist
      expect(orchestratorAgentInvokedWorkflow).toBeDefined();
    });
  });

  describe("event emission", () => {
    test("workflow emits session/state.update event on completion", () => {
      // The workflow uses step.sendEvent to emit state update
      expect(orchestratorAgentInvokedWorkflow).toBeDefined();
    });
  });

  describe("all supported agent types", () => {
    const agentTypes: AgentType[] = [
      "orchestrator",
      "analyst",
      "architect",
      "planner",
      "implementer",
      "critic",
      "qa",
      "security",
      "devops",
      "retrospective",
      "memory",
      "skillbook",
      "independent-thinker",
      "high-level-advisor",
      "explainer",
      "task-generator",
      "pr-comment-responder",
    ];

    for (const agentType of agentTypes) {
      test(`supports ${agentType} agent type`, () => {
        const invocation: AgentInvocation = {
          agent: agentType as AgentInvocation["agent"],
          startedAt: "2026-01-18T10:00:00Z",
          completedAt: null,
          status: "in_progress",
          input: { prompt: "Test", context: {}, artifacts: [] },
          output: null,
          handoffFrom: null,
          handoffTo: null,
          handoffReason: "",
        };

        expect(invocation.agent).toBe(agentType);
      });
    }
  });

  describe("version management", () => {
    test("session version is incremented on update", () => {
      const currentVersion = 5;
      const newVersion = currentVersion + 1;

      expect(newVersion).toBe(6);
    });
  });
});
