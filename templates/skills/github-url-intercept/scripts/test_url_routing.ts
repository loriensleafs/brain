#!/usr/bin/env bun
/**
 * Parse GitHub URLs and route to efficient API calls.
 *
 * Parses a GitHub URL and returns the recommended command to fetch its
 * content via API instead of HTML.
 *
 * Exit codes:
 *   0 - Success
 *   1 - Invalid URL format
 */

import { parseArgs } from "util";

// --- Enums ---

type UrlType = "Pull" | "Issue" | "Blob" | "Tree" | "Commit" | "Compare" | "Unknown";
type RouteMethod = "Script" | "GhApi";

// --- Input validation (CWE-78 mitigation) ---

const SAFE_OWNER_REPO_RE = /^[a-zA-Z0-9][-a-zA-Z0-9_.]*$/;
const SAFE_REF_RE = /^[a-zA-Z0-9][-a-zA-Z0-9_./]*$/;
const SAFE_PATH_RE = /^[a-zA-Z0-9][-a-zA-Z0-9_./%+@]*$/;
const DANGEROUS_CHARS = new Set("\"'`$;&|><(){}[]!\\");

function isSafeInput(
  value: string | null | undefined,
  pattern: RegExp,
  allowEmpty = false,
  allowTripleDot = false,
): boolean {
  if (!value) return allowEmpty;
  if ([...value].some((ch) => DANGEROUS_CHARS.has(ch))) return false;
  if (allowTripleDot) {
    if (value.replace(/\.\.\./g, "__TRIPLE__").includes("..")) return false;
  } else if (value.includes("..")) {
    return false;
  }
  return pattern.test(value);
}

// --- Script routes ---

const SCRIPT_ROUTES: Partial<Record<UrlType, { script: string; path: string }>> = {
  Pull: { script: "get_pr_context.py", path: ".claude/skills/github/scripts/pr/get_pr_context.py" },
  Issue: { script: "get_issue_context.py", path: ".claude/skills/github/scripts/issue/get_issue_context.py" },
};

// --- URL parsing ---

interface ParsedUrl {
  owner: string;
  repo: string;
  url_type: UrlType;
  resource_id: string | null;
  ref: string | null;
  path: string | null;
  fragment_type: string | null;
  fragment_id: string | null;
}

function parseGithubUrl(url: string): ParsedUrl | null {
  const match = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?(.*)$/.exec(url);
  if (!match) return null;

  const owner = match[1];
  const repo = match[2];
  let rest = match[3];

  if (!isSafeInput(owner, SAFE_OWNER_REPO_RE)) return null;
  if (!isSafeInput(repo, SAFE_OWNER_REPO_RE)) return null;

  let fragmentType: string | null = null;
  let fragmentId: string | null = null;

  const reviewMatch = /#pullrequestreview-(\d+)/.exec(url);
  const discussionMatch = /#discussion_r(\d+)/.exec(url);
  const commentMatch = /#issuecomment-(\d+)/.exec(url);

  if (reviewMatch) {
    fragmentType = "pullrequestreview";
    fragmentId = reviewMatch[1];
    rest = rest.split("#")[0];
  } else if (discussionMatch) {
    fragmentType = "discussion_r";
    fragmentId = discussionMatch[1];
    rest = rest.split("#")[0];
  } else if (commentMatch) {
    fragmentType = "issuecomment";
    fragmentId = commentMatch[1];
    rest = rest.split("#")[0];
  }

  let urlType: UrlType = "Unknown";
  let resourceId: string | null = null;
  let ref: string | null = null;
  let path: string | null = null;

  const pullMatch = /^pull\/(\d+)/.exec(rest);
  const issueMatch = /^issues\/(\d+)/.exec(rest);
  const blobMatch = /^blob\/([^/]+)\/(.+)$/.exec(rest);
  const treeMatch = /^tree\/([^/]+)\/(.*)$/.exec(rest);
  const commitMatch = /^commit\/([a-f0-9]+)/.exec(rest);
  const compareMatch = /^compare\/(.+)$/.exec(rest);

  if (pullMatch) {
    urlType = "Pull";
    resourceId = pullMatch[1];
  } else if (issueMatch) {
    urlType = "Issue";
    resourceId = issueMatch[1];
  } else if (blobMatch) {
    urlType = "Blob";
    ref = blobMatch[1];
    path = blobMatch[2];
    if (!isSafeInput(ref, SAFE_REF_RE) || !isSafeInput(path, SAFE_PATH_RE)) return null;
  } else if (treeMatch) {
    urlType = "Tree";
    ref = treeMatch[1];
    path = treeMatch[2];
    if (!isSafeInput(ref, SAFE_REF_RE)) return null;
    if (path && !isSafeInput(path, SAFE_PATH_RE, true)) return null;
  } else if (commitMatch) {
    urlType = "Commit";
    resourceId = commitMatch[1];
  } else if (compareMatch) {
    urlType = "Compare";
    resourceId = compareMatch[1];
    if (!isSafeInput(resourceId, SAFE_REF_RE, false, true)) return null;
  }

  return { owner, repo, url_type: urlType, resource_id: resourceId, ref, path, fragment_type: fragmentType, fragment_id: fragmentId };
}

