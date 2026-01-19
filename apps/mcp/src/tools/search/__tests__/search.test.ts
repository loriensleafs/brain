import { describe, test, expect } from "bun:test";
import { SearchArgsSchema, type SearchResult } from "../schema";

describe("search schema validation", () => {
  test("validates minimum query length", () => {
    expect(() =>
      SearchArgsSchema.parse({
        query: "",
        limit: 10,
        threshold: 0.7,
        mode: "auto",
      })
    ).toThrow();

    const valid = SearchArgsSchema.parse({
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
      SearchArgsSchema.parse({
        query: "test",
        limit: 0,
      })
    ).toThrow();

    // Above maximum
    expect(() =>
      SearchArgsSchema.parse({
        query: "test",
        limit: 101,
      })
    ).toThrow();

    // Valid
    const valid = SearchArgsSchema.parse({
      query: "test",
      limit: 50,
    });
    expect(valid.limit).toBe(50);
  });

  test("validates threshold bounds", () => {
    // Below minimum
    expect(() =>
      SearchArgsSchema.parse({
        query: "test",
        threshold: -0.1,
      })
    ).toThrow();

    // Above maximum
    expect(() =>
      SearchArgsSchema.parse({
        query: "test",
        threshold: 1.1,
      })
    ).toThrow();

    // Valid
    const valid = SearchArgsSchema.parse({
      query: "test",
      threshold: 0.5,
    });
    expect(valid.threshold).toBe(0.5);
  });

  test("validates mode enum", () => {
    expect(() =>
      SearchArgsSchema.parse({
        query: "test",
        mode: "invalid",
      })
    ).toThrow();

    const auto = SearchArgsSchema.parse({ query: "test", mode: "auto" });
    expect(auto.mode).toBe("auto");

    const semantic = SearchArgsSchema.parse({ query: "test", mode: "semantic" });
    expect(semantic.mode).toBe("semantic");

    const keyword = SearchArgsSchema.parse({ query: "test", mode: "keyword" });
    expect(keyword.mode).toBe("keyword");
  });

  test("applies defaults", () => {
    const result = SearchArgsSchema.parse({ query: "test" });
    expect(result.limit).toBe(10);
    expect(result.threshold).toBe(0.7);
    expect(result.mode).toBe("auto");
  });

  test("accepts optional project", () => {
    const withProject = SearchArgsSchema.parse({
      query: "test",
      project: "my-project",
    });
    expect(withProject.project).toBe("my-project");

    const withoutProject = SearchArgsSchema.parse({ query: "test" });
    expect(withoutProject.project).toBeUndefined();
  });
});

describe("search result structure", () => {
  test("result has required fields", () => {
    const result: SearchResult = {
      permalink: "notes/test",
      title: "Test Note",
      similarity_score: 0.85,
      snippet: "This is a test snippet",
      source: "keyword",
    };

    expect(result.permalink).toBe("notes/test");
    expect(result.title).toBe("Test Note");
    expect(result.similarity_score).toBe(0.85);
    expect(result.snippet).toBe("This is a test snippet");
    expect(result.source).toBe("keyword");
  });

  test("source can be semantic or keyword", () => {
    const keywordResult: SearchResult = {
      permalink: "notes/test1",
      title: "Test 1",
      similarity_score: 0.9,
      snippet: "Snippet 1",
      source: "keyword",
    };

    const semanticResult: SearchResult = {
      permalink: "notes/test2",
      title: "Test 2",
      similarity_score: 0.8,
      snippet: "Snippet 2",
      source: "semantic",
    };

    expect(keywordResult.source).toBe("keyword");
    expect(semanticResult.source).toBe("semantic");
  });
});
