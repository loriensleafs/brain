/**
 * Tests for Inngest error handling utilities.
 */

import { describe, test, expect } from "vitest";
import { NonRetriableError } from "inngest";
import {
  createNonRetriableError,
  isRetriable,
  validateFeatureId,
  validateRequiredContext,
  wrapAgentExecution,
  WorkflowErrorType,
} from "../errors";

describe("WorkflowErrorType", () => {
  test("defines VALIDATION_ERROR constant", () => {
    expect(WorkflowErrorType.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
  });

  test("defines CONFIGURATION_ERROR constant", () => {
    expect(WorkflowErrorType.CONFIGURATION_ERROR).toBe("CONFIGURATION_ERROR");
  });

  test("defines AGENT_FAILURE constant", () => {
    expect(WorkflowErrorType.AGENT_FAILURE).toBe("AGENT_FAILURE");
  });
});

describe("createNonRetriableError", () => {
  test("creates NonRetriableError with type prefix in message", () => {
    const error = createNonRetriableError(
      WorkflowErrorType.VALIDATION_ERROR,
      "Feature ID is required"
    );

    expect(error).toBeInstanceOf(NonRetriableError);
    expect(error.message).toBe("[VALIDATION_ERROR] Feature ID is required");
  });

  test("creates NonRetriableError with cause", () => {
    const originalError = new Error("Original error");
    const error = createNonRetriableError(
      WorkflowErrorType.AGENT_FAILURE,
      "Agent failed",
      { cause: originalError }
    );

    expect(error).toBeInstanceOf(NonRetriableError);
    expect(error.cause).toBeDefined();
  });

  test("creates NonRetriableError with context", () => {
    const error = createNonRetriableError(
      WorkflowErrorType.CONFIGURATION_ERROR,
      "Missing config",
      { context: { configKey: "API_KEY" } }
    );

    expect(error).toBeInstanceOf(NonRetriableError);
  });

  test("creates NonRetriableError with both cause and context", () => {
    const originalError = new Error("Config read failed");
    const error = createNonRetriableError(
      WorkflowErrorType.CONFIGURATION_ERROR,
      "Config loading failed",
      { cause: originalError, context: { filePath: "/etc/config.json" } }
    );

    expect(error).toBeInstanceOf(NonRetriableError);
    expect(error.message).toBe("[CONFIGURATION_ERROR] Config loading failed");
  });
});

describe("isRetriable", () => {
  test("returns false for NonRetriableError", () => {
    const error = new NonRetriableError("Not retriable");
    expect(isRetriable(error)).toBe(false);
  });

  test("returns false for errors matching non-retriable patterns", () => {
    const patterns = [
      new Error("invalid feature id"),
      new Error("Feature not found"),
      new Error("Missing required field"),
      new Error("Configuration error occurred"),
      new Error("Validation failed"),
    ];

    patterns.forEach((error) => {
      expect(isRetriable(error)).toBe(false);
    });
  });

  test("returns true for generic errors", () => {
    const error = new Error("Network timeout");
    expect(isRetriable(error)).toBe(true);
  });

  test("returns true for unknown error types", () => {
    expect(isRetriable("string error")).toBe(true);
    expect(isRetriable(null)).toBe(true);
    expect(isRetriable(undefined)).toBe(true);
    expect(isRetriable(42)).toBe(true);
  });

  test("returns true for retriable error messages", () => {
    const retriableErrors = [
      new Error("Network timeout"),
      new Error("Connection refused"),
      new Error("Service unavailable"),
      new Error("Rate limited"),
    ];

    retriableErrors.forEach((error) => {
      expect(isRetriable(error)).toBe(true);
    });
  });
});

describe("validateFeatureId", () => {
  test("accepts valid feature ID", () => {
    expect(() => validateFeatureId("feature-123", "qa")).not.toThrow();
  });

  test("throws NonRetriableError for empty string", () => {
    expect(() => validateFeatureId("", "qa")).toThrow(NonRetriableError);
  });

  test("throws NonRetriableError for whitespace-only string", () => {
    expect(() => validateFeatureId("   ", "qa")).toThrow(NonRetriableError);
  });

  test("throws NonRetriableError for null-ish values", () => {
    expect(() =>
      validateFeatureId(null as unknown as string, "qa")
    ).toThrow(NonRetriableError);
    expect(() =>
      validateFeatureId(undefined as unknown as string, "qa")
    ).toThrow(NonRetriableError);
  });

  test("includes agent name in error context", () => {
    try {
      validateFeatureId("", "architect");
    } catch (error) {
      expect(error).toBeInstanceOf(NonRetriableError);
      expect((error as Error).message).toContain("VALIDATION_ERROR");
    }
  });
});

describe("validateRequiredContext", () => {
  test("accepts context with all required fields", () => {
    const context = { featurePath: "/features/foo", projectRoot: "/project" };
    expect(() =>
      validateRequiredContext(context, ["featurePath", "projectRoot"], "architect")
    ).not.toThrow();
  });

  test("throws NonRetriableError when required field is missing", () => {
    const context = { featurePath: "/features/foo" };
    expect(() =>
      validateRequiredContext(context, ["featurePath", "projectRoot"], "architect")
    ).toThrow(NonRetriableError);
  });

  test("throws NonRetriableError when required field is null", () => {
    const context = { featurePath: "/features/foo", projectRoot: null };
    expect(() =>
      validateRequiredContext(
        context as unknown as Record<string, unknown>,
        ["featurePath", "projectRoot"],
        "architect"
      )
    ).toThrow(NonRetriableError);
  });

  test("throws NonRetriableError when required field is undefined", () => {
    const context = { featurePath: "/features/foo", projectRoot: undefined };
    expect(() =>
      validateRequiredContext(context, ["featurePath", "projectRoot"], "architect")
    ).toThrow(NonRetriableError);
  });

  test("lists all missing fields in error message", () => {
    const context = { foo: "bar" };
    try {
      validateRequiredContext(
        context,
        ["featurePath", "projectRoot", "branch"],
        "architect"
      );
    } catch (error) {
      expect(error).toBeInstanceOf(NonRetriableError);
      expect((error as Error).message).toContain("featurePath");
      expect((error as Error).message).toContain("projectRoot");
      expect((error as Error).message).toContain("branch");
    }
  });
});

describe("wrapAgentExecution", () => {
  test("returns result on successful operation", async () => {
    const result = await wrapAgentExecution("qa", async () => {
      return { agent: "qa", verdict: "PASS" as const };
    });

    expect(result).toEqual({ agent: "qa", verdict: "PASS" });
  });

  test("re-throws NonRetriableError unchanged", async () => {
    const originalError = new NonRetriableError("Already non-retriable");

    try {
      await wrapAgentExecution("qa", async () => {
        throw originalError;
      });
    } catch (error) {
      expect(error).toBe(originalError);
    }
  });

  test("wraps non-retriable errors as NonRetriableError", async () => {
    const error = new Error("Feature not found");

    try {
      await wrapAgentExecution("analyst", async () => {
        throw error;
      });
    } catch (caughtError) {
      expect(caughtError).toBeInstanceOf(NonRetriableError);
    }
  });

  test("re-throws retriable errors unchanged", async () => {
    const error = new Error("Network timeout");

    try {
      await wrapAgentExecution("roadmap", async () => {
        throw error;
      });
    } catch (caughtError) {
      expect(caughtError).toBe(error);
    }
  });

  test("includes agent name in wrapped error", async () => {
    const error = new Error("Validation failed for input");

    try {
      await wrapAgentExecution("architect", async () => {
        throw error;
      });
    } catch (caughtError) {
      expect(caughtError).toBeInstanceOf(NonRetriableError);
      expect((caughtError as Error).message).toContain("architect");
    }
  });
});
