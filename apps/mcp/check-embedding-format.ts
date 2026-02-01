import { createVectorConnection } from "./src/db/connection.js";

const db = createVectorConnection();

// Get a sample embedding
const sample = db
  .query("SELECT chunk_id, entity_id, embedding FROM brain_embeddings LIMIT 1")
  .get() as any;

if (sample) {
  console.log(`Sample embedding from database:`);
  console.log(`  - chunk_id: ${sample.chunk_id}`);
  console.log(
    `  - embedding is Uint8Array: ${sample.embedding instanceof Uint8Array}`,
  );
  console.log(`  - embedding byte length: ${sample.embedding.length}`);
  console.log(
    `  - embedding as Float32Array would be: ${sample.embedding.length / 4} floats`,
  );

  // Convert to Float32Array
  const float32 = new Float32Array(
    sample.embedding.buffer,
    sample.embedding.byteOffset,
    sample.embedding.byteLength / 4,
  );
  console.log(`  - Converted to Float32Array: ${float32.length} dimensions`);
  console.log(
    `  - First 5 values: [${Array.from(float32.slice(0, 5)).join(", ")}]`,
  );

  // Try to query with this embedding
  console.log(
    `\nTrying to search with the same embedding (should match itself)...`,
  );
  try {
    const results = db
      .query(`
      SELECT
        chunk_id,
        entity_id,
        vec_distance_cosine(embedding, ?) as distance
      FROM brain_embeddings
      LIMIT 1
    `)
      .all(float32);

    console.log(`Found ${results.length} results`);
    if (results.length > 0) {
      console.log("Result:", results[0]);
    }
  } catch (e: any) {
    console.log(`Error during search: ${e.message}`);
  }
}

db.close();
