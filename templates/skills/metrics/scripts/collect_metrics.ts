#!/usr/bin/env bun
/**
 * Agent Metrics Collection Utility
 *
 * Collects and reports metrics on agent usage from git history.
 *
 * Exit Codes:
 *   0 - Success: Metrics collected and output successfully
 *   1 - Error: Path not found or not a git repository
 */

import { parseArgs } from "util";
import { resolve } from "path";
import { existsSync } from "fs";
import { spawnSync } from "child_process";

const AGENT_PATTERNS = [
  /(?:^|\b)(orchestrator|analyst|architect|implementer|security|qa|devops|critic|planner|explainer|task-generator|high-level-advisor|independent-thinker|memory|skillbook|retrospective|roadmap|pr-comment-responder)\b\s*(agent)?/i,
  /reviewed\s+by:?\s*(security|architect|analyst|qa|implementer)/i,
  /agent:\s*(\w+)/i,
  /\[(\w+)-agent\]/i,
];

const INFRASTRUCTURE_PATTERNS = [
  /^\.github\/workflows\/.*\.(yml|yaml)$/,
  /^\.github\/actions\//,
  /^\.githooks\//,
  /^build\//,
  /^scripts\//,
  /Dockerfile/,
  /docker-compose/,
  /\.tf$/,
  /\.tfvars$/,
  /\.env/,
];

const COMMIT_TYPE_PATTERNS: Record<string, RegExp> = {
  feature: /^feat(\(.+\))?:/,
  fix: /^fix(\(.+\))?:/,
  docs: /^docs(\(.+\))?:/,
  refactor: /^refactor(\(.+\))?:/,
  test: /^test(\(.+\))?:/,
  chore: /^chore(\(.+\))?:/,
  ci: /^ci(\(.+\))?:/,
  perf: /^perf(\(.+\))?:/,
  style: /^style(\(.+\))?:/,
};

interface Commit {
  hash: string;
  subject: string;
  author: string;
  email: string;
  date: string;
}

function getCommitsSince(days: number, repoPath: string): Commit[] {
  const sinceDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  const format = "%H|%s|%an|%ae|%ad";

  const result = spawnSync("git", ["-C", repoPath, "log", `--since=${sinceDate}`, `--format=${format}`, "--date=short"], {
    encoding: "utf-8",
    timeout: 60000,
  });

  if (!result.stdout?.trim()) return [];

  return result.stdout.trim().split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|", 5);
      if (parts.length < 5) return null;
      return { hash: parts[0], subject: parts[1], author: parts[2], email: parts[3], date: parts[4] };
    })
    .filter((c): c is Commit => c !== null);
}

function getCommitFiles(hash: string, repoPath: string): string[] {
  const result = spawnSync("git", ["-C", repoPath, "diff-tree", "--no-commit-id", "--name-only", "-r", hash], {
    encoding: "utf-8",
    timeout: 30000,
  });
  return result.stdout?.trim().split("\n").filter(Boolean) ?? [];
}

function findAgentsInText(text: string): string[] {
  const agents = new Map<string, boolean>();
  for (const pattern of AGENT_PATTERNS) {
    for (const match of text.matchAll(new RegExp(pattern, "gi"))) {
      const agent = match[1]?.toLowerCase();
      if (agent && agent !== "agent") agents.set(agent, true);
    }
  }
  return [...agents.keys()];
}

function getCommitType(subject: string): string {
  for (const [type, pattern] of Object.entries(COMMIT_TYPE_PATTERNS)) {
    if (pattern.test(subject)) return type;
  }
  return "other";
}

function isInfrastructureFile(filePath: string): boolean {
  return INFRASTRUCTURE_PATTERNS.some((p) => p.test(filePath));
}

