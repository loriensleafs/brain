#!/usr/bin/env bun
/**
 * CVA Matrix Validation Script
 *
 * Checks CVA matrix completeness and suggests patterns based on structure.
 *
 * Exit Codes:
 *   0: Valid matrix, patterns suggested
 *   10: Validation failure (missing rows/columns, empty cells)
 *   1: Error (file not found, invalid format)
 *
 * Usage:
 *   bun run validate-cva-matrix.ts cva-matrix.md
 *   bun run validate-cva-matrix.ts cva-matrix.md --verbose
 */

const enum ValidationResult {
  VALID = 0,
  VALIDATION_FAILURE = 10,
  ERROR = 1,
}

interface CVAMatrix {
  rows: string[];
  columns: string[];
  cells: string[][];
}

function rowCount(matrix: CVAMatrix): number {
  return matrix.rows.length;
}

function columnCount(matrix: CVAMatrix): number {
  return matrix.columns.length;
}

function hasEmptyCells(matrix: CVAMatrix): boolean {
  for (const row of matrix.cells) {
    for (const cell of row) {
      if (!cell || ["", "-", "TBD", "TODO"].includes(cell.trim())) {
        return true;
      }
    }
  }
  return false;
}

function calculateRowVariability(matrix: CVAMatrix): number {
  if (matrix.cells.length === 0) return 0.0;

  const totalCells = matrix.cells.reduce((sum, row) => sum + row.length, 0);
  let uniqueCells = 0;

  for (const row of matrix.cells) {
    const uniqueValues = new Set(row).size;
    if (uniqueValues > 1) {
      uniqueCells += uniqueValues;
    }
  }

  return totalCells > 0 ? uniqueCells / totalCells : 0.0;
}

function calculateColumnVariability(matrix: CVAMatrix): number {
  const firstRow = matrix.cells[0];
  if (matrix.cells.length === 0 || !firstRow || firstRow.length === 0) return 0.0;

  const numCols = firstRow.length;
  const numRows = matrix.cells.length;
  const totalCells = numRows * numCols;
  let uniqueCells = 0;

  for (let colIdx = 0; colIdx < numCols; colIdx++) {
    const columnValues = matrix.cells.map((row) => row[colIdx]);
    const uniqueValues = new Set(columnValues).size;
    if (uniqueValues > 1) {
      uniqueCells += uniqueValues;
    }
  }

  return totalCells > 0 ? uniqueCells / totalCells : 0.0;
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

function validateMatrix(matrix: CVAMatrix): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (rowCount(matrix) < 2) {
    issues.push(
      `Matrix has only ${rowCount(matrix)} row(s). Need >=2 commonalities for pattern discovery.`
    );
  }

  if (columnCount(matrix) < 2) {
    issues.push(
      `Matrix has only ${columnCount(matrix)} column(s). Need >=2 variabilities for pattern discovery.`
    );
  }

  if (hasEmptyCells(matrix)) {
    issues.push("Matrix has empty cells. All cells must be filled with concrete implementations.");
  }

  for (let idx = 0; idx < matrix.cells.length; idx++) {
    const row = matrix.cells[idx];
    if (row && row.length !== columnCount(matrix)) {
      issues.push(
        `Row ${idx + 1} has ${row.length} cells, expected ${columnCount(matrix)}.`
      );
    }
  }

  return { isValid: issues.length === 0, issues };
}

