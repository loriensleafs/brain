#!/usr/bin/env bun
/**
 * Generate a prioritized mitigation roadmap from a threat model.
 *
 * Parses a threat model markdown file and extracts threats to create
 * a prioritized mitigation roadmap.
 */

import { resolve, basename, dirname } from "path";
import { existsSync, mkdirSync } from "fs";

interface Threat {
  id: string;
  element: string;
  stride: string;
  description: string;
  likelihood: string;
  impact: string;
  risk: string;
  status: string;
}

const RISK_ORDER: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

function validatePathNoTraversal(inputPath: string): string {
  if (inputPath.includes("..")) {
    throw new Error(
      `Path traversal attempt detected: '${inputPath}' contains prohibited '..' sequence.`
    );
  }
  const resolvedPath = resolve(inputPath);
  if (!resolvedPath.startsWith(resolve("."))) {
    throw new Error(
      `Path traversal attempt detected: '${inputPath}' resolves outside the working directory.`
    );
  }
  return resolvedPath;
}

function parseThreatMatrix(content: string): Threat[] {
  const threats: Threat[] = [];
  const tablePattern =
    /\| ID \| Element \| STRIDE \| Threat \|.*?\n((?:\|.*\n)*)/i;
  const match = content.match(tablePattern);

  if (!match) return threats;

  const tableRows = match[1].trim().split("\n");

  for (const row of tableRows) {
    if (row.includes("---")) continue;

    const cells = row
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length >= 7) {
      threats.push({
        id: cells[0],
        element: cells[1],
        stride: cells[2],
        description: cells[3],
        likelihood: cells[4],
        impact: cells[5],
        risk: cells[6],
        status: cells[7] ?? "Planned",
      });
    }
  }

  return threats;
}

function categorizeByRisk(threats: Threat[]): Record<string, Threat[]> {
  const categories: Record<string, Threat[]> = {
    Critical: [],
    High: [],
    Medium: [],
    Low: [],
  };

  for (const threat of threats) {
    let matched = false;
    for (const level of Object.keys(categories)) {
      if (threat.risk.toLowerCase().includes(level.toLowerCase())) {
        categories[level].push(threat);
        matched = true;
        break;
      }
    }
    if (!matched) {
      categories["Medium"].push(threat);
    }
  }

  return categories;
}

function formatThreatSection(threats: Threat[]): string {
  if (threats.length === 0) return "_No threats at this level_";

  const lines: string[] = [];
  for (const t of threats) {
    lines.push(
      `### ${t.id}: ${t.description}`,
      "",
      `- **Element**: ${t.element}`,
      `- **STRIDE**: ${t.stride}`,
      `- **Likelihood**: ${t.likelihood}`,
      `- **Impact**: ${t.impact}`,
      `- **Status**: ${t.status}`,
      "",
      "**Recommended Mitigations**:",
      "",
      "- [ ] [Add specific mitigation]",
      "- [ ] [Add specific mitigation]",
      ""
    );
  }

  return lines.join("\n");
}

function formatThreatTable(threats: Threat[]): string {
  const lines = [
    "| ID | STRIDE | Risk | Description | Status |",
    "|----|--------|------|-------------|--------|",
  ];

  const sorted = [...threats].sort(
    (a, b) => (RISK_ORDER[a.risk] ?? 99) - (RISK_ORDER[b.risk] ?? 99)
  );

  for (const t of sorted) {
    lines.push(
      `| ${t.id} | ${t.stride} | ${t.risk} | ${t.description} | ${t.status} |`
    );
  }

  return lines.join("\n");
}

function extractScope(content: string): string {
  const match1 = content.match(/# Threat Model: (.+)/);
  if (match1) return match1[1].trim();

  const match2 = content.match(/## Scope.*?Subject\*\*: (.+)/s);
  if (match2) return match2[1].trim();

  return "Unknown Scope";
}

function getIds(threats: Threat[]): string {
  return threats.map((t) => t.id).join(", ") || "None";
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  let inputPath = "";
  let outputPath = "";

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--input":
      case "-i":
        inputPath = argv[++i] ?? "";
        break;
      case "--output":
      case "-o":
        outputPath = argv[++i] ?? "";
        break;
      case "--help":
      case "-h":
        console.log(
          "Usage: bun run generate_mitigation_roadmap.ts --input <path> --output <path>"
        );
        return 0;
    }
  }

  if (!inputPath || !outputPath) {
    console.error("ERROR: --input and --output are required");
    return 1;
  }

  try {
    const resolvedInput = validatePathNoTraversal(inputPath);

    if (!existsSync(resolvedInput)) {
      console.error(`Error: Input file not found: ${inputPath}`);
      return 1;
    }

    const content = await Bun.file(resolvedInput).text();
    const threats = parseThreatMatrix(content);

    if (threats.length === 0) {
      console.error("Warning: No threats found in threat matrix");
      console.log("Ensure the threat model has a table with header:");
      console.log(
        "| ID | Element | STRIDE | Threat | Likelihood | Impact | Risk |"
      );
    }

    const categorized = categorizeByRisk(threats);
    const scope = extractScope(content);
    const date = new Date().toISOString().split("T")[0];

    const roadmap = `# Mitigation Roadmap: ${scope}

**Generated**: ${date}
**Source**: ${basename(resolvedInput)}

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Total Threats | ${threats.length} |
| Critical | ${categorized["Critical"].length} |
| High | ${categorized["High"].length} |
| Medium | ${categorized["Medium"].length} |
| Low | ${categorized["Low"].length} |

---

## Priority 1: Critical Risks

> Must address before production deployment

${formatThreatSection(categorized["Critical"])}

---

## Priority 2: High Risks

> Address in next sprint/release

${formatThreatSection(categorized["High"])}

---

## Priority 3: Medium Risks

> Schedule for upcoming releases

${formatThreatSection(categorized["Medium"])}

---

## Priority 4: Low Risks

> Address opportunistically or accept

${formatThreatSection(categorized["Low"])}

---

## Implementation Timeline

| Phase | Focus | Threats | Target |
|-------|-------|---------|--------|
| Immediate | Critical risks | ${getIds(categorized["Critical"])} | This sprint |
| Short-term | High risks | ${getIds(categorized["High"])} | Next 2 sprints |
| Medium-term | Medium risks | ${getIds(categorized["Medium"])} | Next quarter |
| Long-term | Low risks | ${getIds(categorized["Low"])} | As resources allow |

---

## Next Steps

1. [ ] Review roadmap with security team
2. [ ] Assign owners to Critical/High mitigations
3. [ ] Create tickets for immediate phase
4. [ ] Schedule follow-up review

---

## Appendix: All Threats by Risk

${formatThreatTable(threats)}
`;

    const resolvedOutput = validatePathNoTraversal(outputPath);
    const dir = dirname(resolvedOutput);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    await Bun.write(resolvedOutput, roadmap);

    console.log(`Generated mitigation roadmap: ${resolvedOutput}`);
    console.log(`Threats processed: ${threats.length}`);
    console.log(`  Critical: ${categorized["Critical"].length}`);
    console.log(`  High: ${categorized["High"].length}`);
    console.log(`  Medium: ${categorized["Medium"].length}`);
    console.log(`  Low: ${categorized["Low"].length}`);

    return 0;
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    return 1;
  }
}

process.exit(await main());