function getMetrics(repoPath: string, days: number): Record<string, unknown> {
  const commits = getCommitsSince(days, repoPath);
  const now = new Date();

  const agentInvocations = new Map<string, number>();
  let commitsWithAgents = 0;
  const commitsByType = new Map<string, number>();
  const commitsWithAgentByType = new Map<string, number>();
  let infrastructureCommits = 0;
  let infrastructureWithSecurity = 0;

  for (const commit of commits) {
    const files = getCommitFiles(commit.hash, repoPath);
    const commitType = getCommitType(commit.subject);
    const agents = findAgentsInText(commit.subject);

    for (const agent of agents) {
      agentInvocations.set(agent, (agentInvocations.get(agent) ?? 0) + 1);
    }

    commitsByType.set(commitType, (commitsByType.get(commitType) ?? 0) + 1);
    commitsWithAgentByType.set(commitType, commitsWithAgentByType.get(commitType) ?? 0);

    if (agents.length > 0) {
      commitsWithAgents++;
      commitsWithAgentByType.set(commitType, (commitsWithAgentByType.get(commitType) ?? 0) + 1);
    }

    if (files.some(isInfrastructureFile)) {
      infrastructureCommits++;
      if (agents.includes("security")) infrastructureWithSecurity++;
    }
  }

  const totalCommits = commits.length;
  const totalInvocations = [...agentInvocations.values()].reduce((a, b) => a + b, 0);
  const coverageRate = totalCommits > 0 ? Math.round((commitsWithAgents / totalCommits) * 1000) / 10 : 0;
  const infraRate = infrastructureCommits > 0 ? Math.round((infrastructureWithSecurity / infrastructureCommits) * 1000) / 10 : 0;

  const agentsObj: Record<string, { count: number; rate: number }> = {};
  const distribution: Record<string, number> = {};
  const sorted = [...agentInvocations.entries()].sort((a, b) => b[1] - a[1]);
  for (const [agent, count] of sorted) {
    const rate = totalInvocations > 0 ? Math.round((count / totalInvocations) * 1000) / 10 : 0;
    agentsObj[agent] = { count, rate };
    distribution[agent] = rate;
  }

  const byType: Record<string, { total: number; with_agent: number; rate: number }> = {};
  for (const [type, total] of commitsByType) {
    const withAgent = commitsWithAgentByType.get(type) ?? 0;
    byType[type] = { total, with_agent: withAgent, rate: total > 0 ? Math.round((withAgent / total) * 1000) / 10 : 0 };
  }

  return {
    period: {
      days,
      start_date: new Date(now.getTime() - days * 86400000).toISOString().split("T")[0],
      end_date: now.toISOString().split("T")[0],
      total_commits: totalCommits,
    },
    metric_1_invocation_rate: { agents: agentsObj, total_invocations: totalInvocations },
    metric_2_coverage: {
      total_commits: totalCommits, commits_with_agent: commitsWithAgents,
      coverage_rate: coverageRate, target: 50, by_type: byType,
      status: coverageRate >= 50 ? "on_track" : "behind",
    },
    metric_4_infrastructure_review: {
      infrastructure_commits: infrastructureCommits,
      with_security_review: infrastructureWithSecurity,
      review_rate: infraRate, target: 100,
      status: infrastructureCommits === 0 || infrastructureWithSecurity / infrastructureCommits >= 1 ? "on_track" : "behind",
    },
    metric_5_distribution: distribution,
  };
}

function formatSummary(metrics: Record<string, unknown>): string {
  const period = metrics.period as Record<string, unknown>;
  const m1 = metrics.metric_1_invocation_rate as Record<string, unknown>;
  const m2 = metrics.metric_2_coverage as Record<string, unknown>;
  const m4 = metrics.metric_4_infrastructure_review as Record<string, unknown>;
  const agents = m1.agents as Record<string, { count: number; rate: number }>;

  const lines = [
    "=".repeat(60), "AGENT METRICS SUMMARY", "=".repeat(60), "",
    `Period: ${period.start_date} to ${period.end_date}`,
    `Total Commits Analyzed: ${period.total_commits}`, "",
    "-".repeat(40), "METRIC 1: INVOCATION RATE BY AGENT", "-".repeat(40),
  ];
  if (Object.keys(agents).length > 0) {
    for (const [agent, data] of Object.entries(agents)) {
      lines.push(`  ${agent.padEnd(20)} ${String(data.count).padStart(4)} (${data.rate.toFixed(1).padStart(5)}%)`);
    }
  } else {
    lines.push("  No agent invocations detected");
  }
  lines.push("", "-".repeat(40), "METRIC 2: AGENT COVERAGE", "-".repeat(40));
  lines.push(`  Overall: ${m2.coverage_rate}% (Target: ${m2.target}%)`);
  lines.push(`  Status: ${(m2.status as string).toUpperCase()}`);
  lines.push("", "-".repeat(40), "METRIC 4: INFRASTRUCTURE REVIEW RATE", "-".repeat(40));
  lines.push(`  Infrastructure Commits: ${m4.infrastructure_commits}`);
  lines.push(`  With Security Review: ${m4.with_security_review}`);
  lines.push(`  Review Rate: ${m4.review_rate}% (Target: ${m4.target}%)`);
  lines.push(`  Status: ${(m4.status as string).toUpperCase()}`);
  lines.push("", "=".repeat(60));
  return lines.join("\n");
}