// --- Route recommendation ---

interface RouteRecommendation {
  method: RouteMethod;
  command: string;
  script_path: string | null;
  reason: string;
}

function getRecommendedRoute(parsed: ParsedUrl): RouteRecommendation {
  const { owner, repo } = parsed;

  if (parsed.fragment_type && parsed.fragment_id) {
    const fragType = parsed.fragment_type;
    const fragId = parsed.fragment_id;
    const resId = parsed.resource_id;

    const cmdMap: Record<string, string> = {
      pullrequestreview: `gh api "repos/${owner}/${repo}/pulls/${resId}/reviews/${fragId}"`,
      discussion_r: `gh api "repos/${owner}/${repo}/pulls/comments/${fragId}"`,
      issuecomment: `gh api "repos/${owner}/${repo}/issues/comments/${fragId}"`,
    };
    return {
      method: "GhApi",
      command: cmdMap[fragType] ?? "unknown",
      script_path: null,
      reason: `Fragment ${fragType} requires direct API call`,
    };
  }

  const route = SCRIPT_ROUTES[parsed.url_type];
  if (route) {
    const resId = parsed.resource_id;
    const cmdMap: Partial<Record<UrlType, string>> = {
      Pull: `bun run "${route.path}" --pull-request "${resId}" --owner "${owner}" --repo "${repo}"`,
      Issue: `bun run "${route.path}" --issue "${resId}" --owner "${owner}" --repo "${repo}"`,
    };
    return {
      method: "Script",
      command: cmdMap[parsed.url_type] ?? "unknown",
      script_path: route.path,
      reason: "Use github skill script for structured output",
    };
  }

  const fallbackMap: Partial<Record<UrlType, string>> = {
    Blob: `gh api "repos/${owner}/${repo}/contents/${parsed.path}?ref=${parsed.ref}"`,
    Tree: `gh api "repos/${owner}/${repo}/contents/${parsed.path}?ref=${parsed.ref}"`,
    Commit: `gh api "repos/${owner}/${repo}/commits/${parsed.resource_id}"`,
    Compare: `gh api "repos/${owner}/${repo}/compare/${parsed.resource_id}"`,
  };

  return {
    method: "GhApi",
    command: fallbackMap[parsed.url_type] ?? "unknown",
    script_path: null,
    reason: `No script available for ${parsed.url_type}, use gh api`,
  };
}

// --- Main ---

function main(): number {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: { url: { type: "string" } },
    strict: false,
  });

  if (!values.url) {
    console.error("Usage: test_url_routing.ts --url <github-url>");
    return 1;
  }

  const parsed = parseGithubUrl(values.url as string);

  if (!parsed) {
    console.log(JSON.stringify({
      success: false, parsed_url: null, recommended_route: null,
      error: "Invalid GitHub URL format",
    }, null, 2));
    return 1;
  }

  const recommended = getRecommendedRoute(parsed);

  if (recommended.command === "unknown") {
    console.log(JSON.stringify({
      success: false, parsed_url: parsed, recommended_route: null,
      error: `No routing available for URL type: ${parsed.url_type}`,
    }, null, 2));
    return 1;
  }

  console.log(JSON.stringify({ success: true, parsed_url: parsed, recommended_route: recommended }, null, 2));
  return 0;
}

process.exit(main());
