/**
 * JSON Schema to TypeScript Type Generator
 *
 * Reads all *.schema.json files from schemas/ and generates TypeScript types.
 * Output: generated/types.ts
 *
 * Usage: bun run scripts/generate-types.ts
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { compile, type JSONSchema } from "json-schema-to-typescript";

const BANNER_COMMENT = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 *
 * This file was automatically generated from JSON Schema files.
 * Any manual changes will be overwritten on the next generation.
 *
 * To regenerate: bun run generate:types
 * Source schemas: packages/validation/schemas/*.schema.json
 *
 * Generated: ${new Date().toISOString()}
 */

`;

const SCHEMAS_DIR = join(dirname(import.meta.dir), "schemas");
const OUTPUT_DIR = join(dirname(import.meta.dir), "generated");
const OUTPUT_FILE = join(OUTPUT_DIR, "types.ts");

interface SchemaFile {
  path: string;
  name: string;
  schema: JSONSchema;
}

async function findSchemaFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".schema.json")) {
        files.push(fullPath);
      }
    }
  }

  if (existsSync(dir)) {
    await walk(dir);
  }

  return files.sort();
}

async function loadSchema(filePath: string): Promise<SchemaFile> {
  const content = await readFile(filePath, "utf-8");
  const schema = JSON.parse(content) as JSONSchema;
  const name = basename(filePath, ".schema.json");

  return { path: filePath, name, schema };
}

async function generateTypes(schemas: SchemaFile[]): Promise<string> {
  const typeDefinitions: string[] = [];

  for (const { name, schema, path } of schemas) {
    try {
      const relativePath = path.replace(SCHEMAS_DIR, "schemas");
      const ts = await compile(schema, name, {
        bannerComment: "",
        additionalProperties: false,
        strictIndexSignatures: true,
        enableConstEnums: true,
        declareExternallyReferenced: true,
      });

      typeDefinitions.push(`// Source: ${relativePath}\n${ts}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[FAIL] Failed to compile ${name}: ${message}`);
      throw error;
    }
  }

  return typeDefinitions.join("\n");
}

async function main(): Promise<void> {
  console.log("JSON Schema to TypeScript Type Generator");
  console.log("========================================\n");

  // Find schema files
  console.log(`Scanning: ${SCHEMAS_DIR}`);
  const schemaFiles = await findSchemaFiles(SCHEMAS_DIR);

  if (schemaFiles.length === 0) {
    console.log("[WARNING] No schema files found in schemas/");
    console.log("Add *.schema.json files to packages/validation/schemas/");

    // Ensure output directory exists
    if (!existsSync(OUTPUT_DIR)) {
      await mkdir(OUTPUT_DIR, { recursive: true });
    }

    // Write empty types file with banner
    const emptyContent = `${BANNER_COMMENT}// No schemas found. Add *.schema.json files to packages/validation/schemas/\nexport {};\n`;
    await writeFile(OUTPUT_FILE, emptyContent, "utf-8");
    console.log(`[COMPLETE] Empty types file written to: ${OUTPUT_FILE}`);
    return;
  }

  console.log(`Found ${schemaFiles.length} schema file(s):\n`);
  for (const file of schemaFiles) {
    const relativePath = file.replace(`${dirname(SCHEMAS_DIR)}/`, "");
    console.log(`  - ${relativePath}`);
  }
  console.log();

  // Load schemas
  const schemas = await Promise.all(schemaFiles.map(loadSchema));
  console.log(`[PASS] Loaded ${schemas.length} schema(s)`);

  // Generate types
  const types = await generateTypes(schemas);
  console.log(`[PASS] Generated TypeScript types`);

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  // Write output file
  const output = BANNER_COMMENT + types;
  await writeFile(OUTPUT_FILE, output, "utf-8");

  console.log(`\n[COMPLETE] Types written to: ${OUTPUT_FILE}`);
  console.log(`           Total schemas: ${schemas.length}`);
  console.log(`           Output size: ${output.length} bytes`);
}

main().catch((error) => {
  console.error("\n[FAIL] Type generation failed:");
  console.error(error);
  process.exit(1);
});