function formatMarkdown(metrics: Record<string, unknown>): string {
  const period = metrics.period as Record<string, unknown>;
  const m1 = metrics.metric_1_invocation_rate as Record<string, unknown>;
  const m2 = metrics.metric_2_coverage as Record<string, unknown>;
  const m4 = metrics.metric_4_infrastructure_review as Record<string, unknown>;
  const agents = m1.agents as Record<string, { count: number; rate: number }>;
  const byType = m2.by_type as Record<string, { total: number; with_agent: number; rate: number }>;

  const lines = [
    "# Agent Metrics Report", "",
    "## Report Period", "",
    `**From**: ${period.start_date}`, `**To**: ${period.end_date}`,
    `**Generated**: ${new Date().toISOString().slice(0, 16).replace("T", " ")}`, "",
    "---", "", "## Executive Summary", "",
    "| Metric | Current | Target | Status |",
    "|--------|---------|--------|--------|",
    `| Agent Coverage | ${m2.coverage_rate}% | ${m2.target}% | ${m2.status === "on_track" ? "On Track" : "Behind"} |`,
    `| Infrastructure Review | ${m4.review_rate}% | ${m4.target}% | ${m4.status === "on_track" ? "On Track" : "Behind"} |`,
    "", "---", "", "## Metric 1: Invocation Rate by Agent", "",
    "| Agent | Invocations | Rate |", "|-------|-------------|------|",
  ];
  if (Object.keys(agents).length > 0) {
    for (const [agent, data] of Object.entries(agents)) lines.push(`| ${agent} | ${data.count} | ${data.rate}% |`);
  } else {
    lines.push("| *No agents detected* | 0 | 0% |");
  }
  lines.push("", `**Total Invocations**: ${m1.total_invocations}`, "", "---", "",
    "## Metric 2: Agent Coverage by Commit Type", "",
    "| Commit Type | Total | With Agent | Coverage |", "|-------------|-------|------------|----------|");
  for (const [type, data] of Object.entries(byType)) {
    lines.push(`| ${type} | ${data.total} | ${data.with_agent} | ${data.rate}% |`);
  }
  lines.push("", "---", "", `*Generated by collect_metrics.ts*`);
  return lines.join("\n");
}

function main(): number {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      since: { type: "string", default: "30" },
      output: { type: "string", default: "summary" },
      "repo-path": { type: "string", default: "." },
    },
    strict: false,
  });

  const repoPath = resolve(values["repo-path"] as string);
  if (!existsSync(repoPath)) {
    console.error(`Error: Path not found: ${values["repo-path"]}`);
    return 1;
  }
  if (!existsSync(resolve(repoPath, ".git"))) {
    console.error(`Error: ${repoPath} is not a git repository`);
    return 1;
  }

  const metrics = getMetrics(repoPath, parseInt(values.since as string, 10));

  if (values.output === "json") {
    console.log(JSON.stringify(metrics, null, 2));
  } else if (values.output === "markdown") {
    console.log(formatMarkdown(metrics));
  } else {
    console.log(formatSummary(metrics));
  }
  return 0;
}

process.exit(main());
