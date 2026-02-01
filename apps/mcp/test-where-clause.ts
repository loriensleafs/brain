import { createVectorConnection } from "./src/db/connection.js";

const db = createVectorConnection();

// Get a sample embedding
const sample = db
	.query("SELECT embedding FROM brain_embeddings LIMIT 1")
	.get() as any;
const float32 = new Float32Array(
	sample.embedding.buffer,
	sample.embedding.byteOffset,
	sample.embedding.byteLength / 4,
);

console.log("Testing WHERE clause with distance...\n");

// Test 1: No WHERE clause
const test1 = db
	.query(`
  SELECT COUNT(*) as count
  FROM brain_embeddings
`)
	.get() as any;
console.log(`Test 1 - No WHERE: ${test1.count} results`);

// Test 2: WHERE with distance calculation
const maxDist = 0.99;
console.log(`\nTest 2 - WHERE distance <= ${maxDist}:`);
try {
	const test2 = db
		.query(`
    SELECT COUNT(*) as count
    FROM brain_embeddings
    WHERE vec_distance_cosine(embedding, ?) <= ?
  `)
		.get(float32, maxDist) as any;
	console.log(`  Result: ${test2.count} results`);
} catch (e: any) {
	console.log(`  Error: ${e.message}`);
}

// Test 3: Explicit distance SELECT with WHERE
console.log(`\nTest 3 - SELECT distance with WHERE:`);
try {
	const test3 = db
		.query(`
    SELECT
      chunk_id,
      vec_distance_cosine(embedding, ?) as distance
    FROM brain_embeddings
    WHERE distance <= ?
    LIMIT 5
  `)
		.all(float32, maxDist);
	console.log(`  Found ${test3.length} results`);
	if (test3.length > 0) {
		test3.forEach((r: any) =>
			console.log(`    - ${r.chunk_id}: distance=${r.distance}`),
		);
	}
} catch (e: any) {
	console.log(`  Error: ${e.message}`);
}

db.close();