function suggestPatterns(matrix: CVAMatrix): string[] {
  const suggestions: string[] = [];

  const rowVar = calculateRowVariability(matrix);
  const colVar = calculateColumnVariability(matrix);

  const HIGH_VAR = 0.6;
  const MEDIUM_VAR = 0.3;

  if (rowVar < MEDIUM_VAR && colVar < MEDIUM_VAR) {
    suggestions.push("LOW VARIABILITY: Matrix shows minimal variation.");
    suggestions.push("   Consider NOT abstracting (YAGNI). Document rationale in ADR.");
    suggestions.push(`   Row variability: ${rowVar.toFixed(2)}, Column variability: ${colVar.toFixed(2)}`);
  }

  if (rowVar >= HIGH_VAR && colVar < MEDIUM_VAR) {
    suggestions.push("PRIMARY PATTERN: Strategy Pattern");
    suggestions.push("  Rationale: High row variability (operations vary across use cases)");
    suggestions.push(`  Row variability: ${rowVar.toFixed(2)} (high)`);
    suggestions.push("  Each row (commonality) can be a strategy with multiple implementations.");
  }

  if (colVar >= HIGH_VAR && rowVar < MEDIUM_VAR) {
    suggestions.push("PRIMARY PATTERN: Abstract Factory Pattern");
    suggestions.push("  Rationale: High column variability (coherent product families)");
    suggestions.push(`  Column variability: ${colVar.toFixed(2)} (high)`);
    suggestions.push("  Each column represents a family of related implementations.");
  }

  if (rowVar >= HIGH_VAR && colVar >= HIGH_VAR) {
    suggestions.push("COMBINATION PATTERNS: Strategy + Abstract Factory");
    suggestions.push("  Rationale: High variability in BOTH dimensions (multidimensional)");
    suggestions.push(
      `  Row variability: ${rowVar.toFixed(2)} (high), Column variability: ${colVar.toFixed(2)} (high)`
    );
    suggestions.push("  Start with dominant axis, note multidimensional case in Extension Points.");
  }

  if (rowVar >= MEDIUM_VAR && rowVar < HIGH_VAR) {
    suggestions.push("MEDIUM ROW VARIABILITY: Consider Strategy pattern");
    suggestions.push(`  Row variability: ${rowVar.toFixed(2)} (medium)`);
    suggestions.push("  Evaluate if abstraction overhead is justified.");
  }

  if (colVar >= MEDIUM_VAR && colVar < HIGH_VAR) {
    suggestions.push("MEDIUM COLUMN VARIABILITY: Consider Abstract Factory pattern");
    suggestions.push(`  Column variability: ${colVar.toFixed(2)} (medium)`);
    suggestions.push("  Evaluate if family cohesion justifies factory pattern.");
  }

  return suggestions;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log("Usage: bun run validate-cva-matrix.ts <matrix-file> [--verbose]");
    return ValidationResult.ERROR;
  }

  const matrixFile = args.find((a) => !a.startsWith("-"));
  const verbose = args.includes("--verbose") || args.includes("-v");

  if (!matrixFile) {
    console.error("ERROR: No matrix file specified");
    return ValidationResult.ERROR;
  }

  // Validate input path to prevent path traversal (CWE-22)
  const { resolve } = await import("path");
  const allowedBase = resolve(".");
  const resolvedPath = resolve(matrixFile);
  if (!resolvedPath.startsWith(allowedBase)) {
    console.error(`ERROR: Path traversal attempt detected in matrix_file: ${matrixFile}`);
    return ValidationResult.ERROR;
  }

  // Read file
  const file = Bun.file(resolvedPath);
  if (!(await file.exists())) {
    console.error(`ERROR: File not found: ${resolvedPath}`);
    return ValidationResult.ERROR;
  }

  let content: string;
  try {
    content = await file.text();
  } catch {
    console.error(`ERROR: Failed to read file: ${resolvedPath}`);
    return ValidationResult.ERROR;
  }

  // Parse matrix
  const matrix = parseMarkdownTable(content);
  if (matrix === null) {
    console.error("ERROR: Failed to parse CVA matrix from file");
    console.error("Expected Markdown table format:");
    console.error("| Commonality | Var1 | Var2 |");
    console.error("|-------------|------|------|");
    console.error("| Common1     | A1   | B1   |");
    return ValidationResult.ERROR;
  }

  if (verbose) {
    console.log("\nCVA Matrix Dimensions:");
    console.log(`   Rows (commonalities): ${rowCount(matrix)}`);
    console.log(`   Columns (variabilities): ${columnCount(matrix)}`);
    console.log(`   Total cells: ${rowCount(matrix) * columnCount(matrix)}`);
  }

  // Validate matrix
  const { isValid, issues } = validateMatrix(matrix);

  if (!isValid) {
    console.error("\nVALIDATION FAILED");
    console.error("\nIssues found:");
    for (const issue of issues) {
      console.error(`  - ${issue}`);
    }
    return ValidationResult.VALIDATION_FAILURE;
  }

  // Suggest patterns
  console.log("\n[PASS] VALIDATION PASSED");
  console.log(`\nMatrix: ${rowCount(matrix)} commonalities x ${columnCount(matrix)} variabilities`);

  const patterns = suggestPatterns(matrix);
  if (patterns.length > 0) {
    console.log("\nPATTERN RECOMMENDATIONS:\n");
    for (const pattern of patterns) {
      console.log(pattern);
    }
  }

  console.log("\n[PASS] Next Steps:");
  console.log('  1. Review pattern recommendations with team');
  console.log('  2. Route to decision-critic: /decision-critic "Validate [pattern] per CVA"');
  console.log("  3. Create ADR with architect agent");
  console.log("  4. Document reassessment triggers");

  return ValidationResult.VALID;
}

process.exit(await main());
