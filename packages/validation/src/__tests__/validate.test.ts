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
