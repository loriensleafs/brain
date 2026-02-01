/**
 * Tests for agent step functions error handling.
 */

import { NonRetriableError } from "inngest";
import { describe, expect, test } from "vitest";
import { runAnalystAgent } from "../agents/analyst";
import { runArchitectAgent } from "../agents/architect";
import { runQaAgent } from "../agents/qa";
import { runRoadmapAgent } from "../agents/roadmap";

describe("Agent Error Handling", () => {
  const validFeatureId = "feature-123";
  const emptyContext = {};

  describe("runQaAgent", () => {
    test("returns PASS verdict for valid feature ID", async () => {
      const result = await runQaAgent(validFeatureId, emptyContext);

      expect(result.agent).toBe("qa");
      expect(result.verdict).toBe("PASS");
    });

    test("throws NonRetriableError for empty feature ID", async () => {
      try {
        await runQaAgent("", emptyContext);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(NonRetriableError);
      }
    });

    test("throws NonRetriableError for whitespace feature ID", async () => {
      try {
        await runQaAgent("   ", emptyContext);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(NonRetriableError);
      }
    });

    test("throws NonRetriableError for null feature ID", async () => {
      try {
        await runQaAgent(null as unknown as string, emptyContext);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(NonRetriableError);
      }
    });

    test("throws NonRetriableError for undefined feature ID", async () => {
      try {
        await runQaAgent(undefined as unknown as string, emptyContext);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(NonRetriableError);
      }
    });
  });

  describe("runAnalystAgent", () => {
    test("returns PASS verdict for valid feature ID", async () => {
      const result = await runAnalystAgent(validFeatureId, emptyContext);

      expect(result.agent).toBe("analyst");
      expect(result.verdict).toBe("PASS");
    });

    test("throws NonRetriableError for empty feature ID", async () => {
      try {
        await runAnalystAgent("", emptyContext);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(NonRetriableError);
      }
    });

    test("throws NonRetriableError for whitespace feature ID", async () => {
      try {
        await runAnalystAgent("   ", emptyContext);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(NonRetriableError);
      }
    });
  });

  describe("runArchitectAgent", () => {
    test("returns PASS verdict for valid feature ID", async () => {
      const result = await runArchitectAgent(validFeatureId, emptyContext);

      expect(result.agent).toBe("architect");
      expect(result.verdict).toBe("PASS");
    });

    test("throws NonRetriableError for empty feature ID", async () => {
      try {
        await runArchitectAgent("", emptyContext);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(NonRetriableError);
      }
    });

    test("throws NonRetriableError for null feature ID", async () => {
      try {
        await runArchitectAgent(null as unknown as string, emptyContext);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(NonRetriableError);
      }
    });
  });

  describe("runRoadmapAgent", () => {
    test("returns PASS verdict for valid feature ID", async () => {
      const result = await runRoadmapAgent(validFeatureId, emptyContext);

      expect(result.agent).toBe("roadmap");
      expect(result.verdict).toBe("PASS");
    });

    test("throws NonRetriableError for empty feature ID", async () => {
      try {
        await runRoadmapAgent("", emptyContext);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(NonRetriableError);
      }
    });

    test("throws NonRetriableError for undefined feature ID", async () => {
      try {
        await runRoadmapAgent(undefined as unknown as string, emptyContext);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(NonRetriableError);
      }
    });
  });

  describe("Error message content", () => {
    test("error message contains VALIDATION_ERROR type", async () => {
      try {
        await runQaAgent("", emptyContext);
      } catch (error) {
        expect(error).toBeInstanceOf(NonRetriableError);
        expect((error as Error).message).toContain("VALIDATION_ERROR");
      }
    });

    test("error message indicates feature ID requirement", async () => {
      try {
        await runAnalystAgent("", emptyContext);
      } catch (error) {
        expect(error).toBeInstanceOf(NonRetriableError);
        expect((error as Error).message.toLowerCase()).toContain("feature");
      }
    });
  });

  describe("Context handling", () => {
    test("accepts context with additional properties", async () => {
      const context = { projectRoot: "/project", branch: "main" };
      const result = await runQaAgent(validFeatureId, context);

      expect(result.verdict).toBe("PASS");
    });

    test("accepts empty context object", async () => {
      const result = await runArchitectAgent(validFeatureId, {});

      expect(result.verdict).toBe("PASS");
    });
  });
});
