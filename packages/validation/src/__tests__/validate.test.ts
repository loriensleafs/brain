/**
 * Tests for AJV validators
 *
 * Validates that JSON Schema validators behave identically to the original Zod schemas.
 */
import { describe, test, expect } from "bun:test";
import {
  validateSearchArgs,
  parseSearchArgs,
  getSearchArgsErrors,
  validateBootstrapContextArgs,
  parseBootstrapContextArgs,
  getBootstrapContextArgsErrors,
  validateListProjectsArgs,
  parseListProjectsArgs,
  getListProjectsArgsErrors,
  validateDeleteProjectArgs,
  parseDeleteProjectArgs,
  getDeleteProjectArgsErrors,
  validateActiveProjectArgs,
  parseActiveProjectArgs,
  getActiveProjectArgsErrors,
} from "../validate";

describe("SearchArgs validation", () => {
  describe("parseSearchArgs", () => {
    test("validates minimum query length", () => {
      expect(() =>
        parseSearchArgs({
          query: "",
          limit: 10,
          threshold: 0.7,
          mode: "auto",
        })
      ).toThrow();

      const valid = parseSearchArgs({
        query: "test",
        limit: 10,
        threshold: 0.7,
        mode: "auto",
      });
      expect(valid.query).toBe("test");
    });

    test("validates limit bounds", () => {
      // Below minimum
      expect(() =>
        parseSearchArgs({
          query: "test",
          limit: 0,
        })
      ).toThrow();

      // Above maximum
      expect(() =>
        parseSearchArgs({
          query: "test",
          limit: 101,
        })
      ).toThrow();

      // Valid
      const valid = parseSearchArgs({
        query: "test",
        limit: 50,
      });
      expect(valid.limit).toBe(50);
    });

    test("validates threshold bounds", () => {
      // Below minimum
      expect(() =>
        parseSearchArgs({
          query: "test",
          threshold: -0.1,
        })
      ).toThrow();

      // Above maximum
      expect(() =>
        parseSearchArgs({
          query: "test",
          threshold: 1.1,
        })
      ).toThrow();

      // Valid
      const valid = parseSearchArgs({
        query: "test",
        threshold: 0.5,
      });
      expect(valid.threshold).toBe(0.5);
    });

    test("validates mode enum", () => {
      expect(() =>
        parseSearchArgs({
          query: "test",
          mode: "invalid",
        })
      ).toThrow();

      const auto = parseSearchArgs({ query: "test", mode: "auto" });
      expect(auto.mode).toBe("auto");

      const semantic = parseSearchArgs({ query: "test", mode: "semantic" });
      expect(semantic.mode).toBe("semantic");

      const keyword = parseSearchArgs({ query: "test", mode: "keyword" });
      expect(keyword.mode).toBe("keyword");

      const hybrid = parseSearchArgs({ query: "test", mode: "hybrid" });
      expect(hybrid.mode).toBe("hybrid");
    });

    test("applies defaults", () => {
      const result = parseSearchArgs({ query: "test" });
      expect(result.limit).toBe(10);
      expect(result.threshold).toBe(0.7);
      expect(result.mode).toBe("auto");
      expect(result.full_context).toBe(false);
      expect(result.depth).toBe(0);
    });

    test("accepts full_context parameter", () => {
      const withFullContext = parseSearchArgs({
        query: "test",
        full_context: true,
      });
      expect(withFullContext.full_context).toBe(true);

      const withoutFullContext = parseSearchArgs({
        query: "test",
        full_context: false,
      });
      expect(withoutFullContext.full_context).toBe(false);
    });

    test("accepts optional project", () => {
      const withProject = parseSearchArgs({
        query: "test",
        project: "my-project",
      });
      expect(withProject.project).toBe("my-project");

      const withoutProject = parseSearchArgs({ query: "test" });
      expect(withoutProject.project).toBeUndefined();
    });

    test("validates depth bounds", () => {
      // Below minimum
      expect(() =>
        parseSearchArgs({
          query: "test",
          depth: -1,
        })
      ).toThrow();

      // Above maximum
      expect(() =>
        parseSearchArgs({
          query: "test",
          depth: 4,
        })
      ).toThrow();

      // Valid bounds
      const depth0 = parseSearchArgs({ query: "test", depth: 0 });
      expect(depth0.depth).toBe(0);

      const depth3 = parseSearchArgs({ query: "test", depth: 3 });
      expect(depth3.depth).toBe(3);
    });

    test("rejects additional properties", () => {
      expect(() =>
        parseSearchArgs({
          query: "test",
          unknownProp: "value",
        })
      ).toThrow();
    });
  });

  describe("validateSearchArgs", () => {
    test("returns true for valid data", () => {
      const data = { query: "test" };
      expect(validateSearchArgs(data)).toBe(true);
    });

    test("returns false for invalid data", () => {
      const data = { query: "" };
      expect(validateSearchArgs(data)).toBe(false);
    });

    test("populates errors array on failure", () => {
      const data = { query: "" };
      validateSearchArgs(data);
      expect(validateSearchArgs.errors).toBeDefined();
      expect(validateSearchArgs.errors?.length).toBeGreaterThan(0);
    });
  });

  describe("getSearchArgsErrors", () => {
    test("returns empty array for valid data", () => {
      const errors = getSearchArgsErrors({ query: "test" });
      expect(errors).toEqual([]);
    });

    test("returns structured errors for invalid data", () => {
      const errors = getSearchArgsErrors({ query: "" });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toHaveProperty("field");
      expect(errors[0]).toHaveProperty("constraint");
      expect(errors[0]).toHaveProperty("message");
    });
  });
});

