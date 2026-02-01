import { Database } from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createEmbeddingsTable } from "../schema";

// Note: Custom SQLite is configured in test preload (src/__tests__/setup.ts)

describe("brain_embeddings schema", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		sqliteVec.load(db);
	});

	afterEach(() => {
		db.close();
	});

	test("creates brain_embeddings virtual table", () => {
		createEmbeddingsTable(db);

		const result = db
			.query(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='brain_embeddings'",
			)
			.get() as any;

		expect(result?.name).toBe("brain_embeddings");
	});

	test("can insert and query embeddings", () => {
		createEmbeddingsTable(db);

		// Create a test embedding (768 dimensions)
		const embedding = new Float32Array(768).fill(0.1);

		// Insert
		db.run(
			"INSERT INTO brain_embeddings (entity_id, embedding) VALUES (?, ?)",
			["test-entity-1", embedding],
		);

		// Query
		const result = db
			.query("SELECT entity_id FROM brain_embeddings WHERE entity_id = ?")
			.get("test-entity-1") as any;

		expect(result?.entity_id).toBe("test-entity-1");
	});
});
