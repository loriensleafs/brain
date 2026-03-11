#!/usr/bin/env bun
/**
 * CVA Matrix Exporter
 *
 * Converts a CVA matrix Markdown table to other formats (Mermaid diagram).
 *
 * Exit Codes:
 *   0: Export successful
 *   1: Error (file not found, invalid format, parse failure)
 *
 * Usage:
 *   bun run export-cva-matrix.ts --input cva-matrix.md --format mermaid --output cva-diagram.mmd
 */

import { resolve } from "path";

interface CVAMatrix {
  rows: string[];
  columns: string[];
  cells: string[][];
}

function parseMarkdownTable(content: string): CVAMatrix | null {
  const lines = content.split("\n");
  const tableLines: string[] = [];
  let inTable = false;

  for (const line of lines) {
    if (line.trim().startsWith("|")) {
      inTable = true;
      tableLines.push(line.trim());
    } else if (inTable && !line.trim().startsWith("|")) {
      break;
    }
  }

  if (tableLines.length < 3) return null;

  const headerLine = tableLines[0];
  if (!headerLine) return null;
  const headerCells = headerLine
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
  if (headerCells.length === 0) return null;

  const columns = headerCells.slice(1);
  const rows: string[] = [];
  const cells: string[][] = [];

  for (const line of tableLines.slice(2)) {
    const rowCells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    const firstCell = rowCells[0];
    if (rowCells.length > 0 && firstCell !== undefined) {
      rows.push(firstCell);
      cells.push(rowCells.slice(1));
    }
  }

  return { rows, columns, cells };
}

function sanitizeId(text: string): string {
  return text.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function toMermaidFlowchart(matrix: CVAMatrix): string {
  const lines: string[] = [];
  lines.push("flowchart TD");
  lines.push("");

  // Create commonality nodes (rows)
  lines.push("  %% Commonalities (what's constant)");
  for (const row of matrix.rows) {
    const id = `C_${sanitizeId(row)}`;
    lines.push(`  ${id}["${row}"]`);
  }
  lines.push("");

  // Create variability nodes (columns)
  lines.push("  %% Variabilities (what differs)");
  for (const col of matrix.columns) {
    const id = `V_${sanitizeId(col)}`;
    lines.push(`  ${id}(["${col}"])`);
  }
  lines.push("");

  // Create implementation nodes and links
  lines.push("  %% Implementations (matrix cells)");
  for (let rowIdx = 0; rowIdx < matrix.rows.length; rowIdx++) {
    const rowName = matrix.rows[rowIdx] ?? "";
    for (let colIdx = 0; colIdx < matrix.columns.length; colIdx++) {
      const colName = matrix.columns[colIdx] ?? "";
      const cell = matrix.cells[rowIdx]?.[colIdx];
      if (cell && !["TBD", "TODO", "-", ""].includes(cell.trim())) {
        const implId = `I_${sanitizeId(rowName)}_${sanitizeId(colName)}`;
        const commonId = `C_${sanitizeId(rowName)}`;
        const varId = `V_${sanitizeId(colName)}`;

        lines.push(`  ${implId}>"${cell}"]`);
        lines.push(`  ${commonId} --> ${implId}`);
        lines.push(`  ${varId} -.-> ${implId}`);
      }
    }
  }
  lines.push("");

  // Style
  lines.push("  %% Styling");
  lines.push("  classDef commonality fill:#e1f5fe,stroke:#0288d1");
  lines.push("  classDef variability fill:#f3e5f5,stroke:#7b1fa2");
  lines.push("  classDef implementation fill:#e8f5e9,stroke:#388e3c");
  lines.push("");

  for (const row of matrix.rows) {
    lines.push(`  class C_${sanitizeId(row)} commonality`);
  }
  for (const col of matrix.columns) {
    lines.push(`  class V_${sanitizeId(col)} variability`);
  }
  for (let rowIdx = 0; rowIdx < matrix.rows.length; rowIdx++) {
    const rowName = matrix.rows[rowIdx] ?? "";
    for (let colIdx = 0; colIdx < matrix.columns.length; colIdx++) {
      const colName = matrix.columns[colIdx] ?? "";
      const cell = matrix.cells[rowIdx]?.[colIdx];
      if (cell && !["TBD", "TODO", "-", ""].includes(cell.trim())) {
        const implId = `I_${sanitizeId(rowName)}_${sanitizeId(colName)}`;
        lines.push(`  class ${implId} implementation`);
      }
    }
  }

  return lines.join("\n");
}

function toMermaidClassDiagram(matrix: CVAMatrix): string {
  const lines: string[] = [];
  lines.push("classDiagram");
  lines.push("");

  // Abstract interface from commonalities
  lines.push("  class ICommonOperations {");
  lines.push("    <<interface>>");
  for (const row of matrix.rows) {
    lines.push(`    +${sanitizeId(row)}()`);
  }
  lines.push("  }");
  lines.push("");

  // Concrete classes from variabilities
  for (let colIdx = 0; colIdx < matrix.columns.length; colIdx++) {
    const className = sanitizeId(matrix.columns[colIdx] ?? "");
    lines.push(`  class ${className} {`);
    for (let rowIdx = 0; rowIdx < matrix.rows.length; rowIdx++) {
      const cell = matrix.cells[rowIdx]?.[colIdx] ?? "TBD";
      lines.push(`    +${sanitizeId(matrix.rows[rowIdx] ?? "")}() ${cell}`);
    }
    lines.push("  }");
    lines.push(`  ICommonOperations <|.. ${className}`);
    lines.push("");
  }

  return lines.join("\n");
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: bun run export-cva-matrix.ts \\
  --input cva-matrix.md \\
  --format mermaid \\
  --output cva-diagram.mmd

Formats:
  mermaid      Mermaid flowchart showing commonalities, variabilities, implementations
  class        Mermaid class diagram showing interface + concrete implementations`);
    return 1;
  }

  let inputPath = "";
  let format = "mermaid";
  let outputPath = "";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--input":
        inputPath = args[++i] ?? "";
        break;
      case "--format":
        format = args[++i] ?? "mermaid";
        break;
      case "--output":
        outputPath = args[++i] ?? "";
        break;
    }
  }

  if (!inputPath) {
    console.error("ERROR: --input is required");
    return 1;
  }

  const resolvedInput = resolve(inputPath);
  const file = Bun.file(resolvedInput);

  if (!(await file.exists())) {
    console.error(`ERROR: File not found: ${resolvedInput}`);
    return 1;
  }

  const content = await file.text();
  const matrix = parseMarkdownTable(content);

  if (!matrix) {
    console.error("ERROR: Failed to parse CVA matrix from file");
    return 1;
  }

  let output: string;
  switch (format) {
    case "mermaid":
      output = toMermaidFlowchart(matrix);
      break;
    case "class":
      output = toMermaidClassDiagram(matrix);
      break;
    default:
      console.error(`ERROR: Unknown format: ${format}. Supported: mermaid, class`);
      return 1;
  }

  if (outputPath) {
    await Bun.write(resolve(outputPath), output);
    console.log(`[PASS] Exported CVA matrix to ${format} format: ${outputPath}`);
  } else {
    console.log(output);
  }

  return 0;
}

process.exit(await main());