describe("BootstrapContextArgs validation", () => {
  describe("parseBootstrapContextArgs", () => {
    test("accepts empty object (all optional)", () => {
      const result = parseBootstrapContextArgs({});
      expect(result).toBeDefined();
    });

    test("applies defaults", () => {
      const result = parseBootstrapContextArgs({});
      expect(result.timeframe).toBe("5d");
      expect(result.include_referenced).toBe(true);
    });

    test("accepts project parameter", () => {
      const result = parseBootstrapContextArgs({ project: "my-project" });
      expect(result.project).toBe("my-project");
    });

    test("accepts timeframe parameter", () => {
      const result = parseBootstrapContextArgs({ timeframe: "7d" });
      expect(result.timeframe).toBe("7d");
    });

    test("accepts include_referenced parameter", () => {
      const withFalse = parseBootstrapContextArgs({ include_referenced: false });
      expect(withFalse.include_referenced).toBe(false);

      const withTrue = parseBootstrapContextArgs({ include_referenced: true });
      expect(withTrue.include_referenced).toBe(true);
    });

    test("rejects additional properties", () => {
      expect(() =>
        parseBootstrapContextArgs({
          unknownProp: "value",
        })
      ).toThrow();
    });
  });

  describe("validateBootstrapContextArgs", () => {
    test("returns true for valid data", () => {
      expect(validateBootstrapContextArgs({})).toBe(true);
      expect(validateBootstrapContextArgs({ project: "test" })).toBe(true);
    });

    test("returns false for invalid data", () => {
      expect(validateBootstrapContextArgs({ project: 123 })).toBe(false);
    });
  });

  describe("getBootstrapContextArgsErrors", () => {
    test("returns empty array for valid data", () => {
      const errors = getBootstrapContextArgsErrors({});
      expect(errors).toEqual([]);
    });

    test("returns structured errors for invalid data", () => {
      const errors = getBootstrapContextArgsErrors({ project: 123 });
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

describe("ListProjectsArgs validation", () => {
  describe("parseListProjectsArgs", () => {
    test("accepts empty object", () => {
      const result = parseListProjectsArgs({});
      expect(result).toEqual({});
    });

    test("rejects additional properties", () => {
      expect(() =>
        parseListProjectsArgs({
          unknownProp: "value",
        })
      ).toThrow();
    });
  });

  describe("validateListProjectsArgs", () => {
    test("returns true for empty object", () => {
      expect(validateListProjectsArgs({})).toBe(true);
    });

    test("returns false for object with unknown properties", () => {
      expect(validateListProjectsArgs({ unknown: "prop" })).toBe(false);
    });
  });

  describe("getListProjectsArgsErrors", () => {
    test("returns empty array for valid data", () => {
      const errors = getListProjectsArgsErrors({});
      expect(errors).toEqual([]);
    });

    test("returns errors for invalid data", () => {
      const errors = getListProjectsArgsErrors({ unknown: "prop" });
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

describe("DeleteProjectArgs validation", () => {
  describe("parseDeleteProjectArgs", () => {
    test("requires project parameter", () => {
      expect(() => parseDeleteProjectArgs({})).toThrow();
    });

    test("accepts project parameter", () => {
      const result = parseDeleteProjectArgs({ project: "my-project" });
      expect(result.project).toBe("my-project");
    });

    test("applies default for delete_notes", () => {
      const result = parseDeleteProjectArgs({ project: "my-project" });
      expect(result.delete_notes).toBe(false);
    });

    test("accepts delete_notes parameter", () => {
      const withTrue = parseDeleteProjectArgs({
        project: "my-project",
        delete_notes: true,
      });
      expect(withTrue.delete_notes).toBe(true);

      const withFalse = parseDeleteProjectArgs({
        project: "my-project",
        delete_notes: false,
      });
      expect(withFalse.delete_notes).toBe(false);
    });

    test("rejects empty project name", () => {
      expect(() => parseDeleteProjectArgs({ project: "" })).toThrow();
    });

    test("rejects additional properties", () => {
      expect(() =>
        parseDeleteProjectArgs({
          project: "my-project",
          unknownProp: "value",
        })
      ).toThrow();
    });
  });

  describe("validateDeleteProjectArgs", () => {
    test("returns true for valid data", () => {
      expect(validateDeleteProjectArgs({ project: "test" })).toBe(true);
      expect(
        validateDeleteProjectArgs({ project: "test", delete_notes: true })
      ).toBe(true);
    });

    test("returns false for missing project", () => {
      expect(validateDeleteProjectArgs({})).toBe(false);
    });

    test("returns false for empty project", () => {
      expect(validateDeleteProjectArgs({ project: "" })).toBe(false);
    });
  });

  describe("getDeleteProjectArgsErrors", () => {
    test("returns empty array for valid data", () => {
      const errors = getDeleteProjectArgsErrors({ project: "test" });
      expect(errors).toEqual([]);
    });

    test("returns errors for missing project", () => {
      const errors = getDeleteProjectArgsErrors({});
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

describe("ActiveProjectArgs validation", () => {
  describe("parseActiveProjectArgs", () => {
    test("accepts empty object with default operation", () => {
      const result = parseActiveProjectArgs({});
      expect(result.operation).toBe("get");
    });

    test("accepts get operation", () => {
      const result = parseActiveProjectArgs({ operation: "get" });
      expect(result.operation).toBe("get");
    });

    test("accepts set operation with project", () => {
      const result = parseActiveProjectArgs({
        operation: "set",
        project: "my-project",
      });
      expect(result.operation).toBe("set");
      expect(result.project).toBe("my-project");
    });

    test("accepts clear operation", () => {
      const result = parseActiveProjectArgs({ operation: "clear" });
      expect(result.operation).toBe("clear");
    });

    test("rejects invalid operation", () => {
      expect(() =>
        parseActiveProjectArgs({ operation: "invalid" })
      ).toThrow();
    });

    test("rejects additional properties", () => {
      expect(() =>
        parseActiveProjectArgs({
          operation: "get",
          unknownProp: "value",
        })
      ).toThrow();
    });
  });

  describe("validateActiveProjectArgs", () => {
    test("returns true for valid data", () => {
      expect(validateActiveProjectArgs({})).toBe(true);
      expect(validateActiveProjectArgs({ operation: "get" })).toBe(true);
      expect(validateActiveProjectArgs({ operation: "set", project: "test" })).toBe(
        true
      );
      expect(validateActiveProjectArgs({ operation: "clear" })).toBe(true);
    });

    test("returns false for invalid operation", () => {
      expect(validateActiveProjectArgs({ operation: "invalid" })).toBe(false);
    });
  });

  describe("getActiveProjectArgsErrors", () => {
    test("returns empty array for valid data", () => {
      const errors = getActiveProjectArgsErrors({});
      expect(errors).toEqual([]);
    });

    test("returns errors for invalid operation", () => {
      const errors = getActiveProjectArgsErrors({ operation: "invalid" });
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
