#!/usr/bin/env bun
/**
 * Generate a structured threat matrix document.
 *
 * Creates a markdown threat model template with STRIDE categories
 * and risk rating structure.
 */

import { resolve, dirname } from "path";
import { mkdirSync, existsSync } from "fs";

const STRIDE_CATEGORIES: [string, string, string][] = [
  ["S", "Spoofing", "Pretending to be something or someone else"],
  ["T", "Tampering", "Modifying data or code without authorization"],
  ["R", "Repudiation", "Denying having performed an action"],
  ["I", "Information Disclosure", "Exposing information to unauthorized parties"],
  ["D", "Denial of Service", "Making a system unavailable or degraded"],
  ["E", "Elevation of Privilege", "Gaining capabilities without authorization"],
];

function validatePathNoTraversal(inputPath: string): string {
  const pathStr = inputPath;
  if (pathStr.includes("..")) {
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

function generateStrideSections(): string {
  const sections: string[] = [];
  for (const [code, name, description] of STRIDE_CATEGORIES) {
    sections.push(`### ${code} - ${name}

**Definition**: ${description}

**Questions to Ask**:
- [Category-specific questions]

**Identified Threats**:

| ID | Element | Threat | Risk |
|----|---------|--------|------|
| | | | |
`);
  }
  return sections.join("\n");
}

function generateTemplate(scope: string, date: string): string {
  const strideSections = generateStrideSections();

  return `# Threat Model: ${scope}

**Created**: ${date}
**Version**: 1.0
**Status**: Draft

## Scope

- **Subject**: ${scope}
- **Boundaries**: [Define what is IN and OUT of scope]
- **Stakeholders**: [Who requested, who will review]

---

## Architecture Overview

\`\`\`text
[Add Data Flow Diagram here]

+----------+     HTTPS      +----------+     SQL       +----------+
| External | -------------> |  Process | ------------> |  Data    |
|  Entity  |                |          |               |  Store   |
+----------+                +----------+               +----------+
     |                           |
     |     Trust Boundary        |
     +---------------------------+
\`\`\`

### Components

| ID | Name | Type | Description |
|----|------|------|-------------|
| C001 | [Component] | Process/Store/Entity | [Description] |

### Trust Boundaries

| ID | Name | Description |
|----|------|-------------|
| TB001 | [Boundary] | [What privilege change occurs] |

### Data Flows

| ID | Source | Destination | Data | Protocol |
|----|--------|-------------|------|----------|
| DF001 | [From] | [To] | [What data] | [HTTP/SQL/etc] |

---

## STRIDE Analysis

${strideSections}

---

## Threat Matrix

| ID | Element | STRIDE | Threat | Likelihood | Impact | Risk | Mitigation Status |
|----|---------|--------|--------|------------|--------|------|-------------------|
| T001 | [Element] | [S/T/R/I/D/E] | [Threat description] | [H/M/L] | [H/M/L] | [Crit/High/Med/Low] | [Planned/In Progress/Done] |

---

## Risk Summary

### By Risk Level

| Risk Level | Count | Threats |
|------------|-------|---------|
| Critical | 0 | |
| High | 0 | |
| Medium | 0 | |
| Low | 0 | |

### By STRIDE Category

| Category | Count | Notes |
|----------|-------|-------|
| Spoofing | 0 | |
| Tampering | 0 | |
| Repudiation | 0 | |
| Information Disclosure | 0 | |
| Denial of Service | 0 | |
| Elevation of Privilege | 0 | |

---

## Mitigations

### Critical/High Priority

[List mitigations for Critical and High risk threats]

### Medium Priority

[List mitigations for Medium risk threats]

### Accepted Risks

[List threats accepted with justification]

---

## Validation Checklist

- [ ] All components have at least one threat identified
- [ ] All trust boundaries documented
- [ ] All STRIDE categories considered
- [ ] All Critical/High risks have mitigations planned
- [ ] Peer review completed
- [ ] Stakeholder sign-off obtained

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | ${date} | [Author] | Initial threat model |

---

## References

- OWASP Threat Modeling: https://owasp.org/www-community/Threat_Modeling
- Microsoft STRIDE: https://docs.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats
`;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  let scope = "";
  let outputPath = "";

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--scope": scope = argv[++i] ?? ""; break;
      case "--output": outputPath = argv[++i] ?? ""; break;
      case "--help":
      case "-h":
        console.log("Usage: bun run generate_threat_matrix.ts --scope <name> --output <path>");
        return 0;
    }
  }

  if (!scope || !outputPath) {
    console.error("ERROR: --scope and --output are required");
    return 1;
  }

  try {
    const resolvedOutput = validatePathNoTraversal(outputPath);
    const dir = dirname(resolvedOutput);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const date = new Date().toISOString().split("T")[0];
    const content = generateTemplate(scope, date);
    await Bun.write(resolvedOutput, content);

    console.log(`Generated threat matrix: ${resolvedOutput}`);
    console.log(`Scope: ${scope}`);
    console.log(`STRIDE categories: ${STRIDE_CATEGORIES.length}`);

    return 0;
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    return 1;
  }
}

process.exit(await main());
